/* /api/projects: contracts/rest-api.md § Projects. */
import { api, query } from './client.js';

export const listProjects = (params, opts) => api.get(`/projects${query(params)}`, opts);
export const getProject = (id, opts) => api.get(`/projects/${id}`, opts);
export const createProject = (body) => api.post('/projects', body);
export const updateProject = (id, body) => api.put(`/projects/${id}`, body);
export const deleteProject = (id) => api.delete(`/projects/${id}`);
export const getProgress = (id, opts) => api.get(`/projects/${id}/progress`, opts);
export const listMembers = (id, opts) => api.get(`/projects/${id}/members`, opts);
export const addMember = (id, userId) => api.post(`/projects/${id}/members`, { userId });
export const removeMember = (id, userId) => api.delete(`/projects/${id}/members/${userId}`);
