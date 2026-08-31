import { useEffect, useState } from 'react';
import { apiGet, apiPost, errorMessage } from '../api/client';
import { Spinner, EmptyState, Modal, Field, useToast, StatusBadge, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { key: 'records', label: 'Medical Records' },
  { key: 'prescriptions', label: 'Prescriptions' },
  { key: 'labs', label: 'Lab Tests' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'history', label: 'Medical History' },
  { key: 'notes', label: 'Nurse Notes' },
];

export default function Records() {
  const { user } = useAuth();
  const { push, toastStack } = useToast();
  const [tab, setTab] = useState(user.role === 'PATIENT' ? 'records' : 'records');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [form, setForm] = useState({});
  const [prescriptionDetail, setPrescriptionDetail] = useState(null);

  const canCreate = user.role !== 'PATIENT';

  const load = () => {
    setLoading(true);
    apiGet(`/records/${tab}`, { limit: 50 })
      .then((d) => setRows(d))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [tab]);

  const openCreate = async () => {
    setShowModal(true);
    setForm({});
    try {
      const [p, d, n] = await Promise.all([
        apiGet('/patients', { limit: 100 }),
        apiGet('/staff/doctors'),
        apiGet('/staff/nurses'),
      ]);
      setPatients(p);
      setDoctors(d);
      setNurses(n);
    } catch {}
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    const payload = { ...form };
    for (const k of ['patient_id', 'doctor_id', 'nurse_id', 'medical_record_id']) {
      if (payload[k]) payload[k] = Number(payload[k]);
    }
    try {
      await apiPost(`/records/${tab}`, payload);
      push('Record created', 'success');
      setShowModal(false);
      load();
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  };

  const viewPrescription = async (id) => {
    try {
      setPrescriptionDetail(await apiGet(`/records/prescriptions/${id}`));
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  };

  const RENDERERS = {
    records: {
      cols: ['Patient', 'Diagnosis', 'Status', 'Date'],
      row: (r) => [r.patient_name || `#${r.patient_id}`, r.diagnosis || '—', r.status, new Date(r.record_date).toLocaleDateString()],
      form: () => (
        <>
          <Field label="Patient"><select value={form.patient_id || ''} onChange={set('patient_id')} required>{patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></Field>
          <Field label="Doctor"><select value={form.doctor_id || ''} onChange={set('doctor_id')}>{doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></Field>
          <Field label="Chief Complaint"><input value={form.chief_complaint || ''} onChange={set('chief_complaint')} /></Field>
          <Field label="Symptoms"><input value={form.symptoms || ''} onChange={set('symptoms')} /></Field>
          <Field label="Diagnosis"><input value={form.diagnosis || ''} onChange={set('diagnosis')} /></Field>
          <Field label="Treatment Plan"><textarea rows={2} value={form.treatment_plan || ''} onChange={set('treatment_plan')} /></Field>
        </>
      ),
    },
    prescriptions: {
      cols: ['Patient', 'Doctor', 'Status', 'Date', ''],
      row: (r) => [r.patient_name || `#${r.patient_id}`, r.doctor_name || '—', r.status, new Date(r.prescription_date).toLocaleDateString()],
      form: () => (
        <>
          <Field label="Patient"><select value={form.patient_id || ''} onChange={set('patient_id')} required>{patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></Field>
          <Field label="Doctor"><select value={form.doctor_id || ''} onChange={set('doctor_id')} required>{doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></Field>
          <Field label="Notes"><textarea rows={2} value={form.notes || ''} onChange={set('notes')} /></Field>
        </>
      ),
      detail: (r) => viewPrescription(r.id),
    },
    labs: {
      cols: ['Patient', 'Test', 'Type', 'Status', 'Result'],
      row: (r) => [r.patient_name || `#${r.patient_id}`, r.test_name, r.test_type || '—', r.status, r.result || '—'],
      form: () => (
        <>
          <Field label="Patient"><select value={form.patient_id || ''} onChange={set('patient_id')} required>{patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></Field>
          <Field label="Doctor"><select value={form.doctor_id || ''} onChange={set('doctor_id')}>{doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></Field>
          <Field label="Test Name"><input value={form.test_name || ''} onChange={set('test_name')} required /></Field>
          <Field label="Test Type"><input value={form.test_type || ''} onChange={set('test_type')} /></Field>
          <Field label="Reference Range"><input value={form.reference_range || ''} onChange={set('reference_range')} /></Field>
        </>
      ),
    },
    appointments: {
      cols: ['Patient', 'Doctor', 'Date & Time', 'Reason', 'Status'],
      row: (r) => [r.patient_name || `#${r.patient_id}`, r.doctor_name || '—', new Date(r.appointment_date).toLocaleString(), r.reason || '—', r.status],
      form: () => (
        <>
          <Field label="Patient"><select value={form.patient_id || ''} onChange={set('patient_id')} required>{patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></Field>
          <Field label="Doctor"><select value={form.doctor_id || ''} onChange={set('doctor_id')} required>{doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></Field>
          <Field label="Date & Time"><input type="datetime-local" value={form.appointment_date || ''} onChange={set('appointment_date')} required /></Field>
          <Field label="Reason"><input value={form.reason || ''} onChange={set('reason')} /></Field>
        </>
      ),
    },
    history: {
      cols: ['Patient', 'Condition', 'Status', 'Diagnosed'],
      row: (r) => [r.patient_name || `#${r.patient_id}`, r.condition_name, r.status, r.diagnosed_date || '—'],
      form: () => (
        <>
          <Field label="Patient"><select value={form.patient_id || ''} onChange={set('patient_id')} required>{patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></Field>
          <Field label="Condition"><input value={form.condition_name || ''} onChange={set('condition_name')} required /></Field>
          <Field label="Description"><textarea rows={2} value={form.description || ''} onChange={set('description')} /></Field>
          <Field label="Diagnosed Date"><input type="date" value={form.diagnosed_date || ''} onChange={set('diagnosed_date')} /></Field>
        </>
      ),
    },
    notes: {
      cols: ['Patient', 'Note', 'Date'],
      row: (r) => [r.patient_name || `#${r.patient_id}`, r.note, new Date(r.created_at).toLocaleString()],
      form: () => (
        <>
          <Field label="Patient"><select value={form.patient_id || ''} onChange={set('patient_id')} required>{patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></Field>
          <Field label="Nurse"><select value={form.nurse_id || ''} onChange={set('nurse_id')} required>{nurses.map((n) => <option key={n.id} value={n.id}>{n.full_name}</option>)}</select></Field>
          <Field label="Note"><textarea rows={3} value={form.note || ''} onChange={set('note')} required /></Field>
        </>
      ),
    },
  };

  const cfg = RENDERERS[tab];

  return (
    <>
      <PageHeader
        title="Records"
        actions={canCreate && <button className="btn" onClick={openCreate}>+ New {tab.slice(0, -1)}</button>}
      />

      <div className="tabs">
        {TABS.filter((t) => (user.role === 'NURSE' ? ['notes', 'records', 'labs', 'appointments'].includes(t.key) : true))
          .map((t) => (
            <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
      </div>

      {loading ? <Spinner /> : rows.length === 0 ? <EmptyState message={`No ${tab} found`} /> : (
        <div className="table-wrap">
          <div className="overflow-x-auto">
            <table>
              <thead><tr>{cfg.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    {cfg.row(r).map((cell, i) => <td key={i} style={{ maxWidth: 360, whiteSpace: 'normal' }}>{cell}</td>)}
                    {cfg.detail && <td><button className="btn btn-secondary btn-sm" onClick={() => cfg.detail(r)}>View</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <Modal title={`New ${tab.slice(0, -1)}`} onClose={() => setShowModal(false)} wide>
          <div className="form-grid">
            {cfg.form().map((el, i) => <div key={i} className={i === cfg.form().length - 1 ? 'full' : ''}>{el}</div>)}
          </div>
          <div className="text-right">
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn" style={{ marginLeft: 8 }} onClick={submit}>Save</button>
          </div>
        </Modal>
      )}

      {prescriptionDetail && (
        <Modal title={`Prescription #${prescriptionDetail.id} — ${prescriptionDetail.patient_name || ''}`} onClose={() => setPrescriptionDetail(null)}>
          <p className="muted">Doctor: {prescriptionDetail.doctor_name || '—'} · {new Date(prescriptionDetail.prescription_date).toLocaleDateString()}</p>
          {prescriptionDetail.notes && <p>{prescriptionDetail.notes}</p>}
          {prescriptionDetail.items?.length ? (
            <div className="overflow-x-auto">
              <table>
                <thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
                <tbody>
                  {prescriptionDetail.items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.medicine_name}</td>
                      <td>{it.dosage || '—'}</td>
                      <td>{it.frequency || '—'}</td>
                      <td>{it.duration || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState message="No items on this prescription" />}
        </Modal>
      )}
      {toastStack}
    </>
  );
}
