// Material dialogs for the actions the Original UI offers (create/edit project and task, add member,
// confirm). They send the same bodies to the same API modules as components/ProjectForm, TaskForm.
import { useEffect, useState } from 'react';
import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel,
  FormGroup, FormLabel, MenuItem, Stack, TextField,
} from '@mui/material';
import { ApiError } from '../api/client.js';
import { listMembers } from '../api/projects.js';
import { PRIORITIES, PRIORITY_LABELS, PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '../constants.js';
import { canAssign } from '../utils/permissions.js';
import { errorMessage } from '../utils/format.js';

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', busy, onConfirm, onCancel }) {
  return (
    <Dialog open onClose={busy ? undefined : onCancel}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent><DialogContentText>{message}</DialogContentText></DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={busy}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}

/** Shared shell: validates through `validate`, submits through `onSubmit`, shows API errors. */
function FormDialog({ title, submitLabel, onClose, validate, onSubmit, children }) {
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setFormError('');
    try {
      await onSubmit();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <Dialog
      open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm"
      slotProps={{ paper: { component: 'form', onSubmit: submit, noValidate: true } }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          {children(errors)}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : submitLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}

export function ProjectDialog({ project, onSubmit, onClose }) {
  const [form, setForm] = useState({
    name: project?.name ?? '',
    description: project?.description ?? '',
    status: project?.status ?? 'PLANNED',
    startDate: project?.startDate ?? '',
    endDate: project?.endDate ?? '',
  });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const found = {};
    if (!form.name.trim()) found.name = 'Name is required.';
    if (form.startDate && form.endDate && form.endDate < form.startDate) found.endDate = 'End date must not be earlier than the start date.';
    return found;
  };

  return (
    <FormDialog
      title={project ? 'Edit project' : 'Create project'} submitLabel={project ? 'Save changes' : 'Create project'}
      onClose={onClose} validate={validate}
      onSubmit={() => onSubmit({
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: form.status,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      })}
    >
      {(errors) => (
        <>
          <TextField label="Name" value={form.name} onChange={set('name')} error={Boolean(errors.name)} helperText={errors.name} slotProps={{ htmlInput: { maxLength: 150 } }} autoFocus fullWidth />
          <TextField label="Description" value={form.description} onChange={set('description')} error={Boolean(errors.description)} helperText={errors.description} multiline minRows={3} fullWidth />
          <TextField select label="Status" value={form.status} onChange={set('status')} error={Boolean(errors.status)} helperText={errors.status} fullWidth>
            {PROJECT_STATUSES.map((s) => <MenuItem key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</MenuItem>)}
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Start date" type="date" value={form.startDate} onChange={set('startDate')} error={Boolean(errors.startDate)} helperText={errors.startDate} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
            <TextField label="End date" type="date" value={form.endDate} onChange={set('endDate')} error={Boolean(errors.endDate)} helperText={errors.endDate} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
          </Stack>
        </>
      )}
    </FormDialog>
  );
}

/**
 * Create (task undefined) or edit a task. Assignees are offered only when the existing rule
 * (canAssign) allows it; editing never changes the status, exactly like the Original form.
 */
export function TaskDialog({ task, projects = [], defaultProjectId, user, managedIds, onSubmit, onClose }) {
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
  const projectId = Number(form.projectId) || null;
  const mayAssign = !editing && projectId != null && canAssign(user, projectId, managedIds);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggle = (id) => setAssigneeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  useEffect(() => {
    setAssigneeIds([]);
    if (!mayAssign) { setMembers([]); return undefined; }
    const controller = new AbortController();
    listMembers(projectId, { signal: controller.signal })
      .then((list) => setMembers(list.filter((m) => m.isActive)))
      .catch(() => setMembers([]));
    return () => controller.abort();
  }, [projectId, mayAssign]);

  const validate = () => {
    const found = {};
    if (!editing && !projectId) found.projectId = 'Choose a project.';
    if (!form.title.trim()) found.title = 'Title is required.';
    if (form.startDate && form.dueDate && form.dueDate < form.startDate) found.dueDate = 'Due date must not be earlier than the start date.';
    return found;
  };

  const submit = () => {
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      startDate: form.startDate || null,
      dueDate: form.dueDate || null,
    };
    return onSubmit(editing ? body : { ...body, projectId, assigneeIds: mayAssign ? assigneeIds : [] });
  };

  return (
    <FormDialog title={editing ? 'Edit task' : 'Create task'} submitLabel={editing ? 'Save changes' : 'Create task'} onClose={onClose} validate={validate} onSubmit={submit}>
      {(errors) => (
        <>
          {!editing && (
            <TextField select label="Project" value={form.projectId} onChange={set('projectId')} error={Boolean(errors.projectId)} helperText={errors.projectId} disabled={!projects.length} fullWidth>
              {projects.length
                ? projects.map((p) => <MenuItem key={p.projectId} value={p.projectId}>{p.name}</MenuItem>)
                : <MenuItem value="">No projects available</MenuItem>}
            </TextField>
          )}
          <TextField label="Title" value={form.title} onChange={set('title')} error={Boolean(errors.title)} helperText={errors.title} slotProps={{ htmlInput: { maxLength: 200 } }} autoFocus fullWidth />
          <TextField label="Description" value={form.description} onChange={set('description')} error={Boolean(errors.description)} helperText={errors.description} multiline minRows={3} fullWidth />
          <TextField select label="Priority" value={form.priority} onChange={set('priority')} error={Boolean(errors.priority)} helperText={errors.priority} fullWidth>
            {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{PRIORITY_LABELS[p]}</MenuItem>)}
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Start date" type="date" value={form.startDate} onChange={set('startDate')} error={Boolean(errors.startDate)} helperText={errors.startDate} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
            <TextField label="Due date" type="date" value={form.dueDate} onChange={set('dueDate')} error={Boolean(errors.dueDate)} helperText={errors.dueDate} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
          </Stack>
          {mayAssign && (
            <FormGroup>
              <FormLabel>Assign to</FormLabel>
              {members.length === 0 && <DialogContentText variant="body2">No active members in this project.</DialogContentText>}
              {members.map((m) => (
                <FormControlLabel key={m.userId} label={m.fullName} control={<Checkbox checked={assigneeIds.includes(m.userId)} onChange={() => toggle(m.userId)} />} />
              ))}
              {errors.assigneeIds && <DialogContentText color="error" variant="body2">{errors.assigneeIds}</DialogContentText>}
            </FormGroup>
          )}
        </>
      )}
    </FormDialog>
  );
}

/** Members are added by user ID, exactly like the Original project screen. */
export function AddMemberDialog({ existingIds, onSubmit, onClose }) {
  const [value, setValue] = useState('');
  const validate = () => {
    if (!/^[1-9]\d*$/.test(value)) return { userId: 'Enter a valid User ID (a positive whole number).' };
    if (existingIds.has(Number(value))) return { userId: 'That user is already a member of this project.' };
    return {};
  };
  return (
    <FormDialog title="Add member" submitLabel="Add member" onClose={onClose} validate={validate} onSubmit={() => onSubmit(Number(value))}>
      {(errors) => (
        <TextField
          label="User ID" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
          error={Boolean(errors.userId)} helperText={errors.userId} slotProps={{ htmlInput: { inputMode: 'numeric' } }} autoFocus fullWidth
        />
      )}
    </FormDialog>
  );
}
