import { useEffect, useState } from 'react';
import { apiGet, apiPost, errorMessage } from '../api/client';
import { RiskBadge, Spinner, EmptyState, Modal, Field, useToast } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function Predictions() {
  const { user } = useAuth();
  const { push, toastStack } = useToast();
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [riskLevel, setRiskLevel] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState('');
  const [generating, setGenerating] = useState(false);

  const canGenerate = ['ADMIN', 'DOCTOR', 'NURSE'].includes(user.role);

  const load = () => {
    setLoading(true);
    apiGet('/predictions', { risk_level: riskLevel || undefined, limit: 50 })
      .then(setPredictions)
      .catch(() => setPredictions([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [riskLevel]);

  const openGenerate = async () => {
    setShowGenerate(true);
    try {
      setPatients(await apiGet('/patients', { limit: 100 }));
    } catch {}
  };

  const generate = async () => {
    if (!patientId) return;
    setGenerating(true);
    try {
      await apiPost(`/predictions/patients/${patientId}/generate`, {});
      push('Prediction generated', 'success');
      setShowGenerate(false);
      load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>AI Health Analysis</h1>
          <div className="muted">Heuristic risk scoring from vital trends (model: heuristic-risk-v1)</div>
        </div>
        {canGenerate && <button className="btn" onClick={openGenerate}>+ Generate Prediction</button>}
      </div>

      <div className="toolbar">
        <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
          <option value="">All risk levels</option>
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : predictions.length === 0 ? <EmptyState message="No AI predictions yet" /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Patient</th><th>Type</th><th>Risk</th><th>Prediction</th><th>Generated</th></tr>
            </thead>
            <tbody>
              {predictions.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.patient_name || `#${p.patient_id}`}</td>
                  <td>{p.prediction_type}</td>
                  <td><RiskBadge level={p.risk_level} score={p.risk_score} /></td>
                  <td style={{ maxWidth: 380, whiteSpace: 'normal' }}>{p.prediction}</td>
                  <td className="muted">{new Date(p.generated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showGenerate && (
        <Modal title="Generate AI Prediction" onClose={() => setShowGenerate(false)}>
          <Field label="Patient">
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Select patient...</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.patient_number})</option>)}
            </select>
          </Field>
          <div className="text-right">
            <button className="btn btn-secondary" onClick={() => setShowGenerate(false)}>Cancel</button>
            <button className="btn" style={{ marginLeft: 8 }} disabled={!patientId || generating} onClick={generate}>
              {generating ? <span className="spinner" /> : 'Generate'}
            </button>
          </div>
        </Modal>
      )}
      {toastStack}
    </>
  );
}
