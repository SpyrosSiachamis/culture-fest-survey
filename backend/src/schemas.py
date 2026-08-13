import pydantic
import typing as t
import datetime as dt
from pydantic import model_validator
from src.enums import AudienceType, Gender, AccountType

class AccountCreate(pydantic.BaseModel):
    email: pydantic.EmailStr
    phone: str
    password: str

class AccountRead(pydantic.BaseModel):
    id: int
    has_voted: bool
    created_at: dt.datetime

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

class SurveyOut(SurveyBase):
    id: str
    submitted_at: dt.datetime