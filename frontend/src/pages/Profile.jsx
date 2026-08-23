import { useEffect, useState } from 'react';
import { apiGet, apiPost, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Spinner, Field, useToast } from '../components/ui';

export default function Profile() {
  const { user, setUser } = useAuth();
  const { push, toastStack } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pw, setPw] = useState({ current_password: '', new_password: '' });

  useEffect(() => {
    apiGet('/users/me')
      .then((p) => setProfile(p))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  const changePw = async () => {
    try {
      await apiPost('/auth/change-password', pw);
      push('Password changed successfully', 'success');
      setPw({ current_password: '', new_password: '' });
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  };

  if (loading) return <Spinner />;
  if (!profile) return <Spinner text="Loading profile..." />;

  return (
    <>
      <div className="page-header">
        <h1>My Profile</h1>
      </div>
      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">Account Information</div>
          <p><strong>Name:</strong> {profile.full_name}</p>
          <p><strong>Email:</strong> {profile.email}</p>
          <p><strong>Phone:</strong> {profile.phone || '—'}</p>
          <p><strong>Role:</strong> <span className="badge badge-teal">{profile.role}</span></p>
          <p><strong>Last login:</strong> {profile.last_login ? new Date(profile.last_login).toLocaleString() : '—'}</p>
          <p><strong>Member since:</strong> {new Date(profile.created_at).toLocaleDateString()}</p>
          {profile.profile && profile.profile.license_number && (
            <p><strong>License:</strong> {profile.profile.license_number}</p>
          )}
        </div>
        <div className="card">
          <div className="card-title">Change Password</div>
          <Field label="Current Password">
            <input type="password" value={pw.current_password} onChange={(e) => setPw((p) => ({ ...p, current_password: e.target.value }))} />
          </Field>
          <Field label="New Password">
            <input type="password" value={pw.new_password} onChange={(e) => setPw((p) => ({ ...p, new_password: e.target.value }))} />
          </Field>
          <button className="btn" onClick={changePw} disabled={!pw.current_password || !pw.new_password}>Update Password</button>
        </div>
      </div>
      {toastStack}
    </>
  );
}
