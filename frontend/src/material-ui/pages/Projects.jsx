import { useState } from 'react';
import { Button, Card, CardActionArea, CardContent, Grid, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { AsyncView, PagerBar, PageHeader, ProgressBar, ProjectStatusChip } from '../shared.jsx';
import { ProjectDialog } from '../dialogs.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSession } from '../../auth/SessionContext.jsx';
import { useRouter } from '../../router/Router.jsx';
import { createProject, listProjects } from '../../api/projects.js';
import { getDashboard } from '../../api/dashboard.js';
import { canCreateProject, canViewAllProjects } from '../../utils/permissions.js';

export default function Projects() {
  const { user } = useSession();
  const { navigate } = useRouter();
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const state = useApi((signal) => listProjects({ page, size: 12 }, { signal }), [page]);
  // Progress per project comes from the dashboard figures (one call), not one request per card.
  const dashboard = useApi((signal) => getDashboard({ signal }), []);
  const progress = new Map((dashboard.data?.projectProgress ?? []).map((p) => [p.projectId, p.percentComplete]));

  async function onCreate(body) {
    const project = await createProject(body);
    navigate(`/projects/${project.projectId}`);
  }

  return (
    <>
      <PageHeader
        title={canViewAllProjects(user) ? 'All projects' : 'Your projects'}
        subtitle="Projects you are a member of."
        action={canCreateProject(user) && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
            Create Project
          </Button>
        )}
      />
      <AsyncView state={state}>
        {(data) => (
          <>
            {data.content.length === 0 && (
              <Typography color="text.secondary">
                {canCreateProject(user) ? 'No projects yet. Create the first one.' : 'You are not a member of any project yet.'}
              </Typography>
            )}
            <Grid container spacing={3}>
              {data.content.map((p) => (
                <Grid size={{ xs: 12, md: 6, xl: 4 }} key={p.projectId}>
                  <Card sx={{ height: '100%' }}>
                    <CardActionArea onClick={() => navigate(`/projects/${p.projectId}`)} sx={{ height: '100%' }}>
                      <CardContent sx={{ p: 3 }}>
                        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Typography variant="h6">{p.name}</Typography>
                          <ProjectStatusChip status={p.status} />
                        </Stack>
                        <Typography color="text.secondary" sx={{ my: 1.5, minHeight: 48 }}>
                          {p.description}
                        </Typography>
                        {progress.has(p.projectId) && <ProgressBar value={progress.get(p.projectId)} />}
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                          {p.memberCount} {p.memberCount === 1 ? 'member' : 'members'}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <PagerBar data={data} onPage={setPage} />
          </>
        )}
      </AsyncView>
      {creating && <ProjectDialog onSubmit={onCreate} onClose={() => setCreating(false)} />}
    </>
  );
}
