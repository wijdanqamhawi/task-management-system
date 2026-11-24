/*
 * Notifications (FR-054..FR-061). Only the signed-in user's own notifications are returned by
 * the API. Opening one marks it read and goes to its task; "Mark all read" clears the badge.
 */
import { useRef, useState } from 'react';
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
  const [readIds, setReadIds] = useState(() => new Set());   // marked read this session, after the backend confirmed
  const pending = useRef(new Set());                          // ids with a mark-read request in flight
  const state = useApi(
    (signal) => listNotifications({ unreadOnly: unreadOnly || undefined, page, size: 20 }, { signal }),
    [unreadOnly, page],
  );

  const changed = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

  const isRead = (n) => n.isRead || readIds.has(n.notificationId);

  async function open(n) {
    if (pending.current.has(n.notificationId)) return;   // ignore repeated clicks while the request is in flight
    setError('');
    try {
      if (!isRead(n)) {
        pending.current.add(n.notificationId);
        await markRead(n.notificationId);
        setReadIds((prev) => new Set(prev).add(n.notificationId));
        changed();
      }
      if (n.taskId) navigate(`/tasks/${n.taskId}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      pending.current.delete(n.notificationId);
    }
  }

  async function readAll() {
    setError('');
    try { await markAllRead(); setReadIds(new Set()); changed(); state.reload(); } catch (e) { setError(errorMessage(e)); }
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
          {(data) => {
            // In unread-only mode an opened notification no longer matches the filter: drop it now.
            const items = unreadOnly ? data.content.filter((n) => !isRead(n)) : data.content;
            const removed = data.content.length - items.length;
            return (
            <>
              {items.length === 0 && (
                <p className="empty-state">{unreadOnly ? 'No unread notifications.' : 'You have no notifications yet.'}</p>
              )}
              <ul className="item-list">
                {items.map((n) => (
                  <li key={n.notificationId} className={`notif${isRead(n) ? '' : ' notif--unread'}`}
                      onClick={() => open(n)}>
                    <div className="item-list__main">
                      <div className="notif__type">{!isRead(n) && <span className="notif__dot" aria-hidden="true" />}
                        {TYPE_LABELS[n.triggerType] ?? n.triggerType}{!isRead(n) && <span className="sr-only"> (unread)</span>}</div>
                      <button type="button" className="link-btn" style={{ textAlign: 'left', textDecoration: 'none', color: 'inherit', fontWeight: 'inherit' }}
                              onClick={(e) => { e.stopPropagation(); open(n); }}>{n.message}</button>
                    </div>
                    <span className="muted small">{fmtDateTime(n.createdAt)}</span>
                  </li>
                ))}
              </ul>
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements - removed} onPage={setPage} />
            </>
            );
          }}
        </Async>
      </section>
    </AppLayout>
  );
}
