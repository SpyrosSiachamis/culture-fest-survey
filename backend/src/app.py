from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from src.database.session import Base, engine
from src.database import models  # noqa: F401 — registers models on Base
from src.routers import accounts
from src.routers import surveys

#TODO: Drop the database when testing is done, or use a separate test database. This is just for development purposes.

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

@app.get('/health')
def root():
    return {
        "status": "ok",
        "message": "Backend is running"
    }

app.include_router(accounts.router)
app.include_router(surveys.router)