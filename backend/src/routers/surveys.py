from http.client import HTTPResponse
from starlette import status
from fastapi import APIRouter, Depends, HTTPException, Request
from urllib3 import HTTPResponse
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
    if account.has_voted:
        raise HTTPException(status_code=409, detail="Account has already submitted a survey.")

    account.has_voted = True
    # Submitting is what earns the benefit at the door. The claim starts unused, and the QR token
    # behind it is minted lazily the first time the profile is opened, so an account that never
    # looks at its pass never has a credential sitting in the database.
    account.allowed_to_redeem = True
    account.has_redeemed = False

    # mode="json" so the enum members come out as their plain string values. The columns behind
    # these fields are VARCHAR/JSON, and a str-subclass enum handed straight to the driver stringifies
    # as "AgeRange.R18_20" rather than "18-20".
    response = SurveyResponse(**payload.model_dump(mode="json"))
    db.add(response)
    # One commit for both: the flag on the account and the anonymous response row land together, so
    # a failure cannot leave an account marked as voted with no response stored (or the reverse).
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