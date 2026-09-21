-- T025 — PKG_NOTIFICATION specification. FR-056, FR-057, research.md R-007.
--
-- Only the two DATE-DRIVEN triggers live here. The three action-driven triggers
-- (ASSIGNMENT, UPDATE, COMMENT) are written by the backend inside the transaction of
-- the action that causes them, so they need no scheduled generation.
--
-- Both routines are idempotent: the unique index uq_notifications_scheduled makes a
-- repeated run a no-op, so a task overdue for days notifies exactly once (R-007).

CREATE OR REPLACE PACKAGE pkg_notification AS

  -- FR-056 [CLARIFIED]: "approaching" = 24 hours before due_date.
  -- Skips tasks already COMPLETED and recipients who are inactive (FR-061).
  PROCEDURE generate_deadline_notifications (
    p_warning_hours IN NUMBER DEFAULT 24,
    p_created       OUT NUMBER
  );

  -- FR-057: due_date has passed and the task is not COMPLETED.
  PROCEDURE generate_overdue_notifications (
    p_created OUT NUMBER
  );

END pkg_notification;
/
