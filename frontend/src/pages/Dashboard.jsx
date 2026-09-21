/*
 * Dashboard — sits behind RouteGuard at /dashboard.
 *
 * All figures shown here are SAMPLE DATA from ./dashboardMock.js and are labelled as such
 * on screen. Nothing is fetched from the backend yet.
 *
 * Only the Dashboard exists so far, so the other sidebar entries, the search field and the
 * notification bell are rendered as disabled placeholders rather than links or working
 * controls. Sign out is real (SessionContext.logout).
 *
 * Icons are inline SVG: no icon library, no new dependency (Constitution II).
 */
import { useState } from 'react';
import '../styles/dashboard.css';
import { Badge, Button, Table } from '../components/index.jsx';
import { Brand } from '../components/AuthShell.jsx';
import { useSession } from '../auth/SessionContext.jsx';
import {
  PRIORITY_LABELS,
  SAMPLE_OVERDUE_TASKS,
  SAMPLE_RECENT_PROJECTS,
  SAMPLE_RECENT_TASKS,
  SAMPLE_STATUS_COUNTS,
  SAMPLE_TOTAL_PROJECTS,
  STATUS_LABELS,
} from './dashboardMock.js';

const icon = (children) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const DashboardIcon = () => icon(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>);
const ProjectsIcon  = () => icon(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />);
const TasksIcon     = () => icon(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m9 12 2 2 4-4" /></>);
const TeamIcon      = () => icon(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.4A6 6 0 0 1 21 20" /></>);
const SettingsIcon  = () => icon(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>);
const SearchIcon    = () => icon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
const BellIcon      = () => icon(<><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10.3 20a2 2 0 0 0 3.4 0" /></>);
const MenuIcon      = () => icon(<path d="M4 6h16M4 12h16M4 18h16" />);
const CloseIcon     = () => icon(<path d="M6 6l12 12M18 6 6 18" />);

const STAT_ICONS = {
  projects: ProjectsIcon,
  tasks: TasksIcon,
  completed: () => icon(<><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></>),
  pending: () => icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  overdue: () => icon(<><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17.5v.01" /></>),
};

/* Only the Dashboard exists; the rest are placeholders until their pages are built. */
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', Icon: DashboardIcon, active: true },
  { key: 'projects',  label: 'Projects',  Icon: ProjectsIcon },
  { key: 'my-tasks',  label: 'My Tasks',  Icon: TasksIcon },
  { key: 'team',      label: 'Team',      Icon: TeamIcon },
  { key: 'settings',  label: 'Settings',  Icon: SettingsIcon },
];

const STATUS_ORDER = ['TO_DO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];

function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

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

function Sidebar({ open, onClose }) {
  return (
    <aside className={`dash__sidebar${open ? ' dash__sidebar--open' : ''}`} aria-label="Primary">
      <div className="dash__sidebar-head">
        <div className="login__brand"><Brand /></div>
        <button type="button" className="dash__icon-btn dash__sidebar-close"
                onClick={onClose} aria-label="Close menu">
          <CloseIcon />
        </button>
      </div>

      <nav className="dash__nav">
        {NAV_ITEMS.map(({ key, label, Icon, active }) => (
          active ? (
            <span key={key} className="dash__nav-item dash__nav-item--active" aria-current="page">
              <Icon /><span>{label}</span>
            </span>
          ) : (
            <button key={key} type="button" className="dash__nav-item" disabled
                    title="Not available yet">
              <Icon /><span>{label}</span>
              <span className="dash__soon">Soon</span>
            </button>
          )
        ))}
      </nav>
    </aside>
  );
}

export default function Dashboard() {
  const { user, logout } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = user?.fullName ?? user?.username ?? user?.email ?? 'Account';

  const totalTasks = STATUS_ORDER.reduce((sum, s) => sum + SAMPLE_STATUS_COUNTS[s], 0);
  const completed = SAMPLE_STATUS_COUNTS.COMPLETED;

  const stats = [
    { kind: 'projects',  label: 'Total Projects',  value: SAMPLE_TOTAL_PROJECTS },
    { kind: 'tasks',     label: 'Total Tasks',     value: totalTasks },
    { kind: 'completed', label: 'Completed Tasks', value: completed },
    { kind: 'pending',   label: 'Pending Tasks',   value: totalTasks - completed },
    { kind: 'overdue',   label: 'Overdue Tasks',   value: SAMPLE_OVERDUE_TASKS },
  ];

  const taskColumns = [
    { key: 'name', header: 'Task', render: (r) => <span className="dash__task-name">{r.name}</span> },
    { key: 'assignee', header: 'Assigned to' },
    { key: 'priority', header: 'Priority',
      render: (r) => <Badge value={r.priority}>{PRIORITY_LABELS[r.priority]}</Badge> },
    { key: 'status', header: 'Status',
      render: (r) => <Badge value={r.status}>{STATUS_LABELS[r.status]}</Badge> },
    { key: 'due', header: 'Due date' },
  ];

  return (
    <div className="dash">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      {menuOpen && <div className="dash__scrim" onClick={() => setMenuOpen(false)} />}

      <div className="dash__main">
        <header className="dash__topbar">
          <button type="button" className="dash__icon-btn dash__menu-btn"
                  onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>

          <h1 className="dash__title">Dashboard</h1>

          <label className="dash__search">
            <span className="dash__search-icon"><SearchIcon /></span>
            <input type="search" placeholder="Search (coming soon)" disabled
                   aria-label="Search — not available yet" />
          </label>

          <button type="button" className="dash__icon-btn" disabled
                  aria-label="Notifications — not available yet" title="Not available yet">
            <BellIcon />
          </button>

          <div className="dash__profile">
            <span className="dash__avatar" aria-hidden="true">{initials(displayName)}</span>
            <span className="dash__profile-name">{displayName}</span>
            <Button type="button" className="dash__signout" onClick={logout}>Sign out</Button>
          </div>
        </header>

        <main className="dash__content">
          <p className="dash__sample-note" role="note">
            <strong>Sample data.</strong> The figures, tasks and projects below are placeholders
            and are not connected to the backend yet.
          </p>

          <section aria-label="Summary" className="dash__stats">
            {stats.map((s) => <StatCard key={s.kind} {...s} />)}
          </section>

          <section className="dash__grid">
            <div className="dash__panel dash__panel--wide">
              <h2 className="dash__panel-title">Recent Tasks</h2>
              <Table columns={taskColumns} rows={SAMPLE_RECENT_TASKS} empty="No recent tasks" />
            </div>

            <div className="dash__panel">
              <h2 className="dash__panel-title">Task Statuses</h2>
              <ul className="dash__statuses">
                {STATUS_ORDER.map((s) => (
                  <li key={s} className="dash__status-row">
                    <Badge value={s}>{STATUS_LABELS[s]}</Badge>
                    <span className="dash__status-bar" aria-hidden="true">
                      <span className={`dash__status-fill dash__status-fill--${s}`}
                            style={{ width: `${(SAMPLE_STATUS_COUNTS[s] / totalTasks) * 100}%` }} />
                    </span>
                    <strong>{SAMPLE_STATUS_COUNTS[s]}</strong>
                  </li>
                ))}
              </ul>
            </div>

            <div className="dash__panel dash__panel--full">
              <h2 className="dash__panel-title">Recent Projects</h2>
              <ul className="dash__projects">
                {SAMPLE_RECENT_PROJECTS.map((p) => (
                  <li key={p.id} className="dash__project">
                    <div className="dash__project-head">
                      <span className="dash__project-name">{p.name}</span>
                      <Badge value={p.status}>{STATUS_LABELS[p.status]}</Badge>
                    </div>
                    <div className="dash__progress" role="progressbar" aria-label={`${p.name} progress`}
                         aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.progress}>
                      <span className="dash__progress-fill" style={{ width: `${p.progress}%` }} />
                    </div>
                    <span className="dash__project-pct">{p.progress}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
