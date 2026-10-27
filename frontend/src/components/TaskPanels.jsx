/*
 * Progress, comments and attachments for one task (FR-024..FR-026). Any member of the task's
 * project may view them; the API checks visibility on every call, so a task outside the
 * caller's projects returns 404 and none of these panels is ever reached for it.
 */
import { useState } from 'react';
import { Button, TextArea, TextInput } from './index.jsx';
import { Async, ConfirmDialog, Notice } from './common.jsx';
import { useApi } from '../hooks/useApi.js';
import {
  addComment, addProgress, attachmentUrl, deleteAttachment, deleteProgress, listAttachments,
  listComments, listProgress, setProgressCompleted, updateProgress, uploadAttachment,
} from '../api/taskDetail.js';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, UPLOAD_ACCEPT } from '../constants.js';
import { errorMessage, fmtBytes, fmtDateTime } from '../utils/format.js';
import { canDeleteAttachment, canManageProgress, canToggleProgress } from '../utils/permissions.js';

const toInputValue = (iso) => (iso ? String(iso).slice(0, 16) : '');      // yyyy-mm-ddThh:mm

// Both are yyyy-mm-ddThh:mm strings, which compare correctly as text.
const endIsAfterStart = (start, end) => Boolean(start && end && end > start);
const RANGE_ERROR = 'End date & time must be later than Start date & time.';

const iconProps = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false };
const CalendarIcon = () => (<svg {...iconProps}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>);
const ClockIcon = () => (<svg {...iconProps}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
const EditIcon = () => (<svg {...iconProps} width="16" height="16"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>);
const TrashIcon = () => (<svg {...iconProps} width="16" height="16"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" /></svg>);

/**
 * One form for adding and editing a Progress item: full-width title, then Start and End side by
 * side (they stack when the panel is narrow), actions at the bottom right. `dir="auto"` lets an
 * Arabic title run right-to-left inside the English layout without moving anything else.
 */
function ProgressForm({ label, value, onChange, onSubmit, submitLabel, onCancel, busy, placeholder }) {
  const valid = value.title.trim() && endIsAfterStart(value.start, value.end);
  return (
    <form className="pg-form" onSubmit={onSubmit}>
      <label className="pg-field">
        <span className="pg-field__label">Title</span>
        <TextInput value={value.title} maxLength={200} dir="auto" placeholder={placeholder}
                   aria-label={`${label} title`} onChange={(e) => onChange({ ...value, title: e.target.value })} />
      </label>
      <div className="pg-form__dates">
        <label className="pg-field">
          <span className="pg-field__label"><CalendarIcon /> Start Date &amp; Time</span>
          <TextInput type="datetime-local" value={value.start} aria-label={`${label} start date and time`}
                     onChange={(e) => onChange({ ...value, start: e.target.value })} required />
        </label>
        <label className="pg-field">
          <span className="pg-field__label"><ClockIcon /> End Date &amp; Time</span>
          <TextInput type="datetime-local" value={value.end} min={value.start || undefined}
                     aria-label={`${label} end date and time`}
                     onChange={(e) => onChange({ ...value, end: e.target.value })} required />
        </label>
      </div>
      <div className="pg-form__actions">
        {onCancel && <Button type="button" disabled={busy} onClick={onCancel}>Cancel</Button>}
        <Button type="submit" variant="primary" disabled={busy || !valid}>{submitLabel}</Button>
      </div>
    </form>
  );
}

/**
 * Progress items (stored as subtasks). Everyone who can see the task sees them. The add form,
 * Edit and Delete follow PROGRESS_MANAGE + manager scope; the checkbox follows PROGRESS_TOGGLE +
 * (manager scope or assignee of this task). The API enforces the same rules on every call.
 */
export function ProgressPanel({ task, user, managedIds }) {
  const taskId = task.taskId;
  const state = useApi((signal) => listProgress(taskId, { signal }), [taskId]);
  const [draft, setDraft] = useState({ title: '', start: '', end: '' });
  const [editing, setEditing] = useState(null);       // { id, title, start, end }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mayManage = canManageProgress(user, task.projectId, managedIds);
  const mayToggle = canToggleProgress(user, task, managedIds);

  async function run(action) {
    setBusy(true);
    setError('');
    try { await action(); state.reload(); return true; } catch (e) { setError(errorMessage(e)); return false; } finally { setBusy(false); }
  }

  const add = async (e) => {
    e.preventDefault();
    if (!draft.title.trim() || !draft.start || !draft.end) return;
    if (!endIsAfterStart(draft.start, draft.end)) { setError(RANGE_ERROR); return; }
    if (await run(() => addProgress(taskId, { title: draft.title.trim(), startAt: draft.start, endAt: draft.end }))) {
      setDraft({ title: '', start: '', end: '' });
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!editing.title.trim() || !editing.start || !editing.end) return;
    if (!endIsAfterStart(editing.start, editing.end)) { setError(RANGE_ERROR); return; }
    if (await run(() => updateProgress(editing.id, { title: editing.title.trim(), startAt: editing.start, endAt: editing.end }))) setEditing(null);
  };

  return (
    <section className="panel pg" aria-label="Progress">
      <Async state={state}>
        {(list) => (
          <>
            <div className="pg__head">
              <h3 className="panel__title">Progress</h3>
              <span className="pg__count" aria-live="polite">
                {list.filter((s) => s.isCompleted).length} of {list.length} complete
              </span>
            </div>
            <Notice onClose={() => setError('')}>{error}</Notice>
            {list.length === 0 && <p className="muted pg__empty">No progress items yet.</p>}
            <ul className="pg__list">
              {list.map((s) => (editing?.id === s.subtaskId ? (
                <li key={s.subtaskId} className="pg-item pg-item--editing">
                  <ProgressForm label="Progress" value={editing} onChange={setEditing} onSubmit={save}
                                submitLabel="Save" onCancel={() => setEditing(null)} busy={busy} />
                </li>
              ) : (
                <li key={s.subtaskId} className={s.isCompleted ? 'pg-item pg-item--done subtask--done' : 'pg-item'}>
                  <div className="pg-item__top">
                    <label className="pg-item__check">
                      <input type="checkbox" checked={s.isCompleted} disabled={busy || !mayToggle}
                             aria-label={`Mark ${s.title} ${s.isCompleted ? 'incomplete' : 'completed'}`}
                             onChange={() => run(() => setProgressCompleted(s.subtaskId, !s.isCompleted))} />
                      <span dir="auto" className={s.isCompleted ? 'pg-item__title progress-title progress-title--done' : 'pg-item__title progress-title'}>{s.title}</span>
                    </label>
                    {mayManage && (
                      <div className="pg-item__actions">
                        <button type="button" className="icon-btn" disabled={busy} title="Edit"
                                aria-label={`Edit progress ${s.title}`}
                                onClick={() => setEditing({ id: s.subtaskId, title: s.title, start: toInputValue(s.startAt), end: toInputValue(s.endAt) })}><EditIcon /></button>
                        <button type="button" className="icon-btn icon-btn--danger" disabled={busy} title="Delete"
                                aria-label={`Delete progress ${s.title}`}
                                onClick={() => run(() => deleteProgress(s.subtaskId))}><TrashIcon /></button>
                      </div>
                    )}
                  </div>
                  <div className="pg-item__dates">
                    <span><CalendarIcon /> Start: {s.startAt ? fmtDateTime(s.startAt) : 'Not set'}</span>
                    <span><ClockIcon /> End: {s.endAt ? fmtDateTime(s.endAt) : 'Not set'}</span>
                  </div>
                </li>
              )))}
            </ul>
            <p className="muted small pg__hint">Progress is a checklist: it does not block completing the task.</p>
          </>
        )}
      </Async>
      {mayManage && (
        <div className="pg-add">
          <h4 className="pg-add__title">Add New Progress</h4>
          <ProgressForm label="New progress" value={draft} onChange={setDraft} onSubmit={add}
                        submitLabel="Add Progress" busy={busy} placeholder="Add a progress item" />
        </div>
      )}
    </section>
  );
}

export function CommentsPanel({ taskId }) {
  const state = useApi((signal) => listComments(taskId, { signal }), [taskId]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function post(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    try { await addComment(taskId, body.trim()); setBody(''); state.reload(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <section className="panel" aria-label="Comments">
      <h3 className="panel__title">Comments</h3>
      <Async state={state}>
        {(list) => (
          <>
            {list.length === 0 && <p className="muted">No comments yet.</p>}
            <ul className="item-list">
              {list.map((c) => (
                <li key={c.commentId}>
                  <div className="item-list__main">
                    <div className="comment__meta"><strong>{c.authorName}</strong> · {fmtDateTime(c.createdAt)}</div>
                    <p className="prose">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Async>
      <form className="stack" onSubmit={post}>
        <Notice onClose={() => setError('')}>{error}</Notice>
        <TextArea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000}
                  placeholder="Write a comment. Use @username to mention someone." aria-label="New comment" />
        <div className="form-actions"><Button type="submit" variant="primary" disabled={busy || !body.trim()}>
          {busy ? 'Posting…' : 'Post comment'}</Button></div>
      </form>
    </section>
  );
}

export function AttachmentsPanel({ taskId, user, projectId, managedIds }) {
  const state = useApi((signal) => listAttachments(taskId, { signal }), [taskId]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [inputKey, setInputKey] = useState(0);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Refuse early with a clear message; the server enforces the same limits (R-008).
    if (file.size === 0) { setError('That file is empty.'); return; }
    if (file.size > MAX_UPLOAD_BYTES) { setError(`That file is larger than the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit.`); return; }
    if (file.type && !ALLOWED_UPLOAD_TYPES.includes(file.type)) { setError('That file type is not allowed.'); return; }
    setBusy(true);
    setError('');
    try { await uploadAttachment(taskId, file); state.reload(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); setInputKey((k) => k + 1); }
  }

  async function remove() {
    setBusy(true);
    try { await deleteAttachment(removing.attachmentId); setRemoving(null); state.reload(); }
    catch (err) { setError(errorMessage(err)); setRemoving(null); }
    finally { setBusy(false); }
  }

  return (
    <section className="panel" aria-label="Attachments">
      <h3 className="panel__title">Attachments</h3>
      <Notice onClose={() => setError('')}>{error}</Notice>
      <Async state={state}>
        {(list) => (
          <>
            {list.length === 0 && <p className="muted">No attachments yet.</p>}
            <ul className="item-list">
              {list.map((a) => (
                <li key={a.attachmentId}>
                  <div className="item-list__main">
                    <a className="text-link" href={attachmentUrl(a.attachmentId)} download={a.originalName}>{a.originalName}</a>
                    <div className="comment__meta">{fmtBytes(a.sizeBytes)} · {a.uploaderName} · {fmtDateTime(a.uploadedAt)}</div>
                  </div>
                  {canDeleteAttachment(user, a, projectId, managedIds) && (
                    <Button type="button" disabled={busy} aria-label={`Delete ${a.originalName}`}
                            onClick={() => setRemoving(a)}>Delete</Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Async>
      <label className="field">
        <span className="muted small">Add a file (max {MAX_UPLOAD_BYTES / (1024 * 1024)} MB: PDF, images, text, Office, ZIP)</span>
        <input key={inputKey} type="file" className="input" accept={UPLOAD_ACCEPT} onChange={onFile} disabled={busy} />
      </label>
      {removing && (
        <ConfirmDialog title="Delete attachment" danger confirmLabel="Delete" busy={busy}
                       message={`Delete "${removing.originalName}"?`} onCancel={() => setRemoving(null)} onConfirm={remove} />
      )}
    </section>
  );
}
