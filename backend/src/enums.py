"""Closed sets of values the application recognises.

These are the single source of truth for every categorical survey answer. The survey UI offers
exactly these options, ``SurveyIn`` accepts exactly these values, and the admin analytics derives
its filters and chart categories from them by introspection (see ``src/analytics.py``) — so adding
an option here makes it appear in the dashboard with no further change, and no list of categories
is ever written down twice.

Everything is a ``str`` enum because the values are stored in ``VARCHAR`` columns and travel over
JSON as plain strings. The member *names* are internal; the *values* are the contract, and changing
one is a data migration.

Human-readable labels deliberately live nowhere near here — they are in the frontend locale files,
keyed by the same values, so a category is translated once for both the survey and the dashboard.
"""

import enum


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


class AgeRange(str, enum.Enum):
    R18_20 = "18-20"
    R21_24 = "21-24"
    R25_29 = "25-29"
    R30_PLUS = "30_plus"


class TicketPriceRange(str, enum.Enum):
    """Four €10-wide bands. Deliberately no open-ended top bucket: an "over X" answer cannot be
    averaged or compared against the others, and the client caps expectations at €50."""

    P10_20 = "10-20"
    P20_30 = "20-30"
    P30_40 = "30-40"
    P40_50 = "40-50"


class DatePreference(str, enum.Enum):
    """The three candidate windows the event may run in, plus a genuine "any date works" answer.

    ``ANY`` is a real preference, not a skipped question: it says the respondent is happy with all
    three windows, which is different information from no answer at all. ``date_preference`` is
    therefore still required — the field has no ``None`` to fall back to.
    """

    SEP_24_27 = "sep-24-27"
    SEP_28_OCT_1 = "sep-28-oct-1"
    OCT_2_7 = "oct-2-7"
    ANY = "any"


class GroupSize(str, enum.Enum):
    ALONE = "alone"
    G2_3 = "2-3"
    G4_5 = "4-5"
    G6_PLUS = "6_plus"


class TransportInterest(str, enum.Enum):
    YES = "yes"
    MAYBE = "maybe"
    NO = "no"
