/*
 * Authentication API module (part of T048).
 *
 * Every call goes through api/client.js, which is the single fetch() call site
 * (Constitution III). Endpoints are defined in
 * specs/001-task-management-system/contracts/rest-api.md § Authentication.
 *
 * NOTE: the backend endpoints land in T046 (US1). Until then these calls return 401/404;
 * the Login page handles that as an ordinary failed sign-in.
 */
import { api } from './client.js';

/**
 * POST /api/auth/login — establishes the JSESSIONID session cookie (R-002).
 *
 * Returns the signed-in user on success. Throws ApiError with status 401 on bad
 * credentials AND on a deactivated account, with the same message either way, so the
 * response never reveals which credential was wrong (US1 scenario 2, FR-007).
 */
export function login(email, password) {
  return api.post('/auth/login', { email, password });
}

/**
 * POST /api/auth/register — creates an account (FR-001).
 *
 * The endpoint itself lands in T046 (US1); until then this call fails and the Register
 * page reports that honestly rather than faking a success. Wiring it now means the page
 * needs no change when the backend arrives.
 *
 * NOTE for T046: contracts/rest-api.md § Authentication currently also lists `username`
 * in the register body. The Week 2 form collects Name, Email and Password only, so the
 * contract and this call must be reconciled when the endpoint is built — either derive
 * the username from the email, or add the field to the form.
 */
export function register({ fullName, email, password }) {
  return api.post('/auth/register', { fullName, email, password });
}

/** POST /api/auth/logout — ends the session. */
export function logout() {
  return api.post('/auth/logout');
}

/** GET /api/auth/me — the current user, role and permissions (FR-003). */
export function me() {
  return api.get('/auth/me');
}
