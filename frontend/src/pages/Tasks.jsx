/*
 * Task list with search and filters (FR-016, FR-046..FR-053). All filters are sent to
 * GET /api/tasks and combined with AND by the server, which also applies visibility, so a
 * filter can never reveal a task the user may not see. No matches shows a message, not an error.
 *
 * The top-bar search and the "All tasks" link on a project arrive here as ?title= / ?projectId=.
 */
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import TaskForm from '../components/TaskForm.jsx';
import TaskTable from '../components/TaskTable.jsx';
import { Button, DateInput, Field, Select, TextInput } from '../components/index.jsx';
import { Async, PageHeader, Pagination } from '../components/common.jsx';
import { useRouter } from '../router/Router.jsx';
import { useApi } from '../hooks/useApi.js';
import { useVisibleProjects } from '../hooks/useVisibleProjects.js';
import { useSession } from '../auth/SessionContext.jsx';
import { createTask, searchTasks } from '../api/tasks.js';
import { listUsers } from '../api/users.js';
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '../constants.js';

const EMPTY = { projectId: '', userId: '', status: '', priority: '', dueDateFrom: '', dueDateTo: '', title: '', overdue: '', sort: '' };

const SORT_OPTIONS = [
  { value: '', label: 'Due date (soonest)' },
  { value: 'dueDate,desc', label: 'Due date (latest)' },
  { value: 'priority,desc', label: 'Priority (high first)' },
  { value: 'title', label: 'Title (A to Z)' },
  { value: 'createdAt,desc', label: 'Newest first' },
];

function fromQuery(search) {
  const q = new URLSearchParams(search);
  const next = { ...EMPTY };
  Object.keys(EMPTY).forEach((k) => { if (q.get(k)) next[k] = q.get(k); });
  return next;
}

export default function Tasks() {
  const { user } = useSession();
  const { search, navigate } = useRouter();
  const initial = useMemo(() => fromQuery(search), [search]);
  const [filters, setFilters] = useState(initial);
  const [titleDraft, setTitleDraft] = useState(initial.title);
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);

  // A new ?query (e.g. from the top-bar search) replaces the filters.
  useEffect(() => { setFilters(initial); setTitleDraft(initial.title); setPage(0); }, [initial]);

  const visible = useVisibleProjects();
  const users = useApi((signal) => listUsers({ size: 100 }, { signal }), []);

  const params = useMemo(() => ({
    ...filters, overdue: filters.overdue === '' ? undefined : filters.overdue, page, size: 15,
  }), [filters, page]);
  const state = useApi((signal) => searchTasks(params, { signal }), [JSON.stringify(params)]);

  const update = (key) => (e) => { setFilters((f) => ({ ...f, [key]: e.target.value })); setPage(0); };
  const active = Object.values(filters).some(Boolean);
  const clear = () => { setFilters(EMPTY); setTitleDraft(''); setPage(0); if (search) navigate('/tasks', { replace: true }); };

  async function onCreate(body) {
    const task = await createTask(body);
    setCreating(false);
    navigate(`/tasks/${task.taskId}`);
  }

  return (
    <AppLayout title="Tasks">
      <PageHeader title="Tasks" subtitle="Tasks in the projects you belong to."
        actions={<Button variant="primary" onClick={() => setCreating(true)} disabled={visible.projects.length === 0}
                         title={visible.projects.length === 0 ? 'Join a project to create tasks' : undefined}>New task</Button>} />

      <section className="panel">
        <form onSubmit={(e) => { e.preventDefault(); setFilters((f) => ({ ...f, title: titleDraft.trim() })); setPage(0); }}
              aria-label="Search and filter tasks">
          <div className="toolbar">
            <Field label="Title contains">
              <TextInput type="search" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} placeholder="Search by title" />
            </Field>
            <Field label="Project">
              <Select value={filters.projectId} onChange={update('projectId')}
                      options={[{ value: '', label: 'All projects' }, ...visible.projects.map((p) => ({ value: p.projectId, label: p.name }))]} />
            </Field>
            <Field label="Assigned to">
              <Select value={filters.userId} onChange={update('userId')}
                      options={[{ value: '', label: 'Anyone' }, ...(users.data?.content ?? []).map((u) => ({ value: u.userId, label: u.fullName }))]} />
            </Field>
            <Field label="Status">
              <Select value={filters.status} onChange={update('status')}
                      options={[{ value: '', label: 'Any status' }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]} />
            </Field>
            <Field label="Priority">
              <Select value={filters.priority} onChange={update('priority')}
                      options={[{ value: '', label: 'Any priority' }, ...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))]} />
            </Field>
            <Field label="Due from"><DateInput value={filters.dueDateFrom} onChange={update('dueDateFrom')} /></Field>
            <Field label="Due to"><DateInput value={filters.dueDateTo} onChange={update('dueDateTo')} /></Field>
            <Field label="Overdue">
              <Select value={filters.overdue} onChange={update('overdue')}
                      options={[{ value: '', label: 'All tasks' }, { value: 'true', label: 'Overdue only' }, { value: 'false', label: 'Not overdue' }]} />
            </Field>
            <Field label="Sort by">
              <Select value={filters.sort} onChange={update('sort')} options={SORT_OPTIONS} />
            </Field>
            <div className="toolbar__actions">
              <Button type="submit" variant="primary">Search</Button>
              <Button type="button" onClick={clear} disabled={!active && !titleDraft}>Clear filters</Button>
            </div>
          </div>
        </form>

        <Async state={state}>
          {(data) => (
            <>
              <TaskTable tasks={data.content} user={user} managedIds={visible.ids} onChanged={state.reload}
                         empty={active ? 'No tasks match the current filters.' : 'No tasks yet.'} />
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPage={setPage} />
            </>
          )}
        </Async>
      </section>

      {creating && (
        <TaskForm projects={visible.projects} defaultProjectId={filters.projectId ? Number(filters.projectId) : undefined}
                  user={user} managedIds={visible.ids} onSubmit={onCreate} onClose={() => setCreating(false)} />
      )}
    </AppLayout>
  );
}
