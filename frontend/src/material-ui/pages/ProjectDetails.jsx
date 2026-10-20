import { Box, Button, Card, CardContent, CardHeader, Divider, Grid, List, ListItem, ListItemAvatar, ListItemText, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PersonAddIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { projects, STATUSES, STATUS_LABEL, tasks } from '../mockData.js';
import { PageHeader, PriorityChip, ProgressBar, ProjectStatusChip, RoleChip, UserAvatar, userById } from '../shared.jsx';

export default function ProjectDetails({ projectId, onBack, onOpenTask }) {
  const project = projects.find((p) => p.id === projectId);
  const projectTasks = tasks.filter((t) => t.projectId === projectId);

  return (
    <>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }}>
        Back to projects
      </Button>
      <PageHeader
        title={project.title}
        subtitle={project.description}
        action={
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" startIcon={<PersonAddIcon />}>
              Add Member
            </Button>
            <Button variant="contained" startIcon={<AddIcon />}>
              Create Task
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ mb: 3 }}>
            <CardHeader title="Overview" slotProps={{ title: { variant: 'h6' } }} action={<ProjectStatusChip status={project.status} />} />
            <Divider />
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Overall progress
              </Typography>
              <ProgressBar value={project.progress} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {projectTasks.filter((t) => t.status === 'DONE').length} of {projectTasks.length} tasks completed
              </Typography>
            </CardContent>
          </Card>

          <Grid container spacing={2}>
            {STATUSES.map((status) => {
              const list = projectTasks.filter((t) => t.status === status);
              return (
                <Grid size={{ xs: 12, sm: 6 }} key={status}>
                  <Card sx={{ bgcolor: '#f9fafb', height: '100%' }}>
                    <CardContent>
                      <Typography fontWeight={700} sx={{ mb: 1.5 }}>
                        {STATUS_LABEL[status]} ({list.length})
                      </Typography>
                      <Stack spacing={1.5}>
                        {list.length === 0 && (
                          <Typography variant="body2" color="text.secondary">
                            No tasks
                          </Typography>
                        )}
                        {list.map((t) => (
                          <Card key={t.id} onClick={() => onOpenTask(t.id)} sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}>
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                              <Typography fontWeight={600} sx={{ mb: 1 }}>
                                {t.title}
                              </Typography>
                              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                                <PriorityChip priority={t.priority} />
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  {t.assignees.map((id) => (
                                    <UserAvatar key={id} userId={id} size={24} />
                                  ))}
                                </Box>
                              </Stack>
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardHeader title="Team Members" slotProps={{ title: { variant: 'h6' } }} />
            <Divider />
            <List>
              {project.members.map((id) => (
                <ListItem key={id} secondaryAction={<RoleChip role={userById(id).role} />}>
                  <ListItemAvatar>
                    <UserAvatar userId={id} size={36} />
                  </ListItemAvatar>
                  <ListItemText primary={userById(id).fullName} secondary={userById(id).email} slotProps={{ primary: { fontWeight: 600 } }} />
                </ListItem>
              ))}
            </List>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
