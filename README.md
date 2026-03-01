# Q-SHIELD
### Quantum-Inspired Behavioral Phishing Early Warning System
**For Educational Institutions — AMD Optimized**

---

## 🛡 Overview

Q-SHIELD is a full-stack cybersecurity SaaS platform that detects phishing attacks, fake URLs, suspicious emails, and abnormal login behavior using quantum-inspired anomaly detection.

```
Frontend:  React.js + Recharts + Framer Motion
Backend:   FastAPI (Python) + PostgreSQL + Redis
Auth:      JWT (access + refresh tokens) + RBAC
ML Engine: Quantum-Inspired Kernel SVM (NumPy/SciPy)
AMD:       EPYC CPU tuning + Radeon ROCm GPU support
Deploy:    Docker Compose (production-ready)
```

---

## 🚀 Quick Start

### Prerequisites
- Docker + Docker Compose
- AMD EPYC/Ryzen CPU (or any x86_64)
- AMD Radeon GPU + ROCm 5.7+ (optional, for GPU acceleration)

### 1. Clone and Configure
```bash
git clone https://github.com/your-org/qshield.git
cd qshield
cp .env.example .env
# Edit .env — set SECRET_KEY, JWT_SECRET_KEY, SMTP credentials
```

### 2. Launch with Docker Compose
```bash
docker-compose up -d
```

Services started:
- `http://localhost:3000` — React Frontend
- `http://localhost:8000` — FastAPI Backend
- `http://localhost:8000/api/docs` — Swagger UI
- PostgreSQL on port 5432
- Redis on port 6379

### 3. Default Credentials
| Role    | Username      | Password       |
|---------|---------------|----------------|
| Admin   | admin         | QShield@2024!  |
| Student | demo_student  | Demo@2024!     |

---

## 🏗 Project Structure

```
qshield/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app factory
│   │   ├── api/
│   │   │   ├── auth.py          # POST /login, /register, /refresh
│   │   │   ├── analyze.py       # POST /scan-url, /analyze-email, /analyze-login
│   │   │   ├── dashboard.py     # GET /student, GET /admin
│   │   │   ├── admin.py         # Admin routes (RBAC protected)
│   │   │   ├── reports.py       # GET /security-report (PDF)
│   │   │   └── health.py        # GET /health
│   │   ├── core/
│   │   │   ├── config.py        # Pydantic settings
│   │   │   ├── database.py      # Async SQLAlchemy + PostgreSQL
│   │   │   ├── security.py      # JWT + bcrypt auth
│   │   │   └── amd_optimizer.py # AMD EPYC/ROCm detection
│   │   ├── models/
│   │   │   └── user.py          # User, LoginSession, ThreatEvent, BehavioralBaseline
│   │   └── services/
│   │       ├── quantum_engine.py # Quantum-inspired anomaly detection
│   │       ├── risk_engine.py    # Behavioral risk scoring
│   │       └── user_service.py   # Seed defaults
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.js       # Marketing landing page
│   │   │   ├── Login.js         # Authentication
│   │   │   ├── Register.js      # User registration
│   │   │   ├── StudentDashboard.js  # Student view
│   │   │   ├── AdminDashboard.js    # Admin threat center
│   │   │   ├── URLScanner.js    # URL threat scanner
│   │   │   ├── EmailAnalyzer.js # Email phishing analyzer
│   │   │   └── ThreatHistory.js # Personal event log
│   │   ├── components/shared/
│   │   │   └── AppShell.js      # Sidebar layout
│   │   ├── hooks/
│   │   │   └── useAuth.js       # Auth context + JWT management
│   │   ├── utils/
│   │   │   └── api.js           # Axios client (auth interceptors)
│   │   └── styles/
│   │       └── global.css       # Dark SaaS UI design system
│   ├── package.json
│   └── Dockerfile
├── nginx/
│   └── nginx.conf               # Reverse proxy + SPA routing
├── docker-compose.yml
├── .env                         # Environment variables
└── README.md
```

---

## ⚡ AMD Hardware Support

### AMD EPYC™ / Ryzen™ — CPU Optimization

Q-SHIELD's `amd_optimizer.py` automatically detects AMD CPUs at startup and applies:

```python
# Auto-detected and set on AMD EPYC hosts:
OMP_NUM_THREADS = cpu_count()   # e.g., 96 on EPYC 9654
MKL_NUM_THREADS = cpu_count()
OPENBLAS_NUM_THREADS = cpu_count()
```

NumPy is configured to use OpenBLAS/BLIS (AMD-tuned BLAS) for all matrix operations in the quantum engine.

### AMD Radeon™ — ROCm GPU Acceleration

To enable GPU acceleration on AMD Radeon / Instinct:

1. Install ROCm 5.7+: https://rocm.docs.amd.com
2. Set in `.env`:
   ```
   AMD_ROCM_ENABLED=true
   AMD_GPU_DEVICE=0
   PYTORCH_ROCM_ARCH=gfx1100  # Adjust for your GPU
   ```
3. Uncomment GPU device passthrough in `docker-compose.yml`:
   ```yaml
   devices:
     - /dev/kfd
     - /dev/dri
   group_add:
     - video
     - render
   ```
4. Use the ROCm base image in `backend/Dockerfile`:
   ```
   FROM rocm/pytorch:rocm5.7_ubuntu22.04_py3.10_pytorch_2.0.1
   ```

### Supported AMD GPU Architectures
| GPU                  | Architecture | ROCm ID   |
|----------------------|--------------|-----------|
| Radeon RX 7900 XT    | RDNA 3       | gfx1100   |
| Radeon RX 6800 XT    | RDNA 2       | gfx1030   |
| Instinct MI250X      | CDNA 2       | gfx90a    |
| Instinct MI100       | CDNA 1       | gfx908    |
| Radeon VII           | GCN 5        | gfx906    |

---

## 🧠 Quantum Engine

`backend/app/services/quantum_engine.py`

The quantum engine uses these principles without real quantum hardware:

### 1. Quantum Feature Map (ZZFeatureMap-inspired)
```
Φ(x) = √(2/D) · [cos(Wx + b + entanglement), sin(Wx + b)]
```

### 2. Random Fourier Features (Rahimi & Recht)
Approximates a quantum RBF kernel in a classical RKHS.

### 3. Grover-Inspired Amplitude Amplification
```
f(raw_score) = sin²(arcsin(√raw_score) · depth/2)
```
Enhances signal for high-anomaly inputs, suppresses noise for low-risk ones.

### 4. Adaptive Baseline
Per-user baseline kernels updated via exponential moving average (α=0.1), reducing false positives over time.

---

## 🔢 Risk Scoring System

| Signal                   | Weight |
|--------------------------|--------|
| New login location       | +25    |
| New device fingerprint   | +20    |
| Odd login time           | +15    |
| Suspicious IP            | +30    |
| VPN / Tor exit           | +35    |
| Suspicious URL structure | +35    |
| IP address as host       | +40    |
| Typosquatting            | +45    |
| Email phishing keywords  | +25    |
| Credential harvesting    | +35    |

### Severity Classification
| Score | Level    |
|-------|----------|
| 0–25  | LOW      |
| 26–50 | MEDIUM   |
| 51–75 | HIGH     |
| 76–100| CRITICAL |

---

## 🔌 API Reference

```
POST  /api/auth/register       Register new user
POST  /api/auth/login          Login → JWT tokens
POST  /api/auth/refresh        Refresh access token
GET   /api/auth/me             Current user profile

POST  /api/analyze/scan-url        Scan URL for threats
POST  /api/analyze/analyze-email   Analyze email for phishing
POST  /api/analyze/analyze-login   Analyze login metadata
GET   /api/analyze/history         Personal threat history

GET   /api/dashboard/student   Student dashboard data
GET   /api/admin/dashboard     Admin campus overview
GET   /api/admin/users         User list (admin only)

GET   /api/reports/security-report  Download PDF report
GET   /api/health              System health + AMD info
```

Full Swagger docs: `http://localhost:8000/api/docs`

---

## 🛠 Development Setup

### Backend (without Docker)
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL and Redis
docker-compose up db redis -d

# Run FastAPI
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (without Docker)
```bash
cd frontend
npm install
REACT_APP_API_URL=http://localhost:8000 npm start
```

---

## 🔒 Security Features

- JWT access tokens (30 min) + refresh tokens (7 days)
- bcrypt password hashing (cost factor 12)
- Role-based access control (Student / Admin / Faculty)
- API rate limiting (60 req/min per IP)
- CORS, security headers middleware
- SQL injection prevention (SQLAlchemy ORM)
- Input validation (Pydantic schemas)
- MFA simulation endpoint

---

## 📋 Environment Variables

| Variable              | Description                    | Default |
|-----------------------|--------------------------------|---------|
| SECRET_KEY            | App secret (change this!)      | —       |
| JWT_SECRET_KEY        | JWT signing key (change this!) | —       |
| DATABASE_URL          | PostgreSQL connection string   | —       |
| REDIS_URL             | Redis connection string        | —       |
| AMD_ROCM_ENABLED      | Enable ROCm GPU support        | false   |
| AMD_GPU_DEVICE        | GPU device index               | 0       |
| OMP_NUM_THREADS       | CPU thread count               | 32      |
| SMTP_HOST/USER/PASS   | Email alert configuration      | —       |

---

## 🐳 Production Deployment

```bash
# Build production images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Scale backend workers (AMD EPYC)
docker-compose up -d --scale backend=4
```

---

## 📄 License

MIT License — Free to use for educational and research purposes.

---

*Q-SHIELD — Proactive Cybersecurity for Educational Institutions*
*Quantum-Inspired | AMD Optimized | Privacy-First*
