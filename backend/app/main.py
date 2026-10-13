"""FastAPI application entrypoint for ZeroWaste AI."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import close_pool
from app.routers import admin, agents, assistant, audit, evaluation, forecast, health, inventory, recommendations, risk, scenarios
from app.schema import apply_schema
from app.seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifespan handler."""
    # 1. Enforce fail-closed configuration validation
    settings = get_settings()

    # 2. Apply idempotent schema
    try:
        apply_schema()
        # 3. Seed automatically if database is empty (Core seed for Vercel/dev)
        seed_database()
    except Exception as exc:
        # In test environments or when DB is initialized separately
        pass

    yield

    # Shutdown: Close database pool
    close_pool()


app = FastAPI(
    title="ZeroWaste AI API",
    description="Agentic Intelligence for Smarter Grocery Inventory and Perishable Waste Reduction",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
settings = get_settings()
origins = [
    settings.FRONTEND_ORIGIN,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers
app.include_router(health.router)
app.include_router(inventory.router)
app.include_router(forecast.router)
app.include_router(risk.router)
app.include_router(agents.router)
app.include_router(recommendations.router)
app.include_router(scenarios.router)
app.include_router(evaluation.router)
app.include_router(audit.router)
app.include_router(assistant.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {
        "service": "ZeroWaste AI",
        "description": "Agentic Intelligence for Smarter Grocery Inventory",
        "version": "1.0.0",
        "docs_url": "/docs",
        "health_url": "/api/health",
    }
