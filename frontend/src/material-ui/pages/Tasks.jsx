import { useMemo, useState } from 'react';
import { Box, Card, InputAdornment, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { PRIORITIES, projects, STATUSES, STATUS_LABEL, tasks } from '../mockData.js';
import { PageHeader, PriorityChip, StatusChip, UserAvatar } from '../shared.jsx';

export default function Tasks({ onOpenTask }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [priority, setPriority] = useState('ALL');

  const rows = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(query.trim().toLowerCase()) &&
          (status === 'ALL' || t.status === status) &&
          (priority === 'ALL' || t.priority === priority),
      ),
    [query, status, priority],
  );

  return (
    <>
      <PageHeader title="Tasks" subtitle="All tasks across your projects" />
      <Card sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            size="small"
            placeholder="Search tasks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ flex: 1 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
          />
          <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 170 }}>
            <MenuItem value="ALL">All statuses</MenuItem>
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>{STATUS_LABEL[s]}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} sx={{ minWidth: 170 }}>
            <MenuItem value="ALL">All priorities</MenuItem>
            {PRIORITIES.map((p) => (
              <MenuItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </Card>

      <TableContainer component={Paper} sx={{ border: 1, borderColor: 'divider', boxShadow: '0 2px 8px rgba(31, 41, 51, 0.06)' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Task</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Assignee</TableCell>
              <TableCell>Due date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id} hover onClick={() => onOpenTask(t.id)} sx={{ cursor: 'pointer' }}>
                <TableCell sx={{ fontWeight: 600 }}>{t.title}</TableCell>
                <TableCell>{projects.find((p) => p.id === t.projectId).title}</TableCell>
                <TableCell><StatusChip status={t.status} /></TableCell>
                <TableCell><PriorityChip priority={t.priority} /></TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {t.assignees.map((id) => (
                      <UserAvatar key={id} userId={id} />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>{t.due}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">No tasks match your filters.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
