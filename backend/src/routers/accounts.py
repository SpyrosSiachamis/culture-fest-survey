from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from starlette import status
import datetime as dt
from src.database.models import Account, EmailVerificationCode
from src.database.session import get_db
from src.email_service import (
    send_account_exists_email,
    send_password_reset_email,
    send_verification_email,
)
from src.rate_limit import limiter
from src.schemas import (
    AccountCreate,
    AccountRead,
    PasswordResetAccepted,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetResult,
    ProfileRead,
    RedemptionRead,
    RedemptionStatusRead,
    ResendAccepted,
    ResendCodeRequest,
    SignupAccepted,
    Token,
    VerificationResponse,
    VerifyEmailRequest,
)
from src.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    AUTH_COOKIE_NAME,
    DUMMY_HASH,
    clear_session_cookie,
    create_access_token,
    get_current_verified_user,
    get_password_hash,
    hash_identifier,
    set_session_cookie,
    verify_password,
)
from src.password_reset import (
    RESET_TOKEN_TTL_MINUTES,
    create_password_reset_token,
    decode_password_reset_token,
    reset_link,
)
from src.redemption import create_redemption_token
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

_PASSWORD_RESET_ACCEPTED_MESSAGE = (
    "If an account exists for this email address, a reset link has been sent to it."
)

# One answer for every way a reset link can fail: forged, tampered with, expired, already used, or
# naming an account that no longer exists. Telling them apart would let someone probing the endpoint
# learn whether they had guessed a real token.
_INVALID_RESET_TOKEN_MESSAGE = (
    "That reset link is invalid or has expired. Request a new one to continue."
)


def _verification_error(http_status: int, outcome: VerificationOutcome, message: str) -> HTTPException:
    """Errors carry a machine-readable status so the UI can render the right state."""
    return HTTPException(
        status_code=http_status,
        detail={"status": outcome.value, "message": message},
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
def login(
    request: Request,
    response: Response,
    credentials: LoginRequest,
    db: Session = Depends(get_db),
):
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

    # The browser gets the token as an HttpOnly cookie, which is what lets the session survive a
    # page reload. It is also returned in the body, unchanged, for non-browser clients.
    set_session_cookie(response, token)

    return Token(access_token=token, token_type="bearer")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    """End the browser session by deleting the cookie that carries it.

    Unauthenticated on purpose: signing out has to work even when the token has already expired,
    and all this can ever do is clear the caller's own cookie.

    The token itself is a stateless JWT, so a copy captured elsewhere stays valid until it expires.
    Killing it earlier would need a server-side denylist — worth adding if sessions ever get long,
    but out of scope for a 12-hour token that the browser can no longer read.
    """
    clear_session_cookie(response)


@router.get("/me", response_model=ProfileRead)
def read_profile(
    request: Request,
    response: Response,
    account: Account = Depends(get_current_verified_user),
):
    """The signed-in account's own profile.

    The account is resolved from the session token and from nothing else. There is no id in the
    path, the query string or the body, so there is no id for a caller to tamper with — asking for
    somebody else's profile is not a request this API can express.
    """
    if not account.allowed_to_redeem:
        redemption = RedemptionRead(status="not_eligible")
    elif account.has_redeemed:
        # Claimed already: no credential is issued at all, rather than one the page is trusted to
        # hide. There is nothing here that could be replayed at the door.
        redemption = RedemptionRead(status="redeemed", redeemed_at=account.redeemed_at)
    else:
        redemption = RedemptionRead(status="ready", token=create_redemption_token(account))

    # Rolling session: an active user's cookie is renewed on every visit, so someone who keeps
    # using the app is not signed out mid-festival. Only for cookie callers — a bearer client
    # manages its own token.
    if AUTH_COOKIE_NAME in request.cookies:
        set_session_cookie(
            response,
            create_access_token(account.id, dt.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)),
        )

    return ProfileRead(
        reference=account.id.split("-")[0].upper(),
        email_verified=account.email_verified_at is not None,
        email_verified_at=account.email_verified_at,
        has_voted=account.has_voted,
        created_at=account.created_at,
        redemption=redemption,
    )


@router.get("/me/redemption-status", response_model=RedemptionStatusRead)
def read_redemption_status(account: Account = Depends(get_current_verified_user)):
    """Whether this account's benefit has been claimed, and when.

    The fallback for a scan whose confirmation never appeared on the staff device: the visitor can
    check on their own phone, signed in as themselves, instead of being turned away or handed a
    second bracelet. Same authorisation as the profile — the session decides whose status this is.
    """
    return RedemptionStatusRead(
        has_redeemed=account.has_redeemed,
        redeemed_at=account.redeemed_at,
    )


@router.get("/me/has-voted", response_model=bool)
def has_voted(account: Account = Depends(get_current_verified_user)):
    # Verified, like the sibling /me endpoints: an unverified account cannot vote in the first
    # place, so it has no meaningful answer here, and using the same guard keeps every /me route on
    # one authorisation rule rather than a subtly weaker one for this one.
    return account.has_voted


@router.post(
    "/password-reset/request",
    response_model=PasswordResetAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit("3/minute")
def request_password_reset(
    request: Request,
    payload: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Email a reset link to the address, if it has an account.

    The response is constant, and deliberately so in three separate ways:

    * **Same body and status** whether or not an account was found, so the endpoint cannot be used
      to discover which addresses are registered.
    * **Same work done.** The hash and the lookup run before the branch, not inside it, so a
      no-match answer costs the same peppered SHA-256 and the same indexed query as a match. A
      short-circuit "return early if not found" would leave a timing difference that leaks exactly
      what the constant message is there to hide.
    * **Same response time.** The mail goes out in a background task, after the response, so the
      round trip never includes a call to Resend that only happens on one branch.

    Email only. A phone number is a valid login identifier elsewhere, but there is no channel here
    to deliver a link over, so ``phone_hash`` is not consulted.
    """
    email_hash = hash_identifier(payload.email)
    account = db.query(Account).filter(Account.email_hash == email_hash).first()

    if account is not None:
        token = create_password_reset_token(account)
        background_tasks.add_task(
            send_password_reset_email,
            payload.email,
            reset_link(token),
            RESET_TOKEN_TTL_MINUTES,
        )

    return PasswordResetAccepted(message=_PASSWORD_RESET_ACCEPTED_MESSAGE)


@router.post("/password-reset/confirm", response_model=PasswordResetResult)
@limiter.limit("10/minute")
def confirm_password_reset(
    request: Request,
    payload: PasswordResetConfirm,
    db: Session = Depends(get_db),
):
    """Set a new password, given a valid reset link.

    The token is the proof of ownership — the same role the emailed verification code plays at
    signup — so no current password is asked for. It is single-use: it carries a fingerprint of the
    password hash it was minted against, and writing a new hash here invalidates it along with every
    other link outstanding for this account. See src/password_reset.py.
    """
    account = decode_password_reset_token(payload.token, db)

    if account is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "status": "invalid_reset_token",
                "message": _INVALID_RESET_TOKEN_MESSAGE,
            },
        )

    account.hashed_password = get_password_hash(payload.new_password)
    db.commit()

    return PasswordResetResult(
        message="Your password has been changed. You can now sign in with it."
    )
