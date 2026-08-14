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