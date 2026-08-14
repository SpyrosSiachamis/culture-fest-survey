"""Shared test setup.

``src.auth`` and ``src.database.session`` read their configuration at import time, so every
environment variable the application needs has to be in place *before* anything under ``src`` is
imported. That is why the environment is populated at the top of this module, above the imports.
"""

import os
import pathlib
import sys
import tempfile

# Make `src` importable when pytest is run from anywhere.
_BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

_TEST_DB_PATH = pathlib.Path(tempfile.gettempdir()) / "culture_fest_test.sqlite3"

# Throwaway values — these are test fixtures, not credentials for anything real.
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-for-hs256")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("PEPPER", "test-pepper")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "15")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_TEST_DB_PATH}")
os.environ.setdefault("APP_NAME", "Culture Fest")
# Deliberately no RESEND_API_KEY: nothing in the suite may reach the network. Delivery is captured
# by the `sent_emails` fixture below.

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src import email_service  # noqa: E402
from src.app import app  # noqa: E402
from src.database.session import Base, SessionLocal, engine  # noqa: E402
from src.rate_limit import limiter  # noqa: E402


@pytest.fixture(autouse=True)
def clean_database():
    """Give every test an empty schema and a fresh rate-limit window."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    limiter.reset()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    """Direct database access, for asserting on stored rows and for ageing timestamps."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def sent_emails(monkeypatch):
    """Capture outbound email instead of sending it.

    Patching the transport rather than the template functions means the real subject and body are
    still rendered, so tests can pull the code out of the message exactly as a user would read it.
    """
    captured: list[dict[str, str]] = []

    def fake_send(to: str, subject: str, html_body: str, text_body: str) -> None:
        captured.append(
            {"to": to, "subject": subject, "html": html_body, "text": text_body}
        )

    monkeypatch.setattr(email_service, "_send", fake_send)
    return captured


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
