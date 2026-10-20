import { Avatar, Button, Card, Chip, List, ListItemAvatar, ListItemButton, ListItemText } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/AssignmentIndOutlined';
import UpdateIcon from '@mui/icons-material/EditNotificationsOutlined';
import ScheduleIcon from '@mui/icons-material/ScheduleOutlined';
import OverdueIcon from '@mui/icons-material/ErrorOutlined';
import CommentIcon from '@mui/icons-material/ChatBubbleOutlined';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { PageHeader } from '../shared.jsx';

const TYPES = {
  ASSIGNMENT: { icon: <AssignmentIcon />, color: 'primary', label: 'Assignment' },
  UPDATE: { icon: <UpdateIcon />, color: 'info', label: 'Update' },
  DEADLINE: { icon: <ScheduleIcon />, color: 'warning', label: 'Deadline' },
  OVERDUE: { icon: <OverdueIcon />, color: 'error', label: 'Overdue' },
  COMMENT: { icon: <CommentIcon />, color: 'success', label: 'Comment' },
};

export default function Notifications({ items, onMarkRead, onMarkAllRead }) {
  const unread = items.filter((n) => !n.read).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'You are all caught up'}
        action={
          <Button variant="outlined" startIcon={<DoneAllIcon />} disabled={!unread} onClick={onMarkAllRead}>
            Mark all as read
          </Button>
        }
      />
      <Card>
        <List disablePadding>
          {items.map((n, i) => {
            const type = TYPES[n.type];
            return (
              <ListItemButton
                key={n.id}
                divider={i < items.length - 1}
                onClick={() => onMarkRead(n.id)}
                sx={{ py: 2, bgcolor: n.read ? 'transparent' : 'primary.light' }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: `${type.color}.main` }}>{type.icon}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={n.text}
                  secondary={n.at}
                  slotProps={{ primary: { fontWeight: n.read ? 400 : 700 } }}
                />
                <Chip size="small" label={type.label} color={type.color} variant="outlined" sx={{ ml: 2 }} />
              </ListItemButton>
            );
          })}
        </List>
      </Card>
    </>
  );
}
