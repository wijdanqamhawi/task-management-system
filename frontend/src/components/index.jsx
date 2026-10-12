// T030 — Shared presentational components. Plain React, no UI library (Constitution II).
import { useEffect, useRef } from 'react';
import '../styles/components.css';

export function Button({ variant, className, children, ...rest }) {
  // className is merged, not spread through: spreading it in ...rest would overwrite the
  // computed 'btn btn--variant' classes and strip the button of its styling.
  const cls = ['btn', variant ? `btn--${variant}` : '', className]
    .filter(Boolean).join(' ');
  return <button className={cls} {...rest}>{children}</button>;
}

export function Field({ label, error, children }) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      {label && <label>{label}</label>}
      {children}
      {error && <span className="field__error">{error}</span>}
    </div>
  );
}

export function TextInput(props)  { return <input className="input" {...props} />; }
export function DateInput(props)  { return <input type="date" className="input" {...props} />; }
export function TextArea(props)   { return <textarea className="textarea" {...props} />; }

export function Select({ options = [], className, ...rest }) {
  // className is merged, not spread through, for the same reason as <Button> above.
  const cls = ['select', className].filter(Boolean).join(' ');
  return (
    <select className={cls} {...rest}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/** Table that scrolls inside its own container rather than widening the page (SC-010). */
export function Table({ columns, rows, empty = 'Nothing to show' }) {
  if (!rows || rows.length === 0) return <EmptyState message={empty} />;
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i}>
              {columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A search or filter that matches nothing shows this, never an error (spec Edge Cases). */
export function EmptyState({ message }) {
  return <p className="empty-state">{message}</p>;
}

export function Badge({ value, kind, children }) {
  const cls = ['badge', value ? `badge--${value}` : '', kind ? `badge--${kind}` : '']
    .filter(Boolean).join(' ');
  return <span className={cls}>{children ?? value}</span>;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),'
  + 'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog. While open: Escape closes it (when closable), Tab/Shift+Tab are
 * trapped inside it, the page behind does not scroll, and focus returns to the element that
 * opened it on close. `onClose` is undefined while a save is in flight, which disables
 * Escape and backdrop-click closing together.
 */
export function Modal({ title, onClose, children }) {
  const dialogRef = useRef(null);
  // Captured during the first render, i.e. before any child's autoFocus moves focus.
  const triggerRef = useRef(typeof document === 'undefined' ? null : document.activeElement);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    const focusables = () => [...dialog.querySelectorAll(FOCUSABLE)]
      .filter((el) => el.offsetParent !== null || el === document.activeElement);

    if (!dialog.contains(document.activeElement)) (focusables()[0] ?? dialog).focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        if (onCloseRef.current) { event.stopPropagation(); onCloseRef.current(); }
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) { event.preventDefault(); dialog.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && (active === first || active === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (trigger && trigger.isConnected && typeof trigger.focus === 'function') trigger.focus();
    };
  }, []);

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true"
           aria-label={title} onClick={(e) => e.stopPropagation()}>
        {title && <h2 className="page-title">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Card({ children }) { return <div className="card">{children}</div>; }
