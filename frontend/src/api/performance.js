/* GET /api/performance/me and /api/performance/users/{id}: completion and schedule figures. */
import { api } from './client.js';

export const getMyPerformance = (opts) => api.get('/performance/me', opts);
export const getUserPerformance = (id, opts) => api.get(`/performance/users/${id}`, opts);
