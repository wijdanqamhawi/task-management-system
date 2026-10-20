/*
 * T039 — Permission-aware route guard (FR-005). `permissions` is an any-of list.
 *
 * This is a usability layer only. Authorization is enforced server-side on every endpoint
 * (Constitution V, R-003); hiding a screen here never substitutes for that. A user who
 * types the URL directly is still refused by the API.
 */
import { useEffect } from 'react';
import { useSession } from '../auth/SessionContext.jsx';
import { hasAnyPermission } from '../utils/permissions.js';
import { useRouter } from './Router.jsx';

export function RouteGuard({ permissions, children }) {
  const { user, loading } = useSession();
  const { pathname, navigate } = useRouter();

  useEffect(() => {
    if (loading || user) return;
    // Remember where they were going so login can return them there (V11 step 5).
    const next = encodeURIComponent(pathname);
    navigate(`/login?next=${next}`, { replace: true });
  }, [loading, user, pathname, navigate]);

  if (loading) return <p className="empty-state">Loading…</p>;
  if (!user) return null;

  if (permissions && !hasAnyPermission(user, permissions)) {
    return (
      <div className="container">
        <div className="card empty-state">
          <p>You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }
  return children;
}
