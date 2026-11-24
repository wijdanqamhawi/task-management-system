import { useEffect, useState } from 'react';
import { Alert, Avatar, Box, Button, Card, CardContent, CardHeader, Divider, Grid, Stack, TextField, Typography } from '@mui/material';
import { PageHeader, RoleChip } from '../shared.jsx';
import { useSession } from '../../auth/SessionContext.jsx';
import { ApiError } from '../../api/client.js';
import { updateMe } from '../../api/users.js';
import { errorMessage, fmtDateTime, initials } from '../../utils/format.js';
import { ROLE_LABELS } from '../../constants.js';

export default function Profile() {
  const { user, refresh } = useSession();
  const [fullName, setFullName] = useState(user.fullName ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState({ kind: 'success', text: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(user.fullName ?? '');
    setEmail(user.email ?? '');
  }, [user]);

  const dirty = fullName.trim() !== user.fullName || email.trim() !== user.email;

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
    <>
      <PageHeader title="Profile" subtitle="Your account information" />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Avatar sx={{ width: 88, height: 88, mx: 'auto', mb: 2, fontSize: 36, bgcolor: 'primary.main' }}>{initials(user.fullName)}</Avatar>
              <Typography variant="h6">{user.fullName}</Typography>
              <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                {user.email}
              </Typography>
              <RoleChip role={user.role} />
              {user.createdAt && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Member since {fmtDateTime(user.createdAt)}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader title="Edit profile" slotProps={{ title: { variant: 'h6' } }} />
            <Divider />
            <CardContent>
              <Stack spacing={2.5} component="form" onSubmit={onSubmit} noValidate>
                {message.text && <Alert severity={message.kind} onClose={() => setMessage({ kind: 'success', text: '' })}>{message.text}</Alert>}
                <TextField
                  label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} fullWidth
                  error={Boolean(fieldErrors.fullName)} helperText={fieldErrors.fullName} slotProps={{ htmlInput: { maxLength: 150 } }}
                />
                <TextField
                  label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth
                  error={Boolean(fieldErrors.email)} helperText={fieldErrors.email}
                />
                <TextField label="Role" value={ROLE_LABELS[user.role] ?? user.role} fullWidth disabled helperText="Roles are managed by an administrator." />
                <Box>
                  <Button type="submit" variant="contained" disabled={saving || !dirty}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
