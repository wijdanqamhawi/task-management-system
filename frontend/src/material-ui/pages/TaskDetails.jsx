import { Avatar, Box, Button, Card, CardContent, CardHeader, Checkbox, Divider, FormControlLabel, Grid, List, ListItem, ListItemAvatar, ListItemIcon, ListItemText, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import HistoryIcon from '@mui/icons-material/History';
import EventIcon from '@mui/icons-material/EventOutlined';
import { projects, taskExtras, tasks } from '../mockData.js';
import { PageHeader, PriorityChip, StatusChip, UserAvatar, userById } from '../shared.jsx';

export default function TaskDetails({ taskId, onBack }) {
  const task = tasks.find((t) => t.id === taskId);
  const project = projects.find((p) => p.id === task.projectId);

  return (
    <>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }}>
        Back
      </Button>
      <PageHeader title={task.title} subtitle={project.title} />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            <Card>
              <CardHeader title="Description" slotProps={{ title: { variant: 'h6' } }} />
              <Divider />
              <CardContent>
                <Typography>{task.description}</Typography>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Subtasks" slotProps={{ title: { variant: 'h6' } }} />
              <Divider />
              <CardContent>
                <Stack>
                  {taskExtras.subtasks.map((s) => (
                    <FormControlLabel key={s.id} control={<Checkbox defaultChecked={s.done} />} label={s.title} />
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Comments" slotProps={{ title: { variant: 'h6' } }} />
              <Divider />
              <List>
                {taskExtras.comments.map((c) => (
                  <ListItem key={c.id} alignItems="flex-start">
                    <ListItemAvatar>
                      <UserAvatar userId={c.userId} size={36} />
                    </ListItemAvatar>
                    <ListItemText primary={`${userById(c.userId).fullName} · ${c.at}`} secondary={c.text} slotProps={{ primary: { fontWeight: 600, variant: 'body2' }, secondary: { color: 'text.primary', sx: { mt: 0.5 } } }} />
                  </ListItem>
                ))}
              </List>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Detail label="Status"><StatusChip status={task.status} /></Detail>
                  <Detail label="Priority"><PriorityChip priority={task.priority} /></Detail>
                  <Detail label="Due date">
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      <EventIcon fontSize="small" color="action" />
                      <Typography>{task.due}</Typography>
                    </Stack>
                  </Detail>
                  <Detail label="Assignees">
                    <Stack spacing={1}>
                      {task.assignees.map((id) => (
                        <Stack key={id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <UserAvatar userId={id} />
                          <Typography>{userById(id).fullName}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Detail>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Attachments" slotProps={{ title: { variant: 'h6' } }} />
              <Divider />
              <List>
                {taskExtras.attachments.map((a) => (
                  <ListItem key={a.id}>
                    <ListItemIcon><AttachFileIcon /></ListItemIcon>
                    <ListItemText primary={a.name} secondary={a.size} />
                  </ListItem>
                ))}
              </List>
            </Card>

            <Card>
              <CardHeader title="Activity" slotProps={{ title: { variant: 'h6' } }} />
              <Divider />
              <List>
                {taskExtras.activity.map((a) => (
                  <ListItem key={a.id}>
                    <ListItemIcon>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.light', color: 'primary.main' }}><HistoryIcon fontSize="small" /></Avatar>
                    </ListItemIcon>
                    <ListItemText primary={a.text} secondary={a.at} slotProps={{ primary: { variant: 'body2' } }} />
                  </ListItem>
                ))}
              </List>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </>
  );
}

function Detail({ label, children }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}
