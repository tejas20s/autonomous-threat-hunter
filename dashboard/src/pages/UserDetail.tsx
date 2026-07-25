import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, BarChart, Bar,
} from 'recharts';
import {
  ArrowLeft, User, Building2, Activity, AlertTriangle, Shield,
  Calendar, Clock, Download, FileText, Usb, UploadCloud,
  TrendingUp, Eye,
} from 'lucide-react';
import { api } from '../api/client';
import type { TimelineDay, UserFeature, UserInfo, Alert, UserRiskTrend } from '../types';
import SeverityBadge from '../components/SeverityBadge';

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [features, setFeatures] = useState<UserFeature[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [riskTrend, setRiskTrend] = useState<UserRiskTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'30' | '60' | 'all'>('30');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.getUser(id),
      api.getUserTimeline(id),
      api.getUserFeatures(id),
      api.getAlerts({ user_id: id, limit: 200 }),
      api.getUserRiskTrend(id, 12).catch(() => [] as UserRiskTrend[]),
    ])
      .then(([u, tl, ft, al, rt]) => {
        setUser(u);
        setTimeline(tl);
        setFeatures(ft);
        setAlerts(al);
        setRiskTrend(rt);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const chartData = useMemo(() => {
    const data = timeRange === 'all' ? features : features.slice(-Number(timeRange));
    return data.map((f) => ({
      date: f.date.slice(5),
      score: f.risk_score,
      files: f.files_accessed,
      sensitive: f.sensitive_files_accessed,
      downloads: f.files_downloaded,
      usb: f.usb_events,
      transfer: Math.round(f.transfer_mb),
      external: Math.round(f.external_transfer_mb),
      afterHours: f.after_hours_login,
    }));
  }, [features, timeRange]);

  const activityData = useMemo(() => {
    return chartData
      .filter((d) => d.files > 0 || d.transfer > 0)
      .slice(-20);
  }, [chartData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Activity size={20} className="animate-spin mr-2" />
        Loading user data...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <User size={40} className="mb-3 opacity-30" />
        <p>User not found</p>
        <button onClick={() => navigate('/users')} className="btn-primary mt-4 text-sm">
          Back to Users
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/users')}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Users
      </button>

      {/* User header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xl font-bold">
              {id?.replace('user', '')}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{user.user_id}</h2>
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Building2 size={14} />
                  {user.department}
                </span>
                <span className="flex items-center gap-1">
                  <Shield size={14} />
                  Baseline: {user.baseline_ready ? 'Ready' : 'Training'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-orange-400">{alerts.length}</div>
              <div className="text-xs text-slate-500">Alerts</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">{user.max_risk_score?.toFixed(0) || 0}</div>
              <div className="text-xs text-slate-500">Max Risk</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-400">{timeline.length}</div>
              <div className="text-xs text-slate-500">Days Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* Time range selector */}
      <div className="flex items-center gap-2">
        {[
          { value: '30', label: '30 Days' },
          { value: '60', label: '60 Days' },
          { value: 'all', label: 'All Time' },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTimeRange(opt.value as '30' | '60' | 'all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              timeRange === opt.value
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-700/40'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Risk score chart */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Activity size={16} className="text-indigo-400" />
          Risk Score Trend
        </h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#818cf8"
                fill="url(#riskGradient)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[280px] text-slate-500 text-sm">
            No data available
          </div>
        )}
      </div>

      {/* Activity detail chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Files & Downloads */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <FileText size={16} className="text-blue-400" />
            File Activity
          </h3>
          {activityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                />
                <Bar dataKey="files" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Files" />
                <Bar dataKey="downloads" fill="#8b5cf6" radius={[2, 2, 0, 0]} name="Downloads" />
                <Bar dataKey="sensitive" fill="#ef4444" radius={[2, 2, 0, 0]} name="Sensitive" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-slate-500 text-sm">
              No file activity data
            </div>
          )}
        </div>

        {/* Transfers & USB */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <UploadCloud size={16} className="text-green-400" />
            Data Transfers & USB
          </h3>
          {activityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                />
                <Bar dataKey="transfer" fill="#22c55e" radius={[2, 2, 0, 0]} name="Transfer (MB)" />
                <Bar dataKey="external" fill="#ef4444" radius={[2, 2, 0, 0]} name="External (MB)" />
                <Bar dataKey="usb" fill="#eab308" radius={[2, 2, 0, 0]} name="USB Events" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-slate-500 text-sm">
              No transfer data
            </div>
          )}
        </div>
      </div>

      {/* Alerts for this user */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-400" />
            Alert History
          </h3>
          <span className="text-xs text-slate-500">{alerts.length} total</span>
        </div>
        {alerts.length > 0 ? (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.alert_id}
                onClick={() => navigate(`/alerts/${alert.alert_id}`)}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 p-3 hover:bg-slate-800/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <SeverityBadge severity={alert.severity} />
                  <span className="text-xs font-mono text-slate-500">{alert.alert_id}</span>
                  <span className="text-xs text-slate-400">{alert.date}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-bold text-slate-300">{alert.risk_score.toFixed(0)}</div>
                  <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
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
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-16 text-slate-500 text-sm">
            No alerts for this user
          </div>
        )}
      </div>

      {/* Weekly Risk Trend Chart */}
      {riskTrend.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-indigo-400" />
            Behavioral Risk Trend (Weekly)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={riskTrend}>
              <defs>
                <linearGradient id="weeklyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="week" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
              />
              <Area type="monotone" dataKey="avg_risk_score" stroke="#f59e0b" fill="url(#weeklyGradient)" strokeWidth={2} name="Avg Risk" />
              <Line type="monotone" dataKey="max_risk_score" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 2 }} name="Max Risk" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
            <span>Trend direction: <strong className={riskTrend.length > 1 ? (
              riskTrend[riskTrend.length - 1].avg_risk_score > riskTrend[0].avg_risk_score ? 'text-red-400' :
              riskTrend[riskTrend.length - 1].avg_risk_score < riskTrend[0].avg_risk_score ? 'text-green-400' : 'text-slate-400'
            ) : 'text-slate-400'}>
              {riskTrend.length > 1 ? (
                riskTrend[riskTrend.length - 1].avg_risk_score > riskTrend[0].avg_risk_score ? '\u2191 Increasing' :
                riskTrend[riskTrend.length - 1].avg_risk_score < riskTrend[0].avg_risk_score ? '\u2193 Decreasing' : '\u2192 Stable'
              ) : 'Insufficient data'}
            </strong></span>
            <span>{riskTrend.length} weeks</span>
          </div>
        </div>
      )}

      {/* User baseline details */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Shield size={16} className="text-green-400" />
          Behavioral Baseline Status
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
            <div className="text-xs text-slate-500">Status</div>
            <div className={`text-sm font-bold mt-1 ${user.baseline_ready ? 'text-green-400' : 'text-yellow-400'}`}>
              {user.baseline_ready ? 'Established' : 'Learning'}
            </div>
          </div>
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
            <div className="text-xs text-slate-500">Days Observed</div>
            <div className="text-sm font-bold mt-1 text-slate-200">{user.baseline_days_seen || 0}</div>
          </div>
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
            <div className="text-xs text-slate-500">Sensitive Access</div>
            <div className={`text-sm font-bold mt-1 ${user.sensitive_access_normal ? 'text-blue-400' : 'text-slate-400'}`}>
              {user.sensitive_access_normal ? 'Normal (Role-based)' : 'Unusual'}
            </div>
          </div>
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
            <div className="text-xs text-slate-500">Known USB Devices</div>
            <div className="text-sm font-bold mt-1 text-slate-200">
              {(user.known_usb_devices?.length || 0)}
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate(`/users/${id}/baseline`)}
          className="btn-secondary w-full mt-4 text-sm flex items-center justify-center gap-2"
        >
          <Eye size={14} />
          View Full Baseline Comparison
        </button>
      </div>
    </div>
  );
}
