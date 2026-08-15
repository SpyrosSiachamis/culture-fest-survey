from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from src.database.session import Base, engine
from src.database import models  # noqa: F401 — registers models on Base
from src.database.schema_patch import ensure_columns
from src.rate_limit import limiter
from src.routers import accounts
from src.routers import admin
from src.routers import surveys

#TODO: Drop the database when testing is done, or use a separate test database. This is just for development purposes.

app = FastAPI()

# slowapi resolves the limiter from app.state at request time, so the @limiter.limit decorators on
# the routers do nothing at all without these two lines.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
# create_all() adds missing tables but never alters existing ones, so columns added to a model that
# is already deployed need this additive patch. See src/database/schema_patch.py.
ensure_columns(engine)

@app.get('/health')
def root():
    return {
        "status": "ok",
        "message": "Backend is running"
    }

app.include_router(accounts.router)
app.include_router(surveys.router)
app.include_router(admin.router)