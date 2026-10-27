// Material login. Same session call, validation, messages and ?next= / ?reset=1 handling as pages/Login.jsx.
import { useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import AuthCard, { PasswordField } from './AuthCard.jsx';
import { NavLink } from '../../shared.jsx';
import { useSession } from '../../../auth/SessionContext.jsx';
import { useRouter } from '../../../router/Router.jsx';
import { ROUTES } from '../../../router/routes.js';
import { SIGN_IN_FAILED, emailError, passwordError } from '../../../pages/Login.jsx';

export default function Login() {
  const { login } = useSession();
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Checked: 30-day persistent session. Unchecked: browser-session cookie (8 h server cap).
  const [remember, setRemember] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const passwordWasReset = new URLSearchParams(window.location.search).get('reset') === '1';

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    const errors = {};
    const emailMsg = emailError(email);
    const passwordMsg = passwordError(password);
    if (emailMsg) errors.email = emailMsg;
    if (passwordMsg) errors.password = passwordMsg;
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password, remember);
      const next = new URLSearchParams(window.location.search).get('next');
      navigate(next ? decodeURIComponent(next) : ROUTES.DASHBOARD, { replace: true });
    } catch {
      setFormError(SIGN_IN_FAILED);
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your account">
      <Stack component="form" spacing={2.5} onSubmit={handleSubmit} noValidate>
        {passwordWasReset && !formError && <Alert severity="success">Password updated. Sign in with your new password.</Alert>}
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField
          label="Email" type="email" value={email} autoComplete="username" fullWidth disabled={submitting}
          error={Boolean(fieldErrors.email)} helperText={fieldErrors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label="Password" value={password} autoComplete="current-password" disabled={submitting}
          error={fieldErrors.password} onChange={(e) => setPassword(e.target.value)}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <FormControlLabel
            control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
            label="Remember me"
          />
          <NavLink to={ROUTES.FORGOT_PASSWORD}>Forgot password?</NavLink>
        </Box>
        <Typography variant="caption" aria-live="polite" sx={{ mt: -1.5, color: 'text.secondary' }}>
          {remember
            ? 'You’ll stay signed in on this device after closing the browser.'
            : 'You’ll be signed out when the browser session ends.'}
        </Typography>
        <Button type="submit" variant="contained" size="large" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
        <Typography variant="body2" color="text.secondary" align="center">
          Don&apos;t have an account? <NavLink to={ROUTES.REGISTER}>Create one</NavLink>
        </Typography>
      </Stack>
    </AuthCard>
  );
}
