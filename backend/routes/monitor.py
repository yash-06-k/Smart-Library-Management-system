from fastapi import APIRouter, Depends

from database import get_db
from services.auth import get_current_librarian

router = APIRouter(tags=["Database Monitor"])


def _status_payload():
    db = get_db()
    connected = db.ping()

    total_users = len(list(db.users.stream())) if connected else 0
    total_books = len(list(db.books.stream())) if connected else 0
    total_borrow_records = len(list(db.borrow_records.stream())) if connected else 0

    return {
        "database_connected": connected,
        "message": "Firestore Connected Successfully" if connected else "Firestore Connection Failed",
        "total_users": total_users,
        "total_books": total_books,
        "total_borrow_records": total_borrow_records,
    }


@router.get("/database-status")
def get_database_status(current_user: dict = Depends(get_current_librarian)):
    return _status_payload()


@router.post("/database-status/check")
def check_database_connection(current_user: dict = Depends(get_current_librarian)):
    return _status_payload()
