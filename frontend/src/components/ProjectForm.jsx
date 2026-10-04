/* Create / edit project form in a modal (FR-009..FR-013). Used by Projects and Project. */
import { useState } from 'react';
import { Button, DateInput, Field, Modal, Select, TextArea, TextInput } from './index.jsx';
import { Notice } from './common.jsx';
import { ApiError } from '../api/client.js';
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '../constants.js';
import { errorMessage } from '../utils/format.js';

const STATUS_OPTIONS = PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }));

export default function ProjectForm({ project, onSubmit, onClose }) {
  const [form, setForm] = useState({
    name: project?.name ?? '',
    description: project?.description ?? '',
    status: project?.status ?? 'PLANNED',
    startDate: project?.startDate ?? '',
    endDate: project?.endDate ?? '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const found = {};
    if (!form.name.trim()) found.name = 'Name is required.';
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      found.endDate = 'End date must not be earlier than the start date.';
    }
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setFormError('');
    try {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: form.status,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      });
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <Modal title={project ? 'Edit project' : 'New project'} onClose={saving ? undefined : onClose}>
      <form className="form-grid form-grid--2" onSubmit={submit} noValidate>
        <div className="span-2"><Notice>{formError}</Notice></div>
        <div className="span-2">
          <Field label="Name" error={errors.name}>
            <TextInput value={form.name} onChange={set('name')} maxLength={150} autoFocus />
          </Field>
        </div>
        <div className="span-2">
          <Field label="Description" error={errors.description}>
            <TextArea value={form.description} onChange={set('description')} />
          </Field>
        </div>
        <Field label="Status" error={errors.status}>
          <Select value={form.status} onChange={set('status')} options={STATUS_OPTIONS} />
        </Field>
        <span />
        <Field label="Start date" error={errors.startDate}>
          <DateInput value={form.startDate} onChange={set('startDate')} />
        </Field>
        <Field label="End date" error={errors.endDate}>
          <DateInput value={form.endDate} onChange={set('endDate')} />
        </Field>
        <div className="span-2 form-actions">
          <Button type="button" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
