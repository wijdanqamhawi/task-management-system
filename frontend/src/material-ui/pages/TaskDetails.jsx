import { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CardHeader, Checkbox, Chip, Divider, FormControlLabel, Grid, IconButton, List, ListItem, ListItemAvatar,
  ListItemIcon, ListItemText, Link as MuiLink, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EventIcon from '@mui/icons-material/EventOutlined';
import { AsyncView, NavLink, PageHeader, PriorityChip, TaskStatus, UserAvatar } from '../shared.jsx';
import { ConfirmDialog, TaskDialog } from '../dialogs.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useVisibleProjects } from '../../hooks/useVisibleProjects.js';
import { useSession } from '../../auth/SessionContext.jsx';
import { useRouter } from '../../router/Router.jsx';
import { assignUsers, deleteTask, getTask, unassignUser, updateTask } from '../../api/tasks.js';
import { listMembers } from '../../api/projects.js';
import {
  addComment, addProgress, attachmentUrl, deleteAttachment, deleteProgress, listAttachments, listComments, listProgress, setProgressCompleted, uploadAttachment,
} from '../../api/taskDetail.js';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, UPLOAD_ACCEPT } from '../../constants.js';
import { canAssign, canDeleteAttachment, canDeleteTask, canEditTask } from '../../utils/permissions.js';
import { errorMessage, fmtBytes, fmtDate, fmtDateTime } from '../../utils/format.js';

function Detail({ label, children }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

/** Runs an action, reloads the panel, and surfaces the API's error message. */
function usePanelAction(state, setError) {
  const [busy, setBusy] = useState(false);
  const run = async (action) => {
    setBusy(true);
    setError('');
    try { await action(); state.reload(); return true; } catch (e) { setError(errorMessage(e)); return false; } finally { setBusy(false); }
  };
  return { busy, run };
}

function Subtasks({ taskId }) {
  const state = useApi((signal) => listProgress(taskId, { signal }), [taskId]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const { busy, run } = usePanelAction(state, setError);

  return (
    <Card>
      <CardHeader title="Subtasks" slotProps={{ title: { variant: 'h6' } }} />
      <Divider />
      <CardContent>
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
        <AsyncView state={state}>
          {(list) => (
            <Stack>
              {list.length === 0 && <Typography color="text.secondary">No subtasks yet.</Typography>}
              {list.map((s) => (
                <Stack key={s.subtaskId} direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <FormControlLabel
                    label={s.title}
                    control={<Checkbox checked={s.isCompleted} disabled={busy} onChange={() => run(() => setProgressCompleted(s.subtaskId, !s.isCompleted))} />}
                  />
                  <IconButton size="small" disabled={busy} aria-label={`Delete subtask ${s.title}`} onClick={() => run(() => deleteProgress(s.subtaskId))}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}
        </AsyncView>
        <Stack component="form" direction="row" spacing={1.5} sx={{ mt: 2 }} onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) run(async () => { await addProgress(taskId, { title: title.trim() }); setTitle(''); });
        }}>
          <TextField size="small" placeholder="Add a subtask" value={title} onChange={(e) => setTitle(e.target.value)} sx={{ flex: 1 }} />
          <Button type="submit" variant="outlined" disabled={busy || !title.trim()}>Add</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function Comments({ taskId }) {
  const state = useApi((signal) => listComments(taskId, { signal }), [taskId]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const { busy, run } = usePanelAction(state, setError);

  return (
    <Card>
      <CardHeader title="Comments" slotProps={{ title: { variant: 'h6' } }} />
      <Divider />
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ m: 2 }}>{error}</Alert>}
      <AsyncView state={state}>
        {(list) => (
          <List>
            {list.length === 0 && <ListItem><Typography color="text.secondary">No comments yet.</Typography></ListItem>}
            {list.map((c) => (
              <ListItem key={c.commentId} alignItems="flex-start">
                <ListItemAvatar><UserAvatar name={c.authorName} size={36} /></ListItemAvatar>
                <ListItemText
                  primary={`${c.authorName} · ${fmtDateTime(c.createdAt)}`}
                  secondary={c.body}
                  slotProps={{ primary: { fontWeight: 600, variant: 'body2' }, secondary: { color: 'text.primary', sx: { mt: 0.5, whiteSpace: 'pre-wrap' } } }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </AsyncView>
      <Divider />
      <Stack component="form" direction="row" spacing={1.5} sx={{ p: 2 }} onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) run(async () => { await addComment(taskId, body.trim()); setBody(''); });
      }}>
        <TextField size="small" placeholder="Write a comment" value={body} onChange={(e) => setBody(e.target.value)} multiline sx={{ flex: 1 }} />
        <Button type="submit" variant="contained" disabled={busy || !body.trim()}>Post</Button>
      </Stack>
    </Card>
  );
}

function Attachments({ task, user, managedIds }) {
  const taskId = task.taskId;
  const state = useApi((signal) => listAttachments(taskId, { signal }), [taskId]);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(null);
  const [inputKey, setInputKey] = useState(0);
  const { busy, run } = usePanelAction(state, setError);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Refuse early with a clear message; the server enforces the same limits.
    if (file.size === 0) setError('That file is empty.');
    else if (file.size > MAX_UPLOAD_BYTES) setError(`That file is larger than the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit.`);
    else if (file.type && !ALLOWED_UPLOAD_TYPES.includes(file.type)) setError('That file type is not allowed.');
    else await run(() => uploadAttachment(taskId, file));
    setInputKey((k) => k + 1);
  }

  return (
    <Card>
      <CardHeader title="Attachments" slotProps={{ title: { variant: 'h6' } }} />
      <Divider />
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ m: 2 }}>{error}</Alert>}
      <AsyncView state={state}>
        {(list) => (
          <List>
            {list.length === 0 && <ListItem><Typography color="text.secondary">No attachments yet.</Typography></ListItem>}
            {list.map((a) => (
              <ListItem
                key={a.attachmentId}
                secondaryAction={canDeleteAttachment(user, a, task.projectId, managedIds) && (
                  <IconButton edge="end" disabled={busy} aria-label={`Delete ${a.originalName}`} onClick={() => setRemoving(a)}><DeleteIcon /></IconButton>
                )}
              >
                <ListItemIcon><AttachFileIcon /></ListItemIcon>
                <ListItemText
                  primary={<MuiLink href={attachmentUrl(a.attachmentId)} download={a.originalName} underline="hover">{a.originalName}</MuiLink>}
                  secondary={`${fmtBytes(a.sizeBytes)} · ${a.uploaderName}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </AsyncView>
      <Box sx={{ p: 2, pt: 0 }}>
        <Button component="label" variant="outlined" disabled={busy}>
          Upload file
          <input key={inputKey} type="file" hidden accept={UPLOAD_ACCEPT} onChange={onFile} />
        </Button>
      </Box>
      {removing && (
        <ConfirmDialog
          title="Delete attachment" confirmLabel="Delete" busy={busy} onCancel={() => setRemoving(null)}
          message={`Delete "${removing.originalName}"? This cannot be undone.`}
          onConfirm={async () => { await run(() => deleteAttachment(removing.attachmentId)); setRemoving(null); }}
        />
      )}
    </Card>
  );
}

function Assignees({ task, manager, onChanged, setError }) {
  const members = useApi((signal) => (manager ? listMembers(task.projectId, { signal }) : Promise.resolve([])), [task.projectId, manager]);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const assigned = new Set(task.assignees.map((a) => a.userId));
  const candidates = (members.data ?? []).filter((m) => m.isActive && !assigned.has(m.userId));

  async function run(action) {
    setBusy(true);
    setError('');
    try { await action(); onChanged(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <Stack spacing={1.5}>
      {task.assignees.length === 0 && <Typography color="text.secondary">Nobody is assigned yet.</Typography>}
      {task.assignees.map((a) => (
        <Stack key={a.userId} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <UserAvatar name={a.fullName} />
          <Typography sx={{ flex: 1 }}>{a.fullName}</Typography>
          {manager && <Chip size="small" label="Unassign" onClick={() => run(() => unassignUser(task.taskId, a.userId))} disabled={busy} variant="outlined" />}
        </Stack>
      ))}
      {manager && (
        <Stack component="form" direction="row" spacing={1} onSubmit={(e) => {
          e.preventDefault();
          if (pick) run(async () => { await assignUsers(task.taskId, [Number(pick)]); setPick(''); });
        }}>
          <TextField select size="small" label="Assign a member" value={pick} onChange={(e) => setPick(e.target.value)} sx={{ flex: 1 }}>
            {candidates.length === 0 && <MenuItem value="" disabled>Everyone is assigned</MenuItem>}
            {candidates.map((m) => <MenuItem key={m.userId} value={m.userId}>{m.fullName}</MenuItem>)}
          </TextField>
          <Button type="submit" variant="outlined" disabled={busy || !pick}>Assign</Button>
        </Stack>
      )}
    </Stack>
  );
}

export default function TaskDetails({ id: taskId }) {
  const { user } = useSession();
  const { navigate } = useRouter();
  const visible = useVisibleProjects();
  const state = useApi((signal) => getTask(taskId, { signal }), [taskId]);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function remove(task) {
    setBusy(true);
    try { await deleteTask(taskId); navigate(`/projects/${task.projectId}`); } catch (e) { setError(errorMessage(e)); setConfirmDelete(false); setBusy(false); }
  }

  return (
    <>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/tasks')} sx={{ mb: 2 }}>
        Back
      </Button>
      <AsyncView state={state}>
        {(t) => (
          <>
            <PageHeader
              title={t.title}
              subtitle={<><NavLink to={`/projects/${t.projectId}`}>{t.projectName}</NavLink>{` · created ${fmtDateTime(t.createdAt)}`}</>}
              action={(
                <Stack direction="row" spacing={1.5}>
                  {canEditTask(user, t.projectId, visible.ids) && <Button variant="outlined" onClick={() => setEditing(true)}>Edit</Button>}
                  {canDeleteTask(user, t, visible.ids) && <Button variant="outlined" color="error" onClick={() => setConfirmDelete(true)}>Delete</Button>}
                </Stack>
              )}
            />
            {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
            {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Stack spacing={3}>
                  <Card>
                    <CardHeader title="Description" slotProps={{ title: { variant: 'h6' } }} />
                    <Divider />
                    <CardContent>
                      <Typography sx={{ whiteSpace: 'pre-wrap' }}>{t.description || <Typography component="span" color="text.secondary">No description.</Typography>}</Typography>
                    </CardContent>
                  </Card>
                  <Subtasks taskId={taskId} />
                  <Comments taskId={taskId} />
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Stack spacing={3}>
                  <Card>
                    <CardContent>
                      <Stack spacing={2}>
                        <Detail label="Status">
                          <TaskStatus task={t} user={user} managedIds={visible.ids} onChanged={state.reload} onError={setError} />
                        </Detail>
                        <Detail label="Priority"><PriorityChip priority={t.priority} /></Detail>
                        <Detail label="Start date"><Typography>{fmtDate(t.startDate)}</Typography></Detail>
                        <Detail label="Due date">
                          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                            <EventIcon fontSize="small" color="action" />
                            <Typography>{fmtDate(t.dueDate)}</Typography>
                            {t.overdue && <Chip size="small" color="error" label="Overdue" />}
                          </Stack>
                        </Detail>
                        <Detail label="Assignees">
                          <Assignees task={t} manager={canAssign(user, t.projectId, visible.ids)} onChanged={state.reload} setError={setError} />
                        </Detail>
                      </Stack>
                    </CardContent>
                  </Card>

                  <Attachments task={t} user={user} managedIds={visible.ids} />

                  <Card>
                    <CardHeader title="Activity" slotProps={{ title: { variant: 'h6' } }} />
                    <Divider />
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        The activity history is not available from the API yet.
                      </Typography>
                    </CardContent>
                  </Card>
                </Stack>
              </Grid>
            </Grid>

            {editing && (
              <TaskDialog
                task={t} user={user} managedIds={visible.ids} onClose={() => setEditing(false)}
                onSubmit={async (body) => { await updateTask(taskId, body); setEditing(false); setNotice('Task updated.'); state.reload(); }}
              />
            )}
            {confirmDelete && (
              <ConfirmDialog
                title="Delete task" confirmLabel="Delete task" busy={busy} onCancel={() => setConfirmDelete(false)}
                message={`Delete "${t.title}" with its subtasks, comments and attachments? This cannot be undone.`}
                onConfirm={() => remove(t)}
              />
            )}
          </>
        )}
      </AsyncView>
    </>
  );
}
