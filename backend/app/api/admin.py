"""Q-SHIELD — Admin API Router"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.core.security import require_admin
from app.models.user import User, ThreatEvent, LoginSession

router = APIRouter()


@router.get("/dashboard")
async def admin_dashboard(
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    """Admin-level campus threat overview"""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    # Total users
    users_count = await db.execute(select(func.count(User.id)))
    total_users = users_count.scalar()

    # Recent events (all users)
    events_result = await db.execute(
        select(ThreatEvent)
        .order_by(desc(ThreatEvent.created_at))
        .limit(50)
    )
    events = events_result.scalars().all()

    # Severity distribution
    severity_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for e in events:
        severity_counts[e.severity] = severity_counts.get(e.severity, 0) + 1

    # Recent critical events
    critical = [e for e in events if e.severity in ["HIGH", "CRITICAL"]][:10]

    # Flagged users
    flagged_result = await db.execute(
        select(User).where(User.digital_safety_score < 50).limit(10)
    )
    flagged_users = flagged_result.scalars().all()

    # Campus trust score
    avg_score_result = await db.execute(select(func.avg(User.digital_safety_score)))
    avg_score = avg_score_result.scalar() or 75.0

    return {
        "campus_metrics": {
            "total_users": total_users,
            "institutional_trust_score": round(avg_score, 1),
            "events_24h": len([e for e in events if e.created_at >= cutoff]),
            "critical_threats_24h": len([e for e in critical if e.created_at >= cutoff]),
            "flagged_accounts": len(flagged_users),
        },
        "severity_distribution": severity_counts,
        "recent_threats": [
            {
                "id": e.id,
                "user_id": e.user_id,
                "type": e.event_type,
                "indicator": e.threat_indicator[:60],
                "score": e.risk_score,
                "severity": e.severity,
                "quantum_score": e.quantum_anomaly_score,
                "timestamp": e.created_at,
            }
            for e in critical[:10]
        ],
        "flagged_accounts": [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "department": u.department,
                "safety_score": u.digital_safety_score,
            }
            for u in flagged_users
        ],
        "all_events": [
            {
                "id": e.id,
                "type": e.event_type,
                "score": e.risk_score,
                "severity": e.severity,
                "timestamp": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events[:20]
        ],
    }


@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
    skip: int = 0,
    limit: int = 50,
):
    result = await db.execute(
        select(User).offset(skip).limit(limit)
    )
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "department": u.department,
            "safety_score": u.digital_safety_score,
            "is_active": u.is_active,
            "last_login": u.last_login,
        }
        for u in users
    ]
