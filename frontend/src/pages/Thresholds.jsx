import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete, errorMessage } from '../api/client';
import { Spinner, EmptyState, Modal, Field, useToast } from '../components/ui';

const VITAL_TYPES = ['HEART_RATE', 'SPO2', 'TEMPERATURE', 'SYSTOLIC', 'DIASTOLIC', 'RESPIRATORY_RATE', 'GLUCOSE'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function Thresholds() {
  const { push, toastStack } = useToast();
  const [thresholds, setThresholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ vital_type: 'HEART_RATE', min_value: '', max_value: '', severity: 'MEDIUM', enabled: 1 });

  const load = () => {
    setLoading(true);
    apiGet('/thresholds', { hospital_id: 1 })
      .then(setThresholds)
      .catch(() => setThresholds([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    try {
      await apiPost('/thresholds', {
        hospital_id: 1,
        vital_type: form.vital_type,
        min_value: form.min_value !== '' ? Number(form.min_value) : null,
        max_value: form.max_value !== '' ? Number(form.max_value) : null,
        severity: form.severity,
        enabled: Number(form.enabled),
      });
      push('Threshold saved', 'success');
      setShowModal(false);
      load();
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  };

  const remove = async (id) => {
    try {
      await apiDelete(`/thresholds/${id}`);
      push('Threshold deleted', 'success');
      load();
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Alert Thresholds</h1>
        <button className="btn" onClick={() => setShowModal(true)}>+ New Threshold</button>
      </div>
      <div className="inline-alert info">
        💡 Vital readings outside these ranges trigger automatic alerts and AI risk scoring.
      </div>

      {loading ? <Spinner /> : thresholds.length === 0 ? <EmptyState message="No thresholds configured" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Vital Type</th><th>Min</th><th>Max</th><th>Severity</th><th>Enabled</th><th>Actions</th></tr></thead>
            <tbody>
              {thresholds.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.vital_type}</td>
                  <td>{t.min_value ?? '—'}</td>
                  <td>{t.max_value ?? '—'}</td>
                  <td><span className={`badge badge-${t.severity === 'HIGH' || t.severity === 'CRITICAL' ? 'red' : t.severity === 'MEDIUM' ? 'amber' : 'green'}`}>{t.severity}</span></td>
                  <td>{t.enabled ? '✅' : '❌'}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => remove(t.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title="Configure Alert Threshold" onClose={() => setShowModal(false)}>
          <div className="form-grid">
            <Field label="Vital Type">
              <select value={form.vital_type} onChange={set('vital_type')}>
                {VITAL_TYPES.map((v) => <option key={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Severity">
              <select value={form.severity} onChange={set('severity')}>
                {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Minimum Value"><input type="number" step="0.1" value={form.min_value} onChange={set('min_value')} placeholder="e.g. 60" /></Field>
            <Field label="Maximum Value"><input type="number" step="0.1" value={form.max_value} onChange={set('max_value')} placeholder="e.g. 100" /></Field>
            <Field label="Enabled">
              <select value={form.enabled} onChange={set('enabled')}>
                <option value={1}>Yes</option><option value={0}>No</option>
              </select>
            </Field>
          </div>
          <div className="text-right">
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn" style={{ marginLeft: 8 }} onClick={submit}>Save</button>
          </div>
        </Modal>
      )}
      {toastStack}
    </>
  );
}
