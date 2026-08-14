"""Small helpers shared by the test modules."""

import re

from src.database.models import Account
from src.auth import hash_identifier

CODE_PATTERN = re.compile(r"\b(\d{6})\b")

VALID_SIGNUP = {
    "email": "attendee@example.com",
    "phone": "+306912345678",
    "password": "correct-horse-battery",
}

# A complete, valid survey body for the "local" audience (no conditional fields required).
SURVEY_PAYLOAD = {
    "audience_type": "local",
    "gender": "other",
    "age_range": "25-34",
    "interest_level": 8,
    "recommend_likelihood": 9,
    "ticket_price_range": "10-20",
    "genre_preferences": ["rock", "folk"],
    "date_preference": "weekend",
    "start_time_preference": "evening",
    "group_size": "2-3",
    "food_stall_interest": True,
    "alcohol_preference": "beer",
    "open_feedback": "Looking forward to it.",
}


def code_from_email(email: dict[str, str]) -> str:
    """Pull the 6-digit code out of a captured message, the way a recipient would read it."""
    match = CODE_PATTERN.search(email["text"])
    assert match is not None, "No verification code found in the email body"
    return match.group(1)


def signup(client, sent_emails, **overrides) -> tuple[str, dict[str, str]]:
    """Run a signup and return the issued code together with the payload that was used."""
    payload = {**VALID_SIGNUP, **overrides}
    response = client.post("/accounts/signup", json=payload)
    assert response.status_code == 202, response.text
    return code_from_email(sent_emails[-1]), payload


def get_account(db_session, email: str) -> Account | None:
    return (
        db_session.query(Account)
        .filter(Account.email_hash == hash_identifier(email))
        .first()
    )
