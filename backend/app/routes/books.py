from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from bson import ObjectId
from ..database import get_db
from ..models.book import BookBase, BookInDB
from ..auth.security import get_current_librarian, get_current_student

router = APIRouter()

# Get books (Student + Librarian)
@router.get("/", response_model=List[BookInDB])
async def get_books(
    category: Optional[str] = None, 
    search: Optional[str] = None,
    user: dict = Depends(get_current_student)
):
    db = get_db()
    query = {}
    if category:
        query["category"] = category
    if search:
        query["title"] = {"$regex": search, "$options": "i"} # Case-insensitive search
        
    cursor = db["books"].find(query)
    books = await cursor.to_list(length=100)
    
    # Cast MongoDB _id to string for Pydantic response
    for b in books:
        b["_id"] = str(b["_id"])
    return books

# Add book (Librarian only)
@router.post("/", response_model=BookInDB)
async def add_book(book: BookBase, user: dict = Depends(get_current_librarian)):
    db = get_db()
    new_book = book.model_dump()
    result = await db["books"].insert_one(new_book)
    create_book = await db["books"].find_one({"_id": result.inserted_id})
    create_book["_id"] = str(create_book["_id"])
    return create_book

# Update Book (Librarian only)
@router.put("/{book_id}")
async def update_book(book_id: str, updates: BookBase, user: dict = Depends(get_current_librarian)):
    db = get_db()
    result = await db["books"].update_one(
        {"_id": ObjectId(book_id)}, 
        {"$set": updates.model_dump()}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Book not found or no changes made")
    return {"message": "Successfully updated block"}

# Delete Book (Librarian only)
@router.delete("/{book_id}")
async def delete_book(book_id: str, user: dict = Depends(get_current_librarian)):
    db = get_db()
    result = await db["books"].delete_one({"_id": ObjectId(book_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"message": "Book deleted successfully"}
