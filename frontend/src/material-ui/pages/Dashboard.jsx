import { Box, Card, CardContent, CardHeader, Divider, Grid, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import TaskIcon from '@mui/icons-material/TaskAltOutlined';
import PendingIcon from '@mui/icons-material/AutorenewOutlined';
import DoneIcon from '@mui/icons-material/CheckCircleOutlined';
import OverdueIcon from '@mui/icons-material/ErrorOutlined';
import { projects, tasks } from '../mockData.js';
import { PageHeader, PriorityChip, ProgressBar, StatusChip } from '../shared.jsx';

const TODAY = '2026-10-20';

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

export default function Dashboard({ onOpenTask, onOpenProject }) {
  const overdue = tasks.filter((t) => t.status !== 'DONE' && t.due < TODAY).length;
  const stats = [
    { label: 'Total Tasks', value: tasks.length, icon: <TaskIcon />, color: 'primary' },
    { label: 'In Progress', value: tasks.filter((t) => t.status === 'IN_PROGRESS').length, icon: <PendingIcon />, color: 'info' },
    { label: 'Completed', value: tasks.filter((t) => t.status === 'DONE').length, icon: <DoneIcon />, color: 'success' },
    { label: 'Overdue', value: overdue, icon: <OverdueIcon />, color: 'error' },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of your tasks and projects" />
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
            <List disablePadding>
              {tasks.slice(0, 6).map((t, i) => (
                <ListItemButton key={t.id} divider={i < 5} onClick={() => onOpenTask(t.id)} sx={{ py: 1.5, gap: 1.5 }}>
                  <ListItemText
                    primary={t.title}
                    secondary={projects.find((p) => p.id === t.projectId).title}
                    slotProps={{ primary: { fontWeight: 600 } }}
                  />
                  <PriorityChip priority={t.priority} />
                  <StatusChip status={t.status} />
                </ListItemButton>
              ))}
            </List>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Card>
            <CardHeader title="Project Progress" slotProps={{ title: { variant: 'h6' } }} />
            <Divider />
            <CardContent>
              <Stack spacing={3}>
                {projects.map((p) => (
                  <Box key={p.id} onClick={() => onOpenProject(p.id)} sx={{ cursor: 'pointer' }}>
                    <Typography fontWeight={600} sx={{ mb: 0.75 }}>
                      {p.title}
                    </Typography>
                    <ProgressBar value={p.progress} />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
