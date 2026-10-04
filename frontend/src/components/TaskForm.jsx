/*
 * Create / edit task form in a modal (FR-016..FR-023).
 * Creating: pick a project, and (only if you manage that project) assignees. A Member may
 * create tasks but not assign them to others (FR-008c, FR-032), so the picker is hidden for them.
 * Editing never changes the status: that is a separate control (R-005).
 */
import { useEffect, useState } from 'react';
import { Button, DateInput, Field, Modal, Select, TextArea, TextInput } from './index.jsx';
import { Notice, PRIORITY_OPTIONS } from './common.jsx';
import { ApiError } from '../api/client.js';
import { listMembers } from '../api/projects.js';
import { isManagerOf } from '../utils/permissions.js';
import { errorMessage } from '../utils/format.js';

export default function TaskForm({ task, projects = [], defaultProjectId, user, managedIds, onSubmit, onClose }) {
  const editing = Boolean(task);
  const [form, setForm] = useState({
    projectId: task?.projectId ?? defaultProjectId ?? projects[0]?.projectId ?? '',
    title: task?.title ?? '',
    description: task?.description ?? '',
    priority: task?.priority ?? 'MEDIUM',
    startDate: task?.startDate ?? '',
    dueDate: task?.dueDate ?? '',
  });
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [members, setMembers] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const projectId = Number(form.projectId) || null;
  const canAssign = !editing && projectId != null && isManagerOf(user, projectId, managedIds);

  useEffect(() => {
    setAssigneeIds([]);
    if (!canAssign) { setMembers([]); return undefined; }
    const controller = new AbortController();
    listMembers(projectId, { signal: controller.signal })
      .then((list) => setMembers(list.filter((m) => m.isActive)))
      .catch(() => setMembers([]));
    return () => controller.abort();
  }, [projectId, canAssign]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggle = (id) => setAssigneeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  async function submit(e) {
    e.preventDefault();
    const found = {};
    if (!editing && !projectId) found.projectId = 'Choose a project.';
    if (!form.title.trim()) found.title = 'Title is required.';
    if (form.startDate && form.dueDate && form.dueDate < form.startDate) {
      found.dueDate = 'Due date must not be earlier than the start date.';
    }
    setErrors(found);
    if (Object.keys(found).length) return;

    const body = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      startDate: form.startDate || null,
      dueDate: form.dueDate || null,
    };
    setSaving(true);
    setFormError('');
    try {
      await onSubmit(editing ? body : { ...body, projectId, assigneeIds: canAssign ? assigneeIds : [] });
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? 'Edit task' : 'New task'} onClose={saving ? undefined : onClose}>
      <form className="form-grid form-grid--2" onSubmit={submit} noValidate>
        <div className="span-2"><Notice>{formError}</Notice></div>
        {!editing && (
          <div className="span-2">
            <Field label="Project" error={errors.projectId}>
              <Select value={form.projectId} onChange={set('projectId')}
                      options={projects.length ? projects.map((p) => ({ value: p.projectId, label: p.name }))
                                               : [{ value: '', label: 'No projects available' }]} />
            </Field>
          </div>
        )}
        <div className="span-2">
          <Field label="Title" error={errors.title}>
            <TextInput value={form.title} onChange={set('title')} maxLength={200} autoFocus />
          </Field>
        </div>
        <div className="span-2">
          <Field label="Description" error={errors.description}>
            <TextArea value={form.description} onChange={set('description')} />
          </Field>
        </div>
        <Field label="Priority" error={errors.priority}>
          <Select value={form.priority} onChange={set('priority')} options={PRIORITY_OPTIONS} />
        </Field>
        <span />
        <Field label="Start date" error={errors.startDate}>
          <DateInput value={form.startDate} onChange={set('startDate')} />
        </Field>
        <Field label="Due date" error={errors.dueDate}>
          <DateInput value={form.dueDate} onChange={set('dueDate')} />
        </Field>
        {canAssign && (
          <div className="span-2">
            <Field label="Assign to" error={errors.assigneeIds}>
              <div className="check-list" role="group" aria-label="Assignees">
                {members.length === 0 && <span className="muted small">No active members in this project.</span>}
                {members.map((m) => (
                  <label key={m.userId} className="check-row">
                    <input type="checkbox" checked={assigneeIds.includes(m.userId)} onChange={() => toggle(m.userId)} />
                    <span>{m.fullName}</span>
                  </label>
                ))}
              </div>
            </Field>
          </div>
        )}
        <div className="span-2 form-actions">
          <Button type="button" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving || (!editing && !projects.length)}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
