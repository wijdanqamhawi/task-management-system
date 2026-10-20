/*
 * UI-side permission hints (FR-005, FR-008a-c), driven by the `permissions` array that
 * /api/auth/login and /api/auth/me return from Oracle. These only decide what the interface
 * OFFERS. The API enforces the real rule on every request (Constitution V), so a stale or wrong
 * hint here can never grant access; at worst it shows a button the server then refuses.
 *
 * Two layers, exactly as the backend applies them:
 *   1. a GLOBAL permission held through the role (hasPermission), and
 *   2. the RESOURCE rule on top of it: manager scope (a MANAGER only manages projects they
 *      belong to; PROJECT_MANAGE_ALL, i.e. ADMIN, manages every project), task assignee, task
 *      creator, attachment uploader.
 * A permission alone never grants a project, task or attachment action. Missing or malformed
 * permissions fail closed: nothing is offered. Role names are never used to authorize.
 */
import { PERMISSIONS as P } from '../constants.js';

const KNOWN = new Set(Object.values(P));

/** True only if the user holds this known permission. Unknown codes and absent data are false. */
export function hasPermission(user, code) {
  return KNOWN.has(code) && Array.isArray(user?.permissions) && user.permissions.includes(code);
}

export const hasAnyPermission = (user, codes) => (codes ?? []).some((code) => hasPermission(user, code));

/** Normalise whatever the API returned to a clean array of strings (never undefined). */
export const normalizePermissions = (value) => (
  Array.isArray(value) ? value.filter((code) => typeof code === 'string') : []
);

// ------------------------------------------------------------------ global capabilities

export const canCreateProject = (user) => hasPermission(user, P.PROJECT_CREATE);
export const canViewAllProjects = (user) => hasPermission(user, P.PROJECT_VIEW_ALL);
export const canAssignRoles = (user) => hasPermission(user, P.USER_ROLE_ASSIGN);
export const canManageUserStatus = (user) => hasPermission(user, P.USER_STATUS_MANAGE);
/** The Users screen: reachable with either user-administration permission. */
export const canAdministerUsers = (user) => hasAnyPermission(user, [P.USER_ROLE_ASSIGN, P.USER_STATUS_MANAGE]);

// ------------------------------------------------------------------ resource scope

/**
 * Manager of a project FOR the action that needs `permission`: the user holds it AND is either
 * allowed to manage every project (PROJECT_MANAGE_ALL) or belongs to this project.
 * `managedProjectIds` is the set of project ids the user is a member of (for a non-admin the
 * visible projects are exactly their memberships). The permission is required: a plain MEMBER
 * of the project holds no manager permission, so membership alone never makes a manager.
 */
export function isManagerOf(user, projectId, managedProjectIds, permission) {
  if (!hasPermission(user, permission)) return false;
  return hasPermission(user, P.PROJECT_MANAGE_ALL) || managedProjectIds?.has(projectId) === true;
}

// ------------------------------------------------------------------ project actions

export const canUpdateProject = (user, projectId, ids) => isManagerOf(user, projectId, ids, P.PROJECT_UPDATE);
export const canDeleteProject = (user, projectId, ids) => isManagerOf(user, projectId, ids, P.PROJECT_DELETE);
export const canManageMembers = (user, projectId, ids) => isManagerOf(user, projectId, ids, P.PROJECT_MEMBER_MANAGE);

// ------------------------------------------------------------------ task actions

export const canEditTask = (user, projectId, ids) => isManagerOf(user, projectId, ids, P.TASK_EDIT);
export const canAssign = (user, projectId, ids) => isManagerOf(user, projectId, ids, P.TASK_ASSIGN);

/**
 * Status: TASK_STATUS_CHANGE and then one of: ADMIN-style bypass (PROJECT_MANAGE_ALL), an
 * assignee of THIS task, or a manager of the task's project. MEMBER also holds
 * TASK_STATUS_CHANGE, so the permission alone must never be enough; the manager path is gated
 * by TASK_EDIT, which only managers hold.
 */
export function canChangeStatus(user, task, managedProjectIds) {
  if (!user || !task) return false;
  if (!hasPermission(user, P.TASK_STATUS_CHANGE)) return false;
  if (hasPermission(user, P.PROJECT_MANAGE_ALL)) return true;
  if (task.assignees?.some((a) => a.userId === user.userId)) return true;
  return isManagerOf(user, task.projectId, managedProjectIds, P.TASK_EDIT);
}

/** Delete: a manager of the project, or the creator of the task. */
export function canDeleteTask(user, task, managedProjectIds) {
  if (!user || !task) return false;
  if (isManagerOf(user, task.projectId, managedProjectIds, P.TASK_DELETE_ANY)) return true;
  return hasPermission(user, P.TASK_DELETE_OWN) && user.userId != null && task.createdBy === user.userId;
}

// ------------------------------------------------------------------ attachment actions

/** Delete: the uploader of that attachment, or a manager of the task's project. */
export function canDeleteAttachment(user, attachment, projectId, managedProjectIds) {
  if (!user || !attachment) return false;
  if (isManagerOf(user, projectId, managedProjectIds, P.ATTACHMENT_DELETE_ANY)) return true;
  return hasPermission(user, P.ATTACHMENT_DELETE_OWN) && user.userId != null
    && attachment.uploadedBy === user.userId;
}
