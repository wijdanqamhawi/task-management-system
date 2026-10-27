/*
 * Project detail, progress, members and its tasks (FR-009..FR-015, FR-033, FR-044).
 * Edit, delete and membership controls need the matching permission AND manager scope: a member
 * of THIS project, or PROJECT_MANAGE_ALL (R-003); the API enforces the same rule.
 */
import { useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import ProjectForm from '../components/ProjectForm.jsx';
import TaskTable from '../components/TaskTable.jsx';
import { Badge, Button, Modal, Select, Table, TextInput } from '../components/index.jsx';
import { Async, ConfirmDialog, Notice, PageHeader } from '../components/common.jsx';
import { Link } from '../router/Link.jsx';
import { useRouter } from '../router/Router.jsx';
import { useApi } from '../hooks/useApi.js';
import { useSession } from '../auth/SessionContext.jsx';
import {
  addMember, deleteProject, getProject, getProgress, removeMember, updateProject,
} from '../api/projects.js';
import { searchTasks } from '../api/tasks.js';
import { PROJECT_STATUS_LABELS, ROLE_LABELS } from '../constants.js';
import { canDeleteProject, canManageMembers, canUpdateProject } from '../utils/permissions.js';
import { fmtDate, errorMessage } from '../utils/format.js';

/**
 * An ADMIN leaving a project must hand responsibility to another ADMIN or MANAGER who is already
 * a member. The list is built from the members already loaded; the API re-checks every rule.
 */
function TransferDialog({ eligible, busy, onCancel, onConfirm }) {
  const [choice, setChoice] = useState('');
  const options = [{ value: '', label: eligible.length ? 'Select a replacement…' : 'No eligible members' },
    ...eligible.map((m) => ({ value: String(m.userId), label: `${m.fullName} (${ROLE_LABELS[m.role]})` }))];
  return (
    <Modal title="Transfer Project Responsibility" onClose={busy ? undefined : onCancel}>
      <p>Before you leave this project, choose who takes over responsibility for it. Any tasks in
        this project assigned to you will be unassigned.</p>
      <div className="field">
        <label htmlFor="replacement">Replacement (Admin or Manager)</label>
        <Select id="replacement" value={choice} options={options} disabled={busy || eligible.length === 0}
                onChange={(e) => setChoice(e.target.value)} />
      </div>
      {eligible.length === 0 && (
        <p className="muted small">There is no other Admin or Manager in this project. Add one first; you cannot leave until then.</p>
      )}
      <div className="row row--end">
        <Button type="button" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="button" variant="danger" disabled={busy || choice === ''} onClick={() => onConfirm(Number(choice))}>
          {busy ? 'Working…' : 'Confirm & Leave'}
        </Button>
      </div>
    </Modal>
  );
}

function MemberPicker({ existingIds, onAdd, busy }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    // Quick feedback only; the API re-checks the ID, active status and membership.
    if (!/^[1-9]\d*$/.test(value)) {
      setError('Enter a valid User ID (a positive whole number).');
      return;
    }
    if (existingIds.has(Number(value))) {
      setError('That user is already a member of this project.');
      return;
    }
    if (await onAdd(Number(value))) setValue('');
  }

  return (
    <form className="row" onSubmit={submit} noValidate>
      <div className="spacer" style={{ minWidth: 180 }}>
        <TextInput type="text" inputMode="numeric" pattern="[0-9]*" value={value}
                   onChange={(e) => { setValue(e.target.value.replace(/\D/g, '')); setError(''); }}
                   placeholder="Enter User ID" aria-label="Enter User ID"
                   aria-invalid={error ? 'true' : undefined} />
      </div>
      <Button type="submit" disabled={busy || value === ''}>Add Member</Button>
      <Notice>{error}</Notice>
    </form>
  );
}

export default function Project({ id }) {
  const projectId = Number(id);
  const { user } = useSession();
  const { navigate } = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [removing, setRemoving] = useState(null);

  const project = useApi((signal) => getProject(projectId, { signal }), [projectId]);
  const progress = useApi((signal) => getProgress(projectId, { signal }), [projectId]);
  const tasks = useApi((signal) => searchTasks({ projectId, size: 8, sort: 'dueDate' }, { signal }), [projectId]);

  const members = project.data?.members ?? [];
  // Manager scope = membership of this project (plus PROJECT_MANAGE_ALL inside the helpers).
  const managedIds = new Set(members.some((m) => m.userId === user.userId) ? [projectId] : []);
  const mayUpdate = canUpdateProject(user, projectId, managedIds);
  const mayDelete = canDeleteProject(user, projectId, managedIds);
  const mayManageMembers = canManageMembers(user, projectId, managedIds);

  async function guarded(action, success) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      if (success) setNotice(success);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const refreshAll = () => { project.reload(); progress.reload(); tasks.reload(); };

  const memberColumns = [
    { key: 'fullName', header: 'Name', render: (m) => <strong>{m.fullName}</strong> },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (m) => <Badge value={m.role}>{ROLE_LABELS[m.role]}</Badge> },
    // Managers never see Remove on their own row; only an ADMIN may remove themselves (via the transfer dialog).
    ...(mayManageMembers ? [{ key: 'actions', header: '',
      render: (m) => (m.userId === user.userId && user.role !== 'ADMIN' ? null
        : <Button type="button" disabled={busy} onClick={() => setRemoving(m)}>Remove</Button>) }] : []),
  ];

  return (
    <AppLayout title="Project">
      <Async state={project}>
        {(p) => (
          <>
            <PageHeader
              title={p.name}
              subtitle={`${PROJECT_STATUS_LABELS[p.status]} · ${fmtDate(p.startDate)} to ${fmtDate(p.endDate)}`}
              actions={(
                <>
                  <Link to={`/tasks?projectId=${p.projectId}`} className="btn">All tasks</Link>
                  {mayUpdate && <Button onClick={() => setEditing(true)}>Edit</Button>}
                  {mayDelete && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>}
                </>
              )}
            />
            <Notice kind="error" onClose={() => setError('')}>{error}</Notice>
            <Notice kind="success" onClose={() => setNotice('')}>{notice}</Notice>

            <div className="cols cols--3">
              <section className="panel span-2">
                <h3 className="panel__title">About</h3>
                <p className="prose">{p.description || <span className="muted">No description.</span>}</p>
              </section>

              <section className="panel" aria-label="Progress">
                <h3 className="panel__title">Progress</h3>
                <Async state={progress}>
                  {(g) => (
                    <>
                      <p><strong>{g.percentComplete}%</strong> complete · {g.completedTasks} of {g.totalTasks} tasks</p>
                      <div className="progress" role="progressbar" aria-label="Project progress"
                           aria-valuemin={0} aria-valuemax={100} aria-valuenow={g.percentComplete}>
                        <span className="progress__fill" style={{ width: `${g.percentComplete}%` }} />
                      </div>
                    </>
                  )}
                </Async>
              </section>
            </div>

            <section className="panel">
              <h3 className="panel__title">Members ({members.length})</h3>
              <Table columns={memberColumns} rows={members.map((m) => ({ ...m, id: m.userId }))} empty="No members." />
              {mayManageMembers && (
                <>
                  <hr />
                  <MemberPicker busy={busy} existingIds={new Set(members.map((m) => m.userId))}
                    onAdd={(uid) => guarded(async () => {
                      const m = await addMember(projectId, uid);
                      project.reload();
                      setNotice(`${m.fullName} was added to the project.`);
                    })} />
                </>
              )}
            </section>

            <section className="panel">
              <h3 className="panel__title">Tasks</h3>
              <Async state={tasks}>
                {(page) => (
                  <>
                    <TaskTable tasks={page.content} user={user} managedIds={managedIds} showProject={false}
                               onChanged={refreshAll} empty="No tasks in this project yet." />
                    {page.totalElements > page.content.length && (
                      <p><Link to={`/tasks?projectId=${p.projectId}`} className="text-link">
                        View all {page.totalElements} tasks</Link></p>
                    )}
                  </>
                )}
              </Async>
            </section>

            {editing && (
              <ProjectForm project={p} onClose={() => setEditing(false)}
                onSubmit={async (body) => { await updateProject(projectId, body); setEditing(false); setNotice('Project updated.'); refreshAll(); }} />
            )}
            {confirmDelete && (
              <ConfirmDialog title="Delete project" danger confirmLabel="Delete project" busy={busy}
                message={`Delete "${p.name}" and all of its tasks, progress items, comments and attachments? This cannot be undone.`}
                onCancel={() => setConfirmDelete(false)}
                onConfirm={() => guarded(async () => { await deleteProject(projectId); navigate('/projects'); })} />
            )}
            {removing && removing.userId === user.userId && (
              <TransferDialog busy={busy}
                eligible={members.filter((m) => m.userId !== user.userId && m.isActive
                  && (m.role === 'ADMIN' || m.role === 'MANAGER'))}
                onCancel={() => setRemoving(null)}
                onConfirm={(replacementId) => guarded(async () => {
                  await removeMember(projectId, user.userId, replacementId);
                  setRemoving(null);
                  refreshAll();
                  setNotice('Responsibility was transferred and you have left the project.');
                })} />
            )}
            {removing && removing.userId !== user.userId && (
              <ConfirmDialog title="Remove member" danger confirmLabel="Remove" busy={busy}
                message={`Remove ${removing.fullName} from this project? Any tasks in this project assigned to them will be unassigned.`}
                onCancel={() => setRemoving(null)}
                onConfirm={() => guarded(async () => {
                  const summary = await removeMember(projectId, removing.userId);
                  setRemoving(null);
                  refreshAll();
                  setNotice(summary.removedAssignments
                    ? `${removing.fullName} was removed and unassigned from ${summary.removedAssignments} task(s): ${summary.unassignedTasks.map((t) => t.title).join(', ')}.`
                    : `${removing.fullName} was removed.`);
                })} />
            )}
          </>
        )}
      </Async>
    </AppLayout>
  );
}
