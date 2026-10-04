/*
 * My tasks: tasks assigned to me, and tasks shared with me (FR-030, FR-031, FR-035, FR-035a).
 * "Shared" means a task in a project I belong to that is not assigned to me. The two groups
 * are separate panels and shared rows carry a dashed "Shared" badge so they are never confused.
 */
import { useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import TaskTable from '../components/TaskTable.jsx';
import { Async, PageHeader, Pagination } from '../components/common.jsx';
import { useApi } from '../hooks/useApi.js';
import { useVisibleProjects } from '../hooks/useVisibleProjects.js';
import { useSession } from '../auth/SessionContext.jsx';
import { assignedToMe, sharedWithMe } from '../api/tasks.js';

function Group({ title, hint, loader, user, managedIds, shared, empty }) {
  const [page, setPage] = useState(0);
  const state = useApi((signal) => loader({ page, size: 10, sort: 'dueDate' }, { signal }), [page]);
  return (
    <section className="panel" aria-label={title}>
      <h3 className="panel__title">{title}</h3>
      <p className="muted small">{hint}</p>
      <Async state={state}>
        {(data) => (
          <>
            <TaskTable tasks={data.content} user={user} managedIds={managedIds} shared={shared}
                       onChanged={state.reload} empty={empty} />
            <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPage={setPage} />
          </>
        )}
      </Async>
    </section>
  );
}

export default function MyTasks() {
  const { user } = useSession();
  const visible = useVisibleProjects();
  return (
    <AppLayout title="My Tasks">
      <PageHeader title="My tasks" subtitle="Work assigned to you, and work shared with you through your projects." />
      <Group title="Assigned to me" hint="Tasks you are responsible for."
             loader={assignedToMe} user={user} managedIds={visible.ids} empty="Nothing is assigned to you right now." />
      <Group title="Shared with me" hint="Tasks in your projects that are assigned to someone else."
             loader={sharedWithMe} user={user} managedIds={visible.ids} shared empty="No other tasks in your projects." />
    </AppLayout>
  );
}
