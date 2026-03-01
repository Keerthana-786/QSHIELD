"""Q-SHIELD — Threat Analysis API Router"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, ThreatEvent, BehavioralBaseline, LoginSession
from app.services import risk_engine
from app.services.quantum_engine import QuantumEngine
import numpy as np

router = APIRouter()


def get_quantum_engine(request: Request) -> QuantumEngine:
    return request.app.state.quantum_engine


# ─── Request Schemas ─────────────────────────────────────────

class URLScanRequest(BaseModel):
    url: str


class EmailScanRequest(BaseModel):
    subject: str = ""
    content: str
    sender: str = ""


class LoginAnalysisRequest(BaseModel):
    ip: str
    device_fingerprint: Optional[str] = None
    user_agent: Optional[str] = None
    location_city: Optional[str] = None
    location_country: Optional[str] = None
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None
    login_hour: Optional[int] = None
    new_location: bool = False
    new_device: bool = False
    suspicious_ip: bool = False
    vpn_detected: bool = False
    tor_exit: bool = False
    failed_attempts: int = 0


# ─── URL Scanner ─────────────────────────────────────────────

@router.post("/scan-url")
async def scan_url(
    req: URLScanRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    quantum: QuantumEngine = Depends(get_quantum_engine),
):
    """Scan a URL for phishing and malicious indicators"""
    result = risk_engine.analyze_url(req.url)

    # Compute quantum anomaly score
    features = quantum.extract_url_features(req.url, result["quantum_features"])
    quantum_score = quantum.compute_anomaly_score(features, current_user.id)
    result["quantum_anomaly_score"] = round(quantum_score * 100, 2)

    # Boost score if quantum confirms anomaly
    if quantum_score > 0.7 and result["risk_score"] < 50:
        result["risk_score"] = min(result["risk_score"] + 20, 100)
        result["explanation"].append(f"+20 Quantum engine confirmed anomaly (score: {quantum_score:.2f})")

    # Reclassify after quantum boost
    result["severity"], result["severity_color"] = risk_engine.classify_severity(result["risk_score"])

    # Persist threat event
    event = ThreatEvent(
        user_id=current_user.id,
        event_type="url_scan",
        threat_indicator=req.url[:500],
        risk_score=result["risk_score"],
        severity=result["severity"],
        explanation=result["explanation"],
        recommended_action=result["recommended_action"],
        quantum_anomaly_score=quantum_score,
    )
    db.add(event)

    # Update baseline if low risk (this was a normal scan)
    if result["risk_score"] < 25:
        quantum.update_baseline(current_user.id, features)

    # Update user safety score
    _update_safety_score(current_user, result["risk_score"])
    await db.commit()

    return result


# ─── Email Scanner ────────────────────────────────────────────

@router.post("/analyze-email")
async def analyze_email(
    req: EmailScanRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    quantum: QuantumEngine = Depends(get_quantum_engine),
):
    """Analyze email content for phishing indicators"""
    result = risk_engine.analyze_email(req.content, req.subject, req.sender)

    # Quantum scoring
    features = quantum.extract_email_features(result["quantum_features"])
    quantum_score = quantum.compute_anomaly_score(features, current_user.id)
    result["quantum_anomaly_score"] = round(quantum_score * 100, 2)

    if quantum_score > 0.6 and result["risk_score"] < 60:
        boost = int(quantum_score * 25)
        result["risk_score"] = min(result["risk_score"] + boost, 100)
        result["explanation"].append(f"+{boost} Quantum behavioral anomaly detected")
        result["severity"], result["severity_color"] = risk_engine.classify_severity(result["risk_score"])

    event = ThreatEvent(
        user_id=current_user.id,
        event_type="email_scan",
        threat_indicator=f"Subject: {req.subject[:100]}",
        risk_score=result["risk_score"],
        severity=result["severity"],
        explanation=result["explanation"],
        recommended_action=result["recommended_action"],
        quantum_anomaly_score=quantum_score,
    )
    db.add(event)
    _update_safety_score(current_user, result["risk_score"])
    await db.commit()

    return result


# ─── Login Analyzer ───────────────────────────────────────────

@router.post("/analyze-login")
async def analyze_login(
    req: LoginAnalysisRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    quantum: QuantumEngine = Depends(get_quantum_engine),
):
    """Analyze login event for behavioral anomalies"""
    from datetime import datetime
    hour = req.login_hour if req.login_hour is not None else datetime.now().hour

    metadata = {
        "ip": req.ip,
        "new_location": req.new_location,
        "new_device": req.new_device,
        "odd_login_time": hour < 6 or hour > 23,
        "suspicious_ip": req.suspicious_ip,
        "vpn_detected": req.vpn_detected,
        "tor_exit": req.tor_exit,
        "failed_attempts": req.failed_attempts,
        "login_hour": hour,
        "location": req.location_city or "Unknown",
    }

    result = risk_engine.analyze_login(metadata)

    # Quantum scoring
    features = quantum.extract_login_features(metadata)
    quantum_score = quantum.compute_anomaly_score(features, current_user.id)
    result["quantum_anomaly_score"] = round(quantum_score * 100, 2)

    # Save session
    session = LoginSession(
        user_id=current_user.id,
        ip_address=req.ip,
        device_fingerprint=req.device_fingerprint,
        user_agent=req.user_agent,
        location_city=req.location_city,
        location_country=req.location_country,
        location_lat=req.location_lat,
        location_lon=req.location_lon,
        risk_score=result["risk_score"],
        risk_level=result["severity"],
        anomaly_flags=result["explanation"],
        quantum_score=quantum_score,
        is_suspicious=result["risk_score"] > 50,
    )
    db.add(session)

    if result["risk_score"] < 20:
        quantum.update_baseline(current_user.id, features)

    _update_safety_score(current_user, result["risk_score"])
    await db.commit()

    return result


# ─── Threat History ───────────────────────────────────────────

@router.get("/history")
async def get_threat_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 20,
):
    """Get user's personal threat history"""
    result = await db.execute(
        select(ThreatEvent)
        .where(ThreatEvent.user_id == current_user.id)
        .order_by(ThreatEvent.created_at.desc())
        .limit(limit)
    )
    events = result.scalars().all()
    return [
        {
            "id": e.id,
            "event_type": e.event_type,
            "threat_indicator": e.threat_indicator,
            "risk_score": e.risk_score,
            "severity": e.severity,
            "explanation": e.explanation,
            "recommended_action": e.recommended_action,
            "quantum_score": e.quantum_anomaly_score,
            "created_at": e.created_at,
        }
        for e in events
    ]


def _update_safety_score(user: User, threat_score: float):
    """Adjust user's digital safety score based on threat events"""
    if threat_score > 75:
        user.digital_safety_score = max(0, user.digital_safety_score - 8)
    elif threat_score > 50:
        user.digital_safety_score = max(0, user.digital_safety_score - 4)
    elif threat_score < 20:
        user.digital_safety_score = min(100, user.digital_safety_score + 1)
