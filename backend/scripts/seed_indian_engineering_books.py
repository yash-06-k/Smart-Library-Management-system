from datetime import datetime
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from firebase_client import get_firestore_client
from services.covers import build_cover


BRANCHES = [
    ("Computer Engineering", "CE"),
    ("Electrical Engineering", "EE"),
    ("Mechanical Engineering", "ME"),
    ("Civil Engineering", "CV"),
    ("Electronics & Communication", "EC"),
    ("Chemical Engineering", "CH"),
    ("Aerospace Engineering", "AE"),
    ("Biomedical Engineering", "BE"),
    ("Industrial Engineering", "IE"),
    ("Environmental Engineering", "EN"),
]

TOPICS = [
    "Fundamentals",
    "Design and Analysis",
    "Applied Mathematics",
    "Control Systems",
    "Materials and Manufacturing",
    "Modeling and Simulation",
    "Practical Laboratory Guide",
    "Instrumentation and Measurement",
    "Project Practice Handbook",
    "Sustainable Engineering",
]

INDIAN_AUTHORS = [
    "Dr. A. K. Verma",
    "Prof. R. Srinivasan",
    "Dr. N. Raghavan",
    "Prof. P. Banerjee",
    "Dr. M. Subramanian",
    "Prof. S. K. Gupta",
    "Dr. V. R. Iyer",
    "Prof. D. Chatterjee",
    "Dr. T. Narayan",
    "Prof. K. Bhattacharya",
    "Dr. L. Maheshwari",
    "Prof. G. S. Rao",
    "Dr. H. K. Kulkarni",
    "Prof. B. R. Joshi",
    "Dr. C. Krishnamurthy",
    "Prof. J. N. Mehta",
    "Dr. E. Ramachandran",
    "Prof. Y. S. Nair",
    "Dr. U. K. Pillai",
    "Prof. F. Ahmed",
]


def _normalize_isbn(value: str | None) -> str:
    if not value:
        return ""
    return "".join([ch for ch in value if ch.isdigit() or ch in "Xx"]).upper()


def _existing_isbn_set(db):
    values: set[str] = set()
    for doc in db.collection("books").stream():
        if not doc.exists:
            continue
        data = doc.to_dict() or {}
        normalized = _normalize_isbn(data.get("isbn"))
        if normalized:
            values.add(normalized)
    return values


def seed():
    db = get_firestore_client()
    existing_isbns = _existing_isbn_set(db)

    created = 0
    skipped = 0
    index = 1

    for branch_code, (branch, rack_code) in enumerate(BRANCHES, start=1):
        for topic_index, topic in enumerate(TOPICS, start=1):
            isbn = f"979{branch_code:02d}{topic_index:02d}{index:06d}"
            normalized_isbn = _normalize_isbn(isbn)
            title = f"{branch}: {topic}"
            author = INDIAN_AUTHORS[(index - 1) % len(INDIAN_AUTHORS)]
            rack_location = f"IND-{rack_code}-{topic_index}"
            description = (
                f"{topic} for {branch} by Indian faculty references, "
                "with solved examples and practical implementation guidance."
            )

            if normalized_isbn in existing_isbns:
                skipped += 1
                index += 1
                continue

            book_doc = {
                "title": title,
                "author": author,
                "category": branch,
                "isbn": normalized_isbn,
                "isbn_normalized": normalized_isbn,
                "description": description,
                "rack_location": rack_location,
                "total_copies": 6,
                "available_copies": 6,
                "cover_image": build_cover(normalized_isbn),
                "source": "seed_indian_engineering_100",
                "created_by": "seed-script",
                "created_by_role": "system",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }

            db.collection("books").document().set(book_doc)
            existing_isbns.add(normalized_isbn)
            created += 1
            index += 1

    print(f"Indian engineering seed complete. Created: {created}, Skipped: {skipped}, Total attempted: 100")


if __name__ == "__main__":
    seed()
