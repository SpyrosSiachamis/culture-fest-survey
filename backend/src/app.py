from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from sqlalchemy import create_engine
from src.database.session import engine
from src.database.models import Base # noqa: F401 — import registers models on Base
from src.routers import accounts
from src.database.session import Base
app = FastAPI()

_allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

@app.get('/')
def root():
    return {
        "message": "Hello World!"
    }

app.include_router(accounts.router)