"""Q-SHIELD — Health Check Router"""
from fastapi import APIRouter, Request
from app.core.amd_optimizer import AMDOptimizer
import os, platform

router = APIRouter()

@router.get("/health")
async def health(request: Request):
    amd = AMDOptimizer()
    return {
        "status": "healthy",
        "service": "Q-SHIELD",
        "amd_hardware": amd.get_system_info(),
        "python": platform.python_version(),
        "cpu_cores": os.cpu_count(),
    }
