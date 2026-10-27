/*
 * Performance card for the Dashboard: completion and schedule figures for one user, from
 * GET /api/performance. Tasks without enough timing data are shown as "Not evaluable" and are
 * left out of the schedule figures. The user selector only appears for users who hold TASK_ASSIGN
 * or PROJECT_VIEW_ALL; the API enforces the same rule.
 */
import { useState } from 'react';
import { Badge, Select, Table } from './index.jsx';
import { Async } from './common.jsx';
import { useApi } from '../hooks/useApi.js';
import { getMyPerformance, getUserPerformance } from '../api/performance.js';
import { fmtDate } from '../utils/format.js';

const SCHEDULE_BADGE = { EARLY: 'Early', ON_TIME: 'On Time', LATE: 'Late', NOT_EVALUABLE: 'Not evaluable' };
const pct = (v) => (v == null ? '—' : `${v}%`);
const days = (v) => (v == null ? '—' : `${v} ${v === 1 ? 'day' : 'days'}`);

function Metric({ label, value }) {
  return (
    <div className="perf__metric">
      <p className="perf__metric-value">{value}</p>
      <p className="perf__metric-label">{label}</p>
    </div>
  );
}

const COLUMNS = [
  { key: 'title', header: 'Task', render: (t) => <strong>{t.title}</strong> },
  { key: 'planned', header: 'Planned', render: (t) => days(t.plannedDuration) },
  { key: 'actual', header: 'Actual', render: (t) => days(t.actualDuration) },
  { key: 'completedAt', header: 'Completed', render: (t) => fmtDate(t.completedAt) },
  { key: 'difference', header: 'Difference', render: (t) => (t.scheduleStatus === 'NOT_EVALUABLE' ? '—' : t.scheduleLabel) },
  { key: 'schedule', header: 'Schedule',
    render: (t) => <Badge value={t.scheduleStatus}>{SCHEDULE_BADGE[t.scheduleStatus]}</Badge> },
  { key: 'progress', header: 'Progress', render: (t) => `${t.progressPercent}%` },
];

/** `people` is [{userId, fullName}] the viewer may select; null/empty hides the selector. */
export default function PerformancePanel({ me, people }) {
  const [selected, setSelected] = useState(me.userId);
  const state = useApi(
    (signal) => (selected === me.userId ? getMyPerformance({ signal }) : getUserPerformance(selected, { signal })),
    [selected]);
  const options = people ?? [];

  return (
    <div className="dash__panel dash__panel--wide perf">
      <div className="perf__head">
        <h2 className="dash__panel-title">Performance</h2>
        {options.length > 0 && (
          <Select aria-label="Select user" value={selected} onChange={(e) => setSelected(Number(e.target.value))}
                  options={options.map((p) => ({ value: p.userId, label: p.userId === me.userId ? `${p.fullName} (me)` : p.fullName }))} />
        )}
      </div>
      <Async state={state}>
        {(p) => (
          <>
            <p className="muted small">{p.fullName}: {p.summary}</p>
            <div className="perf__metrics">
              <Metric label="Assigned Tasks" value={p.totalAssignedTasks} />
              <Metric label="Completed Tasks" value={p.totalCompletedTasks} />
              <Metric label="Completion Rate" value={pct(p.completionRate)} />
              <Metric label="Early" value={p.earlyTasks} />
              <Metric label="On Time" value={p.onTimeTasks} />
              <Metric label="Late" value={p.lateTasks} />
              <Metric label="On-Time Rate" value={pct(p.onTimeRate)} />
              <Metric label="Avg. Schedule Difference" value={p.averageScheduleLabel ?? '—'} />
            </div>
            {p.notEvaluableCompletedTasks > 0 && (
              <p className="muted small">
                {p.notEvaluableCompletedTasks} completed {p.notEvaluableCompletedTasks === 1 ? 'task is' : 'tasks are'} not
                evaluable (no completion date recorded) and {p.notEvaluableCompletedTasks === 1 ? 'is' : 'are'} excluded
                from the schedule figures. {p.evaluableCompletedTasks} evaluable.
              </p>
            )}
            <Table columns={COLUMNS} rows={p.completedTasks.map((t) => ({ ...t, id: t.taskId }))}
                   empty="No completed tasks yet." />
          </>
        )}
      </Async>
    </div>
  );
}
