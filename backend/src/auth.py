from typing import Annotated, Literal, cast
from fastapi import HTTPException, Depends, Request, Response
from pwdlib import PasswordHash
from pydantic import Field
from fastapi.security import OAuth2PasswordBearer
import datetime as dt
from starlette import status
import jwt
import os
import hashlib
from src.database.session import get_db
from sqlalchemy.orm import Session

from src.database.models import Account

SECRET_KEY: str | None = os.getenv("SECRET_KEY")
ALGORITHM: str | None = os.getenv("ALGORITHM")
PEPPER: str | None = os.getenv("PEPPER")

if not SECRET_KEY or not ALGORITHM or not PEPPER:
    raise RuntimeError("All authentication keys must be set in the environment")

SECRET_KEY = cast(str, SECRET_KEY)
ALGORITHM = cast(str, ALGORITHM)
PEPPER= cast(str, PEPPER)
# 12 hours: long enough that a visitor who signs in, wanders the site and comes back to their QR
# code at the door is still signed in, short enough that an abandoned session on a shared phone
# does not stay live for days. Override per environment.
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))

# --- Session cookie --------------------------------------------------------------------------
# The browser session is carried in an HttpOnly cookie rather than by the frontend holding the
# token: JavaScript cannot read it (so XSS cannot exfiltrate it), and — the reason this exists at
# all — the browser sends it again automatically after a reload, which is what makes the sign-in
# survive a refresh. The same token is still accepted in an `Authorization: Bearer` header, so API
# clients and the test suite are unaffected.
AUTH_COOKIE_NAME = "cf_session"

# Secure defaults to off because the dev stack is plain HTTP over the tailnet, where a Secure
# cookie would simply never be stored. Any deployment served over HTTPS must set this to true.
AUTH_COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE", "false").strip().lower() == "true"

# Lax is enough here: frontend and API differ only by port, and a port is not part of a "site", so
# the cookie is first-party on every call the app makes. It also means the browser withholds the
# cookie from cross-site POSTs, which is this app's CSRF defence. Only set "none" (which requires
# Secure) if the API is moved to a genuinely different site from the frontend.
AUTH_COOKIE_SAMESITE = cast(
    Literal["lax", "strict", "none"],
    os.getenv("AUTH_COOKIE_SAMESITE", "lax").strip().lower(),
)

# Unset means "host-only": the cookie is sent back to exactly the host that set it.
AUTH_COOKIE_DOMAIN = os.getenv("AUTH_COOKIE_DOMAIN") or None

def hash_identifier(value: str) -> str:
    """Hashes an identifier (email or phone) with a pepper for added security."""
    normalized_value = value.strip().lower()
    return hashlib.sha256((normalized_value + str(PEPPER)).encode()).hexdigest()

password_hash = PasswordHash.recommended()
DUMMY_HASH= password_hash.hash("dummypassword")

# auto_error=False so a missing header falls through to the cookie instead of 401-ing here.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="accounts/login", auto_error=False)
def get_password_hash(password: Annotated[str, Field(min_length=5)]):
    return password_hash.hash(password)

def verify_password(plain_password: Annotated[str, Field(min_length=5)], hashed_password: Annotated[str, Field(min_length=5)]):
    return password_hash.verify(plain_password, hashed_password)

# Marks a JWT as "may be used to act as this account". Other tokens signed with the same key —
# the QR redemption code in src/redemption.py — carry a different scope and are refused below, so
# possessing one of those never amounts to holding the session.
SESSION_SCOPE = "session"

def create_access_token(account_id: str, expiry_time: dt.timedelta) -> str:
    payload = {}
    payload["account_id"] = account_id
    payload["scope"] = SESSION_SCOPE
    payload["exp"] = dt.datetime.now(dt.timezone.utc) + expiry_time
    return jwt.encode(payload, str(SECRET_KEY), algorithm=str(ALGORITHM))

def set_session_cookie(response: Response, token: str) -> None:
    """Attach the session cookie. Its lifetime matches the token it carries."""
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
        domain=AUTH_COOKIE_DOMAIN,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    """Remove the session cookie. The attributes must match those it was set with, or the browser
    keeps the original cookie and the user stays signed in."""
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
        domain=AUTH_COOKIE_DOMAIN,
        path="/",
    )


def get_session_token(
    request: Request,
    bearer_token: Annotated[str | None, Depends(oauth2_scheme)],
) -> str:
    """The caller's token, from the Authorization header or, failing that, the session cookie.

    Both carry the same kind of token. The header wins when both are present, so an explicit
    credential always beats an ambient one.
    """
    if bearer_token:
        return bearer_token

    cookie_token = request.cookies.get(AUTH_COOKIE_NAME)
    if cookie_token:
        return cookie_token

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(token: Annotated[str, Depends(get_session_token)], db: Annotated[Session, Depends(get_db)]) -> Account:
    try:
        payload = jwt.decode(token, str(SECRET_KEY), algorithms=[str(ALGORITHM)])
        account_id: str | None = payload.get("account_id")
        if account_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
                )
        # Tokens issued for anything other than a browser session — currently the QR redemption
        # code, which is signed with the same key and names the same account — must never be
        # accepted as one. A missing scope means a session token minted before scopes existed.
        if payload.get("scope", SESSION_SCOPE) != SESSION_SCOPE:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        account = db.query(Account).filter(Account.id == account_id).first()
        if account is None:
            raise HTTPException(401, "Account not found", headers={"WWW-Authenticate": "Bearer"})
        return account
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired", headers={"WWW-Authenticate": "Bearer"})
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token", headers={"WWW-Authenticate": "Bearer"})

def get_current_verified_user(account: Annotated[Account, Depends(get_current_user)]) -> Account:
    """get_current_user, plus a check that the account holder proved they own the email address.

    Login already refuses unverified accounts, so this is defence in depth: it also invalidates any
    token that was minted for an account before verification was introduced.
    """
    if account.email_verified_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address is not verified.",
        )
    return account