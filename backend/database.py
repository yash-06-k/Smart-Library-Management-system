from datetime import date, datetime
from typing import Any

from fastapi import HTTPException

from firebase_client import FIREBASE_ERROR, get_firestore_client


class FirestoreDatabase:
    def __init__(self) -> None:
        self.client = None
        self.last_error: str | None = None

        self._users = None
        self._books = None
        self._borrow_records = None
        self._categories = None
        self._notifications = None

    def connect(self, raise_on_error: bool = True) -> None:
        try:
            self.client = get_firestore_client()
            self.last_error = None
        except Exception as exc:
            self.client = None
            self.last_error = str(exc)
            self._users = None
            self._books = None
            self._borrow_records = None
            self._categories = None
            self._notifications = None
            if raise_on_error:
                raise
            return

        self._users = self.client.collection("users")
        self._books = self.client.collection("books")
        self._borrow_records = self.client.collection("borrow_records")
        self._categories = self.client.collection("categories")
        self._notifications = self.client.collection("notifications")

    def close(self) -> None:
        self.client = None
        self._users = None
        self._books = None
        self._borrow_records = None
        self._categories = None
        self._notifications = None

    def ping(self) -> bool:
        if not self.client:
            return False
        try:
            list(self.client.collections())
            return True
        except Exception:
            return False

    @property
    def connected(self) -> bool:
        return self.client is not None

    def _require_connected(self) -> None:
        if not self.connected:
            detail = "Firestore is not connected"
            if self.last_error:
                detail = f"{detail}: {self.last_error}"
            elif FIREBASE_ERROR:
                detail = f"{detail}: {FIREBASE_ERROR}"
            raise HTTPException(status_code=503, detail=detail)

    @property
    def users(self):
        self._require_connected()
        return self._users

    @property
    def books(self):
        self._require_connected()
        return self._books

    @property
    def borrow_records(self):
        self._require_connected()
        return self._borrow_records

    @property
    def categories(self):
        self._require_connected()
        return self._categories

    @property
    def notifications(self):
        self._require_connected()
        return self._notifications


firestore_db = FirestoreDatabase()


def get_db() -> FirestoreDatabase:
    return firestore_db


def doc_to_dict(document_snapshot) -> dict[str, Any] | None:
    if not document_snapshot or not getattr(document_snapshot, "exists", False):
        return None
    data = document_snapshot.to_dict() or {}
    data["_id"] = document_snapshot.id
    return data


def serialize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time()).isoformat()
    if isinstance(value, list):
        return [serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {k: serialize_value(v) for k, v in value.items()}
    return value


def serialize_document(document: dict[str, Any]) -> dict[str, Any]:
    return {key: serialize_value(value) for key, value in document.items()}
