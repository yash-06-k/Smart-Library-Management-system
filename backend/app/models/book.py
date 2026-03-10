from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class BookBase(BaseModel):
    title: str
    author: str
    category: str
    isbn: str
    description: str = ""
    total_copies: int = 1
    available_copies: int = 1
    cover_image: Optional[str] = None
    rating: float = 0.0

class BookInDB(BookBase):
    id: str = Field(alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
