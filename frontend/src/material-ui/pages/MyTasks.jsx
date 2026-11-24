import { useState } from 'react';
import { Alert, Card, CardContent, Stack, Typography } from '@mui/material';
import { AsyncView, PagerBar, PageHeader, PriorityChip, TaskStatus } from '../shared.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useVisibleProjects } from '../../hooks/useVisibleProjects.js';
import { useSession } from '../../auth/SessionContext.jsx';
import { useRouter } from '../../router/Router.jsx';
import { assignedToMe, sharedWithMe } from '../../api/tasks.js';
import { fmtDate } from '../../utils/format.js';

function Group({ title, hint, loader, empty, user, managedIds }) {
  const { navigate } = useRouter();
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const state = useApi((signal) => loader({ page, size: 10, sort: 'dueDate' }, { signal }), [page]);

  return (
    <section aria-label={title}>
      <Typography variant="h6">{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{hint}</Typography>
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      <AsyncView state={state}>
        {(data) => (
          <>
            {data.content.length === 0 && <Typography color="text.secondary">{empty}</Typography>}
            <Stack spacing={2}>
              {data.content.map((t) => (
                <Card key={t.taskId}>
                  <CardContent>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
                      <Stack spacing={0.5} onClick={() => navigate(`/tasks/${t.taskId}`)} sx={{ cursor: 'pointer', flex: 1 }}>
                        <Typography variant="h6">{t.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t.projectName} · Due {fmtDate(t.dueDate)}{t.overdue ? ' · Overdue' : ''}
                        </Typography>
                      </Stack>
                      <PriorityChip priority={t.priority} />
                      <TaskStatus task={t} user={user} managedIds={managedIds} onChanged={state.reload} onError={setError} />
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
            <PagerBar data={data} onPage={setPage} />
          </>
        )}
      </AsyncView>
    </section>
  );
}

export default function MyTasks() {
  const { user } = useSession();
  const visible = useVisibleProjects();
  return (
    <>
      <PageHeader title="My Tasks" subtitle="Work assigned to you, and work shared with you through your projects." />
      <Stack spacing={5}>
        <Group title="Assigned to me" hint="Tasks you are responsible for." loader={assignedToMe} empty="Nothing is assigned to you right now." user={user} managedIds={visible.ids} />
        <Group title="Shared with me" hint="Tasks in your projects that are assigned to someone else." loader={sharedWithMe} empty="No other tasks in your projects." user={user} managedIds={visible.ids} />
      </Stack>
    </>
  );
}
