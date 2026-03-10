from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
from bson import ObjectId
from ..database import get_db
from ..models.borrow import BorrowBase, BorrowInDB
from ..auth.security import get_current_student, get_current_librarian

router = APIRouter()

@router.post("/request/{book_id}")
async def request_book(book_id: str, user: dict = Depends(get_current_student)):
    db = get_db()
    
    # Check if book exists and is available
    book = await db["books"].find_one({"_id": ObjectId(book_id)})
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book["available_copies"] <= 0:
        raise HTTPException(status_code=400, detail="Book currently unavailable")
        
    # Check if student already has 5 books
    active_borrows = await db["borrows"].count_documents({
        "student_id": user["_id"],
        "status": {"$in": ["Requested", "Borrowed"]}
    })
    
    if active_borrows >= 5:
        raise HTTPException(status_code=400, detail="Borrow limit reached (5)")

    due_date = datetime.utcnow() + timedelta(days=14)
    borrow_record = BorrowBase(
        student_id=user["_id"],
        book_id=book_id,
        due_date=due_date,
        status="Requested"
    )
    
    result = await db["borrows"].insert_one(borrow_record.model_dump())
    
    # Decrement available copies
    await db["books"].update_one(
        {"_id": ObjectId(book_id)},
        {"$inc": {"available_copies": -1}}
    )
    
    return {"message": "Borrow request submitted successfully", "borrow_id": str(result.inserted_id)}

@router.put("/return/{borrow_id}")
async def return_book(borrow_id: str, user: dict = Depends(get_current_student)):
    db = get_db()
    
    # Verify borrow
    borrow_record = await db["borrows"].find_one({"_id": ObjectId(borrow_id)})
    if not borrow_record:
        raise HTTPException(status_code=404, detail="Borrow record not found")
        
    # Update return date and status
    await db["borrows"].update_one(
        {"_id": ObjectId(borrow_id)},
        {"$set": {"status": "Returned", "return_date": datetime.utcnow()}}
    )
    
    # Increment book copies back
    await db["books"].update_one(
        {"_id": ObjectId(borrow_record["book_id"])},
        {"$inc": {"available_copies": 1}}
    )
    
    return {"message": "Book returned successfully"}

# Admin route: Approve Request
@router.put("/approve/{borrow_id}", dependencies=[Depends(get_current_librarian)])
async def approve_borrow(borrow_id: str):
    db=get_db()
    result = await db["borrows"].update_one(
        {"_id": ObjectId(borrow_id), "status": "Requested"},
        {"$set": {"status": "Borrowed"}}
    )
    if result.modified_count == 0:
         raise HTTPException(status_code=404, detail="Borrow request not found or already processed")
    return {"message": "Request approved"}
