"""/api/notifications (contracts/rest-api.md § Notifications). Recipient-only."""
from fastapi import APIRouter, Depends, Query

from app.common.paging import PageParams
from app.db import Db, get_db
from app.deps import current_user
from app.modules.notifications import service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def list_notifications(unreadOnly: bool = Query(False), params: PageParams = Depends(),
                       user: dict = Depends(current_user), db: Db = Depends(get_db)):
    return service.list_for(db, user, params, unreadOnly)


@router.get("/unread-count")
def unread_count(user: dict = Depends(current_user), db: Db = Depends(get_db)):
    return service.unread_count(db, user)


@router.put("/read-all")
def read_all(user: dict = Depends(current_user), db: Db = Depends(get_db)):
    return service.mark_all_read(db, user)


@router.put("/{notification_id}/read")
def read_one(notification_id: int, user: dict = Depends(current_user), db: Db = Depends(get_db)):
    return service.mark_read(db, user, notification_id)
