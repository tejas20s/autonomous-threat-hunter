import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Calendar, Clock, Plus, FileText, MessageSquare,
  CheckCircle, XCircle, AlertTriangle, Activity, Link, Tag, FolderOpen,
} from 'lucide-react';
import { api } from '../api/client';
import type { CaseDetail as CaseDetailType, CaseEvidenceItem, AlertComment } from '../types';
import SeverityBadge from '../components/SeverityBadge';

const statusColors: Record<string, string> = {
  'Open': 'bg-blue-900/40 text-blue-300 border-blue-800/50',
  'Investigating': 'bg-yellow-900/40 text-yellow-300 border-yellow-800/50',
  'Resolved': 'bg-green-900/40 text-green-300 border-green-800/50',
  'False Positive': 'bg-slate-800/40 text-slate-400 border-slate-700/50',
};

const statusOptions = ['Open', 'Investigating', 'Resolved', 'False Positive'];

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<CaseDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [evidTitle, setEvidTitle] = useState('');
  const [evidDesc, setEvidDesc] = useState('');
  const [evidType, setEvidType] = useState('note');
  const [evidContent, setEvidContent] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.getCase(id).then(setCaseData).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!caseData) return;
    setUpdatingStatus(true);
    try {
      const resolution = newStatus === 'Resolved' || newStatus === 'False Positive'
        ? prompt('Enter resolution notes:') || undefined : undefined;
      await api.updateCaseStatus(caseData.case_id, newStatus, resolution);
      setCaseData({ ...caseData, status: newStatus, resolution: resolution || caseData.resolution });
    } catch (e) {
      console.error(e);
    }
    setUpdatingStatus(false);
  };

  const handleAddComment = async () => {
    if (!caseData || !newComment.trim()) return;
    setSubmittingComment(true);
    try {
      // Comments go on linked alerts or we track them separately
      // For now, add to the first linked alert
      if (caseData.alert_ids && caseData.alert_ids.length > 0) {
        await api.addAlertComment(caseData.alert_ids[0], newComment.trim());
      }
      setNewComment('');
    } catch (e) { console.error(e); }
    setSubmittingComment(false);
  };

  const handleAddEvidence = async () => {
    if (!caseData || !evidTitle.trim()) return;
    try {
      await api.addCaseEvidence(
        caseData.case_id, evidTitle.trim(), evidType,
        evidDesc || undefined,
        evidContent ? { content: evidContent } : undefined
      );
      setEvidTitle('');
      setEvidDesc('');
      setEvidContent('');
      setShowAddEvidence(false);
      // Refresh
      const updated = await api.getCase(caseData.case_id);
      setCaseData(updated);
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Activity size={20} className="animate-spin mr-2" />
        Loading case...
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <FolderOpen size={40} className="mb-3 opacity-30" />
        <p>Case not found</p>
        <button onClick={() => navigate('/cases')} className="btn-primary mt-4 text-sm">Back to Cases</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <button onClick={() => navigate('/cases')} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
        <ArrowLeft size={16} />
        Back to Cases
      </button>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${statusColors[caseData.status] || statusColors['Open']}`}>
                {caseData.status}
              </span>
              <SeverityBadge severity={caseData.severity} />
              <span className="font-mono text-xs text-slate-500">{caseData.case_id}</span>
            </div>
            <h2 className="text-xl font-bold page-header">{caseData.title}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
              <span className="flex items-center gap-1.5"><User size={14} /> {caseData.user_id}</span>
              <span className="flex items-center gap-1.5"><Calendar size={14} /> {caseData.created_at?.slice(0, 10)}</span>
              <span className="flex items-center gap-1.5"><User size={14} /> Created by: {caseData.created_by}</span>
              {caseData.assigned_to && <span className="flex items-center gap-1.5"><Tag size={14} /> Assigned: {caseData.assigned_to}</span>}
            </div>
            {caseData.description && (
              <p className="text-sm text-slate-300 mt-2">{caseData.description}</p>
            )}
          </div>
        </div>

        {/* Status actions */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-800">
          {statusOptions.map(s => (
            <button
              key={s}
              onClick={() => handleStatusUpdate(s)}
              disabled={s === caseData.status || updatingStatus}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                s === caseData.status
                  ? 'bg-indigo-600/20 border-indigo-700/40 text-indigo-300 cursor-default'
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              {s === 'Resolved' ? <CheckCircle size={12} className="inline mr-1" /> :
               s === 'False Positive' ? <XCircle size={12} className="inline mr-1" /> :
               s === 'Investigating' ? <AlertTriangle size={12} className="inline mr-1" /> :
               <Activity size={12} className="inline mr-1" />}
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Linked Alerts */}
      {caseData.alert_ids && caseData.alert_ids.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Link size={15} className="text-indigo-400" />
            Linked Alerts ({caseData.alert_ids.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {caseData.alert_ids.map(aid => (
              <button
                key={aid}
                onClick={() => navigate(`/alerts/${aid}`)}
                className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
              >
                {aid}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Evidence */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <FileText size={15} className="text-green-400" />
            Evidence ({caseData.evidence?.length || 0})
          </h3>
          <button onClick={() => setShowAddEvidence(!showAddEvidence)} className="btn-secondary text-xs flex items-center gap-1.5">
            <Plus size={13} /> Add Evidence
          </button>
        </div>

        {showAddEvidence && (
          <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-3">
            <input value={evidTitle} onChange={e => setEvidTitle(e.target.value)} placeholder="Evidence title..." className="input-field w-full text-sm" />
            <input value={evidDesc} onChange={e => setEvidDesc(e.target.value)} placeholder="Description (optional)..." className="input-field w-full text-sm" />
            <select value={evidType} onChange={e => setEvidType(e.target.value)} className="input-field w-auto text-sm">
              <option value="note">Note</option>
              <option value="screenshot">Screenshot</option>
              <option value="log">Log</option>
              <option value="report">Report</option>
            </select>
            <textarea value={evidContent} onChange={e => setEvidContent(e.target.value)} placeholder="Content (optional)..." rows={2} className="input-field w-full text-sm resize-none" />
            <div className="flex gap-2">
              <button onClick={handleAddEvidence} className="btn-primary text-xs">Save</button>
              <button onClick={() => setShowAddEvidence(false)} className="btn-secondary text-xs">Cancel</button>
            </div>
          </div>
        )}

        {caseData.evidence && caseData.evidence.length > 0 ? (
          <div className="space-y-2">
            {caseData.evidence.map((ev: CaseEvidenceItem) => (
              <div key={ev.id} className="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-200">{ev.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 uppercase">{ev.evidence_type}</span>
                    </div>
                    {ev.description && <p className="text-xs text-slate-400 mt-1">{ev.description}</p>}
                    {ev.content && typeof ev.content === 'object' && ev.content.content && (
                      <p className="text-xs text-slate-500 mt-1 bg-slate-900/50 rounded p-2 font-mono">{String(ev.content.content).slice(0, 200)}</p>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 shrink-0 text-right">
                    <div>{ev.added_by}</div>
                    <div>{ev.created_at?.slice(0, 10)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No evidence added yet.</p>
        )}
      </div>

      {/* Resolution */}
      {caseData.resolution && (
        <div className="card p-5 border-green-800/30">
          <h3 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
            <CheckCircle size={15} />
            Resolution
          </h3>
          <p className="text-sm text-slate-300">{caseData.resolution}</p>
        </div>
      )}
    </div>
  );
}
