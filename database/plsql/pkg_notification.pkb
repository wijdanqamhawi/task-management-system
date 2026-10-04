-- T130 - PKG_NOTIFICATION body. FR-056, FR-057, FR-061, research.md R-007.
--
-- Only the two date-driven triggers live here. Both are idempotent: the NOT EXISTS guard and
-- the unique index uq_notifications_scheduled mean a repeated run creates nothing new, so a
-- task that stays overdue for days notifies each assignee exactly once.
-- Skips COMPLETED tasks and inactive recipients (FR-061). Defines package code only.

CREATE OR REPLACE PACKAGE BODY pkg_notification AS

  PROCEDURE generate_deadline_notifications (
    p_warning_hours IN NUMBER DEFAULT 24,
    p_created       OUT NUMBER
  ) IS
  BEGIN
    -- Approaching: within p_warning_hours of the due date and not yet overdue.
    INSERT INTO notifications (recipient_id, task_id, trigger_type, message)
    SELECT ta.user_id, t.task_id, 'DEADLINE',
           SUBSTR('Task "' || t.title || '" is due on ' || TO_CHAR(t.due_date, 'YYYY-MM-DD'), 1, 500)
      FROM tasks t
      JOIN task_status s     ON s.status_id = t.status_id
      JOIN task_assignees ta ON ta.task_id  = t.task_id
      JOIN users u           ON u.user_id   = ta.user_id AND u.is_active = 'Y'
     WHERE s.status_code <> 'COMPLETED'
       AND t.due_date IS NOT NULL
       AND t.due_date >= TRUNC(SYSDATE)
       AND SYSDATE >= t.due_date - (NVL(p_warning_hours, 24) / 24)
       AND NOT EXISTS (SELECT 1 FROM notifications n
                        WHERE n.task_id = t.task_id AND n.recipient_id = ta.user_id
                          AND n.trigger_type = 'DEADLINE');
    p_created := SQL%ROWCOUNT;
    COMMIT;
  END generate_deadline_notifications;

  PROCEDURE generate_overdue_notifications (
    p_created OUT NUMBER
  ) IS
  BEGIN
    INSERT INTO notifications (recipient_id, task_id, trigger_type, message)
    SELECT ta.user_id, t.task_id, 'OVERDUE',
           SUBSTR('Task "' || t.title || '" is overdue (was due ' || TO_CHAR(t.due_date, 'YYYY-MM-DD') || ')', 1, 500)
      FROM tasks t
      JOIN task_status s     ON s.status_id = t.status_id
      JOIN task_assignees ta ON ta.task_id  = t.task_id
      JOIN users u           ON u.user_id   = ta.user_id AND u.is_active = 'Y'
     WHERE s.status_code <> 'COMPLETED'
       AND t.due_date IS NOT NULL
       AND t.due_date < TRUNC(SYSDATE)
       AND NOT EXISTS (SELECT 1 FROM notifications n
                        WHERE n.task_id = t.task_id AND n.recipient_id = ta.user_id
                          AND n.trigger_type = 'OVERDUE');
    p_created := SQL%ROWCOUNT;
    COMMIT;
  END generate_overdue_notifications;

END pkg_notification;
/
