/* /api/recycle-bin: soft-deleted tasks. Read and restore only; there is no permanent delete. */
import { api, query } from './client.js';

export const listDeletedTasks = (params, opts) => api.get(`/recycle-bin/tasks${query(params)}`, opts);
/** Resolves to { task, removedAssignees: [{ userId, fullName, reason }] }. */
export const restoreTask = (id) => api.post(`/recycle-bin/tasks/${id}/restore`);
