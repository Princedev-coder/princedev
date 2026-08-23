import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Monitor from './pages/Monitor';
import MonitorPatient from './pages/MonitorPatient';
import Alerts from './pages/Alerts';
import Predictions from './pages/Predictions';
import Records from './pages/Records';
import Devices from './pages/Devices';
import Staff from './pages/Staff';
import Thresholds from './pages/Thresholds';
import AuditLogs from './pages/AuditLogs';
import Profile from './pages/Profile';

function RootRedirect() {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />

          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />

            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<PatientDetail />} />

            <Route path="/monitor" element={<Monitor />} />
            <Route path="/monitor/:id" element={<MonitorPatient />} />

            <Route path="/alerts" element={<Alerts />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/records" element={<Records />} />

            <Route path="/devices" element={<ProtectedRoute roles={['ADMIN']}><Devices /></ProtectedRoute>} />
            <Route path="/staff" element={<ProtectedRoute roles={['ADMIN']}><Staff /></ProtectedRoute>} />
            <Route path="/thresholds" element={<ProtectedRoute roles={['ADMIN']}><Thresholds /></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute roles={['ADMIN']}><AuditLogs /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
