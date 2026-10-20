import { useState } from 'react';
import { Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { currentUser, projects, STATUSES, STATUS_LABEL, tasks } from '../mockData.js';
import { PageHeader, PriorityChip } from '../shared.jsx';

export default function MyTasks({ onOpenTask }) {
  // Local-only status changes so the controls feel real in the preview.
  const [statuses, setStatuses] = useState(() => Object.fromEntries(tasks.map((t) => [t.id, t.status])));
  const mine = tasks.filter((t) => t.assignees.includes(currentUser.id));

  return (
    <>
      <PageHeader title="My Tasks" subtitle={`${mine.length} tasks assigned to ${currentUser.fullName}`} />
      <Stack spacing={2}>
        {mine.map((t) => (
          <Card key={t.id}>
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
                <Stack spacing={0.5} onClick={() => onOpenTask(t.id)} sx={{ cursor: 'pointer', flex: 1 }}>
                  <Typography variant="h6">{t.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {projects.find((p) => p.id === t.projectId).title} · Due {t.due}
                  </Typography>
                </Stack>
                <PriorityChip priority={t.priority} />
                <TextField
                  select
                  size="small"
                  label="Status"
                  value={statuses[t.id]}
                  onChange={(e) => setStatuses((s) => ({ ...s, [t.id]: e.target.value }))}
                  sx={{ minWidth: 170 }}
                >
                  {STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>{STATUS_LABEL[s]}</MenuItem>
                  ))}
                </TextField>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </>
  );
}
