"""Configuration and fail-closed authentication rules for ZeroWaste AI."""
from datetime import date
from typing import Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

FORBIDDEN_DEFAULT_KEYS = {
    "",
    "changeme",
    "secret",
    "default",
    "123456",
    "apikey",
    "admin",
    "test",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=None,  # Do not read .env file directly to maintain workspace security rules
        extra="ignore",
    )

    DATABASE_URL: str = "postgresql://postgres@localhost:5433/zerowaste_dev"
    API_KEY: Optional[str] = None
    ADMIN_TOKEN: Optional[str] = None
    DEMO_MODE: bool = False
    PRODUCTION: Optional[str] = None
    VERCEL: Optional[str] = None
    AS_OF_DATE: str = "2026-10-12"
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    @property
    def is_production(self) -> bool:
        return self.PRODUCTION == "1" or self.VERCEL is not None

    @property
    def as_of_date_obj(self) -> date:
        return date.fromisoformat(self.AS_OF_DATE)

    @model_validator(mode="after")
    def validate_fail_closed_security(self) -> "Settings":
        is_prod = self.is_production

        # Rule: Refuse DEMO_MODE=True when PRODUCTION=1 or VERCEL is set
        if is_prod and self.DEMO_MODE:
            raise RuntimeError(
                "FAIL-CLOSED SECURITY: DEMO_MODE cannot be enabled when PRODUCTION=1 or VERCEL is set."
            )

        # Rule: When DEMO_MODE is False, API_KEY must be set and not a known placeholder/default
        if not self.DEMO_MODE:
            if not self.API_KEY or self.API_KEY.strip().lower() in FORBIDDEN_DEFAULT_KEYS:
                raise RuntimeError(
                    "FAIL-CLOSED SECURITY: Backend refuses to start because DEMO_MODE is False "
                    "and API_KEY is unset, empty, or a known default/placeholder value."
                )

        return self


# Global singleton settings factory
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def reset_settings_cache() -> None:
    """Helper for testing configuration permutations."""
    global _settings
    _settings = None
