import { useEffect, useState } from 'react';
import { apiGet, apiPost, errorMessage } from '../api/client';
import { Spinner, EmptyState, Modal, Field, useToast, StatusBadge, PageHeader } from '../components/ui';

const DEVICE_TYPES = ['HEART_RATE', 'SPO2', 'TEMPERATURE', 'BLOOD_PRESSURE', 'ECG', 'GLUCOSE', 'RESPIRATORY_RATE', 'MULTI_SENSOR', 'OTHER'];

export default function Devices() {
  const { push, toastStack } = useToast();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ device_code: '', device_name: '', device_type: 'MULTI_SENSOR', manufacturer: '', model: '' });
  const [assignTarget, setAssignTarget] = useState(null);
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState('');

  const load = () => {
    setLoading(true);
    apiGet('/sensors')
      .then(setDevices)
      .catch(() => setDevices([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    try {
      await apiPost('/sensors', form);
      push('Device registered', 'success');
      setShowModal(false);
      load();
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  };

  const openAssign = async (d) => {
    setAssignTarget(d);
    setPatientId('');
    try {
      setPatients(await apiGet('/patients', { limit: 100 }));
    } catch {}
  };

  const assign = async () => {
    if (!patientId) return;
    try {
      await apiPost(`/sensors/${assignTarget.id}/assign/${patientId}`, {});
      push('Device assigned to patient', 'success');
      setAssignTarget(null);
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Medical Devices"
        actions={<button className="btn" onClick={() => setShowModal(true)}>+ Register Device</button>}
      />

      <div className="inline-alert info" style={{ wordBreak: 'break-word' }}>
        Sensor integration: devices POST vitals to <code>POST /api/sensors/ingest</code> with header <code>x-api-key: dev-sensor-key-123</code>.
      </div>

      {loading ? <Spinner /> : devices.length === 0 ? <EmptyState message="No devices" /> : (
        <div className="table-wrap">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr><th>Code</th><th>Name</th><th>Type</th><th>Model</th><th>Status</th><th>Last Seen</th><th>Action</th></tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.device_code}</td>
                    <td>{d.device_name}</td>
                    <td>{d.device_type}</td>
                    <td>{d.model || '—'}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td className="muted">{d.last_seen ? new Date(d.last_seen).toLocaleString() : 'never'}</td>
                    <td><button className="btn btn-secondary btn-sm" onClick={() => openAssign(d)}>Assign</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <Modal title="Register Medical Device" onClose={() => setShowModal(false)}>
          <div className="form-grid">
            <Field label="Device Code"><input value={form.device_code} onChange={set('device_code')} required /></Field>
            <Field label="Device Name"><input value={form.device_name} onChange={set('device_name')} required /></Field>
            <Field label="Type">
              <select value={form.device_type} onChange={set('device_type')}>
                {DEVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Manufacturer"><input value={form.manufacturer} onChange={set('manufacturer')} /></Field>
            <Field label="Model"><input value={form.model} onChange={set('model')} /></Field>
          </div>
          <div className="text-right">
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn" style={{ marginLeft: 8 }} onClick={submit}>Register</button>
          </div>
        </Modal>
      )}

      {assignTarget && (
        <Modal title={`Assign ${assignTarget.device_name} to patient`} onClose={() => setAssignTarget(null)}>
          <Field label="Patient">
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Select patient...</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.patient_number})</option>)}
            </select>
          </Field>
          <div className="text-right">
            <button className="btn btn-secondary" onClick={() => setAssignTarget(null)}>Cancel</button>
            <button className="btn" style={{ marginLeft: 8 }} disabled={!patientId} onClick={assign}>Assign</button>
          </div>
        </Modal>
      )}
      {toastStack}
    </>
  );
}
