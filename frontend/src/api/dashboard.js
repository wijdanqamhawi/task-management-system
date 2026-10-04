/* GET /api/dashboard: all nine figures, computed per request and scoped to the caller. */
import { api } from './client.js';

export const getDashboard = (opts) => api.get('/dashboard', opts);
