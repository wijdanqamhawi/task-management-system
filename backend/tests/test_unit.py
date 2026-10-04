"""Unit tests that need no database."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.common.paging import PageParams, page_response
from app.db import camel, to_camel
from app.errors import ApiError, install_handlers
from app.modules.attachments.router import _clean_name
from app.modules.tasks.service import STATUSES, _like
from app.security import hash_password, verify_password

# The demo seed hash is a Spring Security BCrypt ($2a$) hash of "Password1!".
SEED_HASH = "$2a$10$V0MBuKWF.bL1KY91ELHnGu8gLHuKl.HfBJG3EAGgd7qzgCeG1xU7S"


def test_verifies_existing_spring_bcrypt_hash():
    assert verify_password("Password1!", SEED_HASH)
    assert not verify_password("wrong", SEED_HASH)


def test_hash_roundtrip_and_unknown_user_never_verifies():
    h = hash_password("S3cret-pass")
    assert h != "S3cret-pass" and verify_password("S3cret-pass", h)
    assert verify_password("anything", None) is False


def test_exactly_four_statuses_in_workflow_order():
    assert STATUSES == ("TO_DO", "IN_PROGRESS", "REVIEW", "COMPLETED")


def test_camel_case():
    assert to_camel("full_name") == "fullName"
    assert camel({"task_id": 1, "due_date": None}) == {"taskId": 1, "dueDate": None}


def test_paging_shape():
    page = page_response([1, 2], PageParams(page=1, size=2), 5)
    assert page == {"content": [1, 2], "page": 1, "size": 2, "totalElements": 5, "totalPages": 3}
    assert page_response([], PageParams(page=0, size=20), 0)["totalPages"] == 0


def test_like_pattern_escapes_wildcards():
    assert _like("50%_off") == r"%50\%\_OFF%"


@pytest.mark.parametrize("raw,expected", [
    ("../../etc/passwd", "passwd"), (r"C:\x\report.pdf", "report.pdf"),
    ("", "file"), (None, "file"), ("a<b>.txt", "a_b_.txt")])
def test_attachment_name_is_sanitised(raw, expected):
    assert _clean_name(raw) == expected


def _error_app():
    app = FastAPI()
    install_handlers(app)

    class Body(BaseModel):
        name: str

    @app.post("/validate")
    def validate(body: Body):
        return body

    @app.get("/boom")
    def boom():
        raise ApiError(409, "Duplicate")

    return TestClient(app, raise_server_exceptions=False)


def test_error_body_matches_contract():
    r = _error_app().get("/boom")
    body = r.json()
    assert r.status_code == 409
    assert set(body) == {"timestamp", "status", "error", "message", "path"}
    assert body["status"] == 409 and body["message"] == "Duplicate" and body["path"] == "/boom"


def test_validation_error_has_field_errors():
    r = _error_app().post("/validate", json={})
    body = r.json()
    assert r.status_code == 400 and body["error"] == "Validation failed"
    assert "name" in body["fieldErrors"]


def test_unknown_route_uses_contract_body():
    r = _error_app().get("/nope")
    assert r.status_code == 404 and r.json()["status"] == 404 and "message" in r.json()
