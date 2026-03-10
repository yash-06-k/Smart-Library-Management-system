from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth
from ..config import settings
from ..database import get_db

# Mock initialize Firebase if credentials are not provided yet to prevent crashing
try:
    if settings.FIREBASE_CREDENTIALS:
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS)
        firebase_admin.initialize_app(cred)
    else:
        print("WARNING: Starting without Firebase Credentials. Auth will be mocked.")
except ValueError:
    pass # App already initialized

security = HTTPBearer()

async def get_current_user(token: HTTPAuthorizationCredentials = Depends(security)):
    if not settings.FIREBASE_CREDENTIALS:
        # Mock user return for development without Firebase
        return {"uid": "mock-dev-uid", "email": "admin@library.com", "role": "librarian"}

    try:
        decoded_token = auth.verify_id_token(token.credentials)
        # Fetch role from MongoDB database based on uid here
        db = get_db()
        user_doc = await db["users"].find_one({"firebase_uid": decoded_token["uid"]})
        
        if not user_doc:
            raise HTTPException(status_code=401, detail="User not found in system")
            
        return {
            "uid": decoded_token["uid"],
            "email": decoded_token.get("email"),
            "role": user_doc["role"],
            "_id": str(user_doc["_id"])
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid Authentication token")


def require_role(allowed_roles: list):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Not enough privileges")
        return current_user
    return role_checker

async def get_current_librarian(user: dict = Depends(require_role(["librarian"]))):
    return user

async def get_current_student(user: dict = Depends(require_role(["student", "librarian"]))):
    return user
