"""Forgot / reset password (research.md R-002; FR-002, FR-007).

Integration tests run against the real Oracle schema but touch ONLY temporary users whose
e-mail starts with `zztest` (removed by the autouse cleanup in conftest.py, which also removes
their reset tokens via ON DELETE CASCADE). No real user's password is read or changed, and no
e-mail leaves the machine: the mailer is replaced by an in-memory outbox, and the SMTP client
is exercised against a local socket sink.
"""
import dataclasses
import email
import email.policy
import hashlib
import logging
import socket
import threading

import pytest
from fastapi.testclient import TestClient

from app import mailer as mail
from app import ratelimit
from app.config import get_settings
from tests.conftest import ADMIN, DEMO_PASSWORD

OLD = "OldPassw0rd!"
NEW = "BrandNewPassw0rd!"
GENERIC = "If an account exists for that email address, a password reset link will be emailed shortly."
INVALID = "This password reset link is invalid or has expired."


class Outbox:
    """Stands in for the SMTP mailer and records what would have been sent."""

    def __init__(self, configured=True):
        self._configured = configured
        self.sent = []

    @property
    def configured(self):
        return self._configured

    def send_password_reset(self, *, to, full_name, link, minutes):
        self.sent.append({"to": to, "full_name": full_name, "link": link, "minutes": minutes})

    def token_for(self, email):
        mails = [m for m in self.sent if m["to"].lower() == email.lower()]
        assert mails, f"no mail for {email}"
        return mails[-1]["link"].split("#token=", 1)[1]


@pytest.fixture()
def outbox(app, anon):
    box = Outbox()
    ratelimit.clear_all()
    app.dependency_overrides[mail.get_mailer] = lambda: box
    yield box
    app.dependency_overrides.pop(mail.get_mailer, None)
    ratelimit.clear_all()


@pytest.fixture()
def make_user(anon):
    def _make(tag):
        email = f"zztest.reset.{tag}@example.org"
        r = anon.post("/api/auth/register", json={"email": email, "password": OLD,
                                                  "fullName": f"ZZTEST Reset {tag}"})
        assert r.status_code == 201, r.text
        return email
    return _make


@pytest.fixture()
def fresh(app):
    clients = []

    def _client():
        c = TestClient(app)
        clients.append(c)
        return c
    yield _client
    for c in clients:
        c.close()


def sha(raw):
    return hashlib.sha256(raw.encode()).hexdigest()


def forgot(client, email):
    return client.post("/api/auth/forgot-password", json={"email": email})


def reset(client, token, password=NEW):
    return client.post("/api/auth/reset-password", json={"token": token, "password": password})


def can_login(client, email, password):
    return client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200


# --------------------------------------------------------------------- happy path

def test_success_new_password_works_and_old_does_not(outbox, make_user, fresh):
    email = make_user("ok")
    r = forgot(fresh(), email)
    assert r.status_code == 202 and r.json()["message"] == GENERIC
    assert len(outbox.sent) == 1 and outbox.sent[0]["minutes"] == 15
    token = outbox.token_for(email)
    assert fresh().post("/api/auth/reset-password/validate", json={"token": token}).json() == {"valid": True}
    assert reset(fresh(), token).status_code == 204
    assert can_login(fresh(), email, NEW)
    assert not can_login(fresh(), email, OLD)


def test_link_carries_token_in_the_fragment_not_the_query(outbox, make_user, fresh):
    email = make_user("frag")
    forgot(fresh(), email)
    link = outbox.sent[0]["link"]
    assert "#token=" in link and "?token" not in link


# --------------------------------------------------------------------- token storage

def test_only_a_hash_is_stored_and_expiry_is_15_minutes(outbox, make_user, fresh, dbc):
    email = make_user("hash")
    forgot(fresh(), email)
    token = outbox.token_for(email)
    rows = dbc.query(
        "SELECT t.* FROM password_reset_tokens t JOIN users u ON u.user_id = t.user_id "
        "WHERE u.email = :e", {"e": email})
    assert len(rows) == 1
    row = rows[0]
    assert row["token_hash"] == sha(token) and len(row["token_hash"]) == 64
    assert token not in " ".join(str(v) for v in row.values())          # raw token not stored
    minutes = (row["expires_at"] - row["created_at"]).total_seconds() / 60
    assert 14.9 <= minutes <= 15.1
    assert row["used_at"] is None


# --------------------------------------------------------------------- single use / expiry

def test_token_is_single_use(outbox, make_user, fresh):
    email = make_user("once")
    forgot(fresh(), email)
    token = outbox.token_for(email)
    assert reset(fresh(), token).status_code == 204
    again = reset(fresh(), token, "AnotherPassw0rd!")
    assert again.status_code == 400 and again.json()["message"] == INVALID
    assert fresh().post("/api/auth/reset-password/validate", json={"token": token}).json() == {"valid": False}
    assert can_login(fresh(), email, NEW)                    # the second attempt changed nothing
    assert not can_login(fresh(), email, "AnotherPassw0rd!")


def test_expired_token_is_rejected_and_password_unchanged(outbox, make_user, fresh, dbc):
    email = make_user("exp")
    forgot(fresh(), email)
    token = outbox.token_for(email)
    dbc.execute(
        "UPDATE password_reset_tokens SET expires_at = SYSTIMESTAMP - NUMTODSINTERVAL(1, 'MINUTE') "
        "WHERE user_id = (SELECT user_id FROM users WHERE email = :e)", {"e": email})
    dbc.commit()
    assert fresh().post("/api/auth/reset-password/validate", json={"token": token}).json() == {"valid": False}
    r = reset(fresh(), token)
    assert r.status_code == 400 and r.json()["message"] == INVALID
    assert can_login(fresh(), email, OLD)


def test_new_request_supersedes_the_previous_link(outbox, make_user, fresh):
    email = make_user("sup")
    forgot(fresh(), email)
    first = outbox.token_for(email)
    forgot(fresh(), email)
    second = outbox.token_for(email)
    assert first != second
    assert reset(fresh(), first).status_code == 400
    assert reset(fresh(), second).status_code == 204


# --------------------------------------------------------------------- invalid tokens

def test_invalid_tokens_all_get_the_same_generic_error(outbox, make_user, fresh):
    make_user("bad")
    for token in ("not-a-real-token", "A" * 43, "x" * 150, " ", "' OR 1=1 --"):
        r = reset(fresh(), token)
        assert r.status_code == 400 and r.json()["message"] == INVALID, token
    assert reset(fresh(), "").status_code == 400            # empty: rejected by validation
    assert reset(fresh(), "t" * 500).status_code == 400     # overlong: rejected by validation


def test_a_reset_token_cannot_be_used_for_another_account(outbox, make_user, fresh, dbc):
    a, b = make_user("ua"), make_user("ub")
    forgot(fresh(), a)
    token_a = outbox.token_for(a)
    before = dbc.scalar("SELECT password_hash FROM users WHERE email = :e", {"e": b})
    assert reset(fresh(), token_a).status_code == 204
    assert dbc.scalar("SELECT password_hash FROM users WHERE email = :e", {"e": b}) == before
    assert can_login(fresh(), b, OLD)


# --------------------------------------------------------------------- enumeration

def test_unknown_email_gets_the_identical_response_and_creates_nothing(outbox, make_user, fresh, dbc):
    known = make_user("known")
    r_known = forgot(fresh(), known)
    r_unknown = forgot(fresh(), "zztest.nobody.here@example.org")
    assert r_known.status_code == r_unknown.status_code == 202
    assert r_known.json() == r_unknown.json()
    assert [m["to"] for m in outbox.sent] == [known]         # no mail for the unknown address
    assert dbc.scalar("SELECT COUNT(*) FROM password_reset_tokens") >= 1
    assert dbc.scalar("SELECT COUNT(*) FROM users WHERE email = 'zztest.nobody.here@example.org'") == 0


def test_deactivated_account_gets_the_generic_response_and_no_mail(outbox, make_user, fresh, login, dbc):
    email = make_user("off")
    uid = dbc.scalar("SELECT user_id FROM users WHERE email = :e", {"e": email})
    assert login(ADMIN).put(f"/api/users/{uid}/deactivate").status_code == 200
    r = forgot(fresh(), email)
    assert r.status_code == 202 and r.json()["message"] == GENERIC
    assert outbox.sent == []
    assert dbc.scalar("SELECT COUNT(*) FROM password_reset_tokens WHERE user_id = :u", {"u": uid}) == 0


def test_malformed_email_is_a_validation_error_not_an_account_probe(outbox, fresh):
    assert forgot(fresh(), "not-an-email").status_code == 400


def test_nothing_is_sent_or_stored_when_smtp_is_not_configured(app, make_user, fresh, dbc):
    box = Outbox(configured=False)
    ratelimit.clear_all()
    app.dependency_overrides[mail.get_mailer] = lambda: box
    try:
        email = make_user("nosmtp")
        r = forgot(fresh(), email)
        assert r.status_code == 202 and r.json()["message"] == GENERIC     # same answer
        assert box.sent == []
        assert dbc.scalar(
            "SELECT COUNT(*) FROM password_reset_tokens t JOIN users u ON u.user_id = t.user_id "
            "WHERE u.email = :e", {"e": email}) == 0
    finally:
        app.dependency_overrides.pop(mail.get_mailer, None)
        ratelimit.clear_all()


# --------------------------------------------------------------------- password policy

def test_password_policy_is_enforced_and_does_not_burn_the_token(outbox, make_user, fresh):
    email = make_user("pol")
    forgot(fresh(), email)
    token = outbox.token_for(email)
    short = reset(fresh(), token, "short")
    assert short.status_code == 400 and "password" in short.json()["fieldErrors"]
    long_ = reset(fresh(), token, "é" * 40)                  # 80 bytes > bcrypt's 72
    assert long_.status_code == 400 and "password" in long_.json()["fieldErrors"]
    assert reset(fresh(), token).status_code == 204          # the same link still works


# --------------------------------------------------------------------- rate limiting

def test_per_email_limit_is_3_per_hour_and_silent(outbox, make_user, fresh):
    email = make_user("rl")
    statuses = [forgot(fresh(), email).status_code for _ in range(5)]
    assert statuses == [202] * 5                              # no signal to the caller
    assert len(outbox.sent) == 3


def test_per_ip_limit_is_10_per_hour(outbox, fresh):
    c = fresh()
    codes = [forgot(c, f"zztest.ip{i}@example.org").status_code for i in range(11)]
    assert codes[:10] == [202] * 10 and codes[10] == 429


def test_failed_reset_attempts_are_limited_per_ip(outbox, fresh):
    c = fresh()
    codes = [reset(c, f"guess-{i}").status_code for i in range(21)]
    assert codes[:20] == [400] * 20 and codes[20] == 429


def test_database_backstop_caps_tokens_per_account(outbox, make_user, fresh, dbc):
    from app.modules.auth import reset as reset_service
    email = make_user("db")
    for _ in range(3):
        assert reset_service.issue_token(dbc, email, 15, "127.0.0.1") is not None
    assert reset_service.issue_token(dbc, email, 15, "127.0.0.1") is None


# --------------------------------------------------------------------- sessions

def test_reset_ends_older_sessions_but_not_other_users_sessions(outbox, make_user, fresh):
    victim, bystander = make_user("sv"), make_user("sb")
    old_session, other_session = fresh(), fresh()
    assert old_session.post("/api/auth/login", json={"email": victim, "password": OLD,
                                                     "remember": True}).status_code == 200
    assert other_session.post("/api/auth/login", json={"email": bystander, "password": OLD,
                                                       "remember": True}).status_code == 200
    assert old_session.get("/api/auth/me").status_code == 200
    forgot(fresh(), victim)
    assert reset(fresh(), outbox.token_for(victim)).status_code == 204
    assert old_session.get("/api/auth/me").status_code == 401        # stolen/old cookie is dead
    assert other_session.get("/api/auth/me").status_code == 200      # unrelated session intact
    fresh_login = fresh()
    assert can_login(fresh_login, victim, NEW)
    assert fresh_login.get("/api/auth/me").status_code == 200


def test_session_fingerprint_is_not_exposed_in_responses(outbox, make_user, fresh):
    email = make_user("fp")
    c = fresh()
    body = c.post("/api/auth/login", json={"email": email, "password": OLD}).json()
    assert "pw_fp" not in body and "pwf" not in body and "passwordHash" not in str(body)
    assert "pw_fp" not in c.get("/api/auth/me").json()


# --------------------------------------------------------------------- logging

def test_tokens_and_passwords_never_reach_the_logs(outbox, make_user, fresh, caplog):
    caplog.set_level(logging.DEBUG)
    email = make_user("log")
    forgot(fresh(), email)
    token = outbox.token_for(email)
    reset(fresh(), "wrong-token-value-123")
    assert reset(fresh(), token).status_code == 204
    text = caplog.text
    assert token not in text and NEW not in text and OLD not in text and "wrong-token-value-123" not in text


# --------------------------------------------------------------------- SMTP client (no DB)

class SmtpSink:
    """Minimal single-purpose SMTP server on a random localhost port."""

    def __init__(self):
        self.messages = []
        self._sock = socket.socket()
        self._sock.bind(("127.0.0.1", 0))
        self._sock.listen(5)
        self.port = self._sock.getsockname()[1]
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def _loop(self):
        while True:
            try:
                conn, _ = self._sock.accept()
            except OSError:
                return
            threading.Thread(target=self._serve, args=(conn,), daemon=True).start()

    def _serve(self, conn):
        f = conn.makefile("rwb")

        def say(line):
            f.write(line.encode() + b"\r\n")
            f.flush()
        say("220 sink ESMTP")
        data_mode, buf = False, []
        for raw in f:
            line = raw.decode("utf-8", "replace").rstrip("\r\n")
            if data_mode:
                if line == ".":
                    self.messages.append("\r\n".join(buf))
                    data_mode, buf = False, []
                    say("250 queued")
                else:
                    buf.append(line[1:] if line.startswith("..") else line)
                continue
            cmd = line.upper()
            if cmd.startswith(("EHLO", "HELO")):
                say("250 sink")
            elif cmd.startswith(("MAIL", "RCPT", "RSET", "NOOP")):
                say("250 OK")
            elif cmd.startswith("DATA"):
                say("354 go ahead")
                data_mode = True
            elif cmd.startswith("QUIT"):
                say("221 bye")
                break
            else:
                say("502 not implemented")
        conn.close()

    def close(self):
        self._sock.close()


def _smtp_settings(port):
    return dataclasses.replace(
        get_settings(), smtp_host="127.0.0.1", smtp_port=port, smtp_security="none",
        smtp_user="", smtp_password="", mail_from="noreply@example.org",
        app_base_url="http://localhost:5173")


def test_smtp_mailer_delivers_a_well_formed_message_to_a_local_sink():
    sink = SmtpSink()
    try:
        settings = _smtp_settings(sink.port)
        mailer = mail.SmtpMailer(settings)
        assert mailer.configured
        link = mail.reset_link(settings, "TOKEN-123_abc")
        assert link == "http://localhost:5173/reset-password#token=TOKEN-123_abc"
        mailer.send_password_reset(to="zztest.someone@example.org", full_name="ZZTEST Someone",
                                   link=link, minutes=15)
        assert len(sink.messages) == 1
        parsed = email.message_from_string(sink.messages[0], policy=email.policy.default)
        assert parsed["From"] == "noreply@example.org" and parsed["To"] == "zztest.someone@example.org"
        assert parsed["Subject"] == "Reset your Task Management password"
        body = parsed.get_content()                  # decoded (transport encoding undone)
        assert link in body and "15 minutes" in body
    finally:
        sink.close()


def test_smtp_mailer_is_unconfigured_without_host_sender_or_base_url():
    base = dataclasses.replace(get_settings(), smtp_host="", mail_from="", app_base_url="")
    assert not mail.SmtpMailer(base).configured
    assert not mail.SmtpMailer(dataclasses.replace(base, smtp_host="h", mail_from="a@b.c")).configured
    assert mail.SmtpMailer(dataclasses.replace(
        base, smtp_host="h", mail_from="a@b.c", app_base_url="http://x")).configured


def test_mail_header_injection_is_neutralised():
    settings = _smtp_settings(1)
    with pytest.raises(ValueError):
        mail.build_reset_message(settings, to="a@example.org\r\nBcc: evil@example.org",
                                 full_name="x", link="http://l", minutes=15)


def test_delivery_failure_is_logged_by_type_and_never_raised(caplog):
    caplog.set_level(logging.DEBUG)
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()                                                 # nothing listens here now
    mailer = mail.SmtpMailer(_smtp_settings(port))
    mail.deliver(mailer, to="zztest.x@example.org", full_name="X",
                 link="http://localhost:5173/reset-password#token=SECRET-TOKEN-XYZ", minutes=15)
    assert "could not be sent" in caplog.text
    assert "SECRET-TOKEN-XYZ" not in caplog.text
