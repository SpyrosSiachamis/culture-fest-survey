"""The application clock — a single timezone for every stored timestamp.

Every ``created_at``, ``submitted_at``, verification expiry and (in future) ``redeemed_at`` is
written by :func:`now`, and the analytics rolling-window maths reads "now" from the same place. That
one rule is what keeps the numbers honest: if timestamps were stored in one zone and compared
against "now" in another, every window would be silently offset by the difference between them.

Timestamps are stored as **naive local wall-clock time** in ``APP_TIMEZONE`` (Europe/Athens by
default — the festival's own timezone), because that is what staff read off the dashboard and off an
attendee's phone at the door, and MySQL ``DATETIME`` carries no offset of its own anyway. The one
caveat of storing wall-clock time is the hour that repeats when the clocks go back (late October):
a bare ``01:30`` that night is ambiguous. The event runs in September, well clear of it, and the
door-redemption records that matter most are minutes apart, so this is an accepted trade for times
that read correctly without anyone having to convert a zone in their head.

The zone is configurable so the test suite can pin it to UTC and stay deterministic regardless of
where it runs; production leaves it at the default.
"""

import datetime as dt
import os
from zoneinfo import ZoneInfo

APP_TIMEZONE = os.getenv("APP_TIMEZONE", "Europe/Athens")

_zone = ZoneInfo(APP_TIMEZONE)


def zone() -> ZoneInfo:
    return _zone


def now() -> dt.datetime:
    """Current wall-clock time in ``APP_TIMEZONE``, naive, for the naive DATETIME columns.

    Naive on purpose: it is compared against, and stored alongside, other values produced here, all
    in the same zone, so carrying an offset would add nothing but a chance to mix aware and naive
    datetimes and raise.
    """
    return dt.datetime.now(_zone).replace(tzinfo=None)
