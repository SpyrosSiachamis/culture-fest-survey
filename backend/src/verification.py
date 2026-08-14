"""Generation, storage and checking of the 6-digit email verification codes.

All of the security-relevant decisions for the verification flow live here:

* codes are generated with :mod:`secrets`, never :mod:`random`;
* only an HMAC-SHA256 digest of a code is ever persisted, keyed with the server-side ``PEPPER``;
* digests are compared with :func:`hmac.compare_digest`;
* codes expire, are single-use, and are capped both in verification attempts and in resends.

Nothing in this module logs a code.
"""

import datetime as dt
import enum
import hashlib
import hmac
import os
import secrets

from sqlalchemy.orm import Session

from src.auth import PEPPER
from src.database.models import Account, EmailVerificationCode

CODE_TTL_MINUTES = int(os.getenv("VERIFICATION_CODE_TTL_MINUTES", "15"))
MAX_ATTEMPTS = int(os.getenv("VERIFICATION_MAX_ATTEMPTS", "5"))
RESEND_COOLDOWN_SECONDS = int(os.getenv("VERIFICATION_RESEND_COOLDOWN_SECONDS", "60"))
MAX_RESENDS = int(os.getenv("VERIFICATION_MAX_RESENDS", "5"))

CODE_DIGITS = 6


class VerificationOutcome(str, enum.Enum):
    """Result of checking a submitted code. Maps 1:1 onto the states the UI renders."""

    VERIFIED = "verified"
    INVALID = "invalid"
    EXPIRED = "expired"
    TOO_MANY_ATTEMPTS = "too_many_attempts"
    ALREADY_VERIFIED = "already_verified"


class ResendOutcome(str, enum.Enum):
    """Result of asking for a new code. Never surfaced verbatim to the client — see the router."""

    SENT = "sent"
    COOLDOWN = "cooldown"
    MAX_RESENDS_REACHED = "max_resends_reached"
    ALREADY_VERIFIED = "already_verified"


def utcnow() -> dt.datetime:
    """Timezone-naive UTC 'now', matching how MySQL DATETIME columns are stored."""
    return dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)


def generate_code() -> str:
    """A cryptographically secure 6-digit code, zero-padded so every code has the same length."""
    return f"{secrets.randbelow(10 ** CODE_DIGITS):0{CODE_DIGITS}d}"


def hash_code(code: str, account_id: str) -> str:
    """Keyed digest of a code.

    HMAC with the server-side pepper rather than a bare hash: a 6-digit code has only a million
    possible values, so an unkeyed digest could be reversed instantly from a stolen database. The
    pepper never leaves the environment. Binding the digest to the account id stops one precomputed
    table from being reused across accounts.
    """
    message = f"{account_id}:{code}".encode()
    return hmac.new(str(PEPPER).encode(), message, hashlib.sha256).hexdigest()


def _matches(code: str, account_id: str, stored_hash: str) -> bool:
    """Constant-time comparison, so failures leak no information through timing."""
    return hmac.compare_digest(hash_code(code, account_id), stored_hash)


def _new_record(account_id: str, code: str, resend_count: int) -> EmailVerificationCode:
    now = utcnow()
    return EmailVerificationCode(
        account_id=account_id,
        code_hash=hash_code(code, account_id),
        expires_at=now + dt.timedelta(minutes=CODE_TTL_MINUTES),
        attempts=0,
        last_sent_at=now,
        resend_count=resend_count,
    )


def _get_record(db: Session, account_id: str) -> EmailVerificationCode | None:
    return (
        db.query(EmailVerificationCode)
        .filter(EmailVerificationCode.account_id == account_id)
        .first()
    )


def issue_code(db: Session, account: Account) -> str:
    """Issue a fresh code for a new signup, discarding any code already in flight.

    Used by the signup path only, where the cooldown does not apply — the resend endpoint is
    rate limited separately and enforces its own cooldown.
    """
    existing = _get_record(db, account.id)
    if existing is not None:
        db.delete(existing)
        db.flush()

    code = generate_code()
    db.add(_new_record(account.id, code, resend_count=0))
    db.commit()
    return code


def resend_code(db: Session, account: Account) -> tuple[str | None, ResendOutcome]:
    """Issue a replacement code, subject to the cooldown and the per-signup resend cap.

    Returns ``(None, reason)`` when no code should be sent. The caller must not tell the client
    which reason applied — doing so would confirm that the address has an account.
    """
    if account.email_verified_at is not None:
        return None, ResendOutcome.ALREADY_VERIFIED

    existing = _get_record(db, account.id)

    if existing is not None:
        elapsed = (utcnow() - existing.last_sent_at).total_seconds()
        if elapsed < RESEND_COOLDOWN_SECONDS:
            return None, ResendOutcome.COOLDOWN
        if existing.resend_count >= MAX_RESENDS:
            return None, ResendOutcome.MAX_RESENDS_REACHED

    # A replacement code invalidates the previous one: the old digest is gone, and the attempt
    # counter resets along with it.
    resend_count = existing.resend_count + 1 if existing is not None else 1
    if existing is not None:
        db.delete(existing)
        db.flush()

    code = generate_code()
    db.add(_new_record(account.id, code, resend_count=resend_count))
    db.commit()
    return code, ResendOutcome.SENT


def consume_code(db: Session, account: Account, submitted_code: str) -> VerificationOutcome:
    """Check a submitted code and, on success, verify the account and destroy the code.

    A code is single-use: the row is deleted the moment it succeeds, so replaying it can never
    succeed a second time. The row is also deleted when it expires or runs out of attempts, so an
    exhausted code cannot be retried without a fresh resend.
    """
    if account.email_verified_at is not None:
        return VerificationOutcome.ALREADY_VERIFIED

    record = _get_record(db, account.id)
    if record is None:
        return VerificationOutcome.INVALID

    if record.expires_at <= utcnow():
        db.delete(record)
        db.commit()
        return VerificationOutcome.EXPIRED

    if record.attempts >= MAX_ATTEMPTS:
        db.delete(record)
        db.commit()
        return VerificationOutcome.TOO_MANY_ATTEMPTS

    if not _matches(submitted_code, account.id, record.code_hash):
        record.attempts += 1
        if record.attempts >= MAX_ATTEMPTS:
            db.delete(record)
            db.commit()
            return VerificationOutcome.TOO_MANY_ATTEMPTS
        db.commit()
        return VerificationOutcome.INVALID

    account.email_verified_at = utcnow()
    db.delete(record)
    db.commit()
    return VerificationOutcome.VERIFIED
