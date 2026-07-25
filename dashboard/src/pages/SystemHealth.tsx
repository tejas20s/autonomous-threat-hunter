import { useState, useEffect } from 'react';
import {
  HeartPulse, Activity, Database, Brain, Wifi, Users,
  AlertTriangle, CheckCircle, Clock, BarChart3, HardDrive,
  Cpu, Zap, RefreshCw,
} from 'lucide-react';
import { api } from '../api/client';
import type { SystemHealth } from '../types';
import StatsCard from '../components/StatsCard';

export default function SystemHealth() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = async () => {
    try {
      const data = await api.getSystemHealth();
      setHealth(data);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to fetch system health');
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchHealth(); }, []);

  const refresh = () => {
    setRefreshing(true);
    fetchHealth();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Activity size={20} className="animate-spin mr-2" />
        Loading system health...
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <AlertTriangle size={40} className="mb-3 opacity-30" />
        <p>Could not load system health</p>
        <p className="text-xs text-slate-600 mt-1">{error}</p>
        <button onClick={refresh} className="btn-primary mt-4 text-sm">Retry</button>
      </div>
    );
  }

  const modelStatus = health?.model;
  const ev = health?.events;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">System Health</h2>
          <p className="text-sm text-slate-400 mt-1">Real-time system status and metrics</p>
        </div>
        <button onClick={refresh} disabled={refreshing} className="btn-secondary text-sm flex items-center gap-2">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Status Banner */}
      <div className={`rounded-xl border p-4 flex items-center gap-3 ${
        health?.status === 'ok'
          ? 'bg-green-900/20 border-green-800/30 text-green-300'
          : 'bg-red-900/20 border-red-800/30 text-red-300'
      }`}>
        {health?.status === 'ok' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
        <div>
          <p className="font-medium">
            {health?.status === 'ok' ? 'All Systems Operational' : 'System Issues Detected'}
          </p>
          <p className="text-xs opacity-80">Version {health?.version} · Mode: {health?.mode} · Database: {health?.database}</p>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          title="API Status"
          value={health?.status === 'ok' ? 'Online' : 'Error'}
          subtitle={`v${health?.version}`}
          icon={Zap}
          color={health?.status === 'ok' ? 'green' : 'red'}
        />
        <StatsCard
          title="Database"
          value={health?.database === 'connected' ? 'Connected' : health?.database || 'Unknown'}
          subtitle="SQLite / PostgreSQL"
          icon={Database}
          color={health?.database === 'connected' ? 'green' : 'red'}
        />
        <StatsCard
          title="AI Model"
          value={modelStatus?.status === 'ready' ? 'Ready' : modelStatus?.status || 'N/A'}
          subtitle={modelStatus?.last_trained ? `Trained: ${new Date(modelStatus.last_trained).toLocaleDateString()}` : 'Not trained'}
          icon={Brain}
          color={modelStatus?.status === 'ready' ? 'green' : 'yellow'}
        />
        <StatsCard
          title="Total Events"
          value={ev?.total_events || 0}
          subtitle="Processed events"
          icon={Activity}
          color="blue"
        />
        <StatsCard
          title="Total Alerts"
          value={ev?.total_alerts || 0}
          subtitle="Generated alerts"
          icon={AlertTriangle}
          color="orange"
        />
        <StatsCard
          title="Monitored Users"
          value={ev?.total_users || 0}
          subtitle="Active users"
          icon={Users}
          color="purple"
        />
      </div>

      {/* Model Info */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Brain size={16} className="text-purple-400" />
          AI Model Status
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
            <div className="text-xs text-slate-500">Status</div>
            <div className={`text-sm font-bold mt-1 ${modelStatus?.status === 'ready' ? 'text-green-400' : 'text-yellow-400'}`}>
              {modelStatus?.status || 'N/A'}
            </div>
          </div>
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
            <div className="text-xs text-slate-500">Version</div>
            <div className="text-sm font-bold mt-1 text-slate-200">{modelStatus?.version ? `v${modelStatus.version}` : '-'}</div>
          </div>
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
            <div className="text-xs text-slate-500">Users Trained</div>
            <div className="text-sm font-bold mt-1 text-slate-200">{modelStatus?.users_trained || '-'}</div>
          </div>
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
            <div className="text-xs text-slate-500">Last Trained</div>
            <div className="text-sm font-bold mt-1 text-slate-200">
              {modelStatus?.last_trained ? new Date(modelStatus.last_trained).toLocaleDateString() : 'Never'}
            </div>
          </div>
        </div>
      </div>

      {/* Retrain History */}
      {health?.retrain_history && health.retrain_history.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Clock size={15} className="text-indigo-400" />
            Training History
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs text-slate-500 uppercase tracking-wider">
                <th className="pb-3 pr-4">Version</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Users</th>
                <th className="pb-3 pr-4">Samples</th>
                <th className="pb-3 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {health.retrain_history.map((r, i) => (
                <tr key={i} className="border-b border-slate-800/50">
                  <td className="py-3 pr-4 font-mono text-slate-200">v{r.version}</td>
                  <td className="py-3 pr-4 text-slate-400 text-xs">{new Date(r.trained_at).toLocaleString()}</td>
                  <td className="py-3 pr-4 text-slate-400">{r.users_trained || '-'}</td>
                  <td className="py-3 pr-4 text-slate-400">{r.total_samples || '-'}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      r.status === 'completed' ? 'bg-green-900/60 text-green-300' : 'bg-yellow-900/60 text-yellow-300'
                    }`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
