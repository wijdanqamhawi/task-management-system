/*
 * T042 — application shell and role-aware navigation.
 *
 * Screens are mounted as each user story is implemented. Phase 2 delivers the shell,
 * the router, the session, and the design system; US1 (T048-T051) mounts the first screens.
 */
import './styles/layout.css';
import { Router, Routes } from './router/Router.jsx';
import { Link } from './router/Link.jsx';
import { SessionProvider, useSession } from './auth/SessionContext.jsx';
import { ROUTES } from './router/routes.js';

function Nav() {
  const { user, logout } = useSession();
  if (!user) return null;

  return (
    <nav className="nav">
      <div className="nav__inner">
        <strong>Task Management</strong>
        <Link to={ROUTES.DASHBOARD} className="nav__link">Dashboard</Link>
        <Link to={ROUTES.PROJECTS} className="nav__link">Projects</Link>
        <Link to={ROUTES.TASKS} className="nav__link">Tasks</Link>
        <Link to={ROUTES.MY_TASKS} className="nav__link">My tasks</Link>
        {user.role === 'ADMIN' && <Link to={ROUTES.USERS} className="nav__link">Users</Link>}
        <span className="spacer" />
        <Link to={ROUTES.PROFILE} className="nav__link">{user.fullName ?? user.username}</Link>
        <button className="btn" onClick={logout}>Sign out</button>
      </div>
    </nav>
  );
}

/* Routes are registered here as each user story lands. */
const routes = [];

function Placeholder() {
  return (
    <div className="container">
      <div className="card empty-state">
        <p><strong>Foundation ready.</strong></p>
        <p>
          Design system, router, session and API client are in place. Screens are added
          per user story, starting with US1 (login, profile, user administration).
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Router>
        <Nav />
        <Routes routes={routes} fallback={<Placeholder />} />
      </Router>
    </SessionProvider>
  );
}
