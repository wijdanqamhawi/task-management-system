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
];

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
    || pathname === ROUTES.FORGOT_PASSWORD;

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
