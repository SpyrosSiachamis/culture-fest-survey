from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from starlette import status
import datetime as dt
from src.database.models import Account, EmailVerificationCode
from src.database.session import get_db
from src.email_service import send_account_exists_email, send_verification_email
from src.rate_limit import limiter
from src.schemas import (
    AccountCreate,
    AccountRead,
    ResendAccepted,
    ResendCodeRequest,
    SignupAccepted,
    Token,
    VerificationResponse,
    VerifyEmailRequest,
)
from src.auth import ACCESS_TOKEN_EXPIRE_MINUTES, DUMMY_HASH, create_access_token, get_current_user, verify_password, get_password_hash, hash_identifier
from src.schemas import LoginRequest
from src.verification import (
    CODE_TTL_MINUTES,
    RESEND_COOLDOWN_SECONDS,
    VerificationOutcome,
    consume_code,
    issue_code,
    resend_code,
)

router = APIRouter(prefix = "/accounts", tags = ['accounts'])

# Signup answers the same way whether the address is new, already taken, or already verified, so
# that the endpoint cannot be used to discover which people have accounts.
_SIGNUP_ACCEPTED_MESSAGE = (
    "If this email address can be registered, a verification code has been sent to it."
)

# Shared by "wrong code", "no code in flight" and "no such account" — all three must be
# indistinguishable from outside.
_INVALID_CODE_MESSAGE = "That code is not valid. Check the code and try again."

_RESEND_ACCEPTED_MESSAGE = (
    "If this email address is awaiting verification, a new code has been sent to it."
)


def _verification_error(http_status: int, outcome: VerificationOutcome, message: str) -> HTTPException:
    """Errors carry a machine-readable status so the UI can render the right state."""
    return HTTPException(
        status_code=http_status,
        detail={"status": outcome.value, "message": message},
    )


@router.get('/')
def test_endpoint():
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "Accounts returned"}
    )

@router.post('/signup', response_model=SignupAccepted, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
def register_account(
    request: Request,
    account: AccountCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create a pending account and email it a verification code.

    The account exists straight away but is unverified: it cannot log in and cannot submit a survey
    until the code is confirmed. The plaintext email address is used only to send the message and is
    never persisted — accounts store a peppered hash of it and nothing more.
    """
    email_hash = hash_identifier(account.email)
    phone_hash = hash_identifier(account.phone)

    matches = db.query(Account).filter(
        (Account.email_hash == email_hash) | (Account.phone_hash == phone_hash)
    ).all()

    verified_matches = [existing for existing in matches if existing.email_verified_at is not None]

    if verified_matches:
        # Somebody has already proven they own this email or phone. Leave that account completely
        # untouched, and answer exactly as if a code had been sent.
        if any(existing.email_hash == email_hash for existing in verified_matches):
            # Tell the real owner what happened, since the generic response above cannot.
            background_tasks.add_task(send_account_exists_email, account.email)
        return SignupAccepted(
            message=_SIGNUP_ACCEPTED_MESSAGE,
            expires_in_minutes=CODE_TTL_MINUTES,
        )

    # Every colliding account is still pending, so nobody has proven ownership of these details.
    # Replacing them stops an unverified signup from squatting on someone else's email or phone.
    for stale in matches:
        db.query(EmailVerificationCode).filter(
            EmailVerificationCode.account_id == stale.id
        ).delete(synchronize_session=False)
        db.delete(stale)
    if matches:
        db.flush()

    new_account = Account(
        email_hash=email_hash,
        phone_hash=phone_hash,
        hashed_password=get_password_hash(account.password),
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)

    code = issue_code(db, new_account)
    # Sent in the background so the response time does not depend on which branch ran.
    background_tasks.add_task(send_verification_email, account.email, code, CODE_TTL_MINUTES)

    return SignupAccepted(
        message=_SIGNUP_ACCEPTED_MESSAGE,
        expires_in_minutes=CODE_TTL_MINUTES,
    )


@router.post("/verify-email", response_model=VerificationResponse)
@limiter.limit("10/minute")
def verify_email(request: Request, payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    """Check a submitted code and, if it is correct, mark the account's email as verified."""
    account = db.query(Account).filter(
        Account.email_hash == hash_identifier(payload.email)
    ).first()

    if account is None:
        # Identical to a wrong code: this endpoint must not reveal which addresses are registered.
        raise _verification_error(
            status.HTTP_400_BAD_REQUEST, VerificationOutcome.INVALID, _INVALID_CODE_MESSAGE
        )

    outcome = consume_code(db, account, payload.code)

    if outcome is VerificationOutcome.VERIFIED:
        return VerificationResponse(
            status=outcome.value,
            message="Your email address is verified. You can now sign in.",
        )

    if outcome is VerificationOutcome.EXPIRED:
        raise _verification_error(
            status.HTTP_400_BAD_REQUEST,
            outcome,
            "That code has expired. Request a new one to continue.",
        )

    if outcome is VerificationOutcome.TOO_MANY_ATTEMPTS:
        raise _verification_error(
            status.HTTP_429_TOO_MANY_REQUESTS,
            outcome,
            "Too many incorrect attempts. Request a new code to continue.",
        )

    if outcome is VerificationOutcome.ALREADY_VERIFIED:
        raise _verification_error(
            status.HTTP_409_CONFLICT,
            outcome,
            "This email address has already been verified. You can sign in.",
        )

    raise _verification_error(
        status.HTTP_400_BAD_REQUEST, VerificationOutcome.INVALID, _INVALID_CODE_MESSAGE
    )


@router.post(
    "/verify-email/resend",
    response_model=ResendAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit("3/minute")
def resend_verification_code(
    request: Request,
    payload: ResendCodeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Send a replacement code, subject to a cooldown and a cap on total resends.

    The response is constant. Whether the address has an account, is already verified, is inside the
    cooldown window or has exhausted its resends, the caller is told the same thing — those rules
    are enforced here by not sending, not by reporting a different outcome.
    """
    account = db.query(Account).filter(
        Account.email_hash == hash_identifier(payload.email)
    ).first()

    if account is not None:
        code, _outcome = resend_code(db, account)
        if code is not None:
            background_tasks.add_task(
                send_verification_email, payload.email, code, CODE_TTL_MINUTES
            )

    return ResendAccepted(
        message=_RESEND_ACCEPTED_MESSAGE,
        cooldown_seconds=RESEND_COOLDOWN_SECONDS,
    )


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

    # Checked only after the password, so this reveals nothing to anyone who does not already hold
    # valid credentials for the account.
    if account.email_verified_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "status": "email_not_verified",
                "message": "Verify your email address before signing in.",
            },
        )

    token_expiry = dt.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(account.id, token_expiry)
    return Token(access_token=token, token_type="bearer")

@router.get("/me/has-voted", response_model=bool)
def has_voted(request: Request, account: Account = Depends(get_current_user)):
    return account.has_voted
