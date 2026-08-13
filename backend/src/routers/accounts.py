from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from starlette import status
import datetime as dt
from src.database.models import Account
from src.database.session import get_db
from src.schemas import AccountCreate, AccountRead, Token
from slowapi import Limiter
from slowapi.util import get_remote_address 
from src.auth import ACCESS_TOKEN_EXPIRE_MINUTES, DUMMY_HASH, create_access_token, get_current_user, verify_password, get_password_hash, hash_identifier
from src.schemas import LoginRequest

router = APIRouter(prefix = "/accounts", tags = ['accounts'])
limiter = Limiter(key_func=get_remote_address)

@router.get('/')
def test_endpoint():
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "Accounts returned"}
    )

@router.post('/signup', response_model=AccountRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register_account(request: Request, account: AccountCreate, db: Session = Depends(get_db)):
    # Logic to create a new account in the database
    email_hash = hash_identifier(account.email)
    phone_hash = hash_identifier(account.phone)

    existing = db.query(Account).filter(
        (Account.email_hash == email_hash) | (Account.phone_hash == phone_hash)
    ).first()
    if existing:
        raise HTTPException(409, "An account with this email or phone already exists")

    new_account = Account(
        email_hash=email_hash,
        phone_hash=phone_hash,
        hashed_password=get_password_hash(account.password),
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    return new_account


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, credentials: LoginRequest, db: Session = Depends(get_db)):
    identifier_hash = hash_identifier(credentials.email)
    account = db.query(Account).filter(Account.email_hash == identifier_hash).first()

    if account is None:
        verify_password(credentials.password, DUMMY_HASH)   # constant-time-ish
        raise HTTPException(401, "Invalid credentials")

    if not verify_password(credentials.password, account.hashed_password):
        raise HTTPException(401, "Invalid credentials")

    token_expiry = dt.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(account.id, token_expiry)
    return Token(access_token=token, token_type="bearer")

@router.get("/me/has-voted", response_model=bool)
def has_voted(request: Request, account: Account = Depends(get_current_user)):
    return account.has_voted