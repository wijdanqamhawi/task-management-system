// Material UI Recycle Bin: the same screen as pages/RecycleBin.jsx (Original UI), reusing its API
// module, permission helpers, toast provider and restore confirmation text. The API decides what
// is listed (ADMIN: every project; MANAGER: their projects); there is no permanent delete.
import { useEffect, useState } from 'react';
import { Button, InputAdornment, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RestoreIcon from '@mui/icons-material/RestoreFromTrashOutlined';
import { AsyncView, NavLink, PagerBar, PageHeader } from '../shared.jsx';
import { ConfirmDialog } from '../dialogs.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSession } from '../../auth/SessionContext.jsx';
import { listDeletedTasks, restoreTask } from '../../api/recycleBin.js';
import { canRestoreTask } from '../../utils/permissions.js';
import { errorMessage, fmtDateTime } from '../../utils/format.js';

const PAGE_SIZE = 15;

export default function RecycleBin() {
  const { user } = useSession();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [restoring, setRestoring] = useState(null);     // the row awaiting confirmation
  const [busy, setBusy] = useState(false);

  // Search as you type, after a short pause, and always from the first page.
  useEffect(() => {
    const id = setTimeout(() => { setSearch(draft.trim()); setPage(0); }, 300);
    return () => clearTimeout(id);
  }, [draft]);

  const state = useApi((signal) => listDeletedTasks({ search, page, size: PAGE_SIZE }, { signal }), [search, page]);
  const mayRestore = canRestoreTask(user);

  async function confirmRestore() {
    const task = restoring;
    setBusy(true);
    try {
      const { removedAssignees = [] } = await restoreTask(task.taskId);
      if (removedAssignees.length > 0) {
        toast.warning(
          `"${task.title}" was restored. Unassigned because they can no longer hold it: `
          + removedAssignees.map((a) => `${a.fullName} (${a.reason})`).join('; ') + '.');
      } else {
        toast.success(`"${task.title}" was restored.`);
      }
    } catch (e) {
      toast.error(errorMessage(e));       // e.g. someone else restored it first
    } finally {
      setBusy(false);
      setRestoring(null);
      if (state.data && state.data.content.length === 1 && page > 0) setPage(page - 1);
      else state.reload();
    }
  }

  return (
    <>
      <PageHeader title="Recycle Bin"
        subtitle="Deleted tasks are kept here with their progress, comments, attachments and assignments. Restore one to bring it back." />
      <Stack component="form" direction="row" spacing={1.5} role="search" sx={{ mb: 2 }}
             onSubmit={(e) => { e.preventDefault(); setSearch(draft.trim()); setPage(0); }}>
        <TextField
          size="small" placeholder="Task title or project name" value={draft} sx={{ flex: 1, maxWidth: 420 }}
          onChange={(e) => setDraft(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }, htmlInput: { 'aria-label': 'Search deleted tasks' } }}
        />
        <Button type="submit" variant="outlined">Search</Button>
        {draft && <Button onClick={() => setDraft('')}>Clear</Button>}
      </Stack>
      <AsyncView state={state}>
        {(data) => (
          <>
            <TableContainer component={Paper} sx={{ border: 1, borderColor: 'divider', boxShadow: '0 2px 8px rgba(31, 41, 51, 0.06)' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Task</TableCell>
                    <TableCell>Project</TableCell>
                    <TableCell>Deleted</TableCell>
                    <TableCell>Deleted by</TableCell>
                    {mayRestore && <TableCell align="right"><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Actions</span></TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.content.map((t) => (
                    <TableRow key={t.taskId} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{t.title}</TableCell>
                      <TableCell><NavLink to={`/projects/${t.projectId}`}>{t.projectName}</NavLink></TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDateTime(t.deletedAt)}</TableCell>
                      <TableCell>{t.deletedByName ?? <Typography component="span" variant="body2" color="text.secondary">Unknown</Typography>}</TableCell>
                      {mayRestore && (
                        <TableCell align="right">
                          <Button size="small" variant="outlined" startIcon={<RestoreIcon />} aria-label={`Restore ${t.title}`} onClick={() => setRestoring(t)}>Restore</Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {data.content.length === 0 && (
                    <TableRow><TableCell colSpan={mayRestore ? 5 : 4} align="center" sx={{ py: 6 }}>
                      {search ? 'No deleted tasks match your search.' : 'The Recycle Bin is empty.'}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <PagerBar data={data} onPage={setPage} />
          </>
        )}
      </AsyncView>
      {restoring && (
        <ConfirmDialog title="Restore task" confirmLabel="Restore" confirmColor="primary" busy={busy}
          message={`Restore "${restoring.title}" to ${restoring.projectName}? It returns with its progress, comments, attachments and assignments. Anyone who is deactivated or no longer in the project is unassigned.`}
          onCancel={() => setRestoring(null)} onConfirm={confirmRestore} />
      )}
    </>
  );
}
