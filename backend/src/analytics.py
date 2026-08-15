"""Aggregation behind the admin dashboard.

Two rules shape this module.

**No category is written down here.** The list of answer options for every question is derived at
import time by introspecting ``SurveyIn`` — the same pydantic model that validates submissions,
whose categorical fields are typed as the enums in ``src/enums.py``. Add a genre to ``Genre`` and it
becomes a filter, a bar and a row of stats with no edit to this file. The one thing that is *not*
derived is the human-readable label, which lives in the frontend locale files keyed by these same
values, so a category is translated once and used by both the survey and the dashboard.

**Counting happens in Python, not in SQL.** The rows are fetched with the window applied and tallied
here. That keeps one implementation working identically on MySQL and on the SQLite the tests run
against — ``genre_preferences`` is a JSON array, and counting inside it needs dialect-specific
functions. The whole festival is a few thousand responses at the very most, so the cost of loading
them is irrelevant; if that ever stops being true, the distributions are the part to push into SQL.
"""

import datetime as dt
import enum
import types
import typing as t
from dataclasses import dataclass

from annotated_types import Ge, Le
from sqlalchemy import func
from sqlalchemy.orm import Session

from src import clock
from src.database.models import Account, SurveyResponse
from src.enums import AccountType
from src.schemas import SurveyIn

# --- Time windows ------------------------------------------------------------------------------
# Rolling windows measured back from the current server time, not calendar buckets: "last 24 hours"
# means the 24 hours ending now, so the numbers move continuously through the day rather than
# resetting at midnight.
WINDOWS: dict[str, dt.timedelta] = {
    "24h": dt.timedelta(hours=24),
    "3d": dt.timedelta(days=3),
    "7d": dt.timedelta(days=7),
}

DEFAULT_WINDOW = "7d"

# How finely each window is sliced for the time series. Chosen so every window plots a similar
# number of points — enough shape to read a trend, few enough to label.
_BUCKETS: dict[str, int] = {
    "24h": 24,   # hourly
    "3d": 18,    # four-hourly
    "7d": 14,    # twelve-hourly
}


def now() -> dt.datetime:
    """Current time on the application clock, naive.

    The whole point of routing this through :func:`src.clock.now` is that the rolling windows are
    compared against the same clock the ``created_at`` / ``submitted_at`` values were stamped with.
    Read "now" from a different zone than the stored timestamps and every window would be offset by
    the gap between them — which is exactly the error that a bare ``datetime.utcnow()`` here would
    reintroduce now that the columns hold Europe/Athens local time.
    """
    return clock.now()


def window_start(window: str, reference: dt.datetime) -> dt.datetime:
    return reference - WINDOWS[window]


# --- The derived catalogue ---------------------------------------------------------------------

FieldKind = t.Literal["single", "multi", "bool", "scale"]

# Answers to a yes/no question. Stored as a boolean, reported as these two values so a bool field
# tallies through exactly the same path as everything else.
BOOL_VALUES = ("yes", "no")


@dataclass(frozen=True)
class AnalyticsField:
    """One survey question the dashboard can chart and filter on."""

    name: str
    kind: FieldKind
    # Every answer this question accepts, in the order the enum declares them. Empty for scales,
    # which carry ``minimum``/``maximum`` instead.
    values: tuple[str, ...]
    # True when the question may be skipped, which is what puts a "no answer" count on its chart.
    optional: bool
    minimum: int | None = None
    maximum: int | None = None

    @property
    def filterable(self) -> bool:
        """Scales are charted but not filtered — a range control is a different kind of input."""
        return self.kind != "scale"


def _strip_optional(annotation: t.Any) -> tuple[t.Any, bool]:
    """Unwrap ``Optional[X]`` to ``(X, True)``. Anything else comes back unchanged."""
    origin = t.get_origin(annotation)
    if origin is t.Union or origin is types.UnionType:
        args = [arg for arg in t.get_args(annotation) if arg is not type(None)]
        if len(args) == 1:
            return args[0], True
    return annotation, False


def _is_enum(annotation: t.Any) -> bool:
    return isinstance(annotation, type) and issubclass(annotation, enum.Enum)


def _bounds(metadata: list[t.Any]) -> tuple[int | None, int | None]:
    """Read ``ge``/``le`` back off a pydantic field, so the scale bounds are not repeated here."""
    minimum = next((m.ge for m in metadata if isinstance(m, Ge)), None)
    maximum = next((m.le for m in metadata if isinstance(m, Le)), None)
    return minimum, maximum


def _build_catalogue() -> tuple[AnalyticsField, ...]:
    """Walk ``SurveyIn`` and turn every answerable question into a chartable field.

    Free-text fields (``open_feedback``, ``accommodation_area``) fall through unmatched and are
    excluded, which is deliberate on both counts: there is nothing to bucket, and
    ``accommodation_area`` is the one answer the survey itself warns can identify a respondent.
    """
    fields: list[AnalyticsField] = []

    for name, field in SurveyIn.model_fields.items():
        annotation, optional = _strip_optional(field.annotation)
        minimum, maximum = _bounds(list(field.metadata))

        if t.get_origin(annotation) is list:
            (item,) = t.get_args(annotation)
            if _is_enum(item):
                fields.append(
                    AnalyticsField(name, "multi", tuple(m.value for m in item), optional)
                )
        elif _is_enum(annotation):
            fields.append(
                AnalyticsField(name, "single", tuple(m.value for m in annotation), optional)
            )
        elif annotation is bool:
            fields.append(AnalyticsField(name, "bool", BOOL_VALUES, optional))
        elif annotation is int and minimum is not None and maximum is not None:
            fields.append(
                AnalyticsField(name, "scale", (), optional, minimum=minimum, maximum=maximum)
            )

    return tuple(fields)


CATALOGUE: tuple[AnalyticsField, ...] = _build_catalogue()

CATALOGUE_BY_NAME: dict[str, AnalyticsField] = {field.name: field for field in CATALOGUE}

FILTERABLE: tuple[AnalyticsField, ...] = tuple(f for f in CATALOGUE if f.filterable)


# --- Reading answers off a row -----------------------------------------------------------------

def _answer_values(response: SurveyResponse, field: AnalyticsField) -> list[str]:
    """The value(s) this response gave for a field, normalised to strings.

    Returns an empty list for a skipped question. A multi-select returns one entry per choice; a
    boolean returns "yes"/"no"; everything else returns at most one.
    """
    raw = getattr(response, field.name, None)

    if raw is None:
        return []

    if field.kind == "multi":
        # Defensive: the column is JSON, and a hand-edited row could hold something other than a
        # list of strings. Anything unusable is skipped rather than crashing the dashboard.
        if not isinstance(raw, list):
            return []
        return [str(entry) for entry in raw]

    if field.kind == "bool":
        return ["yes" if raw else "no"]

    if isinstance(raw, enum.Enum):
        return [str(raw.value)]

    return [str(raw)]


# --- Filtering ---------------------------------------------------------------------------------

# field name -> the set of values that are acceptable. A field with no entry is unconstrained.
Filters = dict[str, set[str]]


def matches(response: SurveyResponse, filters: Filters) -> bool:
    """Whether a response satisfies every active filter.

    Values within one field are OR-ed (``age_range=18-20&age_range=21-24`` means either), and
    separate fields are AND-ed — the reading of a filter bar that nobody has to be taught. A
    multi-select matches if *any* of its choices is selected.
    """
    for name, allowed in filters.items():
        if not allowed:
            continue
        if not set(_answer_values(response, CATALOGUE_BY_NAME[name])) & allowed:
            return False
    return True


class FilterError(ValueError):
    """A filter naming a field or a value that is not in the catalogue."""


def parse_filters(raw: t.Iterable[tuple[str, str]], reserved: t.Container[str] = ()) -> Filters:
    """Turn repeated query parameters into a validated filter set.

    Validated against the catalogue rather than a second hand-written list, so an unknown field or
    an unknown value is rejected by the same definition that produced the filter controls. Rejecting
    loudly matters: silently ignoring a typo would show the admin a filtered-looking chart that was
    not actually filtered.
    """
    filters: Filters = {}

    for key, value in raw:
        if key in reserved:
            continue

        field = CATALOGUE_BY_NAME.get(key)
        if field is None or not field.filterable:
            raise FilterError(f"Unknown filter: {key}")
        if value not in field.values:
            raise FilterError(f"Unknown value for {key}: {value}")

        filters.setdefault(key, set()).add(value)

    return filters


# --- Results -----------------------------------------------------------------------------------

@dataclass
class Bucket:
    value: str
    count: int


@dataclass
class Distribution:
    field: str
    kind: FieldKind
    # Responses this distribution was computed over — the denominator for a percentage. Note that
    # for a multi-select the bucket counts can sum to more than this, because one response picks
    # several.
    respondents: int
    # Responses that skipped the question. Only ever non-zero for an optional field.
    unanswered: int
    buckets: list[Bucket]
    average: float | None = None
    minimum: int | None = None
    maximum: int | None = None


@dataclass
class Totals:
    accounts: int
    verified_accounts: int
    voted_accounts: int
    admin_accounts: int
    surveys: int
    redeemed: int
    # Share of all accounts that have submitted a survey, as a percentage to one decimal place.
    voted_percentage: float


@dataclass
class SeriesPoint:
    start: dt.datetime
    end: dt.datetime
    accounts: int
    surveys: int
    # Platform-wide running totals as of the end of this bucket, including everything before the
    # window opened. This is the "how many does the platform have" line; the two above are the
    # per-bucket arrivals behind it.
    accounts_cumulative: int
    surveys_cumulative: int


def _percentage(part: int, whole: int) -> float:
    return round(part / whole * 100, 1) if whole else 0.0


def platform_totals(db: Session) -> Totals:
    """All-time counts. Never windowed: this is the size of the platform, not recent activity."""
    accounts = db.query(func.count(Account.id)).scalar() or 0
    # Counted from the survey_responses table, not from accounts.has_voted: a survey is a completed
    # submission that actually landed, and the two could differ if a write ever half-failed.
    surveys = db.query(func.count(SurveyResponse.id)).scalar() or 0

    verified = (
        db.query(func.count(Account.id)).filter(Account.email_verified_at.isnot(None)).scalar() or 0
    )
    voted = db.query(func.count(Account.id)).filter(Account.has_voted.is_(True)).scalar() or 0
    redeemed = db.query(func.count(Account.id)).filter(Account.has_redeemed.is_(True)).scalar() or 0
    admins = (
        db.query(func.count(Account.id)).filter(Account.role == AccountType.ADMIN).scalar() or 0
    )

    return Totals(
        accounts=accounts,
        verified_accounts=verified,
        voted_accounts=voted,
        admin_accounts=admins,
        surveys=surveys,
        redeemed=redeemed,
        voted_percentage=_percentage(voted, accounts),
    )


def time_series(db: Session, window: str, reference: dt.datetime) -> list[SeriesPoint]:
    """Signups and submissions bucketed across the window, with running platform totals."""
    start = window_start(window, reference)
    count = _BUCKETS[window]
    step = (reference - start) / count

    account_times: list[dt.datetime] = [
        row[0]
        for row in db.query(Account.created_at).filter(Account.created_at >= start).all()
        if row[0] is not None
    ]
    survey_times: list[dt.datetime] = [
        row[0]
        for row in db.query(SurveyResponse.submitted_at)
        .filter(SurveyResponse.submitted_at >= start)
        .all()
        if row[0] is not None
    ]

    # Everything that already existed when the window opened, so the cumulative line starts at the
    # real platform size instead of at zero.
    accounts_running = (
        db.query(func.count(Account.id)).filter(Account.created_at < start).scalar() or 0
    )
    surveys_running = (
        db.query(func.count(SurveyResponse.id))
        .filter(SurveyResponse.submitted_at < start)
        .scalar()
        or 0
    )

    points: list[SeriesPoint] = []
    for index in range(count):
        bucket_start = start + step * index
        # The final bucket ends exactly at `reference` rather than at a rounded boundary, so nothing
        # that arrived in the last few seconds falls outside the chart.
        bucket_end = reference if index == count - 1 else start + step * (index + 1)

        accounts = sum(1 for stamp in account_times if bucket_start <= stamp < bucket_end)
        surveys = sum(1 for stamp in survey_times if bucket_start <= stamp < bucket_end)

        if index == count - 1:
            # Half-open everywhere else; closed at the very end for the same reason.
            accounts += sum(1 for stamp in account_times if stamp == bucket_end)
            surveys += sum(1 for stamp in survey_times if stamp == bucket_end)

        accounts_running += accounts
        surveys_running += surveys

        points.append(
            SeriesPoint(
                start=bucket_start,
                end=bucket_end,
                accounts=accounts,
                surveys=surveys,
                accounts_cumulative=accounts_running,
                surveys_cumulative=surveys_running,
            )
        )

    return points


def responses_in_window(
    db: Session, window: str | None, reference: dt.datetime
) -> list[SurveyResponse]:
    query = db.query(SurveyResponse)
    if window is not None:
        query = query.filter(SurveyResponse.submitted_at >= window_start(window, reference))
    return query.all()


def distributions(responses: list[SurveyResponse]) -> list[Distribution]:
    """Count every catalogue field across the given responses.

    Declared categories always appear, at zero if nobody picked them — an option with no takers is a
    finding, and dropping it would quietly rewrite the question. Any value found in the data that
    the catalogue does not know about is appended after them rather than discarded, so a legacy row
    written before an option was renamed still shows up in the totals instead of vanishing.
    """
    results: list[Distribution] = []

    for field in CATALOGUE:
        counts: dict[str, int] = {value: 0 for value in field.values}
        unanswered = 0
        scale_total = 0
        scale_count = 0

        for response in responses:
            answers = _answer_values(response, field)
            if not answers:
                unanswered += 1
                continue

            for answer in answers:
                counts[answer] = counts.get(answer, 0) + 1

            if field.kind == "scale":
                scale_total += int(answers[0])
                scale_count += 1

        if field.kind == "scale":
            # A scale has no declared value list, so its buckets are the scores actually recorded,
            # padded across the full 1-10 range in order.
            assert field.minimum is not None and field.maximum is not None
            buckets = [
                Bucket(value=str(score), count=counts.get(str(score), 0))
                for score in range(field.minimum, field.maximum + 1)
            ]
            average = round(scale_total / scale_count, 2) if scale_count else None
        else:
            buckets = [Bucket(value=value, count=count) for value, count in counts.items()]
            average = None

        results.append(
            Distribution(
                field=field.name,
                kind=field.kind,
                respondents=len(responses) - unanswered,
                unanswered=unanswered,
                buckets=buckets,
                average=average,
                minimum=field.minimum,
                maximum=field.maximum,
            )
        )

    return results
