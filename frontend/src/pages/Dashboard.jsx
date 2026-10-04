/*
 * Dashboard: the nine required figures (FR-036..FR-045) from GET /api/dashboard, computed per
 * request by PKG_DASHBOARD and scoped to what the signed-in user may see. Recent tasks come from
 * GET /api/tasks. No sample data remains.
 */
import { useMemo, useState } from 'react';
import '../styles/dashboard.css';
import AppLayout from '../components/AppLayout.jsx';
import TaskTable from '../components/TaskTable.jsx';
import { Badge, Button, Select } from '../components/index.jsx';
import { Async, PageHeader } from '../components/common.jsx';
import { AlertIcon, CheckCircleIcon, ClockIcon, ProjectsIcon, SearchIcon, TasksIcon } from '../components/icons.jsx';
import { Link } from '../router/Link.jsx';
import { useApi } from '../hooks/useApi.js';
import { useVisibleProjects } from '../hooks/useVisibleProjects.js';
import { useSession } from '../auth/SessionContext.jsx';
import { getDashboard } from '../api/dashboard.js';
import { searchTasks } from '../api/tasks.js';
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '../constants.js';

const STAT_ICONS = {
  projects: ProjectsIcon, tasks: TasksIcon, completed: CheckCircleIcon, pending: ClockIcon, overdue: AlertIcon,
};

function StatCard({ kind, label, value }) {
  const Icon = STAT_ICONS[kind];
  return (
    <div className={`dash__stat dash__stat--${kind}`}>
      <span className="dash__stat-icon"><Icon /></span>
      <div>
        <p className="dash__stat-value">{value}</p>
        <p className="dash__stat-label">{label}</p>
      </div>
    </div>
  );
}

function Breakdown({ rows, total }) {
  return (
    <ul className="breakdown">
      {rows.map((r) => (
        <li key={r.key} className="breakdown__row">
          <Badge value={r.key}>{r.label}</Badge>
          <span className="bar" aria-hidden="true">
            <span className={`bar__fill bar__fill--${r.key}`} style={{ width: `${total ? (r.count / total) * 100 : 0}%` }} />
          </span>
          <strong>{r.count}</strong>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { user } = useSession();
  const visible = useVisibleProjects();
  const dashboard = useApi((signal) => getDashboard({ signal }), []);

  const [term, setTerm] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const params = useMemo(() => ({ title, status, priority, size: 8, sort: 'createdAt,desc' }), [title, status, priority]);
  const recent = useApi((signal) => searchTasks(params, { signal }), [JSON.stringify(params)]);
  const filtersActive = Boolean(title || status || priority);

  return (
    <AppLayout title="Dashboard">
      <Async state={dashboard}>
        {(d) => {
          const stats = [
            { kind: 'projects', label: 'Total Projects', value: d.totalProjects },
            { kind: 'tasks', label: 'Total Tasks', value: d.totalTasks },
            { kind: 'completed', label: 'Completed Tasks', value: d.completedTasks },
            { kind: 'pending', label: 'Pending Tasks', value: d.pendingTasks },
            { kind: 'overdue', label: 'Overdue Tasks', value: d.overdueTasks },
          ];
          return (
            <>
              <PageHeader title={`Welcome, ${user.fullName ?? user.username}`}
                          subtitle="Figures cover the projects you can see." />
              <section aria-label="Summary" className="dash__stats">
                {stats.map((s) => <StatCard key={s.kind} {...s} />)}
              </section>

              <section className="dash__grid">
                <div className="dash__panel dash__panel--wide">
                  <h2 className="dash__panel-title">Recent Tasks</h2>
                  <form className="dash__task-filters" role="search"
                        onSubmit={(e) => { e.preventDefault(); setTitle(term.trim()); }}>
                    <label className="dash__task-search">
                      <span className="dash__search-icon"><SearchIcon /></span>
                      <input type="search" value={term} onChange={(e) => setTerm(e.target.value)}
                             placeholder="Search tasks by title" aria-label="Search tasks by title" />
                    </label>
                    <Select className="dash__task-filter" aria-label="Filter by status" value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            options={[{ value: '', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]} />
                    <Select className="dash__task-filter" aria-label="Filter by priority" value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            options={[{ value: '', label: 'All priorities' }, ...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))]} />
                    <Button type="button" className="dash__clear-filters" disabled={!filtersActive && !term}
                            onClick={() => { setTerm(''); setTitle(''); setStatus(''); setPriority(''); }}>
                      Clear filters
                    </Button>
                  </form>
                  <Async state={recent}>
                    {(page) => (
                      <>
                        <TaskTable tasks={page.content} user={user} managedIds={visible.ids} showProject={false} onChanged={() => { recent.reload(); dashboard.reload(); }}
                                   empty={filtersActive ? 'No tasks match the current filters.' : 'No tasks yet.'} />
                        <p><Link to="/tasks" className="text-link">View all tasks</Link></p>
                      </>
                    )}
                  </Async>
                </div>

                <div className="dash__panel">
                  <h2 className="dash__panel-title">Task Statuses</h2>
                  <Breakdown total={d.totalTasks}
                             rows={STATUSES.map((s) => ({ key: s, label: STATUS_LABELS[s], count: d.tasksByStatus[s] ?? 0 }))} />
                  <h2 className="dash__panel-title" style={{ marginTop: 'var(--sp-5)' }}>Task Priorities</h2>
                  <Breakdown total={d.totalTasks}
                             rows={PRIORITIES.map((p) => ({ key: p, label: PRIORITY_LABELS[p], count: d.tasksByPriority[p] ?? 0 }))} />
                </div>

                <div className="dash__panel dash__panel--wide">
                  <h2 className="dash__panel-title">Project Progress</h2>
                  {d.projectProgress.length === 0 && <p className="dash__state">No projects yet.</p>}
                  <ul className="dash__projects">
                    {d.projectProgress.map((p) => (
                      <li key={p.projectId} className="dash__project">
                        <div className="dash__project-head">
                          <Link to={`/projects/${p.projectId}`} className="dash__project-name text-link">{p.name}</Link>
                          <span className="muted small">{p.completedTasks} of {p.totalTasks} tasks</span>
                        </div>
                        <div className="dash__progress" role="progressbar" aria-label={`${p.name} progress`}
                             aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percentComplete}>
                          <span className="dash__progress-fill" style={{ width: `${p.percentComplete}%` }} />
                        </div>
                        <span className="dash__project-pct">{p.percentComplete}%</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="dash__panel">
                  <h2 className="dash__panel-title">Tasks per Person</h2>
                  {d.tasksByUser.length === 0 && <p className="dash__state">No assigned tasks.</p>}
                  <ul className="item-list">
                    {d.tasksByUser.map((u) => (
                      <li key={u.userId}><span className="item-list__main">{u.fullName}</span><strong>{u.taskCount}</strong></li>
                    ))}
                  </ul>
                </div>
              </section>
            </>
          );
        }}
      </Async>
    </AppLayout>
  );
}
