/*
 * T038 — Hand-written router over the browser History API (research.md R-013).
 *
 * React Router was deliberately removed: JavaScript and the History API are officially
 * required technologies, so this adds no dependency. ~90 lines covering eleven routes.
 *
 * Supports: path patterns with :params, popstate (browser back/forward), initial-load
 * resolution, and programmatic navigation. Verified by quickstart scenario V11.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const RouterContext = createContext(null);

/** '/projects/:id' + '/projects/12' -> { id: '12' }, or null when the pattern does not match. */
export function matchPath(pattern, pathname) {
  const p = pattern.split('/').filter(Boolean);
  const a = pathname.split('/').filter(Boolean);
  if (p.length !== a.length) return null;

  const params = {};
  for (let i = 0; i < p.length; i += 1) {
    if (p[i].startsWith(':')) {
      params[p[i].slice(1)] = decodeURIComponent(a[i]);
    } else if (p[i] !== a[i]) {
      return null;
    }
  }
  return params;
}

export function Router({ children }) {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  // The query string is tracked too, so a screen can react when only `?title=...` changes.
  const [search, setSearch] = useState(() => window.location.search);

  // Browser back and forward. Without this, history navigation silently does nothing —
  // one of the three failure modes R-013 accepted when dropping React Router.
  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname);
      setSearch(window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    // `to` may carry a query string or hash (RouteGuard sends '/login?next=%2Fdashboard').
    // The URL keeps them, but `pathname` state must be the path alone, or matchPath()
    // never matches and the fallback screen renders instead of the target route.
    const path = to.split(/[?#]/)[0];
    if (to === window.location.pathname + window.location.search + window.location.hash) return;
    if (replace) window.history.replaceState({}, '', to);
    else window.history.pushState({}, '', to);
    setPathname(path);
    setSearch(window.location.search);   // already updated by pushState/replaceState above
    window.scrollTo(0, 0);   // otherwise scroll position leaks between screens
  }, []);

  const value = useMemo(() => ({ pathname, search, navigate }), [pathname, search, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used inside <Router>');
  return ctx;
}

/**
 * Renders the first matching route. `routes` is an array of
 * { path, element, roles? } — see router/routes.js.
 */
export function Routes({ routes, fallback = null }) {
  const { pathname } = useRouter();
  for (const route of routes) {
    const params = matchPath(route.path, pathname);
    if (params) return route.element(params);
  }
  return fallback;
}
