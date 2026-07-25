import { Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import AlertDetail from './pages/AlertDetail';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import Departments from './pages/Departments';
import AttackSimulator from './pages/AttackSimulator';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import DetectionPerformance from './pages/DetectionPerformance';
import BehaviorBaselineComparison from './pages/BehaviorBaselineComparison';
import Cases from './pages/Cases';
import CaseDetail from './pages/CaseDetail';
import Admin from './pages/Admin';
import NotificationSettings from './pages/NotificationSettings';
import SystemHealth from './pages/SystemHealth';

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole === 'Admin' && user.role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected routes with sidebar */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/alerts/:id" element={<AlertDetail />} />
        <Route path="/users" element={<Users />} />
        <Route path="/users/:id" element={<UserDetail />} />
        <Route path="/users/:id/baseline" element={<BehaviorBaselineComparison />} />
        <Route path="/departments" element={<Departments />} />
        <Route path="/simulator" element={<AttackSimulator />} />
        <Route path="/executive" element={<ExecutiveDashboard />} />
        <Route path="/performance" element={<DetectionPerformance />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/cases/:id" element={<CaseDetail />} />
        <Route path="/notifications" element={<NotificationSettings />} />
        <Route path="/health" element={<SystemHealth />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="Admin">
              <Admin />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
