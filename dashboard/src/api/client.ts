import type {
  DashboardSummary,
  Alert,
  AlertDetail,
  TimelineDay,
  UserInfo,
  UserFeature,
  DepartmentStats,
  BaselineComparison,
  AiInsights,
  ExecutiveSummary,
  DetectionPerformance,
  UserRiskTrend,
  AuthUser,
  SOCUser,
  InvestigationCase,
  CaseDetail,
  NotificationConfig,
  SystemHealth,
  AuditLogEntry,
  ModelTrainingLog,
} from '../types';

const BASE = '/api';

let _authToken: string | null = localStorage.getItem('soc_token');

export function setAuthToken(token: string | null, refreshToken?: string | null) {
  _authToken = token;
  if (token) {
    localStorage.setItem('soc_token', token);
    if (refreshToken) {
      localStorage.setItem('soc_refresh_token', refreshToken);
    }
  } else {
    localStorage.removeItem('soc_token');
    localStorage.removeItem('soc_refresh_token');
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem('soc_token');
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem('soc_refresh_token');
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const makeRequest = (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers: { ...headers, ...(options?.headers as Record<string, string>) } });
  };

  let res = await makeRequest(_authToken);

  if (res.status === 401 && _authToken) {
    // Try to refresh the token
    const refreshToken = localStorage.getItem('soc_refresh_token');
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setAuthToken(data.token);
          // Retry original request with new token
          res = await makeRequest(data.token);
        } else {
          throw new Error('Refresh failed');
        }
      } catch {
        // Refresh failed — clear and redirect
        setAuthToken(null);
        localStorage.removeItem('soc_refresh_token');
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    } else {
      setAuthToken(null);
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

async function fetchText(url: string, options?: RequestInit): Promise<string> {
  const headers: Record<string, string> = {};
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }
  const res = await fetch(url, { ...options, headers: { ...headers, ...options?.headers } });
  if (res.status === 401) {
    setAuthToken(null);
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res.text();
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────
  login: (username: string, password: string) =>
    fetchJSON<AuthUser>(`${BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  register: (username: string, email: string, password: string, full_name?: string) =>
    fetchJSON<{ status: string; message: string; email: string; expires_in_minutes: number }>(`${BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({ username, email, password, full_name }),
    }),

  verifyOtp: (email: string, otp: string) =>
    fetchJSON<{ username: string; email: string; role: string; full_name: string | null }>(`${BASE}/auth/verify-otp`, {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),

  resendOtp: (email: string) =>
    fetchJSON<{ status: string; message: string }>(`${BASE}/auth/resend-otp`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  getMe: () => fetchJSON<{ username: string; role: string; full_name: string | null }>(`${BASE}/auth/me`),

  refreshToken: (refresh_token: string) =>
    fetchJSON<{ token: string; username: string; role: string }>(`${BASE}/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refresh_token }),
    }),

  logout: () =>
    fetchJSON<{ status: string; message: string }>(`${BASE}/auth/logout`, { method: 'POST' }),

  // ── Dashboard ─────────────────────────────────────────────────────────
  getSummary: () => fetchJSON<DashboardSummary>(`${BASE}/dashboard/summary`),

  // ── Alerts ────────────────────────────────────────────────────────────
  getAlerts: (params?: {
    severity?: string;
    user_id?: string;
    min_score?: number;
    search?: string;
    department?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Alert[]> => {
    const q = new URLSearchParams();
    if (params?.severity) q.set('severity', params.severity);
    if (params?.user_id) q.set('user_id', params.user_id);
    if (params?.min_score) q.set('min_score', String(params.min_score));
    if (params?.search) q.set('search', params.search);
    if (params?.department) q.set('department', params.department);
    if (params?.status) q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return fetchJSON(`${BASE}/alerts?${q.toString()}`);
  },

  getAlert: (id: string): Promise<AlertDetail> =>
    fetchJSON(`${BASE}/alerts/${id}`),

  updateAlertStatus: (alertId: string, status: string, assignedTo?: string, resolutionNotes?: string) => {
    let url = `${BASE}/alerts/${alertId}/status?status=${encodeURIComponent(status)}`;
    if (assignedTo) url += `&assigned_to=${encodeURIComponent(assignedTo)}`;
    if (resolutionNotes) url += `&resolution_notes=${encodeURIComponent(resolutionNotes)}`;
    return fetchJSON<{ status: string }>(url, { method: 'PATCH' });
  },

  addAlertComment: (alertId: string, comment: string) =>
    fetchJSON<{ status: string; comment_id?: number }>(
      `${BASE}/alerts/${alertId}/comments?comment=${encodeURIComponent(comment)}`,
      { method: 'POST' }
    ),

  // ── Users ─────────────────────────────────────────────────────────────
  getUsers: (department?: string): Promise<{ user_id: string; department: string; full_name?: string; email?: string }[]> => {
    const q = department ? `?department=${department}` : '';
    return fetchJSON(`${BASE}/users${q}`);
  },

  getUser: (id: string): Promise<UserInfo> =>
    fetchJSON(`${BASE}/users/${id}`),

  getUserTimeline: (id: string): Promise<TimelineDay[]> =>
    fetchJSON(`${BASE}/users/${id}/timeline`),

  getUserFeatures: (id: string): Promise<UserFeature[]> =>
    fetchJSON(`${BASE}/users/${id}/features`),

  // ── Departments ───────────────────────────────────────────────────────
  getDepartments: (): Promise<string[]> =>
    fetchJSON(`${BASE}/departments`),

  getDepartmentStats: (dept: string): Promise<DepartmentStats> =>
    fetchJSON(`${BASE}/departments/${dept}/stats`),

  // ── Baseline Comparison ───────────────────────────────────────────────
  getBaselineComparison: (userId: string): Promise<BaselineComparison> =>
    fetchJSON(`${BASE}/users/${userId}/baseline-comparison`),

  // ── AI Insights ───────────────────────────────────────────────────────
  getAiInsights: (alertId: string): Promise<AiInsights> =>
    fetchJSON(`${BASE}/alerts/${alertId}/ai-insights`),

  // ── User Risk Trend ───────────────────────────────────────────────────
  getUserRiskTrend: (userId: string, weeks?: number): Promise<UserRiskTrend[]> =>
    fetchJSON(`${BASE}/users/${userId}/risk-trend?weeks=${weeks || 12}`),

  // ── Executive Dashboard ───────────────────────────────────────────────
  getExecutiveSummary: (): Promise<ExecutiveSummary> =>
    fetchJSON(`${BASE}/executive/summary`),

  // ── Detection Performance ─────────────────────────────────────────────
  getDetectionPerformance: (): Promise<DetectionPerformance> =>
    fetchJSON(`${BASE}/analytics/detection-performance`),

  // ── Case Management ───────────────────────────────────────────────────
  getCases: (params?: { status?: string; user_id?: string; limit?: number }): Promise<InvestigationCase[]> => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.user_id) q.set('user_id', params.user_id);
    if (params?.limit) q.set('limit', String(params.limit));
    return fetchJSON(`${BASE}/cases?${q.toString()}`);
  },

  getCase: (caseId: string): Promise<CaseDetail> =>
    fetchJSON(`${BASE}/cases/${caseId}`),

  createCase: (title: string, user_id: string, alert_ids: string[], description?: string, severity?: string, assigned_to?: string) => {
    const q = new URLSearchParams();
    q.set('title', title);
    q.set('user_id', user_id);
    alert_ids.forEach(id => q.append('alert_ids', id));
    if (description) q.set('description', description);
    if (severity) q.set('severity', severity);
    if (assigned_to) q.set('assigned_to', assigned_to);
    return fetchJSON<InvestigationCase>(`${BASE}/cases?${q.toString()}`, { method: 'POST' });
  },

  updateCaseStatus: (caseId: string, status: string, resolution?: string) => {
    let url = `${BASE}/cases/${caseId}/status?status=${encodeURIComponent(status)}`;
    if (resolution) url += `&resolution=${encodeURIComponent(resolution)}`;
    return fetchJSON<{ status: string }>(url, { method: 'PATCH' });
  },

  addCaseEvidence: (caseId: string, title: string, evidence_type: string, description?: string, content?: Record<string, any>) => {
    const q = new URLSearchParams();
    q.set('title', title);
    q.set('evidence_type', evidence_type);
    if (description) q.set('description', description);
    if (content) q.set('content', JSON.stringify(content));
    return fetchJSON<{ status: string }>(`${BASE}/cases/${caseId}/evidence?${q.toString()}`, { method: 'POST' });
  },

  getCaseSummary: (caseId: string): Promise<any> =>
    fetchJSON(`${BASE}/cases/${caseId}/summary`),

  // ── Admin: SOC Users ──────────────────────────────────────────────────
  listSOCUsers: (): Promise<SOCUser[]> =>
    fetchJSON(`${BASE}/auth/users`),

  createSOCUser: (username: string, email: string, password: string, role: string, full_name?: string) =>
    fetchJSON<{ username: string; email: string; role: string }>(`${BASE}/auth/users`, {
      method: 'POST',
      body: JSON.stringify({ username, email, password, role, full_name }),
    }),

  // ── Admin: Notifications ──────────────────────────────────────────────
  getNotificationConfigs: (): Promise<NotificationConfig[]> =>
    fetchJSON(`${BASE}/notifications/config`),

  createNotificationConfig: (channel: string, min_severity: string, config_json?: Record<string, any>) => {
    const q = new URLSearchParams();
    q.set('channel', channel);
    q.set('min_severity', min_severity);
    if (config_json) q.set('config_json', JSON.stringify(config_json));
    return fetchJSON<{ status: string; id: number }>(`${BASE}/notifications/config?${q.toString()}`, { method: 'POST' });
  },

  // ── Admin: Audit Logs ─────────────────────────────────────────────────
  getAuditLogs: (limit?: number, username?: string, action?: string): Promise<AuditLogEntry[]> => {
    const q = new URLSearchParams();
    if (limit) q.set('limit', String(limit));
    if (username) q.set('username', username);
    if (action) q.set('action', action);
    return fetchJSON(`${BASE}/audit-logs?${q.toString()}`);
  },

  // ── Admin: Retraining ─────────────────────────────────────────────────
  triggerRetrain: () =>
    fetchJSON<{ status: string }>(`${BASE}/retrain`, { method: 'POST' }),

  getRetrainHistory: (): Promise<ModelTrainingLog[]> =>
    fetchJSON(`${BASE}/retrain/history`),

  // ── System Health ─────────────────────────────────────────────────────
  getSystemHealth: (): Promise<SystemHealth> =>
    fetchJSON(`${BASE}/system/health`),

  // ── Health ────────────────────────────────────────────────────────────
  getHealth: () => fetchJSON<{ status: string; version: string }>(`${BASE}/health`),
};
