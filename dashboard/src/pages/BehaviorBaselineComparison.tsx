import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Building2, Activity, AlertTriangle,
  Shield, CheckCircle, Clock, Download, FileText, Usb, UploadCloud,
  LogIn, Lock, Globe, Moon, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Cell,
} from 'recharts';
import { api } from '../api/client';
import type { BaselineComparison, BaselineComparisonItem } from '../types';
import SeverityBadge from '../components/SeverityBadge';

const iconMap: Record<string, typeof FileText> = {
  clock: Clock,
  files: FileText,
  shield: Shield,
  download: Download,
  usb: Usb,
  usb_data: Usb,
  transfer: UploadCloud,
  external: UploadCloud,
  lock: Lock,
  ip: Globe,
  moon: Moon,
};

export default function BehaviorBaselineComparison() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<BaselineComparison | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.getBaselineComparison(id)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Activity size={20} className="animate-spin mr-2" />
        Loading behavior profile...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <User size={40} className="mb-3 opacity-30" />
        <p>No baseline data found for this user</p>
        <button onClick={() => navigate('/users')} className="btn-primary mt-4 text-sm">
          Back to Users
        </button>
      </div>
    );
  }

  const abnormalItems = data.comparisons.filter((c) => c.is_abnormal);
  const chartData = data.comparisons.map((c) => ({
    name: c.label.split(' ').slice(1).join(' ').slice(0, 15),
    normal: c.normal_mean,
    today: typeof c.today_value === 'number' ? c.today_value : 0,
    abnormal: c.is_abnormal,
  }));

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate(`/users/${id}`)}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to {id}
      </button>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">Behavioral Baseline Comparison</h2>
            </div>
            <p className="text-sm text-slate-400">
              Comparing {data.user_id}'s activity on <strong className="text-slate-300">{data.latest_date}</strong> against their normal behavior
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
              <span>Baseline: <strong className={data.baseline_ready ? 'text-green-400' : 'text-yellow-400'}>
                {data.baseline_ready ? 'Established' : 'Learning'}
              </strong></span>
              <span>Days observed: <strong className="text-slate-300">{data.baseline_days_seen}</strong></span>
              <span>Deviations found: <strong className={data.deviations_found >= 3 ? 'text-red-400' : data.deviations_found > 0 ? 'text-yellow-400' : 'text-green-400'}>
                {data.deviations_found}
              </strong></span>
            </div>
          </div>
          <div className={`text-sm font-semibold px-4 py-2 rounded-lg border ${
            data.deviations_found >= 3
              ? 'bg-red-900/30 border-red-700/50 text-red-300'
              : data.deviations_found > 0
              ? 'bg-yellow-900/30 border-yellow-700/50 text-yellow-300'
              : 'bg-green-900/30 border-green-700/50 text-green-300'
          }`}>
            {data.overall_status}
          </div>
        </div>
      </div>

      {/* Comparison chart */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-400" />
          Normal vs Today — Key Behavioral Metrics
        </h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} width={100} />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                }}
              />
              <Bar dataKey="normal" fill="#64748b" radius={[0, 4, 4, 0]} name="Normal (Mean)" opacity={0.6} />
              <Bar dataKey="today" radius={[0, 4, 4, 0]} name="Today">
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.abnormal ? '#ef4444' : '#22c55e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-slate-500 text-sm">
            No comparison data available
          </div>
        )}
      </div>

      {/* Feature-by-feature comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.comparisons.map((item: BaselineComparisonItem) => {
          const Icon = iconMap[item.icon] || Activity;
          return (
            <div
              key={item.feature}
              className={`card p-4 border ${
                item.is_abnormal
                  ? item.severity === 'High'
                    ? 'border-red-800/40 bg-red-900/10'
                    : 'border-yellow-800/40 bg-yellow-900/10'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  item.is_abnormal ? 'bg-red-900/40 text-red-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-slate-200">{item.label}</h4>
                    {item.is_abnormal && (
                      <SeverityBadge severity={item.severity as any} />
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-slate-800/50 p-2">
                      <span className="text-slate-500">Normal</span>
                      <div className="text-slate-300 font-medium mt-0.5">{item.normal_display}</div>
                      {item.normal_std > 0 && (
                        <div className="text-slate-600 mt-0.5">±{item.normal_std.toFixed(1)} std</div>
                      )}
                    </div>
                    <div className={`rounded p-2 ${
                      item.is_abnormal ? 'bg-red-900/20 border border-red-800/30' : 'bg-slate-800/50'
                    }`}>
                      <span className="text-slate-500">Today</span>
                      <div className={`font-bold mt-0.5 ${
                        item.is_abnormal ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {item.today_display}
                      </div>
                      {item.is_abnormal && (
                        <div className="text-red-400/70 mt-0.5">
                          Z-score: {item.z_score.toFixed(1)}σ
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alerts if abnormal */}
      {abnormalItems.length > 0 && (
        <div className="card p-5 border-red-800/30">
          <h3 className="text-sm font-semibold text-red-300 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} />
            {abnormalItems.length} Behavioral Deviation{abnormalItems.length > 1 ? 's' : ''} Detected
          </h3>
          <div className="space-y-2">
            {abnormalItems.map((item) => (
              <div key={item.feature} className="flex items-start gap-2 text-sm text-slate-300">
                <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p>
                  <strong className="text-slate-200">{item.label}</strong> — Normal: <strong className="text-slate-400">{item.normal_display}</strong>, Today: <strong className="text-red-400">{item.today_display}</strong> ({item.z_score.toFixed(1)}σ deviation)
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
