import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Activity, Users, AlertTriangle, Shield, CalendarDays, TrendingUp,
  Briefcase, BarChart3, ArrowRight,
} from 'lucide-react';
import { api } from '../api/client';
import type { DashboardSummary, Alert } from '../types';
import StatsCard from '../components/StatsCard';
import SeverityBadge from '../components/SeverityBadge';

const SEVERITY_COLORS = {
  Critical: '#dc2626',
  High: '#ea580c',
  Medium: '#ca8a04',
  Low: '#16a34a',
};

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.getSummary(),
      api.getAlerts({ limit: 10 }),
    ]).then(([s, alerts]) => {
      setSummary(s);
      setRecentAlerts(alerts);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const severityData = useMemo(() => {
    if (!summary?.severity_counts) return [];
    return Object.entries(summary.severity_counts)
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => ({ name, value }));
  }, [summary]);

  // Simulated time-series data for risk trend (from daily data)
  const [trendData, setTrendData] = useState<{ date: string; score: number }[]>([]);
  useEffect(() => {
    if (!summary?.users_monitored) return;
    api.getUsers().then((users) => {
      if (users.length > 0) {
        api.getUserTimeline(users[0].user_id).then((timeline) => {
          if (timeline.length > 0) {
            setTrendData(
              timeline
                .filter((d) => d.risk_score > 0)
                .slice(-30)
                .map((d) => ({ date: d.date.slice(5), score: d.risk_score }))
            );
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }, [summary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <Activity size={20} className="animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold page-header">Security Operations Dashboard</h2>
        <p className="text-sm page-subtitle mt-1">
          Real-time insider threat monitoring and risk analysis
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Alerts"
          value={summary?.total_alerts || 0}
          subtitle={`${summary?.total_user_days_analyzed?.toLocaleString() || 0} user-days analyzed`}
          icon={AlertTriangle}
          color="red"
        />
        <StatsCard
          title="Users Monitored"
          value={summary?.users_monitored || 0}
          subtitle={`Over ${summary?.days_covered || 0} days`}
          icon={Users}
          color="blue"
        />
        <StatsCard
          title="Critical Alerts"
          value={summary?.severity_counts?.Critical || 0}
          subtitle="Requires immediate attention"
          icon={Shield}
          color="red"
        />
        <StatsCard
          title="Avg Daily Alerts"
          value={summary?.days_covered ? (summary.total_alerts / summary.days_covered).toFixed(1) : '0'}
          subtitle="Across all users"
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity distribution */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold page-subtitle mb-4">Severity Distribution</h3>
          {severityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {severityData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={SEVERITY_COLORS[entry.name as keyof typeof SEVERITY_COLORS]}
                      stroke="rgba(0,0,0,0.3)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                  }}
                  formatter={(value: number, name: string) => [value, name]}
                />
                <Legend
                  formatter={(value: string) => (
                    <span style={{ color: '#cbd5e1', fontSize: '13px' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-slate-500 text-sm">
              No severity data available
            </div>
          )}
        </div>

        {/* Risk score trend */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold page-subtitle mb-4">Risk Score Trend</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#818cf8"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#818cf8' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-slate-500 text-sm">
              No trend data available
            </div>
          )}
        </div>
      </div>

      {/* Severity bar chart */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold page-subtitle mb-4">Alerts by Severity</h3>
        {severityData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={severityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {severityData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={SEVERITY_COLORS[entry.name as keyof typeof SEVERITY_COLORS]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[220px] text-slate-500 text-sm">
            No data available
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          onClick={() => navigate('/executive')}
          className="card-hover p-5 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-900/40 text-indigo-400">
                <Briefcase size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold group-hover:text-white transition-colors" style={{ color: 'var(--text-primary)' }}>
                  Executive Dashboard
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Organizational overview, department risk, and top concerns
                </p>
              </div>
            </div>
            <ArrowRight size={16} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
          </div>
        </div>
        <div
          onClick={() => navigate('/performance')}
          className="card-hover p-5 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-900/40 text-green-400">
                <BarChart3 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold group-hover:text-white transition-colors" style={{ color: 'var(--text-primary)' }}>
                  Detection Performance
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  AI metrics: precision, recall, F1-score, and false positive rate
                </p>
              </div>
            </div>
            <ArrowRight size={16} className="text-slate-600 group-hover:text-green-400 transition-colors" />
          </div>
        </div>
      </div>

      {/* Recent alerts */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold page-subtitle">Recent Alerts</h3>
          <button
            onClick={() => navigate('/alerts')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            View all →
          </button>
        </div>
        {recentAlerts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                  <th className="pb-3 pr-4">Alert ID</th>
                  <th className="pb-3 pr-4">User</th>
                  <th className="pb-3 pr-4">Department</th>
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Score</th>
                  <th className="pb-3 pr-4">Severity</th>
                </tr>
              </thead>
              <tbody>
                {recentAlerts.map((alert) => (
                  <tr
                    key={alert.alert_id}
                    onClick={() => navigate(`/alerts/${alert.alert_id}`)}
                    className="border-b cursor-pointer transition-colors" style={{ borderColor: 'var(--border-color)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--nav-hover)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td className="py-3 pr-4 font-mono text-xs text-slate-400">
                      {alert.alert_id}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-200">
                      {alert.user_id}
                    </td>
                    <td className="py-3 pr-4 text-slate-400">{alert.department}</td>
                    <td className="py-3 pr-4 text-slate-400">{alert.date}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${alert.risk_score}%`,
                              backgroundColor:
                                alert.risk_score >= 80
                                  ? '#dc2626'
                                  : alert.risk_score >= 60
                                  ? '#ea580c'
                                  : alert.risk_score >= 40
                                  ? '#ca8a04'
                                  : '#16a34a',
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono text-slate-300">
                          {alert.risk_score.toFixed(0)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <SeverityBadge severity={alert.severity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-24 text-slate-500 text-sm">
            No alerts generated yet. Run the pipeline first.
          </div>
        )}
      </div>
    </div>
  );
}
