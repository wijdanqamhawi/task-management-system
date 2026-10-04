/*
 * One task table for the Tasks, My Tasks and Dashboard screens, so a task looks and behaves the
 * same everywhere. The status control is a select offering the four official statuses, so a
 * status change is reachable from the list in two interactions (open, choose; FR-034, SC-004).
 */
import { useState } from 'react';
import { Badge, Table } from './index.jsx';
import { Notice, StatusSelect } from './common.jsx';
import { Link } from '../router/Link.jsx';
import { changeStatus } from '../api/tasks.js';
import { PRIORITY_LABELS, STATUS_LABELS } from '../constants.js';
import { canChangeStatus } from '../utils/permissions.js';
import { errorMessage, fmtDate } from '../utils/format.js';

export default function TaskTable({ tasks, user, managedIds, onChanged, empty, shared = false, showProject = true }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  async function onStatus(task, status) {
    setBusyId(task.taskId);
    setError('');
    try {
      await changeStatus(task.taskId, status);
      onChanged?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  const columns = [
    { key: 'title', header: 'Task',
      render: (t) => (
        <>
          <Link to={`/tasks/${t.taskId}`} className="text-link">{t.title}</Link>
          {t.overdue && <Badge kind="overdue">Overdue</Badge>}
          {shared && <Badge kind="shared">Shared</Badge>}
        </>
      ) },
    ...(showProject ? [{ key: 'projectName', header: 'Project',
      render: (t) => <Link to={`/projects/${t.projectId}`} className="text-link">{t.projectName}</Link> }] : []),
    { key: 'assignees', header: 'Assigned to',
      render: (t) => (t.assignees.length ? t.assignees.map((a) => a.fullName).join(', ') : <span className="muted">Unassigned</span>) },
    { key: 'priority', header: 'Priority',
      render: (t) => <Badge value={t.priority}>{PRIORITY_LABELS[t.priority]}</Badge> },
    { key: 'status', header: 'Status',
      render: (t) => (canChangeStatus(user, t, managedIds)
        ? <StatusSelect value={t.status} disabled={busyId === t.taskId}
                        label={`Status of ${t.title}`} onChange={(s) => onStatus(t, s)} />
        : <Badge value={t.status}>{STATUS_LABELS[t.status]}</Badge>) },
    { key: 'dueDate', header: 'Due', render: (t) => <span style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.dueDate)}</span> },
  ];

  return (
    <>
      <Notice onClose={() => setError('')}>{error}</Notice>
      <Table columns={columns} rows={tasks.map((t) => ({ ...t, id: t.taskId }))} empty={empty} />
    </>
  );
}
