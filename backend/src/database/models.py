import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, JSON, SmallInteger, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column
from src import clock
from src.database.session import Base
from src.enums import AudienceType, Gender, AccountType

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

    # used for historical tracking of the account's creation time, useful for analytics and auditing
    # purposes. Set by the application clock (src/clock.py) rather than the database, so every
    # timestamp in the system comes from one timezone — see the note there.
    created_at: Mapped[datetime] = mapped_column(default=clock.now)

    # used to track the type of account
    role: Mapped[AccountType] = mapped_column(SAEnum(AccountType), default=AccountType.USER)

    # Set once the account holder has proven control of the email address they signed up with.
    # NULL means the account is still pending verification: it cannot log in and cannot vote.
    # Only the timestamp is kept here — every piece of *temporary* verification state (the code
    # itself, expiry, attempt counters) lives in EmailVerificationCode below.
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, default=None)

    # --- Door redemption -----------------------------------------------------------------------
    # Three columns that together form the whole state machine for claiming the benefit at the
    # door. They deliberately say nothing about *what* was answered — only that this account has
    # earned a claim, and whether the claim has been used:
    #
    #   new account            allowed_to_redeem = False, has_redeemed = False
    #   after survey submit    allowed_to_redeem = True,  has_redeemed = False
    #   after the door scan    allowed_to_redeem = True,  has_redeemed = True
    #
    # has_voted already records eligibility, but it is the *voting* flag: keeping redemption on its
    # own column means a future reset of one does not silently reset the other.
    #
    # Like has_voted, these are facts about the account and nothing else. Nothing here is written
    # to survey_responses and nothing in survey_responses points back here, so the anonymity of the
    # answers is untouched by any of it.
    allowed_to_redeem: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    has_redeemed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Stamped by the door scan, alongside has_redeemed. The user-facing redemption-status page
    # shows it back so somebody whose scan appeared to fail can confirm what actually happened.
    # When the scanner is built it must stamp this with clock.now(), like every other timestamp.
    redeemed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, default=None)

    # Note: the QR credential itself is deliberately NOT a column. It is a short-lived signed JWT
    # minted on demand from what is already here (see src/redemption.py), so there is no extra
    # secret at rest and nothing to leak from a database dump.


# One row per account with a verification code in flight. The plaintext code is NEVER stored:
# only an HMAC-SHA256 digest keyed with the server-side PEPPER (see src/verification.py). A bare
# hash would be useless here — a 6-digit code has only 10^6 possible values, so anyone with a copy
# of this table could brute-force it in milliseconds. The pepper lives exclusively in the
# environment, so a database dump on its own reveals nothing.
class EmailVerificationCode(Base):
    __tablename__ = "email_verification_codes"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # unique: at most one live code per account, so issuing a new code implicitly invalidates the
    # previous one. Cascade keeps codes from outliving the account they belong to.
    account_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Incremented on every failed verification attempt. Once it reaches the configured maximum the
    # row is deleted, forcing the user to request a fresh code.
    attempts: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)

    # Drives the resend cooldown — a new code cannot be sent until the cooldown has elapsed.
    last_sent_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Caps how many times a single pending signup can request a new code.
    resend_count: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(default=clock.now)

    __table_args__ = (
        Index("ix_email_verification_codes_expires_at", "expires_at"),
    )


# The survey responses do not store any account identifiers or personal information to ensure anonymity. The survey responses are linked to the survey_id and contain demographic information about the respondent, such as audience type and gender. The way anonimity is achieved is by using the has_voted field in the account model prior to the survey being taken. A 2nd mechanism being discussed is using hashed emails and passwords so if 1 of those appears in the system when a new account is made, the system rejects account creation effectively preventing multiple survey responses from the same user.
class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
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
    submitted_at: Mapped[datetime] = mapped_column(default=clock.now)