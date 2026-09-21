-- T020 — Indexes driven by FR-046..FR-053 and the SC-006 performance target
-- (95% of searches under 2 seconds against 10,000+ tasks).
--
-- NOTE: every comment sits on its own line. Trailing comments placed after a
-- terminating semicolon are folded into the next statement's buffer by SQL*Plus,
-- which silently skips the following statements.

-- FR-046 filter by project; also project progress on the dashboard.
CREATE INDEX ix_tasks_project ON tasks (project_id);

-- FR-048 filter by status; FR-041 tasks-by-status breakdown.
CREATE INDEX ix_tasks_status ON tasks (status_id);

-- FR-049 filter by priority; FR-042 tasks-by-priority breakdown.
CREATE INDEX ix_tasks_priority ON tasks (priority_id);

-- FR-050 filter by due date; FR-040 overdue counts; FR-056/FR-057 notification jobs.
CREATE INDEX ix_tasks_due_date ON tasks (due_date);

-- FR-051 case-insensitive title search. Function-based so UPPER(title) is indexed.
CREATE INDEX ix_tasks_title_upper ON tasks (UPPER(title));

-- FR-030 assigned-to-me; FR-043 tasks per user; FR-047 filter by user.
CREATE INDEX ix_task_assignees_user ON task_assignees (user_id);

-- FR-015 my projects; FR-031 shared-with-me visibility predicate (R-004).
CREATE INDEX ix_project_members_user ON project_members (user_id);

-- FR-060 unread notification count (SC-013).
CREATE INDEX ix_notifications_recipient ON notifications (recipient_id, is_read);
