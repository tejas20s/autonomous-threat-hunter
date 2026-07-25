import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Users, AlertTriangle, Shield, TrendingUp, Building2, Activity,
  Briefcase, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { api } from '../api/client';
import type { ExecutiveSummary } from '../types';
import StatsCard from '../components/StatsCard';
import SeverityBadge from '../components/SeverityBadge';

const SEVERITY_COLORS = {
  Critical: '#dc2626', High: '#ea580c', Medium: '#ca8a04', Low: '#16a34a',
};

export default function ExecutiveDashboard() {
  const [data, setData] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getExecutiveSummary()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const severityPieData = useMemo(() => {
    if (!data?.severity_counts) return [];
    return Object.entries(data.severity_counts)
      .filter(([_, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Activity size={20} className="animate-spin mr-2" />
        Loading executive dashboard...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Briefcase size={40} className="mb-3 opacity-30" />
        <p>No executive data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold page-header flex items-center gap-3">
          <Briefcase className="text-indigo-400" size={24} />
          Executive Dashboard
        </h2>
        <p className="text-sm page-subtitle mt-1">
          Organizational overview — threat landscape, department risk, and top concerns
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title="Total Employees"
          value={data.total_employees}
          subtitle="Monitored users"
          icon={Users}
          color="blue"
        />
        <StatsCard
          title="Active Alerts"
          value={data.active_alerts}
          subtitle={`${(data.active_alerts / Math.max(data.total_alerts_all, 1) * 100).toFixed(0)}% of total`}
          icon={AlertTriangle}
          color="red"
        />
        <StatsCard
          title="Org Risk Score"
          value={data.avg_organizational_risk.toFixed(1)}
          subtitle="Average across all users"
          icon={TrendingUp}
          color="purple"
        />
        <StatsCard
          title="Open Cases"
          value={data.open_investigations}
          subtitle="Active investigations"
          icon={Shield}
          color="red"
        />
        <StatsCard
          title="Critical Alerts"
          value={data.severity_counts.Critical || 0}
          subtitle="Requires immediate attention"
          icon={Activity}
          color="red"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity pie */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold page-subtitle mb-4">Alert Severity Distribution</h3>
          {severityPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={severityPieData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {severityPieData.map((entry) => (
                    <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name as keyof typeof SEVERITY_COLORS]} stroke="rgba(0,0,0,0.3)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                <Legend formatter={(value: string) => <span style={{ color: '#cbd5e1', fontSize: '13px' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-slate-500 text-sm">No data</div>
          )}
        </div>

        {/* Department risk chart */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold page-subtitle mb-4">Department Risk Comparison</h3>
          {data.departments.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.departments} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} domain={[0, 100]} />
                <YAxis type="category" dataKey="department" stroke="#64748b" tick={{ fontSize: 11 }} width={80} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                <Bar dataKey="avg_risk_score" radius={[0, 4, 4, 0]} name="Avg Risk">
                  {data.departments.map((d, idx) => (
                    <Cell key={idx} fill={d.avg_risk_score >= 40 ? '#ef4444' : d.avg_risk_score >= 20 ? '#f59e0b' : '#22c55e'} />
                  ))}
                </Bar>
                <Bar dataKey="max_risk_score" radius={[0, 4, 4, 0]} name="Max Risk" fill="#818cf8" opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-slate-500 text-sm">No department data</div>
          )}
        </div>
      </div>

      {/* Department detail table */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold page-subtitle mb-4 flex items-center gap-2">
          <Building2 size={16} className="text-indigo-400" />
          Department Breakdown
        </h3>
        {data.departments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Department</th>
                  <th className="pb-3 pr-4">Avg Risk</th>
                  <th className="pb-3 pr-4">Max Risk</th>
                  <th className="pb-3 pr-4">Alert Rate</th>
                  <th className="pb-3 pr-4">Total Days</th>
                  <th className="pb-3 pr-4">Alert Days</th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map((dept) => (
                  <tr
                    key={dept.department}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/departments?dept=${dept.department}`)}
                  >
                    <td className="py-3 pr-4 font-medium text-slate-200">{dept.department}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${dept.avg_risk_score}%`,
                            backgroundColor: dept.avg_risk_score >= 40 ? '#ef4444' : dept.avg_risk_score >= 20 ? '#f59e0b' : '#22c55e',
                          }} />
                        </div>
                        <span className="text-xs font-mono text-slate-300">{dept.avg_risk_score.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-sm text-orange-400">{dept.max_risk_score.toFixed(1)}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-sm font-medium ${dept.alert_rate > 20 ? 'text-red-400' : dept.alert_rate > 10 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {dept.alert_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-400">{dept.total_days}</td>
                    <td className="py-3 pr-4 text-slate-400">{dept.alert_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-16 text-slate-500 text-sm">No department data</div>
        )}
      </div>

      {/* Top risky employees */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold page-subtitle mb-4 flex items-center gap-2">
          <Users size={16} className="text-orange-400" />
          Top Risky Employees
        </h3>
        {data.top_risky_employees.length > 0 ? (
          <div className="space-y-3">
            {data.top_risky_employees.map((emp, idx) => (
              <div
                key={emp.user_id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 p-3 hover:bg-slate-800/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/users/${emp.user_id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                    idx < 3 ? 'bg-red-900/40 text-red-400' : 'bg-slate-800 text-slate-400'
                  }`}>
                    #{idx + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-200">{emp.user_id}</div>
                    <div className="text-xs text-slate-500">{emp.active_days} days active · {emp.alert_days} alert days</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-bold text-red-400">{emp.max_risk_score.toFixed(0)}</div>
                    <div className="text-[10px] text-slate-500">max risk</div>
                  </div>
                  <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${emp.avg_risk_score}%`,
                        backgroundColor: emp.avg_risk_score >= 40 ? '#ef4444' : emp.avg_risk_score >= 20 ? '#f59e0b' : '#22c55e',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-16 text-slate-500 text-sm">No employee data</div>
        )}
      </div>
    </div>
  );
}
