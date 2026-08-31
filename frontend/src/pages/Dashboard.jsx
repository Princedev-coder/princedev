import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatCard, SeverityBadge, RiskBadge, Spinner, EmptyState } from '../components/ui';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/dashboard')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState message="No dashboard data available" />;

  if (user.role === 'ADMIN') {
    return <AdminDashboard data={data} />;
  }
  if (user.role === 'DOCTOR' || user.role === 'NURSE') {
    return <StaffDashboard data={data} role={user.role} />;
  }
  return <PatientDashboard data={data} />;
}

function AdminDashboard({ data }) {
  const s = data.stats;
  return (
    <>
      <div className="grid grid-4 mb-4">
        <StatCard label="Total Patients" value={s.patients} color="#0d9488" icon="🧑‍⚕️" />
        <StatCard label="Doctors" value={s.doctors} color="#2563eb" icon="🩺" />
        <StatCard label="Nurses" value={s.nurses} color="#7c3aed" icon="💉" />
        <StatCard label="Medical Devices" value={s.devices} color="#d97706" icon="📟" />
        <StatCard label="New Alerts" value={data.alerts.new_alerts} color="#dc2626" icon="🔔" />
        <StatCard label="Critical Alerts" value={data.alerts.critical_alerts} color="#991b1b" icon="🚨" />
        <StatCard label="Admitted Patients" value={s.admitted} color="#2563eb" icon="🏥" />
        <StatCard label="Critical Patients" value={s.critical_patients} color="#dc2626" icon="⚠️" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">Recent Alerts</div>
          {data.recent_alerts.length === 0 ? <EmptyState /> : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr><th>Patient</th><th>Type</th><th>Severity</th><th>Status</th><th>When</th></tr>
                </thead>
                <tbody>
                  {data.recent_alerts.map((a) => (
                    <tr key={a.id}>
                      <td>{a.patient_name || `#${a.patient_id}`}</td>
                      <td>{a.alert_type}</td>
                      <td><SeverityBadge severity={a.severity} /></td>
                      <td>{a.status}</td>
                      <td className="muted">{new Date(a.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-title">Activity (last 14 days)</div>
          {data.activity.length === 0 ? <EmptyState /> : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160, paddingTop: 10 }}>
              {data.activity.map((a, i) => {
                const max = Math.max(...data.activity.map((x) => x.count));
                return (
                  <div key={i} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                    <div style={{ background: '#0d9488', borderRadius: '4px 4px 0 0', height: `${(a.count / (max || 1)) * 130}px`, minHeight: 3 }} />
                    <div className="muted" style={{ fontSize: 9, marginTop: 4 }}>{new Date(a.day).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StaffDashboard({ data, role }) {
  const s = data.stats;
  return (
    <>
      <div className="grid grid-4 mb-4">
        <StatCard label="My Patients" value={s.my_patients} color="#0d9488" icon="🧑‍⚕️" />
        <StatCard label="Open Alerts" value={s.open_alerts} color="#d97706" icon="🔔" />
        <StatCard label="Critical Alerts" value={s.critical_alerts} color="#dc2626" icon="🚨" />
        <StatCard label="Appointments Today" value={s.today_appointments} color="#2563eb" icon="📅" />
      </div>
      <div className="card">
        <div className="card-title">
          My Active Alerts
          <Link to="/alerts" className="btn btn-secondary btn-sm">View all</Link>
        </div>
        {data.my_alerts.length === 0 ? <EmptyState message="No active alerts for your patients" /> : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr><th>Patient</th><th>Type</th><th>Severity</th><th>Message</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.my_alerts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.patient_name || `#${a.patient_id}`}</td>
                    <td>{a.alert_type}</td>
                    <td><SeverityBadge severity={a.severity} /></td>
                    <td>{a.message}</td>
                    <td>{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function PatientDashboard({ data }) {
  const s = data.stats;
  if (data.profile_linked === false) {
    return <EmptyState message="No patient profile linked to this account yet." />;
  }
  const v = data.latest_vitals;
  return (
    <>
      <div className="grid grid-4 mb-4">
        <StatCard label="Total Readings" value={s.total_readings} color="#0d9488" icon="📊" />
        <StatCard label="Appointments Today" value={s.today_appointments} color="#2563eb" icon="📅" />
        <StatCard label="Active Prescriptions" value={s.active_prescriptions} color="#7c3aed" icon="💊" />
        <StatCard label="Latest Risk" value={<span style={{ color: s.latest_risk_level === 'LOW' ? '#16a34a' : s.latest_risk_level === 'MEDIUM' ? '#d97706' : '#dc2626' }}>{s.latest_risk_level || '—'}</span>} color="#d97706" icon="🧠" />
      </div>

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-title">Latest Vitals</div>
          {!v ? <EmptyState message="No vitals recorded yet" /> : (
            <div className="grid grid-3">
              <Vital value={v.heart_rate} label="Heart Rate" unit="bpm" normal={v.heart_rate >= 60 && v.heart_rate <= 100} />
              <Vital value={v.spo2} label="SpO₂" unit="%" normal={v.spo2 >= 95} />
              <Vital value={v.temperature} label="Temp" unit="°C" normal={v.temperature >= 36.1 && v.temperature <= 37.8} />
              <Vital value={v.systolic_pressure && `${v.systolic_pressure}/${v.diastolic_pressure}`} label="Blood Pressure" unit="mmHg" normal={v.systolic_pressure >= 90 && v.systolic_pressure <= 140} />
              <Vital value={v.respiratory_rate} label="Resp. Rate" unit="/min" normal={v.respiratory_rate >= 12 && v.respiratory_rate <= 20} />
              <Vital value={v.blood_glucose} label="Glucose" unit="mg/dL" normal={v.blood_glucose >= 70 && v.blood_glucose <= 140} />
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-title">Latest Risk Assessment</div>
          {s.latest_risk_level ? <RiskBadge level={s.latest_risk_level} score={s.latest_risk_score} /> : <EmptyState message="No AI analysis yet" />}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Upcoming Appointments</div>
        {data.upcoming_appointments.length === 0 ? <EmptyState message="No upcoming appointments" /> : (
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>Doctor</th><th>Date & Time</th><th>Reason</th><th>Status</th></tr></thead>
              <tbody>
                {data.upcoming_appointments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.doctor_name}</td>
                    <td>{new Date(a.appointment_date).toLocaleString()}</td>
                    <td>{a.reason}</td>
                    <td>{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Vital({ value, label, unit, normal }) {
  return (
    <div className="vital-big">
      <div className="v-label">{label}</div>
      <div className="v-value" style={{ color: value == null || value === '' ? 'var(--text-muted)' : normal === false ? 'var(--danger)' : 'var(--primary-dark)' }}>
        {value == null || value === '' ? '—' : value}
      </div>
      <div className="v-unit">{unit}</div>
    </div>
  );
}
