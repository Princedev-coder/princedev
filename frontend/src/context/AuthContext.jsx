import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api/client';
import { connectSocket, disconnectSocket } from '../socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('hp_user') || 'null');
    } catch {
      return null;
    }
  });

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const payload = res.data.data;
    localStorage.setItem('hp_token', payload.token);
    localStorage.setItem('hp_user', JSON.stringify(payload.user));
    setUser(payload.user);
    connectSocket();
    return payload.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('hp_token');
    localStorage.removeItem('hp_user');
    disconnectSocket();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
