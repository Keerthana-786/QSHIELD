"""
Q-SHIELD — Quantum-Inspired Behavioral Phishing Early Warning System
FastAPI Backend — Main Application Entry Point
AMD Optimized: EPYC CPU + Radeon ROCm GPU Support
"""

import time
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import engine, Base
from app.api import auth, analyze, dashboard, reports, admin, health
from app.core.amd_optimizer import AMDOptimizer
import structlog

# ─── Structured Logging ───────────────────────────────────────
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)
logger = structlog.get_logger("qshield.main")

# ─── Rate Limiter ─────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup / shutdown lifecycle"""
    # Startup
    logger.info("Q-SHIELD starting up", version=settings.APP_VERSION)

    # Create DB tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized")

    # AMD hardware detection & optimization
    amd = AMDOptimizer()
    amd.detect_and_configure()

    # Initialize quantum engine
    from app.services.quantum_engine import QuantumEngine
    app.state.quantum_engine = QuantumEngine()
    logger.info("Quantum engine initialized")

    # Seed default admin if not present
    from app.core.database import AsyncSessionLocal
    from app.services.user_service import seed_default_admin
    async with AsyncSessionLocal() as db:
        await seed_default_admin(db)

    logger.info("Q-SHIELD ready", host="0.0.0.0", port=8000)
    yield

    # Shutdown
    await engine.dispose()
    logger.info("Q-SHIELD shutdown complete")


# ─── App Factory ──────────────────────────────────────────────
app = FastAPI(
    title="Q-SHIELD API",
    description="Quantum-Inspired Behavioral Phishing Early Warning System",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── Middleware ───────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:80", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_timing_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = (time.time() - start) * 1000
    response.headers["X-Process-Time-Ms"] = f"{duration:.2f}"
    response.headers["X-Powered-By"] = "Q-SHIELD / AMD-Optimized"
    return response


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ─── Routers ─────────────────────────────────────────────────
app.include_router(health.router,     prefix="/api",          tags=["Health"])
app.include_router(auth.router,       prefix="/api/auth",     tags=["Authentication"])
app.include_router(analyze.router,    prefix="/api/analyze",  tags=["Threat Analysis"])
app.include_router(dashboard.router,  prefix="/api/dashboard",tags=["Dashboard"])
app.include_router(reports.router,    prefix="/api/reports",  tags=["Reports"])
app.include_router(admin.router,      prefix="/api/admin",    tags=["Admin"])


# ─── Root ─────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "system": "Q-SHIELD",
        "version": settings.APP_VERSION,
        "status": "operational",
        "amd_optimized": True,
        "endpoints": "/api/docs",
    }
