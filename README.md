# Autonomous Threat Hunter for Insider Attacks

**A complete SOC (Security Operations Center) insider threat detection platform** with AI-powered anomaly detection, real-time monitoring, behavioral baseline comparison, case management, executive dashboard, and full investigation workflows.

<p align="center">
  <i>🏆 Built for hackathon demonstration — ready for real-world SOC deployment</i>
</p>

---

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [What Makes This Stand Out](#-what-makes-this-stand-out)
- [Detection Engine](#-detection-engine)
- [All 34 SOC Features Implemented](#-all-34-soc-features-implemented)
- [Architecture](#-architecture)
- [Requirements / Prerequisites](#-requirements--prerequisites)
- [Quick Start](#-quick-start)
- [Demo & Access](#-demo--access)
- [API Documentation](#-api-documentation)
- [API Endpoints (50+)](#-api-endpoints-50)
- [Dashboard Pages](#-dashboard-pages)
- [Configuration](#-configuration)
- [Default Admin Account](#-default-admin-account)
- [Behavioral Baseline Comparison](#-behavioral-baseline-comparison)
- [AI Insights & Score Breakdown](#-ai-insights--score-breakdown)
- [Weekly Risk Trend](#-weekly-risk-trend)
- [Executive Dashboard](#-executive-dashboard)
- [Detection Performance](#-detection-performance)
- [Investigation Summary](#-investigation-summary)
- [Attack Simulator](#-attack-simulator)
- [RBAC Roles](#-rbac-roles)
- [Running Tests](#-running-tests)
- [Future Improvements](#-future-improvements)
- [Screenshots](#-screenshots)
- [License](#-license)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.13, FastAPI, SQLAlchemy (async), Uvicorn |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| **Database** | SQLite (development) / PostgreSQL (production) |
| **ML / AI** | scikit-learn (Isolation Forest), NumPy, Pandas |
| **Auth** | JWT (PyJWT), bcrypt password hashing |
| **Real-time** | Server-Sent Events (SSE) |
| **Infrastructure** | Docker, Docker Compose, Nginx |
| **Testing** | Pytest, pytest-asyncio, HTTPX |

---

## 🏆 What Makes This Stand Out

| Feature | Why It Matters |
|---|---|
| **Interactive Attack Simulator** ⭐ | Click a button to simulate a real insider threat — watch detection happen in real-time |
| **Behavioral Baseline Comparison** 🧬 | Compare any employee's behavior TODAY vs their NORMAL — shows exactly what's abnormal |
| **AI Confidence Scoring** 🤖 | Every alert gets an AI confidence score (High/Medium/Low) with full risk score breakdown |
| **Recommended Actions** ⚡ | Context-aware remediation: "Lock account", "Disable USB", "Block external transfers" |
| **Executive Dashboard** 📊 | Org-wide view: department risk, top risky employees, severity trends for managers |
| **Detection Performance Metrics** 🎯 | Precision, recall, F1-score, false-positive rate computed against ground truth |
| **Investigation Summary** 📋 | Complete case report: employee, attack type, evidence, AI explanations, analyst actions |
| **Weekly Risk Trend** 📈 | See how an employee's risk evolves week-over-week (up/down/stable) |
| **Unsupervised ML Detection** | Isolation Forest catches anomalies no rule could find |
| **Per-User Behavioral Baseline** | Learns what "normal" means for each employee individually |
| **Low False-Positive Design** | 4 explicit control layers — no unexplained alerts |
| **Real-Time SSE Monitoring** | Alerts stream instantly without page refresh |
| **Full Investigation Workflow** | Open → Acknowledged → Investigating → Resolved / False Positive |
| **Case Management** | Group alerts, add evidence, track investigations |
| **MITRE ATT&CK Mapping** | Maps every alert to real-world attack techniques |
| **JWT Login & Registration** 🚪 | Professional login page, self-registration for analysts, auto-login after signup |
| **OTP Email Verification** 📧 | 6-digit OTP sent via SMTP on registration — account created only after verification |
| **Passwordless OTP Flow** 🔐 | Registration sends OTP to company email, 10-minute timer, resend support |
| **Route Protection** 🔒 | All pages protected — unauthenticated users redirected to login |
| **Case Management UI** 📋 | Convert alerts to cases, add evidence, track investigation status |
| **Alert Action Workflow** ⚡ | Acknowledge, Investigate, Escalate, Resolve, or mark as False Positive |
| **Admin Dashboard** 🔧 | Create users, view audit logs, trigger AI model retraining |
| **Notification Settings** 🔔 | Configure Email/Slack/Teams alert channels |
| **System Health** ❤️ | Real-time API, database, and AI model status monitoring |
| **RBAC** | Admin, Analyst, and Viewer roles with JWT auth |
| **Audit Logging** | Every analyst action is recorded |
| **CSV Report Generation** | Export alerts, cases, timelines, audit logs |
| **Docker Deployment** | One-command setup with Docker Compose |
| **Unit & API Tests** | 29 tests across detection and API layers |

---

## 🧠 Detection Engine

### Two-Signal Blend

| Component | Weight | What It Catches |
|---|---|---|
| **Isolation Forest** (ML) | 40% | Weird combinations of features — statistical oddities |
| **Rule-based deviation** | 60% | Concrete violations: first-time USB, after-hours login, exfiltration |

**Blend:** `risk_score = 0.4 × IF_percentile + 0.6 × rule_score`

### AI Confidence Classification

Every alert goes through an AI confidence assessment based on how many independent signals agree:

| Confidence | Criteria | Meaning |
|---|---|---|
| **High** (92%) | IF ≥ 70 + 3+ strong rules (z ≥ 2.5) | Multiple independent signals strongly agree |
| **Medium-High** (78%) | IF ≥ 60 + 1+ strong rule | Strong agreement with evidence |
| **Medium** (60%) | IF ≥ 40 or 2+ moderate rules | Some signals present |
| **Low** (35%) | Few or weak signals | Low confidence — may need review |

### Severity Bands

| Score | Severity | Action |
|---|---|---|
| ≥ 80 | **Critical** 🛑 | Immediate investigation |
| 60–79 | **High** ⚠️ | Escalate |
| 40–59 | **Medium** 🔶 | Review |
| < 40 | **Low** 🟢 | Logged only |

### False-Positive Controls

1. **Baseline min days** — New users capped at 35 max
2. **Z-score + absolute delta** — Both statistical AND operational thresholds
3. **No-explanation cap** — Every Medium+ alert must be explainable
4. **Std floor** — Prevents runaway z-scores on low-variance features

### Score Breakdown

The AI Insights endpoint decomposes every alert into its constituent signals:

```
Total Risk Score = IF Contribution (40%) + Rule Contribution (60%) + Unquantified
```

Each triggered rule shows: **Feature → Z-score → Weight → Contribution → % of Total**

---

## ✅ All 34 SOC Features Implemented

| # | Feature | Module | Status |
|---|---|---|---|
| 1 | **Interactive Attack Simulator** ⭐ | `attack_simulator.py` + `/simulator` page | ✅ Full Stack |
| 2 | **Behavioral Baseline Comparison** 🧬 | `baseline-comparison` endpoint + `/users/:id/baseline` page | ✅ Full Stack |
| 3 | **AI Confidence + Score Breakdown** 🤖 | `ai-insights` endpoint + enhanced AlertDetail page | ✅ Full Stack |
| 4 | **Recommended Actions** ⚡ | `ai-insights` endpoint with per-feature action mapping | ✅ Full Stack |
| 5 | **Executive Dashboard** 📊 | `executive/summary` endpoint + `/executive` page | ✅ Full Stack |
| 6 | **Detection Performance** 🎯 | `detection-performance` endpoint + `/performance` page | ✅ Full Stack |
| 7 | **Investigation Summary** 📋 | `cases/{id}/summary` endpoint + AlertDetail panel | ✅ Full Stack |
| 8 | **Weekly Risk Trend** 📈 | `users/{id}/risk-trend` endpoint + UserDetail chart | ✅ Full Stack |
| 9 | Real-time monitoring (SSE) | `websocket_manager.py` | ✅ Backend |
| 10 | Role-Based Access Control | `auth.py` + JWT | ✅ Backend |
| 11 | Alert investigation workflow | `main.py` alert status | ✅ Backend |
| 12 | Notifications (Email/Slack/Teams) | `notifications.py` | ✅ Backend |
| 13 | Threat Intelligence (IP/GeoIP) | `threat_intel.py` | ✅ Backend |
| 14 | MITRE ATT&CK mapping | `mitre_attack.py` | ✅ Backend |
| 15 | Employee risk history & trends | `analytics.py` + timeline | ✅ Backend |
| 16 | Behavior profile page | `main.py` /profile endpoint | ✅ Backend |
| 17 | Interactive attack timeline | `models.py` AttackTimelineEvent | ✅ Backend |
| 18 | Advanced dashboard analytics | `analytics.py` (6 endpoints) | ✅ Backend |
| 19 | Case management | `case_manager.py` | ✅ Backend |
| 20 | Model retraining | `retrain.py` | ✅ Backend |
| 21 | Report generation (CSV) | `report_generator.py` | ✅ Backend |
| 22 | Audit logging | `auth.py` + `AuditLog` model | ✅ Backend |
| 23 | Docker deployment | `docker-compose.yml` + 3 Dockerfiles | ✅ Full Stack |
| 24 | **Unit & API tests** | `tests/test_detection.py`, `test_api.py` | ✅ 29 Tests |
| 25 | **JWT Login & Registration** 🚪 | `auth.py` + Login/Register pages | ✅ Full Stack |
| 26 | **OTP Email Verification** 📧 | `OTPVerification` model + `/verify-otp` endpoint | ✅ Full Stack |
| 27 | **Route Protection & RBAC UI** 🔒 | `ProtectedRoute` + role-based sidebar | ✅ Full Stack |
| 28 | **Case Management UI** 📋 | `Cases.tsx` + `CaseDetail.tsx` with evidence | ✅ Full Stack |
| 29 | **Alert Action Workflow** ⚡ | Acknowledge, Investigate, Escalate, Resolve, FP | ✅ Full Stack |
| 30 | **Admin Dashboard** 🔧 | User mgmt, audit logs, model retrain | ✅ Full Stack |
| 31 | **Notification Settings** 🔔 | Email/Slack/Teams channel config | ✅ Full Stack |
| 32 | **System Health** ❤️ | API/DB/Model status, event metrics | ✅ Full Stack |
| 33 | **SMTP Real Email** 📬 | Real `smtplib` sending via `.env` config (SMTP_HOST/USERNAME/PASSWORD) | ✅ Backend |
| 34 | **All Config via .env** 🔑 | Zero hardcoded secrets — JWT, SMTP, DB, admin all from `.env` file | ✅ Full Stack |

---

## 🏗️ Architecture

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
│   │   ├── main.py               # FastAPI SOC API (50+ endpoints)
│   │   ├── database.py           # Database connection (PostgreSQL/SQLite)
│   │   ├── models.py             # 19 ORM models for all SOC features
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
│   │   ├── test_detection.py     # 19 unit tests for detection pipeline
│   │   └── test_api.py           # 10 API integration tests
│   └── output/                   # JSON output files (alerts, timelines, summary)
├── dashboard/
│   ├── Dockerfile                # Nginx container for built dashboard
│   ├── nginx.conf                # Nginx config (SPA routing + API proxy)
│   ├── index.html                # HTML entry point
│   ├── package.json              # Node dependencies
│   ├── vite.config.ts            # Vite build config
│   ├── tailwind.config.js        # Tailwind CSS config
│   ├── tsconfig.json             # TypeScript config
│   ├── postcss.config.js         # PostCSS config
│   └── src/                      # React app (Vite + Tailwind + Recharts)
│       ├── main.tsx              # App entry point
│       ├── index.css             # Global styles
│       ├── types.ts              # TypeScript type definitions
│       ├── App.tsx               # Route definitions (17 routes)
│       ├── contexts/
│       │   └── AuthContext.tsx    # JWT auth state management
│       ├── pages/                # 17 route pages
│       │   ├── Login.tsx         # Login page (email + password)
│       │   ├── Register.tsx      # Registration with OTP verification
│       │   ├── Dashboard.tsx     # Main SOC dashboard
│       │   ├── Alerts.tsx        # Alert queue
│       │   ├── AlertDetail.tsx   # Alert investigation
│       │   ├── Users.tsx         # Users directory
│       │   ├── UserDetail.tsx    # User investigation
│       │   ├── BehaviorBaselineComparison.tsx  # Baseline vs today
│       │   ├── Cases.tsx         # Case management
│       │   ├── CaseDetail.tsx    # Case detail with evidence
│       │   ├── Departments.tsx   # Department stats
│       │   ├── AttackSimulator.tsx  # Interactive attack sim
│       │   ├── ExecutiveDashboard.tsx  # Org-wide KPIs
│       │   ├── DetectionPerformance.tsx  # AI metrics
│       │   ├── Admin.tsx         # Admin panel
│       │   ├── NotificationSettings.tsx  # Channel config
│       │   └── SystemHealth.tsx  # System status
│       ├── components/           # Reusable UI components
│       │   ├── Layout.tsx        # Sidebar + topbar
│       │   ├── FilterBar.tsx     # Alert filters
│       │   ├── SeverityBadge.tsx # Severity indicator
│       │   └── StatsCard.tsx     # KPI card
│       └── api/client.ts         # API client with auth + refresh
├── .gitignore                    # Git ignore rules
├── docker-compose.yml            # Full stack orchestration
└── README.md
```

---

## 📋 Requirements / Prerequisites

Before running the project, ensure you have the following installed:

| Software | Version | Purpose |
|----------|---------|---------|
| **Python** | ≥ 3.10, recommended 3.13 | Backend API + ML pipeline |
| **Node.js** | ≥ 18 | Dashboard development server |
| **npm** | ≥ 9 | Package manager for dashboard |
| **Docker** | ≥ 24 (optional) | Containerized deployment |
| **Docker Compose** | ≥ 2.24 (optional) | Multi-container orchestration |
| **Git** | Any recent version | Version control |

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone and start everything
docker compose up --build
```

This starts:
- **PostgreSQL** database on port 5432
- **Pipeline** generates data then exits
- **Backend API** on port 8000
- **Dashboard** on port 80

### Option 2: Local Development

```bash
# 1. Backend — install dependencies
cd backend
pip install -r requirements.txt

# 2. Create your .env file (required)
# Copy the config section below into backend/.env and fill in values

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

## 🌐 Demo & Access

Once running, access the platform at:

| Service | URL | Description |
|---------|-----|-------------|
| **Dashboard** | `http://localhost:5173` | React frontend (dev server) |
| **Dashboard** | `http://localhost:80` | Nginx production build (Docker) |
| **Backend API** | `http://localhost:8000` | FastAPI REST API |
| **Swagger Docs** | `http://localhost:8000/docs` | Interactive API documentation |
| **ReDoc** | `http://localhost:8000/redoc` | Alternative API docs |

---

## 📖 API Documentation

FastAPI automatically generates interactive API documentation:

- **Swagger UI** → `http://localhost:8000/docs`
  - Browse all endpoints
  - Try requests directly from the browser
  - View request/response schemas

- **ReDoc** → `http://localhost:8000/redoc`
  - Alternative documentation layout
  - Better for printing/exporting

The API serves 50+ endpoints across authentication, detection, analytics, case management, reporting, and system health.

---

## 🔌 API Endpoints (50+)

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
| GET | `/api/users/{id}/baseline-comparison` | 🧬 Compare today's behavior vs normal baseline |
| GET | `/api/users/{id}/risk-trend` | 📈 Weekly risk trend over 12 weeks |
| GET | `/api/alerts/{id}/ai-insights` | 🤖 AI confidence, score breakdown, recommended actions |

### Executive & Performance
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/executive/summary` | 📊 Executive dashboard (org-wide stats) |
| GET | `/api/analytics/detection-performance` | 🎯 Precision, recall, F1, FP rate from ground truth |

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
| GET | `/api/cases/{id}/summary` | 📋 Investigation summary report |
| PATCH | `/api/cases/{id}/status` | Update case status |
| POST | `/api/cases/{id}/evidence` | Add evidence to case |

### Attack Simulator
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/simulate/scenarios` | List available attack scenarios |
| POST | `/api/simulate/attack` | 🚀 Trigger a live simulated attack |

### Authentication & RBAC
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login (returns JWT token) |
| POST | `/api/auth/register` | Step 1: Register — sends OTP to email (no account created yet) |
| POST | `/api/auth/verify-otp` | Step 2: Verify OTP — creates account on successful verification |
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

## 📊 Dashboard Pages

| Page | Route | Features |
|---|---|---|
| **Login** 🆕 | `/login` | Email + password login, JWT auth, redirect to dashboard on success |
| **Register** 🆕 | `/register` | **2-step OTP flow**: fill details → OTP sent to email → 6-digit verification → auto-login |
| **Dashboard** | `/` | Stats cards, severity pie/bar charts, risk trend line chart, recent alerts table |
| **Attack Simulator** ⭐ | `/simulator` | **5 attack buttons** (Login, USB, Data Exfiltration, Sensitive Access, Combined), real-time simulation log with MITRE ATT&CK mapping |
| **Cases** 🆕 | `/cases` | Case list with status filters, search, **create case** modal linking alerts |
| **Case Detail** 🆕 | `/cases/:id` | Evidence management, status workflow (Open/Investigating/Resolved/FP), analyst comments |
| **Admin Dashboard** 🆕 | `/admin` | **Create SOC users**, view audit logs, trigger AI model retraining |
| **Notification Settings** 🆕 | `/notifications` | Add Email/Slack/Teams channels, configure severity thresholds |
| **System Health** 🆕 | `/health` | API status, DB connection, AI model status, event counts, retrain history |
| **Alert Queue** | `/alerts` | Search, severity/dept/status filters, ranked alert cards, risk bars |
| **Alert Investigation** 🆕 | `/alerts/:id` | **Tabbed interface**: Reasons → Score Breakdown → Actions → Timeline. AI confidence, score breakdown, attack profile |
| **Users Directory** | `/users` | Department-grouped grid, search, alert counts |
| **User Investigation** 🆕 | `/users/:id` | Risk chart, file activity, transfer/USB, weekly risk trend, behavior profile, baseline comparison |
| **Baseline Comparison** 🆕 | `/users/:id/baseline` | **11 features** compared: normal vs today with z-scores, color-coded severity |
| **Executive Dashboard** 🆕 | `/executive` | KPI cards, department risk comparison, top 10 risky employees |
| **Detection Performance** 🆕 | `/performance` | Precision, recall, F1, FP rate, confusion matrix, missed scenarios |
| **Departments** | `/departments` | Per-dept cards, severity charts, comparison table |

---

## ⚙️ Configuration

All configuration comes from a single `backend/.env` file. **This file is excluded from Git via `.gitignore` — you must create it manually.**

### Quick Setup

```bash
# Create the .env file
touch backend/.env

# Generate a secure JWT secret key
python -c "import secrets; print(secrets.token_hex(32))"
# → Copy the output (e.g., a9f8c7b6e5d4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f)
```

### Required Environment Variables

```env
# ── JWT Authentication (REQUIRED) ─────────────────────────────────────────
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET_KEY=your-64-char-hex-key-here

# ── Default Admin Account (REQUIRED) ──────────────────────────────────────
# Sets the password for username "admin" created on first startup
DEFAULT_ADMIN_PASSWORD=YourStrongPassword123
DEFAULT_ADMIN_NAME=Admin User
```

### Optional Environment Variables

```env
# ── Database ──────────────────────────────────────────────────────────────
# Default: local SQLite file. Uncomment for PostgreSQL:
# DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/insider_threat

# ── SMTP Email (for OTP verification + alert notifications) ───────────────
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USERNAME=your-email@gmail.com
# SMTP_PASSWORD=your-app-password
# SMTP_FROM=noreply@soc.local

# ── CORS (allowed origins for dashboard) ──────────────────────────────────
# CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:80

# ── Token Lifetimes (optional, defaults shown) ────────────────────────────
# JWT_ACCESS_EXPIRE_MINUTES=60
# JWT_REFRESH_EXPIRE_DAYS=7
```

> **⚠️ Security Note:** Never commit the `.env` file to Git. It is already in `.gitignore`. If the `DEFAULT_ADMIN_PASSWORD` is missing, the server will refuse to start with a clear error message.

---

## 👤 Default Admin Account

On first startup, if no users exist in the database, the system automatically creates a default admin account:

| Field | Value |
|-------|-------|
| **Username** | `admin` |
| **Password** | Whatever you set as `DEFAULT_ADMIN_PASSWORD` in `.env` |
| **Display Name** | Whatever you set as `DEFAULT_ADMIN_NAME` in `.env` |
| **Role** | `Admin` |
| **Email** | Default: `admin@soc.local` (override with `DEFAULT_ADMIN_EMAIL`) |

> **⚠️ Important:** Change the default password immediately after first login. New users can be created from the **Admin Dashboard** (`/admin`) by an existing Admin.

---

## 🧬 Behavioral Baseline Comparison

Every employee has a learned behavioral baseline. The Baseline Comparison page shows exactly **what's normal vs what's happening today**:

| Feature | Icon | What It Measures |
|---|---|---|
| Typical Login Hour | ⏰ | Usual time employee logs in vs today |
| Files Accessed | 📄 | Daily file access count deviation |
| Sensitive Files | 🔒 | Unusual access to restricted folders |
| Files Downloaded | ⬇️ | Download volume compared to personal norm |
| USB Events | 💾 | First-time or unusual USB device usage |
| USB Data Written | 💾 | Volume of data written to USB |
| Data Transferred | 📤 | Daily data transfer volume |
| External Transfer | 🌐 | Data sent to external/personal destinations |
| Failed Logins | ❌ | Authentication failures above baseline |
| Distinct IPs | 🌍 | Logins from unusual number of source IPs |
| After-Hours Login | 🌙 | Login outside typical working hours |

Each feature shows: **Normal value (mean ± std)** → **Today's value** → **Z-score deviation** → **Severity indicator**.

When **3+ deviations** are detected, the page displays a prominent **"Multiple Deviations Detected"** alert with detailed explanations.

---

## 🤖 AI Insights & Score Breakdown

Every alert includes an AI-powered insights panel that decomposes the risk score:

### AI Confidence
The system assesses how many independent signals agree:

```
IF Score ≥ 70 + 3+ strong rules (z ≥ 2.5)  →  High Confidence (92%)
IF Score ≥ 60 + 1+ strong rule              →  Medium-High (78%)
IF Score ≥ 40 or 2+ moderate rules           →  Medium (60%)
Weak signals only                            →  Low (35%)
```

### Score Breakdown (Pie Chart)
```
Total Risk Score = IF Contribution (40% of IF score)
                 + Rule Contribution (60% of rule total)
                 + Unquantified
```

Each triggered rule shows its **individual contribution** as a percentage of the total risk score, ranked by impact.

### Attack Profile
Three risk indicators are computed:
- **Data Exfiltration Risk** — External transfers, USB data, downloads
- **Account Compromise Risk** — Failed logins, after-hours access, new IPs
- **Insider Snooping Risk** — Sensitive files accessed

### Recommended Actions
Context-aware remediation mapped to each triggered feature:

| Triggered Feature | Recommended Actions |
|---|---|
| `failed_logins` | 🔒 Lock account, 🔄 Reset password, 📋 Check brute-force indicators |
| `usb_first_time` | 💾 Disable USB ports, 📋 Log device serial, 🔄 Review USB policy |
| `external_transfer_mb` | 🌐 Block external transfers, 🔒 Investigate destination, 🚨 Escalate to DLP |
| `sensitive_files_accessed` | 🔒 Restrict folder access, 📋 Audit all file logs, 🔄 Escalate to data protection |
| `after_hours_login` | 🔒 Review login time policy, 📋 Verify with manager |

---

## 📈 Weekly Risk Trend

Instead of only showing the current risk score, the **User Investigation page** now includes a weekly risk trend chart with:

- **Area chart** showing avg risk score per week (12 weeks)
- **Overlay line** showing max risk score per week
- **Trend direction indicator**: ↑ Increasing, ↓ Decreasing, → Stable
- **Week-over-week comparison** from first to last week

This lets analysts see if risk is **escalating over time** — a key insider threat pattern.

---

## 📊 Executive Dashboard

Designed for managers, the Executive Dashboard (at `/executive`) provides:

### KPI Cards
- **Total Employees** monitored
- **Active Alerts** (non-resolved)
- **Organizational Risk Score** (average across all users)
- **Open Investigations**
- **Critical Alerts** count

### Department Risk Comparison
Horizontal bar chart showing each department's **average risk** (colored red/yellow/green) and **max risk** (overlayed in purple).

### Department Breakdown Table
Sortable table with columns: Department, Avg Risk, Max Risk, Alert Rate %, Total Days, Alert Days. Color-coded by risk level.

### Top 10 Risky Employees
Ranked list with risk bars, clickable to navigate to full investigation. Top 3 are highlighted in red.

---

## 🎯 Detection Performance

The Detection Performance page (at `/performance`) computes AI model metrics by comparing **High/Critical alerts** against **7 injected ground-truth scenarios**:

### Metrics Computed
| Metric | Formula | What It Measures |
|---|---|---|
| **Precision** | TP / (TP + FP) | How many alerts were correct |
| **Recall** | TP / (TP + FN) | How many attacks were caught |
| **F1 Score** | 2 × (P × R) / (P + R) | Harmonic mean of precision & recall |
| **False Positive Rate** | FP / (FP + TN) | Rate of incorrect High/Critical alerts |
| **Detection Latency** | Avg hours from event to alert | How fast the system detects |

### Confusion Matrix
| | Predicted Positive | Predicted Negative |
|---|---|---|
| **Actual Positive** | True Positives (TP) | False Negatives (FN) — Missed |
| **Actual Negative** | False Positives (FP) | True Negatives (TN) |

### Missed Scenarios
Lists each ground-truth injection that wasn't caught at High/Critical, showing the user, date, and scenario type for continuous improvement.

---

## 📋 Investigation Summary

When a case is resolved, the Alert Investigation page shows an **Investigation Summary** panel containing:

- **Employee ID** and **Detected Attack Type** (MITRE technique)
- **Aggregate Risk Score** and **Max Severity**
- **Case Status** and **Assigned Analyst**
- **Resolution Notes** — how the investigation was concluded
- **Analyst Actions Timeline** — every recorded action during the investigation
- **AI Explanation Summary** — top 5 triggered reasons across linked alerts
- **Evidence** — all evidence items attached to the case

This provides a complete, auditable record for compliance and post-incident review.

---

## 🎮 Attack Simulator (Interactive Demo)

The heart of the hackathon demo. Instead of just reading pre-generated logs, judges can **click a button and watch an attack happen in real-time**.

### How It Works

1. **Pick a target** — Random user or choose a specific employee
2. **Choose an attack** — 5 scenarios with escalating severity:

| Button | Attack Type | MITRE Technique | What It Generates |
|---|---|---|---|
| 🔐 Login Attack | Brute-force | T1110 — Brute Force | Failed logins from external IPs at 2 AM |
| 💾 USB Exfiltration | Physical exfiltration | T1052 — Exfiltration Over Physical Medium | Unknown USB device with 300-1500 MB data copy |
| 📤 Data Exfiltration | Web exfiltration | T1567 — Exfiltration Over Web Service | 800-3500 MB to personal email/cloud |
| 📁 Sensitive Folder Access | Data collection | T1213 — Data from Information Repositories | Mass access to payroll, HR records, legal contracts |
| 🚨 Combined Attack | Multi-vector | Multiple tactics | All of the above simultaneously |

3. **Watch the detection** — The simulator:
   - Generates malicious events on-the-fly
   - Extracts behavioral features (same pipeline as batch processing)
   - Scores against the user's existing behavioral baseline
   - Blends Isolation Forest + rule-based deviation → 0-100 risk score
   - Creates an alert with MITRE ATT&CK mapping
   - Stores in database + broadcasts via SSE to all connected dashboards
   - Displays real-time results with severity, reasons, and evidence

### Try It

Navigate to **`/simulator`** in the dashboard, or send a POST request:

```bash
curl -X POST "http://localhost:8000/api/simulate/attack?attack_type=combined"
```

---

## 🛡️ RBAC Roles

| Role | Permissions |
|---|---|
| **Admin** | Full access — manage users, notifications, retraining, audit logs |
| **Analyst** | View alerts, create cases, add comments, update status, export reports |
| **Viewer** | Read-only access to dashboard, alerts, and analytics |

---

## 🧪 Running Tests

The project contains **29 automated tests** split across two test suites:

```bash
cd backend
pip install -r requirements.txt

# Run all tests
pytest tests/ -v

# Detection pipeline unit tests (19 tests)
# Tests: baseline computation, z-score logic, rule-based scoring,
#        severity classification, Isolation Forest training
pytest tests/test_detection.py -v

# API integration tests (10 tests)
# Tests: health endpoint, authentication (valid/invalid credentials),
#        alerts listing, user listing, departments, analytics, SSE streaming
pytest tests/test_api.py -v
```

### Test Coverage Areas

| Test Suite | Count | What It Covers |
|---|---|---|
| **Behavioral Baseline** | 4 tests | User baseline building, feature validation, std floor, readiness check |
| **Z-Score** | 5 tests | Normal calculation, zero, negative, NaN, None handling |
| **Rule-Based Scoring** | 3 tests | Normal/anomalous day detection, reason explanations |
| **Severity** | 5 tests | Critical/High/Medium/Low thresholds, baseline-not-ready cap |
| **Isolation Forest** | 2 tests | Score range validation, anomaly ranking |
| **API Integration** | 10 tests | Health, auth, alerts, users, departments, analytics, SSE |

---

## 🔮 Future Improvements

| Feature | Description | Priority |
|---------|-------------|----------|
| **Active Directory / LDAP Integration** | Authenticate SOC analysts via corporate directory — SSO support | High |
| **Kafka Event Streaming** | Replace SSE with Apache Kafka for scalable real-time event ingestion | Medium |
| **Cloud Deployment** | Deploy to AWS/GCP/Azure with managed PostgreSQL, S3, and load balancing | Medium |
| **SIEM Integrations** | Forward alerts to Splunk, Elastic SIEM, or QRadar via syslog or webhook | Medium |
| **Prometheus Monitoring** | Export metrics (alert rate, model latency, API response times) for Grafana dashboards | Low |
| **AI-Powered Investigation Assistant** | LLM-powered chat assistant that answers analyst questions about alerts, users, and cases | Low |
| **WebSocket Upgrade** | Replace SSE with full-duplex WebSocket for bidirectional real-time communication | Low |
| **Mobile Push Notifications** | Alert on-call analysts via push notification for Critical severity incidents | Low |
| **Retention Policies** | Auto-archive old alerts and events based on configurable retention periods | Low |
| **Multi-Tenant Support** | Separate SOC workspaces for different organizations or departments | Low |

---

## 📸 Screenshots

> *Screenshots will be added here. Below are placeholders — replace with actual images from your deployment.*

| Page | Preview |
|------|---------|
| **Login Page** | `[Screenshot of login page — email + password form]` |
| **Registration** | `[Screenshot of registration form with OTP verification step]` |
| **SOC Dashboard** | `[Screenshot of main dashboard with stats cards and charts]` |
| **Alert Investigation** | `[Screenshot of alert detail with AI insights tab]` |
| **Attack Simulator** | `[Screenshot of simulator page with attack buttons and results]` |
| **Behavioral Baseline** | `[Screenshot of baseline comparison table with z-scores]` |
| **Executive Dashboard** | `[Screenshot of org-wide KPIs and department risk chart]` |
| **Detection Performance** | `[Screenshot of precision/recall metrics and confusion matrix]` |
| **Case Management** | `[Screenshot of case list with evidence and comments]` |
| **Admin Dashboard** | `[Screenshot of admin panel with user management]` |
| **System Health** | `[Screenshot of system status page]` |
| **User Investigation** | `[Screenshot of user detail with risk trend chart]` |

---

## 📁 License

This project was developed for **educational and hackathon demonstration purposes**.

It is not licensed for commercial use or production deployment without review. The codebase demonstrates a complete SOC insider threat detection platform with AI-powered anomaly detection, behavioral baseline analysis, case management, and real-time monitoring.

---

> **Built with ❤️ for the Autonomous Threat Hunter for Insider Attacks hackathon project.**
