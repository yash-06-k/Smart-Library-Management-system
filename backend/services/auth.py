from typing import Callable
import os

from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from database import doc_to_dict, get_db
from firebase_client import FIREBASE_READY, get_firebase_auth


bearer_scheme = HTTPBearer(auto_error=False)

PUBLIC_API = os.getenv("PUBLIC_API", "").strip().lower() in {"1", "true", "yes"}
PUBLIC_API_ROLE = os.getenv("PUBLIC_API_ROLE", "student").strip().lower()


def _public_user() -> dict:
    role = "librarian" if PUBLIC_API_ROLE == "librarian" else "student"
    return {
        "_id": "public-user",
        "name": "Public User",
        "email": "public@library.local",
        "role": role,
        "firebase_uid": "public-user",
    }




def _find_user_by_firebase_uid(firebase_uid: str):
    db = get_db()
    snapshot = db.users.document(firebase_uid).get()
    return doc_to_dict(snapshot)


def _resolve_firebase_uid(
    credentials: HTTPAuthorizationCredentials | None,
    x_firebase_uid: str | None,
) -> tuple[str | None, str | None]:
    email = None

    if credentials:
        if FIREBASE_READY:
            try:
                decoded = get_firebase_auth().verify_id_token(credentials.credentials)
                return decoded.get("uid"), decoded.get("email")
            except Exception as exc:
                raise HTTPException(status_code=401, detail="Invalid Firebase token") from exc

        if x_firebase_uid:
            return x_firebase_uid, None

    return x_firebase_uid, email


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_firebase_uid: str | None = Header(default=None, alias="X-Firebase-UID"),
) -> dict:
    if PUBLIC_API and not credentials and not x_firebase_uid:
        return _public_user()

    firebase_uid, token_email = _resolve_firebase_uid(credentials, x_firebase_uid)
    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Authentication required")

    user = _find_user_by_firebase_uid(firebase_uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please complete signup first")

    return {
        "_id": str(user["_id"]),
        "name": user.get("name", ""),
        "email": token_email or user.get("email", ""),
        "role": user.get("role", "student"),
        "firebase_uid": firebase_uid,
    }


def require_role(allowed_roles: list[str]) -> Callable:
    async def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

    return role_checker


async def get_current_student(user: dict = Depends(require_role(["student", "librarian"]))) -> dict:
    return user


async def get_current_librarian(user: dict = Depends(require_role(["librarian"]))) -> dict:
    return user
