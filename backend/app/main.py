import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import lifespan

from .routes import auth, books, borrow, admin, chatbot

app = FastAPI(
    title="Smart Library Management System",
    description="Backend API for the Smart Library System integrating MongoDB, Firebase Auth, and OpenAI.",
    version="1.0.0",
    lifespan=lifespan
)

# Allow React frontend to connect
def _parse_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if not raw:
        return ["*"]
    return [item.strip() for item in raw.split(",") if item.strip()]


cors_origins = _parse_cors_origins()
cors_allow_credentials = os.getenv("CORS_ALLOW_CREDENTIALS", "true").strip().lower() in {"1", "true", "yes"}
if cors_origins == ["*"]:
    cors_allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,  # In production, set CORS_ORIGINS env var
    allow_credentials=cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "ok", "message": "Smart Library API is running"}

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(books.router, prefix="/api/books", tags=["Books"])
app.include_router(borrow.router, prefix="/api/borrow", tags=["Borrow"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(chatbot.router, prefix="/api/chatbot", tags=["AI Chatbot"])
