import { useEffect, useState } from 'react';
import { apiGet } from '../api/client';
import { Spinner, EmptyState } from '../components/ui';

export default function AuditLogs() {
  const [tab, setTab] = useState('audit');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiGet(tab === 'audit' ? '/audit-logs' : '/security-events', { limit: 100 })
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [tab]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Audit Trail</h1>
          <div className="muted">Every medical and security action is logged for compliance</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>Audit Logs</button>
        <button className={`tab ${tab === 'security' ? 'active' : ''}`} onClick={() => setTab('security')}>Security Events</button>
      </div>

      {loading ? <Spinner /> : rows.length === 0 ? <EmptyState message="No logs" /> : (
        <div className="table-wrap">
          <table>
            <thead>
              {tab === 'audit'
                ? <tr><th>User</th><th>Role</th><th>Action</th><th>Entity</th><th>Description</th><th>IP</th><th>When</th></tr>
                : <tr><th>User</th><th>Event</th><th>Details</th><th>IP</th><th>When</th></tr>}
            </thead>
            <tbody>
              {tab === 'audit'
                ? rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.full_name || 'System'}</td>
                      <td>{r.role || '—'}</td>
                      <td><span className="badge badge-blue">{r.action}</span></td>
                      <td>{r.entity_type || '—'}#{r.entity_id || ''}</td>
                      <td style={{ maxWidth: 360, whiteSpace: 'normal' }}>{r.description || '—'}</td>
                      <td className="muted">{r.ip_address || '—'}</td>
                      <td className="muted">{new Date(r.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                : rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.full_name || 'Unknown'}</td>
                      <td><span className={`badge badge-${r.event_type === 'LOGIN_FAILED' || r.event_type === 'ACCOUNT_LOCKED' || r.event_type === 'SUSPICIOUS_ACTIVITY' ? 'red' : 'green'}`}>{r.event_type}</span></td>
                      <td style={{ maxWidth: 360, whiteSpace: 'normal' }}>{r.details || '—'}</td>
                      <td className="muted">{r.ip_address || '—'}</td>
                      <td className="muted">{new Date(r.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
