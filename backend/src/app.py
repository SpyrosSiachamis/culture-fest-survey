from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from src.database.session import Base, engine
from src.database import models  # noqa: F401 — registers models on Base
from src.database.schema_patch import ensure_columns
from src.rate_limit import limiter
from src.routers import accounts
from src.routers import admin
from src.routers import surveys

#TODO: Drop the database when testing is done, or use a separate test database. This is just for development purposes.

logger = logging.getLogger(__name__)

app = FastAPI()

# slowapi resolves the limiter from app.state at request time, so the @limiter.limit decorators on
# the routers do nothing at all without these two lines.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Client IP behind a reverse proxy -------------------------------------------------------------
# The rate limiter keys on request.client.host. Directly exposed that is the real client, which is
# what we want. But behind a reverse proxy (the documented production path — Caddy / `tailscale
# serve`) every request arrives from the proxy, so without this every user would share one
# rate-limit bucket: one abuser could trip the login/verify/submit limits for everyone, and the
# per-IP brute-force and enumeration protections would stop being per-IP.
#
# ProxyHeadersMiddleware rewrites request.client from X-Forwarded-For, but ONLY when the immediate
# peer is one of TRUSTED_PROXY_IPS. An arbitrary client cannot spoof the header to forge or evade a
# limit, because its own connection address is not trusted. Unset (the default, and the dev stack)
# means no proxy is trusted and X-Forwarded-For is ignored entirely — correct for direct exposure.
#
# Set it to the proxy's address(es) in production, e.g. TRUSTED_PROXY_IPS=127.0.0.1 when the proxy
# runs on the same host. Never set it to "*" on a publicly reachable backend: that would trust
# X-Forwarded-For from anyone and hand every caller a spoofable rate-limit key.
_trusted_proxy_ips = [
    ip.strip() for ip in os.getenv("TRUSTED_PROXY_IPS", "").split(",") if ip.strip()
]
if _trusted_proxy_ips:
    if "*" in _trusted_proxy_ips:
        logger.warning(
            "TRUSTED_PROXY_IPS is '*': X-Forwarded-For will be trusted from ANY peer, which makes "
            "the rate-limit key spoofable. Set it to the reverse proxy's address instead."
        )
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=_trusted_proxy_ips)

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