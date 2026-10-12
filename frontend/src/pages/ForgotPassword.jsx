/*
 * Forgot password page.
 *
 * Posts the address to POST /api/auth/forgot-password. The server answers identically whether
 * or not an account exists (no account enumeration), so this page can only say that a link
 * "will be emailed" to an existing account; it never claims a message definitely went out.
 *
 * Shares components/AuthShell.jsx with Login and Register, so the visual identity is identical
 * by construction rather than by duplication.
 */
import { useState } from 'react';
import { Button, Field, TextInput } from '../components/index.jsx';
import AuthShell from '../components/AuthShell.jsx';
import { forgotPassword } from '../api/auth.js';
import { ApiError } from '../api/client.js';
import { Link } from '../router/Link.jsx';
import { ROUTES } from '../router/routes.js';

/** Pragmatic shape check. Real validation is a server's job; this catches typos. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const value = email.trim();
    if (!value) { setFieldError('Enter your email address.'); return; }
    if (!EMAIL_PATTERN.test(value)) { setFieldError('Enter a valid email address.'); return; }
    setFieldError('');

    setSubmitting(true);
    try {
      const result = await forgotPassword(value);
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
    <AuthShell>
      <h2 className="login__heading">Forgot Password?</h2>
      <p className="login__subtitle">
        Enter your email and we&apos;ll help you reset your password.
      </p>

      <form className="login__form" onSubmit={handleSubmit} noValidate>
        {message && (
          <div className="login__notice" role="status" aria-live="polite">
            <p className="login__notice-title">Check your email</p>
            <p className="login__notice-body">
              {message} The link works once and expires in 15 minutes.
            </p>
          </div>
        )}
        {formError && (
          <p className="login__error" role="alert" aria-live="assertive">
            <span className="login__error-mark" aria-hidden="true">!</span>
            <span>{formError}</span>
          </p>
        )}

        <Field label="Email" error={fieldError}>
          <span className="login__control">
            <span className="login__control-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m2 7 10 6 10-6" />
              </svg>
            </span>
            <TextInput
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (message) setMessage('');
              }}
              placeholder="Enter your email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              disabled={submitting}
              aria-invalid={Boolean(fieldError)}
              required
            />
          </span>
        </Field>

        <Button type="submit" variant="primary" className="login__submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send Reset Link'}
        </Button>
      </form>

      <p className="login__signup">
        <Link to={ROUTES.LOGIN} className="login__back">
          <span aria-hidden="true">&larr;</span> Back to Sign In
        </Link>
      </p>
    </AuthShell>
  );
}
