"""Q-SHIELD — Core Configuration"""

from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Q-SHIELD"
    APP_VERSION: str = "1.0.0"
    SECRET_KEY: str = "change-this-in-production"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://qshield:qshield_secure_pass@localhost:5432/qshield_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # JWT
    JWT_SECRET_KEY: str = "jwt-secret-change-this"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # AMD Hardware
    AMD_ROCM_ENABLED: bool = False
    AMD_GPU_DEVICE: int = 0
    AMD_ROCM_PATH: str = "/opt/rocm"
    PYTORCH_ROCM_ARCH: str = "gfx906,gfx908,gfx90a,gfx1030,gfx1100"

    # CPU Threads (AMD EPYC)
    OMP_NUM_THREADS: int = 32

    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    ALERT_EMAIL_FROM: str = "alerts@qshield.edu"

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
