import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Activity, AlertTriangle, Terminal, Clock,
  User, Building2, ExternalLink, Zap, Crosshair,
} from 'lucide-react';
import { api } from '../api/client';
import SeverityBadge from '../components/SeverityBadge';

interface AttackScenario {
  name: string;
  description: string;
  icon: string;
  mitre_id: string;
  mitre_name: string;
  tactic: string;
}

interface SimulateResult {
  alert_id: string;
  user_id: string;
  department: string;
  risk_score: number;
  severity: string;
  reasons: { feature: string; explanation: string; contribution: number }[];
  mitre_technique_id: string;
  mitre_technique_name: string;
  mitre_tactic: string;
  events_count: number;
  event_samples: any[];
  attack_name: string;
  attack_icon: string;
}

const ATTACK_BUTTONS = [
  {
    key: 'login_attack',
    label: 'Login Attack',
    icon: '🔐',
    color: 'from-orange-500 to-red-600',
    border: 'border-orange-700/50',
    hover: 'hover:border-orange-500',
    description: 'Brute-force login attempts from multiple IPs at unusual hours',
  },
  {
    key: 'usb_attack',
    label: 'USB Exfiltration',
    icon: '💾',
    color: 'from-blue-500 to-purple-600',
    border: 'border-blue-700/50',
    hover: 'hover:border-blue-500',
    description: 'Unknown USB device with large data copy',
  },
  {
    key: 'data_exfiltration',
    label: 'Data Exfiltration',
    icon: '📤',
    color: 'from-red-500 to-pink-600',
    border: 'border-red-700/50',
    hover: 'hover:border-red-500',
    description: 'Large data transfer to external cloud/personal email',
  },
  {
    key: 'sensitive_access',
    label: 'Sensitive Folder Access',
    icon: '📁',
    color: 'from-yellow-500 to-orange-600',
    border: 'border-yellow-700/50',
    hover: 'hover:border-yellow-500',
    description: 'Employee accessing sensitive files outside their normal scope',
  },
  {
    key: 'combined',
    label: '🚨 Combined Attack',
    icon: '🚨',
    color: 'from-red-600 to-purple-700',
    border: 'border-red-600/50',
    hover: 'hover:border-red-500',
    description: 'Multi-vector: off-hours login + sensitive access + USB + exfiltration',
  },
];

export default function AttackSimulator() {
  const [scenarios, setScenarios] = useState<Record<string, AttackScenario>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simLog, setSimLog] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('random');
  const [activeAttack, setActiveAttack] = useState<string | null>(null);
  const [animateResult, setAnimateResult] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/simulate/scenarios')
      .then((res) => res.json())
      .then((data) => setScenarios(data))
      .catch(() => {});
    api.getUsers().then((u) => setUsers(u.map((x: any) => x.user_id))).catch(() => {});
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simLog]);

  const addLog = (msg: string) => {
    setSimLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleAttack = async (attackType: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnimateResult(false);
    setActiveAttack(attackType);

    addLog(`🚀 Initiating ${ATTACK_BUTTONS.find(b => b.key === attackType)?.label || attackType}...`);

    try {
      // Simulate step-by-step progression for visual effect
      await new Promise(r => setTimeout(r, 300));
      addLog('🎯 Selecting target user...');
      
      await new Promise(r => setTimeout(r, 400));
      addLog('⚡ Generating malicious events...');
      
      await new Promise(r => setTimeout(r, 500));
      addLog('🔍 Running detection engine...');

      const response = await fetch(`/api/simulate/attack?attack_type=${attackType}${selectedUser !== 'random' ? `&user_id=${selectedUser}` : ''}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Simulation failed');
      }
      
      const data: SimulateResult = await response.json();
      
      await new Promise(r => setTimeout(r, 300));
      addLog(`✅ Alert generated! ID: ${data.alert_id}`);
      addLog(`📊 Risk Score: ${data.risk_score} — Severity: ${data.severity}`);
      addLog(`🔬 ${data.reasons?.length || 0} indicators triggered`);
      addLog(`📎 MITRE: ${data.mitre_technique_id} — ${data.mitre_technique_name}`);
      
      setResult(data);
      setTimeout(() => setAnimateResult(true), 100);
    } catch (e: any) {
      setError(e.message);
      addLog(`❌ Simulation failed: ${e.message}`);
    } finally {
      setLoading(false);
      setActiveAttack(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold page-header flex items-center gap-3">
            <Crosshair className="text-red-400" size={24} />
            Attack Simulator
          </h2>
          <p className="text-sm page-subtitle mt-1">
            Click an attack button to simulate a real insider threat in real-time. Watch the detection engine respond instantly.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live Detection Active
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Attack buttons */}
        <div className="lg:col-span-2 space-y-4">
          {/* Controls */}
          <div className="card p-4 flex items-center gap-3">
            <User size={16} className="text-slate-500" />
            <span className="text-sm text-slate-400">Target user:</span>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="input-field w-auto text-sm"
            >
              <option value="random">🎲 Random User</option>
              {users.map((uid) => (
                <option key={uid} value={uid}>{uid}</option>
              ))}
            </select>
          </div>

          {/* Attack buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ATTACK_BUTTONS.map((btn) => (
              <button
                key={btn.key}
                onClick={() => handleAttack(btn.key)}
                disabled={loading}
                className={`
                  relative overflow-hidden rounded-xl border p-5 text-left transition-all duration-300
                  bg-gradient-to-br ${btn.color} bg-opacity-10 ${btn.border} ${btn.hover}
                  ${loading && activeAttack === btn.key ? 'animate-pulse scale-[1.02]' : ''}
                  ${loading && activeAttack !== btn.key ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                  group
                `}
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative z-10">
                  <div className="text-3xl mb-2">{btn.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-1">{btn.label}</h3>
                  <p className="text-xs text-white/70">{btn.description}</p>
                  
                  {/* MITRE badge */}
                  {scenarios[btn.key] && (
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/20 text-[10px] text-white/60">
                      <Shield size={10} />
                      {scenarios[btn.key].mitre_id}
                    </div>
                  )}
                </div>

                {/* Animated border on click */}
                {loading && activeAttack === btn.key && (
                  <div className="absolute inset-0 border-2 border-white/30 rounded-xl animate-pulse" />
                )}
              </button>
            ))}
          </div>

          {/* Simulation log */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Terminal size={14} className="text-green-400" />
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Simulation Log</h3>
            </div>
            <div className="h-40 overflow-y-auto space-y-1 font-mono text-xs">
              {simLog.length === 0 ? (
                <p className="text-slate-600 italic">Click an attack button to begin...</p>
              ) : (
                simLog.map((line, i) => (
                  <div key={i} className="text-green-300/80 animate-fadeIn">
                    {line}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* Right: Result panel */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold page-subtitle flex items-center gap-2">
            <Activity size={16} className="text-indigo-400" />
            Detection Result
          </h3>

          {loading && !result && (
            <div className="card p-8 flex flex-col items-center justify-center text-center">
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-indigo-500 animate-spin" />
                <Zap size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-yellow-400" />
              </div>
              <p className="text-sm text-slate-400 font-medium">Attack in progress...</p>
              <p className="text-xs text-slate-500 mt-1">Generating events & running detection</p>
            </div>
          )}

          {error && (
            <div className="card p-5 border-red-800/50">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <AlertTriangle size={16} />
                <span className="text-sm font-semibold">Simulation Error</span>
              </div>
              <p className="text-sm text-slate-400">{error}</p>
            </div>
          )}

          {result && (
            <div className={`card p-5 transition-all duration-500 ${animateResult ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              {/* Alert header */}
              <div className="flex items-center justify-between mb-4">
                <SeverityBadge severity={result.severity} size="lg" />
                <span className="font-mono text-xs text-slate-500">{result.alert_id}</span>
              </div>

              {/* Attack info */}
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">{result.attack_icon}</div>
                <h3 className="text-lg font-bold text-white">{result.attack_name}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {result.user_id} · {result.department}
                </p>
              </div>

              {/* Risk score */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className={`text-4xl font-bold ${
                  result.risk_score >= 80 ? 'text-red-400' :
                  result.risk_score >= 60 ? 'text-orange-400' :
                  result.risk_score >= 40 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {result.risk_score.toFixed(0)}
                </div>
                <div className="text-xs text-slate-500">/ 100</div>
              </div>

              {/* Risk bar */}
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${result.risk_score}%`,
                    backgroundColor:
                      result.risk_score >= 80 ? '#dc2626' :
                      result.risk_score >= 60 ? '#ea580c' :
                      result.risk_score >= 40 ? '#ca8a04' : '#16a34a',
                  }}
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-2 text-center">
                  <div className="text-xs text-slate-500">Events</div>
                  <div className="text-lg font-bold text-slate-200">{result.events_count}</div>
                </div>
                <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-2 text-center">
                  <div className="text-xs text-slate-500">Triggers</div>
                  <div className="text-lg font-bold text-slate-200">{result.reasons?.length || 0}</div>
                </div>
                <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-2 text-center col-span-2">
                  <div className="text-xs text-slate-500">MITRE ATT&CK</div>
                  <div className="text-sm font-bold text-purple-400">
                    {result.mitre_technique_id} — {result.mitre_technique_name}
                  </div>
                  <div className="text-[10px] text-slate-500">{result.mitre_tactic}</div>
                </div>
              </div>

              {/* Top reasons */}
              {result.reasons && result.reasons.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Top Indicators
                  </h4>
                  <div className="space-y-1">
                    {result.reasons.slice(0, 3).map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="text-orange-400 mt-0.5">•</span>
                        <span>{r.explanation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/alerts/${result.alert_id}`)}
                  className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
                >
                  <ExternalLink size={14} />
                  Investigate
                </button>
                <button
                  onClick={() => { setResult(null); setSimLog([]); }}
                  className="btn-secondary text-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {!loading && !result && !error && (
            <div className="card p-8 flex flex-col items-center justify-center text-center h-64">
              <Crosshair size={40} className="text-slate-700 mb-3" />
              <p className="text-sm text-slate-500 font-medium">No attack simulated yet</p>
              <p className="text-xs text-slate-600 mt-1">Click an attack button on the left to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
