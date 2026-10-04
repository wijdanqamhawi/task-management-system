/*
 * Application shell: the route table and the session / unread-count providers.
 *
 * Public screens: login, register, forgot password. Every other screen sits behind
 * <RouteGuard> and renders inside the shared <AppLayout> (sidebar + top bar). The guard and the
 * role lists only decide what the interface offers; the API enforces authorization on every
 * request (Constitution V, FR-005).
 */
import './styles/layout.css';
import { useEffect } from 'react';
import { Router, Routes, useRouter } from './router/Router.jsx';
import { RouteGuard } from './router/RouteGuard.jsx';
import { SessionProvider, useSession } from './auth/SessionContext.jsx';
import { UnreadProvider } from './notifications/UnreadContext.jsx';
import { ROUTES, ROUTE_ROLES } from './router/routes.js';
import AppLayout from './components/AppLayout.jsx';
import { Link } from './router/Link.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Profile from './pages/Profile.jsx';
import Users from './pages/Users.jsx';
import Projects from './pages/Projects.jsx';
import Project from './pages/Project.jsx';
import Tasks from './pages/Tasks.jsx';
import Task from './pages/Task.jsx';
import MyTasks from './pages/MyTasks.jsx';
import Notifications from './pages/Notifications.jsx';

const guarded = (path, render) => ({
  path,
  element: (params) => <RouteGuard roles={ROUTE_ROLES[path]}>{render(params)}</RouteGuard>,
});

const routes = [
  { path: ROUTES.LOGIN, element: () => <Login /> },
  { path: ROUTES.FORGOT_PASSWORD, element: () => <ForgotPassword /> },
  { path: ROUTES.REGISTER, element: () => <Register /> },
  { path: ROUTES.HOME, element: () => <Home /> },
  guarded(ROUTES.DASHBOARD, () => <Dashboard />),
  guarded(ROUTES.PROFILE, () => <Profile />),
  guarded(ROUTES.USERS, () => <Users />),
  guarded(ROUTES.PROJECTS, () => <Projects />),
  guarded(ROUTES.PROJECT, ({ id }) => <Project key={id} id={id} />),
  guarded(ROUTES.TASKS, () => <Tasks />),
  guarded(ROUTES.TASK, ({ id }) => <Task key={id} id={id} />),
  guarded(ROUTES.MY_TASKS, () => <MyTasks />),
  guarded(ROUTES.NOTIFICATIONS, () => <Notifications />),
];

/** "/" sends a signed-in user to the dashboard; the guard sends everyone else to login. */
function Home() {
  const { navigate } = useRouter();
  const { user, loading } = useSession();
  useEffect(() => {
    if (!loading) navigate(user ? ROUTES.DASHBOARD : `${ROUTES.LOGIN}`, { replace: true });
  }, [loading, user, navigate]);
  return <p className="empty-state">Loading…</p>;
}

function NotFound() {
  return (
    <RouteGuard>
      <AppLayout title="Not found">
        <div className="panel">
          <p><strong>This page does not exist.</strong></p>
          <p><Link to={ROUTES.DASHBOARD} className="text-link">Back to the dashboard</Link></p>
        </div>
      </AppLayout>
    </RouteGuard>
  );
}

function Shell() {
  return <Routes routes={routes} fallback={<NotFound />} />;
}

export default function App() {
  return (
    <SessionProvider>
      <Router>
        <UnreadProvider>
          <Shell />
        </UnreadProvider>
      </Router>
    </SessionProvider>
  );
}
