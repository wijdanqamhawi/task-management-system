/*
 * T039 — route table. Eleven screens, matching plan.md § Screen inventory.
 *
 * `roles` is the UI-side hint used by RouteGuard; the API enforces the real rule.
 * Screens are added as their user story is implemented — the route table is the one
 * place that records which are live.
 */
export const ROUTES = {
  LOGIN:         '/login',
  REGISTER:      '/register',
  FORGOT_PASSWORD: '/forgot-password',
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

/** Role requirements per screen (plan.md § Screen inventory). */
export const ROUTE_ROLES = {
  [ROUTES.USERS]: ['ADMIN'],
};
