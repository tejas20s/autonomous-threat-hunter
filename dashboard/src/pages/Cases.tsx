import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen, Plus, User, Calendar, Clock, AlertTriangle,
  ArrowUpDown, Search, X,
} from 'lucide-react';
import { api } from '../api/client';
import type { InvestigationCase as CaseType } from '../types';
import SeverityBadge from '../components/SeverityBadge';

const statusColors: Record<string, string> = {
  'Open': 'bg-blue-900/40 text-blue-300 border-blue-800/50',
  'Investigating': 'bg-yellow-900/40 text-yellow-300 border-yellow-800/50',
  'Resolved': 'bg-green-900/40 text-green-300 border-green-800/50',
  'False Positive': 'bg-slate-800/40 text-slate-400 border-slate-700/50',
};

export default function Cases() {
  const [cases, setCases] = useState<CaseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [alerts, setAlerts] = useState<{ alert_id: string; user_id: string; severity: string; risk_score: number }[]>([]);
  const navigate = useNavigate();

  const fetchCases = () => {
    setLoading(true);
    api.getCases({ status: statusFilter || undefined })
      .then(setCases)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCases(); }, [statusFilter]);

  const filtered = cases.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.case_id.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.user_id.toLowerCase().includes(q) ||
      (c.assigned_to?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold page-header">Investigation Cases</h2>
          <p className="text-sm page-subtitle mt-1">{filtered.length} case{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => {
            api.getAlerts({ limit: 100 }).then(setAlerts).catch(() => {});
            setShowCreateModal(true);
          }}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Plus size={16} />
          New Case
        </button>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {['', 'Open', 'Investigating', 'Resolved', 'False Positive'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              statusFilter === s
                ? 'bg-indigo-600/20 border-indigo-700/40 text-indigo-300'
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search cases by ID, title, user, or assignee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Case list */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
          <FolderOpen size={16} className="animate-pulse mr-2" />
          Loading cases...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-slate-500">
          <FolderOpen size={40} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">No cases found</p>
          <p className="text-xs mt-1">Create a case from an alert to start investigating</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div
              key={c.case_id}
              onClick={() => navigate(`/cases/${c.case_id}`)}
              className="card-hover p-4 cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusColors[c.status] || statusColors['Open']}`}>
                      {c.status}
                    </span>
                    <SeverityBadge severity={c.severity} />
                    <span className="font-mono text-xs text-slate-500">{c.case_id}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors mb-1">
                    {c.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <User size={12} /> {c.user_id}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} /> {c.created_at?.slice(0, 10)}
                    </span>
                    {c.assigned_to && (
                      <span className="flex items-center gap-1.5">
                        <User size={12} /> Assigned: {c.assigned_to}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-slate-500">
                      {c.alert_ids?.length || 0} alerts
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs text-slate-500">{c.updated_at?.slice(0, 10)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Case Modal */}
      {showCreateModal && (
        <CreateCaseModal
          alerts={alerts}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchCases(); }}
        />
      )}
    </div>
  );
}

function CreateCaseModal({
  alerts, onClose, onCreated,
}: {
  alerts: { alert_id: string; user_id: string; severity: string; risk_score: number }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);
  const [severity, setSeverity] = useState('Medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (!selectedUserId) { setError('Select a user'); return; }
    if (selectedAlertIds.length === 0) { setError('Select at least one alert'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.createCase(title.trim(), selectedUserId, selectedAlertIds, description || undefined, severity, assignedTo || undefined);
      onCreated();
    } catch (e: any) {
      setError(e.message || 'Failed to create case');
    } finally {
      setSubmitting(false);
    }
  };

  const uniqueUsers = [...new Set(alerts.map(a => a.user_id))].sort();

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white">Create Investigation Case</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Suspicious USB activity on user001" className="input-field w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Optional description..." className="input-field w-full resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">User *</label>
              <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="input-field w-full">
                <option value="">Select user...</option>
                {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Severity</label>
              <select value={severity} onChange={e => setSeverity(e.target.value)} className="input-field w-full">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Assigned To</label>
            <input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="Analyst username (optional)" className="input-field w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Link Alerts * ({selectedAlertIds.length} selected)</label>
            <div className="max-h-32 overflow-y-auto space-y-1.5 rounded-lg border border-slate-700/50 bg-slate-800/30 p-2">
              {alerts.slice(0, 50).map(a => (
                <label key={a.alert_id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                  selectedAlertIds.includes(a.alert_id) ? 'bg-indigo-900/30 text-indigo-300' : 'text-slate-400 hover:text-slate-200'
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedAlertIds.includes(a.alert_id)}
                    onChange={() => setSelectedAlertIds(prev =>
                      prev.includes(a.alert_id) ? prev.filter(id => id !== a.alert_id) : [...prev, a.alert_id]
                    )}
                    className="rounded border-slate-600"
                  />
                  <span className="font-mono">{a.alert_id}</span>
                  <span className="text-slate-500">({a.user_id})</span>
                  <span className={`ml-auto font-bold ${a.risk_score >= 60 ? 'text-red-400' : a.risk_score >= 40 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {a.risk_score.toFixed(0)}
                  </span>
                </label>
              ))}
            </div>
          </div>
          {error && <div className="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary text-sm">
            {submitting ? 'Creating...' : 'Create Case'}
          </button>
        </div>
      </div>
    </div>
  );
}
