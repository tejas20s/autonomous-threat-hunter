import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend,
} from 'recharts';
import {
  Building2, Users, AlertTriangle, ArrowRight, TrendingUp, Activity,
} from 'lucide-react';
import { api } from '../api/client';
import type { DepartmentStats } from '../types';
import SeverityBadge from '../components/SeverityBadge';

const SEVERITY_COLORS = {
  Critical: '#dc2626',
  High: '#ea580c',
  Medium: '#ca8a04',
  Low: '#16a34a',
};

export default function Departments() {
  const [deptNames, setDeptNames] = useState<string[]>([]);
  const [deptStats, setDeptStats] = useState<DepartmentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getDepartments()
      .then((names) => {
        setDeptNames(names);
        return Promise.all(names.map((d) => api.getDepartmentStats(d)));
      })
      .then(setDeptStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Aggregate stats
  const totalAlerts = deptStats.reduce((sum, d) => sum + d.total_alerts, 0);
  const totalUsers = deptStats.reduce((sum, d) => sum + d.user_count, 0);

  const chartData = deptStats.map((d) => ({
    name: d.department,
    alerts: d.total_alerts,
    avgRisk: Math.round(d.avg_risk_score),
  }));

  const severityPieData = deptStats.reduce<{ name: string; value: number }[]>((acc, d) => {
    Object.entries(d.alert_severity_counts).forEach(([sev, count]) => {
      const existing = acc.find((a) => a.name === sev);
      if (existing) existing.value += count;
      else acc.push({ name: sev, value: count });
    });
    return acc;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Activity size={20} className="animate-spin mr-2" />
        Loading department data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Departments</h2>
        <p className="text-sm text-slate-400 mt-1">
          {deptStats.length} departments · {totalUsers} users · {totalAlerts} alerts
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {deptStats.map((dept) => (
          <div
            key={dept.department}
            className="card-hover p-5 cursor-pointer"
            onClick={() => navigate(`/users?department=${dept.department}`)}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">{dept.department}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {dept.user_count} users
                </p>
              </div>
              <Building2 size={20} className="text-indigo-400" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-orange-400" />
                <span className="text-lg font-bold text-white">{dept.total_alerts}</span>
                <span className="text-xs text-slate-500">alerts</span>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <TrendingUp size={12} />
                  Avg: {dept.avg_risk_score.toFixed(0)}
                </div>
              </div>
            </div>
            {/* Mini severity bars */}
            <div className="mt-3 flex gap-1">
              {(['Critical', 'High', 'Medium', 'Low'] as const).map((sev) => {
                const count = dept.alert_severity_counts[sev] || 0;
                const pct = dept.total_alerts > 0 ? (count / dept.total_alerts) * 100 : 0;
                return (
                  <div
                    key={sev}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.max(pct, 1)}%`,
                      backgroundColor: SEVERITY_COLORS[sev],
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts per department */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Alerts by Department</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                />
                <Bar dataKey="alerts" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={['#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81'][idx % 6]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-500 text-sm">
              No data available
            </div>
          )}
        </div>

        {/* Severity distribution */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Alert Severity Distribution</h3>
          {severityPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={severityPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {severityPieData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={SEVERITY_COLORS[entry.name as keyof typeof SEVERITY_COLORS]}
                      stroke="rgba(0,0,0,0.3)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                />
                <Legend
                  formatter={(value: string) => (
                    <span style={{ color: '#cbd5e1', fontSize: '13px' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-500 text-sm">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Avg risk score chart */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Average Risk Score by Department</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} width={90} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
              />
              <Bar dataKey="avgRisk" radius={[0, 4, 4, 0]}>
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={['#f97316', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'][idx % 6]} />
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

      {/* Department detail table */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Department Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs text-slate-500 uppercase tracking-wider">
                <th className="pb-3 pr-4">Department</th>
                <th className="pb-3 pr-4">Users</th>
                <th className="pb-3 pr-4">Alerts</th>
                <th className="pb-3 pr-4">Avg Risk</th>
                <th className="pb-3 pr-4">Critical</th>
                <th className="pb-3 pr-4">High</th>
                <th className="pb-3 pr-4">Medium</th>
                <th className="pb-3 pr-4">Low</th>
              </tr>
            </thead>
            <tbody>
              {deptStats.map((dept) => (
                <tr
                  key={dept.department}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/users?department=${dept.department}`)}
                >
                  <td className="py-3 pr-4 font-medium text-slate-200">{dept.department}</td>
                  <td className="py-3 pr-4 text-slate-400">{dept.user_count}</td>
                  <td className="py-3 pr-4 text-slate-400">{dept.total_alerts}</td>
                  <td className="py-3 pr-4 text-slate-400">{dept.avg_risk_score.toFixed(1)}</td>
                  <td className="py-3 pr-4">
                    <span className="text-red-400 font-medium">{dept.alert_severity_counts.Critical || 0}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-orange-400 font-medium">{dept.alert_severity_counts.High || 0}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-yellow-400 font-medium">{dept.alert_severity_counts.Medium || 0}</span>
                  </td>
                  <td className="py-3">
                    <span className="text-green-400 font-medium">{dept.alert_severity_counts.Low || 0}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
