from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud import firestore
from google.cloud.firestore_v1 import Increment

from database import doc_to_dict, get_db, serialize_document
from models.schemas import BorrowRequest, ExtendBorrowRequest, ReserveRequest, ReturnRequest
from services.auth import get_current_librarian, get_current_student

router = APIRouter(tags=["Borrow"])

ACTIVE_BORROW_STATUSES = {"Borrowed", "Overdue"}
TERMINAL_BORROW_STATUSES = {"Returned"}
KNOWN_BORROW_STATUSES = ACTIVE_BORROW_STATUSES | TERMINAL_BORROW_STATUSES | {"Reserved"}


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


def _coerce_datetime(value) -> datetime | None:
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    if isinstance(value, str):
        candidate = value.strip()
        if not candidate:
            return None

        try:
            parsed = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
        except ValueError:
            return None

        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed

    return None


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

    transaction = db.client.transaction()
    record_ref = db.borrow_records.document()

    @firestore.transactional
    def _commit_borrow(txn):
        fresh_book_snapshot = book_ref.get(transaction=txn)
        if not fresh_book_snapshot.exists:
            raise HTTPException(status_code=404, detail="Book not found")

        fresh_book = doc_to_dict(fresh_book_snapshot) or {}
        available = int(fresh_book.get("available_copies") or 0)
        if available <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Book is currently unavailable. ({available} copies available)",
            )

        now = datetime.utcnow()
        payload_to_write = {
            **borrow_record,
            "created_at": now,
            "updated_at": now,
        }

        txn.update(
            book_ref,
            {
                "available_copies": Increment(-1),
                "updated_at": now,
            },
        )
        txn.set(record_ref, payload_to_write)

    _commit_borrow(transaction)
    created = doc_to_dict(record_ref.get())
    return serialize_document(created)


@router.post("/borrow")
def borrow_book(payload: BorrowRequest, current_user: dict = Depends(get_current_student)):
    return _borrow_book(payload, current_user)


@router.post("/borrow-records/manual")
def create_manual_borrow_record(payload: BorrowRequest, current_user: dict = Depends(get_current_librarian)):
    return _borrow_book(payload, current_user)


def _list_borrow_records(current_user: dict, student_id: str | None, status: str | None, limit: int = 100, skip: int = 0):
    """List borrow records with pagination and status filtering."""
    db = get_db()

    query = db.borrow_records
    if current_user["role"] == "student":
        query = query.where("student_id", "==", current_user["_id"])
    elif student_id:
        query = query.where("student_id", "==", student_id)

    # Fetch all records (with limit) and sort in memory.
    # This avoids composite-index dependency for status+student combinations.
    all_records = [doc_to_dict(doc) for doc in query.limit(limit + skip).stream() if doc.exists]
    all_records.sort(
        key=lambda record: _coerce_datetime(record.get("borrow_date")) or datetime.min,
        reverse=True,
    )

    # Update overdue status dynamically
    now = datetime.utcnow()
    for record in all_records:
        due_date = _coerce_datetime(record.get("due_date"))
        if record.get("status") == "Borrowed" and due_date and due_date < now:
            record["status"] = "Overdue"

    # Filter by computed overdue status if needed
    if status == "Overdue":
        all_records = [record for record in all_records if record.get("status") == "Overdue"]
    
    # Apply skip and limit for pagination
    paginated_records = all_records[skip : skip + limit]

    return [serialize_document(record) for record in paginated_records]


@router.get("/borrow-records")
def list_borrow_records(
    student_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_student),
):
    return _list_borrow_records(current_user, student_id, status, limit, skip)


@router.get("/borrow/history")
def legacy_borrow_history(
    student_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_student),
):
    return _list_borrow_records(current_user, student_id, status, limit, skip)


@router.get("/admin/borrow-history")
def legacy_admin_borrow_history(
    student_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_librarian),
):
    return _list_borrow_records(current_user, student_id, status, limit, skip)


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

    resolved_book_id = str(book["_id"])

    existing = list(
        db.borrow_records
        .where("book_id", "==", resolved_book_id)
        .where("student_id", "==", current_user["_id"])
        .where("status", "in", ["Reserved", *ACTIVE_BORROW_STATUSES])
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
        "book_id": resolved_book_id,
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


def _find_next_reservation_for_book(book_id: str):
    db = get_db()
    candidates = [
        doc_to_dict(doc)
        for doc in db.borrow_records.where("book_id", "==", book_id).stream()
        if doc.exists
    ]
    active_reservations = [item for item in candidates if item and item.get("status") == "Reserved"]
    active_reservations.sort(key=lambda item: item.get("created_at") or datetime.min)
    return active_reservations[0] if active_reservations else None


def _annotate_idempotent_return(record: dict) -> dict:
    return serialize_document(
        {
            **record,
            "already_returned": True,
            "idempotent": True,
        }
    )


def _mark_returned(record_id: str, current_user: dict, return_date: datetime | None = None):
    db = get_db()

    record_ref = db.borrow_records.document(record_id)
    record_snapshot = record_ref.get()
    if not record_snapshot.exists:
        raise HTTPException(status_code=404, detail="Borrow record not found")
    record = doc_to_dict(record_snapshot)

    if current_user["role"] == "student" and record.get("student_id") != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Students can only return their own borrowed books")

    if record.get("status") in TERMINAL_BORROW_STATUSES:
        return _annotate_idempotent_return(record)
    if record.get("status") not in ACTIVE_BORROW_STATUSES:
        raise HTTPException(status_code=400, detail="Only active borrowed books can be returned")

    final_return_date = return_date or datetime.utcnow()
    now = datetime.utcnow()

    book_ref = db.books.document(record["book_id"])
    transaction = db.client.transaction()

    @firestore.transactional
    def _commit_return(txn):
        fresh_record_snapshot = record_ref.get(transaction=txn)
        if not fresh_record_snapshot.exists:
            raise HTTPException(status_code=404, detail="Borrow record not found")

        fresh_record = doc_to_dict(fresh_record_snapshot) or {}
        fresh_status = fresh_record.get("status")
        if fresh_status in TERMINAL_BORROW_STATUSES:
            return False
        if fresh_status not in ACTIVE_BORROW_STATUSES:
            raise HTTPException(status_code=400, detail="Only active borrowed books can be returned")

        fresh_book_snapshot = book_ref.get(transaction=txn)
        if not fresh_book_snapshot.exists:
            raise HTTPException(status_code=404, detail="Book not found")

        txn.update(
            record_ref,
            {
                "status": "Returned",
                "return_date": final_return_date,
                "returned_by": current_user.get("_id"),
                "returned_by_role": current_user.get("role"),
                "updated_at": now,
            },
        )
        txn.update(
            book_ref,
            {
                "available_copies": Increment(1),
                "updated_at": now,
            },
        )
        return True

    did_update = _commit_return(transaction)
    if did_update is False:
        refreshed = doc_to_dict(record_ref.get())
        if not refreshed:
            raise HTTPException(status_code=404, detail="Borrow record not found")
        return _annotate_idempotent_return(refreshed)

    try:
        reservation = _find_next_reservation_for_book(record["book_id"])
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
    except Exception:
        # Return should succeed even if reservation notification dispatch fails.
        pass

    updated = doc_to_dict(record_ref.get())
    return serialize_document(updated)


def _build_borrow_health(limit: int = 300):
    db = get_db()
    docs = [doc_to_dict(doc) for doc in db.borrow_records.limit(limit).stream() if doc.exists]

    total_records = len(docs)
    active_records = 0
    returned_records = 0
    reserved_records = 0
    unknown_status_records = 0
    missing_book_reference_records = 0
    invalid_due_date_records = 0

    for record in docs:
        status = (record or {}).get("status")
        if status in ACTIVE_BORROW_STATUSES:
            active_records += 1
        elif status in TERMINAL_BORROW_STATUSES:
            returned_records += 1
        elif status == "Reserved":
            reserved_records += 1
        else:
            unknown_status_records += 1

        due = _coerce_datetime((record or {}).get("due_date"))
        if status in ACTIVE_BORROW_STATUSES and not due:
            invalid_due_date_records += 1

        book_id = (record or {}).get("book_id")
        if not book_id:
            missing_book_reference_records += 1
        else:
            book_doc = db.books.document(book_id).get()
            if not book_doc.exists:
                missing_book_reference_records += 1

    return {
        "ok": unknown_status_records == 0 and invalid_due_date_records == 0 and missing_book_reference_records == 0,
        "checked_records": total_records,
        "limit": limit,
        "counts": {
            "active": active_records,
            "returned": returned_records,
            "reserved": reserved_records,
            "unknown_status": unknown_status_records,
        },
        "anomalies": {
            "missing_book_reference_records": missing_book_reference_records,
            "invalid_due_date_records": invalid_due_date_records,
        },
        "known_statuses": sorted(KNOWN_BORROW_STATUSES),
        "checked_at": datetime.utcnow().isoformat(),
    }


@router.post("/return-by-book/{book_id}")
def return_by_book(book_id: str, current_user: dict = Depends(get_current_student)):
    db = get_db()

    resolved_snapshot = _find_book_by_id_or_isbn(db, book_id)
    resolved_id = doc_to_dict(resolved_snapshot)["_id"] if resolved_snapshot else book_id

    candidates = [
        doc_to_dict(doc)
        for doc in db.borrow_records.where("book_id", "==", resolved_id).stream()
        if doc.exists
    ]
    active_candidates = [item for item in candidates if item and item.get("status") in ACTIVE_BORROW_STATUSES]

    if current_user["role"] == "student":
        active_candidates = [item for item in active_candidates if item.get("student_id") == current_user["_id"]]

    active_candidates.sort(key=lambda item: item.get("borrow_date") or datetime.min, reverse=True)
    record = active_candidates[0] if active_candidates else None

    if not record:
        raise HTTPException(status_code=404, detail="No active borrow record found for this book.")

    if current_user["role"] == "student" and record.get("student_id") != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Students can only return their own borrowed books")

    return _mark_returned(record["_id"], current_user)


@router.post("/return")
def return_book(payload: ReturnRequest, current_user: dict = Depends(get_current_student)):
    return _mark_returned(payload.borrow_record_id, current_user, payload.return_date)


@router.get("/borrow/health")
def borrow_system_health(
    limit: int = Query(default=300, ge=1, le=1000),
    current_user: dict = Depends(get_current_librarian),
):
    return _build_borrow_health(limit)


@router.get("/admin/borrow-health")
def legacy_borrow_system_health(
    limit: int = Query(default=300, ge=1, le=1000),
    current_user: dict = Depends(get_current_librarian),
):
    return _build_borrow_health(limit)


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

    if record.get("status") in ACTIVE_BORROW_STATUSES:
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
