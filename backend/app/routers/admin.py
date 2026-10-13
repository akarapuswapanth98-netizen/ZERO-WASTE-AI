"""Administrative reset and reseed endpoints protected by ADMIN_TOKEN."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.auth import verify_admin_token
from app.config import get_settings
from app.schema import reset_schema
from app.seed import seed_database

router = APIRouter(prefix="/api/admin", tags=["Admin"], dependencies=[Depends(verify_admin_token)])


@router.post("/reset")
def reset_database():
    """Drop and recreate all tables. Requires ADMIN_TOKEN."""
    reset_schema()
    return {"status": "success", "message": "Database schema reset successfully."}


@router.post("/reseed")
def reseed_database(
    seed: int = Query(default=42, description="Random seed"),
    as_of_date: Optional[str] = Query(default=None, description="ISO as-of date (YYYY-MM-DD)"),
):
    """Reseed database with deterministic synthetic data (Seed 42). Requires ADMIN_TOKEN."""
    result = seed_database(seed=seed, as_of_date_str=as_of_date, force_reset=True)
    return {"status": "success", "seed_result": result}
