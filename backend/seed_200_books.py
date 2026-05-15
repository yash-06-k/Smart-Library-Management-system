import urllib.request
import json
import random
import uuid
import os
import sys
from datetime import datetime

# Adjust Python path to import from backend modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database import get_db

def seed_200_books():
    db = get_db()
    db.connect()
    
    subjects = [
        "science", "history", "fiction", "python", "javascript", 
        "art", "music", "math", "physics", "fantasy", "mystery", 
        "romance", "biography", "philosophy", "business", "design",
        "engineering", "cooking", "travel", "poetry"
    ]
    books_added = 0
    seen_isbns = set()
    
    for subject in subjects:
        if books_added >= 200:
            break
            
        print(f"Fetching books for subject: {subject}")
        url = f"https://openlibrary.org/search.json?q={subject}&limit=15"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        
        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read())
                
                for doc in data.get("docs", []):
                    if books_added >= 200:
                        break
                        
                    isbns = doc.get("isbn", [])
                    isbn = next((i for i in isbns if len(i) == 13), None) or (isbns[0] if isbns else None)
                    if not isbn:
                        isbn = "IS-" + str(uuid.uuid4())[:10]
                        
                    if isbn in seen_isbns:
                        continue
                    seen_isbns.add(isbn)
                    
                    title = doc.get("title", "Unknown Title")
                    authors = doc.get("author_name", ["Unknown Author"])
                    author = authors[0] if authors else "Unknown Author"
                    
                    book_doc = {
                        "title": title,
                        "author": author,
                        "category": subject.capitalize(),
                        "isbn": isbn,
                        "description": "An excellent resource added automatically to the library.",
                        "rack_location": f"Rack {random.randint(1, 20)}",
                        "total_copies": random.randint(2, 8),
                        "cover_image": f"https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg" if isbn.isdigit() else None,
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                    }
                    book_doc["available_copies"] = book_doc["total_copies"]
                    
                    db.books.document().set(book_doc)
                    books_added += 1
                    print(f"Added [{books_added}/200]: {title}")
                    
        except Exception as e:
            print(f"Error fetching {subject}: {e}")
            
    print(f"\nDone! Added {books_added} books successfully.")

if __name__ == "__main__":
    seed_200_books()
