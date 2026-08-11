import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, JSON, SmallInteger, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column
from src.database.session import Base

class AudienceType(str, enum.Enum):
    STUDENT = "student"
    TOURIST = "tourist"
    LOCAL = "local"

class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"

class AccountType(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"

class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # The following fields are used to differentiate between accounts. If a user tries to create an account with the same email or phone number, the system will reject it. This is to prevent multiple accounts from being created by the same user and to maintain the integrity of the voting process.
    # Hashed email address or phone number, users can login with it but is not stored in plaintext for anonymity and security reasons
    email_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    # Hashed phone number, users can login with it but is not stored in plaintext for anonymity and security reasons
    phone_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    hashed_password: Mapped[str] = mapped_column(String(255))

    # has_voted indicates whether the user has voted in the current voting period. This is used to prevent multiple votes from the same user and to keep track of their voting status without exposing their identity.
    has_voted: Mapped[bool] = mapped_column(Boolean, default=False)

    # used for historical tracking of the account's creation time, useful for analytics and auditing purposes
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # used to track the type of account
    role: Mapped[AccountType] = mapped_column(SAEnum(AccountType), default=AccountType.USER)

# The survey responses do not store any account identifiers or personal information to ensure anonymity. The survey responses are linked to the survey_id and contain demographic information about the respondent, such as audience type and gender. The way anonimity is achieved is by using the has_voted field in the account model prior to the survey being taken. A 2nd mechanism being discussed is using hashed emails and passwords so if 1 of those appears in the system when a new account is made, the system rejects account creation effectively preventing multiple survey responses from the same user.
class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # The type of audience the survey response is from (student, tourist, local)
    audience_type: Mapped[AudienceType] = mapped_column(SAEnum(AudienceType), nullable=False)

    # The gender of the respondent (male, female, other)
    gender: Mapped[Gender] = mapped_column(SAEnum(Gender), nullable=False)

    # --- Always present ---
    audience_type: Mapped[AudienceType] = mapped_column(SAEnum(AudienceType))
    gender: Mapped[Gender] = mapped_column(SAEnum(Gender))
    age_range: Mapped[Optional[str]] = mapped_column(String(20))

    interest_level: Mapped[int] = mapped_column(SmallInteger)          # 1-10
    recommend_likelihood: Mapped[int] = mapped_column(SmallInteger)    # 1-10

    ticket_price_range: Mapped[str] = mapped_column(String(20))        # e.g. "10-20"
    genre_preferences: Mapped[list] = mapped_column(JSON)              # multi-select
    date_preference: Mapped[str] = mapped_column(String(50))
    start_time_preference: Mapped[str] = mapped_column(String(50))
    group_size: Mapped[str] = mapped_column(String(20))                # e.g. "2-3"

    food_stall_interest: Mapped[bool] = mapped_column(Boolean)
    alcohol_preference: Mapped[Optional[str]] = mapped_column(String(50))

    # --- Tourist only (NULL for student/local) ---
    transport_interest: Mapped[Optional[str]] = mapped_column(String(10))  # yes/no/maybe
    # Optional — tourist only. Disclosed to respondent as reducing anonymity
    # for this response if filled in (small-cardinality field).
    accommodation_area: Mapped[Optional[str]] = mapped_column(String(100))

    # --- Student only (NULL for tourist/local) ---
    has_student_pass: Mapped[Optional[bool]] = mapped_column(Boolean)

    open_feedback: Mapped[Optional[str]] = mapped_column(Text)
    submitted_at: Mapped[datetime] = mapped_column(server_default=func.now())