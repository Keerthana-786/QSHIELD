"""Q-SHIELD — Dashboard & Admin API Routers"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.user import User, ThreatEvent, LoginSession

router = APIRouter()


@router.get("/student")
async def student_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Student dashboard data"""
    # Recent threat events
    events_result = await db.execute(
        select(ThreatEvent)
        .where(ThreatEvent.user_id == current_user.id)
        .order_by(desc(ThreatEvent.created_at))
        .limit(10)
    )
    events = events_result.scalars().all()

    # Recent sessions
    sessions_result = await db.execute(
        select(LoginSession)
        .where(LoginSession.user_id == current_user.id)
        .order_by(desc(LoginSession.created_at))
        .limit(5)
    )
    sessions = sessions_result.scalars().all()

    # Threat counts
    total_threats = len([e for e in events if e.risk_score > 50])
    blocked_phishing = len([e for e in events if e.event_type in ["url_scan", "email_scan"] and e.risk_score > 50])

    # Risk level from latest event
    latest_risk = events[0].severity if events else "LOW"
    latest_score = events[0].risk_score if events else 5.0

    return {
        "user": {
            "id": current_user.id,
            "full_name": current_user.full_name,
            "email": current_user.email,
            "role": current_user.role,
            "department": current_user.department,
            "digital_safety_score": current_user.digital_safety_score,
            "mfa_enabled": current_user.mfa_enabled,
            "last_login": current_user.last_login,
        },
        "metrics": {
            "digital_safety_score": current_user.digital_safety_score,
            "current_risk_level": latest_risk,
            "current_risk_score": latest_score,
            "phishing_blocked": blocked_phishing,
            "total_scans": len(events),
            "active_sessions": len([s for s in sessions if not s.is_suspicious]),
        },
        "recent_events": [
            {
                "id": e.id,
                "type": e.event_type,
                "indicator": e.threat_indicator[:80],
                "score": e.risk_score,
                "severity": e.severity,
                "flags": e.explanation[:3] if e.explanation else [],
                "timestamp": e.created_at,
            }
            for e in events[:6]
        ],
        "recent_sessions": [
            {
                "ip": s.ip_address,
                "city": s.location_city or "Unknown",
                "country": s.location_country or "Unknown",
                "risk": s.risk_level,
                "suspicious": s.is_suspicious,
                "timestamp": s.created_at,
            }
            for s in sessions
        ],
    }
