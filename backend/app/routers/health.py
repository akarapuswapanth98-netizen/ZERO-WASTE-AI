"""Public health check endpoint."""
from fastapi import APIRouter
from app.config import get_settings
from app.database import check_db_health

router = APIRouter(prefix="/api", tags=["Health"])


@router.get("/health")
def health_check():
    """Public health endpoint reporting application and database status."""
    settings = get_settings()
    db_ok = check_db_health()
    return {
        "status": "healthy" if db_ok else "degraded",
        "service": "zerowaste-ai-backend",
        "database_connected": db_ok,
        "demo_mode": settings.DEMO_MODE,
        "is_production": settings.is_production,
        "as_of_date": settings.AS_OF_DATE,
    }
