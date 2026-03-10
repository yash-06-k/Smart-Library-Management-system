import json
import os

from pathlib import Path

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, firestore


load_dotenv(Path(__file__).resolve().parent / ".env")

FIREBASE_CREDENTIALS = os.getenv("FIREBASE_CREDENTIALS", "").strip()
FIREBASE_READY = False
FIREBASE_ERROR: str | None = None


def _initialize_firebase() -> None:
    global FIREBASE_READY, FIREBASE_ERROR

    if firebase_admin._apps:
        FIREBASE_READY = True
        FIREBASE_ERROR = None
        return

    if not FIREBASE_CREDENTIALS:
        FIREBASE_READY = False
        FIREBASE_ERROR = "FIREBASE_CREDENTIALS is not set"
        return

    try:
        if FIREBASE_CREDENTIALS.startswith("{"):
            credential_payload = json.loads(FIREBASE_CREDENTIALS)
            cred = credentials.Certificate(credential_payload)
        else:
            cred = credentials.Certificate(FIREBASE_CREDENTIALS)

        firebase_admin.initialize_app(cred)
        FIREBASE_READY = True
        FIREBASE_ERROR = None
    except Exception as exc:
        FIREBASE_READY = False
        FIREBASE_ERROR = str(exc)


_initialize_firebase()


def ensure_firebase() -> None:
    if not FIREBASE_READY:
        detail = FIREBASE_ERROR or "Firebase is not initialized"
        raise RuntimeError(detail)


def get_firestore_client():
    ensure_firebase()
    return firestore.client()


def get_firebase_auth():
    ensure_firebase()
    return firebase_auth
