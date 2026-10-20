/*
 * Shared enums and labels. Values use the official names (FR-027: exactly four statuses) so the
 * shared <Badge> styling applies unchanged.
 */
export const STATUSES = ['TO_DO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];
export const STATUS_LABELS = {
  TO_DO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  COMPLETED: 'Completed',
};

export const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
export const PRIORITY_LABELS = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

export const PROJECT_STATUSES = ['PLANNED', 'ACTIVE', 'COMPLETED'];
export const PROJECT_STATUS_LABELS = { PLANNED: 'Planned', ACTIVE: 'Active', COMPLETED: 'Completed' };

export const ROLES = ['ADMIN', 'MANAGER', 'MEMBER'];
export const ROLE_LABELS = { ADMIN: 'Admin', MANAGER: 'Manager', MEMBER: 'Member' };

/** Mirrors the backend limits (app/config.py) so the UI can refuse early with a clear message. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = [
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'text/plain', 'text/csv',
  'application/zip', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
export const UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.txt,.csv,.zip,.doc,.docx,.xls,.xlsx';

/**
 * The 21 permission codes in Oracle (PERMISSIONS / ROLE_PERMISSIONS) as returned in
 * `permissions` by /api/auth/login and /api/auth/me. A permission is a GLOBAL capability held
 * through the role; project, task and attachment actions additionally need the resource rule
 * (see utils/permissions.js). Do not add codes here that the database does not define.
 */
export const PERMISSIONS = Object.freeze({
  USER_ROLE_ASSIGN: 'USER_ROLE_ASSIGN',
  USER_STATUS_MANAGE: 'USER_STATUS_MANAGE',
  PROJECT_VIEW: 'PROJECT_VIEW',
  PROJECT_VIEW_ALL: 'PROJECT_VIEW_ALL',
  PROJECT_CREATE: 'PROJECT_CREATE',
  PROJECT_UPDATE: 'PROJECT_UPDATE',
  PROJECT_DELETE: 'PROJECT_DELETE',
  PROJECT_MEMBER_MANAGE: 'PROJECT_MEMBER_MANAGE',
  PROJECT_MANAGE_ALL: 'PROJECT_MANAGE_ALL',
  TASK_VIEW: 'TASK_VIEW',
  TASK_CREATE: 'TASK_CREATE',
  TASK_EDIT: 'TASK_EDIT',
  TASK_ASSIGN: 'TASK_ASSIGN',
  TASK_STATUS_CHANGE: 'TASK_STATUS_CHANGE',
  TASK_DELETE_ANY: 'TASK_DELETE_ANY',
  TASK_DELETE_OWN: 'TASK_DELETE_OWN',
  COMMENT_CREATE: 'COMMENT_CREATE',
  SUBTASK_MANAGE: 'SUBTASK_MANAGE',
  ATTACHMENT_UPLOAD: 'ATTACHMENT_UPLOAD',
  ATTACHMENT_DELETE_ANY: 'ATTACHMENT_DELETE_ANY',
  ATTACHMENT_DELETE_OWN: 'ATTACHMENT_DELETE_OWN',
});
