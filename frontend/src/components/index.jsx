// T030 — Shared presentational components. Plain React, no UI library (Constitution II).
import '../styles/components.css';

export function Button({ variant, children, ...rest }) {
  const cls = ['btn', variant ? `btn--${variant}` : ''].filter(Boolean).join(' ');
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

export function Select({ options = [], ...rest }) {
  return (
    <select className="select" {...rest}>
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

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}
           onClick={(e) => e.stopPropagation()}>
        {title && <h2 className="page-title">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Card({ children }) { return <div className="card">{children}</div>; }
