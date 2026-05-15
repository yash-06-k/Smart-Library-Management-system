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
    def _normalize_origin(value: str) -> str:
        normalized = value.strip().strip('"').strip("'")
        if normalized != "*" and normalized.endswith("/"):
            normalized = normalized[:-1]
        return normalized

    raw = os.getenv("CORS_ORIGINS", "").strip()
    if not raw:
        # Default: allow common development and production origins
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "https://smart-library-management-system-fpa.vercel.app",
            "https://smart-library-management-system-beta.vercel.app",
            "https://*.vercel.app",
        ]
    parsed = [_normalize_origin(item) for item in raw.split(",") if item.strip()]
    if "*" in parsed:
        return ["*"]
    return parsed


cors_origins = _parse_cors_origins()
cors_origin_regex = os.getenv(
    "CORS_ORIGIN_REGEX",
    r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
).strip()
cors_allow_credentials = os.getenv("CORS_ALLOW_CREDENTIALS", "true").strip().lower() in {"1", "true", "yes"}
if cors_origins == ["*"]:
    # Wildcard with credentials can break CORS headers. Disable credentials for wildcard.
    cors_allow_credentials = False
    cors_origin_regex = ""

# Add compression middleware for performance
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex or None,
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
