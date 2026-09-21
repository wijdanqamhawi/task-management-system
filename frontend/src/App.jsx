/*
 * T042 — application shell and role-aware navigation.
 *
 * Screens are mounted as each user story is implemented. Phase 2 delivers the shell,
 * the router, the session, and the design system; US1 (T048-T051) mounts the first screens.
 */
import './styles/layout.css';
import { Router, Routes, useRouter } from './router/Router.jsx';
import { Link } from './router/Link.jsx';
import { SessionProvider, useSession } from './auth/SessionContext.jsx';
import { ROUTES } from './router/routes.js';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { RouteGuard } from './router/RouteGuard.jsx';

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

/*
 * Routes are registered here as each user story lands.
 * Week 2 delivers the authentication screens; the remaining US1 screens (profile, user
 * administration) follow in T049-T051.
 */
const routes = [
  { path: ROUTES.LOGIN, element: () => <Login /> },
  { path: ROUTES.FORGOT_PASSWORD, element: () => <ForgotPassword /> },
  { path: ROUTES.REGISTER, element: () => <Register /> },
  // Behind the session guard; the Dashboard renders its own sidebar and top bar.
  { path: ROUTES.DASHBOARD, element: () => <RouteGuard><Dashboard /></RouteGuard> },
];

/*
 * DEVELOPMENT-ONLY visual preview of the Dashboard, at /dev/dashboard.
 *
 * It renders the real <Dashboard /> component without a session so the layout can be
 * reviewed before the backend login works. It creates no session, calls no auth endpoint
 * and grants access to nothing: the Dashboard shows only sample data. `import.meta.env.DEV`
 * is replaced by the literal `false` in `vite build`, so this route and its path string are
 * removed from production bundles. The real /dashboard route above stays behind RouteGuard.
 */
const DEV_PREVIEW_PATH = import.meta.env.DEV ? '/dev/dashboard' : null;
if (DEV_PREVIEW_PATH) {
  routes.push({ path: DEV_PREVIEW_PATH, element: () => <Dashboard preview /> });
}

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

/**
 * The authentication screens are full-viewport and must render without the navigation
 * bar, which is only meaningful once a user is signed in.
 */
function Shell() {
  const { pathname } = useRouter();
  const isAuthScreen = pathname === ROUTES.LOGIN
    || pathname === ROUTES.REGISTER
    || pathname === ROUTES.FORGOT_PASSWORD
    || pathname === ROUTES.DASHBOARD   // has its own sidebar + top bar
    || pathname === DEV_PREVIEW_PATH;

  return (
    <>
      {!isAuthScreen && <Nav />}
      <Routes routes={routes} fallback={<Placeholder />} />
    </>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Router>
        <Shell />
      </Router>
    </SessionProvider>
  );
}
