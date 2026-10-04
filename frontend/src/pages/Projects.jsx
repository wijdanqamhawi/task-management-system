/* Project list (FR-015). New project is offered to Manager and Admin only (FR-008b). */
import { useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import ProjectForm from '../components/ProjectForm.jsx';
import { Badge, Button, Table } from '../components/index.jsx';
import { Async, PageHeader, Pagination } from '../components/common.jsx';
import { Link } from '../router/Link.jsx';
import { useRouter } from '../router/Router.jsx';
import { useApi } from '../hooks/useApi.js';
import { useSession } from '../auth/SessionContext.jsx';
import { createProject, listProjects } from '../api/projects.js';
import { PROJECT_STATUS_LABELS } from '../constants.js';
import { canCreateProject } from '../utils/permissions.js';
import { fmtDate } from '../utils/format.js';

export default function Projects() {
  const { user } = useSession();
  const { navigate } = useRouter();
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const state = useApi((signal) => listProjects({ page, size: 12 }, { signal }), [page]);

  const columns = [
    { key: 'name', header: 'Project',
      render: (p) => <Link to={`/projects/${p.projectId}`} className="text-link">{p.name}</Link> },
    { key: 'status', header: 'Status',
      render: (p) => <Badge value={p.status}>{PROJECT_STATUS_LABELS[p.status]}</Badge> },
    { key: 'startDate', header: 'Start', render: (p) => fmtDate(p.startDate) },
    { key: 'endDate', header: 'End', render: (p) => fmtDate(p.endDate) },
    { key: 'memberCount', header: 'Members' },
  ];

  async function onCreate(body) {
    const project = await createProject(body);
    navigate(`/projects/${project.projectId}`);
  }

  return (
    <AppLayout title="Projects">
      <PageHeader
        title={user.role === 'ADMIN' ? 'All projects' : 'Your projects'}
        subtitle="Projects you are a member of."
        actions={canCreateProject(user) && <Button variant="primary" onClick={() => setCreating(true)}>New project</Button>}
      />
      <section className="panel">
        <Async state={state}>
          {(data) => (
            <>
              <Table columns={columns} rows={data.content.map((p) => ({ ...p, id: p.projectId }))}
                     empty={canCreateProject(user) ? 'No projects yet. Create the first one.' : 'You are not a member of any project yet.'} />
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPage={setPage} />
            </>
          )}
        </Async>
      </section>
      {creating && <ProjectForm onSubmit={onCreate} onClose={() => setCreating(false)} />}
    </AppLayout>
  );
}
