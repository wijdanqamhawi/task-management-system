import { useRef, useState } from 'react';
import { Alert, Avatar, Button, Card, Chip, List, ListItemAvatar, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/AssignmentIndOutlined';
import UpdateIcon from '@mui/icons-material/EditNotificationsOutlined';
import ScheduleIcon from '@mui/icons-material/ScheduleOutlined';
import OverdueIcon from '@mui/icons-material/ErrorOutlined';
import CommentIcon from '@mui/icons-material/ChatBubbleOutlined';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { AsyncView, PagerBar, PageHeader } from '../shared.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useRouter } from '../../router/Router.jsx';
import { NOTIFICATIONS_CHANGED } from '../../notifications/UnreadContext.jsx';
import { listNotifications, markAllRead, markRead } from '../../api/notifications.js';
import { errorMessage, fmtDateTime } from '../../utils/format.js';

const TYPES = {
  ASSIGNMENT: { icon: <AssignmentIcon />, color: 'primary', label: 'Assignment' },
  UPDATE: { icon: <UpdateIcon />, color: 'info', label: 'Update' },
  DEADLINE: { icon: <ScheduleIcon />, color: 'warning', label: 'Deadline' },
  OVERDUE: { icon: <OverdueIcon />, color: 'error', label: 'Overdue' },
  COMMENT: { icon: <CommentIcon />, color: 'success', label: 'Comment' },
};
const FALLBACK = { icon: <UpdateIcon />, color: 'info' };

export default function Notifications() {
  const { navigate } = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [readIds, setReadIds] = useState(() => new Set());   // marked read after the backend confirmed
  const pending = useRef(new Set());                          // ids with a request in flight
  const state = useApi(
    (signal) => listNotifications({ unreadOnly: unreadOnly || undefined, page, size: 20 }, { signal }),
    [unreadOnly, page],
  );

  // Tells the shared bell badge (UnreadContext) to refresh.
  const changed = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

  const isRead = (n) => n.isRead || readIds.has(n.notificationId);

  async function open(n) {
    if (pending.current.has(n.notificationId)) return;
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

  const visible = (state.data?.content ?? []).filter((n) => !(unreadOnly && isRead(n)));
  const unread = visible.filter((n) => !isRead(n)).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread on this page` : 'Assignments, updates, comments and deadlines.'}
        action={(
          <Stack direction="row" spacing={1.5}>
            <Button variant={unreadOnly ? 'contained' : 'outlined'} aria-pressed={unreadOnly} onClick={() => { setUnreadOnly((v) => !v); setPage(0); }}>
              {unreadOnly ? 'Show all' : 'Show unread only'}
            </Button>
            <Button variant="outlined" startIcon={<DoneAllIcon />} onClick={readAll}>
              Mark all as read
            </Button>
          </Stack>
        )}
      />
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      <AsyncView state={state}>
        {(data) => {
          const items = unreadOnly ? data.content.filter((n) => !isRead(n)) : data.content;
          return (
          <>
            <Card>
              <List disablePadding>
                {items.length === 0 && (
                  <Typography color="text.secondary" sx={{ p: 3 }}>
                    {unreadOnly ? 'No unread notifications.' : 'You have no notifications yet.'}
                  </Typography>
                )}
                {items.map((n, i) => {
                  const type = TYPES[n.triggerType] ?? FALLBACK;
                  return (
                    <ListItemButton
                      key={n.notificationId}
                      divider={i < items.length - 1}
                      onClick={() => open(n)}
                      sx={{ py: 2, bgcolor: isRead(n) ? 'transparent' : 'primary.light' }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: `${type.color}.main` }}>{type.icon}</Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={n.message}
                        secondary={fmtDateTime(n.createdAt)}
                        slotProps={{ primary: { fontWeight: isRead(n) ? 400 : 700 } }}
                      />
                      <Chip size="small" label={type.label ?? n.triggerType} color={type.color} variant="outlined" sx={{ ml: 2 }} />
                    </ListItemButton>
                  );
                })}
              </List>
            </Card>
            <PagerBar data={data} onPage={setPage} />
          </>
          );
        }}
      </AsyncView>
    </>
  );
}
