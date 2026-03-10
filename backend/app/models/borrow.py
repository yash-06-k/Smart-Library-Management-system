from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class BorrowBase(BaseModel):
    student_id: str
    book_id: str
    issue_date: datetime = Field(default_factory=datetime.utcnow)
    due_date: datetime
    return_date: Optional[datetime] = None
    status: str = "Borrowed" # 'Requested', 'Borrowed', 'Returned', 'Overdue'

class BorrowInDB(BorrowBase):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True
