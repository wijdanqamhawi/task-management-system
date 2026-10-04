/* /api/tasks: contracts/rest-api.md § Tasks. GET /api/tasks is the single search endpoint. */
import { api, query } from './client.js';

export const searchTasks = (params, opts) => api.get(`/tasks${query(params)}`, opts);
export const assignedToMe = (params, opts) => api.get(`/tasks/assigned-to-me${query(params)}`, opts);
export const sharedWithMe = (params, opts) => api.get(`/tasks/shared-with-me${query(params)}`, opts);
export const getTask = (id, opts) => api.get(`/tasks/${id}`, opts);
export const createTask = (body) => api.post('/tasks', body);
export const updateTask = (id, body) => api.put(`/tasks/${id}`, body);
export const deleteTask = (id) => api.delete(`/tasks/${id}`);
/** The only route that changes status (R-005). */
export const changeStatus = (id, status) => api.patch(`/tasks/${id}/status`, { status });
export const assignUsers = (id, userIds) => api.post(`/tasks/${id}/assignees`, { userIds });
export const unassignUser = (id, userId) => api.delete(`/tasks/${id}/assignees/${userId}`);
