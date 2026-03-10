from datetime import datetime

from fastapi import APIRouter, Depends, Query

from database import doc_to_dict, get_db, serialize_document
from services.auth import get_current_librarian, get_current_student

router = APIRouter(tags=["Users"])


@router.get("/users")
def list_users(
    role: str | None = Query(default=None),
    current_user: dict = Depends(get_current_librarian),
):
    db = get_db()

    query = db.users
    if role:
        query = query.where("role", "==", role)

    users = [doc_to_dict(doc) for doc in query.stream() if doc.exists]
    users.sort(key=lambda user: user.get("created_at") or datetime.min, reverse=True)
    return [serialize_document(user) for user in users]


@router.get("/admin/metrics")
def get_admin_metrics(current_user: dict = Depends(get_current_librarian)):
    db = get_db()
    now = datetime.utcnow()

    books = [doc_to_dict(doc) for doc in db.books.stream() if doc.exists]
    total_books = len(books)
    available_books = len([book for book in books if (book.get("available_copies") or 0) > 0])
    issued_books = total_books - available_books
    total_students = len(list(db.users.where("role", "==", "student").stream()))
    active_records = [
        doc_to_dict(doc)
        for doc in db.borrow_records.where("status", "in", ["Borrowed", "Overdue"]).stream()
        if doc.exists
    ]
    borrowed_books = len(active_records)
    overdue_books = len([record for record in active_records if record.get("due_date") and record["due_date"] < now])
    total_borrow_records = len(list(db.borrow_records.stream()))

    return {
        "total_books": total_books,
        "available_books": available_books,
        "issued_books": issued_books,
        "total_students": total_students,
        "borrowed_books": borrowed_books,
        "overdue_books": overdue_books,
        "total_borrow_records": total_borrow_records,
    }


@router.get("/admin/analytics")
def get_admin_analytics(current_user: dict = Depends(get_current_librarian)):
    metrics = get_admin_metrics(current_user)
    return {
        "metrics": metrics,
        "message": "Analytics fetched successfully",
    }


@router.get("/notifications")
def list_notifications(current_user: dict = Depends(get_current_student)):
    db = get_db()
    docs = list(db.notifications.where("user_id", "==", current_user["_id"]).stream())
    notifications = [doc_to_dict(doc) for doc in docs if doc.exists]
    notifications.sort(key=lambda item: item.get("created_at") or datetime.min, reverse=True)
    return [serialize_document(item) for item in notifications[:20]]
