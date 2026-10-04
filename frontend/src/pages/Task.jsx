/*
 * Task detail: edit, status, assignees, subtasks, attachments, comments
 * (FR-017..FR-026, FR-034). A task outside the caller's projects is a 404 from the API, which
 * this screen shows as "Task not found" without saying whether it exists (FR-053).
 *
 * Controls follow the roles but the API is the authority: status by an assignee, a Manager of
 * the project or an Admin; assignment by a Manager of the project or an Admin; delete by the
 * creator, a Manager of the project or an Admin.
 */
import { useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import TaskForm from '../components/TaskForm.jsx';
import { AttachmentsPanel, CommentsPanel, SubtasksPanel } from '../components/TaskPanels.jsx';
import { Badge, Button, Select } from '../components/index.jsx';
import { Async, ConfirmDialog, Notice, PageHeader, StatusSelect } from '../components/common.jsx';
import { Link } from '../router/Link.jsx';
import { useRouter } from '../router/Router.jsx';
import { useApi } from '../hooks/useApi.js';
import { useVisibleProjects } from '../hooks/useVisibleProjects.js';
import { useSession } from '../auth/SessionContext.jsx';
import {
  assignUsers, changeStatus, deleteTask, getTask, unassignUser, updateTask,
} from '../api/tasks.js';
import { listMembers } from '../api/projects.js';
import { PRIORITY_LABELS, STATUS_LABELS } from '../constants.js';
import { canChangeStatus, canDeleteTask, isManagerOf } from '../utils/permissions.js';
import { errorMessage, fmtDate, fmtDateTime } from '../utils/format.js';

function Assignees({ task, manager, onChanged, setError }) {
  const members = useApi((signal) => (manager ? listMembers(task.projectId, { signal }) : Promise.resolve([])),
    [task.projectId, manager]);
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
    <section className="panel" aria-label="Assignees">
      <h3 className="panel__title">Assigned to</h3>
      {task.assignees.length === 0 && <p className="muted">Nobody is assigned yet.</p>}
      <ul className="item-list">
        {task.assignees.map((a) => (
          <li key={a.userId}>
            <span className="item-list__main">{a.fullName}</span>
            {manager && (
              <Button type="button" disabled={busy} aria-label={`Unassign ${a.fullName}`}
                      onClick={() => run(() => unassignUser(task.taskId, a.userId))}>Unassign</Button>
            )}
          </li>
        ))}
      </ul>
      {manager && (
        <form className="row" onSubmit={(e) => {
          e.preventDefault();
          if (pick) run(async () => { await assignUsers(task.taskId, [Number(pick)]); setPick(''); });
        }}>
          <div className="spacer" style={{ minWidth: 180 }}>
            <Select aria-label="Assign a project member" value={pick} onChange={(e) => setPick(e.target.value)}
                    options={[{ value: '', label: candidates.length ? 'Choose a member…' : 'Everyone is assigned' },
                              ...candidates.map((m) => ({ value: m.userId, label: m.fullName }))]} />
          </div>
          <Button type="submit" disabled={busy || !pick}>Assign</Button>
        </form>
      )}
    </section>
  );
}

export default function Task({ id }) {
  const taskId = Number(id);
  const { user } = useSession();
  const { navigate } = useRouter();
  const visible = useVisibleProjects();
  const state = useApi((signal) => getTask(taskId, { signal }), [taskId]);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function setStatus(status) {
    setBusy(true);
    setError('');
    try { await changeStatus(taskId, status); state.reload(); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  async function remove(task) {
    setBusy(true);
    try { await deleteTask(taskId); navigate(`/projects/${task.projectId}`); }
    catch (e) { setError(errorMessage(e)); setConfirmDelete(false); setBusy(false); }
  }

  return (
    <AppLayout title="Task">
      <Async state={state}>
        {(t) => {
          const manager = isManagerOf(user, t.projectId, visible.ids);
          const mayStatus = canChangeStatus(user, t, visible.ids);
          return (
            <>
              <PageHeader
                title={t.title}
                subtitle={<><Link to={`/projects/${t.projectId}`} className="text-link">{t.projectName}</Link>
                  {' · '}created {fmtDateTime(t.createdAt)}</>}
                actions={(
                  <>
                    <Button onClick={() => setEditing(true)}>Edit</Button>
                    {canDeleteTask(user, t, visible.ids) && (
                      <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
                    )}
                  </>
                )}
              />
              <Notice kind="error" onClose={() => setError('')}>{error}</Notice>
              <Notice kind="success" onClose={() => setNotice('')}>{notice}</Notice>

              <div className="cols cols--3">
                <section className="panel span-2" aria-label="Details">
                  <h3 className="panel__title">Details</h3>
                  <dl className="kv">
                    <div>
                      <dt>Status</dt>
                      <dd>{mayStatus
                        ? <StatusSelect value={t.status} disabled={busy} onChange={setStatus} />
                        : <Badge value={t.status}>{STATUS_LABELS[t.status]}</Badge>}
                        {!mayStatus && <span className="muted small"> Only an assignee, a Manager of the project or an Admin can change it.</span>}
                      </dd>
                    </div>
                    <div><dt>Priority</dt><dd><Badge value={t.priority}>{PRIORITY_LABELS[t.priority]}</Badge></dd></div>
                    <div><dt>Start date</dt><dd>{fmtDate(t.startDate)}</dd></div>
                    <div>
                      <dt>Due date</dt>
                      <dd>{fmtDate(t.dueDate)} {t.overdue && <Badge kind="overdue">Overdue</Badge>}</dd>
                    </div>
                  </dl>
                  <hr />
                  <h4 className="panel__title">Description</h4>
                  <p className="prose">{t.description || <span className="muted">No description.</span>}</p>
                </section>

                <Assignees task={t} manager={manager} onChanged={state.reload} setError={setError} />
              </div>

              <div className="cols cols--2">
                <SubtasksPanel taskId={taskId} />
                <AttachmentsPanel taskId={taskId} user={user} canManage={manager} />
              </div>
              <CommentsPanel taskId={taskId} />

              {editing && (
                <TaskForm task={t} user={user} managedIds={visible.ids} onClose={() => setEditing(false)}
                  onSubmit={async (body) => { await updateTask(taskId, body); setEditing(false); setNotice('Task updated.'); state.reload(); }} />
              )}
              {confirmDelete && (
                <ConfirmDialog title="Delete task" danger confirmLabel="Delete task" busy={busy}
                  message={`Delete "${t.title}" with its subtasks, comments and attachments? This cannot be undone.`}
                  onCancel={() => setConfirmDelete(false)} onConfirm={() => remove(t)} />
              )}
            </>
          );
        }}
      </Async>
    </AppLayout>
  );
}
