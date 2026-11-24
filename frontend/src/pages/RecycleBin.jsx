/*
 * Recycle Bin: soft-deleted tasks, with search and Restore (RECYCLE_BIN_VIEW, TASK_RESTORE).
 *
 * The API decides what is listed: ADMIN sees every project, a MANAGER only the projects they
 * belong to, and a MEMBER is refused (and never sees the sidebar link). There is no permanent
 * delete here or anywhere else: a task leaves the bin only by being restored.
 * Restoring unassigns any assignee who is deactivated or no longer in the project; the API
 * reports who, and that is shown to the user in the success toast.
 */
import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import { Button, Field, Table, TextInput } from '../components/index.jsx';
import { Async, ConfirmDialog, PageHeader, Pagination } from '../components/common.jsx';
import { useToast } from '../components/Toast.jsx';
import { Link } from '../router/Link.jsx';
import { useApi } from '../hooks/useApi.js';
import { useSession } from '../auth/SessionContext.jsx';
import { listDeletedTasks, restoreTask } from '../api/recycleBin.js';
import { canRestoreTask } from '../utils/permissions.js';
import { errorMessage, fmtDateTime } from '../utils/format.js';

const PAGE_SIZE = 15;

export default function RecycleBin() {
  const { user } = useSession();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [restoring, setRestoring] = useState(null);     // the row awaiting confirmation
  const [busy, setBusy] = useState(false);

  // Search as you type, after a short pause, and always from the first page.
  useEffect(() => {
    const id = setTimeout(() => { setSearch(draft.trim()); setPage(0); }, 300);
    return () => clearTimeout(id);
  }, [draft]);

  const state = useApi((signal) => listDeletedTasks({ search, page, size: PAGE_SIZE }, { signal }),
    [search, page]);
  const mayRestore = canRestoreTask(user);

  async function confirmRestore() {
    const task = restoring;
    setBusy(true);
    try {
      const { removedAssignees = [] } = await restoreTask(task.taskId);
      if (removedAssignees.length > 0) {
        toast.warning(
          `"${task.title}" was restored. Unassigned because they can no longer hold it: `
          + removedAssignees.map((a) => `${a.fullName} (${a.reason})`).join('; ') + '.');
      } else {
        toast.success(`"${task.title}" was restored.`);
      }
    } catch (e) {
      toast.error(errorMessage(e));       // e.g. someone else restored it first
    } finally {
      setBusy(false);
      setRestoring(null);
      if (state.data && state.data.content.length === 1 && page > 0) setPage(page - 1);
      else state.reload();
    }
  }

  const columns = [
    { key: 'title', header: 'Task', render: (t) => <strong>{t.title}</strong> },
    { key: 'projectName', header: 'Project',
      render: (t) => <Link to={`/projects/${t.projectId}`} className="text-link">{t.projectName}</Link> },
    { key: 'deletedAt', header: 'Deleted', render: (t) => <span style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(t.deletedAt)}</span> },
    { key: 'deletedByName', header: 'Deleted by', render: (t) => t.deletedByName ?? <span className="muted">Unknown</span> },
    ...(mayRestore ? [{ key: 'actions', header: <span className="sr-only">Actions</span>,
      render: (t) => (
        <Button type="button" aria-label={`Restore ${t.title}`} onClick={() => setRestoring(t)}>Restore</Button>
      ) }] : []),
  ];

  return (
    <AppLayout title="Recycle Bin">
      <PageHeader title="Recycle Bin"
        subtitle="Deleted tasks are kept here with their progress, comments, attachments and assignments. Restore one to bring it back." />

      <section className="panel">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(draft.trim()); setPage(0); }}
              aria-label="Search the Recycle Bin">
          <div className="toolbar">
            <Field label="Search deleted tasks">
              <TextInput type="search" value={draft} onChange={(e) => setDraft(e.target.value)}
                         placeholder="Task title or project name" />
            </Field>
            <div className="toolbar__actions">
              <Button type="button" onClick={() => setDraft('')} disabled={!draft}>Clear</Button>
            </div>
          </div>
        </form>

        <Async state={state}>
          {(data) => (
            <>
              <Table columns={columns} rows={data.content.map((t) => ({ ...t, id: t.taskId }))}
                     empty={search ? 'No deleted tasks match your search.' : 'The Recycle Bin is empty.'} />
              <Pagination page={data.page} totalPages={data.totalPages}
                          totalElements={data.totalElements} onPage={setPage} />
            </>
          )}
        </Async>
      </section>

      {restoring && (
        <ConfirmDialog title="Restore task" confirmLabel="Restore" busy={busy}
          message={`Restore "${restoring.title}" to ${restoring.projectName}? It returns with its progress, comments, attachments and assignments. Anyone who is deactivated or no longer in the project is unassigned.`}
          onCancel={() => setRestoring(null)} onConfirm={confirmRestore} />
      )}
    </AppLayout>
  );
}
