from starlette import status
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import update
from sqlalchemy.orm import Session
from src.auth import get_current_verified_user
from src.database.models import Account, SurveyResponse
from src.database.session import get_db
from src.rate_limit import limiter
from src.schemas import SurveyIn

router = APIRouter(prefix = "/surveys", tags = ['surveys'])

@router.post('/submit', status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def submit_survey(
    request: Request,
    payload: SurveyIn,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_verified_user)
):
    # Claim the vote atomically. A plain `if account.has_voted` read followed by a write is a
    # time-of-check/time-of-use race: two concurrent requests on the same account both read
    # has_voted=False and both go on to insert, so one account votes twice. There is no unique
    # constraint to catch that either — survey_responses deliberately stores no account id, for
    # anonymity — so this flag is the *only* thing enforcing one-vote-per-account.
    #
    # Instead, let the database decide the winner: a single UPDATE guarded by `has_voted = False`.
    # MySQL takes a row lock, so of any number of racing requests exactly one sees the row still
    # false and flips it; every other request matches zero rows. rowcount is therefore an
    # authoritative "did I win the claim", with no gap between the check and the write.
    claim = db.execute(
        update(Account)
        .where(Account.id == account.id, Account.has_voted.is_(False))
        .values(has_voted=True, allowed_to_redeem=True, has_redeemed=False)
    )

    if claim.rowcount != 1:
        # Zero rows: this account had already voted (an earlier submission, or a concurrent request
        # that won the race a moment ago). Either way there is nothing to store — roll back the
        # no-op update and report the same 409 as before.
        db.rollback()
        raise HTTPException(status_code=409, detail="Account has already submitted a survey.")

    # Only the request that actually claimed the flag reaches here, so exactly one response row is
    # written per account. mode="json" so the enum members come out as their plain string values:
    # the columns behind these fields are VARCHAR/JSON, and a str-subclass enum handed straight to
    # the driver stringifies as "AgeRange.R18_20" rather than "18-20".
    response = SurveyResponse(**payload.model_dump(mode="json"))
    db.add(response)
    # One commit for the whole claim: the guarded flag update and the anonymous response row land
    # together (and the row lock is only released here), so a failure cannot leave an account marked
    # as voted with no response stored, or let a second claim slip in before the row is written.
    db.commit()
    return {"message": "Survey submitted successfully."}

# @router.get('/responses', status_code=200)
# @limiter.limit("10/minute")
# def get_survey_responses(
#     request: Request,
#     db: Session = Depends(get_db),
#     account: Account = Depends(requires_admin)
# ):
#     if account.role != "admin":
#         raise HTTPException(status_code=403, detail="Access denied. Admins only.")
#     responses = db.query(SurveyResponse).all()
#     return responses