/* Profile: view and edit your own name and email (FR-003). PUT /api/users/me. */
import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import { Badge, Button, Field, TextInput } from '../components/index.jsx';
import { Notice, PageHeader } from '../components/common.jsx';
import { useSession } from '../auth/SessionContext.jsx';
import { ApiError } from '../api/client.js';
import { updateMe } from '../api/users.js';
import { ROLE_LABELS } from '../constants.js';
import { errorMessage, fmtDateTime } from '../utils/format.js';

export default function Profile() {
  const { user, refresh } = useSession();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState({ kind: 'success', text: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(user?.fullName ?? '');
    setEmail(user?.email ?? '');
  }, [user]);

  const dirty = fullName.trim() !== user?.fullName || email.trim() !== user?.email;

  async function onSubmit(e) {
    e.preventDefault();
    const errors = {};
    if (!fullName.trim()) errors.fullName = 'Name is required.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Enter a valid email address.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    setMessage({ kind: 'success', text: '' });
    try {
      await updateMe({ fullName: fullName.trim(), email: email.trim() });
      await refresh({ silent: true });
      setMessage({ kind: 'success', text: 'Profile updated.' });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFieldErrors({ email: 'That email address is already registered.' });
      } else if (error instanceof ApiError && error.fieldErrors) {
        setFieldErrors(error.fieldErrors);
      } else {
        setMessage({ kind: 'error', text: errorMessage(error) });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout title="Profile">
      <PageHeader title="Your profile" subtitle="Update your name and email address." />
      <div className="cols cols--2">
        <form className="panel form-grid" onSubmit={onSubmit} noValidate>
          <Notice kind={message.kind} onClose={() => setMessage({ kind: 'success', text: '' })}>{message.text}</Notice>
          <Field label="Full name" error={fieldErrors.fullName}>
            <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={150}
                       aria-invalid={Boolean(fieldErrors.fullName)} autoComplete="name" />
          </Field>
          <Field label="Email" error={fieldErrors.email}>
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                       aria-invalid={Boolean(fieldErrors.email)} autoComplete="email" />
          </Field>
          <div className="form-actions">
            <Button type="submit" variant="primary" disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>

        <section className="panel" aria-label="Account details">
          <h3 className="panel__title">Account</h3>
          <dl className="kv">
            <div><dt>Username</dt><dd>{user?.username}</dd></div>
            <div><dt>Role</dt><dd><Badge value={user?.role}>{ROLE_LABELS[user?.role]}</Badge></dd></div>
            <div><dt>Member since</dt><dd>{fmtDateTime(user?.createdAt)}</dd></div>
          </dl>
          <p className="muted small">Your role is assigned by an administrator.</p>
        </section>
      </div>
    </AppLayout>
  );
}
