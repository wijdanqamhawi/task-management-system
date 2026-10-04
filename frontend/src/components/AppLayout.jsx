/*
 * Shared shell for every signed-in screen: sidebar, and a top bar holding the page title,
 * search, the notification bell with unread badge, the signed-in user, and Sign out.
 * Extracted from the Dashboard so all screens share one look; styling is dashboard.css + app.css.
 *
 * Which links appear depends on the role (Users is Admin-only). That is a usability hint:
 * the API still refuses anything the role may not do (Constitution V).
 */
import { useState } from 'react';
import '../styles/dashboard.css';
import '../styles/app.css';
import { Brand } from './AuthShell.jsx';
import { Button } from './index.jsx';
import { Link } from '../router/Link.jsx';
import { useRouter } from '../router/Router.jsx';
import { useSession } from '../auth/SessionContext.jsx';
import { useUnread } from '../notifications/UnreadContext.jsx';
import { ROUTES } from '../router/routes.js';
import { initials } from '../utils/format.js';
import {
  BellIcon, CloseIcon, DashboardIcon, MenuIcon, MyTasksIcon, ProjectsIcon, SearchIcon,
  TasksIcon, TeamIcon,
} from './icons.jsx';

function navItems(user) {
  const items = [
    { to: ROUTES.DASHBOARD, label: 'Dashboard', Icon: DashboardIcon },
    { to: ROUTES.PROJECTS, label: 'Projects', Icon: ProjectsIcon },
    { to: ROUTES.TASKS, label: 'Tasks', Icon: TasksIcon },
    { to: ROUTES.MY_TASKS, label: 'My Tasks', Icon: MyTasksIcon },
    { to: ROUTES.NOTIFICATIONS, label: 'Notifications', Icon: BellIcon, badge: true },
  ];
  if (user?.role === 'ADMIN') items.push({ to: ROUTES.USERS, label: 'Users', Icon: TeamIcon });
  return items;
}

function Sidebar({ open, onClose, user }) {
  const { pathname } = useRouter();
  const { unread } = useUnread();
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
        {navItems(user).map(({ to, label, Icon, badge }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link key={to} to={to} onClick={onClose} aria-current={active ? 'page' : undefined}
                  className={`dash__nav-item${active ? ' dash__nav-item--active' : ''}`}>
              <Icon /><span>{label}</span>
              {badge && unread > 0 && <span className="dash__nav-badge">{unread > 99 ? '99+' : unread}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export default function AppLayout({ title, children }) {
  const { user, logout } = useSession();
  const { navigate } = useRouter();
  const { unread } = useUnread();
  const [menuOpen, setMenuOpen] = useState(false);
  const [term, setTerm] = useState('');

  const displayName = user?.fullName ?? user?.username ?? user?.email ?? 'Account';

  const onSearch = (e) => {
    e.preventDefault();
    const q = term.trim();
    navigate(q ? `${ROUTES.TASKS}?title=${encodeURIComponent(q)}` : ROUTES.TASKS);
  };

  return (
    <div className="dash">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} user={user} />
      {menuOpen && <div className="dash__scrim" onClick={() => setMenuOpen(false)} />}

      <div className="dash__main">
        <header className="dash__topbar">
          <button type="button" className="dash__icon-btn dash__menu-btn"
                  onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>

          <h1 className="dash__title">{title}</h1>

          <form className="dash__search" role="search" onSubmit={onSearch}>
            <span className="dash__search-icon"><SearchIcon /></span>
            <input type="search" value={term} onChange={(e) => setTerm(e.target.value)}
                   placeholder="Search tasks by title" aria-label="Search tasks by title" />
          </form>

          <Link to={ROUTES.NOTIFICATIONS} className="dash__icon-btn dash__bell"
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}>
            <BellIcon />
            {unread > 0 && <span className="dash__bell-badge">{unread > 99 ? '99+' : unread}</span>}
          </Link>

          <div className="dash__profile">
            <Link to={ROUTES.PROFILE} className="dash__profile-link" aria-label="Your profile">
              <span className="dash__avatar" aria-hidden="true">{initials(displayName)}</span>
              <span className="dash__profile-name">{displayName}</span>
            </Link>
            <Button type="button" className="dash__signout" onClick={logout}>Sign out</Button>
          </div>
        </header>

        <main className="dash__content">{children}</main>
      </div>
    </div>
  );
}
