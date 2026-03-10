from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
from bson import ObjectId
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
    cursor = db["borrows"].find().sort("issue_date", -1).limit(50)
    borrows = await cursor.to_list(length=50)
    for b in borrows:
        b["_id"] = str(b["_id"])
        b["student_id"] = str(b["student_id"])
        b["book_id"] = str(b["book_id"])
        
        student = await db["users"].find_one({"_id": ObjectId(b["student_id"])})
        if student:
            b["student_name"] = student.get("name", b["student_id"])
            
        book = await db["books"].find_one({"_id": ObjectId(b["book_id"])})
        if book:
            b["book_title"] = book.get("title", b["book_id"])
            b["category"] = book.get("category", "General")
            
    return borrows

@router.put("/borrow-history/{borrow_id}/extend")
async def extend_borrow(borrow_id: str, payload: dict, user: dict = Depends(get_current_librarian)):
    db = get_db()
    due_date_str = payload.get("due_date")
    if not due_date_str:
        raise HTTPException(status_code=400, detail="due_date required")
        
    try:
        new_due = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
    except ValueError:
        new_due = datetime.utcnow() + timedelta(days=7)
        
    result = await db["borrows"].update_one(
        {"_id": ObjectId(borrow_id)},
        {"$set": {"due_date": new_due}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Borrow record not found")
    return {"message": "Due date extended"}

@router.delete("/borrow-history/{borrow_id}")
async def delete_borrow_record(borrow_id: str, user: dict = Depends(get_current_librarian)):
    db = get_db()
    record = await db["borrows"].find_one({"_id": ObjectId(borrow_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Borrow record not found")
        
    if record.get("status") in ["Requested", "Borrowed", "Overdue"]:
        await db["books"].update_one(
            {"_id": ObjectId(record["book_id"])},
            {"$inc": {"available_copies": 1}}
        )
        
    await db["borrows"].delete_one({"_id": ObjectId(borrow_id)})
    return {"message": "Record deleted"}

@router.post("/borrow-history/manual")
async def create_manual_borrow(payload: dict, user: dict = Depends(get_current_librarian)):
    db = get_db()
    student_id = payload.get("student_id")
    book_id = payload.get("book_id")
    due_date_str = payload.get("due_date")
    
    try:
        new_due = datetime.fromisoformat(due_date_str.replace("Z", "+00:00")) if due_date_str else datetime.utcnow() + timedelta(days=7)
    except:
        new_due = datetime.utcnow() + timedelta(days=7)

    book = await db["books"].find_one({"_id": ObjectId(book_id)})
    if not book or book.get("available_copies", 0) <= 0:
        raise HTTPException(status_code=400, detail="Book unavailable")
        
    student = await db["users"].find_one({"_id": ObjectId(student_id)})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    borrow_record = {
        "student_id": student_id,
        "book_id": book_id,
        "due_date": new_due,
        "status": "Borrowed",
        "issue_date": datetime.utcnow(),
        "borrow_date": datetime.utcnow()
    }
    
    result = await db["borrows"].insert_one(borrow_record)
    
    await db["books"].update_one(
        {"_id": ObjectId(book_id)},
        {"$inc": {"available_copies": -1}}
    )
    
    return {"message": "Manual record created", "_id": str(result.inserted_id)}
    
@router.put("/borrow-history/{borrow_id}/mark-returned")
async def mark_borrow_returned(borrow_id: str, user: dict = Depends(get_current_librarian)):
    db = get_db()
    record = await db["borrows"].find_one({"_id": ObjectId(borrow_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Borrow record not found")
        
    if record.get("status") == "Returned":
        return {"message": "Already returned"}
        
    await db["borrows"].update_one(
        {"_id": ObjectId(borrow_id)},
        {"$set": {"status": "Returned", "return_date": datetime.utcnow()}}
    )
    
    await db["books"].update_one(
        {"_id": ObjectId(record["book_id"])},
        {"$inc": {"available_copies": 1}}
    )
    
    return {"message": "Marked as returned"}
