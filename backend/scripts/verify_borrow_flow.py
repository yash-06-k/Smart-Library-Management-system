"""Verify borrow -> persist -> return flow on a target backend.

Usage:
  python backend/scripts/verify_borrow_flow.py --base-url https://your-backend.onrender.com
"""

from __future__ import annotations

import argparse
import json
import time
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class HttpResult:
    status: int
    data: Any
    raw: str


def _build_url(base_url: str, path: str) -> str:
    return urllib.parse.urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))


def request_json(
    base_url: str,
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
    timeout_seconds: int = 30,
    retries: int = 2,
) -> HttpResult:
    url = _build_url(base_url, path)
    body = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url=url, method=method.upper(), headers=headers, data=body)
    attempts = retries + 1
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
                raw = response.read().decode("utf-8")
                data = json.loads(raw) if raw else {}
                return HttpResult(status=response.getcode(), data=data, raw=raw)
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8")
            try:
                data = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                data = {"detail": raw}
            return HttpResult(status=exc.code, data=data, raw=raw)
        except (TimeoutError, urllib.error.URLError):
            if attempt >= attempts - 1:
                raise
            time.sleep(2 * (attempt + 1))

    raise RuntimeError("unreachable")


def pick_available_book(books: list[dict[str, Any]]) -> dict[str, Any] | None:
    for book in books:
        available = int(book.get("available_copies") or 0)
        if available > 0:
            return book
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify borrow and return persistence end-to-end.")
    parser.add_argument("--base-url", default="http://localhost:8000", help="Backend base URL")
    parser.add_argument("--book-id", default="", help="Optional fixed book id to test")
    parser.add_argument("--limit", type=int, default=300, help="How many records/books to fetch for verification")
    parser.add_argument("--timeout", type=int, default=30, help="Per-request timeout in seconds")
    parser.add_argument("--retries", type=int, default=2, help="Retry count for network timeouts")
    args = parser.parse_args()

    summary: dict[str, Any] = {
        "base_url": args.base_url,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ok": False,
    }

    health = request_json(args.base_url, "GET", "/health", timeout_seconds=args.timeout, retries=args.retries)
    summary["health"] = {
        "status": health.status,
        "payload": health.data,
    }
    if health.status != 200:
        summary["failure"] = "health_check_failed"
        print(json.dumps(summary, indent=2))
        return 1

    books_res = request_json(
        args.base_url,
        "GET",
        f"/books?limit={args.limit}",
        timeout_seconds=args.timeout,
        retries=args.retries,
    )
    if books_res.status != 200 or not isinstance(books_res.data, list):
        summary["failure"] = "books_fetch_failed"
        summary["books_response"] = {"status": books_res.status, "payload": books_res.data}
        print(json.dumps(summary, indent=2))
        return 1

    if args.book_id:
        chosen = next((item for item in books_res.data if item.get("_id") == args.book_id), None)
    else:
        chosen = pick_available_book(books_res.data)

    if not chosen:
        summary["failure"] = "no_available_book_found"
        print(json.dumps(summary, indent=2))
        return 1

    book_id = chosen.get("_id")
    before_count = int(chosen.get("available_copies") or 0)
    summary["book"] = {
        "id": book_id,
        "title": chosen.get("title"),
        "available_before": before_count,
    }

    borrow = request_json(
        args.base_url,
        "POST",
        "/borrow",
        {"book_id": book_id},
        timeout_seconds=args.timeout,
        retries=args.retries,
    )
    summary["borrow"] = {"status": borrow.status, "payload": borrow.data}
    if borrow.status != 200:
        summary["failure"] = "borrow_failed"
        print(json.dumps(summary, indent=2))
        return 1

    borrow_record_id = str((borrow.data or {}).get("_id") or "")
    if not borrow_record_id:
        summary["failure"] = "borrow_record_missing_id"
        print(json.dumps(summary, indent=2))
        return 1

    after_borrow_res = request_json(
        args.base_url,
        "GET",
        f"/books/{book_id}",
        timeout_seconds=args.timeout,
        retries=args.retries,
    )
    summary["book_after_borrow"] = {"status": after_borrow_res.status, "payload": after_borrow_res.data}
    if after_borrow_res.status != 200:
        summary["failure"] = "book_fetch_after_borrow_failed"
        print(json.dumps(summary, indent=2))
        return 1

    after_borrow_count = int((after_borrow_res.data or {}).get("available_copies") or 0)
    summary["copy_delta_after_borrow"] = before_count - after_borrow_count

    ret_first = request_json(
        args.base_url,
        "POST",
        "/return",
        {"borrow_record_id": borrow_record_id},
        timeout_seconds=args.timeout,
        retries=args.retries,
    )
    summary["return_first"] = {"status": ret_first.status, "payload": ret_first.data}

    ret_final = ret_first
    if ret_first.status >= 500:
        ret_retry = request_json(
            args.base_url,
            "POST",
            "/return",
            {"borrow_record_id": borrow_record_id},
            timeout_seconds=args.timeout,
            retries=args.retries,
        )
        summary["return_retry"] = {"status": ret_retry.status, "payload": ret_retry.data}
        ret_final = ret_retry

    after_return_res = request_json(
        args.base_url,
        "GET",
        f"/books/{book_id}",
        timeout_seconds=args.timeout,
        retries=args.retries,
    )
    summary["book_after_return"] = {"status": after_return_res.status, "payload": after_return_res.data}
    if after_return_res.status != 200:
        summary["failure"] = "book_fetch_after_return_failed"
        print(json.dumps(summary, indent=2))
        return 1

    after_return_count = int((after_return_res.data or {}).get("available_copies") or 0)
    summary["copy_restored"] = after_return_count == before_count

    records_res = request_json(
        args.base_url,
        "GET",
        f"/borrow-records?limit={args.limit}",
        timeout_seconds=args.timeout,
        retries=args.retries,
    )
    summary["records_lookup_status"] = records_res.status
    found_record = None
    if records_res.status == 200 and isinstance(records_res.data, list):
        found_record = next((item for item in records_res.data if item.get("_id") == borrow_record_id), None)
    summary["record_found_after_return"] = bool(found_record)
    summary["record_status_after_return"] = (found_record or {}).get("status")

    return_ok = ret_final.status == 200 or (
        ret_final.status == 400 and "already returned" in json.dumps(ret_final.data).lower()
    )
    summary["return_effective"] = return_ok

    summary["ok"] = (
        summary["copy_delta_after_borrow"] == 1
        and summary["copy_restored"]
        and summary["return_effective"]
    )
    summary["finished_at"] = datetime.now(timezone.utc).isoformat()

    print(json.dumps(summary, indent=2))
    return 0 if summary["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
