from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Dict, Any
from ..database import get_db
from ..models.user import UserCreate, UserInDB

router = APIRouter()

@router.post("/register")
async def register_user(user_data: UserCreate):
    db = get_db()
    
    # Check if user already exists
    existing = await db["users"].find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="User already registered")
        
    # Enforce role logic
    if user_data.role not in ["student", "librarian"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'student' or 'librarian'")
        
    result = await db["users"].insert_one(user_data.model_dump())
    new_user = await db["users"].find_one({"_id": result.inserted_id})
    new_user["_id"] = str(new_user["_id"])
    return new_user

@router.post("/login")
async def login_user(firebase_uid: str = Body(..., embed=True)):
    # This route maps a successful firebase client login to a MongoDB user record and checks their role
    db = get_db()
    user = await db["users"].find_one({"firebase_uid": firebase_uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found in mapping database. Please register.")
        
    user["_id"] = str(user["_id"])
    return user
