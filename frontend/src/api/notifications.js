/* /api/notifications: contracts/rest-api.md § Notifications (recipient only). */
import { api, query } from './client.js';

export const listNotifications = (params, opts) => api.get(`/notifications${query(params)}`, opts);
export const getUnreadCount = (opts) => api.get('/notifications/unread-count', opts);
export const markRead = (id) => api.put(`/notifications/${id}/read`);
export const markAllRead = () => api.put('/notifications/read-all');
