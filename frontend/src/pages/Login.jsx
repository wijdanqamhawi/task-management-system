/*
 * Login page — Week 2 UI deliverable, part of T048 (US1, FR-002).
 *
 * Icons are inline SVG: no icon library, no UI framework, no new dependency
 * (Constitution II). The split-screen frame lives in components/AuthShell.jsx so the
 * Forgot password screen shares exactly the same visual identity.
 */
import { useState } from 'react';
import { Button, Field, TextInput } from '../components/index.jsx';
import AuthShell from '../components/AuthShell.jsx';
import { useSession } from '../auth/SessionContext.jsx';
import { useRouter } from '../router/Router.jsx';
import { Link } from '../router/Link.jsx';
import { ROUTES } from '../router/routes.js';

/**
 * One message for every sign-in failure.
 *
 * US1 scenario 2 and FR-007 require that a failed sign-in never reveal which credential
 * was wrong, nor whether the account exists or has been deactivated. Distinguishing those
 * cases here would leak exactly what the requirement forbids.
 */
const SIGN_IN_FAILED = 'Email or password is incorrect.';

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

export default function Login() {
  const { login } = useSession();
  const { navigate } = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Visual only: no requirement defines persistent sessions, so this value is not sent.
  const [remember, setRemember] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /** Client-side checks only guard against empty submits; the server validates for real. */
  function validate() {
    const errors = {};
    if (!email.trim()) errors.email = 'Enter your email address.';
    if (!password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password);

      // Return the user to the page they originally asked for, if a guard sent them
      // here with ?next= (router/RouteGuard.jsx).
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
    <AuthShell>
      <h2 className="login__heading">Welcome Back</h2>
      <p className="login__subtitle">Sign in to your account</p>

      <form className="login__form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className="login__error" role="alert" aria-live="assertive">
            <span className="login__error-mark" aria-hidden="true">!</span>
            <span>{formError}</span>
          </p>
        )}

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
              autoComplete="username"
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
              autoComplete="current-password"
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.password)}
              required
            />
            {/* Purely client-side visibility toggle: no endpoint, no new feature. */}
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

        <div className="login__meta">
          <label className="login__remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={submitting}
            />
            <span>Remember me</span>
          </label>

          <Link to={ROUTES.FORGOT_PASSWORD} className="login__forgot">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="login__submit"
          disabled={submitting}
        >
          {submitting ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>

      <p className="login__signup">
        Don&apos;t have an account?{' '}
        <Link to={ROUTES.REGISTER} className="login__link">Sign up</Link>
      </p>
    </AuthShell>
  );
}
