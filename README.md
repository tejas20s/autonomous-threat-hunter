# Autonomous Threat Hunter for Insider Attacks

A SOC (Security Operations Center) insider threat detection platform with AI-powered anomaly detection, real-time monitoring, behavioral baseline comparison, case management, an executive dashboard, and full investigation workflows.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Key Differentiators](#key-differentiators)
- [Detection Engine](#detection-engine)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Access Points](#access-points)
- [API Reference](#api-reference)
- [Dashboard Pages](#dashboard-pages)
- [Configuration](#configuration)
- [Default Admin Account](#default-admin-account)
- [Behavioral Baseline Comparison](#behavioral-baseline-comparison)
- [AI Insights & Score Breakdown](#ai-insights--score-breakdown)
- [Weekly Risk Trend](#weekly-risk-trend)
- [Executive Dashboard](#executive-dashboard)
- [Detection Performance](#detection-performance)
- [Investigation Summary](#investigation-summary)
- [Attack Simulator](#attack-simulator)
- [RBAC Roles](#rbac-roles)
- [Running Tests](#running-tests)
- [Future Improvements](#future-improvements)
- [License](#license)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.13, FastAPI, SQLAlchemy (async), Uvicorn |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Database | SQLite (development) / PostgreSQL (production) |
| ML / AI | scikit-learn (Isolation Forest), NumPy, Pandas |
| Auth | JWT (PyJWT), bcrypt password hashing |
| Real-time | Server-Sent Events (SSE) |
| Infrastructure | Docker, Docker Compose, Nginx |
| Testing | Pytest, pytest-asyncio, HTTPX |

---

## Key Differentiators

- **Interactive Attack Simulator** — trigger a simulated insider threat and watch detection happen in real time
- **Behavioral Baseline Comparison** — compares an employee's behavior today against their individual normal
- **AI Confidence Scoring** — every alert gets a confidence rating (High/Medium/Low) with a full risk-score breakdown
- **Recommended Actions** — context-aware remediation steps mapped to each triggered feature
- **Executive Dashboard** — org-wide view of department risk, top risky employees, and severity trends
- **Detection Performance Metrics** — precision, recall, F1-score, and false-positive rate computed against ground truth
- **Investigation Summary** — complete case report with evidence, AI explanations, and analyst actions
- **Weekly Risk Trend** — tracks how an employee's risk evolves week over week
- **Per-user behavioral baseline** with a low false-positive design (four explicit control layers)
- **Full investigation workflow**: Open → Acknowledged → Investigating → Resolved / False Positive
- **MITRE ATT&CK mapping** on every alert
- **JWT auth with OTP email verification** on registration
- **RBAC** (Admin, Analyst, Viewer), audit logging, and CSV report export
- **Docker Compose deployment**, 29 automated tests

---

## Detection Engine

### Two-Signal Blend

| Component | Weight | What It Catches |
|---|---|---|
| Isolation Forest (ML) | 40% | Weird combinations of features — statistical oddities |
| Rule-based deviation | 60% | Concrete violations: first-time USB, after-hours login, exfiltration |

**Blend:** `risk_score = 0.4 × IF_percentile + 0.6 × rule_score`

### AI Confidence Classification

| Confidence | Criteria | Meaning |
|---|---|---|
| High (92%) | IF ≥ 70 + 3+ strong rules (z ≥ 2.5) | Multiple independent signals strongly agree |
| Medium-High (78%) | IF ≥ 60 + 1+ strong rule | Strong agreement with evidence |
| Medium (60%) | IF ≥ 40 or 2+ moderate rules | Some signals present |
| Low (35%) | Few or weak signals | Low confidence — may need review |

### Severity Bands

| Score | Severity | Action |
|---|---|---|
| ≥ 80 | Critical | Immediate investigation |
| 60–79 | High | Escalate |
| 40–59 | Medium | Review |
| < 40 | Low | Logged only |

### False-Positive Controls

1. **Baseline min days** — new users capped at 35 max
2. **Z-score + absolute delta** — both statistical and operational thresholds must agree
3. **No-explanation cap** — every Medium+ alert must be explainable
4. **Std floor** — prevents runaway z-scores on low-variance features

### Score Breakdown

The AI Insights endpoint decomposes every alert into its constituent signals:

```
Total Risk Score = IF Contribution (40%) + Rule Contribution (60%) + Unquantified
```

Each triggered rule shows: **Feature → Z-score → Weight → Contribution → % of Total**

---

## Architecture

```mermaid
flowchart LR
    subgraph Pipeline
        A["Log Simulator<br/>generator.py"] --> B["Feature Extractor<br/>features.py"]
        B --> C["Behavioral Baseline<br/>baseline.py"]
        B --> D["Isolation Forest<br/>model.py"]
        C --> E["Risk Scorer<br/>model.py"]
        D --> E
    end
    E --> F[("Database<br/>SQLite / PostgreSQL")]
    F --> G["FastAPI Backend<br/>SOC API v3.0"]
    G --> H["React Dashboard<br/>SOC Portal"]
    G --> I[("SSE Real-time<br/>Stream")]
    K["Attack Simulator<br/>attack_simulator.py"] --> G
    G --> J[("CSV Reports")]
    G --> L["AI Insights<br/>ai-insights endpoint"]
    G --> M["Detection Metrics<br/>detection-performance"]
    H --> N["/users/:id/baseline<br/>Baseline Comparison"]
    H --> O["/executive<br/>Executive Dashboard"]
    H --> P["/performance<br/>Detection Performance"]
```

```
threat/
├── backend/
│   ├── Dockerfile                # FastAPI container
│   ├── Dockerfile.pipeline       # Pipeline runner container
│   ├── requirements.txt          # Python dependencies
│   ├── .env                      # Config (gitignored — create manually)
│   ├── app/
│   │   ├── main.py               # FastAPI SOC API
│   │   ├── database.py           # Database connection (PostgreSQL/SQLite)
│   │   ├── models.py             # ORM models
│   │   ├── generator.py          # Log simulation engine
│   │   ├── features.py           # Feature extraction
│   │   ├── baseline.py           # Per-user behavioral baseline
│   │   ├── model.py              # Isolation Forest + rule detection
│   │   ├── run_pipeline.py       # Pipeline orchestrator
│   │   ├── auth.py               # RBAC (JWT, Admin/Analyst/Viewer)
│   │   ├── websocket_manager.py  # Real-time SSE streaming
│   │   ├── case_manager.py       # Investigation case management
│   │   ├── mitre_attack.py       # MITRE ATT&CK technique mapping
│   │   ├── notifications.py      # Email/Slack/Teams alerts
│   │   ├── threat_intel.py       # IP reputation & GeoIP enrichment
│   │   ├── analytics.py          # Advanced analytics + performance metrics
│   │   ├── retrain.py            # Model retraining & scheduling
│   │   ├── report_generator.py   # CSV export reports
│   │   ├── attack_simulator.py   # Real-time attack simulation engine
│   │   └── data/                 # Generated data files (JSON, CSV)
│   ├── data/                     # SQLite database storage (threat.db)
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_detection.py     # Unit tests for detection pipeline
│   │   └── test_api.py           # API integration tests
│   └── output/                   # JSON output files (alerts, timelines, summary)
├── dashboard/
│   ├── Dockerfile                # Nginx container for built dashboard
│   ├── nginx.conf                # Nginx config (SPA routing + API proxy)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── postcss.config.js
│   └── src/
│       ├── main.tsx
│       ├── index.css
│       ├── types.ts
│       ├── App.tsx               # Route definitions
│       ├── contexts/
│       │   └── AuthContext.tsx   # JWT auth state management
│       ├── pages/                # Route pages
│       │   ├── Login.tsx
│       │   ├── Register.tsx
│       │   ├── Dashboard.tsx
│       │   ├── Alerts.tsx
│       │   ├── AlertDetail.tsx
│       │   ├── Users.tsx
│       │   ├── UserDetail.tsx
│       │   ├── BehaviorBaselineComparison.tsx
│       │   ├── Cases.tsx
│       │   ├── CaseDetail.tsx
│       │   ├── Departments.tsx
│       │   ├── AttackSimulator.tsx
│       │   ├── ExecutiveDashboard.tsx
│       │   ├── DetectionPerformance.tsx
│       │   ├── Admin.tsx
│       │   ├── NotificationSettings.tsx
│       │   └── SystemHealth.tsx
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── FilterBar.tsx
│       │   ├── SeverityBadge.tsx
│       │   └── StatsCard.tsx
│       └── api/client.ts
├── .gitignore
├── docker-compose.yml
└── README.md
```

---

## Requirements

| Software | Version | Purpose |
|----------|---------|---------|
| Python | ≥ 3.10, recommended 3.13 | Backend API + ML pipeline |
| Node.js | ≥ 18 | Dashboard development server |
| npm | ≥ 9 | Package manager for dashboard |
| Docker | ≥ 24 (optional) | Containerized deployment |
| Docker Compose | ≥ 2.24 (optional) | Multi-container orchestration |
| Git | Any recent version | Version control |

---

## Quick Start

### Option 1: Docker (recommended)

```bash
docker compose up --build
```

This starts:
- PostgreSQL database on port 5432
- Pipeline (generates data, then exits)
- Backend API on port 8000
- Dashboard on port 80

### Option 2: Local Development

```bash
# 1. Backend — install dependencies
cd backend
pip install -r requirements.txt

# 2. Create your .env file (see Configuration below)

# 3. Run the data pipeline (generates simulated logs + trains models)
python app/run_pipeline.py

# 4. Start the API server
uvicorn app.main:app --reload --port 8000

# 5. Dashboard (separate terminal)
cd dashboard
npm install
npm run dev
```

---

## Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Dashboard (dev) | `http://localhost:5173` | React frontend (dev server) |
| Dashboard (prod) | `http://localhost:80` | Nginx production build (Docker) |
| Backend API | `http://localhost:8000` | FastAPI REST API |
| Swagger Docs | `http://localhost:8000/docs` | Interactive API documentation |
| ReDoc | `http://localhost:8000/redoc` | Alternative API docs |

---

## API Reference

### Core Detection
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard/summary` | Aggregate stats & severity counts |
| GET | `/api/alerts` | Filterable alert queue |
| GET | `/api/alerts/{id}` | Alert detail with comments & timeline |
| PATCH | `/api/alerts/{id}/status` | Update alert status (investigation workflow) |
| POST | `/api/alerts/{id}/comments` | Add investigation comment |
| GET | `/api/users` | List monitored users |
| GET | `/api/users/{id}` | User profile with baseline info |
| GET | `/api/users/{id}/timeline` | Daily risk scores |
| GET | `/api/users/{id}/features` | Detailed feature values |
| GET | `/api/users/{id}/profile` | Behavior profile summary |
| GET | `/api/departments` | List departments |
| GET | `/api/departments/{dept}/stats` | Department stats |

### Behavioral Analysis
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users/{id}/baseline-comparison` | Compare today's behavior vs. normal baseline |
| GET | `/api/users/{id}/risk-trend` | Weekly risk trend over 12 weeks |
| GET | `/api/alerts/{id}/ai-insights` | AI confidence, score breakdown, recommended actions |

### Executive & Performance
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/executive/summary` | Executive dashboard (org-wide stats) |
| GET | `/api/analytics/detection-performance` | Precision, recall, F1, FP rate from ground truth |

### Real-Time Monitoring
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/events/stream` | SSE stream for live alerts |

### Case Management
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/cases` | Create investigation case |
| GET | `/api/cases` | List cases |
| GET | `/api/cases/{id}` | Case detail with evidence |
| GET | `/api/cases/{id}/summary` | Investigation summary report |
| PATCH | `/api/cases/{id}/status` | Update case status |
| POST | `/api/cases/{id}/evidence` | Add evidence to case |

### Attack Simulator
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/simulate/scenarios` | List available attack scenarios |
| POST | `/api/simulate/attack` | Trigger a live simulated attack |

### Authentication & RBAC
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login (returns JWT token) |
| POST | `/api/auth/register` | Step 1: register — sends OTP to email (no account created yet) |
| POST | `/api/auth/verify-otp` | Step 2: verify OTP — creates account on success |
| POST | `/api/auth/resend-otp` | Resend OTP for pending registration |
| POST | `/api/auth/refresh` | Refresh expired JWT token |
| POST | `/api/auth/logout` | Logout (revokes token) |
| GET | `/api/auth/me` | Current user info (token required) |
| POST | `/api/auth/users` | Create user (Admin only) |
| GET | `/api/auth/users` | List all SOC users (Admin only) |

### Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/analytics/login-heatmap` | Login hour distribution |
| GET | `/api/analytics/department-risk` | Risk by department |
| GET | `/api/analytics/risk-trend` | Risk over time |
| GET | `/api/analytics/anomaly-distribution` | Anomaly type breakdown |
| GET | `/api/analytics/top-risk-users` | Highest risk users |
| GET | `/api/analytics/weekly-trends` | Weekly aggregations |

### Reports (CSV)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/reports/alerts/csv` | Export alerts |
| GET | `/api/reports/cases/csv` | Export cases |
| GET | `/api/reports/users/{id}/timeline/csv` | Export user timeline |
| GET | `/api/reports/audit/csv` | Export audit logs |

### System & Admin
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/retrain` | Trigger full retraining |
| GET | `/api/retrain/history` | Training history |
| GET | `/api/audit-logs` | View audit logs (Admin only) |
| GET | `/api/notifications/config` | View notification configs |
| POST | `/api/notifications/config` | Add notification channel |
| GET | `/api/mitre/techniques` | All mapped MITRE ATT&CK techniques |
| GET | `/api/threat-intel/ip/{ip}` | IP reputation & GeoIP |
| GET | `/api/system/health` | Extended system health |
| GET | `/health` | Simple health check |

---

## Dashboard Pages

| Page | Route | Features |
|---|---|---|
| Login | `/login` | Email + password login, JWT auth, redirect to dashboard on success |
| Register | `/register` | 2-step OTP flow: fill details → OTP sent to email → 6-digit verification → auto-login |
| Dashboard | `/` | Stats cards, severity pie/bar charts, risk trend line chart, recent alerts table |
| Attack Simulator | `/simulator` | Five attack buttons (Login, USB, Data Exfiltration, Sensitive Access, Combined), real-time simulation log with MITRE ATT&CK mapping |
| Cases | `/cases` | Case list with status filters, search, create-case modal linking alerts |
| Case Detail | `/cases/:id` | Evidence management, status workflow (Open/Investigating/Resolved/FP), analyst comments |
| Admin Dashboard | `/admin` | Create SOC users, view audit logs, trigger AI model retraining |
| Notification Settings | `/notifications` | Add Email/Slack/Teams channels, configure severity thresholds |
| System Health | `/health` | API status, DB connection, AI model status, event counts, retrain history |
| Alert Queue | `/alerts` | Search, severity/dept/status filters, ranked alert cards, risk bars |
| Alert Investigation | `/alerts/:id` | Tabbed interface: Reasons → Score Breakdown → Actions → Timeline |
| Users Directory | `/users` | Department-grouped grid, search, alert counts |
| User Investigation | `/users/:id` | Risk chart, file activity, transfer/USB, weekly risk trend, behavior profile, baseline comparison |
| Baseline Comparison | `/users/:id/baseline` | 11 features compared: normal vs. today with z-scores, color-coded severity |
| Executive Dashboard | `/executive` | KPI cards, department risk comparison, top 10 risky employees |
| Detection Performance | `/performance` | Precision, recall, F1, FP rate, confusion matrix, missed scenarios |
| Departments | `/departments` | Per-department cards, severity charts, comparison table |

---

## Configuration

All configuration comes from a single `backend/.env` file. This file is excluded from Git via `.gitignore` — create it manually.

```bash
touch backend/.env

# Generate a secure JWT secret key
python -c "import secrets; print(secrets.token_hex(32))"
```

### Required

```env
# JWT secret — generate with the command above
JWT_SECRET_KEY=your-64-char-hex-key-here

# Default admin account, created on first startup
DEFAULT_ADMIN_PASSWORD=YourStrongPassword123
DEFAULT_ADMIN_NAME=Admin User
```

### Optional

```env
# Database — defaults to local SQLite; uncomment for PostgreSQL
# DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/insider_threat

# SMTP email — required for OTP verification and alert notifications
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USERNAME=your-email@gmail.com
# SMTP_PASSWORD=your-app-password
# SMTP_FROM=noreply@soc.local

# CORS — allowed origins for the dashboard
# CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:80

# Token lifetimes (defaults shown)
# JWT_ACCESS_EXPIRE_MINUTES=60
# JWT_REFRESH_EXPIRE_DAYS=7

# Default admin email (defaults to admin@soc.local)
# DEFAULT_ADMIN_EMAIL=admin@soc.local
```

Never commit the `.env` file to Git — it is already in `.gitignore`. If `DEFAULT_ADMIN_PASSWORD` is missing, the server refuses to start with a clear error message.

---

## Default Admin Account

On first startup, if no users exist in the database, the system creates a default admin account:

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | Set via `DEFAULT_ADMIN_PASSWORD` in `.env` |
| Display Name | Set via `DEFAULT_ADMIN_NAME` in `.env` |
| Role | `Admin` |
| Email | Defaults to `admin@soc.local` (override with `DEFAULT_ADMIN_EMAIL`) |

Change the default password immediately after first login. New users can be created from the Admin Dashboard (`/admin`) by an existing Admin.

---

## Behavioral Baseline Comparison

Every employee has a learned behavioral baseline. The Baseline Comparison page shows what's normal vs. what's happening today:

| Feature | What It Measures |
|---|---|
| Typical Login Hour | Usual login time vs. today |
| Files Accessed | Daily file access count deviation |
| Sensitive Files | Unusual access to restricted folders |
| Files Downloaded | Download volume vs. personal norm |
| USB Events | First-time or unusual USB device usage |
| USB Data Written | Volume of data written to USB |
| Data Transferred | Daily data transfer volume |
| External Transfer | Data sent to external/personal destinations |
| Failed Logins | Authentication failures above baseline |
| Distinct IPs | Logins from an unusual number of source IPs |
| After-Hours Login | Login outside typical working hours |

Each feature shows: normal value (mean ± std) → today's value → z-score deviation → severity indicator. When three or more deviations are detected, the page displays a "Multiple Deviations Detected" alert with detailed explanations.

---

## AI Insights & Score Breakdown

Every alert includes an AI-powered insights panel that decomposes the risk score.

**AI Confidence**
```
IF Score ≥ 70 + 3+ strong rules (z ≥ 2.5)   →  High Confidence (92%)
IF Score ≥ 60 + 1+ strong rule              →  Medium-High (78%)
IF Score ≥ 40 or 2+ moderate rules          →  Medium (60%)
Weak signals only                           →  Low (35%)
```

**Score Breakdown**
```
Total Risk Score = IF Contribution (40% of IF score)
                 + Rule Contribution (60% of rule total)
                 + Unquantified
```

Each triggered rule shows its individual contribution as a percentage of the total risk score, ranked by impact.

**Attack Profile** — three risk indicators are computed:
- Data Exfiltration Risk — external transfers, USB data, downloads
- Account Compromise Risk — failed logins, after-hours access, new IPs
- Insider Snooping Risk — sensitive files accessed

**Recommended Actions** — context-aware remediation mapped to each triggered feature:

| Triggered Feature | Recommended Actions |
|---|---|
| `failed_logins` | Lock account, reset password, check brute-force indicators |
| `usb_first_time` | Disable USB ports, log device serial, review USB policy |
| `external_transfer_mb` | Block external transfers, investigate destination, escalate to DLP |
| `sensitive_files_accessed` | Restrict folder access, audit all file logs, escalate to data protection |
| `after_hours_login` | Review login time policy, verify with manager |

---

## Weekly Risk Trend

The User Investigation page includes a weekly risk trend chart with:
- Area chart showing average risk score per week (12 weeks)
- Overlay line showing max risk score per week
- Trend direction indicator: increasing, decreasing, or stable
- Week-over-week comparison from first to last week

This lets analysts see if risk is escalating over time — a key insider threat pattern.

---

## Executive Dashboard

Designed for managers, the Executive Dashboard (`/executive`) provides:

- **KPI cards** — total employees monitored, active alerts, organizational risk score, open investigations, critical alerts
- **Department risk comparison** — horizontal bar chart of average and max risk by department
- **Department breakdown table** — sortable by department, avg/max risk, alert rate, total days, alert days
- **Top 10 risky employees** — ranked list with risk bars, clickable to full investigation

---

## Detection Performance

The Detection Performance page (`/performance`) computes model metrics by comparing High/Critical alerts against 7 injected ground-truth scenarios.

| Metric | Formula | What It Measures |
|---|---|---|
| Precision | TP / (TP + FP) | How many alerts were correct |
| Recall | TP / (TP + FN) | How many attacks were caught |
| F1 Score | 2 × (P × R) / (P + R) | Harmonic mean of precision & recall |
| False Positive Rate | FP / (FP + TN) | Rate of incorrect High/Critical alerts |
| Detection Latency | Avg hours from event to alert | How fast the system detects |

**Confusion Matrix**

| | Predicted Positive | Predicted Negative |
|---|---|---|
| Actual Positive | True Positives (TP) | False Negatives (FN) — missed |
| Actual Negative | False Positives (FP) | True Negatives (TN) |

Missed scenarios are listed on the page — each ground-truth injection not caught at High/Critical, with user, date, and scenario type.

---

## Investigation Summary

When a case is resolved, the Alert Investigation page shows a summary panel containing:

- Employee ID and detected attack type (MITRE technique)
- Aggregate risk score and max severity
- Case status and assigned analyst
- Resolution notes
- Analyst actions timeline
- AI explanation summary — top 5 triggered reasons across linked alerts
- Evidence attached to the case

This provides a complete, auditable record for compliance and post-incident review.

---

## Attack Simulator

Instead of relying only on pre-generated logs, the simulator lets you trigger a scenario and watch detection happen live.

1. **Pick a target** — random user or a specific employee
2. **Choose an attack**:

| Attack Type | MITRE Technique | What It Generates |
|---|---|---|
| Login (brute-force) | T1110 — Brute Force | Failed logins from external IPs at 2 AM |
| USB Exfiltration | T1052 — Exfiltration Over Physical Medium | Unknown USB device with 300–1500 MB data copy |
| Data Exfiltration | T1567 — Exfiltration Over Web Service | 800–3500 MB to personal email/cloud |
| Sensitive Folder Access | T1213 — Data from Information Repositories | Mass access to payroll, HR records, legal contracts |
| Combined | Multiple tactics | All of the above simultaneously |

3. **Detection** — the simulator generates malicious events, extracts behavioral features through the same pipeline used for batch processing, scores against the user's baseline, blends Isolation Forest + rule-based deviation into a 0–100 risk score, creates an alert with MITRE mapping, stores it, and broadcasts it via SSE to connected dashboards.

Navigate to `/simulator` in the dashboard, or:

```bash
curl -X POST "http://localhost:8000/api/simulate/attack?attack_type=combined"
```

---

## RBAC Roles

| Role | Permissions |
|---|---|
| Admin | Full access — manage users, notifications, retraining, audit logs |
| Analyst | View alerts, create cases, add comments, update status, export reports |
| Viewer | Read-only access to dashboard, alerts, and analytics |

---

## Running Tests

```bash
cd backend
pip install -r requirements.txt

# Run all tests
pytest tests/ -v

# Detection pipeline unit tests
pytest tests/test_detection.py -v

# API integration tests
pytest tests/test_api.py -v
```

| Test Suite | Count | Coverage |
|---|---|---|
| Behavioral Baseline | 4 | Baseline building, feature validation, std floor, readiness check |
| Z-Score | 5 | Normal calculation, zero, negative, NaN, None handling |
| Rule-Based Scoring | 3 | Normal/anomalous day detection, reason explanations |
| Severity | 5 | Critical/High/Medium/Low thresholds, baseline-not-ready cap |
| Isolation Forest | 2 | Score range validation, anomaly ranking |
| API Integration | 10 | Health, auth, alerts, users, departments, analytics, SSE |

---

## Future Improvements

| Feature | Description | Priority |
|---------|-------------|----------|
| Active Directory / LDAP Integration | Authenticate analysts via corporate directory — SSO support | High |
| Kafka Event Streaming | Replace SSE with Kafka for scalable real-time ingestion | Medium |
| Cloud Deployment | AWS/GCP/Azure with managed PostgreSQL, S3, load balancing | Medium |
| SIEM Integrations | Forward alerts to Splunk, Elastic SIEM, or QRadar | Medium |
| Prometheus Monitoring | Export metrics for Grafana dashboards | Low |
| AI Investigation Assistant | LLM-powered chat for analyst questions on alerts, users, and cases | Low |
| WebSocket Upgrade | Replace SSE with full-duplex WebSocket | Low |
| Mobile Push Notifications | Alert on-call analysts for Critical severity incidents | Low |
| Retention Policies | Auto-archive old alerts/events on configurable schedules | Low |
| Multi-Tenant Support | Separate SOC workspaces per organization or department | Low |

---

## License

Developed for educational and hackathon demonstration purposes. Not licensed for commercial use or production deployment without review.
