/* Subtasks, comments and attachments: contracts/rest-api.md § Subtasks, comments, attachments. */
import { api } from './client.js';

export const listSubtasks = (taskId, opts) => api.get(`/tasks/${taskId}/subtasks`, opts);
export const addSubtask = (taskId, title) => api.post(`/tasks/${taskId}/subtasks`, { title });
export const updateSubtask = (id, body) => api.put(`/subtasks/${id}`, body);
export const deleteSubtask = (id) => api.delete(`/subtasks/${id}`);

export const listComments = (taskId, opts) => api.get(`/tasks/${taskId}/comments`, opts);
export const addComment = (taskId, body) => api.post(`/tasks/${taskId}/comments`, { body });

export const listAttachments = (taskId, opts) => api.get(`/tasks/${taskId}/attachments`, opts);
export function uploadAttachment(taskId, file) {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/tasks/${taskId}/attachments`, form);
}
export const deleteAttachment = (id) => api.delete(`/attachments/${id}`);
/** Same-origin URL: the session cookie authorises the download, so no fetch() is needed. */
export const attachmentUrl = (id) => `/api/attachments/${id}`;
