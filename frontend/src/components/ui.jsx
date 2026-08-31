import { useState } from 'react';

export function StatCard({ label, value, sub, color = '#0d9488', icon }) {
  return (
    <div className="stat-card">
      <div className="accent-dot" style={{ background: `${color}20`, color }}>
        {icon || '●'}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'gray' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

const SEV_TONE = { LOW: 'green', MEDIUM: 'amber', HIGH: 'red', CRITICAL: 'red' };

export function SeverityBadge({ severity }) {
  return (
    <span className={`badge badge-${SEV_TONE[severity] || 'gray'} sev-${severity}`}>
      {severity || 'N/A'}
    </span>
  );
}

const STATUS_TONE = {
  ACTIVE: 'green', ADMITTED: 'blue', DISCHARGED: 'gray', CRITICAL: 'red', DECEASED: 'gray',
  NEW: 'red', ACKNOWLEDGED: 'amber', IN_PROGRESS: 'blue', RESOLVED: 'green', ESCALATED: 'red',
  OPEN: 'blue', CLOSED: 'green', SCHEDULED: 'blue', CONFIRMED: 'teal', COMPLETED: 'green',
  CANCELLED: 'gray', NO_SHOW: 'amber', REQUESTED: 'amber', PROCESSING: 'blue',
  MALE: 'blue', FEMALE: 'red', OTHER: 'gray',
};

export function StatusBadge({ status }) {
  return <span className={`badge badge-${STATUS_TONE[status] || 'gray'}`}>{status || '—'}</span>;
}

export function RiskBadge({ level, score }) {
  const tone = { LOW: 'green', MEDIUM: 'amber', HIGH: 'red', CRITICAL: 'red' }[level] || 'gray';
  const fill = { LOW: '#16a34a', MEDIUM: '#d97706', HIGH: '#dc2626', CRITICAL: '#991b1b' }[level] || '#64748b';
  return (
    <div style={{ minWidth: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <Badge tone={tone}>{level}</Badge>
        {score !== undefined && <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{Number(score).toFixed(3)}</span>}
      </div>
      {score !== undefined && (
        <div className="risk-meter">
          <div className="fill" style={{ width: `${Math.min(100, Number(score) * 100).toFixed(0)}%`, background: fill }} />
        </div>
      )}
    </div>
  );
}

export function Spinner({ text = 'Loading...' }) {
  return (
    <div className="empty-state">
      <span className="spinner" style={{ borderColor: '#cbd5e1', borderTopColor: '#0d9488', width: 28, height: 28 }} />
      <div className="muted mt-4">{text}</div>
    </div>
  );
}

export function EmptyState({ message = 'No data available' }) {
  return <div className="empty-state">{message}</div>;
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal" style={wide ? { maxWidth: 800 } : {}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, actions }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = (message, type = 'info', timeout = 6000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), timeout);
  };
  const toastStack = (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
  return { push, toastStack };
}
