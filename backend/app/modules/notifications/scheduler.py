"""Hourly job for the two date-driven triggers (FR-056, FR-057, research.md R-007).

Idempotence does not depend on this schedule: PKG_NOTIFICATION skips anything already raised
and the unique index uq_notifications_scheduled backs that up, so running it twice, or from
several workers at once, never produces a duplicate.
"""
import asyncio
import logging

from app import db

log = logging.getLogger("tms.scheduler")

INTERVAL_SECONDS = 3600
STARTUP_DELAY_SECONDS = 15


def run_once() -> dict:
    with db.connection() as conn:
        (deadline,) = conn.call_proc("pkg_notification.generate_deadline_notifications", [24], 1)
        (overdue,) = conn.call_proc("pkg_notification.generate_overdue_notifications", [], 1)
    return {"deadline": int(deadline or 0), "overdue": int(overdue or 0)}


async def run_scheduler() -> None:
    await asyncio.sleep(STARTUP_DELAY_SECONDS)
    while True:
        try:
            created = await asyncio.to_thread(run_once)
            log.info("Scheduled notifications created: %s", created)
        except asyncio.CancelledError:
            raise
        except Exception as exc:       # keep the loop alive; the next tick retries
            log.warning("Scheduled notification run failed: %s", exc)
        await asyncio.sleep(INTERVAL_SECONDS)
