// The Material UI presentation of the real application. It uses the same SessionProvider, Router
// and UnreadProvider as the Original UI (mounted above the design switcher), the same route paths
// and the same ROUTE_PERMISSIONS; only the components that draw the screens differ.
import { useEffect } from 'react';
import { Alert, Box, CircularProgress, CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from './theme.js';
import Layout from './Layout.jsx';
import { NavLink } from './shared.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import ResetPassword from './pages/auth/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Projects from './pages/Projects.jsx';
import ProjectDetails from './pages/ProjectDetails.jsx';
import Tasks from './pages/Tasks.jsx';
import MyTasks from './pages/MyTasks.jsx';
import TaskDetails from './pages/TaskDetails.jsx';
import Notifications from './pages/Notifications.jsx';
import Users from './pages/Users.jsx';
import Profile from './pages/Profile.jsx';
import { Routes, useRouter } from '../router/Router.jsx';
import { useSession } from '../auth/SessionContext.jsx';
import { ROUTES, ROUTE_PERMISSIONS } from '../router/routes.js';
import { hasAnyPermission } from '../utils/permissions.js';

const centered = { minHeight: '100vh', display: 'grid', placeItems: 'center' };

/** Same rules as the Original RouteGuard: signed-out users go to login; permissions are an any-of list. */
function Guard({ permissions, children }) {
  const { user, loading } = useSession();
  const { pathname, navigate } = useRouter();

  useEffect(() => {
    if (loading || user) return;
    navigate(`${ROUTES.LOGIN}?next=${encodeURIComponent(pathname)}`, { replace: true });
  }, [loading, user, pathname, navigate]);

  if (loading) return <Box sx={centered}><CircularProgress /></Box>;
  if (!user) return null;
  return (
    <Layout>
      {permissions && !hasAnyPermission(user, permissions)
        ? <Alert severity="warning">You do not have permission to view this page.</Alert>
        : children}
    </Layout>
  );
}

const guarded = (path, render) => ({
  path,
  element: (params) => <Guard permissions={ROUTE_PERMISSIONS[path]}>{render(params)}</Guard>,
});

/** "/" sends a signed-in user to the dashboard and everyone else to login. */
function Home() {
  const { navigate } = useRouter();
  const { user, loading } = useSession();
  useEffect(() => {
    if (!loading) navigate(user ? ROUTES.DASHBOARD : ROUTES.LOGIN, { replace: true });
  }, [loading, user, navigate]);
  return <Box sx={centered}><CircularProgress /></Box>;
}

const routes = [
  { path: ROUTES.LOGIN, element: () => <Login /> },
  { path: ROUTES.REGISTER, element: () => <Register /> },
  { path: ROUTES.FORGOT_PASSWORD, element: () => <ForgotPassword /> },
  { path: ROUTES.RESET_PASSWORD, element: () => <ResetPassword /> },
  { path: ROUTES.HOME, element: () => <Home /> },
  guarded(ROUTES.DASHBOARD, () => <Dashboard />),
  guarded(ROUTES.PROFILE, () => <Profile />),
  guarded(ROUTES.USERS, () => <Users />),
  guarded(ROUTES.PROJECTS, () => <Projects />),
  guarded(ROUTES.PROJECT, ({ id }) => <ProjectDetails key={id} id={Number(id)} />),
  guarded(ROUTES.TASKS, () => <Tasks />),
  guarded(ROUTES.TASK, ({ id }) => <TaskDetails key={id} id={Number(id)} />),
  guarded(ROUTES.MY_TASKS, () => <MyTasks />),
  guarded(ROUTES.NOTIFICATIONS, () => <Notifications />),
];

const notFound = (
  <Guard>
    <Alert severity="info">
      This page does not exist. <NavLink to={ROUTES.DASHBOARD}>Back to the dashboard</NavLink>
    </Alert>
  </Guard>
);

export default function MaterialApp() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes routes={routes} fallback={notFound} />
    </ThemeProvider>
  );
}
