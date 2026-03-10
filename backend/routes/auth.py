from datetime import datetime

from fastapi import APIRouter, HTTPException

from database import doc_to_dict, get_db, serialize_document
from models.schemas import LoginRequest, SignupRequest

router = APIRouter(tags=["Auth"])


@router.post("/signup")
def signup(payload: SignupRequest):
    db = get_db()

    user_document = {
        "name": payload.name.strip(),
        "email": payload.email.strip().lower(),
        "role": payload.role,
        "firebase_uid": payload.firebase_uid.strip(),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    firebase_uid = user_document["firebase_uid"]
    user_ref = db.users.document(firebase_uid)
    existing_snapshot = user_ref.get()

    if existing_snapshot.exists:
        user_ref.set(
            {
                "name": user_document["name"],
                "email": user_document["email"],
                "role": user_document["role"],
                "firebase_uid": firebase_uid,
                "updated_at": datetime.utcnow(),
            },
            merge=True,
        )
        refreshed = doc_to_dict(user_ref.get())
        return serialize_document(refreshed)

    email_matches = list(db.users.where("email", "==", user_document["email"]).limit(1).stream())
    if email_matches:
        raise HTTPException(status_code=400, detail="User already exists")

    user_ref.set(user_document)
    created = doc_to_dict(user_ref.get())
    return serialize_document(created)


@router.post("/login")
def login(payload: LoginRequest):
    db = get_db()

    user = None
    if payload.firebase_uid:
        snapshot = db.users.document(payload.firebase_uid.strip()).get()
        user = doc_to_dict(snapshot)

    if not user and payload.email:
        matches = list(db.users.where("email", "==", payload.email.strip().lower()).limit(1).stream())
        if matches:
            user = doc_to_dict(matches[0])

    if not user and payload.firebase_uid and payload.email:
        fallback_name = payload.email.split("@")[0].replace(".", " ").title() or "Student"
        user_document = {
            "name": fallback_name,
            "email": payload.email.strip().lower(),
            "role": "student",
            "firebase_uid": payload.firebase_uid.strip(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        user_ref = db.users.document(user_document["firebase_uid"])
        user_ref.set(user_document)
        created = doc_to_dict(user_ref.get())
        return serialize_document(created)

    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please signup first")

    return serialize_document(user)
