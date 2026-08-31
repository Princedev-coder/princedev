import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api/client';
import { getSocket } from '../socket';
import { Spinner, EmptyState } from '../components/ui';

export default function Monitor() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState({});

  useEffect(() => {
    apiGet('/patients', { limit: 100 })
      .then((d) => setPatients(d))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on('vital:reading', (v) => {
      setLive((prev) => ({ ...prev, [v.patient_id]: v }));
    });
    socket.on('alert:new', (a) => {
      setLive((prev) => ({ ...prev, [a.patient_id]: { ...prev[a.patient_id], _alert: a } }));
    });
    return () => {
      socket.off('vital:reading');
      socket.off('alert:new');
    };
  }, []);

  if (loading) return <Spinner />;
  if (patients.length === 0) return <EmptyState message="No patients to monitor" />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Live Patient Monitoring</h1>
          <div className="muted">Real-time vital feeds via WebSocket</div>
        </div>
      </div>
      <div className="grid grid-3">
        {patients.map((p) => {
          const v = live[p.id] || {};
          const alert = v._alert;
          return (
            <div key={p.id} className="card" style={{ borderColor: alert ? 'var(--danger)' : 'var(--border)', borderWidth: alert ? 2 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.first_name} {p.last_name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{p.patient_number}</div>
                </div>
                <span className="badge badge-green" style={{ flexShrink: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block', marginRight: 5, animation: 'pulse 1.2s infinite' }} />
                  LIVE
                </span>
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <Mini label="HR" value={v.heart_rate} unit="bpm" danger={v.heart_rate != null && (v.heart_rate < 60 || v.heart_rate > 100)} />
                <Mini label="SpO₂" value={v.spo2} unit="%" danger={v.spo2 != null && v.spo2 < 95} />
                <Mini label="Temp" value={v.temperature} unit="°C" danger={v.temperature != null && (v.temperature < 36.1 || v.temperature > 37.8)} />
              </div>
              {alert && (
                <div className="inline-alert error" style={{ marginTop: 10, marginBottom: 0 }}>
                  {alert.alert_type}: {alert.message}
                </div>
              )}
              <div className="mt-4">
                <Link className="btn btn-sm w-100" to={`/monitor/${p.id}`} style={{ justifyContent: 'center' }}>Open Monitor</Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Mini({ label, value, unit, danger }) {
  return (
    <div className="vital-big" style={danger ? { borderColor: 'var(--danger)', background: '#fef2f2' } : {}}>
      <div className="v-label">{label}</div>
      <div className="v-value" style={{ fontSize: 20, color: value == null ? 'var(--text-muted)' : danger ? 'var(--danger)' : 'var(--primary-dark)' }}>
        {value ?? '—'}
      </div>
      <div className="v-unit">{unit}</div>
    </div>
  );
}
