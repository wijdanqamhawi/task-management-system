import { useState } from 'react';
import { Alert, Avatar, Box, Button, Chip, CircularProgress, Link as MuiLink, LinearProgress, MenuItem, Pagination, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useRouter } from '../router/Router.jsx';
import { changeStatus } from '../api/tasks.js';
import { PRIORITY_LABELS, PROJECT_STATUS_LABELS, ROLE_LABELS, STATUSES, STATUS_LABELS } from '../constants.js';
import { canChangeStatus } from '../utils/permissions.js';
import { errorMessage, initials } from '../utils/format.js';

const STATUS_COLOR = { TO_DO: 'default', IN_PROGRESS: 'primary', REVIEW: 'warning', COMPLETED: 'success' };
const PRIORITY_COLOR = { LOW: 'default', MEDIUM: 'info', HIGH: 'warning' };
const PROJECT_STATUS_COLOR = { PLANNED: 'warning', ACTIVE: 'primary', COMPLETED: 'success' };

export function StatusChip({ status }) {
  return <Chip size="small" label={STATUS_LABELS[status] ?? status} color={STATUS_COLOR[status]} variant={status === 'TO_DO' ? 'outlined' : 'filled'} />;
}

export function PriorityChip({ priority }) {
  return <Chip size="small" label={PRIORITY_LABELS[priority] ?? priority} color={PRIORITY_COLOR[priority]} variant="outlined" />;
}

export function ProjectStatusChip({ status }) {
  return <Chip size="small" label={PROJECT_STATUS_LABELS[status] ?? status} color={PROJECT_STATUS_COLOR[status]} />;
}

export function RoleChip({ role }) {
  const color = role === 'ADMIN' ? 'error' : role === 'MANAGER' ? 'primary' : 'default';
  return <Chip size="small" label={ROLE_LABELS[role] ?? role} color={color} variant="outlined" />;
}

export function UserAvatar({ name, size = 28 }) {
  return (
    <Tooltip title={name}>
      <Avatar sx={{ width: size, height: size, fontSize: size * 0.42, bgcolor: 'primary.main' }}>{initials(name)}</Avatar>
    </Tooltip>
  );
}

export function AssigneeAvatars({ assignees, size = 28 }) {
  if (!assignees?.length) return <Typography variant="body2" color="text.secondary">Unassigned</Typography>;
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {assignees.map((a) => <UserAvatar key={a.userId} name={a.fullName} size={size} />)}
    </Box>
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

/** Renders a useApi() state: spinner while loading, an error with retry, else children(data). */
export function AsyncView({ state, children }) {
  if (state.error) {
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={state.reload}>Retry</Button>}>
        {state.error}
      </Alert>
    );
  }
  if (!state.data) return <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box>;
  return children(state.data);
}

/** Pager for the API's page envelope ({ page, totalPages }); hidden when there is one page. */
export function PagerBar({ data, onPage }) {
  if (!data || data.totalPages <= 1) return null;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
      <Pagination count={data.totalPages} page={data.page + 1} onChange={(_, p) => onPage(p - 1)} color="primary" />
    </Box>
  );
}

/** A link that navigates with the app's own router (no page reload). */
export function NavLink({ to, children, ...rest }) {
  const { navigate } = useRouter();
  const onClick = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return <MuiLink href={to} onClick={onClick} underline="hover" {...rest}>{children}</MuiLink>;
}

/**
 * Status of a task: a select when the existing rules (canChangeStatus) allow this user to change
 * it, otherwise a chip. The API enforces the same rule.
 */
export function TaskStatus({ task, user, managedIds, onChanged, onError }) {
  const [busy, setBusy] = useState(false);
  if (!canChangeStatus(user, task, managedIds)) return <StatusChip status={task.status} />;
  const change = async (status) => {
    setBusy(true);
    try { await changeStatus(task.taskId, status); onChanged?.(); } catch (e) { onError?.(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <TextField select size="small" label="Status" value={task.status} disabled={busy} onChange={(e) => change(e.target.value)} sx={{ minWidth: 170 }}>
      {STATUSES.map((s) => <MenuItem key={s} value={s}>{STATUS_LABELS[s]}</MenuItem>)}
    </TextField>
  );
}
