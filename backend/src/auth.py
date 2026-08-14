from typing import Annotated, cast
from fastapi import HTTPException, Depends
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
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))

def hash_identifier(value: str) -> str:
    """Hashes an identifier (email or phone) with a pepper for added security."""
    normalized_value = value.strip().lower()
    return hashlib.sha256((normalized_value + str(PEPPER)).encode()).hexdigest()

password_hash = PasswordHash.recommended()
DUMMY_HASH= password_hash.hash("dummypassword")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="accounts/login")
def get_password_hash(password: Annotated[str, Field(min_length=5)]):
    return password_hash.hash(password)

def verify_password(plain_password: Annotated[str, Field(min_length=5)], hashed_password: Annotated[str, Field(min_length=5)]):
    return password_hash.verify(plain_password, hashed_password)

def create_access_token(account_id: str, expiry_time: dt.timedelta) -> str:
    payload = {}
    payload["account_id"] = account_id
    payload["exp"] = dt.datetime.now(dt.timezone.utc) + expiry_time
    return jwt.encode(payload, str(SECRET_KEY), algorithm=str(ALGORITHM))

def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: Annotated[Session, Depends(get_db)]) -> Account:
    try:
        payload = jwt.decode(token, str(SECRET_KEY), algorithms=[str(ALGORITHM)])
        account_id: str | None = payload.get("account_id")
        if account_id is None:
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