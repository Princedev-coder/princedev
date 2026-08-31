import { useEffect, useState } from 'react';
import { apiGet, apiPost, errorMessage } from '../api/client';
import { Spinner, EmptyState, Modal, Field, useToast, StatusBadge, PageHeader } from '../components/ui';

export default function Staff() {
  const { push, toastStack } = useToast();
  const [tab, setTab] = useState('doctors');
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [role, setRole] = useState('doctor');
  const [form, setForm] = useState({});
  const [showUser, setShowUser] = useState(false);
  const [userForm, setUserForm] = useState({});

  const load = () => {
    setLoading(true);
    if (tab === 'users') {
      apiGet('/users', { limit: 100 }).then(setUsers).catch(() => setUsers([])).finally(() => setLoading(false));
    } else {
      apiGet(`/staff/${tab}`).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
    }
  };

  useEffect(load, [tab]);

  const set = (k) => (e) => {
    const v = e.target.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const submit = async () => {
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      await apiPost(`/staff/${role}`, payload);
      push('Staff registered', 'success');
      setShowModal(false);
      setForm({});
      load();
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  };

  const submitUser = async () => {
    try {
      await apiPost('/users', { ...userForm, role: userForm.role || 'DOCTOR' });
      push('User created', 'success');
      setShowUser(false);
      setUserForm({ role: 'DOCTOR' });
      load();
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Staff & Users"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => { setShowUser(true); setUserForm({ role: 'DOCTOR' }); }}>+ User</button>
            <button className="btn" onClick={() => { setShowModal(true); setForm({}); }}>+ Register Staff</button>
          </>
        }
      />

      <div className="tabs">
        {['doctors', 'nurses', 'users'].map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (tab === 'users' ? users : rows).length === 0 ? <EmptyState message="None found" /> : (
        <div className="table-wrap">
          <div className="overflow-x-auto">
            <table>
              <thead>
                {tab === 'doctors' && <tr><th>Name</th><th>Specialization</th><th>License</th><th>Department</th><th>Experience</th><th>Status</th></tr>}
                {tab === 'nurses' && <tr><th>Name</th><th>License</th><th>Department</th><th>Shift</th><th>Status</th></tr>}
                {tab === 'users' && <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th></tr>}
              </thead>
              <tbody>
                {tab === 'doctors' && rows.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.full_name}</td>
                    <td>{d.specialization || '—'}</td>
                    <td>{d.license_number}</td>
                    <td>{d.department_name || '—'}</td>
                    <td>{d.years_of_experience} yrs</td>
                    <td><StatusBadge status={d.status} /></td>
                  </tr>
                ))}
                {tab === 'nurses' && rows.map((n) => (
                  <tr key={n.id}>
                    <td style={{ fontWeight: 600 }}>{n.full_name}</td>
                    <td>{n.license_number}</td>
                    <td>{n.department_name || '—'}</td>
                    <td>{n.shift || '—'}</td>
                    <td><StatusBadge status={n.status} /></td>
                  </tr>
                ))}
                {tab === 'users' && users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td><span className={`badge badge-${u.role === 'ADMIN' ? 'red' : u.role === 'DOCTOR' ? 'blue' : u.role === 'NURSE' ? 'amber' : 'green'}`}>{u.role}</span></td>
                    <td><StatusBadge status={u.status} /></td>
                    <td className="muted">{u.last_login ? new Date(u.last_login).toLocaleString() : 'never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <Modal title="Register Staff" onClose={() => setShowModal(false)} wide>
          <div className="tabs" style={{ marginBottom: 12 }}>
            <button className={`tab ${role === 'doctor' ? 'active' : ''}`} onClick={() => setRole('doctor')}>Doctor</button>
            <button className={`tab ${role === 'nurse' ? 'active' : ''}`} onClick={() => setRole('nurse')}>Nurse</button>
          </div>
          <div className="form-grid">
            <Field label="Full Name"><input value={form.full_name || ''} onChange={set('full_name')} required /></Field>
            <Field label="Email"><input type="email" value={form.email || ''} onChange={set('email')} required /></Field>
            <Field label="License Number"><input value={form.license_number || ''} onChange={set('license_number')} required /></Field>
            <Field label="Department ID"><input type="number" value={form.department_id || ''} onChange={set('department_id')} placeholder="1-5" /></Field>
            {role === 'doctor' && (
              <>
                <Field label="Specialization"><input value={form.specialization || ''} onChange={set('specialization')} /></Field>
                <Field label="Years of Experience"><input type="number" value={form.years_of_experience || ''} onChange={set('years_of_experience')} /></Field>
              </>
            )}
            {role === 'nurse' && (
              <Field label="Shift">
                <select value={form.shift || 'MORNING'} onChange={set('shift')}>
                  <option value="MORNING">Morning</option><option value="AFTERNOON">Afternoon</option><option value="NIGHT">Night</option>
                </select>
              </Field>
            )}
          </div>
          <div className="text-right">
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn" style={{ marginLeft: 8 }} onClick={submit}>Register</button>
          </div>
        </Modal>
      )}

      {showUser && (
        <Modal title="Create User" onClose={() => setShowUser(false)}>
          <div className="form-grid">
            <Field label="Full Name"><input value={userForm.full_name || ''} onChange={(e) => setUserForm((f) => ({ ...f, full_name: e.target.value }))} required /></Field>
            <Field label="Email"><input type="email" value={userForm.email || ''} onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} required /></Field>
            <Field label="Role">
              <select value={userForm.role || 'DOCTOR'} onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}>
                {['ADMIN', 'DOCTOR', 'NURSE', 'PATIENT'].map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Password"><input type="password" value={userForm.password || ''} onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} required /></Field>
            {(userForm.role === 'DOCTOR' || userForm.role === 'NURSE') && (
              <Field label="License Number"><input value={userForm.license_number || ''} onChange={(e) => setUserForm((f) => ({ ...f, license_number: e.target.value }))} required /></Field>
            )}
          </div>
          <div className="text-right">
            <button className="btn btn-secondary" onClick={() => setShowUser(false)}>Cancel</button>
            <button className="btn" style={{ marginLeft: 8 }} onClick={submitUser}>Create</button>
          </div>
        </Modal>
      )}
      {toastStack}
    </>
  );
}
