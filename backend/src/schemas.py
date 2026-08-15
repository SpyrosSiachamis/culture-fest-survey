import pydantic
import re
import typing as t
import datetime as dt
from pydantic import field_validator, model_validator
from src.enums import (
    AccountType,
    AgeRange,
    AlcoholPreference,
    AudienceType,
    DatePreference,
    Gender,
    Genre,
    GroupSize,
    StartTimePreference,
    TicketPriceRange,
    TransportInterest,
)

# Bounds of the two 1-10 sliders. Named because the analytics reads them back off the model
# metadata rather than repeating the numbers (see src/analytics.py).
SCALE_MIN = 1
SCALE_MAX = 10

# Digits, optionally preceded by '+', with the usual separators allowed and stripped out.
_PHONE_ALLOWED = re.compile(r"^\+?[0-9\s\-().]{7,25}$")
_PHONE_DIGITS = re.compile(r"[0-9]")

class AccountCreate(pydantic.BaseModel):
    email: pydantic.EmailStr
    phone: str
    # Enforced here so it is actually applied: the min_length hint on get_password_hash() in
    # src/auth.py is a bare annotation on a plain function and pydantic never evaluates it.
    password: str = pydantic.Field(min_length=8, max_length=128)

    @field_validator("phone")
    @classmethod
    def check_phone(cls, value: str) -> str:
        candidate = value.strip()
        if not _PHONE_ALLOWED.match(candidate):
            raise ValueError("Phone number format is not valid.")
        digits = _PHONE_DIGITS.findall(candidate)
        if not 7 <= len(digits) <= 15:
            raise ValueError("Phone number must contain between 7 and 15 digits.")
        return candidate

class AccountRead(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(from_attributes=True)
    id: str
    has_voted: bool
    created_at: dt.datetime

class RedemptionRead(pydantic.BaseModel):
    """The door-benefit half of the profile.

    `status` is derived server-side from the two account flags, so the frontend never has to
    combine them itself (and cannot get the combination wrong):

        not_eligible  no survey submitted yet — there is no QR code to show
        ready         eligible and unclaimed — `qr_data_uri` is present
        redeemed      already claimed at the door — the QR is withheld
    """
    status: t.Literal["not_eligible", "ready", "redeemed"]
    # The signed value the browser draws as a QR code. Only ever populated for `ready`: an
    # ineligible or already-claimed account is sent no credential at all, rather than one the page
    # is trusted to keep hidden.
    token: t.Optional[str] = None
    redeemed_at: t.Optional[dt.datetime] = None


class RedemptionStatusRead(pydantic.BaseModel):
    """The narrow fallback view, for when the door scanner's own screen fails to confirm a scan.

    Deliberately smaller than the profile: whether the benefit has been claimed, and when. Nothing
    else, and no QR code.
    """
    has_redeemed: bool
    redeemed_at: t.Optional[dt.datetime]


class ProfileRead(pydantic.BaseModel):
    """Everything the profile page is allowed to know about the signed-in account.

    Note what is *not* here: no email or phone (the database only ever holds one-way hashes of
    those, so they cannot be returned even in principle), no password hash and no role.
    """
    # First segment of the account id: enough for a human to quote at the door or to support,
    # without handing out the primary key.
    reference: str
    email_verified: bool
    email_verified_at: t.Optional[dt.datetime]
    has_voted: bool
    created_at: dt.datetime
    redemption: RedemptionRead


class SignupAccepted(pydantic.BaseModel):
    """Deliberately says nothing about whether the account is new, existing or verified."""
    message: str
    expires_in_minutes: int

class VerifyEmailRequest(pydantic.BaseModel):
    email: pydantic.EmailStr
    code: str = pydantic.Field(pattern=r"^\d{6}$")

class ResendCodeRequest(pydantic.BaseModel):
    email: pydantic.EmailStr

class VerificationResponse(pydantic.BaseModel):
    status: str
    message: str

class ResendAccepted(pydantic.BaseModel):
    """Constant response — the cooldown shown to the user is enforced server-side regardless."""
    message: str
    cooldown_seconds: int

class SurveyBase(pydantic.BaseModel):
    """One survey response, and the definition of what a valid answer is.

    Every categorical field is typed as its enum rather than a bare ``str``. That is what makes this
    model the source of truth the admin analytics reads: the dashboard's filters and chart
    categories are derived from these annotations, so the set of answers the API accepts and the set
    the dashboard can report on cannot drift apart.

    The database columns behind these stay ``VARCHAR`` — the values are validated on the way in, not
    pinned by a MySQL ``ENUM`` that would need a migration every time an option is added.
    """
    audience_type: AudienceType
    gender: Gender
    age_range: t.Optional[AgeRange] = None
    interest_level: int = pydantic.Field(ge=SCALE_MIN, le=SCALE_MAX)
    recommend_likelihood: int = pydantic.Field(ge=SCALE_MIN, le=SCALE_MAX)
    ticket_price_range: TicketPriceRange
    # At least one genre: an empty list is not an answer, and it would sit in the analytics as a
    # response that silently counts towards the denominator of every genre.
    genre_preferences: t.List[Genre] = pydantic.Field(min_length=1)
    date_preference: DatePreference
    start_time_preference: StartTimePreference
    group_size: GroupSize
    food_stall_interest: bool
    alcohol_preference: t.Optional[AlcoholPreference] = None
    # Free text, so no enum — and excluded from the analytics catalogue for the same reason it
    # carries a warning in the survey UI: it is small-cardinality and could identify a respondent.
    accommodation_area: t.Optional[str] = pydantic.Field(default=None, max_length=100)
    transport_interest: t.Optional[TransportInterest] = None
    has_student_pass: t.Optional[bool] = None
    open_feedback: t.Optional[str] = pydantic.Field(default=None, max_length=1000)

class SurveyIn(SurveyBase):
    @model_validator(mode="after")
    def check_audience_specific_fields(self):
        if self.audience_type == AudienceType.TOURIST:
            if self.transport_interest is None:
                raise ValueError("Transport interest is required for tourists.")
        elif self.audience_type == AudienceType.STUDENT:
            if self.has_student_pass is None:
                raise ValueError("has_student_pass is required for Students")
        return self

class LoginRequest(pydantic.BaseModel):
    email: pydantic.EmailStr
    password: str

class SurveyOut(SurveyBase):
    id: str
    submitted_at: dt.datetime

class Token(pydantic.BaseModel):
    access_token: str
    token_type: str


# --- Admin dashboard ---------------------------------------------------------------------------
# Read-only views over aggregate data. Nothing here can identify a respondent: the survey table
# holds no account reference, and these models expose counts, never rows.

_FromAttributes = pydantic.ConfigDict(from_attributes=True)


class AdminSessionRead(pydantic.BaseModel):
    """Who the dashboard is talking to.

    The aside shows the role and nothing else, because there is nothing else to show — accounts
    carry no name and no readable email, only one-way hashes.
    """
    role: AccountType
    reference: str


class AdminAccountRead(pydantic.BaseModel):
    """One admin, as far as another admin can see them."""
    reference: str
    created_at: dt.datetime
    email_verified: bool
    is_self: bool


class AdminCreated(pydantic.BaseModel):
    reference: str
    message: str


class AdminPromoteRequest(pydantic.BaseModel):
    """Promote the account that owns this address.

    The address is the only handle an admin has on an existing account — nothing readable is stored,
    so there is no name to pick from a list and no account id to paste. It is matched by hashing it
    with the same peppered function the account was created with; a mismatch simply finds nothing.
    """
    email: pydantic.EmailStr


class AdminPromoted(pydantic.BaseModel):
    # Echoed back so the caller can confirm *which* account they just promoted. It is the only
    # confirmation possible: the address they typed cannot be read back out of the database, so
    # matching this against the admin list is how a wrong-but-registered address gets noticed.
    reference: str
    message: str


class AnalyticsFieldRead(pydantic.BaseModel):
    """One survey question, described well enough for the frontend to build its own controls.

    Derived from the survey model at import time — see src/analytics.py. The frontend renders these
    rather than a list of its own, which is what keeps the dashboard from hardcoding categories.
    """
    model_config = _FromAttributes

    name: str
    kind: t.Literal["single", "multi", "bool", "scale"]
    values: t.List[str]
    optional: bool
    filterable: bool
    minimum: t.Optional[int] = None
    maximum: t.Optional[int] = None


class AnalyticsSchemaRead(pydantic.BaseModel):
    fields: t.List[AnalyticsFieldRead]
    windows: t.List[str]
    default_window: str


class TotalsRead(pydantic.BaseModel):
    model_config = _FromAttributes

    accounts: int
    verified_accounts: int
    voted_accounts: int
    admin_accounts: int
    surveys: int
    redeemed: int
    voted_percentage: float


class SeriesPointRead(pydantic.BaseModel):
    model_config = _FromAttributes

    start: dt.datetime
    end: dt.datetime
    accounts: int
    surveys: int
    accounts_cumulative: int
    surveys_cumulative: int


class OverviewRead(pydantic.BaseModel):
    window: str
    generated_at: dt.datetime
    window_start: dt.datetime
    totals: TotalsRead
    # Arrivals inside the window only, which is what the window control is asking about.
    accounts_in_window: int
    surveys_in_window: int
    series: t.List[SeriesPointRead]


class BucketRead(pydantic.BaseModel):
    model_config = _FromAttributes

    value: str
    count: int


class DistributionRead(pydantic.BaseModel):
    model_config = _FromAttributes

    field: str
    kind: str
    respondents: int
    unanswered: int
    buckets: t.List[BucketRead]
    average: t.Optional[float] = None
    minimum: t.Optional[int] = None
    maximum: t.Optional[int] = None


class BreakdownRead(pydantic.BaseModel):
    window: t.Optional[str]
    generated_at: dt.datetime
    # Responses in the window before any filter, and after — the pair the header needs to say
    # "312 of 1,004 responses".
    total: int
    matched: int
    filters: t.Dict[str, t.List[str]]
    distributions: t.List[DistributionRead]