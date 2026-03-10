from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import get_db
from firebase_client import FIREBASE_ERROR, FIREBASE_READY
from routes import auth, books, borrow, chatbot, monitor, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = get_db()
    db.connect(raise_on_error=False)
    if db.connected:
        print("Connected to Firestore")
    else:
        print("Firestore connection failed during startup")
    try:
        yield
    finally:
        db.close()
        print("Firestore connection closed")


app = FastAPI(
    title="Smart Library Management System",
    description="FastAPI backend for Smart Library SaaS",
    version="2.0.0",
    lifespan=lifespan,
)

def _parse_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if not raw:
        return ["*"]
    return [item.strip() for item in raw.split(",") if item.strip()]


cors_origins = _parse_cors_origins()
cors_allow_credentials = os.getenv("CORS_ALLOW_CREDENTIALS", "true").strip().lower() in {"1", "true", "yes"}
if cors_origins == ["*"]:
    # Wildcard with credentials can break CORS headers. Disable credentials for wildcard.
    cors_allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Smart Library API is running",
        "database": "firestore",
        "firebase_ready": FIREBASE_READY,
    }


@app.get("/health")
def health():
    db = get_db()
    return {
        "status": "ok",
        "firestore_connected": db.ping(),
        "firebase_ready": FIREBASE_READY,
        "firebase_error": FIREBASE_ERROR,
        "firestore_error": db.last_error,
    }


for prefix in ("", "/api"):
    app.include_router(auth.router, prefix=prefix)
    app.include_router(books.router, prefix=prefix)
    app.include_router(borrow.router, prefix=prefix)
    app.include_router(users.router, prefix=prefix)
    app.include_router(monitor.router, prefix=prefix)
    app.include_router(chatbot.router, prefix=prefix)
