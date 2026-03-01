"""Q-SHIELD — User Service"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User, BehavioralBaseline
from app.core.security import hash_password
import structlog

logger = structlog.get_logger("qshield.user_service")


async def seed_default_admin(db: AsyncSession):
    """Create default admin account if none exists"""
    result = await db.execute(select(User).where(User.role == "admin"))
    if result.scalar_one_or_none():
        return

    admin = User(
        email="admin@qshield.edu",
        username="admin",
        full_name="Q-SHIELD Administrator",
        hashed_password=hash_password("QShield@2024!"),
        role="admin",
        department="IT Security",
        is_active=True,
        is_verified=True,
        digital_safety_score=95.0,
    )
    db.add(admin)
    await db.flush()

    baseline = BehavioralBaseline(user_id=admin.id)
    db.add(baseline)

    # Seed a demo student
    student = User(
        email="demo@qshield.edu",
        username="demo_student",
        full_name="Demo Student",
        hashed_password=hash_password("Demo@2024!"),
        role="student",
        department="Computer Science",
        student_id="CS-2024-001",
        is_active=True,
        is_verified=True,
        digital_safety_score=78.0,
    )
    db.add(student)
    await db.flush()

    s_baseline = BehavioralBaseline(user_id=student.id)
    db.add(s_baseline)

    await db.commit()
    logger.info("Default accounts seeded", admin="admin@qshield.edu", password="QShield@2024!")
