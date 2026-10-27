// Material registration. Same endpoint, validation and outcomes as pages/Register.jsx.
import { useState } from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import AuthCard, { PasswordField } from './AuthCard.jsx';
import { NavLink } from '../../shared.jsx';
import { register } from '../../../api/auth.js';
import { ApiError } from '../../../api/client.js';
import { useRouter } from '../../../router/Router.jsx';
import { ROUTES } from '../../../router/routes.js';
import { confirmPasswordError, emailError, nameError, passwordError } from '../../../pages/Register.jsx';

export default function Register() {
  const { navigate } = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    const errors = {};
    const checks = {
      fullName: nameError(fullName),
      email: emailError(email),
      password: passwordError(password),
      confirmPassword: confirmPasswordError(password, confirmPassword),
    };
    Object.entries(checks).forEach(([key, msg]) => { if (msg) errors[key] = msg; });
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      await register({ fullName: fullName.trim(), email: email.trim(), password });
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFieldErrors({ email: 'That email address is already registered.' });
      } else if (error instanceof ApiError && error.status === 400) {
        setFormError(error.message);
      } else {
        setFormError('We could not create your account. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="Create account" subtitle="Create your account to get started">
      <Stack component="form" spacing={2.5} onSubmit={handleSubmit} noValidate>
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField
          label="Name" value={fullName} autoComplete="name" fullWidth disabled={submitting}
          error={Boolean(fieldErrors.fullName)} helperText={fieldErrors.fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <TextField
          label="Email" type="email" value={email} autoComplete="email" fullWidth disabled={submitting}
          error={Boolean(fieldErrors.email)} helperText={fieldErrors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label="Password" value={password} autoComplete="new-password" disabled={submitting}
          error={fieldErrors.password} onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordField
          label="Confirm password" value={confirmPassword} autoComplete="new-password" disabled={submitting}
          error={fieldErrors.confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button type="submit" variant="contained" size="large" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
        <Typography variant="body2" color="text.secondary" align="center">
          Already have an account? <NavLink to={ROUTES.LOGIN}>Sign in</NavLink>
        </Typography>
      </Stack>
    </AuthCard>
  );
}
