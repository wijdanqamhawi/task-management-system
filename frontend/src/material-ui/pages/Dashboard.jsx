import { Box, Card, CardContent, CardHeader, Divider, Grid, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import TaskIcon from '@mui/icons-material/TaskAltOutlined';
import PendingIcon from '@mui/icons-material/AutorenewOutlined';
import DoneIcon from '@mui/icons-material/CheckCircleOutlined';
import OverdueIcon from '@mui/icons-material/ErrorOutlined';
import { AsyncView, PageHeader, PriorityChip, ProgressBar, StatusChip } from '../shared.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSession } from '../../auth/SessionContext.jsx';
import { useRouter } from '../../router/Router.jsx';
import { getDashboard } from '../../api/dashboard.js';
import { searchTasks } from '../../api/tasks.js';

function StatCard({ label, value, icon, color }) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography color="text.secondary" variant="body2" fontWeight={600}>
              {label}
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>
              {value}
            </Typography>
          </Box>
          <Box sx={{ width: 48, height: 48, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: `${color}.light`, color: `${color}.main` }}>
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useSession();
  const { navigate } = useRouter();
  // The same two calls as the Original dashboard: figures from /dashboard, recent tasks from /tasks.
  const dashboard = useApi((signal) => getDashboard({ signal }), []);
  const recent = useApi((signal) => searchTasks({ size: 6, sort: 'createdAt,desc' }, { signal }), []);

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Welcome, ${user.fullName ?? user.username}. Figures cover the projects you can see.`} />
      <AsyncView state={dashboard}>
        {(d) => {
          const stats = [
            { label: 'Total Tasks', value: d.totalTasks, icon: <TaskIcon />, color: 'primary' },
            { label: 'In Progress', value: d.tasksByStatus?.IN_PROGRESS ?? 0, icon: <PendingIcon />, color: 'info' },
            { label: 'Completed', value: d.completedTasks, icon: <DoneIcon />, color: 'success' },
            { label: 'Overdue', value: d.overdueTasks, icon: <OverdueIcon />, color: 'error' },
          ];
          return (
            <Grid container spacing={3}>
              {stats.map((s) => (
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={s.label}>
                  <StatCard {...s} />
                </Grid>
              ))}

              <Grid size={{ xs: 12, lg: 7 }}>
                <Card>
                  <CardHeader title="Recent Tasks" slotProps={{ title: { variant: 'h6' } }} />
                  <Divider />
                  <AsyncView state={recent}>
                    {(page) => (
                      <List disablePadding>
                        {page.content.length === 0 && <Typography color="text.secondary" sx={{ p: 2 }}>No tasks yet.</Typography>}
                        {page.content.map((t, i) => (
                          <ListItemButton key={t.taskId} divider={i < page.content.length - 1} onClick={() => navigate(`/tasks/${t.taskId}`)} sx={{ py: 1.5, gap: 1.5 }}>
                            <ListItemText primary={t.title} secondary={t.projectName} slotProps={{ primary: { fontWeight: 600 } }} />
                            <PriorityChip priority={t.priority} />
                            <StatusChip status={t.status} />
                          </ListItemButton>
                        ))}
                      </List>
                    )}
                  </AsyncView>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, lg: 5 }}>
                <Card>
                  <CardHeader title="Project Progress" slotProps={{ title: { variant: 'h6' } }} />
                  <Divider />
                  <CardContent>
                    <Stack spacing={3}>
                      {d.projectProgress.length === 0 && <Typography color="text.secondary">No projects yet.</Typography>}
                      {d.projectProgress.map((p) => (
                        <Box key={p.projectId} onClick={() => navigate(`/projects/${p.projectId}`)} sx={{ cursor: 'pointer' }}>
                          <Typography fontWeight={600} sx={{ mb: 0.75 }}>
                            {p.name}
                          </Typography>
                          <ProgressBar value={p.percentComplete} />
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          );
        }}
      </AsyncView>
    </>
  );
}
