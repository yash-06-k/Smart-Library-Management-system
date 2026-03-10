LEGACY_COVERS = {
    "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1581093588401-22d4e9b8c71b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1580281657521-4b2ad1f6ad0c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80",
}


def build_cover(seed: str) -> str:
    safe_seed = "".join(ch for ch in str(seed) if ch.isalnum() or ch in "-_").lower()
    return f"https://picsum.photos/seed/{safe_seed}/360/520"


def needs_refresh(cover) -> bool:
    if not cover:
        return True
    if isinstance(cover, str):
        if cover.startswith("data:"):
            return False
        if "picsum.photos/seed/" in cover:
            return False
        if "images.unsplash.com" in cover:
            return True
    return cover in LEGACY_COVERS
