/*
 * Project detail, progress, members and its tasks (FR-009..FR-015, FR-033, FR-044).
 * Edit, delete and membership controls are shown only to a Manager OF this project or an
 * Admin (R-003); the API enforces the same rule.
 */
import { useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import ProjectForm from '../components/ProjectForm.jsx';
import TaskTable from '../components/TaskTable.jsx';
import { Badge, Button, Table, TextInput } from '../components/index.jsx';
import { Async, ConfirmDialog, Notice, PageHeader } from '../components/common.jsx';
import { Link } from '../router/Link.jsx';
import { useRouter } from '../router/Router.jsx';
import { useApi } from '../hooks/useApi.js';
import { useSession } from '../auth/SessionContext.jsx';
import {
  addMember, deleteProject, getProject, getProgress, removeMember, updateProject,
} from '../api/projects.js';
import { searchTasks } from '../api/tasks.js';
import { listUsers } from '../api/users.js';
import { PROJECT_STATUS_LABELS, ROLE_LABELS } from '../constants.js';
import { fmtDate, errorMessage } from '../utils/format.js';

function MemberPicker({ existingIds, onAdd, busy }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  async function search(e) {
    e.preventDefault();
    setError('');
    try {
      const page = await listUsers({ search: term.trim(), size: 10 });
      setResults(page.content.filter((u) => u.isActive && !existingIds.has(u.userId)));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="stack">
      <form className="row" role="search" onSubmit={search}>
        <div className="spacer" style={{ minWidth: 180 }}>
          <TextInput type="search" value={term} onChange={(e) => setTerm(e.target.value)}
                     placeholder="Find a user to add" aria-label="Find a user to add" />
        </div>
        <Button type="submit">Search</Button>
      </form>
      <Notice>{error}</Notice>
      {results && results.length === 0 && <p className="muted small">No matching users outside this project.</p>}
      {results && results.length > 0 && (
        <ul className="item-list" aria-label="Search results">
          {results.map((u) => (
            <li key={u.userId}>
              <span className="item-list__main">{u.fullName} <span className="muted small">({u.email})</span></span>
              <Button type="button" disabled={busy} onClick={async () => {
                await onAdd(u.userId);
                setResults((r) => r.filter((x) => x.userId !== u.userId));
              }}>Add</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
  const isManager = user.role === 'ADMIN'
    || (user.role === 'MANAGER' && members.some((m) => m.userId === user.userId));
  const managedIds = new Set(isManager ? [projectId] : []);

  async function guarded(action, success) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      if (success) setNotice(success);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const refreshAll = () => { project.reload(); progress.reload(); tasks.reload(); };

  const memberColumns = [
    { key: 'fullName', header: 'Name', render: (m) => <strong>{m.fullName}</strong> },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (m) => <Badge value={m.role}>{ROLE_LABELS[m.role]}</Badge> },
    ...(isManager ? [{ key: 'actions', header: '',
      render: (m) => <Button type="button" disabled={busy} onClick={() => setRemoving(m)}>Remove</Button> }] : []),
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
                  {isManager && <Button onClick={() => setEditing(true)}>Edit</Button>}
                  {isManager && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>}
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
              {isManager && (
                <>
                  <hr />
                  <MemberPicker busy={busy} existingIds={new Set(members.map((m) => m.userId))}
                    onAdd={(uid) => guarded(async () => { await addMember(projectId, uid); project.reload(); }, 'Member added.')} />
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
                message={`Delete "${p.name}" and all of its tasks, subtasks, comments and attachments? This cannot be undone.`}
                onCancel={() => setConfirmDelete(false)}
                onConfirm={() => guarded(async () => { await deleteProject(projectId); navigate('/projects'); })} />
            )}
            {removing && (
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
