import { createContext, useContext, useMemo, useState } from 'react';
import api from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('attendance-user') || 'null');
    } catch {
      return null;
    }
  });

  async function login(credentials) {
    const { data } = await api.post('/auth/login', credentials);
    localStorage.setItem('attendance-token', data.token);
    localStorage.setItem('attendance-user', JSON.stringify(data.user));
    setUser(data.user);
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('attendance-token');
      localStorage.removeItem('attendance-user');
      setUser(null);
    }
  }

  const value = useMemo(() => ({ user, login, logout }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
