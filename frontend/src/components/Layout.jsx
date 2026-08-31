import { useEffect, useState, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../socket';
import { apiGet, apiPost, errorMessage } from '../api/client';
import { useToast } from './ui';

const NAV = {
  ADMIN: [
    { section: 'Overview' },
    { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { to: '/monitor', label: 'Live Monitor', icon: '📡' },
    { to: '/alerts', label: 'Alerts', icon: '🔔' },
    { to: '/predictions', label: 'AI Analysis', icon: '🧠' },
    { section: 'Management' },
    { to: '/patients', label: 'Patients', icon: '🧑‍⚕️' },
    { to: '/records', label: 'Records', icon: '📋' },
    { to: '/staff', label: 'Staff', icon: '👥' },
    { to: '/devices', label: 'Devices', icon: '📟' },
    { to: '/thresholds', label: 'Thresholds', icon: '⚙️' },
    { to: '/audit-logs', label: 'Audit Logs', icon: '📜' },
  ],
  DOCTOR: [
    { section: 'Overview' },
    { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { to: '/monitor', label: 'Live Monitor', icon: '📡' },
    { to: '/alerts', label: 'Alerts', icon: '🔔' },
    { to: '/predictions', label: 'AI Analysis', icon: '🧠' },
    { section: 'Clinical' },
    { to: '/patients', label: 'My Patients', icon: '🧑‍⚕️' },
    { to: '/records', label: 'Records', icon: '📋' },
  ],
  NURSE: [
    { section: 'Overview' },
    { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { to: '/monitor', label: 'Live Monitor', icon: '📡' },
    { to: '/alerts', label: 'Alerts', icon: '🔔' },
    { section: 'Clinical' },
    { to: '/patients', label: 'Patients', icon: '🧑‍⚕️' },
    { to: '/records', label: 'Notes & Vitals', icon: '📋' },
  ],
  PATIENT: [
    { section: 'My Care' },
    { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { to: '/records', label: 'My Records', icon: '📋' },
    { to: '/predictions', label: 'Health Analysis', icon: '🧠' },
    { to: '/profile', label: 'Profile', icon: '👤' },
  ],
};

const TITLES = {
  '/dashboard': 'Dashboard',
  '/monitor': 'Live Patient Monitoring',
  '/alerts': 'Alerts',
  '/predictions': 'AI Health Analysis',
  '/patients': 'Patients',
  '/records': 'Medical Records',
  '/staff': 'Staff Management',
  '/devices': 'Medical Devices',
  '/thresholds': 'Alert Thresholds',
  '/audit-logs': 'Audit Logs',
  '/profile': 'Profile',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { push, toastStack } = useToast();
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showBell, setShowBell] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bellRef = useRef(null);

  const nav = NAV[user?.role] || [];

  useEffect(() => {
    if (!user) return;
    apiGet('/notifications', { is_read: 0, limit: 10 })
      .then((d) => {
        setUnread(d.meta?.unread || d.length);
        setNotifications(d);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;
    socket.on('notification:new', (n) => {
      setUnread((u) => u + 1);
      setNotifications((prev) => [n, ...prev]);
      push(n.title || 'New notification', 'info');
    });
    socket.on('alert:new', (a) => {
      push(`${a.title || 'Alert'}: ${a.message}`, 'alert');
    });
    socket.on('vital:reading', (v) => {
      if (!location.pathname.startsWith('/monitor')) return;
    });
    return () => {
      socket.off('notification:new');
      socket.off('alert:new');
      socket.off('vital:reading');
    };
  }, [user, location.pathname, push]);

  useEffect(() => {
    function onClick(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowBell(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const markRead = async (id) => {
    try {
      await apiPost(`/notifications/${id}/read`, {});
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch (e) {
      push(errorMessage(e), 'error');
    }
  };

  const markAll = async () => {
    try {
      await apiPost('/notifications/read-all', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnread(0);
    } catch (e) {
      push(errorMessage(e), 'error');
    }
  };

  const pageTitle = TITLES[location.pathname] || 'Healthcare Platform';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <div className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} role="navigation" aria-label="Main navigation">
        <div className="brand">
          <div className="logo" aria-hidden="true">+</div>
          <div className="brand-name">CareMonitor</div>
        </div>
        <nav className="sidebar-nav">
          {nav.map((item, i) =>
            item.section ? (
              <div key={i} className="nav-section">{item.section}</div>
            ) : (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="icon" aria-hidden="true">{item.icon}</span>
                {item.label}
              </NavLink>
            )
          )}
        </nav>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="topbar-left">
            <button className="menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open navigation menu">
              <span className="menu-bar" />
              <span className="menu-bar" />
              <span className="menu-bar" />
            </button>
            <div className="page-title">{pageTitle}</div>
          </div>
          <div className="topbar-right">
            <div className="bell-wrap" ref={bellRef} onClick={() => setShowBell((s) => !s)} role="button" aria-label={`Notifications (${unread} unread)`} tabIndex={0}>
              <span aria-hidden="true">🔔</span>
              {unread > 0 && <span className="badge">{unread}</span>}
              {showBell && (
                <div className="card notifications-panel">
                  <div className="notifications-header">
                    <strong>Notifications</strong>
                    <button className="btn btn-secondary btn-sm" onClick={markAll}>Mark all read</button>
                  </div>
                  {notifications.length === 0 && <div className="empty-state">No notifications</div>}
                  {notifications.map((n) => (
                    <div key={n.id} className="notification-item" onClick={() => n.is_read !== 1 && markRead(n.id)} style={{ opacity: n.is_read ? 0.6 : 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{n.message}</div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="user-chip">
              <div className="avatar" aria-hidden="true">{(user?.full_name || 'U').charAt(0).toUpperCase()}</div>
              <div>
                <div className="u-name">{user?.full_name}</div>
                <div className="u-role">{user?.role}</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </div>

        <div className="content">
          <Outlet />
        </div>
      </div>
      {toastStack}
    </div>
  );
}
