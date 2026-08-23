import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { apiGet } from '../api/client';
import { getSocket } from '../socket';
import { SeverityBadge, RiskBadge, Spinner, EmptyState } from '../components/ui';

const FIELDS = [
  { key: 'heart_rate', label: 'Heart Rate', unit: 'bpm', color: '#dc2626', min: 60, max: 100 },
  { key: 'spo2', label: 'SpO₂', unit: '%', color: '#2563eb', min: 95, max: null },
  { key: 'temperature', label: 'Temp', unit: '°C', color: '#d97706', min: 36.1, max: 37.8 },
  { key: 'systolic_pressure', label: 'Systolic', unit: 'mmHg', color: '#7c3aed', min: 90, max: 140 },
  { key: 'respiratory_rate', label: 'Resp. Rate', unit: '/min', color: '#0d9488', min: 12, max: 20 },
];

export default function MonitorPatient() {
  const path = window.location.pathname;
  const id = path.split('/').pop();
  const patientId = Number(id);

  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [latestRisk, setLatestRisk] = useState(null);
  const [loading, setLoading] = useState(true);
  const maxPoints = useRef(60);

  useEffect(() => {
    Promise.all([
      apiGet(`/patients/${patientId}`),
      apiGet(`/vitals/patients/${patientId}`, { limit: 100 }),
    ])
      .then(([p, v]) => {
        setPatient(p);
        setHistory(v.slice().reverse());
        if (p.vitals?.total) {
          const pred = { risk_level: '—', risk_score: 0 };
          setLatestRisk(pred);
        }
      })
      .catch(() => setPatient(null))
      .finally(() => setLoading(false));
  }, [patientId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('monitor:patient', patientId);
    socket.on('vital:reading', (v) => {
      if (v.patient_id !== patientId) return;
      setHistory((prev) => {
        const next = [...prev, { ...v, _t: new Date().toLocaleTimeString() }];
        return next.slice(-maxPoints.current);
      });
    });
    socket.on('alert:new', (a) => {
      if (a.patient_id === patientId) {
        setLiveAlerts((prev) => [a, ...prev].slice(0, 8));
      }
    });
    socket.on('prediction:new', (p) => {
      if (p.patient_id === patientId) setLatestRisk(p);
    });
    return () => {
      socket.emit('monitor:stop', patientId);
      socket.off('vital:reading');
      socket.off('alert:new');
      socket.off('prediction:new');
    };
  }, [patientId]);

  if (loading) return <Spinner />;
  if (!patient) return <EmptyState message="Patient not found or access denied" />;

  const latest = history[history.length - 1] || {};
  const data = history.map((h, i) => ({
    ...h,
    name: h._t || new Date(h.recorded_at).toLocaleTimeString(),
  }));

  return (
    <>
      <div className="page-header">
        <div>
          <h1>📡 {patient.first_name} {patient.last_name}</h1>
          <div className="muted">{patient.patient_number} · Live monitoring</div>
        </div>
        <Link className="btn btn-secondary" to="/monitor">All Patients</Link>
      </div>

      <div className="grid grid-4 mb-4">
        {FIELDS.slice(0, 4).map((f) => (
          <div key={f.key} className="vital-big" style={latest[f.key] !== undefined && latest[f.key] !== null && ((f.min && latest[f.key] < f.min) || (f.max && latest[f.key] > f.max)) ? { borderColor: 'var(--danger)', background: '#fef2f2', animation: 'pulse 1.2s infinite' } : {}}>
            <div className="v-label">{f.label}</div>
            <div className="v-value">{latest[f.key] ?? '—'}</div>
            <div className="v-unit">{f.unit}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-2 mb-4">
        {FIELDS.map((f) => (
          <div className="card" key={f.key}>
            <div className="card-title">{f.label} ({f.unit})</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data}>
                <XAxis dataKey="name" hide />
                <YAxis domain={['auto', 'auto']} width={36} />
                <Tooltip />
                {f.min !== null && <ReferenceLine y={f.min} stroke="#dc2626" strokeDasharray="4 4" />}
                {f.max !== null && <ReferenceLine y={f.max} stroke="#dc2626" strokeDasharray="4 4" />}
                <Line type="monotone" dataKey={f.key} stroke={f.color} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
        <div className="card">
          <div className="card-title">Risk Assessment</div>
          {latestRisk ? <RiskBadge level={latestRisk.risk_level} score={latestRisk.risk_score} /> : <EmptyState message="No prediction yet" />}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Live Alerts</div>
        {liveAlerts.length === 0 ? <EmptyState message="No live alerts" /> : (
          <table>
            <thead><tr><th>Type</th><th>Severity</th><th>Message</th><th>Status</th></tr></thead>
            <tbody>
              {liveAlerts.map((a) => (
                <tr key={a.id}>
                  <td>{a.alert_type}</td>
                  <td><SeverityBadge severity={a.severity} /></td>
                  <td>{a.message}</td>
                  <td>{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
