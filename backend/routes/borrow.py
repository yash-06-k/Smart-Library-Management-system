from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud.firestore_v1 import Increment

from database import doc_to_dict, get_db, serialize_document
from models.schemas import BorrowRequest, ExtendBorrowRequest, ReserveRequest, ReturnRequest
from services.auth import get_current_librarian, get_current_student

router = APIRouter(tags=["Borrow"])


def _find_student(student_id: str):
    db = get_db()

    snapshot = db.users.document(student_id).get()
    if snapshot.exists:
        return doc_to_dict(snapshot)

    matches = list(db.users.where("email", "==", student_id.lower()).limit(1).stream())
    if matches:
        return doc_to_dict(matches[0])

    return None


def _normalize_isbn(value: str | None) -> str:
    if not value:
        return ""
    return "".join([ch for ch in value if ch.isdigit() or ch in "Xx"]).upper()


def _find_book_by_id_or_isbn(db, book_id: str):
    snapshot = db.books.document(book_id).get()
    if snapshot.exists:
        return snapshot

    matches = list(db.books.where("isbn", "==", book_id).limit(1).stream())
    if matches:
        return matches[0]

    normalized = _normalize_isbn(book_id)
    if normalized and len(normalized) in (8, 10, 13):
        for doc in db.books.stream():
            if not doc.exists:
                continue
            book = doc_to_dict(doc)
            if not book:
                continue
            if _normalize_isbn(book.get("isbn")) == normalized:
                return doc

    return None


def _normalize_student_id(payload_student_id: str | None, current_user: dict) -> str:
    if current_user["role"] == "student":
        if payload_student_id and payload_student_id != current_user["_id"] and payload_student_id != current_user["firebase_uid"]:
            raise HTTPException(status_code=403, detail="Students can only borrow books for themselves")
        return current_user["_id"]

    if not payload_student_id:
        raise HTTPException(status_code=400, detail="student_id is required for librarian borrow creation")

    return payload_student_id


def _borrow_book(payload: BorrowRequest, current_user: dict):
    db = get_db()

    student_lookup_id = _normalize_student_id(payload.student_id, current_user)
    student = _find_student(student_lookup_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.get("role") != "student":
        raise HTTPException(status_code=400, detail="Borrow record must be assigned to a student user")

    book_ref = db.books.document(payload.book_id)
    book_snapshot = _find_book_by_id_or_isbn(db, payload.book_id)
    if not book_snapshot:
        raise HTTPException(status_code=404, detail="Book not found")
    book = doc_to_dict(book_snapshot)
    book_ref = db.books.document(book["_id"])

    if (book.get("available_copies") or 0) <= 0:
        raise HTTPException(status_code=400, detail="Book is currently unavailable")

    book_ref.update(
        {
            "available_copies": Increment(-1),
            "updated_at": datetime.utcnow(),
        }
    )

    borrow_date = payload.borrow_date or datetime.utcnow()
    due_date = payload.due_date or (borrow_date + timedelta(days=7))

    borrow_record = {
        "student_name": student.get("name", "Unknown Student"),
        "student_id": str(student["_id"]),
        "book_title": book.get("title", "Unknown Book"),
        "book_author": book.get("author", ""),
        "book_isbn": book.get("isbn", ""),
        "book_id": str(book["_id"]),
        "category": book.get("category", "Uncategorized"),
        "rack_location": book.get("rack_location"),
        "borrow_date": borrow_date,
        "due_date": due_date,
        "return_date": None,
        "status": "Borrowed",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    record_ref = db.borrow_records.document()
    record_ref.set(borrow_record)
    created = doc_to_dict(record_ref.get())
    return serialize_document(created)


@router.post("/borrow")
def borrow_book(payload: BorrowRequest, current_user: dict = Depends(get_current_student)):
    return _borrow_book(payload, current_user)


@router.post("/borrow-records/manual")
def create_manual_borrow_record(payload: BorrowRequest, current_user: dict = Depends(get_current_librarian)):
    return _borrow_book(payload, current_user)


def _list_borrow_records(current_user: dict, student_id: str | None, status: str | None):
    db = get_db()

    query = db.borrow_records
    if current_user["role"] == "student":
        query = query.where("student_id", "==", current_user["_id"])
    elif student_id:
        query = query.where("student_id", "==", student_id)

    records = [doc_to_dict(doc) for doc in query.stream() if doc.exists]
    records.sort(key=lambda record: record.get("borrow_date") or datetime.min, reverse=True)

    now = datetime.utcnow()
    for record in records:
        if record.get("status") == "Borrowed" and record.get("due_date") and record["due_date"] < now:
            record["status"] = "Overdue"

    if status:
        records = [record for record in records if record.get("status") == status]

    return [serialize_document(record) for record in records]


@router.get("/borrow-records")
def list_borrow_records(
    student_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    current_user: dict = Depends(get_current_student),
):
    return _list_borrow_records(current_user, student_id, status)


@router.get("/borrow/history")
def legacy_borrow_history(
    student_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    current_user: dict = Depends(get_current_student),
):
    return _list_borrow_records(current_user, student_id, status)


@router.get("/admin/borrow-history")
def legacy_admin_borrow_history(
    student_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    current_user: dict = Depends(get_current_librarian),
):
    return _list_borrow_records(current_user, student_id, status)


@router.post("/reserve")
def reserve_book(payload: ReserveRequest, current_user: dict = Depends(get_current_student)):
    db = get_db()

    book_snapshot = _find_book_by_id_or_isbn(db, payload.book_id)
    if not book_snapshot:
        raise HTTPException(status_code=404, detail="Book not found")
    book = doc_to_dict(book_snapshot)
    book_ref = db.books.document(book["_id"])

    if (book.get("available_copies") or 0) > 0:
        raise HTTPException(status_code=400, detail="Book is available. Borrow it instead of reserving.")

    existing = list(
        db.borrow_records
        .where("book_id", "==", payload.book_id)
        .where("student_id", "==", current_user["_id"])
        .where("status", "in", ["Reserved", "Borrowed", "Overdue"])
        .limit(1)
        .stream()
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active reservation or borrow for this book.")

    reservation = {
        "student_name": current_user.get("name", "Unknown Student"),
        "student_id": current_user["_id"],
        "book_title": book.get("title", "Unknown Book"),
        "book_author": book.get("author", ""),
        "book_isbn": book.get("isbn", ""),
        "book_id": payload.book_id,
        "category": book.get("category", "Uncategorized"),
        "rack_location": book.get("rack_location"),
        "borrow_date": None,
        "due_date": None,
        "return_date": None,
        "status": "Reserved",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    reservation_ref = db.borrow_records.document()
    reservation_ref.set(reservation)
    created = doc_to_dict(reservation_ref.get())
    return serialize_document(created)


def _mark_returned(record_id: str, current_user: dict, return_date: datetime | None = None):
    db = get_db()

    record_ref = db.borrow_records.document(record_id)
    record_snapshot = record_ref.get()
    if not record_snapshot.exists:
        raise HTTPException(status_code=404, detail="Borrow record not found")
    record = doc_to_dict(record_snapshot)

    if current_user["role"] == "student" and record.get("student_id") != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Students can only return their own borrowed books")

    if record.get("status") == "Returned":
        raise HTTPException(status_code=400, detail="Book already returned")

    final_return_date = return_date or datetime.utcnow()
    record_ref.update(
        {
            "status": "Returned",
            "return_date": final_return_date,
            "updated_at": datetime.utcnow(),
        }
    )

    db.books.document(record["book_id"]).update(
        {"available_copies": Increment(1), "updated_at": datetime.utcnow()}
    )

    reservations = list(
        db.borrow_records
        .where("book_id", "==", record["book_id"])
        .where("status", "==", "Reserved")
        .order_by("created_at")
        .limit(1)
        .stream()
    )
    if reservations:
        reservation = doc_to_dict(reservations[0])
        if reservation:
            db.notifications.document().set(
                {
                    "user_id": reservation["student_id"],
                    "book_id": reservation["book_id"],
                    "type": "reservation_available",
                    "message": f"{reservation.get('book_title', 'A book')} is now available.",
                    "created_at": datetime.utcnow(),
                    "read": False,
                }
            )

    updated = doc_to_dict(record_ref.get())
    return serialize_document(updated)


@router.post("/return-by-book/{book_id}")
def return_by_book(book_id: str, current_user: dict = Depends(get_current_student)):
    db = get_db()

    resolved_snapshot = _find_book_by_id_or_isbn(db, book_id)
    resolved_id = doc_to_dict(resolved_snapshot)["_id"] if resolved_snapshot else book_id

    query = db.borrow_records.where("book_id", "==", resolved_id).where("status", "in", ["Borrowed", "Overdue"])
    if current_user["role"] == "student":
        query = query.where("student_id", "==", current_user["_id"])
    query = query.limit(1)
    records = list(query.stream())
    if not records:
        raise HTTPException(status_code=404, detail="No active borrow record found for this book.")

    record = doc_to_dict(records[0])
    if not record:
        raise HTTPException(status_code=404, detail="Borrow record not found")

    if current_user["role"] == "student" and record.get("student_id") != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Students can only return their own borrowed books")

    return _mark_returned(record["_id"], current_user)


@router.post("/return")
def return_book(payload: ReturnRequest, current_user: dict = Depends(get_current_student)):
    return _mark_returned(payload.borrow_record_id, current_user, payload.return_date)


@router.put("/borrow-records/{borrow_record_id}/mark-returned")
def admin_mark_returned(borrow_record_id: str, current_user: dict = Depends(get_current_librarian)):
    return _mark_returned(borrow_record_id, current_user)


@router.put("/admin/borrow-history/{borrow_record_id}/mark-returned")
def legacy_mark_returned(borrow_record_id: str, current_user: dict = Depends(get_current_librarian)):
    return _mark_returned(borrow_record_id, current_user)


@router.put("/borrow-records/{borrow_record_id}/extend")
def extend_due_date(
    borrow_record_id: str,
    payload: ExtendBorrowRequest,
    current_user: dict = Depends(get_current_librarian),
):
    db = get_db()

    record_ref = db.borrow_records.document(borrow_record_id)
    snapshot = record_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Borrow record not found")

    record_ref.update(
        {
            "due_date": payload.due_date,
            "updated_at": datetime.utcnow(),
        }
    )

    updated = doc_to_dict(record_ref.get())
    return serialize_document(updated)


@router.put("/admin/borrow-history/{borrow_record_id}/extend")
def legacy_extend_due_date(
    borrow_record_id: str,
    payload: ExtendBorrowRequest,
    current_user: dict = Depends(get_current_librarian),
):
    return extend_due_date(borrow_record_id, payload, current_user)


@router.delete("/borrow-records/{borrow_record_id}")
def delete_borrow_record(borrow_record_id: str, current_user: dict = Depends(get_current_librarian)):
    db = get_db()

    record_ref = db.borrow_records.document(borrow_record_id)
    record_snapshot = record_ref.get()
    if not record_snapshot.exists:
        raise HTTPException(status_code=404, detail="Borrow record not found")
    record = doc_to_dict(record_snapshot)

    if record.get("status") != "Returned":
        db.books.document(record["book_id"]).update(
            {"available_copies": Increment(1), "updated_at": datetime.utcnow()}
        )

    record_ref.delete()
    return {"message": "Borrow record deleted"}


@router.delete("/admin/borrow-history/{borrow_record_id}")
def legacy_delete_borrow_record(borrow_record_id: str, current_user: dict = Depends(get_current_librarian)):
    return delete_borrow_record(borrow_record_id, current_user)


@router.post("/admin/borrow-history/manual")
def legacy_create_manual_borrow_record(payload: BorrowRequest, current_user: dict = Depends(get_current_librarian)):
    return create_manual_borrow_record(payload, current_user)
