package com.computercenter.taskmanagement.common;

/**
 * T036 — the three roles of FR-008.
 *
 * <p>This is a [CLARIFIED] project decision, not an official requirement: the official
 * document requires "roles and permissions" without naming any role. Exactly these three
 * exist, and the database enforces the same set via {@code ck_roles_name}.
 */
public enum Role {
    /** Manages user accounts, role assignment, and activation/deactivation (FR-008a). */
    ADMIN,
    /** Creates and manages projects, assigns members, assigns tasks (FR-008b). */
    MANAGER,
    /** Works on assigned tasks, updates status, comments, subtasks, attachments (FR-008c). */
    MEMBER;

    public String authority() {
        return "ROLE_" + name();
    }
}
