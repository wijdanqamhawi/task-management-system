-- T024 — PKG_DASHBOARD specification. FR-036..FR-045, research.md R-006.
--
-- Every routine takes p_user_id and applies the visibility rule of R-004 INSIDE the
-- query, so FR-045 ("count only data the viewing user is permitted to see") cannot be
-- bypassed by a caller that forgets to filter.
--
-- Visibility: a user sees a task if they are a member of its project, or hold ADMIN.

CREATE OR REPLACE PACKAGE pkg_dashboard AS

  -- FR-036 .. FR-040 — the five scalar figures, in one round trip.
  PROCEDURE get_totals (
    p_user_id         IN  NUMBER,
    p_total_projects  OUT NUMBER,
    p_total_tasks     OUT NUMBER,
    p_completed_tasks OUT NUMBER,
    p_pending_tasks   OUT NUMBER,   -- every task not COMPLETED
    p_overdue_tasks   OUT NUMBER    -- past due_date and not COMPLETED
  );

  -- FR-041 — tasks by status. Returns status_code, task_count.
  FUNCTION tasks_by_status   (p_user_id IN NUMBER) RETURN SYS_REFCURSOR;

  -- FR-042 — tasks by priority. Returns priority_code, task_count.
  FUNCTION tasks_by_priority (p_user_id IN NUMBER) RETURN SYS_REFCURSOR;

  -- FR-043 — tasks assigned to each user. Returns user_id, full_name, task_count.
  FUNCTION tasks_by_user     (p_user_id IN NUMBER) RETURN SYS_REFCURSOR;

  -- FR-044 — project progress. Returns project_id, name, total_tasks,
  -- completed_tasks, percent_complete (completed / total).
  FUNCTION project_progress  (p_user_id IN NUMBER) RETURN SYS_REFCURSOR;

  -- FR-044 for a single project (GET /api/projects/{id}/progress).
  FUNCTION project_progress_one (p_user_id IN NUMBER, p_project_id IN NUMBER)
    RETURN SYS_REFCURSOR;

END pkg_dashboard;
/
