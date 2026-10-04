"""US5: subtasks, comments, attachments (FR-024..FR-026)."""
import io

import pytest

from app.config import get_settings
from app.modules.attachments import storage
from tests.conftest import MANAGER, MEMBER, MEMBER_OTHER, user_id


@pytest.fixture()
def ctx(login, new_project):
    manager, member, outsider = login(MANAGER), login(MEMBER), login(MEMBER_OTHER)
    pid = new_project(manager, [user_id(member)])["projectId"]
    tid = manager.post("/api/tasks", json={"projectId": pid, "title": "ZZTEST detail"}).json()["taskId"]
    return {"manager": manager, "member": member, "outsider": outsider, "tid": tid}


def test_subtask_lifecycle(ctx):
    m, tid = ctx["member"], ctx["tid"]
    created = m.post(f"/api/tasks/{tid}/subtasks", json={"title": "ZZTEST step", "sortOrder": 1})
    assert created.status_code == 201 and created.json()["isCompleted"] is False
    sid = created.json()["subtaskId"]
    done = m.put(f"/api/subtasks/{sid}", json={"isCompleted": True})
    assert done.status_code == 200 and done.json()["isCompleted"] is True
    assert done.json()["title"] == "ZZTEST step"
    assert [s["subtaskId"] for s in m.get(f"/api/tasks/{tid}/subtasks").json()] == [sid]
    assert ctx["outsider"].put(f"/api/subtasks/{sid}", json={"isCompleted": False}).status_code == 404
    assert ctx["outsider"].delete(f"/api/subtasks/{sid}").status_code == 404
    assert m.delete(f"/api/subtasks/{sid}").status_code == 204
    assert m.get(f"/api/tasks/{tid}/subtasks").json() == []


def test_blank_subtask_title_is_rejected(ctx):
    assert ctx["member"].post(f"/api/tasks/{ctx['tid']}/subtasks", json={"title": "  "}).status_code == 400


def test_comments_ordered_with_author(ctx):
    m, mgr, tid = ctx["member"], ctx["manager"], ctx["tid"]
    assert m.post(f"/api/tasks/{tid}/comments", json={"body": "first"}).status_code == 201
    assert mgr.post(f"/api/tasks/{tid}/comments", json={"body": "second"}).status_code == 201
    comments = m.get(f"/api/tasks/{tid}/comments").json()
    assert [c["body"] for c in comments] == ["first", "second"]
    assert comments[0]["authorName"] and comments[0]["userId"] == user_id(m)
    assert ctx["outsider"].post(f"/api/tasks/{tid}/comments", json={"body": "x"}).status_code == 404
    assert m.post(f"/api/tasks/{tid}/comments", json={"body": ""}).status_code == 400


def upload(client, tid, name="notes.txt", data=b"hello", content_type="text/plain"):
    return client.post(f"/api/tasks/{tid}/attachments", files={"file": (name, io.BytesIO(data), content_type)})


def test_attachment_upload_download_and_metadata_only_in_db(ctx, dbc):
    m, tid = ctx["member"], ctx["tid"]
    r = upload(m, tid, name="../../evil name.txt", data=b"payload-123")
    assert r.status_code == 201, r.text
    meta = r.json()
    assert meta["originalName"] == "evil name.txt" and meta["sizeBytes"] == 11
    stored = dbc.scalar("SELECT stored_name FROM attachments WHERE attachment_id = :i",
                        {"i": meta["attachmentId"]})
    assert stored != meta["originalName"] and len(stored) == 32          # system-generated (R-008)
    assert storage.path_of(stored).read_bytes() == b"payload-123"
    dl = m.get(f"/api/attachments/{meta['attachmentId']}")
    assert dl.status_code == 200 and dl.content == b"payload-123"
    assert "evil%20name.txt" in dl.headers["content-disposition"]
    assert [a["attachmentId"] for a in m.get(f"/api/tasks/{tid}/attachments").json()] == [meta["attachmentId"]]


def test_attachment_visibility_and_delete_rules(ctx):
    m, tid = ctx["member"], ctx["tid"]
    aid = upload(m, tid).json()["attachmentId"]
    assert ctx["outsider"].get(f"/api/attachments/{aid}").status_code == 404     # outside caller's projects
    assert ctx["outsider"].delete(f"/api/attachments/{aid}").status_code == 404
    other = upload(ctx["manager"], tid, name="m.txt").json()["attachmentId"]
    assert m.delete(f"/api/attachments/{other}").status_code == 403              # not uploader, not manager
    assert ctx["manager"].delete(f"/api/attachments/{aid}").status_code == 204   # manager of project
    assert m.get(f"/api/attachments/{aid}").status_code == 404


def test_disallowed_type_oversize_and_empty_leave_no_row_or_file(ctx, dbc):
    m, tid = ctx["member"], ctx["tid"]
    base = get_settings().attachment_dir
    files_before = len(list(base.iterdir())) if base.exists() else 0
    assert upload(m, tid, name="x.exe", content_type="application/x-msdownload").status_code == 415
    limit = get_settings().max_upload_bytes
    assert upload(m, tid, data=b"a" * (limit + 1)).status_code == 413
    assert upload(m, tid, data=b"").status_code == 400
    assert dbc.scalar("SELECT COUNT(*) FROM attachments WHERE task_id = :t", {"t": tid}) == 0
    assert (len(list(base.iterdir())) if base.exists() else 0) == files_before


def test_deleting_a_task_removes_attachment_rows_and_files(ctx, dbc):
    m, tid = ctx["member"], ctx["tid"]
    aid = upload(m, tid).json()["attachmentId"]
    stored = dbc.scalar("SELECT stored_name FROM attachments WHERE attachment_id = :i", {"i": aid})
    assert storage.exists(stored)
    assert ctx["manager"].delete(f"/api/tasks/{tid}").status_code == 204
    assert dbc.scalar("SELECT COUNT(*) FROM attachments WHERE attachment_id = :i", {"i": aid}) == 0
    assert not storage.exists(stored)
