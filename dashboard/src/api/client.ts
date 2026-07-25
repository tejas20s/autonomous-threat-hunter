import type {
  DashboardSummary,
  Alert,
  TimelineDay,
  UserInfo,
  UserFeature,
  DepartmentStats,
  BaselineComparison,
  AiInsights,
  ExecutiveSummary,
  DetectionPerformance,
  UserRiskTrend,
} from '../types';

const BASE = '/api';

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  // Dashboard
  getSummary: () => fetchJSON<DashboardSummary>(`${BASE}/dashboard/summary`),

  // Alerts
  getAlerts: (params?: {
    severity?: string;
    user_id?: string;
    min_score?: number;
    search?: string;
    department?: string;
    limit?: number;
    offset?: number;
  }): Promise<Alert[]> => {
    const q = new URLSearchParams();
    if (params?.severity) q.set('severity', params.severity);
    if (params?.user_id) q.set('user_id', params.user_id);
    if (params?.min_score) q.set('min_score', String(params.min_score));
    if (params?.search) q.set('search', params.search);
    if (params?.department) q.set('department', params.department);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return fetchJSON(`${BASE}/alerts?${q.toString()}`);
  },

  getAlert: (id: string): Promise<Alert> =>
    fetchJSON(`${BASE}/alerts/${id}`),

  acknowledgeAlert: (id: string, by?: string): Promise<{ status: string }> =>
    fetch(`${BASE}/alerts/${id}/acknowledge`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledged_by: by || 'analyst' }),
    }).then((r) => r.json()),

  // Users
  getUsers: (department?: string): Promise<{ user_id: string; department: string }[]> => {
    const q = department ? `?department=${department}` : '';
    return fetchJSON(`${BASE}/users${q}`);
  },

  getUser: (id: string): Promise<UserInfo> =>
    fetchJSON(`${BASE}/users/${id}`),

  getUserTimeline: (id: string): Promise<TimelineDay[]> =>
    fetchJSON(`${BASE}/users/${id}/timeline`),

  getUserFeatures: (id: string): Promise<UserFeature[]> =>
    fetchJSON(`${BASE}/users/${id}/features`),

  // Departments
  getDepartments: (): Promise<string[]> =>
    fetchJSON(`${BASE}/departments`),

  getDepartmentStats: (dept: string): Promise<DepartmentStats> =>
    fetchJSON(`${BASE}/departments/${dept}/stats`),

  // Behavioral Baseline Comparison
  getBaselineComparison: (userId: string): Promise<BaselineComparison> =>
    fetchJSON(`${BASE}/users/${userId}/baseline-comparison`),

  // AI Insights for Alert
  getAiInsights: (alertId: string): Promise<AiInsights> =>
    fetchJSON(`${BASE}/alerts/${alertId}/ai-insights`),

  // User Risk Trend (weekly)
  getUserRiskTrend: (userId: string, weeks?: number): Promise<UserRiskTrend[]> =>
    fetchJSON(`${BASE}/users/${userId}/risk-trend?weeks=${weeks || 12}`),

  // Executive Dashboard
  getExecutiveSummary: (): Promise<ExecutiveSummary> =>
    fetchJSON(`${BASE}/executive/summary`),

  // Detection Performance
  getDetectionPerformance: (): Promise<DetectionPerformance> =>
    fetchJSON(`${BASE}/analytics/detection-performance`),

  // Cases
  getCases: (params?: { status?: string; user_id?: string; limit?: number }): Promise<any[]> => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.user_id) q.set('user_id', params.user_id);
    if (params?.limit) q.set('limit', String(params.limit));
    return fetchJSON(`${BASE}/cases?${q.toString()}`);
  },

  getCase: (caseId: string): Promise<any> =>
    fetchJSON(`${BASE}/cases/${caseId}`),

  getCaseSummary: (caseId: string): Promise<any> =>
    fetchJSON(`${BASE}/cases/${caseId}/summary`),
};

