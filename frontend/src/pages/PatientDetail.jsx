import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGet, apiPost, errorMessage } from '../api/client';
import { StatusBadge, SeverityBadge, RiskBadge, Spinner, EmptyState, Modal, Field, useToast } from '../components/ui';

export default function PatientDetail() {
  const { id } = useParams();
  const { push, toastStack } = useToast();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vitals, setVitals] = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [assignForm, setAssignForm] = useState({ doctor_id: '', nurse_id: '' });
  const [showVital, setShowVital] = useState(false);
  const [vitalForm, setVitalForm] = useState({ heart_rate: '', spo2: '', temperature: '', systolic_pressure: '', diastolic_pressure: '', respiratory_rate: '', blood_glucose: '' });

  useEffect(() => {
    Promise.all([apiGet(`/patients/${id}`), apiGet('/vitals/patients/' + id, { limit: 50 })])
      .then(([p, v]) => { setPatient(p); setVitals(v); })
      .catch(() => setPatient(null))
      .finally(() => setLoading(false));
  }, [id]);

  const openAssign = async () => {
    setShowAssign(true);
    try {
      const [d, n] = await Promise.all([apiGet('/staff/doctors'), apiGet('/staff/nurses')]);
      setDoctors(d);
      setNurses(n);
    } catch {}
  };

  const submitAssign = async () => {
    try {
      await apiPost(`/patients/${id}/assignments`, {
        doctor_id: assignForm.doctor_id ? Number(assignForm.doctor_id) : null,
        nurse_id: assignForm.nurse_id ? Number(assignForm.nurse_id) : null,
      });
      push('Assignment saved', 'success');
      setShowAssign(false);
      apiGet(`/patients/${id}`).then(setPatient);
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  };

  const setV = (k) => (e) => setVitalForm((f) => ({ ...f, [k]: e.target.value }));

  const submitVital = async () => {
    try {
      const values = {};
      for (const [k, v] of Object.entries(vitalForm)) {
        if (v !== '') values[k] = Number(v);
      }
      const res = await apiPost('/vitals', { patient_id: Number(id), values });
      push(`Vitals recorded — ${res.alerts.length} alert(s) triggered`, res.alerts.length ? 'alert' : 'success');
      setShowVital(false);
      setVitalForm({});
      apiGet(`/vitals/patients/${id}`, { limit: 50 }).then(setVitals);
      apiGet(`/patients/${id}`).then(setPatient);
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  };

  if (loading) return <Spinner />;
  if (!patient) return <EmptyState message="Patient not found or access denied" />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{patient.first_name} {patient.last_name}</h1>
          <div className="muted">{patient.patient_number} · {patient.gender} · {patient.blood_group}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn btn-secondary" to={`/monitor/${patient.id}`}>📡 Live Monitor</Link>
          <button className="btn btn-secondary" onClick={() => setShowVital(true)}>+ Record Vitals</button>
          <button className="btn" onClick={openAssign}>Assign Staff</button>
        </div>
      </div>

      <div className="grid grid-3 mb-4">
        <div className="card">
          <div className="card-title">Patient Info</div>
          <p><strong>DOB:</strong> {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : '—'}</p>
          <p><strong>Status:</strong> <StatusBadge status={patient.status} /></p>
          <p><strong>Email:</strong> {patient.email || '—'}</p>
          <p><strong>Phone:</strong> {patient.phone || '—'}</p>
          <p><strong>City:</strong> {patient.city || '—'}</p>
          {patient.allergies && <p><strong>Allergies:</strong> <span className="badge badge-red">{patient.allergies}</span></p>}
        </div>
        <div className="card">
          <div className="card-title">Latest Vitals</div>
          {patient.vitals?.latest ? (
            <div>
              {patient.vitals.latest.heart_rate && <p><strong>HR:</strong> {patient.vitals.latest.heart_rate} bpm</p>}
              {patient.vitals.latest.spo2 && <p><strong>SpO₂:</strong> {patient.vitals.latest.spo2}%</p>}
              {patient.vitals.latest.temperature && <p><strong>Temp:</strong> {patient.vitals.latest.temperature}°C</p>}
              {patient.vitals.latest.systolic_pressure && <p><strong>BP:</strong> {patient.vitals.latest.systolic_pressure}/{patient.vitals.latest.diastolic_pressure} mmHg</p>}
              <p className="muted" style={{ marginTop: 8 }}>{patient.vitals.total} total readings</p>
            </div>
          ) : <EmptyState message="No vitals yet" />}
        </div>
        <div className="card">
          <div className="card-title">Assigned Staff & Devices</div>
          {patient.assignments?.length ? patient.assignments.map((a) => (
            <p key={a.id}><strong>Doctor:</strong> {a.doctor_name || '—'} · <strong>Nurse:</strong> {a.nurse_name || '—'}</p>
          )) : <p className="muted">No active assignments</p>}
          {patient.devices?.length ? patient.devices.map((d) => (
            <p key={d.id}>📟 {d.device_name} ({d.device_code})</p>
          )) : <p className="muted">No devices assigned</p>}
        </div>
      </div>

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-title">Medical History</div>
          {patient.medical_history.length === 0 ? <EmptyState message="No conditions recorded" /> : (
            <table>
              <thead><tr><th>Condition</th><th>Status</th><th>Diagnosed</th></tr></thead>
              <tbody>
                {patient.medical_history.map((h) => (
                  <tr key={h.id}>
                    <td>{h.condition_name}</td>
                    <td><StatusBadge status={h.status} /></td>
                    <td>{h.diagnosed_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <div className="card-title">Recent Readings</div>
          {vitals.length === 0 ? <EmptyState message="No readings" /> : (
            <table>
              <thead><tr><th>When</th><th>HR</th><th>SpO₂</th><th>Temp</th><th>BP</th></tr></thead>
              <tbody>
                {vitals.slice(0, 10).map((v) => (
                  <tr key={v.id}>
                    <td className="muted">{new Date(v.recorded_at).toLocaleString()}</td>
                    <td>{v.heart_rate || '—'}</td>
                    <td>{v.spo2 || '—'}</td>
                    <td>{v.temperature || '—'}</td>
                    <td>{v.systolic_pressure ? `${v.systolic_pressure}/${v.diastolic_pressure}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAssign && (
        <Modal title="Assign Doctor / Nurse" onClose={() => setShowAssign(false)}>
          <Field label="Doctor">
            <select value={assignForm.doctor_id} onChange={(e) => setAssignForm((f) => ({ ...f, doctor_id: e.target.value }))}>
              <option value="">— None —</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name} ({d.specialization || 'GP'})</option>)}
            </select>
          </Field>
          <Field label="Nurse">
            <select value={assignForm.nurse_id} onChange={(e) => setAssignForm((f) => ({ ...f, nurse_id: e.target.value }))}>
              <option value="">— None —</option>
              {nurses.map((n) => <option key={n.id} value={n.id}>{n.full_name}</option>)}
            </select>
          </Field>
          <div className="text-right">
            <button className="btn btn-secondary" onClick={() => setShowAssign(false)}>Cancel</button>
            <button className="btn" style={{ marginLeft: 8 }} onClick={submitAssign}>Save</button>
          </div>
        </Modal>
      )}

      {showVital && (
        <Modal title="Record Vitals" onClose={() => setShowVital(false)}>
          <div className="form-grid">
            <Field label="Heart Rate (bpm)"><input type="number" value={vitalForm.heart_rate} onChange={setV('heart_rate')} /></Field>
            <Field label="SpO₂ (%)"><input type="number" value={vitalForm.spo2} onChange={setV('spo2')} /></Field>
            <Field label="Temperature (°C)"><input type="number" step="0.1" value={vitalForm.temperature} onChange={setV('temperature')} /></Field>
            <Field label="Systolic (mmHg)"><input type="number" value={vitalForm.systolic_pressure} onChange={setV('systolic_pressure')} /></Field>
            <Field label="Diastolic (mmHg)"><input type="number" value={vitalForm.diastolic_pressure} onChange={setV('diastolic_pressure')} /></Field>
            <Field label="Respiratory Rate"><input type="number" value={vitalForm.respiratory_rate} onChange={setV('respiratory_rate')} /></Field>
            <Field label="Blood Glucose"><input type="number" value={vitalForm.blood_glucose} onChange={setV('blood_glucose')} /></Field>
          </div>
          <div className="text-right">
            <button className="btn btn-secondary" onClick={() => setShowVital(false)}>Cancel</button>
            <button className="btn" style={{ marginLeft: 8 }} onClick={submitVital}>Save Reading</button>
          </div>
        </Modal>
      )}
      {toastStack}
    </>
  );
}
