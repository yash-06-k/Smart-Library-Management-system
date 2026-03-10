from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    name: str
    email: str
    role: str # 'student' or 'librarian'

class UserCreate(UserBase):
    firebase_uid: str

class UserInDB(UserBase):
    id: str = Field(alias="_id")
    firebase_uid: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
