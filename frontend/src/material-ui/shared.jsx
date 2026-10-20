import { Avatar, AvatarGroup, Box, Chip, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { PRIORITIES, STATUS_LABEL, users } from './mockData.js';

export const userById = (id) => users.find((u) => u.id === id);

const STATUS_COLOR = { TODO: 'default', IN_PROGRESS: 'primary', DONE: 'success', BLOCKED: 'error' };
const PRIORITY_COLOR = { LOW: 'default', MEDIUM: 'info', HIGH: 'warning', URGENT: 'error' };
const PROJECT_STATUS = {
  ACTIVE: { label: 'Active', color: 'primary' },
  ON_HOLD: { label: 'On Hold', color: 'warning' },
  COMPLETED: { label: 'Completed', color: 'success' },
};

export function StatusChip({ status }) {
  return <Chip size="small" label={STATUS_LABEL[status]} color={STATUS_COLOR[status]} variant={status === 'TODO' ? 'outlined' : 'filled'} />;
}

export function PriorityChip({ priority }) {
  const label = priority.charAt(0) + priority.slice(1).toLowerCase();
  return <Chip size="small" label={label} color={PRIORITY_COLOR[priority]} variant="outlined" />;
}

export function ProjectStatusChip({ status }) {
  const { label, color } = PROJECT_STATUS[status];
  return <Chip size="small" label={label} color={color} />;
}

export function RoleChip({ role }) {
  const color = role === 'ADMIN' ? 'error' : role === 'MANAGER' ? 'primary' : 'default';
  return <Chip size="small" label={role} color={color} variant="outlined" />;
}

const initials = (name) => name.split(' ').map((p) => p[0]).join('').slice(0, 2);

export function UserAvatar({ userId, size = 28 }) {
  const user = userById(userId);
  return (
    <Tooltip title={user.fullName}>
      <Avatar sx={{ width: size, height: size, fontSize: size * 0.42, bgcolor: 'primary.main' }}>{initials(user.fullName)}</Avatar>
    </Tooltip>
  );
}

export function MemberAvatars({ ids, size = 28 }) {
  return (
    <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: size, height: size, fontSize: size * 0.42, bgcolor: 'primary.main' } }}>
      {ids.map((id) => (
        <Avatar key={id}>{initials(userById(id).fullName)}</Avatar>
      ))}
    </AvatarGroup>
  );
}

export function ProgressBar({ value }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
      <LinearProgress variant="determinate" value={value} sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: 'primary.light' }} />
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 36, textAlign: 'right' }}>
        {value}%
      </Typography>
    </Stack>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3, justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
      <Box>
        <Typography variant="h4">{title}</Typography>
        {subtitle && (
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}

export { PRIORITIES };
