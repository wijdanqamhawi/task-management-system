"""Outgoing e-mail for the password-reset flow, over a configurable SMTP server.

Nothing is hardcoded: host, port, credentials, sender and link base all come from the
environment (config.py, .env.example). When SMTP is not configured `configured` is False and
the caller sends nothing; this module never pretends a message was delivered.

Tokens, passwords and message bodies are never logged. Failures are logged by type only.
"""
import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Protocol

from app.config import Settings, get_settings

log = logging.getLogger("tms.mail")


class Mailer(Protocol):
    @property
    def configured(self) -> bool: ...

    def send_password_reset(self, *, to: str, full_name: str, link: str, minutes: int) -> None: ...


def reset_link(settings: Settings, token: str) -> str:
    # The token travels in the URL FRAGMENT: browsers never send it to a server, so it cannot
    # appear in access logs or Referer headers.
    return f"{settings.app_base_url.rstrip('/')}/reset-password#token={token}"


def build_reset_message(settings: Settings, *, to: str, full_name: str, link: str,
                        minutes: int) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = "Reset your Task Management password"
    msg["From"] = settings.mail_from
    msg["To"] = to
    name = full_name.strip() or "there"
    msg.set_content(
        f"Hello {name},\n\n"
        "We received a request to reset your password. Open this link to choose a new one:\n\n"
        f"{link}\n\n"
        f"The link works once and expires in {minutes} minutes. If you did not ask for this, "
        "ignore this message: your password stays unchanged.\n")
    return msg


class SmtpMailer:
    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def configured(self) -> bool:
        s = self.settings
        return bool(s.smtp_host and s.mail_from and s.app_base_url)

    def send_password_reset(self, *, to: str, full_name: str, link: str, minutes: int) -> None:
        s = self.settings
        msg = build_reset_message(s, to=to, full_name=full_name, link=link, minutes=minutes)
        security = s.smtp_security
        if security == "ssl":
            server = smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=15,
                                      context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15)
        try:
            if security == "starttls":
                server.starttls(context=ssl.create_default_context())
            if s.smtp_user:
                server.login(s.smtp_user, s.smtp_password)
            server.send_message(msg)
        finally:
            try:
                server.quit()
            except Exception:       # the connection may already be gone; nothing to do
                pass


def get_mailer() -> Mailer:
    """FastAPI dependency (tests override it with an in-memory outbox)."""
    return SmtpMailer(get_settings())


def deliver(mailer: Mailer, *, to: str, full_name: str, link: str, minutes: int) -> None:
    """Background-task wrapper: a send failure is logged (type only) and never raised."""
    try:
        mailer.send_password_reset(to=to, full_name=full_name, link=link, minutes=minutes)
    except Exception as exc:
        log.error("Password reset e-mail could not be sent (%s)", type(exc).__name__)
