import { useState, useEffect } from 'react';
import {
  Shield, UserPlus, Users, RotateCw, Clock, FileText,
  Activity, AlertTriangle, CheckCircle, X, Search,
} from 'lucide-react';
import { api } from '../api/client';
import type { SOCUser, AuditLogEntry, ModelTrainingLog } from '../types';
import StatsCard from '../components/StatsCard';

export default function Admin() {
  const [activeTab, setActiveTab] = useState('users');
  const [socUsers, setSocUsers] = useState<SOCUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [retrainHistory, setRetrainHistory] = useState<ModelTrainingLog[]>([]);
  const [retraining, setRetraining] = useState(false);
  const [retrainMsg, setRetrainMsg] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);

  useEffect(() => {
    if (activeTab === 'users') api.listSOCUsers().then(setSocUsers).catch(() => {});
    if (activeTab === 'audit') api.getAuditLogs(50).then(setAuditLogs).catch(() => {});
    if (activeTab === 'retrain') api.getRetrainHistory().then(setRetrainHistory).catch(() => {});
  }, [activeTab]);

  const handleRetrain = async () => {
    setRetraining(true);
    setRetrainMsg('');
    try {
      const res = await api.triggerRetrain();
      setRetrainMsg(res.status === 'ok' ? '✅ Model retrained successfully' : '⚠️ Retrain triggered');
      api.getRetrainHistory().then(setRetrainHistory);
    } catch (e: any) {
      setRetrainMsg(`❌ ${e.message}`);
    }
    setRetraining(false);
  };

  const tabs = [
    { key: 'users', label: 'Users', icon: Users },
    { key: 'audit', label: 'Audit Logs', icon: FileText },
    { key: 'retrain', label: 'Model Retrain', icon: RotateCw },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Admin Dashboard</h2>
        <p className="text-sm text-slate-400 mt-1">System administration and user management</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 pb-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-slate-800/80 text-slate-200 border border-slate-700 border-b-transparent'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">{socUsers.length} SOC user{socUsers.length !== 1 ? 's' : ''}</p>
            <button onClick={() => setShowCreateUser(true)} className="btn-primary text-sm flex items-center gap-2">
              <UserPlus size={15} />
              Create User
            </button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="p-4">Username</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Full Name</th>
                  <th className="p-4">Active</th>
                  <th className="p-4">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {socUsers.map(u => (
                  <tr key={u.username} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="p-4 font-medium text-slate-200">{u.username}</td>
                    <td className="p-4 text-slate-400">{u.email}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        u.role === 'Admin' ? 'bg-indigo-900/60 text-indigo-300' :
                        u.role === 'Analyst' ? 'bg-blue-900/60 text-blue-300' :
                        'bg-slate-800/60 text-slate-400'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400">{u.full_name || '-'}</td>
                    <td className="p-4">{u.is_active ? <CheckCircle size={14} className="text-green-400" /> : <X size={14} className="text-red-400" />}</td>
                    <td className="p-4 text-slate-500 text-xs">{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showCreateUser && (
            <CreateUserModal onClose={() => setShowCreateUser(false)} onCreated={() => { setShowCreateUser(false); api.listSOCUsers().then(setSocUsers); }} />
          )}
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs text-slate-500 uppercase tracking-wider">
                <th className="p-4">Timestamp</th>
                <th className="p-4">User</th>
                <th className="p-4">Action</th>
                <th className="p-4">Resource</th>
                <th className="p-4">Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map(log => (
                <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="p-4 text-xs text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="p-4 font-medium text-slate-200">{log.username}</td>
                  <td className="p-4 text-slate-300">{log.action}</td>
                  <td className="p-4 text-slate-400 text-xs">
                    {log.resource_type && <span className="font-mono">{log.resource_type}/{log.resource_id}</span>}
                  </td>
                  <td className="p-4 text-xs text-slate-500 max-w-[200px] truncate">
                    {log.details ? JSON.stringify(log.details).slice(0, 80) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Retrain Tab */}
      {activeTab === 'retrain' && (
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Retrain AI Detection Model</h3>
            <p className="text-sm text-slate-400 mb-4">
              Triggers a full retraining of the Isolation Forest model using all available data.
              This will create a new model version and update behavioral baselines.
            </p>
            <button onClick={handleRetrain} disabled={retraining} className="btn-primary text-sm flex items-center gap-2">
              <RotateCw size={15} className={retraining ? 'animate-spin' : ''} />
              {retraining ? 'Retraining...' : 'Trigger Retrain'}
            </button>
            {retrainMsg && (
              <p className="mt-3 text-sm text-slate-300">{retrainMsg}</p>
            )}
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Training History</h3>
            {retrainHistory.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs text-slate-500 uppercase tracking-wider">
                    <th className="pb-3 pr-4">Version</th>
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">Users</th>
                    <th className="pb-3 pr-4">Samples</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Triggered By</th>
                  </tr>
                </thead>
                <tbody>
                  {retrainHistory.map(r => (
                    <tr key={r.version} className="border-b border-slate-800/50">
                      <td className="py-3 pr-4 font-mono text-slate-200">v{r.version}</td>
                      <td className="py-3 pr-4 text-slate-400 text-xs">{new Date(r.trained_at).toLocaleString()}</td>
                      <td className="py-3 pr-4 text-slate-400">{r.users_trained || '-'}</td>
                      <td className="py-3 pr-4 text-slate-400">{r.total_samples || '-'}</td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          r.status === 'completed' ? 'bg-green-900/60 text-green-300' : 'bg-yellow-900/60 text-yellow-300'
                        }`}>{r.status}</span>
                      </td>
                      <td className="py-3 pr-4 text-slate-400">{r.triggered_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500">No training history available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Analyst');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('Username, email, and password are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.createSOCUser(username.trim(), email.trim(), password, role, fullName.trim() || undefined);
      onCreated();
    } catch (e: any) {
      setError(e.message || 'Failed to create user');
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white">Create SOC User</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Username *</label>
              <input value={username} onChange={e => setUsername(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Role *</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="input-field w-full">
                <option value="Analyst">Analyst</option>
                <option value="Admin">Admin</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password *</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} className="input-field w-full" />
          </div>
          {error && <div className="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary text-sm">
            {submitting ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}
