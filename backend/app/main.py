"""Task Management System API: FastAPI over Oracle. Run on port 8080 (the Vite dev proxy
target):  uvicorn app.main:app --port 8080
"""
import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from app import db
from app.config import get_settings
from app.errors import install_handlers
from app.modules.attachments.router import router as attachments_router
from app.modules.auth.router import router as auth_router
from app.modules.comments.router import router as comments_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.notifications.router import router as notifications_router
from app.modules.projects.router import router as projects_router
from app.modules.subtasks.router import router as subtasks_router
from app.modules.tasks.router import router as tasks_router
from app.modules.users.router import router as users_router
from app.modules.notifications.scheduler import run_scheduler

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s: %(message)s")
log = logging.getLogger("tms")


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_pool()
    background = []
    if os.getenv("TMS_SCHEDULER", "on").lower() != "off":     # tests switch it off
        background.append(asyncio.create_task(run_scheduler()))
    try:
        yield
    finally:
        for task in background:
            task.cancel()
        db.close_pool()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Task Management System API", lifespan=lifespan,
                  docs_url=None, redoc_url=None, openapi_url=None)   # API docs are hand-written (R-010)
    app.add_middleware(
        SessionMiddleware, secret_key=settings.session_secret, session_cookie="tms_session",
        max_age=settings.session_max_age, same_site="lax", https_only=False)
    install_handlers(app)
    app.include_router(auth_router)
    app.include_router(users_router)
    app.include_router(projects_router)
    app.include_router(tasks_router)
    app.include_router(subtasks_router)
    app.include_router(comments_router)
    app.include_router(attachments_router)
    app.include_router(dashboard_router)
    app.include_router(notifications_router)
    return app


app = create_app()
