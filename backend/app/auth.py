"""Authentication and authorization dependencies for ZeroWaste AI."""
from typing import Optional
from fastapi import Header, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from app.config import get_settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(
    x_api_key: Optional[str] = Security(api_key_header),
    authorization: Optional[str] = Header(default=None),
) -> bool:
    """Verify standard API key unless in local demo mode."""
    settings = get_settings()

    # If DEMO_MODE is True and NOT in production, allow bypass
    if settings.DEMO_MODE and not settings.is_production:
        return True

    configured_key = settings.API_KEY
    if not configured_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: API_KEY is unset.",
        )

    # Check X-API-Key header
    if x_api_key and x_api_key == configured_key:
        return True

    # Check Authorization: Bearer <key>
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1] == configured_key:
            return True

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized: Invalid or missing API key.",
    )


def verify_admin_token(
    x_admin_token: Optional[str] = Header(default=None, alias="X-Admin-Token"),
) -> bool:
    """Verify administrator token for destructive operations (reset/reseed)."""
    settings = get_settings()

    # In production or Vercel, an unset or empty ADMIN_TOKEN is strictly rejected
    if settings.is_production and not settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: ADMIN_TOKEN is unset in production environment.",
        )

    configured_admin = settings.ADMIN_TOKEN
    if not configured_admin:
        # In non-production, if ADMIN_TOKEN is unset, still reject for security
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: ADMIN_TOKEN must be configured to perform admin actions.",
        )

    if x_admin_token and x_admin_token == configured_admin:
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Forbidden: Invalid administrator token.",
    )
