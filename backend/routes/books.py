from datetime import datetime
import json

from fastapi import APIRouter, Depends, HTTPException, Query

from database import doc_to_dict, get_db, serialize_document
from models.schemas import BookCreateRequest, BookUpdateRequest, BulkBooksRequest
from services.auth import get_current_librarian, get_current_student
from services.covers import build_cover, needs_refresh
from services.chatbot import get_chat_client, resolve_model

router = APIRouter(tags=["Books"])


def _build_book_status_maps(db):
    borrowed_map: dict[str, int] = {}
    reserved_map: dict[str, int] = {}

    for record_doc in db.borrow_records.stream():
        if not record_doc.exists:
            continue
        record = doc_to_dict(record_doc)
        if not record:
            continue
        book_id = record.get("book_id")
        if not book_id:
            continue
        status = record.get("status")
        if status in ("Borrowed", "Overdue"):
            borrowed_map[book_id] = borrowed_map.get(book_id, 0) + 1
        elif status == "Reserved":
            reserved_map[book_id] = reserved_map.get(book_id, 0) + 1

    return borrowed_map, reserved_map


def _attach_status(book: dict, borrowed_map: dict[str, int], reserved_map: dict[str, int]) -> dict:
    available_copies = book.get("available_copies", 0) or 0
    reserved_count = reserved_map.get(book["_id"], 0)
    issued_count = borrowed_map.get(book["_id"], 0)

    if reserved_count > 0:
        status = "Reserved"
    elif available_copies > 0:
        status = "Available"
    else:
        status = "Issued"

    book["availability_status"] = status
    book["reserved_count"] = reserved_count
    book["issued_count"] = issued_count
    return book


def _normalize_isbn(value: str | None) -> str:
    if not value:
        return ""
    return "".join([ch for ch in value if ch.isdigit() or ch in "Xx"]).upper()


@router.get("/books")
def list_books(
    category: str | None = Query(default=None),
    search: str | None = Query(default=None),
    current_user: dict = Depends(get_current_student),
):
    db = get_db()

    query = db.books
    if category:
        query = query.where("category", "==", category)

    docs = list(query.stream())
    books = [doc_to_dict(doc) for doc in docs if doc.exists]

    if search:
        needle = search.lower()
        normalized_search = _normalize_isbn(search)

        def matches(book: dict) -> bool:
            if needle in (book.get("title") or "").lower():
                return True
            if needle in (book.get("author") or "").lower():
                return True
            if needle in (book.get("category") or "").lower():
                return True
            if needle in (book.get("isbn") or "").lower():
                return True
            if normalized_search and len(normalized_search) in (8, 10, 13):
                return _normalize_isbn(book.get("isbn")) == normalized_search
            return False

        books = [book for book in books if matches(book)]

    books.sort(key=lambda item: (item.get("title") or "").lower())
    borrowed_map, reserved_map = _build_book_status_maps(db)
    enriched = [_attach_status(book, borrowed_map, reserved_map) for book in books]
    return [serialize_document(book) for book in enriched]


@router.get("/books/{book_id}")
def get_book(book_id: str, current_user: dict = Depends(get_current_student)):
    db = get_db()
    snapshot = db.books.document(book_id).get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Book not found")

    book = doc_to_dict(snapshot)
    borrowed_map, reserved_map = _build_book_status_maps(db)
    book = _attach_status(book, borrowed_map, reserved_map)
    return serialize_document(book)


@router.post("/books")
def create_book(payload: BookCreateRequest, current_user: dict = Depends(get_current_librarian)):
    db = get_db()

    available_copies = payload.available_copies
    if available_copies is None:
        available_copies = payload.total_copies

    if available_copies > payload.total_copies:
        raise HTTPException(status_code=400, detail="available_copies cannot exceed total_copies")

    book_doc = {
        "title": payload.title.strip(),
        "author": payload.author.strip(),
        "category": payload.category.strip(),
        "isbn": payload.isbn.strip(),
        "description": payload.description.strip(),
        "rack_location": payload.rack_location.strip() if payload.rack_location else None,
        "total_copies": payload.total_copies,
        "available_copies": available_copies,
        "cover_image": payload.cover_image,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    isbn_matches = list(db.books.where("isbn", "==", book_doc["isbn"]).limit(1).stream())
    if isbn_matches:
        raise HTTPException(status_code=400, detail="Book with this ISBN already exists")

    book_ref = db.books.document()
    book_ref.set(book_doc)
    created = doc_to_dict(book_ref.get())
    return serialize_document(created)


@router.post("/books/bulk")
def bulk_create_books(payload: BulkBooksRequest, current_user: dict = Depends(get_current_librarian)):
    db = get_db()

    created = []
    skipped = []
    seen_isbns: set[str] = set()

    for index, item in enumerate(payload.books, start=1):
        isbn = (item.isbn or "").strip()
        if not isbn:
            skipped.append({"row": index, "isbn": "", "reason": "Missing ISBN"})
            continue

        if isbn in seen_isbns:
            skipped.append({"row": index, "isbn": isbn, "reason": "Duplicate ISBN in upload"})
            continue

        seen_isbns.add(isbn)

        existing = list(db.books.where("isbn", "==", isbn).limit(1).stream())
        if existing:
            skipped.append({"row": index, "isbn": isbn, "reason": "ISBN already exists"})
            continue

        available_copies = item.available_copies if item.available_copies is not None else item.total_copies
        if available_copies > item.total_copies:
            skipped.append({"row": index, "isbn": isbn, "reason": "Available copies exceed total copies"})
            continue

        book_doc = {
            "title": item.title.strip(),
            "author": item.author.strip(),
            "category": item.category.strip(),
            "isbn": isbn,
            "description": (item.description or "").strip(),
            "rack_location": item.rack_location.strip() if item.rack_location else None,
            "total_copies": item.total_copies,
            "available_copies": available_copies,
            "cover_image": item.cover_image,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }

        book_ref = db.books.document()
        book_ref.set(book_doc)
        created_doc = doc_to_dict(book_ref.get())
        if created_doc:
            created.append(serialize_document(created_doc))

    return {
        "created_count": len(created),
        "skipped_count": len(skipped),
        "created": created,
        "skipped": skipped,
        "total": len(payload.books),
    }


@router.put("/books/{book_id}")
def update_book(book_id: str, payload: BookUpdateRequest, current_user: dict = Depends(get_current_librarian)):
    db = get_db()

    if payload.available_copies > payload.total_copies:
        raise HTTPException(status_code=400, detail="available_copies cannot exceed total_copies")

    updates = {
        "title": payload.title.strip(),
        "author": payload.author.strip(),
        "category": payload.category.strip(),
        "isbn": payload.isbn.strip(),
        "description": payload.description.strip(),
        "rack_location": payload.rack_location.strip() if payload.rack_location else None,
        "total_copies": payload.total_copies,
        "available_copies": payload.available_copies,
        "cover_image": payload.cover_image,
        "updated_at": datetime.utcnow(),
    }

    book_ref = db.books.document(book_id)
    snapshot = book_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Book not found")

    isbn_matches = list(db.books.where("isbn", "==", updates["isbn"]).limit(1).stream())
    if isbn_matches:
        if isbn_matches[0].id != book_id:
            raise HTTPException(status_code=400, detail="Book with this ISBN already exists")

    book_ref.update(updates)
    updated = doc_to_dict(book_ref.get())
    return serialize_document(updated)


@router.delete("/books/{book_id}")
def delete_book(book_id: str, current_user: dict = Depends(get_current_librarian)):
    db = get_db()

    book_ref = db.books.document(book_id)
    snapshot = book_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Book not found")

    book_ref.delete()
    return {"message": "Book deleted successfully"}


@router.get("/recommendations")
def get_recommendations(current_user: dict = Depends(get_current_student)):
    db = get_db()

    history_docs = list(db.borrow_records.where("student_id", "==", current_user["_id"]).stream())
    history = [doc_to_dict(doc) for doc in history_docs if doc.exists]
    active_book_ids = {
        record.get("book_id")
        for record in history
        if record.get("status") in ("Borrowed", "Overdue", "Reserved")
    }

    category_counts: dict[str, int] = {}
    author_counts: dict[str, int] = {}
    for record in history:
        category = record.get("category")
        author = record.get("author") or record.get("book_author")
        if category:
            category_counts[category] = category_counts.get(category, 0) + 1
        if author:
            author_counts[author] = author_counts.get(author, 0) + 1

    favorite_categories = [item for item, _ in sorted(category_counts.items(), key=lambda kv: kv[1], reverse=True)]
    favorite_authors = [item for item, _ in sorted(author_counts.items(), key=lambda kv: kv[1], reverse=True)]

    popularity: dict[str, int] = {}
    for record_doc in db.borrow_records.stream():
        if not record_doc.exists:
            continue
        record = doc_to_dict(record_doc)
        if not record:
            continue
        book_id = record.get("book_id")
        if not book_id:
            continue
        popularity[book_id] = popularity.get(book_id, 0) + 1

    available_docs = list(db.books.where("available_copies", ">", 0).stream())
    books = [doc_to_dict(doc) for doc in available_docs if doc.exists and doc.id not in active_book_ids]

    def score(book: dict) -> float:
        score_value = 0.0
        category = book.get("category")
        author = book.get("author")
        if category in favorite_categories:
            score_value += 3 - min(favorite_categories.index(category), 2)
        if author in favorite_authors:
            score_value += 2 - min(favorite_authors.index(author), 1)
        score_value += min(popularity.get(book["_id"], 0), 5) * 0.3
        score_value += min(book.get("available_copies", 0) or 0, 5) * 0.1
        return score_value

    books.sort(key=score, reverse=True)
    top = books[:6]

    recommendations = []
    for book in top:
        reason = "Fresh pick from the library."
        if book.get("category") in favorite_categories:
            reason = f"Matches your interest in {book.get('category')}."
        elif book.get("author") in favorite_authors:
            reason = f"More from {book.get('author')}."
        elif popularity.get(book["_id"], 0) > 0:
            reason = "Popular with other readers."

        recommendations.append(
            {
                "book": serialize_document(book),
                "reason": reason,
            }
        )

    source = "smart"

    if recommendations:
        try:
            client = get_chat_client()
            model = resolve_model("gpt-4o-mini")
            prompt_lines = [
                f"{item['book']['_id']} | {item['book'].get('title', '')} | {item['book'].get('author', '')} | {item['book'].get('category', '')}"
                for item in recommendations
            ]
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a smart librarian. Given a list of books with IDs, return JSON "
                            "array of objects with fields id and reason. Keep reasons under 12 words."
                        ),
                    },
                    {"role": "user", "content": "\n".join(prompt_lines)},
                ],
                temperature=0.4,
                max_tokens=200,
            )

            content = response.choices[0].message.content.strip()
            parsed = json.loads(content)
            if isinstance(parsed, list):
                reason_map = {
                    item.get("id"): item.get("reason")
                    for item in parsed
                    if isinstance(item, dict)
                }
                for item in recommendations:
                    book_id = item["book"]["_id"]
                    if reason_map.get(book_id):
                        item["reason"] = reason_map[book_id]
                source = "ai"
        except Exception:
            source = "smart"

    return {
        "recommendations": recommendations,
        "source": source,
    }


@router.post("/books/refresh-covers")
def refresh_book_covers(
    dry_run: bool = Query(default=False),
    limit: int | None = Query(default=None),
    current_user: dict = Depends(get_current_librarian),
):
    db = get_db()
    updated = 0
    skipped = 0
    sample = []

    docs = list(db.books.stream())
    if limit:
        docs = docs[:limit]

    for doc in docs:
        if not doc.exists:
            continue
        book = doc_to_dict(doc) or {}
        cover = book.get("cover_image")
        if not needs_refresh(cover):
            skipped += 1
            continue

        seed = book.get("isbn") or book.get("_id") or doc.id
        new_cover = build_cover(seed)
        if not dry_run:
            doc.reference.update({
                "cover_image": new_cover,
                "updated_at": datetime.utcnow(),
            })

        updated += 1
        if len(sample) < 10:
            sample.append(
                {
                    "id": book.get("_id") or doc.id,
                    "title": book.get("title"),
                    "old": cover,
                    "new": new_cover,
                }
            )

    return {
        "updated": updated,
        "skipped": skipped,
        "dry_run": dry_run,
        "sample": sample,
    }
