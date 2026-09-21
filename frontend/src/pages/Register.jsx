/*
 * Register page — Week 2 UI deliverable (US1, FR-001).
 *
 * Shares components/AuthShell.jsx with Login and Forgot password, so the split-screen
 * container, the taskflow-workspace.png panel, the navy overlay, the TaskFlow branding
 * and every breakpoint are the same component — identical by construction, not by copy.
 * No new stylesheet: the right panel reuses the existing login.css classes.
 *
 * Icons are inline SVG, matching Login. No icon library, no new dependency
 * (Constitution II).
 *
 * BACKEND: POST /api/auth/register does not exist yet (T046). This page calls the real
 * endpoint and reports failure honestly — it never fabricates a successful registration.
 */
import { useState } from 'react';
import { Button, Field, TextInput } from '../components/index.jsx';
import AuthShell from '../components/AuthShell.jsx';
import { register } from '../api/auth.js';
import { ApiError } from '../api/client.js';
import { useRouter } from '../router/Router.jsx';
import { Link } from '../router/Link.jsx';
import { ROUTES } from '../router/routes.js';

/** Pragmatic shape check. Real validation is a server's job; this catches typos. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Icons — same style and stroke weight as Login. */

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m2 7 10 6 10-6" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1" />
    <path d="M6.6 6.8A17.4 17.4 0 0 0 2 13s3.6 7 10 7a9.7 9.7 0 0 0 4.3-1" />
    <path d="m3 3 18 18" />
  </svg>
);

export default function Register() {
  const { navigate } = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /** Week 2 scope: Name, Email, Password. Nothing else is collected. */
  function validate() {
    const errors = {};
    if (!fullName.trim()) {
      errors.fullName = 'Enter your name.';
    }
    if (!email.trim()) {
      errors.email = 'Enter your email address.';
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    if (!password) {
      errors.password = 'Enter a password.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setPending(false);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await register({ fullName: fullName.trim(), email: email.trim(), password });
      // Only reached if the server genuinely created the account.
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFieldErrors({ email: 'That email address is already registered.' });
      } else if (error instanceof ApiError && error.status === 400) {
        setFormError(error.message);
      } else {
        // The endpoint does not exist yet (T046). Say so rather than imply success.
        setPending(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="login__heading">Create Account</h2>
      <p className="login__subtitle">Create your account to get started</p>

      <form className="login__form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className="login__error" role="alert" aria-live="assertive">
            <span className="login__error-mark" aria-hidden="true">!</span>
            <span>{formError}</span>
          </p>
        )}

        {pending && (
          <div className="login__notice" role="status" aria-live="polite">
            <p className="login__notice-title">Registration is not available yet</p>
            <p className="login__notice-body">
              This form is built, but the account service behind it is not. No account has
              been created. Ask your department administrator to create one for you.
            </p>
          </div>
        )}

        <Field label="Name" error={fieldErrors.fullName}>
          <span className="login__control">
            <span className="login__control-icon"><UserIcon /></span>
            <TextInput
              id="name"
              name="name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your name"
              autoComplete="name"
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.fullName)}
              required
            />
          </span>
        </Field>

        <Field label="Email" error={fieldErrors.email}>
          <span className="login__control">
            <span className="login__control-icon"><MailIcon /></span>
            <TextInput
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck="false"
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.email)}
              required
            />
          </span>
        </Field>

        <Field label="Password" error={fieldErrors.password}>
          <span className="login__control login__control--password">
            <span className="login__control-icon"><LockIcon /></span>
            <TextInput
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="new-password"
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.password)}
              required
            />
            {/* Purely client-side visibility toggle, as on Login. */}
            <button
              type="button"
              className="login__reveal"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              disabled={submitting}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </span>
        </Field>

        <Button
          type="submit"
          variant="primary"
          className="login__submit"
          disabled={submitting}
        >
          {submitting ? 'Creating account…' : 'Create Account'}
        </Button>
      </form>

      <p className="login__signup">
        Already have an account?{' '}
        <Link to={ROUTES.LOGIN} className="login__link">Sign in</Link>
      </p>
    </AuthShell>
  );
}
