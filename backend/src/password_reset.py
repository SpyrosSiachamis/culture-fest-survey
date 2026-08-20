"""The password-reset credential emailed to an account holder.

Shape of the flow:

    request  -> account looked up by email_hash, a signed JWT is minted and emailed as a link
    confirm  -> the link's token is verified and the password replaced

Design notes, and why this looks like ``src/redemption.py`` rather than ``src/verification.py``:

* **Nothing is stored.** Like the redemption credential, the token is derived from data already on
  the account plus an expiry. There is no new table, no new column and no extra secret at rest, so
  a database dump contains no reset credential to steal.

* **Single use comes free, from the password itself.** The signed payload carries a fingerprint of
  the account's *current* password hash. Completing a reset replaces that hash, so the fingerprint
  no longer matches and the same link is dead the second time it is used — with no "used" flag to
  keep in step with anything. It also means any outstanding link dies the moment the password
  changes by any other route, which is the behaviour you want if the reason for the reset was that
  somebody else had the old password. Argon2 salts every hash, so even resetting *to the same
  password* produces a different hash and still burns the link.

* **The fingerprint is keyed, never the hash itself.** A JWT payload is signed, not encrypted:
  anyone holding the link can read it. Putting ``hashed_password`` in there verbatim would hand the
  account's Argon2 hash to anyone who intercepted the email, so what travels is an HMAC of it under
  the server-side PEPPER — the same construction ``src/verification.py`` uses for codes.

* **``scope`` is what keeps it from being a skeleton key.** Without it this token — signed with the
  same key and naming the same account — would be accepted as a session token by
  ``get_current_user``. That function rejects any scope but "session", and ``decode`` below rejects
  anything but "password_reset", so neither token can be replayed as the other.

Nothing in this module logs a token.
"""

import datetime as dt
import hashlib
import hmac
import os

import jwt
from sqlalchemy.orm import Session

from src.auth import ALGORITHM, PEPPER, SECRET_KEY
from src.database.models import Account

PASSWORD_RESET_SCOPE = "password_reset"

# Long enough to survive a slow mail relay and someone reading the message on another device, short
# enough that a link left sitting in an inbox is not a standing key to the account.
RESET_TOKEN_TTL_MINUTES = int(os.getenv("PASSWORD_RESET_TTL_MINUTES", "30"))

# Where the emailed link points. Falls back to the first configured CORS origin, which is the
# frontend by definition — so production sends production links without a second variable to
# forget, and a dev stack still works out of the box.
_FRONTEND_BASE_URL = (os.getenv("FRONTEND_BASE_URL", "").strip().rstrip("/") or None)
_FIRST_ALLOWED_ORIGIN = next(
    (
        stripped
        for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
        if (stripped := origin.strip().rstrip("/"))
    ),
    None,
)

RESET_PATH = "/reset-password"


def frontend_base_url() -> str:
    return _FRONTEND_BASE_URL or _FIRST_ALLOWED_ORIGIN or "http://localhost:3000"


def _password_fingerprint(hashed_password: str) -> str:
    """Keyed digest of an account's current password hash.

    Keyed, because this value is readable by anyone holding the token — see the module docstring.
    """
    return hmac.new(
        str(PEPPER).encode(), hashed_password.encode(), hashlib.sha256
    ).hexdigest()


def create_password_reset_token(account: Account) -> str:
    """Mint the value that goes in the emailed link.

    Carries only the account id, the password fingerprint that makes it single-use, its scope and
    its expiry. No email address, no phone, no session rights.
    """
    payload = {
        "account_id": account.id,
        "pwd": _password_fingerprint(account.hashed_password),
        "scope": PASSWORD_RESET_SCOPE,
        "exp": dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=RESET_TOKEN_TTL_MINUTES),
    }
    return jwt.encode(payload, str(SECRET_KEY), algorithm=str(ALGORITHM))


def reset_link(token: str) -> str:
    """The full URL to put in the email."""
    return f"{frontend_base_url()}{RESET_PATH}?token={token}"


def decode_password_reset_token(token: str, db: Session) -> Account | None:
    """The account this token resets, or ``None`` if it may not reset anything.

    One return value for every kind of failure — bad signature, wrong algorithm, expired, wrong
    scope, unknown account, already used — because the caller must answer identically to all of
    them. Distinguishing "expired" from "forged" would tell someone probing the endpoint whether
    they had guessed a real token.
    """
    try:
        payload = jwt.decode(token, str(SECRET_KEY), algorithms=[str(ALGORITHM)])
    except jwt.InvalidTokenError:
        # Covers ExpiredSignatureError, which is a subclass.
        return None

    # No default here, unlike the session check: a token with no scope predates nothing, since this
    # flow shipped with scopes already in place. Anything unscoped is not one of ours.
    if payload.get("scope") != PASSWORD_RESET_SCOPE:
        return None

    account_id = payload.get("account_id")
    fingerprint = payload.get("pwd")
    if not isinstance(account_id, str) or not isinstance(fingerprint, str):
        return None

    account = db.query(Account).filter(Account.id == account_id).first()
    if account is None:
        return None

    # The single-use check. Constant-time, so a near-miss cannot be found by timing.
    if not hmac.compare_digest(_password_fingerprint(account.hashed_password), fingerprint):
        return None

    return account
