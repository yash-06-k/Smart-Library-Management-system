from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Dict, Any, List
from openai import AsyncOpenAI
from ..config import settings
from ..database import get_db
from ..auth.security import get_current_student

router = APIRouter()
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

@router.post("/ask")
async def ask_librarian(message: str = Body(..., embed=True), history: List[Dict[str, str]] = Body(default=[]), user: dict = Depends(get_current_student)):
    if not settings.OPENAI_API_KEY:
         raise HTTPException(status_code=503, detail="OpenAI API Key not configured")
         
    db = get_db()
    
    # Retrieve top 5 available books to give AI context
    cursor = db["books"].find({"available_copies": {"$gt": 0}}).limit(5)
    books = await cursor.to_list(length=5)
    book_titles = ", ".join([b["title"] for b in books])
    
    system_prompt = f"""
    You are the SmartLib AI Librarian. You provide concise, friendly, and helpful advice to students looking for books.
    Answer questions about library policies, recommend books, or help them search.
    Currently available popular books include: {book_titles}
    Do not invent books that are not likely in a library.
    Keep answers under 100 words. Use Markdown styling.
    """
    
    messages = [{"role": "system", "content": system_prompt}]
    
    for h in history[-5:]: # Keep last 5 messages for context
        messages.append({"role": h["role"], "content": h["content"]})
        
    messages.append({"role": "user", "content": message})
    
    try:
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=150,
            temperature=0.7
        )
        return {"response": response.choices[0].message.content, "role": "assistant"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")
