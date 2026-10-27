"""Permission codes (RBAC Phase 2). The catalogue itself lives in the database
(PERMISSIONS / ROLE_PERMISSIONS, seeded by database/seed/rbac_data.sql); these constants only
name the codes the application checks, so a typo cannot silently turn into "no one has it".

A permission is a GLOBAL capability held through the user's role. It never replaces the
resource-level rules (project membership, manager membership, assignee, creator, uploader),
which stay in `common/access.py` and the services and are always applied on top.
"""

USER_ROLE_ASSIGN = "USER_ROLE_ASSIGN"
USER_STATUS_MANAGE = "USER_STATUS_MANAGE"
PROJECT_VIEW = "PROJECT_VIEW"
PROJECT_VIEW_ALL = "PROJECT_VIEW_ALL"
PROJECT_CREATE = "PROJECT_CREATE"
PROJECT_UPDATE = "PROJECT_UPDATE"
PROJECT_DELETE = "PROJECT_DELETE"
PROJECT_MEMBER_MANAGE = "PROJECT_MEMBER_MANAGE"
PROJECT_MANAGE_ALL = "PROJECT_MANAGE_ALL"
TASK_VIEW = "TASK_VIEW"
TASK_CREATE = "TASK_CREATE"
TASK_EDIT = "TASK_EDIT"
TASK_ASSIGN = "TASK_ASSIGN"
TASK_STATUS_CHANGE = "TASK_STATUS_CHANGE"
TASK_DELETE_ANY = "TASK_DELETE_ANY"
TASK_DELETE_OWN = "TASK_DELETE_OWN"
COMMENT_CREATE = "COMMENT_CREATE"
SUBTASK_MANAGE = "SUBTASK_MANAGE"           # legacy: no longer checked; see PROGRESS_*
PROGRESS_MANAGE = "PROGRESS_MANAGE"         # create / edit / delete Progress items
PROGRESS_TOGGLE = "PROGRESS_TOGGLE"         # mark a Progress item completed / incomplete
ATTACHMENT_UPLOAD = "ATTACHMENT_UPLOAD"
ATTACHMENT_DELETE_ANY = "ATTACHMENT_DELETE_ANY"
ATTACHMENT_DELETE_OWN = "ATTACHMENT_DELETE_OWN"

ALL_PERMISSIONS = frozenset({
    USER_ROLE_ASSIGN, USER_STATUS_MANAGE, PROJECT_VIEW, PROJECT_VIEW_ALL, PROJECT_CREATE,
    PROJECT_UPDATE, PROJECT_DELETE, PROJECT_MEMBER_MANAGE, PROJECT_MANAGE_ALL, TASK_VIEW,
    TASK_CREATE, TASK_EDIT, TASK_ASSIGN, TASK_STATUS_CHANGE, TASK_DELETE_ANY, TASK_DELETE_OWN,
    COMMENT_CREATE, SUBTASK_MANAGE, PROGRESS_MANAGE, PROGRESS_TOGGLE, ATTACHMENT_UPLOAD,
    ATTACHMENT_DELETE_ANY, ATTACHMENT_DELETE_OWN,
})


def has_permission(user: dict, code: str) -> bool:
    """Fail closed: False for a code the application does not know, and for a user dict that
    carries no permission set (e.g. a synthetic user built only to test membership)."""
    if code not in ALL_PERMISSIONS:
        return False
    return code in (user.get("permissions") or ())
