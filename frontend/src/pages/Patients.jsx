import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost, errorMessage } from '../api/client';
import { StatusBadge, Modal, Field, Spinner, EmptyState, useToast, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const EMPTY = {
  first_name: '', last_name: '', email: '', phone: '', gender: 'MALE',
  blood_group: 'UNKNOWN', date_of_birth: '', national_id: '', city: '',
  department_id: '', emergency_contact_name: '', emergency_contact_phone: '',
  allergies: '', existing_conditions: '',
};

export default function Patients() {
  const { user } = useAuth();
  const { push, toastStack } = useToast();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0 });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canCreate = user.role === 'ADMIN' || user.role === 'NURSE';

  const load = () => {
    setLoading(true);
    apiGet('/patients', { search: search || undefined, status: status || undefined, page, limit: 15 })
      .then((d) => {
        setPatients(d);
        setMeta(d.meta);
      })
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, status]);
  useEffect(() => {
    const t = setTimeout(() => { if (page === 1) load(); else setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const set = (k) => (e) => {
    const v = e.target.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      const created = await apiPost('/patients', payload);
      push(`Patient ${form.first_name} ${form.last_name} registered (${created.patient_number})`, 'success');
      setShowModal(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Patients"
        actions={canCreate && <button className="btn" onClick={() => setShowModal(true)}>+ Register Patient</button>}
      />
      <div className="toolbar">
        <input className="toolbar-search" placeholder="Search by name, number, ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['ACTIVE', 'ADMITTED', 'DISCHARGED', 'CRITICAL'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="muted">{meta.total} patients</span>
      </div>

      {loading ? <Spinner /> : patients.length === 0 ? <EmptyState message="No patients found" /> : (
        <div className="table-wrap">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr><th>Number</th><th>Name</th><th>Gender</th><th>Blood</th><th>DOB</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td className="muted">{p.patient_number}</td>
                    <td style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</td>
                    <td>{p.gender}</td>
                    <td>{p.blood_group}</td>
                    <td>{p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString() : '—'}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td><Link className="btn btn-secondary btn-sm" to={`/patients/${p.id}`}>View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <button className="btn btn-secondary btn-sm" disabled={page * 15 >= meta.total} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {showModal && (
        <Modal title="Register New Patient" onClose={() => setShowModal(false)} wide>
          <form onSubmit={submit}>
            <div className="form-grid">
              <Field label="First Name"><input value={form.first_name} onChange={set('first_name')} required /></Field>
              <Field label="Last Name"><input value={form.last_name} onChange={set('last_name')} required /></Field>
              <Field label="Email"><input type="email" value={form.email} onChange={set('email')} required /></Field>
              <Field label="Phone"><input value={form.phone} onChange={set('phone')} /></Field>
              <Field label="Gender">
                <select value={form.gender} onChange={set('gender')}>
                  <option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Blood Group">
                <select value={form.blood_group} onChange={set('blood_group')}>
                  {['UNKNOWN', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Date of Birth"><input type="date" value={form.date_of_birth} onChange={set('date_of_birth')} /></Field>
              <Field label="National ID"><input value={form.national_id} onChange={set('national_id')} /></Field>
              <Field label="City"><input value={form.city} onChange={set('city')} /></Field>
              <Field label="Emergency Contact Name"><input value={form.emergency_contact_name} onChange={set('emergency_contact_name')} /></Field>
              <Field label="Emergency Contact Phone"><input value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} /></Field>
              <Field label="Department ID"><input type="number" value={form.department_id} onChange={set('department_id')} placeholder="e.g. 1-5" /></Field>
              <Field label="Allergies"><textarea rows={2} value={form.allergies} onChange={set('allergies')} /></Field>
              <Field label="Existing Conditions"><textarea rows={2} value={form.existing_conditions} onChange={set('existing_conditions')} /></Field>
            </div>
            <div className="text-right" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn" style={{ marginLeft: 8 }} disabled={saving}>{saving ? <span className="spinner" /> : 'Register Patient'}</button>
            </div>
          </form>
        </Modal>
      )}
      {toastStack}
    </>
  );
}
