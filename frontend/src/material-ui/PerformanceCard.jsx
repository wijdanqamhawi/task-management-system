// Performance card for the Material UI Dashboard. Same data as the Original UI's card: it calls
// the existing GET /api/performance/me and /api/performance/users/{id}; every calculation and the
// ADMIN / MANAGER / MEMBER scope are enforced by the API. `me` is the real session user and
// `tasksByUser` is the already-loaded, visibility-scoped list from /api/dashboard.
import { useState } from 'react';
import {
  Box, Card, CardContent, CardHeader, Chip, Divider, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography, Alert,
} from '@mui/material';
import { AsyncView } from './shared.jsx';
import { useApi } from '../hooks/useApi.js';
import { getMyPerformance, getUserPerformance } from '../api/performance.js';
import { canViewOthersPerformance } from '../utils/permissions.js';
import { fmtDate } from '../utils/format.js';

const SCHEDULE = {
  EARLY: { label: 'Early', color: 'success', variant: 'filled' },
  ON_TIME: { label: 'On Time', color: 'primary', variant: 'filled' },
  LATE: { label: 'Late', color: 'error', variant: 'filled' },
  NOT_EVALUABLE: { label: 'Not evaluable', color: 'default', variant: 'outlined' },
};
const pct = (v) => (v == null ? '—' : `${v}%`);
const days = (v) => (v == null ? '—' : `${v} ${v === 1 ? 'day' : 'days'}`);

function Metric({ label, value }) {
  return (
    <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 3 }}>
      <Typography variant="h6">{value}</Typography>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
    </Box>
  );
}

export default function PerformanceCard({ me, tasksByUser }) {
  const [selected, setSelected] = useState(me.userId);
  const state = useApi(
    (signal) => (selected === me.userId ? getMyPerformance({ signal }) : getUserPerformance(selected, { signal })),
    [selected]);

  // The selector exists only for users who may view others; its entries are the viewer plus
  // everyone assigned a task they can see (the same scoped list as the Original UI).
  const people = canViewOthersPerformance(me)
    ? [{ userId: me.userId, fullName: me.fullName ?? me.username }, ...(tasksByUser ?? []).filter((u) => u.userId !== me.userId)]
    : [];

  return (
    <Card>
      <CardHeader
        title="Performance"
        slotProps={{ title: { variant: 'h6' } }}
        action={people.length > 0 && (
          <TextField select size="small" label="User" value={selected} sx={{ minWidth: 200 }}
                     onChange={(e) => setSelected(Number(e.target.value))}>
            {people.map((p) => (
              <MenuItem key={p.userId} value={p.userId}>{p.userId === me.userId ? `${p.fullName} (me)` : p.fullName}</MenuItem>
            ))}
          </TextField>
        )} />
      <Divider />
      <CardContent>
        <AsyncView state={state}>
          {(p) => (
            <Stack spacing={2}>
              <Typography color="text.secondary" variant="body2">{p.fullName}: {p.summary}</Typography>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                <Metric label="Assigned Tasks" value={p.totalAssignedTasks} />
                <Metric label="Completed Tasks" value={p.totalCompletedTasks} />
                <Metric label="Completion Rate" value={pct(p.completionRate)} />
                <Metric label="Early" value={p.earlyTasks} />
                <Metric label="On Time" value={p.onTimeTasks} />
                <Metric label="Late" value={p.lateTasks} />
                <Metric label="On-Time Rate" value={pct(p.onTimeRate)} />
                <Metric label="Avg. Schedule Difference" value={p.averageScheduleLabel ?? '—'} />
              </Box>
              {p.notEvaluableCompletedTasks > 0 && (
                <Alert severity="info" variant="outlined">
                  {p.notEvaluableCompletedTasks} completed {p.notEvaluableCompletedTasks === 1 ? 'task is' : 'tasks are'} not
                  evaluable (no completion date recorded) and excluded from the schedule figures.
                </Alert>
              )}
              {p.completedTasks.length === 0 ? (
                <Typography color="text.secondary">No completed tasks yet.</Typography>
              ) : (
                <TableContainer component={Paper} sx={{ border: 1, borderColor: 'divider', boxShadow: 'none' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {['Task', 'Planned', 'Actual', 'Completed', 'Difference', 'Schedule', 'Progress'].map((h) => <TableCell key={h}>{h}</TableCell>)}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {p.completedTasks.map((t) => {
                        const s = SCHEDULE[t.scheduleStatus];
                        return (
                          <TableRow key={t.taskId}>
                            <TableCell sx={{ fontWeight: 600 }}>{t.title}</TableCell>
                            <TableCell>{days(t.plannedDuration)}</TableCell>
                            <TableCell>{days(t.actualDuration)}</TableCell>
                            <TableCell>{fmtDate(t.completedAt)}</TableCell>
                            <TableCell>{t.scheduleStatus === 'NOT_EVALUABLE' ? '—' : t.scheduleLabel}</TableCell>
                            <TableCell><Chip size="small" label={s.label} color={s.color} variant={s.variant} /></TableCell>
                            <TableCell>{t.progressPercent}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Stack>
          )}
        </AsyncView>
      </CardContent>
    </Card>
  );
}
