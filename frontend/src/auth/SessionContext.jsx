/*
 * T041 — session context. Loads GET /api/auth/me and exposes the current user and role
 * to guards and screens (FR-003, FR-005).
 *
 * The role held here drives what the UI offers. It never decides what the API permits —
 * that is enforced server-side on every request (Constitution V).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import { login as loginRequest } from '../api/auth.js';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUser(await api.get('/auth/me'));
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

  const login = useCallback(async (email, password) => {
    const me = await loginRequest(email, password);
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
