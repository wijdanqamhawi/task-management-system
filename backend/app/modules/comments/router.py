"""Comments (FR-026) and the COMMENT notifications they raise (FR-058)."""
import re

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field, field_validator

from app.common.access import require_task_visible
from app.db import Db, get_db
from app.deps import current_user
from app.modules.notifications import service as notifications

router = APIRouter(tags=["comments"])

_MENTION = re.compile(r"(?<![\w.])@([A-Za-z0-9._-]{3,50})")


class CommentBody(BaseModel):
    body: str = Field(min_length=1, max_length=4000)

    @field_validator("body")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be blank")
        return v


def _view(r: dict) -> dict:
    return {"commentId": r["comment_id"], "taskId": r["task_id"], "userId": r["user_id"],
            "authorName": r["author_name"], "body": r["body"], "createdAt": r["created_at"]}


_SELECT = """SELECT c.comment_id, c.task_id, c.user_id, u.full_name AS author_name, c.body,
                    c.created_at
               FROM comments c JOIN users u ON u.user_id = c.user_id"""


@router.get("/api/tasks/{task_id}/comments")
def list_comments(task_id: int, user: dict = Depends(current_user), db: Db = Depends(get_db)):
    require_task_visible(db, user, task_id)
    rows = db.query(f"{_SELECT} WHERE c.task_id = :t ORDER BY c.created_at, c.comment_id",
                    {"t": task_id})
    return [_view(r) for r in rows]


@router.post("/api/tasks/{task_id}/comments", status_code=201)
def post_comment(task_id: int, payload: CommentBody, response: Response,
                 user: dict = Depends(current_user), db: Db = Depends(get_db)):
    task = require_task_visible(db, user, task_id)
    text = payload.body.strip()
    comment_id = db.insert(
        "INSERT INTO comments (task_id, user_id, body) VALUES (:t, :u, :b)",
        {"t": task_id, "u": user["user_id"], "b": text}, "comment_id")

    # FR-058: notify people mentioned, and the task's assignees/creator, in this transaction.
    names = {m.rstrip("._-").lower() for m in _MENTION.findall(text)}
    mentioned: list[int] = []
    for name in names:
        row = db.one("SELECT user_id FROM users WHERE LOWER(username) = :n", {"n": name})
        if row:
            mentioned.append(row["user_id"])
    owners = [r["user_id"] for r in db.query(
        "SELECT user_id FROM task_assignees WHERE task_id = :t", {"t": task_id})]
    owners.append(task["created_by"])
    notifications.notify(
        db, task=task, recipient_ids=mentioned, trigger_type=notifications.COMMENT,
        message=f'{user["full_name"]} mentioned you in a comment on "{task["title"]}"',
        actor_id=user["user_id"])
    notifications.notify(
        db, task=task, recipient_ids=[o for o in owners if o not in mentioned],
        trigger_type=notifications.COMMENT,
        message=f'{user["full_name"]} commented on "{task["title"]}"',
        actor_id=user["user_id"])
    db.commit()
    response.headers["Location"] = f"/api/tasks/{task_id}/comments"
    return _view(db.one(f"{_SELECT} WHERE c.comment_id = :id", {"id": comment_id}))
