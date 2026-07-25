import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Cell,
} from 'recharts';
import {
  Activity, TrendingUp, AlertTriangle, CheckCircle, XCircle,
  Clock, Target, BarChart3, Shield, Brain,
} from 'lucide-react';
import { api } from '../api/client';
import type { DetectionPerformance } from '../types';
import StatsCard from '../components/StatsCard';
import SeverityBadge from '../components/SeverityBadge';

export default function DetectionPerformance() {
  const [data, setData] = useState<DetectionPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDetectionPerformance()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const confusionMatrixData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'True Positives', value: data.true_positives, color: '#22c55e' },
      { name: 'False Positives', value: data.false_positives, color: '#ef4444' },
      { name: 'False Negatives', value: data.false_negatives, color: '#f59e0b' },
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Activity size={20} className="animate-spin mr-2" />
        Computing detection performance...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <BarChart3 size={40} className="mb-3 opacity-30" />
        <p>No performance data available. Run the pipeline first.</p>
      </div>
    );
  }

  const metrics = [
    { label: 'Precision', value: data.precision, icon: Target, color: 'blue', suffix: '%', pct: true },
    { label: 'Recall', value: data.recall, icon: CheckCircle, color: 'green', suffix: '%', pct: true },
    { label: 'F1 Score', value: data.f1_score, icon: Brain, color: 'purple', suffix: '%', pct: true },
    { label: 'False Positive Rate', value: data.false_positive_rate, icon: XCircle, color: 'red', suffix: '%', pct: true },
    { label: 'Avg Detection Latency', value: data.detection_latency_avg_hours, icon: Clock, color: 'orange', suffix: ' hours', pct: false },
    { label: 'High/Critical Alerts', value: data.total_high_critical_alerts, icon: AlertTriangle, color: 'red', suffix: '', pct: false },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <BarChart3 className="text-green-400" size={24} />
          Detection Performance
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          AI model metrics computed against {data.total_injected_scenarios} injected ground-truth scenarios
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((m) => (
          <StatsCard
            key={m.label}
            title={m.label}
            value={m.pct ? (m.value * 100).toFixed(1) + '%' : m.value.toFixed(1)}
            subtitle={m.suffix === '%' ? '0 to 100% scale' : ''}
            icon={m.icon}
            color={m.color as any}
          />
        ))}
      </div>

      {/* Confusion Matrix + Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confusion Matrix */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Shield size={16} className="text-indigo-400" />
            Confusion Matrix
          </h3>
          {confusionMatrixData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={confusionMatrixData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Count">
                  {confusionMatrixData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-slate-500 text-sm">No data</div>
          )}
        </div>

        {/* Performance details */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Activity size={16} className="text-indigo-400" />
            Performance Summary
          </h3>
          <div className="space-y-4">
            {/* Injected vs detected */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-400">Scenarios Detected</span>
                <span className="text-slate-200 font-medium">
                  {data.scenarios_caught_at_high_critical} / {data.total_injected_scenarios}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${(data.scenarios_caught_at_high_critical / Math.max(data.total_injected_scenarios, 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Precision gauge */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-400">Precision</span>
                <span className={`font-medium ${data.precision >= 0.8 ? 'text-green-400' : data.precision >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {(data.precision * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${data.precision * 100}%` }} />
              </div>
            </div>

            {/* Recall gauge */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-400">Recall</span>
                <span className={`font-medium ${data.recall >= 0.8 ? 'text-green-400' : data.recall >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {(data.recall * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${data.recall * 100}%` }} />
              </div>
            </div>

            {/* F1 gauge */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-400">F1 Score</span>
                <span className={`font-medium ${data.f1_score >= 0.8 ? 'text-green-400' : data.f1_score >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {(data.f1_score * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${data.f1_score * 100}%` }} />
              </div>
            </div>

            {/* FP rate */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-400">False Positive Rate</span>
                <span className={`font-medium ${data.false_positive_rate < 0.1 ? 'text-green-400' : data.false_positive_rate < 0.3 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {(data.false_positive_rate * 100).toFixed(2)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${Math.min(data.false_positive_rate * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-green-400">{data.true_positives}</div>
          <div className="text-xs text-slate-500 mt-1">True Positives</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-red-400">{data.false_positives}</div>
          <div className="text-xs text-slate-500 mt-1">False Positives</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-yellow-400">{data.false_negatives}</div>
          <div className="text-xs text-slate-500 mt-1">False Negatives (Missed)</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-slate-400">{data.true_negatives_excluding_low}</div>
          <div className="text-xs text-slate-500 mt-1">True Negatives (Low)</div>
        </div>
      </div>

      {/* Missed scenarios */}
      {data.missed_scenarios && data.missed_scenarios.length > 0 && (
        <div className="card p-5 border-yellow-800/30">
          <h3 className="text-sm font-semibold text-yellow-300 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} />
            Missed Scenarios ({data.missed_scenarios.length})
          </h3>
          <div className="space-y-2">
            {data.missed_scenarios.map((m, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm text-slate-300">
                <XCircle size={14} className="text-yellow-500 shrink-0" />
                <span>{m.user_id} on {m.date} — scenario: <code className="text-slate-400">{m.scenario}</code></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
