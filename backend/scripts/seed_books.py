from datetime import datetime

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from firebase_client import get_firestore_client
from services.covers import build_cover, needs_refresh


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
    "Design Principles",
    "Systems Analysis",
    "Control & Automation",
    "Materials & Processes",
    "Thermodynamics",
    "Signals & Circuits",
    "Structures & Loads",
    "Simulation Lab",
    "Project Handbook",
]

AUTHORS = [
    "Dr. A. Menon",
    "Prof. K. Rao",
    "N. Kapoor",
    "R. Chatterjee",
    "S. Narayanan",
    "T. Iyer",
    "L. Fernandez",
    "M. Banerjee",
    "P. Kulkarni",
    "J. Varghese",
]

BIOGRAPHIES = [
    {
        "title": "Steve Jobs",
        "author": "Walter Isaacson",
        "isbn": "9781451648539",
        "description": "A definitive biography of Apple's visionary co-founder and his impact on technology and design.",
        "rack_location": "BIO-1",
    },
    {
        "title": "The Diary of a Young Girl",
        "author": "Anne Frank",
        "isbn": "9780553296983",
        "description": "Anne Frank's poignant wartime diary offering a timeless account of courage and hope.",
        "rack_location": "BIO-2",
    },
    {
        "title": "Long Walk to Freedom",
        "author": "Nelson Mandela",
        "isbn": "9780316548182",
        "description": "Nelson Mandela's autobiography tracing his journey from activist to president of South Africa.",
        "rack_location": "BIO-3",
    },
    {
        "title": "Becoming",
        "author": "Michelle Obama",
        "isbn": "9781524763138",
        "description": "A memoir about resilience, identity, and leadership from the former First Lady of the United States.",
        "rack_location": "BIO-4",
    },
    {
        "title": "Educated",
        "author": "Tara Westover",
        "isbn": "9780399590504",
        "description": "A story of self-invention and the transformative power of education.",
        "rack_location": "BIO-5",
    },
    {
        "title": "I Am Malala",
        "author": "Malala Yousafzai",
        "isbn": "9780316322409",
        "description": "The inspiring story of a young activist who stood up for education and human rights.",
        "rack_location": "BIO-6",
    },
    {
        "title": "The Wright Brothers",
        "author": "David McCullough",
        "isbn": "9781476728759",
        "description": "A richly detailed biography of the inventors who changed the course of aviation.",
        "rack_location": "BIO-7",
    },
    {
        "title": "Einstein: His Life and Universe",
        "author": "Walter Isaacson",
        "isbn": "9780743264747",
        "description": "A compelling portrait of Albert Einstein's scientific breakthroughs and personal life.",
        "rack_location": "BIO-8",
    },
]


def should_refresh_cover(cover) -> bool:
    return needs_refresh(cover)


def seed():
    db = get_firestore_client()
    created = 0
    skipped = 0
    index = 1

    for branch, code in BRANCHES:
        for topic in TOPICS:
            isbn = f"{9780000000000 + index}"
            title = f"{branch}: {topic}"
            author = AUTHORS[(index - 1) % len(AUTHORS)]
            description = f"{topic} reference for {branch} students with practical examples and lab-ready exercises."
            rack_location = f"ENG-{code}-{(index - 1) % 10 + 1}"

            existing = list(db.collection("books").where("isbn", "==", isbn).limit(1).stream())
            if existing:
                existing_doc = existing[0]
                existing_data = existing_doc.to_dict() if existing_doc else {}
                if should_refresh_cover(existing_data.get("cover_image")):
                    existing_doc.reference.update({
                        "cover_image": build_cover(isbn),
                        "updated_at": datetime.utcnow(),
                    })
                skipped += 1
                index += 1
                continue

            book_doc = {
                "title": title,
                "author": author,
                "category": branch,
                "isbn": isbn,
                "description": description,
                "rack_location": rack_location,
                "total_copies": 5,
                "available_copies": 5,
                "cover_image": build_cover(isbn),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }

            db.collection("books").document().set(book_doc)
            created += 1
            index += 1

    for entry in BIOGRAPHIES:
        isbn = entry["isbn"]
        existing = list(db.collection("books").where("isbn", "==", isbn).limit(1).stream())
        if existing:
            existing_doc = existing[0]
            existing_data = existing_doc.to_dict() if existing_doc else {}
            if should_refresh_cover(existing_data.get("cover_image")):
                existing_doc.reference.update({
                    "cover_image": build_cover(isbn),
                    "updated_at": datetime.utcnow(),
                })
            skipped += 1
            continue

        book_doc = {
            "title": entry["title"],
            "author": entry["author"],
            "category": "Biography",
            "isbn": isbn,
            "description": entry["description"],
            "rack_location": entry["rack_location"],
            "total_copies": 4,
            "available_copies": 4,
            "cover_image": build_cover(isbn),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }

        db.collection("books").document().set(book_doc)
        created += 1

    print(f"Seed complete. Created: {created}, Skipped: {skipped}")


if __name__ == "__main__":
    seed()
