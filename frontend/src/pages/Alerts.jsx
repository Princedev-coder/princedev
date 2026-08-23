import { useEffect, useState } from 'react';
import { apiGet, apiPost, errorMessage } from '../api/client';
import { SeverityBadge, Spinner, EmptyState, useToast } from '../components/ui';

export default function Alerts() {
  const { push, toastStack } = useToast();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');

  const load = () => {
    setLoading(true);
    apiGet('/alerts', { status: status || undefined, severity: severity || undefined, limit: 50 })
      .then(setAlerts)
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [status, severity]);

  const act = async (id, action) => {
    try {
      await apiPost(`/alerts/${id}/${action}`, {});
      push(`Alert ${action}d`, 'success');
      load();
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Alerts</h1>
      </div>
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">All severities</option>
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : alerts.length === 0 ? <EmptyState message="No alerts" /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Patient</th><th>Type</th><th>Severity</th><th>Message</th><th>Status</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} style={a.severity === 'CRITICAL' && a.status !== 'RESOLVED' ? { background: '#fff5f5' } : {}}>
                  <td style={{ fontWeight: 600 }}>{a.patient_name || `#${a.patient_id}`}</td>
                  <td>{a.alert_type}</td>
                  <td><SeverityBadge severity={a.severity} /></td>
                  <td>{a.message}</td>
                  <td>{a.status}</td>
                  <td className="muted">{new Date(a.created_at).toLocaleString()}</td>
                  <td>
                    {a.status === 'NEW' && <button className="btn btn-secondary btn-sm" onClick={() => act(a.id, 'acknowledge')}>Acknowledge</button>}
                    {a.status !== 'RESOLVED' && <button className="btn btn-sm" style={{ marginLeft: 4 }} onClick={() => act(a.id, 'resolve')}>Resolve</button>}
                    {['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(a.status) && (
                      <button className="btn btn-danger btn-sm" style={{ marginLeft: 4 }} onClick={() => act(a.id, 'escalate')}>Escalate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {toastStack}
    </>
  );
}
