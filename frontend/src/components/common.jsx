// Shared UI pieces for the data screens. Plain React, hand-written CSS (Constitution II).
import '../styles/app.css';
import { Button, Modal, Select } from './index.jsx';
import { PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '../constants.js';

/** Inline banner for errors and confirmations. role=alert so screen readers announce it. */
export function Notice({ kind = 'error', children, onClose }) {
  if (!children) return null;
  return (
    <p className={`notice notice--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && (
        <button type="button" className="notice__close" onClick={onClose} aria-label="Dismiss">×</button>
      )}
    </p>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div className="page-head__text">
        <h2 className="page-head__title">{title}</h2>
        {subtitle && <p className="page-head__sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}

/** Loading / error wrapper for a useApi() result. */
export function Async({ state, children }) {
  if (state.loading && state.data == null) return <p className="state" role="status">Loading…</p>;
  if (state.error) {
    return (
      <p className="state state--error" role="alert">
        {state.error} <button type="button" className="link-btn" onClick={state.reload}>Try again</button>
      </p>
    );
  }
  if (state.data == null) return null;
  return children(state.data);
}

export function Pagination({ page, totalPages, totalElements, onPage }) {
  if (!totalPages || totalPages <= 1) {
    return totalElements ? <p className="pager__count">{totalElements} total</p> : null;
  }
  return (
    <nav className="pager" aria-label="Pagination">
      <Button type="button" onClick={() => onPage(page - 1)} disabled={page <= 0}>Previous</Button>
      <span className="pager__count">Page {page + 1} of {totalPages} · {totalElements} total</span>
      <Button type="button" onClick={() => onPage(page + 1)} disabled={page + 1 >= totalPages}>Next</Button>
    </nav>
  );
}

/** The workflow control: any of the four statuses, in any order (R-005). */
export function StatusSelect({ value, onChange, disabled, label = 'Task status' }) {
  return (
    <Select
      className={`status-select status-select--${value}`}
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
    />
  );
}

export const PRIORITY_OPTIONS = ['HIGH', 'MEDIUM', 'LOW'].map((p) => ({ value: p, label: PRIORITY_LABELS[p] }));

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={busy ? undefined : onCancel}>
      <p>{message}</p>
      <div className="row row--end">
        <Button type="button" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="button" variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
