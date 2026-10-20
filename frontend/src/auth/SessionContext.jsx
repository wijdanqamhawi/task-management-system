/*
 * T041 — session context. Loads GET /api/auth/me and exposes the current user and role
 * to guards and screens (FR-003, FR-005).
 *
 * `user.permissions` (from /auth/login and /auth/me) is always an array; it is [] when the API
 * sent none, so the UI fails closed. Permissions refresh on login and on a page reload.
 * What is held here only drives what the UI offers. It never decides what the API permits —
 * that is enforced server-side on every request (Constitution V).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import { login as loginRequest } from '../api/auth.js';
import { normalizePermissions } from '../utils/permissions.js';

const SessionContext = createContext(null);

const withPermissions = (user) => (user ? { ...user, permissions: normalizePermissions(user.permissions) } : user);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // `silent` re-reads the user without flipping `loading`, so a screen that refreshes the
  // session after a save (Profile) is not unmounted behind the route guard's loading state.
  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      setUser(withPermissions(await api.get('/auth/me')));
    } catch (error) {
      // 401 simply means "not signed in" — an expected state, not a failure.
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.error('Failed to load session', error);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (email, password, remember = false) => {
    const me = withPermissions(await loginRequest(email, password, remember));
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally { setUser(null); }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
