"""The door-redemption credential carried in the user's QR code.

Shape of the system this belongs to:

    vote  -> account becomes eligible (allowed_to_redeem)
    profile -> mints a signed JWT and the browser draws it as a QR code
    door  -> staff scan it from *their own authenticated admin panel*, which calls the redeem
             endpoint; that endpoint flips has_redeemed and stamps redeemed_at

Only the first two steps exist today. This module is the whole of the user-facing half.

Design notes:

* Nothing is stored. The token is derived from data already on the account plus an expiry, and is
  minted fresh on each profile view — there is no image, file or extra secret at rest, and a
  database dump contains no redemption credential to steal.
* It expires when the event does. That is what stops a QR screenshotted this year from being
  presented at next year's festival; the redeem endpoint will additionally refuse to accept any
  code before EVENT_START, since voting opens well before the doors do.
* ``scope`` is what keeps it from being a skeleton key. Without it a redemption JWT — which is
  signed with the same key and carries the same ``account_id`` — would be accepted as a session
  token by ``get_current_user``, so anyone who photographed a QR at the door would own the
  account for the rest of the event. ``get_current_user`` rejects anything scoped "redeem", and
  the redeem endpoint must accept nothing else.
"""

import datetime as dt
import os

import jwt

from src.auth import ALGORITHM, SECRET_KEY
from src.database.models import Account

REDEMPTION_SCOPE = "redeem"

# When the codes stop working. ISO 8601; a naive value is read as UTC. Defaults to 30 days out so
# a stack with no event configured still issues something finite rather than an eternal pass.
_EVENT_END_RAW = os.getenv("EVENT_END", "").strip()


def _event_end() -> dt.datetime:
    if not _EVENT_END_RAW:
        return dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=30)

    parsed = dt.datetime.fromisoformat(_EVENT_END_RAW)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed


def create_redemption_token(account: Account) -> str:
    """Mint the value that goes inside this account's QR code.

    Carries only what the door needs: which account is claiming, that the claim was earned, and
    when the claim dies. No email, no phone, no answers, no session rights.
    """
    payload = {
        "account_id": account.id,
        "voted": True,
        "scope": REDEMPTION_SCOPE,
        "exp": _event_end(),
    }
    return jwt.encode(payload, str(SECRET_KEY), algorithm=str(ALGORITHM))
