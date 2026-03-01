#!/bin/bash
# Q-SHIELD Local Runner — No Docker needed
# For Mac (Intel/Apple Silicon)

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================"
echo "  Q-SHIELD Local Setup"
echo "======================================"

# ── Check Python ──────────────────────────
if ! command -v python3 &>/dev/null; then
  echo "ERROR: Python3 not found. Install from https://python.org"
  exit 1
fi
echo "✓ Python: $(python3 --version)"

# ── Check Node ────────────────────────────
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not found. Install from https://nodejs.org"
  exit 1
fi
echo "✓ Node: $(node --version)"

# ── Check/Start PostgreSQL ────────────────
if command -v pg_isready &>/dev/null && pg_isready -q; then
  echo "✓ PostgreSQL already running"
else
  echo "⚠ PostgreSQL not running — using SQLite instead"
  export USE_SQLITE=true
fi

# ── Backend Setup ─────────────────────────
echo ""
echo "── Setting up Backend ──"
cd "$SCRIPT_DIR/backend"

if [ ! -d "venv" ]; then
  python3 -m venv venv
  echo "✓ Virtual environment created"
fi

source venv/bin/activate

# Install with SQLite-compatible deps
pip install --quiet --upgrade pip
pip install --quiet \
  fastapi==0.109.0 \
  uvicorn[standard]==0.27.0 \
  python-multipart==0.0.6 \
  sqlalchemy==2.0.25 \
  aiosqlite==0.19.0 \
  python-jose[cryptography]==3.3.0 \
  passlib[bcrypt]==1.7.4 \
  pydantic[email]==2.6.0 \
  pydantic-settings==2.1.0 \
  numpy==1.26.3 \
  scikit-learn==1.4.0 \
  scipy==1.12.0 \
  tldextract==5.1.1 \
  python-dotenv==1.0.0 \
  slowapi==0.1.9

echo "✓ Backend dependencies installed"

# Write SQLite config
cat > .env.local << 'ENVEOF'
APP_NAME=Q-SHIELD
APP_VERSION=1.0.0
SECRET_KEY=local-dev-secret-key-qshield-2024
DEBUG=true
ENVIRONMENT=development
DATABASE_URL=sqlite+aiosqlite:///./qshield.db
JWT_SECRET_KEY=local-jwt-secret-qshield-2024
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
AMD_ROCM_ENABLED=false
RATE_LIMIT_PER_MINUTE=1000
ENVEOF

echo "✓ Local config written (.env.local)"

# Start backend in background
echo "Starting backend on http://localhost:8000 ..."
ENV_FILE=.env.local uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "✓ Backend PID: $BACKEND_PID"
sleep 3

# ── Frontend Setup ────────────────────────
echo ""
echo "── Setting up Frontend ──"
cd "$SCRIPT_DIR/frontend"

if [ ! -d "node_modules" ]; then
  echo "Installing npm packages (this takes 2-3 minutes)..."
  npm install --legacy-peer-deps --silent
fi
echo "✓ Frontend dependencies installed"

# Set API URL
export REACT_APP_API_URL=http://localhost:8000

echo "Starting frontend on http://localhost:3000 ..."
npm start &
FRONTEND_PID=$!

echo ""
echo "======================================"
echo "  Q-SHIELD is starting up!"
echo "======================================"
echo ""
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:8000"
echo "  API Docs:  http://localhost:8000/api/docs"
echo ""
echo "  Login:  admin / QShield@2024!"
echo "  or:     demo_student / Demo@2024!"
echo ""
echo "Press Ctrl+C to stop everything"
echo ""

# Wait and cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Q-SHIELD stopped.'" EXIT
wait
