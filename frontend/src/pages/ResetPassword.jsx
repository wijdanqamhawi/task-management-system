/*
 * Reset password page: the target of the emailed link, /reset-password#token=...
 *
 * The token is carried in the URL fragment, which browsers never send to a server, so it
 * cannot reach access logs or Referer headers. It is read once, then removed from the address
 * bar. The page asks the API whether the link is usable before showing the form, and the
 * server re-checks (token, expiry, single use, password policy) on submit.
 */
import { useEffect, useRef, useState } from 'react';
import { Button, Field, TextInput } from '../components/index.jsx';
import AuthShell from '../components/AuthShell.jsx';
import { resetPassword, validateResetToken } from '../api/auth.js';
import { ApiError } from '../api/client.js';
import { useRouter } from '../router/Router.jsx';
import { Link } from '../router/Link.jsx';
import { ROUTES } from '../router/routes.js';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;       // bcrypt limit, mirrors the server's policy

export function readToken() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return params.get('token') || '';
}

export function passwordError(value) {
  if (!value) return 'Enter a new password.';
  if (value.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (new TextEncoder().encode(value).length > MAX_PASSWORD_BYTES) return `Password must be at most ${MAX_PASSWORD_BYTES} bytes.`;
  return undefined;
}

export function confirmError(password, confirm) {
  if (!confirm) return 'Confirm your new password.';
  if (confirm !== password) return 'Passwords do not match.';
  return undefined;
}

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

export default function ResetPassword() {
  const { navigate } = useRouter();
  // Held in a ref: the fragment is removed from the URL below, but later renders still need it.
  const tokenRef = useRef(null);
  if (tokenRef.current === null) tokenRef.current = readToken();
  const token = tokenRef.current;

  const [link, setLink] = useState(token ? 'checking' : 'invalid');   // checking | valid | invalid | error
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Take the token out of the address bar and history entry as soon as it has been read.
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
      <AuthShell>
        <h2 className="login__heading">Reset Password</h2>
        <p className="login__subtitle" role="status">Checking your reset link…</p>
      </AuthShell>
    );
  }

  if (link === 'invalid' || link === 'error') {
    return (
      <AuthShell>
        <h2 className="login__heading">Reset Password</h2>
        <div className="login__notice" role="alert">
          <p className="login__notice-title">
            {link === 'invalid' ? 'This link is invalid or has expired' : 'We could not check your link'}
          </p>
          <p className="login__notice-body">
            {link === 'invalid'
              ? 'Reset links work once and expire after 15 minutes. Request a new one to continue.'
              : 'Please check your connection and reload this page.'}
          </p>
        </div>
        <p className="login__signup">
          <Link to={ROUTES.FORGOT_PASSWORD} className="login__link">Request a new reset link</Link>
        </p>
        <p className="login__signup">
          <Link to={ROUTES.LOGIN} className="login__back">
            <span aria-hidden="true">&larr;</span> Back to Sign In
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h2 className="login__heading">Choose a New Password</h2>
      <p className="login__subtitle">Enter a new password for your account.</p>

      <form className="login__form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className="login__error" role="alert" aria-live="assertive">
            <span className="login__error-mark" aria-hidden="true">!</span>
            <span>{formError}</span>
          </p>
        )}

        <Field label="New password" error={fieldErrors.password}>
          <span className="login__control login__control--password">
            <span className="login__control-icon"><LockIcon /></span>
            <TextInput
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: passwordError(e.target.value) }));
              }}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.password)}
              required
            />
            <button type="button" className="login__reveal" disabled={submitting}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </span>
        </Field>

        <Field label="Confirm new password" error={fieldErrors.confirmPassword}>
          <span className="login__control login__control--password">
            <span className="login__control-icon"><LockIcon /></span>
            <TextInput
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((f) => ({ ...f, confirmPassword: confirmError(password, e.target.value) }));
                }
              }}
              placeholder="Repeat the new password"
              autoComplete="new-password"
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              required
            />
            <button type="button" className="login__reveal" disabled={submitting}
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'} aria-pressed={showConfirm}>
              {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </span>
        </Field>

        <Button type="submit" variant="primary" className="login__submit" disabled={submitting}>
          {submitting ? 'Updating…' : 'Update Password'}
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
