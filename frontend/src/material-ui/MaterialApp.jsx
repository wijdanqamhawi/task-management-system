import { useState } from 'react';
import { Box, Button, Card, CardContent, CssBaseline, ThemeProvider, Typography } from '@mui/material';
import { theme } from './theme.js';
import Layout from './Layout.jsx';
import { currentUser, notifications as initialNotifications } from './mockData.js';
import Dashboard from './pages/Dashboard.jsx';
import Projects from './pages/Projects.jsx';
import ProjectDetails from './pages/ProjectDetails.jsx';
import Tasks from './pages/Tasks.jsx';
import MyTasks from './pages/MyTasks.jsx';
import TaskDetails from './pages/TaskDetails.jsx';
import Notifications from './pages/Notifications.jsx';
import Users from './pages/Users.jsx';
import Profile from './pages/Profile.jsx';

// Isolated preview: navigation is plain component state, so the app's real router is untouched.
export default function MaterialApp() {
  const [view, setView] = useState({ page: 'dashboard' });
  const [items, setItems] = useState(initialNotifications);

  const go = (page, id) => setView({ page, id });
  const unread = items.filter((n) => !n.read).length;

  let content;
  switch (view.page) {
    case 'dashboard':
      content = <Dashboard onOpenTask={(id) => go('task', id)} onOpenProject={(id) => go('project', id)} />;
      break;
    case 'projects':
      content = <Projects onOpenProject={(id) => go('project', id)} />;
      break;
    case 'project':
      content = <ProjectDetails projectId={view.id} onBack={() => go('projects')} onOpenTask={(id) => go('task', id)} />;
      break;
    case 'tasks':
      content = <Tasks onOpenTask={(id) => go('task', id)} />;
      break;
    case 'my-tasks':
      content = <MyTasks onOpenTask={(id) => go('task', id)} />;
      break;
    case 'task':
      content = <TaskDetails taskId={view.id} onBack={() => go('tasks')} />;
      break;
    case 'notifications':
      content = (
        <Notifications
          items={items}
          onMarkRead={(id) => setItems((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n)))}
          onMarkAllRead={() => setItems((l) => l.map((n) => ({ ...n, read: true })))}
        />
      );
      break;
    case 'users':
      content = <Users />;
      break;
    case 'profile':
      content = <Profile user={currentUser} />;
      break;
    default:
      content = (
        <Card sx={{ maxWidth: 480, mx: 'auto', mt: 8 }}>
          <CardContent sx={{ textAlign: 'center', py: 5 }}>
            <Typography variant="h6">You have been logged out</Typography>
            <Typography color="text.secondary" sx={{ my: 1.5 }}>
              This is a design preview; no real session exists.
            </Typography>
            <Button variant="contained" onClick={() => go('dashboard')}>
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Layout page={view.page} onNavigate={(page) => go(page)} unread={unread} user={currentUser}>
        <Box sx={{ maxWidth: 1280, mx: 'auto' }}>{content}</Box>
      </Layout>
    </ThemeProvider>
  );
}
