package com.computercenter.taskmanagement.common;

/**
 * T037 — the single shared visibility predicate (research.md R-004).
 *
 * <p><strong>One definition, used everywhere.</strong> Task lists, search, filtering, and every
 * dashboard figure intersect with this fragment. Expressing it once is what stops FR-030,
 * FR-031, FR-045 and FR-053 from drifting apart — the classic failure being a task hidden from
 * a list that still shows up inside a dashboard count.
 *
 * <p>The rule, from the [CLARIFIED] decision in spec.md FR-035:
 * <ul>
 *   <li>a user may see a task if they are a member of the task's project;</li>
 *   <li>an Admin may see every task;</li>
 *   <li>"assigned to me" is the subset where the user is an assignee;</li>
 *   <li>"shared with me" is the complement — visible, but not assigned.</li>
 * </ul>
 */
public final class TaskVisibility {

    private TaskVisibility() {
    }

    /** Bind name for the acting user's id. Callers must supply it with every fragment. */
    public static final String USER_PARAM = "visibilityUserId";

    /**
     * Restricts {@code tasks} (aliased by {@code taskAlias}) to what the user may see.
     * Admin bypasses the membership test; everyone else must be a project member.
     */
    public static String taskPredicate(String taskAlias, boolean admin) {
        if (admin) {
            return "1 = 1";
        }
        return """
               EXISTS (SELECT 1
                         FROM project_members pm
                        WHERE pm.project_id = %s.project_id
                          AND pm.user_id = :%s)
               """.formatted(taskAlias, USER_PARAM);
    }

    /** Restricts {@code projects} (aliased by {@code projectAlias}) to the user's projects. */
    public static String projectPredicate(String projectAlias, boolean admin) {
        if (admin) {
            return "1 = 1";
        }
        return """
               EXISTS (SELECT 1
                         FROM project_members pm
                        WHERE pm.project_id = %s.project_id
                          AND pm.user_id = :%s)
               """.formatted(projectAlias, USER_PARAM);
    }

    /** True when the user is an assignee — "assigned to me" (FR-030). */
    public static String assignedPredicate(String taskAlias) {
        return """
               EXISTS (SELECT 1
                         FROM task_assignees ta
                        WHERE ta.task_id = %s.task_id
                          AND ta.user_id = :%s)
               """.formatted(taskAlias, USER_PARAM);
    }

    /**
     * True when the task is visible but the user is NOT an assignee — "shared with me"
     * (FR-031, FR-035 [CLARIFIED]). Must be combined with {@link #taskPredicate}.
     */
    public static String sharedPredicate(String taskAlias) {
        return """
               NOT EXISTS (SELECT 1
                             FROM task_assignees ta
                            WHERE ta.task_id = %s.task_id
                              AND ta.user_id = :%s)
               """.formatted(taskAlias, USER_PARAM);
    }
}
