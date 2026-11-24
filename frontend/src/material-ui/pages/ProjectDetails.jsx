import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, CardHeader, Divider, Grid, IconButton, List, ListItem, ListItemAvatar, ListItemText, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PersonAddIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import PersonRemoveIcon from '@mui/icons-material/PersonRemoveOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { AsyncView, PageHeader, PriorityChip, ProgressBar, ProjectStatusChip, RoleChip, AssigneeAvatars, UserAvatar } from '../shared.jsx';
import { AddMemberDialog, ConfirmDialog, ProjectDialog, TaskDialog } from '../dialogs.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSession } from '../../auth/SessionContext.jsx';
import { useRouter } from '../../router/Router.jsx';
import { addMember, deleteProject, getProgress, getProject, removeMember, updateProject } from '../../api/projects.js';
import { createTask, searchTasks } from '../../api/tasks.js';
import { STATUSES, STATUS_LABELS } from '../../constants.js';
import { canDeleteProject, canManageMembers, canUpdateProject } from '../../utils/permissions.js';
import { errorMessage, fmtDate } from '../../utils/format.js';

export default function ProjectDetails({ id: projectId }) {
  const { user } = useSession();
  const { navigate } = useRouter();
  const [dialog, setDialog] = useState(null);      // 'edit' | 'delete' | 'member' | 'task' | { remove: member }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const project = useApi((signal) => getProject(projectId, { signal }), [projectId]);
  const progress = useApi((signal) => getProgress(projectId, { signal }), [projectId]);
  const tasks = useApi((signal) => searchTasks({ projectId, size: 100, sort: 'dueDate' }, { signal }), [projectId]);

  const members = project.data?.members ?? [];
  // Manager scope = membership of this project (PROJECT_MANAGE_ALL is handled inside the helpers).
  const managedIds = new Set(members.some((m) => m.userId === user.userId) ? [projectId] : []);
  const mayUpdate = canUpdateProject(user, projectId, managedIds);
  const mayDelete = canDeleteProject(user, projectId, managedIds);
  const mayManageMembers = canManageMembers(user, projectId, managedIds);
  const refreshAll = () => { project.reload(); progress.reload(); tasks.reload(); };

  async function guarded(action) {
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); return true; } catch (e) { setError(errorMessage(e)); return false; } finally { setBusy(false); }
  }

  return (
    <>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/projects')} sx={{ mb: 2 }}>
        Back to projects
      </Button>
      <AsyncView state={project}>
        {(p) => (
          <>
            <PageHeader
              title={p.name}
              subtitle={p.description || `${fmtDate(p.startDate)} to ${fmtDate(p.endDate)}`}
              action={(
                <Stack direction="row" spacing={1.5}>
                  {mayManageMembers && <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={() => setDialog('member')}>Add Member</Button>}
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog('task')}>Create Task</Button>
                  {mayUpdate && <Button variant="outlined" onClick={() => setDialog('edit')}>Edit</Button>}
                  {mayDelete && <Button variant="outlined" color="error" onClick={() => setDialog('delete')}>Delete</Button>}
                </Stack>
              )}
            />
            {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
            {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Card sx={{ mb: 3 }}>
                  <CardHeader title="Overview" slotProps={{ title: { variant: 'h6' } }} action={<ProjectStatusChip status={p.status} />} />
                  <Divider />
                  <CardContent>
                    <AsyncView state={progress}>
                      {(g) => (
                        <>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Overall progress
                          </Typography>
                          <ProgressBar value={g.percentComplete} />
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                            {g.completedTasks} of {g.totalTasks} tasks completed
                          </Typography>
                        </>
                      )}
                    </AsyncView>
                  </CardContent>
                </Card>

                <AsyncView state={tasks}>
                  {(page) => (
                    <Grid container spacing={2}>
                      {STATUSES.map((status) => {
                        const list = page.content.filter((t) => t.status === status);
                        return (
                          <Grid size={{ xs: 12, sm: 6 }} key={status}>
                            <Card sx={{ bgcolor: '#f9fafb', height: '100%' }}>
                              <CardContent>
                                <Typography fontWeight={700} sx={{ mb: 1.5 }}>
                                  {STATUS_LABELS[status]} ({list.length})
                                </Typography>
                                <Stack spacing={1.5}>
                                  {list.length === 0 && <Typography variant="body2" color="text.secondary">No tasks</Typography>}
                                  {list.map((t) => (
                                    <Card key={t.taskId} onClick={() => navigate(`/tasks/${t.taskId}`)} sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}>
                                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                        <Typography fontWeight={600} sx={{ mb: 1 }}>{t.title}</Typography>
                                        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                                          <PriorityChip priority={t.priority} />
                                          <AssigneeAvatars assignees={t.assignees} size={24} />
                                        </Stack>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </Stack>
                              </CardContent>
                            </Card>
                          </Grid>
                        );
                      })}
                    </Grid>
                  )}
                </AsyncView>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardHeader title={`Team Members (${members.length})`} slotProps={{ title: { variant: 'h6' } }} />
                  <Divider />
                  <List>
                    {members.length === 0 && <Box sx={{ px: 2, pb: 1 }}><Typography color="text.secondary">No members.</Typography></Box>}
                    {members.map((m) => (
                      <ListItem
                        key={m.userId}
                        secondaryAction={(
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            <RoleChip role={m.role} />
                            {mayManageMembers && (
                              <Tooltip title={`Remove ${m.fullName}`}>
                                <IconButton size="small" aria-label={`Remove ${m.fullName}`} onClick={() => setDialog({ remove: m })}><PersonRemoveIcon fontSize="small" /></IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        )}
                      >
                        <ListItemAvatar><UserAvatar name={m.fullName} size={36} /></ListItemAvatar>
                        <ListItemText primary={m.fullName} secondary={m.email} slotProps={{ primary: { fontWeight: 600 } }} />
                      </ListItem>
                    ))}
                  </List>
                </Card>
              </Grid>
            </Grid>

            {dialog === 'edit' && (
              <ProjectDialog
                project={p} onClose={() => setDialog(null)}
                onSubmit={async (body) => { await updateProject(projectId, body); setDialog(null); setNotice('Project updated.'); refreshAll(); }}
              />
            )}
            {dialog === 'task' && (
              <TaskDialog
                projects={[{ projectId, name: p.name }]} defaultProjectId={projectId} user={user} managedIds={managedIds}
                onClose={() => setDialog(null)}
                onSubmit={async (body) => { const t = await createTask(body); navigate(`/tasks/${t.taskId}`); }}
              />
            )}
            {dialog === 'member' && (
              <AddMemberDialog
                existingIds={new Set(members.map((m) => m.userId))} onClose={() => setDialog(null)}
                onSubmit={async (userId) => {
                  const m = await addMember(projectId, userId);
                  setDialog(null);
                  project.reload();
                  setNotice(`${m.fullName} was added to the project.`);
                }}
              />
            )}
            {dialog === 'delete' && (
              <ConfirmDialog
                title="Delete project" confirmLabel="Delete project" busy={busy} onCancel={() => setDialog(null)}
                message={`Delete "${p.name}" and all of its tasks, subtasks, comments and attachments? This cannot be undone.`}
                onConfirm={() => guarded(async () => { await deleteProject(projectId); navigate('/projects'); }).then((ok) => { if (!ok) setDialog(null); })}
              />
            )}
            {dialog?.remove && (
              <ConfirmDialog
                title="Remove member" confirmLabel="Remove" busy={busy} onCancel={() => setDialog(null)}
                message={`Remove ${dialog.remove.fullName} from this project? Any tasks in this project assigned to them will be unassigned.`}
                onConfirm={() => guarded(async () => {
                  const summary = await removeMember(projectId, dialog.remove.userId);
                  refreshAll();
                  setNotice(summary.removedAssignments
                    ? `${dialog.remove.fullName} was removed and unassigned from ${summary.removedAssignments} task(s).`
                    : `${dialog.remove.fullName} was removed.`);
                }).then(() => setDialog(null))}
              />
            )}
          </>
        )}
      </AsyncView>
    </>
  );
}
