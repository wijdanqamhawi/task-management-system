package com.computercenter.taskmanagement.common;

/**
 * T036 — the acting user, resolved from the session on every request.
 *
 * <p>Carries the identity that FR-005 authorization decisions and the R-004 visibility
 * predicate are made against. {@code active} is included so FR-007 can be enforced on every
 * action, not only at login: a deactivated user's next request is refused.
 */
public record CurrentUser(Long userId, String username, Role role, boolean active) {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    public boolean isManager() {
        return role == Role.MANAGER;
    }

    /** Admin and Manager may assign work to others; Member may not (FR-032, FR-008c). */
    public boolean canAssignToOthers() {
        return role == Role.ADMIN || role == Role.MANAGER;
    }
}
