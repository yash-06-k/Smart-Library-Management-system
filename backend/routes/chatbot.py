from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from dotenv import load_dotenv
from pathlib import Path

from database import doc_to_dict, get_db
from models.schemas import ChatRequest
from services.auth import get_current_student
from services.chatbot import get_chat_client, resolve_model

router = APIRouter(tags=["AI Chatbot"])

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
OPENAI_MODEL = resolve_model("gpt-4o-mini")

AI_PROMPT = """
Advanced AI Librarian Master Prompt

You are an advanced AI Librarian for a Smart Library Management System.

Your job is to help students, researchers, and librarians find the best books, understand topics, and discover new learning paths.

You have access to the library database which contains:

Books
Authors
Categories
Borrow history
Ratings
Student interests

Your behavior must be intelligent, helpful, and recommendation-driven.

Always try to:

1. Recommend relevant books.
2. Suggest categories related to the user's query.
3. Suggest beginner -> intermediate -> advanced learning paths.
4. Suggest popular or highly rated books.
5. Suggest books based on borrowing history.
6. Provide short summaries of books.
7. Suggest similar authors or topics.
8. Suggest trending topics in technology, science, and education.

If the user searches for a topic, respond with:

- Top books for the topic
- Beginner books
- Advanced books
- Related categories
- Learning path

Example:

User: "I want to learn Artificial Intelligence"

AI Response:

Beginner Books:
- AI Basics
- Machine Learning for Beginners

Intermediate Books:
- Practical Machine Learning
- Deep Learning Foundations

Advanced Books:
- Reinforcement Learning
- Advanced Neural Networks

Related Categories:
Machine Learning
Data Science
Python Programming

Learning Path:
1. Python Basics
2. Statistics
3. Machine Learning
4. Deep Learning

Always keep responses structured and easy to read.

Never respond with generic answers. Always use the library knowledge base.

Advanced AI Features You Should Add

To make your AI very powerful, add these features.

1 Smart Book Recommendation Engine

AI suggests books based on:

previous borrowed books
favorite categories
trending books
similar users

Example query to database:

Find books in same category
Sort by rating
Exclude already borrowed books

2 Personalized AI Suggestions

When a student logs in, AI should analyze:

Borrow history
Wishlist
Search queries
Favorite categories

Then suggest:

Recommended for You
Popular in Your Category
Students Also Borrowed

3 AI Learning Paths

AI can guide students step-by-step.

Example:

User asks:

How do I learn Data Science?

AI responds with:

Step 1: Python Programming
Step 2: Statistics Basics
Step 3: Data Analysis
Step 4: Machine Learning
Step 5: Deep Learning

4 AI Semantic Search

Instead of simple keyword search, AI understands meaning.

Example:

User types:

Books about building websites

AI returns:

HTML & CSS
JavaScript
React
Web Development

Even if exact words are different.

5 AI Book Summary Generator

When user clicks a book:

AI generates summary:

Summary
Key Concepts
Who Should Read It
Difficulty Level

6 AI Chat Commands

Your chatbot should understand commands like:

Suggest AI books
Find Python books
What should I read next?
Popular books in programming
Beginner machine learning books

Example Advanced AI Response

User asks:

Suggest books for learning Python

AI response:

Top Python Books:

1. Python Crash Course
Beginner friendly introduction to Python programming.

2. Automate the Boring Stuff with Python
Learn how to automate daily tasks.

3. Fluent Python
Advanced Python programming techniques.

Learning Path:
Start with Python Crash Course -> Automate the Boring Stuff -> Fluent Python

Related Categories:
Programming
Data Science
Artificial Intelligence

Backend AI Integration Example

Example FastAPI endpoint:

from openai import OpenAI

client = OpenAI()

def ask_ai(question):

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role":"system","content":AI_PROMPT},
            {"role":"user","content":question}
        ]
    )

    return response.choices[0].message.content

AI + MongoDB Recommendation Logic

Your AI should also query the database.

Example:

recommended_books = db.books.find({
"category": user_favorite_category
})

Then send results to AI to explain.

Futuristic AI Features (Optional)

If you want your project to look next-level, add:

Voice AI Librarian
Students speak questions.

AI Book Review Analyzer
AI analyzes reviews and suggests best books.

AI Research Assistant
Suggests books + research papers.

AI Reading Planner
Creates weekly reading schedule.

AI Knowledge Graph
Shows related topics visually.

Example Smart AI Suggestion Box

Add section on dashboard:

Recommended for You
Trending in Programming
Students Also Borrowed
AI Picks of the Week

Professional AI UI Ideas

Add:

Floating AI assistant
Animated typing indicator
Smart suggestion chips

Example buttons:

Suggest books
Find beginner books
Popular categories
Learning path
Pro Tip

To make AI very strong, send extra context to the model:

User interests
Borrow history
Available books
Categories

This makes responses personalized and intelligent.

Optional note: I can also provide a powerful AI system prompt (used in SaaS apps) that will make your AI Librarian 10x smarter than normal chatbots.

Important:
- Only recommend books from the provided library context.
- If ratings are not provided, say ratings are not available and use borrow counts as popularity.
- Do not invent books, authors, or categories.
""".strip()


@router.post("/chatbot")
def ask_chatbot(payload: ChatRequest, current_user: dict = Depends(get_current_student)):
    db = get_db()

    try:
        client = get_chat_client()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    books_docs = list(db.books.stream())
    all_books = [doc_to_dict(doc) for doc in books_docs if doc.exists]

    borrow_docs = list(db.borrow_records.stream())
    borrow_records = [doc_to_dict(doc) for doc in borrow_docs if doc.exists]

    popularity = {}
    for record in borrow_records:
        book_id = record.get("book_id")
        if book_id:
            popularity[book_id] = popularity.get(book_id, 0) + 1

    trending = sorted(
        [book for book in all_books if book.get("_id") in popularity],
        key=lambda book: popularity.get(book.get("_id"), 0),
        reverse=True,
    )[:8]

    available_books = [book for book in all_books if (book.get("available_copies") or 0) > 0]
    available_books.sort(key=lambda item: (item.get("title") or "").lower())

    user_history = [
        record for record in borrow_records
        if record.get("student_id") == current_user["_id"]
    ]
    user_history.sort(key=lambda record: record.get("borrow_date") or datetime.min, reverse=True)
    user_history = user_history[:10]

    categories = sorted({book.get("category", "General") for book in all_books})

    def format_book_line(book: dict) -> str:
        return (
            f"- {book.get('title', 'Unknown')} | "
            f"Author: {book.get('author', 'Unknown')} | "
            f"Category: {book.get('category', 'General')} | "
            f"ISBN: {book.get('isbn', '')} | "
            f"Available: {book.get('available_copies', 0)}/{book.get('total_copies', 0)} | "
            f"Summary: {book.get('description', 'No description')}"
        )

    catalog_context = "\n".join(format_book_line(book) for book in available_books[:40])
    trending_context = "\n".join(format_book_line(book) for book in trending)
    history_context = "\n".join(
        f"- {record.get('book_title', 'Unknown')} | Status: {record.get('status', '')}"
        for record in user_history
    )

    messages = [
        {
            "role": "system",
            "content": (
                f"{AI_PROMPT}\n\n"
                f"Known categories: {', '.join(categories) if categories else 'General'}\n"
                f"Trending books (by borrow count):\n{trending_context if trending_context else '- None'}\n\n"
                f"User borrow history:\n{history_context if history_context else '- None'}\n\n"
                f"Available books catalog:\n{catalog_context if catalog_context else '- None'}\n"
            ),
        }
    ]

    for history_item in payload.history[-8:]:
        messages.append({"role": history_item.role, "content": history_item.content})

    messages.append({"role": "user", "content": payload.message})

    try:
        completion = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
            temperature=0.5,
            max_tokens=250,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OpenAI request failed: {exc}") from exc

    return {
        "response": completion.choices[0].message.content,
    }
