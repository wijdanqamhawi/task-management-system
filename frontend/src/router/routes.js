/*
 * T039 — route table. Eleven screens, matching plan.md § Screen inventory.
 *
 * `permissions` is the UI-side hint used by RouteGuard; the API enforces the real rule.
 * Screens are added as their user story is implemented — the route table is the one
 * place that records which are live.
 */
import { PERMISSIONS } from '../constants.js';

export const ROUTES = {
  LOGIN:         '/login',
  REGISTER:      '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  PROFILE:       '/profile',
  USERS:         '/users',
  PROJECTS:      '/projects',
  PROJECT:       '/projects/:id',
  TASKS:         '/tasks',
  TASK:          '/tasks/:id',
  MY_TASKS:      '/my-tasks',
  DASHBOARD:     '/dashboard',
  NOTIFICATIONS: '/notifications',
  HOME:          '/',
};

/**
 * Permission requirements per screen (plan.md § Screen inventory). A user needs ANY of the
 * listed permissions; the controls on the screen are gated separately.
 */
export const ROUTE_PERMISSIONS = {
  [ROUTES.USERS]: [PERMISSIONS.USER_ROLE_ASSIGN, PERMISSIONS.USER_STATUS_MANAGE],
};
