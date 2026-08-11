import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, JSON, SmallInteger, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column
from src.database.session import Base

class IdentifierType(str, enum.Enum):
    EMAIL = "email"
    PHONE_NUMBER = "phone_number"

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

    # Hashed email address or phone number, users can login with it but is not stored in plaintext for anonymity and security reasons
    identifier_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    
    # The type of identifier used for the account (email or phone number)
    identifier_type: Mapped[IdentifierType] = mapped_column(SAEnum(IdentifierType), nullable=False)

    hashed_password: Mapped[str] = mapped_column(String(255))

    # has_voted indicates whether the user has voted in the current voting period. This is used to prevent multiple votes from the same user and to keep track of their voting status without exposing their identity.
    has_voted: Mapped[bool] = mapped_column(Boolean, default=False)

    # used for historical tracking of the account's creation time, useful for analytics and auditing purposes
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # used to track the type of account
    role: Mapped[AccountType] = mapped_column(SAEnum(AccountType), default=AccountType.USER)
