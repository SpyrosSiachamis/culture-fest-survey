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
    P10_20 = "10-20"
    P20_30 = "20-30"
    P30_40 = "30-40"
    OVER_40 = "over_40"


class Genre(str, enum.Enum):
    GREEK_POP = "greek-pop"
    HIP_HOP = "hip-hop"
    TRAP = "trap"
    RNB = "r&b"
    REGGAETON = "reggaeton"
    HOUSE = "house"
    TECHNO = "techno"
    LAIKO = "laiko"
    ROCK = "rock"


class DatePreference(str, enum.Enum):
    EARLY_SEPTEMBER = "early-september"
    LATE_SEPTEMBER = "late-september"
    WEEKEND_ONLY = "weekend-only"
    ANY = "any"


class StartTimePreference(str, enum.Enum):
    T20 = "20:00"
    T21 = "21:00"
    T22 = "22:00"
    T23_OR_LATER = "23:00_later"


class GroupSize(str, enum.Enum):
    ALONE = "alone"
    G2_3 = "2-3"
    G4_5 = "4-5"
    G6_PLUS = "6_plus"


class AlcoholPreference(str, enum.Enum):
    BEER = "beer"
    WINE = "wine"
    SPIRITS = "spirits"
    NONE = "none"
    NO_PREFERENCE = "no-preference"


class TransportInterest(str, enum.Enum):
    YES = "yes"
    MAYBE = "maybe"
    NO = "no"
