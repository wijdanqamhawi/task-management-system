/*
 * Forgot password page.
 *
 * UI ONLY. There is no password-reset endpoint and no email service, and this page does
 * not pretend otherwise: submitting a valid address shows an honest notice explaining
 * that the feature is unavailable until backend integration exists. No request is sent,
 * no fake success is shown, and no new dependency is introduced (Constitution II).
 *
 * Shares components/AuthShell.jsx with the Login page, so the visual identity — colours,
 * typography, inputs, button, spacing and responsive behaviour — is identical by
 * construction rather than by duplication.
 */
import { useState } from 'react';
import { Button, Field, TextInput } from '../components/index.jsx';
import AuthShell from '../components/AuthShell.jsx';
import { Link } from '../router/Link.jsx';
import { ROUTES } from '../router/routes.js';

/** Pragmatic shape check. Real validation is a server's job; this catches typos. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();

    const value = email.trim();
    if (!value) {
      setFieldError('Enter your email address.');
      setSubmitted(false);
      return;
    }
    if (!EMAIL_PATTERN.test(value)) {
      setFieldError('Enter a valid email address.');
      setSubmitted(false);
      return;
    }

    setFieldError('');
    // Deliberately no network call: there is nothing to call yet.
    setSubmitted(true);
  }

  return (
    <AuthShell>
      <h2 className="login__heading">Forgot Password?</h2>
      <p className="login__subtitle">
        Enter your email and we&apos;ll help you reset your password.
      </p>

      <form className="login__form" onSubmit={handleSubmit} noValidate>
        {submitted && (
          <div className="login__notice" role="status" aria-live="polite">
            <p className="login__notice-title">Password reset is not available yet</p>
            <p className="login__notice-body">
              This screen is built, but the reset service behind it is not. No email has
              been sent. To regain access, ask your department administrator to reset your
              password.
            </p>
          </div>
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
                if (submitted) setSubmitted(false);
              }}
              placeholder="Enter your email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              aria-invalid={Boolean(fieldError)}
              required
            />
          </span>
        </Field>

        <Button type="submit" variant="primary" className="login__submit">
          Send Reset Link
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
