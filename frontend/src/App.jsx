import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { AttendancePage, CreateSessionPage, FacultyDashboard, HistoryPage, LoginPage, StudentDashboard } from './pages/Pages.jsx';

function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'faculty' ? '/faculty' : '/student'} replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'faculty' ? '/faculty' : '/student'} replace /> : <LoginPage />} />
      <Route path="/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute role="student"><AttendancePage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute role="student"><HistoryPage /></ProtectedRoute>} />
      <Route path="/faculty" element={<ProtectedRoute role="faculty"><FacultyDashboard /></ProtectedRoute>} />
      <Route path="/faculty/new-session" element={<ProtectedRoute role="faculty"><CreateSessionPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={user ? (user.role === 'faculty' ? '/faculty' : '/student') : '/login'} replace />} />
    </Routes>
  );
}
