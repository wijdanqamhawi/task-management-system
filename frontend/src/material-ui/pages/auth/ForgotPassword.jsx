// Material forgot-password. Posts to the same endpoint as pages/ForgotPassword.jsx; the backend sends the email.
import { useState } from 'react';
import { Alert, Button, Stack, TextField } from '@mui/material';
import AuthCard from './AuthCard.jsx';
import { NavLink } from '../../shared.jsx';
import { forgotPassword } from '../../../api/auth.js';
import { ApiError } from '../../../api/client.js';
import { ROUTES } from '../../../router/routes.js';
import { emailError } from '../../../pages/Login.jsx';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setFormError('');
    const problem = emailError(email);
    setFieldError(problem ?? '');
    if (problem) return;

    setSubmitting(true);
    try {
      const result = await forgotPassword(email.trim());
      setMessage(result?.message
        || 'If an account exists for that email address, a password reset link will be emailed shortly.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setFormError('Too many requests. Please wait a while and try again.');
      } else if (error instanceof ApiError && error.status === 400) {
        setFieldError('Enter a valid email address.');
      } else {
        setFormError('We could not process your request. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="Forgot password?" subtitle="Enter your email and we'll help you reset your password.">
      <Stack component="form" spacing={2.5} onSubmit={handleSubmit} noValidate>
        {message && <Alert severity="success">{message} The link works once and expires in 15 minutes.</Alert>}
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField
          label="Email" type="email" value={email} autoComplete="username" fullWidth disabled={submitting}
          error={Boolean(fieldError)} helperText={fieldError}
          onChange={(e) => { setEmail(e.target.value); if (message) setMessage(''); }}
        />
        <Button type="submit" variant="contained" size="large" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
        <NavLink to={ROUTES.LOGIN} sx={{ textAlign: 'center' }}>← Back to sign in</NavLink>
      </Stack>
    </AuthCard>
  );
}
