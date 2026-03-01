"""Q-SHIELD — SQLAlchemy Database Models"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    Text, JSON, ForeignKey, Enum
)
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class UserRole(str, enum.Enum):
    student = "student"
    admin = "admin"
    faculty = "faculty"


class RiskLevel(str, enum.Enum):
    low = "LOW"
    medium = "MEDIUM"
    high = "HIGH"
    critical = "CRITICAL"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(200), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="student", nullable=False)
    department = Column(String(100), nullable=True)
    student_id = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    digital_safety_score = Column(Float, default=75.0)
    mfa_enabled = Column(Boolean, default=False)
    mfa_secret = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_login = Column(DateTime(timezone=True), nullable=True)
    last_login_ip = Column(String(50), nullable=True)

    # Relationships
    sessions = relationship("LoginSession", back_populates="user", cascade="all, delete-orphan")
    threat_events = relationship("ThreatEvent", back_populates="user", cascade="all, delete-orphan")
    behavioral_baseline = relationship("BehavioralBaseline", back_populates="user", uselist=False)


class LoginSession(Base):
    __tablename__ = "login_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ip_address = Column(String(50), nullable=False)
    device_fingerprint = Column(String(255), nullable=True)
    user_agent = Column(Text, nullable=True)
    location_city = Column(String(100), nullable=True)
    location_country = Column(String(100), nullable=True)
    location_lat = Column(Float, nullable=True)
    location_lon = Column(Float, nullable=True)
    risk_score = Column(Float, default=0.0)
    risk_level = Column(String(20), default="LOW")
    anomaly_flags = Column(JSON, default=list)
    quantum_score = Column(Float, default=0.0)
    is_suspicious = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="sessions")


class ThreatEvent(Base):
    __tablename__ = "threat_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_type = Column(String(50), nullable=False)  # url_scan, email_scan, login_anomaly
    threat_indicator = Column(Text, nullable=False)   # URL / email snippet / IP
    risk_score = Column(Float, nullable=False)
    severity = Column(String(20), nullable=False)
    explanation = Column(JSON, nullable=True)          # list of flags
    recommended_action = Column(Text, nullable=True)
    quantum_anomaly_score = Column(Float, default=0.0)
    is_confirmed_threat = Column(Boolean, default=False)
    is_false_positive = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="threat_events")


class BehavioralBaseline(Base):
    __tablename__ = "behavioral_baselines"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    known_ips = Column(JSON, default=list)
    known_devices = Column(JSON, default=list)
    known_locations = Column(JSON, default=list)
    typical_login_hours = Column(JSON, default=list)   # list of hour ints (0-23)
    avg_risk_score = Column(Float, default=10.0)
    total_scans = Column(Integer, default=0)
    false_positive_count = Column(Integer, default=0)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="behavioral_baseline")


class SystemAlert(Base):
    __tablename__ = "system_alerts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False)
    affected_users = Column(Integer, default=0)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
