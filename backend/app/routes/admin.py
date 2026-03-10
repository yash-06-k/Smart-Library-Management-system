from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from ..database import get_db
from ..auth.security import get_current_librarian

router = APIRouter()

@router.get("/analytics")
async def get_admin_analytics(user: dict = Depends(get_current_librarian)):
    db = get_db()
    
    total_books = await db["books"].count_documents({})
    borrowed_books = await db["borrows"].count_documents({"status": "Borrowed"})
    active_students = await db["users"].count_documents({"role": "student"})
    
    # Overdue = Due date in the past, and status is still Borrowed
    current_time = datetime.utcnow()
    overdue_books = await db["borrows"].count_documents({"status": "Borrowed", "due_date": {"$lt": current_time}})
    
    return {
        "metrics": {
            "total_books": total_books,
            "borrowed_books": borrowed_books,
            "active_students": active_students,
            "overdue_books": overdue_books
        },
        "message": "Analytics fetched successfully"
    }

@router.get("/students")
async def get_all_students(user: dict = Depends(get_current_librarian)):
    db = get_db()
    cursor = db["users"].find({"role": "student"})
    students = await cursor.to_list(length=100)
    
    for s in students:
        s["_id"] = str(s["_id"])
        
    return students

@router.get("/borrow-history")
async def get_global_history(user: dict = Depends(get_current_librarian)):
    db = get_db()
    # Simple unjoined history. MongoDB requires $lookup for joining Collections. This is simplified.
    cursor = db["borrows"].find().sort("issue_date", -1).limit(50)
    borrows = await cursor.to_list(length=50)
    for b in borrows:
        b["_id"] = str(b["_id"])
        b["student_id"] = str(b["student_id"])
        b["book_id"] = str(b["book_id"])
    return borrows
