import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Clock, User, Building2, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { api } from '../api/client';
import type { Alert } from '../types';
import SeverityBadge from '../components/SeverityBadge';
import FilterBar from '../components/FilterBar';

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [department, setDepartment] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [departments, setDepartments] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.getDepartments().then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .getAlerts({
        severity: severity || undefined,
        search: search || undefined,
        department: department || undefined,
        min_score: minScore || undefined,
        limit: 200,
      })
      .then(setAlerts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [severity, department, minScore]);

  // Client-side search filter (server also filters)
  const filteredAlerts = alerts.filter((a) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        a.user_id.toLowerCase().includes(q) ||
        a.department.toLowerCase().includes(q) ||
        a.alert_id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const severityCount = (sev: string) =>
    filteredAlerts.filter((a) => a.severity === sev).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold page-header">Alert Queue</h2>
          <p className="text-sm page-subtitle mt-1">
            {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </div>

      {/* Severity quick filters */}
      <div className="flex flex-wrap gap-2">
        {['Critical', 'High', 'Medium', 'Low'].map((sev) => (
          <button
            key={sev}
            onClick={() => setSeverity(severity === sev ? '' : sev)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              severity === sev
                ? sev === 'Critical'
                  ? 'bg-red-900/40 border-red-700 text-red-300'
                  : sev === 'High'
                  ? 'bg-orange-900/40 border-orange-700 text-orange-300'
                  : sev === 'Medium'
                  ? 'bg-yellow-900/40 border-yellow-700 text-yellow-300'
                  : 'bg-green-900/40 border-green-700 text-green-300'
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle size={12} />
            {sev}
            <span className="ml-1 opacity-70">({severityCount(sev)})</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        severity={severity}
        onSeverityChange={setSeverity}
        department={department}
        onDepartmentChange={setDepartment}
        departments={departments}
        minScore={minScore}
        onMinScoreChange={setMinScore}
      />

      {/* Alert list */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
          <Bell size={16} className="animate-pulse mr-2" />
          Loading alerts...
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-slate-500">
          <Bell size={40} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">No alerts match your filters</p>
          <p className="text-xs mt-1">Try adjusting your search or filter criteria</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.alert_id}
              onClick={() => navigate(`/alerts/${alert.alert_id}`)}
              className="card-hover p-4 cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <SeverityBadge severity={alert.severity} />
                    <span className="font-mono text-xs text-slate-500">
                      {alert.alert_id}
                    </span>
                    {alert.acknowledged && (
                      <span className="badge bg-blue-900/40 text-blue-300 border border-blue-800/50">
                        Acknowledged
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <User size={13} className="text-slate-500" />
                      {alert.user_id}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Building2 size={13} className="text-slate-500" />
                      {alert.department}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Clock size={13} className="text-slate-500" />
                      {alert.date}
                    </span>
                  </div>
                  {/* Top reason */}
                  {alert.reasons && alert.reasons.length > 0 && (
                    <p className="mt-2 text-xs text-slate-400 line-clamp-1">
                      {alert.reasons[0].explanation}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div
                    className={`text-xl font-bold ${
                      alert.risk_score >= 80
                        ? 'text-red-400'
                        : alert.risk_score >= 60
                        ? 'text-orange-400'
                        : alert.risk_score >= 40
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    }`}
                  >
                    {alert.risk_score.toFixed(0)}
                  </div>
                  <span className="text-[10px] text-slate-500">risk score</span>
                  <div className="w-20 h-1 bg-slate-700 rounded-full overflow-hidden mt-1">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
