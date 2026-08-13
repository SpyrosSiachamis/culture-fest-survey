from math import exp
from typing import Annotated, cast
from pwdlib import PasswordHash
from pydantic import Field
from fastapi.security import OAuth2PasswordBearer
import datetime as dt
from starlette import status
import jwt
import os
import hashlib

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

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")
def get_password_hash(password: Annotated[str, Field(min_length=5)]):
    return password_hash.hash(password)

def verify_password(plain_password: Annotated[str, Field(min_length=5)], hashed_password: Annotated[str, Field(min_length=5)]):
    return password_hash.verify(plain_password, hashed_password)

def create_access_token(username: str, user_id: str, expiry_time: dt.timedelta) -> str:
    payload = {}
    payload["account_id"] = user_id
    payload["exp"] = dt.datetime.now(dt.timezone.utc) + expiry_time
    return jwt.encode(payload, str(SECRET_KEY), algorithm=str(ALGORITHM))