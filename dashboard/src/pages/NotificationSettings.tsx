import { useState, useEffect } from 'react';
import { BellRing, Plus, X, Activity, Mail, MessageSquare, Globe, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '../api/client';
import type { NotificationConfig } from '../types';

const channelIcons: Record<string, any> = {
  Email: Mail,
  Slack: MessageSquare,
  Teams: Globe,
};

export default function NotificationSettings() {
  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newChannel, setNewChannel] = useState('Email');
  const [newMinSeverity, setNewMinSeverity] = useState('High');
  const [newWebhook, setNewWebhook] = useState('');

  const fetchConfigs = () => {
    setLoading(true);
    api.getNotificationConfigs().then(setConfigs).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchConfigs(); }, []);

  const handleAdd = async () => {
    try {
      const config: Record<string, any> = {};
      if (newWebhook) config.webhook_url = newWebhook;
      await api.createNotificationConfig(newChannel, newMinSeverity, config);
      setShowAdd(false);
      setNewWebhook('');
      fetchConfigs();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold page-header">Notification Settings</h2>
          <p className="text-sm page-subtitle mt-1">Configure alert notification channels</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={16} />
          Add Channel
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400">
          <Activity size={16} className="animate-spin mr-2" />
          Loading...
        </div>
      ) : configs.length === 0 && !showAdd ? (
        <div className="card flex flex-col items-center justify-center py-16 text-slate-500">
          <BellRing size={40} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">No notification channels configured</p>
          <p className="text-xs mt-1">Add Email, Slack, or Teams channels to receive alert notifications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map(c => {
            const Icon = channelIcons[c.channel] || BellRing;
            return (
              <div key={c.id} className="card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 border border-slate-700">
                      <Icon size={20} className="text-slate-300" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-200">{c.channel}</h3>
                      <p className="text-xs text-slate-500">
                        Min severity: <span className="text-slate-400 font-medium">{c.min_severity}</span>
                        {c.config?.webhook_url && ` · Webhook configured`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center gap-1.5 text-xs ${c.enabled ? 'text-green-400' : 'text-slate-500'}`}>
                      {c.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      {c.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Channel Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-white">Add Notification Channel</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Channel</label>
                <select value={newChannel} onChange={e => setNewChannel(e.target.value)} className="input-field w-full">
                  <option value="Email">Email</option>
                  <option value="Slack">Slack</option>
                  <option value="Teams">Microsoft Teams</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Minimum Severity</label>
                <select value={newMinSeverity} onChange={e => setNewMinSeverity(e.target.value)} className="input-field w-full">
                  <option value="Critical">Critical Only</option>
                  <option value="High">High+</option>
                  <option value="Medium">Medium+</option>
                  <option value="Low">All</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Webhook URL (optional)</label>
                <input value={newWebhook} onChange={e => setNewWebhook(e.target.value)} placeholder="https://hooks.slack.com/..." className="input-field w-full" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800">
              <button onClick={() => setShowAdd(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleAdd} className="btn-primary text-sm">Add Channel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
