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
    db.commit()
    response = SurveyResponse(**payload.model_dump())
    db.add(response)
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