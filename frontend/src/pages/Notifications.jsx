/*
 * Notifications (FR-054..FR-061). Only the signed-in user's own notifications are returned by
 * the API. Opening one marks it read and goes to its task; "Mark all read" clears the badge.
 */
import { useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import { Button } from '../components/index.jsx';
import { Async, Notice, PageHeader, Pagination } from '../components/common.jsx';
import { useRouter } from '../router/Router.jsx';
import { useApi } from '../hooks/useApi.js';
import { NOTIFICATIONS_CHANGED } from '../notifications/UnreadContext.jsx';
import { listNotifications, markAllRead, markRead } from '../api/notifications.js';
import { errorMessage, fmtDateTime } from '../utils/format.js';

const TYPE_LABELS = {
  ASSIGNMENT: 'Assignment', UPDATE: 'Update', DEADLINE: 'Deadline', OVERDUE: 'Overdue', COMMENT: 'Comment',
};

export default function Notifications() {
  const { navigate } = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const state = useApi(
    (signal) => listNotifications({ unreadOnly: unreadOnly || undefined, page, size: 20 }, { signal }),
    [unreadOnly, page],
  );

  const changed = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

  async function open(n) {
    setError('');
    try {
      if (!n.isRead) { await markRead(n.notificationId); changed(); }
      if (n.taskId) navigate(`/tasks/${n.taskId}`); else state.reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function readAll() {
    setError('');
    try { await markAllRead(); changed(); state.reload(); } catch (e) { setError(errorMessage(e)); }
  }

  return (
    <AppLayout title="Notifications">
      <PageHeader title="Notifications" subtitle="Assignments, updates, comments and deadlines."
        actions={(
          <>
            <Button onClick={() => { setUnreadOnly((v) => !v); setPage(0); }} aria-pressed={unreadOnly}>
              {unreadOnly ? 'Show all' : 'Show unread only'}
            </Button>
            <Button variant="primary" onClick={readAll}>Mark all read</Button>
          </>
        )} />
      <Notice onClose={() => setError('')}>{error}</Notice>
      <section className="panel">
        <Async state={state}>
          {(data) => (
            <>
              {data.content.length === 0 && (
                <p className="empty-state">{unreadOnly ? 'No unread notifications.' : 'You have no notifications yet.'}</p>
              )}
              <ul className="item-list">
                {data.content.map((n) => (
                  <li key={n.notificationId} className={`notif${n.isRead ? '' : ' notif--unread'}`}
                      onClick={() => open(n)}>
                    <div className="item-list__main">
                      <div className="notif__type">{TYPE_LABELS[n.triggerType] ?? n.triggerType}{!n.isRead && ' · new'}</div>
                      <button type="button" className="link-btn" style={{ textAlign: 'left', textDecoration: 'none', color: 'inherit', fontWeight: 'inherit' }}
                              onClick={(e) => { e.stopPropagation(); open(n); }}>{n.message}</button>
                    </div>
                    <span className="muted small">{fmtDateTime(n.createdAt)}</span>
                  </li>
                ))}
              </ul>
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPage={setPage} />
            </>
          )}
        </Async>
      </section>
    </AppLayout>
  );
}
