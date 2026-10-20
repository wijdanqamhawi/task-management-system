import { Button, Card, CardActionArea, CardContent, Grid, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { projects } from '../mockData.js';
import { MemberAvatars, PageHeader, ProgressBar, ProjectStatusChip } from '../shared.jsx';

export default function Projects({ onOpenProject }) {
  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} projects in your workspace`}
        action={
          <Button variant="contained" startIcon={<AddIcon />}>
            Create Project
          </Button>
        }
      />
      <Grid container spacing={3}>
        {projects.map((p) => (
          <Grid size={{ xs: 12, md: 6, xl: 4 }} key={p.id}>
            <Card sx={{ height: '100%' }}>
              <CardActionArea onClick={() => onOpenProject(p.id)} sx={{ height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="h6">{p.title}</Typography>
                    <ProjectStatusChip status={p.status} />
                  </Stack>
                  <Typography color="text.secondary" sx={{ my: 1.5, minHeight: 48 }}>
                    {p.description}
                  </Typography>
                  <ProgressBar value={p.progress} />
                  <Stack direction="row" sx={{ mt: 2, justifyContent: 'space-between', alignItems: 'center' }}>
                    <MemberAvatars ids={p.members} />
                    <Typography variant="body2" color="text.secondary">
                      {p.members.length} members
                    </Typography>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
