"""Admin-only API behind the dashboard.

Every route here depends on ``get_current_admin``, which answers 404 to anyone who is not a signed
in, verified admin. That dependency — not the frontend route — is what protects the data: calling
these paths directly with curl runs exactly the same check, and an ordinary user's session gets the
same "no such endpoint" a stranger does.

There is no separate admin login. Admins authenticate at ``/accounts/login`` like everybody else and
carry the same session token; the only difference is the ``role`` column, which nothing a user can
send is able to write.
"""

import re

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from starlette import status

from src import analytics
from src.auth import get_current_admin, get_password_hash, hash_identifier
from src.database.models import Account
from src.database.session import get_db
from src.email_service import send_verification_email
from src.enums import AccountType
from src.schemas import (
    AccountCreate,
    AccountLookupRead,
    AccountLookupResults,
    AdminAccountRead,
    AdminCreated,
    AdminPromoted,
    AdminPromoteRequest,
    AdminSessionRead,
    AnalyticsFieldRead,
    AnalyticsSchemaRead,
    BreakdownRead,
    DistributionRead,
    OverviewRead,
    SeriesPointRead,
    TotalsRead,
)
from src.verification import CODE_TTL_MINUTES, issue_code

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_admin)],
    # Documented on the router so the masking is visible in the schema for anyone who can read it.
    responses={404: {"description": "Not found, or the caller is not an admin."}},
)


def _reference(account: Account) -> str:
    """The same short, quotable account reference the profile page shows."""
    return account.id.split("-")[0].upper()


# The account reference is the leading segment of a UUID, so a valid search term is hex digits and
# dashes. At least two characters, to stop an empty or one-character query dragging back the whole
# table; at most a full UUID.
_LOOKUP_TERM = re.compile(r"^[0-9a-f-]{2,36}$")

# A short prefix can legitimately match a great many accounts. Return at most this many and flag that
# there were more, rather than build an unbounded response.
LOOKUP_LIMIT = 500


def _validate_window(window: str) -> str:
    if window not in analytics.WINDOWS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Unknown window. Expected one of: {', '.join(analytics.WINDOWS)}",
        )
    return window


@router.get("/session", response_model=AdminSessionRead)
def read_admin_session(account: Account = Depends(get_current_admin)):
    """Confirms the caller is an admin, and hands back the little the aside can display."""
    return AdminSessionRead(role=account.role, reference=_reference(account))


# --- Analytics -----------------------------------------------------------------------------------

@router.get("/analytics/schema", response_model=AnalyticsSchemaRead)
def read_analytics_schema():
    """The questions, their answer options and the available time windows.

    Derived from the survey's own pydantic model, so this is the list the frontend builds its filter
    controls and charts from. It holds values, never labels — those are translated in the locale
    files against these same values.
    """
    return AnalyticsSchemaRead(
        fields=[AnalyticsFieldRead.model_validate(field) for field in analytics.CATALOGUE],
        windows=list(analytics.WINDOWS),
        default_window=analytics.DEFAULT_WINDOW,
    )


@router.get("/analytics/overview", response_model=OverviewRead)
def read_overview(
    window: str = analytics.DEFAULT_WINDOW,
    db: Session = Depends(get_db),
):
    """Platform size and recent activity: the main graph and the headline numbers.

    Accounts and surveys are counted from their own tables, so "surveys" means submissions that
    actually landed rather than accounts that happen to exist.
    """
    window = _validate_window(window)
    reference = analytics.now()

    series = analytics.time_series(db, window, reference)

    return OverviewRead(
        window=window,
        generated_at=reference,
        window_start=analytics.window_start(window, reference),
        totals=TotalsRead.model_validate(analytics.platform_totals(db)),
        accounts_in_window=sum(point.accounts for point in series),
        surveys_in_window=sum(point.surveys for point in series),
        series=[SeriesPointRead.model_validate(point) for point in series],
    )


@router.get("/analytics/breakdown", response_model=BreakdownRead)
def read_breakdown(
    request: Request,
    window: str | None = None,
    db: Session = Depends(get_db),
):
    """Answer distributions for every question, optionally windowed and filtered.

    Filters arrive as repeated query parameters named after the survey fields, for example
    ``?audience_type=student&age_range=18-20&age_range=21-24``. Values inside one field are OR-ed,
    different fields are AND-ed. Both the field names and the accepted values are checked against
    the derived catalogue, so a typo is a 422 rather than a chart that quietly ignored it.

    ``window`` is optional here, unlike the overview: the default view of the answers is all of them.
    """
    if window is not None:
        window = _validate_window(window)

    try:
        filters = analytics.parse_filters(request.query_params.multi_items(), reserved={"window"})
    except analytics.FilterError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)
        ) from None

    reference = analytics.now()
    responses = analytics.responses_in_window(db, window, reference)
    matched = [response for response in responses if analytics.matches(response, filters)]

    return BreakdownRead(
        window=window,
        generated_at=reference,
        total=len(responses),
        matched=len(matched),
        filters={name: sorted(values) for name, values in filters.items()},
        distributions=[
            DistributionRead.model_validate(distribution)
            for distribution in analytics.distributions(matched)
        ],
    )


# --- Admin accounts ------------------------------------------------------------------------------

@router.get("/accounts", response_model=list[AdminAccountRead])
def list_admins(
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_admin),
):
    """Every admin account. References and dates only — there is no readable identity to list."""
    admins = (
        db.query(Account)
        .filter(Account.role == AccountType.ADMIN)
        .order_by(Account.created_at)
        .all()
    )
    return [
        AdminAccountRead(
            reference=_reference(admin),
            created_at=admin.created_at,
            email_verified=admin.email_verified_at is not None,
            is_self=admin.id == account.id,
        )
        for admin in admins
    ]


@router.post("/accounts", response_model=AdminCreated, status_code=status.HTTP_201_CREATED)
def create_admin(
    payload: AccountCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _admin: Account = Depends(get_current_admin),
):
    """Create another admin account.

    Only reachable by an existing admin, which is the whole guard against self-promotion: ``role``
    is set here and is never read from a request body anywhere in the application, so there is no
    field for a user to send. Signup cannot produce an admin, and no endpoint changes an existing
    account's role.

    The new account goes through the ordinary verification pipeline rather than being switched on
    immediately. The address is the login identifier and is only ever stored as a hash, so a typo
    would otherwise mint an admin nobody can sign in as and whose email hash is permanently taken.
    Sending a code means the account only becomes usable once somebody proves they can read that
    inbox — the same rule every other account follows.

    Unlike public signup this reports collisions plainly. The caller is already an authenticated
    admin, so there is no account enumeration to protect against here, and a silent no-op would look
    exactly like success.
    """
    email_hash = hash_identifier(payload.email)
    phone_hash = hash_identifier(payload.phone)

    clash = (
        db.query(Account)
        .filter((Account.email_hash == email_hash) | (Account.phone_hash == phone_hash))
        .first()
    )
    if clash is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists with that email address or phone number.",
        )

    new_admin = Account(
        email_hash=email_hash,
        phone_hash=phone_hash,
        hashed_password=get_password_hash(payload.password),
        role=AccountType.ADMIN,
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)

    code = issue_code(db, new_admin)
    background_tasks.add_task(send_verification_email, payload.email, code, CODE_TTL_MINUTES)

    return AdminCreated(
        reference=_reference(new_admin),
        message=(
            "Admin account created. A verification code has been emailed to it — the account "
            "cannot sign in until that code is entered."
        ),
    )


@router.post("/accounts/promote", response_model=AdminPromoted)
def promote_account(
    payload: AdminPromoteRequest,
    db: Session = Depends(get_db),
    _admin: Account = Depends(get_current_admin),
):
    """Give an existing account admin access.

    The other half of ``POST /accounts``: that one mints a new account, this one changes the role of
    somebody who already signed up. Kept separate rather than folded into one endpoint because they
    are different acts with different risks — creating touches nothing that exists, promoting hands
    the dashboard to an account this admin did not make and cannot see inside.

    The account is found by hashing the submitted address with ``hash_identifier``, the same peppered
    function that produced ``email_hash`` at signup. No plaintext address is stored anywhere, so this
    is the only way to name an existing account, and a typo cannot half-match: it either hashes to a
    row or it does not.

    Every refusal below is deliberately *not* a 404. On this router a 404 means "you are not an
    admin" and the dashboard reacts by reloading into the masked not-found screen, so an ordinary
    "no such account" has to be a different status or a mistyped address would look like a lost
    session.
    """
    account = (
        db.query(Account)
        .filter(Account.email_hash == hash_identifier(payload.email))
        .first()
    )

    # Enumeration is not a concern here — the caller is already an authenticated admin — and a
    # generic answer would be actively harmful, because a silent no-op is indistinguishable from a
    # successful promotion when there is no name to read back.
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="No account is registered with that email address.",
        )

    # Same rule the bootstrap script enforces: login refuses an unverified account, so promoting one
    # would produce an admin who cannot sign in and no clue as to why.
    if account.email_verified_at is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                "That account has not verified its email address yet, so it could not sign in as "
                "an admin. Ask them to verify it first."
            ),
        )

    if account.role == AccountType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{_reference(account)} is already an admin.",
        )

    account.role = AccountType.ADMIN
    db.commit()

    return AdminPromoted(
        reference=_reference(account),
        message=(
            f"{_reference(account)} is now an admin. The change takes effect on their next request "
            "— they do not need to sign in again."
        ),
    )


# --- Account lookup ------------------------------------------------------------------------------

@router.get("/accounts/lookup", response_model=AccountLookupResults)
def lookup_accounts(
    reference: str,
    db: Session = Depends(get_db),
    _admin: Account = Depends(get_current_admin),
):
    """Find accounts by the reference shown on a visitor's profile, and report their door status.

    This is the manual fallback for the day the QR scanner cannot tell staff whether a pass is
    genuine or already spent: a visitor reads out the reference from their profile, and this returns
    whether that account voted, verified and — the point of it — redeemed, and when.

    The reference is the leading segment of the account UUID, so the search is a prefix match on the
    id. A short prefix can match many accounts (hence the cap and the ``truncated`` flag); a full
    UUID pasted in matches exactly one. The match exposes only status flags and their timestamps —
    the survey answers are not linked to an account anywhere, so nothing here can deanonymise a
    response.
    """
    normalized = reference.strip().lower()
    if not _LOOKUP_TERM.match(normalized):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Enter at least two characters of an account reference.",
        )

    # id.like('<prefix>%') — ids are stored lowercase, so the term was lowercased to match. Fetch one
    # past the cap purely to know whether more existed, then trim.
    rows = (
        db.query(Account)
        .filter(Account.id.like(f"{normalized}%"))
        .order_by(Account.created_at)
        .limit(LOOKUP_LIMIT + 1)
        .all()
    )
    truncated = len(rows) > LOOKUP_LIMIT
    rows = rows[:LOOKUP_LIMIT]

    return AccountLookupResults(
        query=normalized.upper(),
        count=len(rows),
        truncated=truncated,
        results=[
            AccountLookupRead(
                account_id=account.id,
                reference=_reference(account),
                email_verified=account.email_verified_at is not None,
                email_verified_at=account.email_verified_at,
                has_voted=account.has_voted,
                has_redeemed=account.has_redeemed,
                redeemed_at=account.redeemed_at,
                created_at=account.created_at,
            )
            for account in rows
        ],
    )
