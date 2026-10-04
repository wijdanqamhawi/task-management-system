/*
 * Subtasks, comments and attachments for one task (FR-024..FR-026). Any member of the task's
 * project may use them; the API checks visibility on every call, so a task outside the
 * caller's projects returns 404 and none of these panels is ever reached for it.
 */
import { useState } from 'react';
import { Button, TextArea, TextInput } from './index.jsx';
import { Async, ConfirmDialog, Notice } from './common.jsx';
import { useApi } from '../hooks/useApi.js';
import {
  addComment, addSubtask, attachmentUrl, deleteAttachment, deleteSubtask, listAttachments,
  listComments, listSubtasks, updateSubtask, uploadAttachment,
} from '../api/taskDetail.js';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, UPLOAD_ACCEPT } from '../constants.js';
import { errorMessage, fmtBytes, fmtDateTime } from '../utils/format.js';

export function SubtasksPanel({ taskId }) {
  const state = useApi((signal) => listSubtasks(taskId, { signal }), [taskId]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action) {
    setBusy(true);
    setError('');
    try { await action(); state.reload(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  const add = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    run(async () => { await addSubtask(taskId, title.trim()); setTitle(''); });
  };

  return (
    <section className="panel" aria-label="Subtasks">
      <h3 className="panel__title">Subtasks</h3>
      <Notice onClose={() => setError('')}>{error}</Notice>
      <Async state={state}>
        {(list) => (
          <>
            {list.length === 0 && <p className="muted">No subtasks yet.</p>}
            <ul className="item-list">
              {list.map((s) => (
                <li key={s.subtaskId} className={s.isCompleted ? 'subtask--done' : ''}>
                  <label className="check-row item-list__main">
                    <input type="checkbox" checked={s.isCompleted} disabled={busy}
                           onChange={() => run(() => updateSubtask(s.subtaskId, { isCompleted: !s.isCompleted }))} />
                    <span>{s.title}</span>
                  </label>
                  <Button type="button" disabled={busy} aria-label={`Delete subtask ${s.title}`}
                          onClick={() => run(() => deleteSubtask(s.subtaskId))}>Delete</Button>
                </li>
              ))}
            </ul>
            <p className="muted small">
              {list.filter((s) => s.isCompleted).length} of {list.length} complete. Subtasks are a checklist:
              they do not block completing the task.
            </p>
          </>
        )}
      </Async>
      <form className="row" onSubmit={add}>
        <div className="spacer" style={{ minWidth: 180 }}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
                     placeholder="Add a subtask" aria-label="New subtask title" />
        </div>
        <Button type="submit" disabled={busy || !title.trim()}>Add</Button>
      </form>
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

export function AttachmentsPanel({ taskId, user, canManage }) {
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
                  {(a.uploadedBy === user.userId || canManage) && (
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
