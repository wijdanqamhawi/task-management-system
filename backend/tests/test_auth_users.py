"""US1: registration, login, session revocation, roles, activation (FR-001..FR-008a)."""
from tests.conftest import ADMIN, DEMO_PASSWORD, INACTIVE, MEMBER, user_id

NEW = {"email": "zztest.one@example.org", "password": "Passw0rd!", "fullName": "ZZTEST One"}


def test_database_connection_and_reference_data(dbc):
    assert dbc.scalar("SELECT COUNT(*) FROM task_status") == 4
    assert dbc.scalar("SELECT COUNT(*) FROM roles") == 3


def test_me_requires_authentication(anon):
    r = anon.get("/api/auth/me")
    assert r.status_code == 401 and r.json()["status"] == 401


def test_register_creates_active_member_without_password_in_body(anon):
    r = anon.post("/api/auth/register", json=NEW)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["role"] == "MEMBER" and body["isActive"] is True
    assert body["username"] == "zztest.one"           # derived: the form has no username field
    assert "password" not in str(body).lower().replace("passwordhash", "")


def test_register_duplicate_email_is_409(anon):
    assert anon.post("/api/auth/register", json=NEW).status_code == 201
    r = anon.post("/api/auth/register", json={**NEW, "email": NEW["email"].upper()})
    assert r.status_code == 409


def test_register_validation_returns_field_errors(anon):
    r = anon.post("/api/auth/register", json={"email": "nope", "password": "x", "fullName": ""})
    assert r.status_code == 400
    assert {"email", "password", "fullName"} <= set(r.json()["fieldErrors"])


def test_login_and_logout(anon, login):
    client = login(ADMIN)
    me = client.get("/api/auth/me").json()
    assert me["role"] == "ADMIN" and me["email"] == ADMIN
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_bad_credentials_and_deactivated_account_give_identical_401(anon):
    wrong = anon.post("/api/auth/login", json={"email": ADMIN, "password": "nope"})
    unknown = anon.post("/api/auth/login", json={"email": "zz@example.org", "password": "x"})
    inactive = anon.post("/api/auth/login", json={"email": INACTIVE, "password": DEMO_PASSWORD})
    assert wrong.status_code == unknown.status_code == inactive.status_code == 401
    assert wrong.json()["message"] == unknown.json()["message"] == inactive.json()["message"]


def test_deactivation_revokes_an_existing_session_on_next_request(anon, login):
    anon.post("/api/auth/register", json=NEW)
    victim = login(NEW["email"], NEW["password"])
    admin = login(ADMIN)
    uid = user_id(victim)
    assert victim.get("/api/auth/me").status_code == 200
    assert admin.put(f"/api/users/{uid}/deactivate").status_code == 200
    assert victim.get("/api/auth/me").status_code == 401          # SC-008: next request
    assert admin.put(f"/api/users/{uid}/activate").status_code == 200


def test_admin_cannot_deactivate_self(login):
    admin = login(ADMIN)
    r = admin.put(f"/api/users/{user_id(admin)}/deactivate")
    assert r.status_code == 400


def test_role_assignment_admin_only_and_validated(anon, login):
    anon.post("/api/auth/register", json=NEW)
    admin, member = login(ADMIN), login(MEMBER)
    uid = admin.get("/api/users", params={"search": "zztest.one"}).json()["content"][0]["userId"]
    assert member.put(f"/api/users/{uid}/role", json={"role": "MANAGER"}).status_code == 403
    assert admin.put(f"/api/users/{uid}/role", json={"role": "SUPERUSER"}).status_code == 400
    ok = admin.put(f"/api/users/{uid}/role", json={"role": "MANAGER"})
    assert ok.status_code == 200 and ok.json()["role"] == "MANAGER"


def test_member_cannot_use_admin_endpoints(login):
    member = login(MEMBER)
    uid = user_id(login(ADMIN))
    assert member.put(f"/api/users/{uid}/deactivate").status_code == 403
    assert member.put(f"/api/users/{uid}/activate").status_code == 403


def test_update_own_profile_and_list_users(login):
    member = login(MEMBER)
    original = member.get("/api/auth/me").json()
    r = member.put("/api/users/me", json={"fullName": "ZZTEST renamed"})
    assert r.status_code == 200 and r.json()["fullName"] == "ZZTEST renamed"
    member.put("/api/users/me", json={"fullName": original["fullName"]})
    page = member.get("/api/users", params={"page": 0, "size": 3}).json()
    assert set(page) == {"content", "page", "size", "totalElements", "totalPages"}
    assert len(page["content"]) <= 3
    assert member.get("/api/users/999999").status_code == 404
