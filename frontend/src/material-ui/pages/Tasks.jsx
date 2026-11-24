import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, InputAdornment, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { AssigneeAvatars, AsyncView, PagerBar, PageHeader, PriorityChip, StatusChip } from '../shared.jsx';
import { TaskDialog } from '../dialogs.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useVisibleProjects } from '../../hooks/useVisibleProjects.js';
import { useSession } from '../../auth/SessionContext.jsx';
import { useRouter } from '../../router/Router.jsx';
import { createTask, searchTasks } from '../../api/tasks.js';
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '../../constants.js';
import { fmtDate } from '../../utils/format.js';

export default function Tasks() {
  const { user } = useSession();
  const { navigate } = useRouter();
  const visible = useVisibleProjects();
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);

  // Search as the user types, after a short pause, so the server is not hit on every key.
  useEffect(() => {
    const timer = setTimeout(() => { setTitle(query.trim()); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Filters are applied by the API, which also applies visibility, exactly like the Original screen.
  const params = { title, status, priority, page, size: 15 };
  const state = useApi((signal) => searchTasks(params, { signal }), [JSON.stringify(params)]);

  async function onCreate(body) {
    const task = await createTask(body);
    setCreating(false);
    navigate(`/tasks/${task.taskId}`);
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Tasks in the projects you belong to."
        action={(
          <Button variant="contained" startIcon={<AddIcon />} disabled={visible.projects.length === 0} onClick={() => setCreating(true)}>
            New task
          </Button>
        )}
      />
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
          <TextField select size="small" label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} sx={{ minWidth: 170 }}>
            <MenuItem value="">All statuses</MenuItem>
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>{STATUS_LABELS[s]}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Priority" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(0); }} sx={{ minWidth: 170 }}>
            <MenuItem value="">All priorities</MenuItem>
            {PRIORITIES.map((p) => (
              <MenuItem key={p} value={p}>{PRIORITY_LABELS[p]}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </Card>

      <AsyncView state={state}>
        {(data) => (
          <>
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
                  {data.content.map((t) => (
                    <TableRow key={t.taskId} hover onClick={() => navigate(`/tasks/${t.taskId}`)} sx={{ cursor: 'pointer' }}>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {t.title}
                        {t.overdue && <Box component="span" sx={{ ml: 1 }}><Typography component="span" variant="caption" color="error.main" fontWeight={700}>Overdue</Typography></Box>}
                      </TableCell>
                      <TableCell>{t.projectName}</TableCell>
                      <TableCell><StatusChip status={t.status} /></TableCell>
                      <TableCell><PriorityChip priority={t.priority} /></TableCell>
                      <TableCell><AssigneeAvatars assignees={t.assignees} /></TableCell>
                      <TableCell>{fmtDate(t.dueDate)}</TableCell>
                    </TableRow>
                  ))}
                  {data.content.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                        <Typography color="text.secondary">
                          {title || status || priority ? 'No tasks match your filters.' : 'No tasks yet.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <PagerBar data={data} onPage={setPage} />
          </>
        )}
      </AsyncView>
      {visible.error && <Alert severity="warning" sx={{ mt: 2 }}>{visible.error}</Alert>}
      {creating && (
        <TaskDialog
          projects={visible.projects} user={user} managedIds={visible.ids}
          onClose={() => setCreating(false)} onSubmit={onCreate}
        />
      )}
    </>
  );
}
