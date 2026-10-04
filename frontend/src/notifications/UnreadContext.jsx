/*
 * Unread-notification count for the bell badge in the shared top bar (FR-060, SC-013).
 * Refreshed on sign-in, on every navigation, every 60 seconds, and whenever a screen
 * dispatches the `tms:notifications-changed` event (e.g. after marking notifications read).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSession } from '../auth/SessionContext.jsx';
import { useRouter } from '../router/Router.jsx';
import { getUnreadCount } from '../api/notifications.js';

const UnreadContext = createContext({ unread: 0, refresh: () => {} });
export const NOTIFICATIONS_CHANGED = 'tms:notifications-changed';

export function UnreadProvider({ children }) {
  const { user } = useSession();
  const { pathname } = useRouter();
  const [unread, setUnread] = useState(0);
  const signedIn = Boolean(user);

  const refresh = useCallback(() => {
    if (!signedIn) return;
    getUnreadCount()
      .then((r) => setUnread(r?.unreadCount ?? 0))
      .catch(() => {});        // a failed badge refresh is not worth interrupting the user
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) { setUnread(0); return undefined; }
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
    };
  }, [signedIn, refresh]);

  useEffect(() => { refresh(); }, [pathname, refresh]);

  const value = useMemo(() => ({ unread, refresh }), [unread, refresh]);
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export const useUnread = () => useContext(UnreadContext);
