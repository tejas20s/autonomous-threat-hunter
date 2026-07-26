export interface AlertReason {
  feature: string;
  z_score: number;
  weight: number;
  contribution: number;
  explanation: string;
}

export interface AlertEvidence {
  avg_login_hour: number | null;
  earliest_login_hour: number | null;
  failed_logins: number;
  files_accessed: number;
  sensitive_files_accessed: number;
  files_downloaded: number;
  usb_events: number;
  usb_first_time: number;
  usb_data_mb: number;
  transfer_mb: number;
  external_transfer_mb: number;
}

export interface Alert {
  alert_id: string;
  user_id: string;
  department: string;
  date: string;
  risk_score: number;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  isolation_forest_score: number;
  baseline_ready: boolean;
  reasons: AlertReason[];
  evidence: AlertEvidence;
  acknowledged?: boolean;
  mitre_technique_id?: string;
  mitre_technique_name?: string;
  mitre_tactic?: string;
  status?: string;
  assigned_to?: string | null;
  resolution_notes?: string | null;
  created_at?: string;
  resolved_at?: string | null;
}

export interface TimelineDay {
  date: string;
  risk_score: number;
  severity: string;
  files_accessed: number;
  sensitive_files_accessed: number;
  usb_events: number;
  transfer_mb: number;
  after_hours_login: number;
}

export interface UserFeature {
  date: string;
  avg_login_hour: number | null;
  after_hours_login: number;
  failed_logins: number;
  files_accessed: number;
  sensitive_files_accessed: number;
  files_downloaded: number;
  usb_events: number;
  usb_first_time: number;
  usb_data_mb: number;
  transfer_mb: number;
  external_transfer_mb: number;
  risk_score: number;
  severity: string;
}

export interface DashboardSummary {
  total_user_days_analyzed: number;
  total_alerts: number;
  severity_counts: Record<string, number>;
  users_monitored: number;
  days_covered: number;
  max_risk_score?: number;
  injected_scenarios?: number;
  injected_scenarios_caught_high_or_critical?: number;
}

export interface UserInfo {
  user_id: string;
  department: string;
  sensitive_access_normal?: boolean;
  known_usb_devices?: string[];
  baseline_ready?: boolean;
  baseline_days_seen?: number;
  alert_count?: number;
  max_risk_score?: number;
}

export interface BaselineComparison {
  user_id: string;
  baseline_ready: boolean;
  baseline_days_seen: number;
  latest_date: string;
  comparisons: BaselineComparisonItem[];
  total_features: number;
  deviations_found: number;
  overall_status: string;
}

export interface BaselineComparisonItem {
  feature: string;
  label: string;
  icon: string;
  normal_mean: number;
  normal_std: number;
  normal_max: number;
  today_value: number | null;
  today_display: string;
  normal_display: string;
  z_score: number;
  is_abnormal: boolean;
  deviation_direction: string;
  severity: string;
}

export interface AiInsights {
  alert_id: string;
  ai_confidence: string;
  ai_confidence_score: number;
  score_breakdown: {
    isolation_forest_contribution: number;
    isolation_forest_percent: number;
    rule_based_contribution: number;
    rule_based_percent: number;
    unquantified_contribution: number;
    individual_rule_contributions: {
      feature: string;
      weight: number;
      z_score: number;
      contribution: number;
      explanation: string;
      percentage_of_total: number;
    }[];
  };
  recommended_actions: { triggered_by: string; action: string }[];
  attack_profile: {
    primary_tactic: string;
    technique_used: string;
    is_likely_malicious: boolean;
    requires_immediate_action: boolean;
    data_exfiltration_risk: boolean;
    account_compromise_risk: boolean;
    insider_snooping_risk: boolean;
  };
}

export interface ExecutiveSummary {
  total_employees: number;
  active_alerts: number;
  avg_organizational_risk: number;
  open_investigations: number;
  total_alerts_all: number;
  severity_counts: Record<string, number>;
  departments: {
    department: string;
    avg_risk_score: number;
    total_days: number;
    alert_days: number;
    alert_rate: number;
    max_risk_score: number;
  }[];
  top_risky_employees: {
    user_id: string;
    avg_risk_score: number;
    max_risk_score: number;
    active_days: number;
    alert_days: number;
  }[];
}

export interface DetectionPerformance {
  total_injected_scenarios: number;
  scenarios_caught_at_high_critical: number;
  scenarios_missed: number;
  total_high_critical_alerts: number;
  false_positives: number;
  true_positives: number;
  false_negatives: number;
  true_negatives_excluding_low: number;
  precision: number;
  recall: number;
  f1_score: number;
  false_positive_rate: number;
  detection_latency_avg_hours: number;
  missed_scenarios: { user_id: string; date: string; scenario: string }[];
  confusion_matrix: {
    true_positives: number;
    false_positives: number;
    false_negatives: number;
    true_negatives_approx: number;
  };
}

export interface UserRiskTrend {
  week: string;
  avg_risk_score: number;
  max_risk_score: number;
  min_risk_score: number;
  days_in_week: number;
  trend_direction: 'up' | 'down' | 'stable';
}

export interface InvestigationSummary {
  case_id: string;
  title: string;
  employee_id: string;
  detected_attack_type: string;
  evidence: any[];
  linked_alerts: any[];
  aggregate_risk_score: number;
  max_severity: string;
  ai_explanation_summary: { feature: string; explanation: string; contribution: number }[];
  analyst_actions: { timestamp: string; username: string; action: string; details?: any }[];
  resolution: string;
  case_status: string;
  created_by: string;
  assigned_to: string | null;
  opened_at: string;
  closed_at: string | null;
}

export interface DepartmentStats {
  department: string;
  user_count: number;
  alert_severity_counts: Record<string, number>;
  avg_risk_score: number;
  total_alerts: number;
}

// ── Auth ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  token: string;
  username: string;
  role: 'Admin' | 'Analyst' | 'Viewer';
  full_name: string | null;
}

export interface SOCUser {
  username: string;
  email: string;
  role: string;
  full_name: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

// ── Cases ─────────────────────────────────────────────────────────────────

export interface InvestigationCase {
  case_id: string;
  title: string;
  description: string | null;
  user_id: string;
  alert_ids: string[];
  status: string;
  severity: string;
  assigned_to: string | null;
  created_by: string;
  evidence_count?: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  resolution: string | null;
}

export interface CaseEvidenceItem {
  id: number;
  title: string;
  description: string | null;
  evidence_type: string;
  content: any;
  added_by: string;
  created_at: string;
}

export interface CaseDetail {
  case_id: string;
  title: string;
  description: string | null;
  user_id: string;
  alert_ids: string[];
  status: string;
  severity: string;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  resolution: string | null;
  evidence: CaseEvidenceItem[];
}

// ── Notifications ─────────────────────────────────────────────────────────

export interface NotificationConfig {
  id: number;
  channel: string;
  enabled: boolean;
  min_severity: string;
  config: Record<string, any>;
}

export interface NotificationLog {
  id: number;
  channel: string;
  alert_id: string | null;
  recipient: string | null;
  subject: string | null;
  sent_at: string;
  status: string;
  error_message: string | null;
}

// ── System Health ─────────────────────────────────────────────────────────

export interface SystemHealth {
  status: string;
  version: string;
  database: string;
  mode: string;
  uptime: string;
  model: {
    status: string;
    last_trained: string | null;
    version: number | null;
    users_trained: number | null;
  };
  events: {
    total_events: number;
    total_alerts: number;
    total_users: number;
  };
  retrain_history: {
    version: number;
    trained_at: string;
    users_trained: number;
    total_samples: number;
    status: string;
  }[];
}

// ── Audit Log ─────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  username: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: any;
  ip_address: string | null;
}

export interface ModelTrainingLog {
  version: number;
  trained_at: string;
  users_trained: number | null;
  total_samples: number | null;
  contamination: number;
  triggered_by: string;
  status: string;
}

export interface AlertComment {
  id: number;
  author: string;
  comment: string;
  created_at: string;
}

export interface AlertDetail extends Alert {
  status: string;
  assigned_to: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  resolution_notes: string | null;
  comments: AlertComment[];
  timeline_events: any[];
  created_at: string;
  resolved_at: string | null;
}
