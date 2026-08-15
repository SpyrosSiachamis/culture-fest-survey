import pydantic
import re
import typing as t
import datetime as dt
from pydantic import field_validator, model_validator
from src.enums import AudienceType, Gender, AccountType

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
    audience_type: AudienceType
    gender: Gender
    age_range: t.Optional[str] = None
    interest_level: int
    recommend_likelihood: int
    ticket_price_range: str
    genre_preferences: t.List[str]
    date_preference: str
    start_time_preference: str
    group_size: str
    food_stall_interest: bool
    alcohol_preference: t.Optional[str] = None
    accommodation_area: t.Optional[str] = None
    transport_interest: t.Optional[str] = None
    has_student_pass: t.Optional[bool] = None
    open_feedback: t.Optional[str] = None

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