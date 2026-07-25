import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
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

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
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
      </Route>
    </Routes>
  );
}
