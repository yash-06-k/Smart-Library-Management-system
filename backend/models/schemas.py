from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SignupRequest(BaseModel):
    name: str
    email: str
    role: Literal["student", "librarian"]
    firebase_uid: str


class LoginRequest(BaseModel):
    firebase_uid: str | None = None
    email: str | None = None


class UserResponse(BaseModel):
    _id: str
    name: str
    email: str
    role: Literal["student", "librarian"]
    firebase_uid: str | None = None
    created_at: str


class BookCreateRequest(BaseModel):
    title: str
    author: str
    category: str
    isbn: str
    description: str = ""
    rack_location: str | None = None
    total_copies: int = Field(ge=1)
    available_copies: int | None = Field(default=None, ge=0)
    cover_image: str | None = None


class BookUpdateRequest(BaseModel):
    title: str
    author: str
    category: str
    isbn: str
    description: str = ""
    rack_location: str | None = None
    total_copies: int = Field(ge=1)
    available_copies: int = Field(ge=0)
    cover_image: str | None = None


class BulkBooksRequest(BaseModel):
    books: list[BookCreateRequest]


class BorrowRequest(BaseModel):
    student_id: str | None = None
    book_id: str
    borrow_date: datetime | None = None
    due_date: datetime | None = None


class ReturnRequest(BaseModel):
    borrow_record_id: str
    return_date: datetime | None = None


class ExtendBorrowRequest(BaseModel):
    due_date: datetime


class ReserveRequest(BaseModel):
    book_id: str


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = Field(default_factory=list)


class DatabaseStatusResponse(BaseModel):
    database_connected: bool
    message: str
    total_users: int
    total_books: int
    total_borrow_records: int


class AdminMetricsResponse(BaseModel):
    total_books: int
    available_books: int
    issued_books: int
    total_students: int
    borrowed_books: int
    overdue_books: int
    total_borrow_records: int
