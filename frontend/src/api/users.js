/* /api/users: contracts/rest-api.md § Users. */
import { api, query } from './client.js';

export const listUsers = (params, opts) => api.get(`/users${query(params)}`, opts);
export const getUser = (id, opts) => api.get(`/users/${id}`, opts);
export const updateMe = (body) => api.put('/users/me', body);
export const setRole = (id, role) => api.put(`/users/${id}/role`, { role });
export const activateUser = (id) => api.put(`/users/${id}/activate`);
export const deactivateUser = (id) => api.put(`/users/${id}/deactivate`);
