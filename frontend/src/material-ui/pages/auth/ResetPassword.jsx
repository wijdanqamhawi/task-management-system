// Material reset-password: the target of the emailed /reset-password#token=... link. Same token
// handling (fragment read once, then removed), endpoints and policy as pages/ResetPassword.jsx.
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';
import AuthCard, { PasswordField } from './AuthCard.jsx';
import { NavLink } from '../../shared.jsx';
import { resetPassword, validateResetToken } from '../../../api/auth.js';
import { ApiError } from '../../../api/client.js';
import { useRouter } from '../../../router/Router.jsx';
import { ROUTES } from '../../../router/routes.js';
import { confirmError, passwordError, readToken } from '../../../pages/ResetPassword.jsx';

export default function ResetPassword() {
  const { navigate } = useRouter();
  // Held in a ref: the fragment is removed from the URL below, but later renders still need it.
  const tokenRef = useRef(null);
  if (tokenRef.current === null) tokenRef.current = readToken();
  const token = tokenRef.current;

  const [link, setLink] = useState(token ? 'checking' : 'invalid');   // checking | valid | invalid | error
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    validateResetToken(token)
      .then((r) => { if (!cancelled) setLink(r?.valid ? 'valid' : 'invalid'); })
      .catch(() => { if (!cancelled) setLink('error'); });
    return () => { cancelled = true; };
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    const errors = {};
    const p = passwordError(password);
    const c = confirmError(password, confirm);
    if (p) errors.password = p;
    if (c) errors.confirmPassword = c;
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      navigate(`${ROUTES.LOGIN}?reset=1`, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 400 && error.fieldErrors?.password) {
        setFieldErrors({ password: error.fieldErrors.password });
      } else if (error instanceof ApiError && error.status === 400) {
        setLink('invalid');                       // expired, already used, or never valid
      } else if (error instanceof ApiError && error.status === 429) {
        setFormError('Too many attempts. Please wait a while and try again.');
      } else {
        setFormError('We could not reset your password. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (link === 'checking') {
    return (
      <AuthCard title="Reset password">
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <CircularProgress size={20} />
          <Typography color="text.secondary">Checking your reset link…</Typography>
        </Stack>
      </AuthCard>
    );
  }

  if (link !== 'valid') {
    return (
      <AuthCard title="Reset password">
        <Alert severity="error" sx={{ mb: 2 }}>
          {link === 'invalid' ? 'This link is invalid or has expired.' : 'We could not check your link. Please try again.'}
        </Alert>
        <NavLink to={ROUTES.FORGOT_PASSWORD}>Request a new reset link</NavLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset password" subtitle="Choose a new password for your account.">
      <Stack component="form" spacing={2.5} onSubmit={handleSubmit} noValidate>
        {formError && <Alert severity="error">{formError}</Alert>}
        <PasswordField
          label="New password" value={password} autoComplete="new-password" disabled={submitting}
          error={fieldErrors.password} onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordField
          label="Confirm new password" value={confirm} autoComplete="new-password" disabled={submitting}
          error={fieldErrors.confirmPassword} onChange={(e) => setConfirm(e.target.value)}
        />
        <Button type="submit" variant="contained" size="large" disabled={submitting}>
          {submitting ? 'Saving…' : 'Reset password'}
        </Button>
      </Stack>
    </AuthCard>
  );
}
