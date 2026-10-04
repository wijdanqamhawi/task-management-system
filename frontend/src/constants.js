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
