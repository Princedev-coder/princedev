import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/client';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@healthcare.local');
  const [password, setPassword] = useState('Admin123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(errorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const fill = (em, pw) => {
    setEmail(em);
    setPassword(pw);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo" aria-hidden="true">+</div>
        <h1>CareMonitor</h1>
        <div className="sub">AI-Based Healthcare Monitoring Platform</div>
        {error && <div className="inline-alert error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <button className="btn w-100" style={{ justifyContent: 'center' }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Sign in'}
          </button>
        </form>
        <div className="demo-hint">
          <strong>Demo accounts:</strong><br />
          Admin: <code>admin@healthcare.local</code> / <code>Admin123!</code><br />
          Doctor: <code>doctor@healthcare.local</code> / <code>Doctor123!</code><br />
          Nurse: <code>nurse@healthcare.local</code> / <code>Nurse123!</code><br />
          Patient: <code>patient@healthcare.local</code> / <code>Patient123!</code>
          <div className="mt-4" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => fill('doctor@healthcare.local', 'Doctor123!')}>Doctor</button>
            <button className="btn btn-secondary btn-sm" onClick={() => fill('nurse@healthcare.local', 'Nurse123!')}>Nurse</button>
            <button className="btn btn-secondary btn-sm" onClick={() => fill('patient@healthcare.local', 'Patient123!')}>Patient</button>
          </div>
        </div>
      </div>
    </div>
  );
}
