import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from 'recharts';
import {
  ArrowLeft, User, Building2, Calendar, Shield, Activity,
  CheckCircle, FileText, Download, Usb, UploadCloud, LogIn,
  ExternalLink, AlertTriangle, Brain, TrendingUp, Lock,
  Zap, Target, Eye, Flag, XCircle, MessageSquare, FolderOpen,
} from 'lucide-react';
import { api } from '../api/client';
import type { AlertDetail as AlertDetailType, TimelineDay, UserInfo, AiInsights, InvestigationSummary, AlertComment } from '../types';
import SeverityBadge from '../components/SeverityBadge';

const EvidenceIcon = ({ label }: { label: string }) => {
  const iconMap: Record<string, typeof FileText> = {
    avg_login_hour: LogIn,
    earliest_login_hour: LogIn,
    failed_logins: AlertTriangle,
    files_accessed: FileText,
    sensitive_files_accessed: Shield,
    files_downloaded: Download,
    usb_events: Usb,
    usb_first_time: Usb,
    usb_data_mb: Usb,
    transfer_mb: UploadCloud,
    external_transfer_mb: UploadCloud,
  };
  const Icon = iconMap[label] || Activity;
  return <Icon size={14} />;
};

const featureLabels: Record<string, string> = {
  avg_login_hour: 'Avg Login Time',
  earliest_login_hour: 'Earliest Login',
  failed_logins: 'Failed Logins',
  files_accessed: 'Files Accessed',
  sensitive_files_accessed: 'Sensitive Files',
  files_downloaded: 'Files Downloaded',
  usb_events: 'USB Events',
  usb_first_time: 'New USB Devices',
  usb_data_mb: 'USB Data (MB)',
  transfer_mb: 'Data Transfer (MB)',
  external_transfer_mb: 'External Transfer (MB)',
};

const SEVERITY_COLORS = {
  Critical: '#dc2626',
  High: '#ea580c',
  Medium: '#ca8a04',
  Low: '#16a34a',
};

export default function AlertDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [alert, setAlert] = useState<AlertDetailType | null>(null);
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [caseSummary, setCaseSummary] = useState<InvestigationSummary | null>(null);
  const [expandedSection, setExpandedSection] = useState<string>('reasons');
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [caseCreated, setCaseCreated] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getAlert(id)
      .then(async (a) => {
        setAlert(a);
        const [tl, ui, ai, cs] = await Promise.all([
          api.getUserTimeline(a.user_id).catch(() => [] as TimelineDay[]),
          api.getUser(a.user_id).catch(() => null),
          api.getAiInsights(id).catch(() => null),
          // Check if this alert is linked to a case for investigation summary
          api.getCases({ limit: 50 }).then(async (cases) => {
            const linkedCase = cases.find((c: any) => 
              c.alert_ids && c.alert_ids.includes(a.alert_id) && 
              c.status === 'Resolved'
            );
            if (linkedCase) {
              return api.getCaseSummary(linkedCase.case_id).catch(() => null);
            }
            return null;
          }).catch(() => null),
        ]);
        setTimeline(tl);
        setUserInfo(ui);
        setAiInsights(ai);
        setCaseSummary(cs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async (status: string) => {
    if (!alert) return;
    setUpdating(true);
    try {
      let assignedTo: string | undefined;
      let resolutionNotes: string | undefined;
      if (status === 'Investigating') {
        assignedTo = prompt('Assign to (username):') || undefined;
      }
      if (status === 'Resolved' || status === 'False Positive') {
        resolutionNotes = prompt('Resolution notes:') || undefined;
      }
      await api.updateAlertStatus(alert.alert_id, status, assignedTo, resolutionNotes);
      // Re-fetch alert
      const updated = await api.getAlert(alert.alert_id);
      setAlert(updated);
    } catch (e) {
      console.error(e);
    }
    setUpdating(false);
  };

  const handleAddComment = async () => {
    if (!alert || !newComment.trim()) return;
    setSubmittingComment(true);
    try {
      await api.addAlertComment(alert.alert_id, newComment.trim());
      setNewComment('');
      // Re-fetch to get new comment
      const updated = await api.getAlert(alert.alert_id);
      setAlert(updated);
    } catch (e) { console.error(e); }
    setSubmittingComment(false);
  };

  const handleCreateCase = async () => {
    if (!alert) return;
    const title = prompt('Case title:', `Investigation - ${alert.alert_id} - ${alert.user_id}`);
    if (!title) return;
    setUpdating(true);
    try {
      await api.createCase(title, alert.user_id, [alert.alert_id]);
      setCaseCreated(true);
    } catch (e) {
      console.error(e);
    }
    setUpdating(false);
  };

  const chartData = useMemo(() => {
    if (timeline.length === 0) return [];
    return timeline.slice(-30).map((d) => ({
      date: d.date.slice(5),
      score: d.risk_score,
      files: d.files_accessed,
      sensitive: d.sensitive_files_accessed,
    }));
  }, [timeline]);

  const scoreBreakdownPieData = useMemo(() => {
    if (!aiInsights) return [];
    return [
      { name: 'Isolation Forest', value: aiInsights.score_breakdown.isolation_forest_contribution, color: '#818cf8' },
      { name: 'Rule-Based', value: aiInsights.score_breakdown.rule_based_contribution, color: '#f59e0b' },
      { name: 'Unquantified', value: Math.max(0, aiInsights.score_breakdown.unquantified_contribution), color: '#64748b' },
    ].filter((d) => d.value > 0);
  }, [aiInsights]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Activity size={20} className="animate-spin mr-2" />
        Loading alert details...
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <AlertTriangle size={40} className="mb-3 opacity-30" />
        <p>Alert not found</p>
        <button onClick={() => navigate('/alerts')} className="btn-primary mt-4 text-sm">
          Back to Alerts
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/alerts')}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Alerts
      </button>

      {/* Alert header */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <SeverityBadge severity={alert.severity} size="lg" />
              <span className="font-mono text-sm text-slate-500">{alert.alert_id}</span>
              {alert.acknowledged && (
                <span className="badge bg-blue-900/40 text-blue-300 border border-blue-800/50">
                  <CheckCircle size={12} className="mr-1" />
                  Acknowledged
                </span>
              )}
              {aiInsights && (
                <span className={`badge ${
                  aiInsights.ai_confidence === 'High' ? 'bg-green-900/40 text-green-300 border border-green-800/50' :
                  aiInsights.ai_confidence === 'Medium-High' ? 'bg-blue-900/40 text-blue-300 border border-blue-800/50' :
                  aiInsights.ai_confidence === 'Medium' ? 'bg-yellow-900/40 text-yellow-300 border border-yellow-800/50' :
                  'bg-slate-800/40 text-slate-300 border border-slate-700/50'
                }`}>
                  <Brain size={12} className="mr-1" />
                  AI: {aiInsights.ai_confidence} ({aiInsights.ai_confidence_score}%)
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white mt-2">
              Suspicious Activity — {alert.user_id}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
              <span className="flex items-center gap-1.5">
                <User size={14} />
                {alert.user_id}
              </span>
              <span className="flex items-center gap-1.5">
                <Building2 size={14} />
                {alert.department}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                {alert.date}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className={`text-4xl font-bold ${
                alert.risk_score >= 80 ? 'text-red-400' : alert.risk_score >= 60 ? 'text-orange-400' : alert.risk_score >= 40 ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {alert.risk_score.toFixed(0)}
              </div>
              <div className="text-xs text-slate-500">Risk Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-400">
                {alert.isolation_forest_score.toFixed(0)}
              </div>
              <div className="text-xs text-slate-500">ML Score</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-slate-300">
                {alert.status || 'Open'}
              </div>
              <div className="text-xs text-slate-500">Status</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {alert.status !== 'Acknowledged' && (
          <button onClick={() => handleAction('Acknowledged')} disabled={updating} className="btn-primary text-xs flex items-center gap-1.5">
            <CheckCircle size={13} /> Acknowledge
          </button>
        )}
        <button onClick={() => handleAction('Investigating')} disabled={updating} className="btn-secondary text-xs flex items-center gap-1.5">
          <Activity size={13} /> Investigate
        </button>
        <button onClick={() => handleAction('Escalated')} disabled={updating} className="btn-secondary text-xs flex items-center gap-1.5">
          <AlertTriangle size={13} /> Escalate
        </button>
        <button onClick={() => handleAction('Resolved')} disabled={updating} className="btn-secondary text-xs flex items-center gap-1.5">
          <CheckCircle size={13} /> Resolve
        </button>
        <button onClick={() => handleAction('False Positive')} disabled={updating} className="btn-secondary text-xs flex items-center gap-1.5">
          <XCircle size={13} /> False Positive
        </button>
        <button onClick={handleCreateCase} disabled={updating || caseCreated} className="btn-secondary text-xs flex items-center gap-1.5">
          <FolderOpen size={13} /> {caseCreated ? 'Case Created' : 'Create Case'}
        </button>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-slate-800 pb-1 overflow-x-auto">
        {[
          { key: 'reasons', label: '🔍 Reasons & Evidence', icon: AlertTriangle },
          { key: 'score', label: '📊 Score Breakdown', icon: Brain },
          { key: 'actions', label: '⚡ Recommended Actions', icon: Zap },
          { key: 'timeline', label: '📈 Risk Timeline', icon: TrendingUp },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setExpandedSection(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
              expandedSection === tab.key
                ? 'bg-slate-800/80 text-slate-200 border border-slate-700 border-b-transparent'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Section: Reasons & Evidence */}
      {expandedSection === 'reasons' && (
        <>
          {/* Evidence panel */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Shield size={16} className="text-indigo-400" />
              Evidence Metrics
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Object.entries(alert.evidence || {}).map(([key, value]) => {
                if (value === null || value === undefined) return null;
                const label = featureLabels[key] || key;
                const isHigh = key === 'external_transfer_mb' && Number(value) > 100;
                const isSensitive = key === 'sensitive_files_accessed' && Number(value) > 5;
                const highlighted = isHigh || isSensitive;
                return (
                  <div
                    key={key}
                    className={`rounded-lg border p-3 ${
                      highlighted ? 'bg-red-900/20 border-red-800/40' : 'bg-slate-800/50 border-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                      <EvidenceIcon label={key} />
                      {label}
                    </div>
                    <div className={`text-lg font-bold ${highlighted ? 'text-red-400' : 'text-slate-200'}`}>
                      {typeof value === 'number' ? value.toLocaleString() : String(value)}
                      {key.includes('mb') || key.includes('_mb') ? ' MB' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reasons */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-400" />
              Why This Alert Was Generated
            </h3>
            {alert.reasons && alert.reasons.length > 0 ? (
              <div className="space-y-3">
                {alert.reasons.map((reason, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-800/30 p-3"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-900/40 text-orange-400 text-xs font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200">{reason.explanation}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                        <span>Feature: <code className="text-slate-400">{reason.feature}</code></span>
                        <span>Z-score: <code className="text-slate-400">{reason.z_score.toFixed(1)}</code></span>
                        <span>Contribution: <code className="text-slate-400">{reason.contribution.toFixed(1)}</code></span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-orange-400">
                        +{reason.contribution.toFixed(0)}
                      </div>
                      <div className="text-[10px] text-slate-500">points</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No detailed explanations available.</p>
            )}
          </div>

          {/* Comments section */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <MessageSquare size={16} className="text-blue-400" />
              Investigation Comments
            </h3>
            <div className="space-y-3 mb-4">
              {(alert as any).comments?.length > 0 ? (
                (alert as any).comments.map((c: AlertComment, idx: number) => (
                  <div key={c.id || idx} className="rounded-lg bg-slate-800/30 border border-slate-800 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-300">{c.author}</span>
                      <span className="text-[10px] text-slate-500">{c.created_at?.slice(0, 16)?.replace('T', ' ')}</span>
                    </div>
                    <p className="text-sm text-slate-300">{c.comment}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No comments yet.</p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="input-field flex-1 text-sm"
                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
              />
              <button onClick={handleAddComment} disabled={submittingComment || !newComment.trim()} className="btn-primary text-sm">
                {submittingComment ? '...' : 'Send'}
              </button>
            </div>
          </div>

          {/* User info */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <User size={16} className="text-indigo-400" />
              User Profile
            </h3>
            {userInfo ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
                    <div className="text-xs text-slate-500">User ID</div>
                    <div className="text-sm font-medium text-slate-200 mt-1">{userInfo.user_id}</div>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
                    <div className="text-xs text-slate-500">Department</div>
                    <div className="text-sm font-medium text-slate-200 mt-1">{userInfo.department}</div>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
                    <div className="text-xs text-slate-500">Baseline</div>
                    <div className={`text-sm font-bold mt-1 ${userInfo.baseline_ready ? 'text-green-400' : 'text-yellow-400'}`}>
                      {userInfo.baseline_ready ? 'Ready' : 'Learning'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
                    <div className="text-xs text-slate-500">Total Alerts</div>
                    <div className="text-sm font-bold mt-1 text-slate-200">{userInfo.alert_count || 0}</div>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
                    <div className="text-xs text-slate-500">Max Risk Score</div>
                    <div className="text-sm font-bold mt-1 text-orange-400">{userInfo.max_risk_score?.toFixed(0) || 0}</div>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
                    <div className="text-xs text-slate-500">Days Observed</div>
                    <div className="text-sm font-bold mt-1 text-slate-200">{userInfo.baseline_days_seen || 0}</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => navigate(`/users/${alert.user_id}`)}
                    className="btn-secondary text-sm flex items-center gap-2"
                  >
                    <ExternalLink size={14} />
                    Full Investigation
                  </button>
                  <button
                    onClick={() => navigate(`/users/${alert.user_id}/baseline`)}
                    className="btn-secondary text-sm flex items-center gap-2"
                  >
                    <Eye size={14} />
                    Baseline Comparison
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">User info not available</p>
            )}
          </div>
        </>
      )}

      {/* Section: Score Breakdown */}
      {expandedSection === 'score' && aiInsights && (
        <div className="space-y-6">
          {/* AI Confidence */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Brain size={16} className="text-purple-400" />
              AI Confidence Assessment
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-4 text-center">
                <div className={`text-3xl font-bold ${
                  aiInsights.ai_confidence === 'High' ? 'text-green-400' :
                  aiInsights.ai_confidence === 'Medium-High' ? 'text-blue-400' :
                  aiInsights.ai_confidence === 'Medium' ? 'text-yellow-400' : 'text-slate-400'
                }`}>
                  {aiInsights.ai_confidence_score}%
                </div>
                <div className="text-xs text-slate-500 mt-1">AI Confidence</div>
              </div>
              <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-4 text-center">
                <div className={`text-3xl font-bold ${aiInsights.attack_profile.is_likely_malicious ? 'text-red-400' : 'text-green-400'}`}>
                  {aiInsights.attack_profile.is_likely_malicious ? '⚠️ Yes' : '✅ No'}
                </div>
                <div className="text-xs text-slate-500 mt-1">Likely Malicious?</div>
              </div>
              <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-4 text-center">
                <div className={`text-3xl font-bold ${aiInsights.attack_profile.requires_immediate_action ? 'text-red-400' : 'text-slate-400'}`}>
                  {aiInsights.attack_profile.requires_immediate_action ? '🚨 Yes' : 'Monitor'}
                </div>
                <div className="text-xs text-slate-500 mt-1">Immediate Action?</div>
              </div>
            </div>

            {/* Risk indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {[
                { label: 'Data Exfiltration Risk', value: aiInsights.attack_profile.data_exfiltration_risk, icon: UploadCloud },
                { label: 'Account Compromise Risk', value: aiInsights.attack_profile.account_compromise_risk, icon: Lock },
                { label: 'Insider Snooping Risk', value: aiInsights.attack_profile.insider_snooping_risk, icon: Eye },
              ].map((risk) => (
                <div key={risk.label} className={`rounded-lg border p-3 flex items-center gap-3 ${
                  risk.value ? 'bg-red-900/20 border-red-800/40' : 'bg-slate-800/30 border-slate-700/30'
                }`}>
                  <risk.icon size={20} className={risk.value ? 'text-red-400' : 'text-slate-600'} />
                  <div>
                    <div className="text-xs text-slate-500">{risk.label}</div>
                    <div className={`text-sm font-bold ${risk.value ? 'text-red-400' : 'text-slate-500'}`}>
                      {risk.value ? 'Detected' : 'Not Detected'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
              <Target size={12} />
              Primary Tactic: <strong className="text-slate-300">{aiInsights.attack_profile.primary_tactic}</strong>
              <span className="text-slate-700">|</span>
              Technique: <strong className="text-slate-300">{aiInsights.attack_profile.technique_used}</strong>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie chart */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-400" />
                Risk Score Composition
              </h3>
              {scoreBreakdownPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={scoreBreakdownPieData}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {scoreBreakdownPieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} stroke="rgba(0,0,0,0.3)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                      formatter={(value: number, name: string) => [`${value.toFixed(1)} pts (${(value / Math.max(alert.risk_score, 1) * 100).toFixed(0)}%)`, name]}
                    />
                    <Legend
                      formatter={(value: string) => <span style={{ color: '#cbd5e1', fontSize: '13px' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-slate-500 text-sm">No data</div>
              )}
            </div>

            {/* Individual contributions */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Activity size={16} className="text-green-400" />
                Individual Rule Contributions
              </h3>
              {aiInsights.score_breakdown.individual_rule_contributions.length > 0 ? (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {aiInsights.score_breakdown.individual_rule_contributions.map((rule, idx) => (
                    <div key={idx} className="rounded-lg bg-slate-800/30 border border-slate-800 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-300">{rule.feature}</span>
                        <span className="text-xs font-bold text-orange-400">+{rule.contribution.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-orange-500"
                            style={{ width: `${Math.min(rule.percentage_of_total, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">{rule.percentage_of_total.toFixed(0)}%</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Z={rule.z_score.toFixed(1)} · W={rule.weight}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-slate-500 text-sm">No rule contributions</div>
              )}
            </div>
          </div>

          {/* Summary bar */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Score Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-indigo-400">{aiInsights.score_breakdown.isolation_forest_contribution.toFixed(1)}</div>
                <div className="text-xs text-slate-500">Isolation Forest ({(aiInsights.score_breakdown.isolation_forest_percent).toFixed(0)}%)</div>
              </div>
              <div>
                <div className="text-lg font-bold text-yellow-400">{aiInsights.score_breakdown.rule_based_contribution.toFixed(1)}</div>
                <div className="text-xs text-slate-500">Rule-Based ({(aiInsights.score_breakdown.rule_based_percent).toFixed(0)}%)</div>
              </div>
              <div>
                <div className="text-lg font-bold text-slate-400">{alert.risk_score.toFixed(1)}</div>
                <div className="text-xs text-slate-500">Total Risk Score</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section: Recommended Actions */}
      {expandedSection === 'actions' && aiInsights && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Zap size={16} className="text-yellow-400" />
            Recommended Actions
          </h3>
          <div className="space-y-3">
            {aiInsights.recommended_actions.length > 0 ? (
              aiInsights.recommended_actions.map((action, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-800/30 p-3 hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-900/40 text-yellow-400 text-xs font-bold">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-200">{action.action}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Triggered by: <code className="text-slate-400">{action.triggered_by}</code></p>
                  </div>
                  <span className="badge bg-slate-800/50 text-slate-400 border border-slate-700/50 text-[10px]">
                    {action.triggered_by !== 'general' ? 'Actionable' : 'General'}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-500 text-sm py-8">
                No specific actions recommended for this alert.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Investigation Summary (if case exists) */}
      {caseSummary && (
        <div className="card p-5 border-green-800/30">
          <h3 className="text-sm font-semibold text-green-300 mb-4 flex items-center gap-2">
            <Shield size={16} className="text-green-400" />
            Investigation Summary — {caseSummary.case_id}
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Details */}
            <div className="space-y-3">
              <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-500">Employee</div>
                    <div className="text-sm font-medium text-slate-200 mt-1">{caseSummary.employee_id}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Attack Type</div>
                    <div className="text-sm font-medium text-orange-300 mt-1">{caseSummary.detected_attack_type}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Risk Score</div>
                    <div className="text-sm font-bold text-red-400 mt-1">{caseSummary.aggregate_risk_score.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Severity</div>
                    <div className="mt-1"><SeverityBadge severity={caseSummary.max_severity as any} /></div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Status</div>
                    <div className="text-sm font-medium text-green-400 mt-1">{caseSummary.case_status}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Assigned To</div>
                    <div className="text-sm font-medium text-slate-200 mt-1">{caseSummary.assigned_to || 'Unassigned'}</div>
                  </div>
                </div>
              </div>
              {caseSummary.resolution && (
                <div className="rounded-lg bg-green-900/20 border border-green-800/30 p-3">
                  <div className="text-xs text-green-400 font-medium mb-1">Resolution</div>
                  <p className="text-sm text-slate-200">{caseSummary.resolution}</p>
                </div>
              )}
            </div>

            {/* Analyst actions */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Analyst Actions</h4>
              {caseSummary.analyst_actions && caseSummary.analyst_actions.length > 0 ? (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {caseSummary.analyst_actions.map((action: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                      <Activity size={12} className="text-indigo-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-slate-400">{action.username}</span>
                        <span className="text-slate-500"> — {action.action}</span>
                        {action.details && <span className="text-slate-600">: {JSON.stringify(action.details)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No actions recorded</p>
              )}

              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-3">AI Explanation</h4>
              {caseSummary.ai_explanation_summary && caseSummary.ai_explanation_summary.length > 0 ? (
                <div className="space-y-1">
                  {caseSummary.ai_explanation_summary.slice(0, 5).map((r: any, idx: number) => (
                    <div key={idx} className="text-xs text-slate-400 flex items-start gap-1.5">
                      <AlertTriangle size={10} className="text-orange-400 mt-0.5 shrink-0" />
                      <span>{r.explanation}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No AI explanations available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section: Risk Timeline */}
      {expandedSection === 'timeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Activity size={16} className="text-indigo-400" />
              Risk Score History (Last 30 Days)
            </h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                  <Line type="monotone" dataKey="score" stroke="#818cf8" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5, fill: '#818cf8' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-slate-500 text-sm">No timeline data available</div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Flag size={16} className="text-indigo-400" />
              Alert Details
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-sm text-slate-400">Alert ID</span>
                <span className="text-sm font-mono text-slate-200">{alert.alert_id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-sm text-slate-400">Detection Method</span>
                <span className="text-sm font-medium text-slate-200">Hybrid (IF + Rule)</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-sm text-slate-400">Baseline Ready</span>
                <span className={`text-sm font-medium ${alert.baseline_ready ? 'text-green-400' : 'text-yellow-400'}`}>
                  {alert.baseline_ready ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-sm text-slate-400">Trigger Count</span>
                <span className="text-sm font-medium text-slate-200">{alert.reasons?.length || 0} indicators</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">MITRE Technique</span>
                <span className="text-sm font-medium text-slate-200">{alert.mitre_technique_name || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
