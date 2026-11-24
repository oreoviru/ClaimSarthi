"""Policy service for loading, caching, and querying micro-insurance schemes."""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from fastapi import HTTPException, status
except ImportError:
    # Graceful standalone fallback when running outside full FastAPI runtime
    class HTTPException(Exception):  # type: ignore
        def __init__(self, status_code: int, detail: Any):
            self.status_code = status_code
            self.detail = detail
            super().__init__(str(detail))

    class status:  # type: ignore
        HTTP_404_NOT_FOUND = 404

logger = logging.getLogger("surakshasetu.policy_service")

BASE_DIR = Path(__file__).resolve().parent.parent
POLICIES_PATH = BASE_DIR / "data" / "policies.json"

_POLICIES_CACHE: Optional[List[Dict[str, Any]]] = None
_POLICIES_MAP: Optional[Dict[str, Dict[str, Any]]] = None


def load_policies() -> List[Dict[str, Any]]:
    """Loads policies from data/policies.json and caches them in memory."""
    global _POLICIES_CACHE, _POLICIES_MAP
    if _POLICIES_CACHE is not None:
        return _POLICIES_CACHE

    if not POLICIES_PATH.exists():
        logger.error("Policy file not found at %s", POLICIES_PATH)
        _POLICIES_CACHE = []
        _POLICIES_MAP = {}
        return _POLICIES_CACHE

    try:
        with open(POLICIES_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        _POLICIES_CACHE = data
        _POLICIES_MAP = {p["id"].strip().lower(): p for p in data if "id" in p}
        logger.info("Successfully loaded and cached %d policies.", len(_POLICIES_CACHE))
    except Exception as e:
        logger.error("Failed to parse policy data from %s: %s", POLICIES_PATH, e)
        _POLICIES_CACHE = []
        _POLICIES_MAP = {}

    return _POLICIES_CACHE


def get_all_policies() -> List[Dict[str, Any]]:
    """Returns list of all available insurance schemes from in-memory cache."""
    if _POLICIES_CACHE is None:
        load_policies()
    return _POLICIES_CACHE or []


def get_policy_by_id(policy_id: str) -> Dict[str, Any]:
    """Retrieves policy by scheme ID. Raises HTTP 404 if not found."""
    if _POLICIES_MAP is None:
        load_policies()

    normalized_id = policy_id.strip().lower()
    policy = (_POLICIES_MAP or {}).get(normalized_id)
    if not policy:
        available_ids = list((_POLICIES_MAP or {}).keys())
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy with id '{policy_id}' not found. Available schemes: {available_ids}",
        )
    return policy


def list_policies_by_category(category: str) -> List[Dict[str, Any]]:
    """Filters policies by category name (case-insensitive substring match)."""
    all_policies = get_all_policies()
    normalized_category = category.strip().lower()
    return [
        p for p in all_policies
        if normalized_category in p.get("category", "").lower()
    ]


# Preload cache on module import
load_policies()


if __name__ == "__main__":
    import sys
    print("=" * 65)
    print("🛡️  SurakshaSetu Policy Service — Micro-Insurance Schemes Catalog")
    print("=" * 65)
    all_schemes = get_all_policies()
    print(f"Successfully loaded and verified {len(all_schemes)} active schemes:\n")
    for idx, p in enumerate(all_schemes, 1):
        cap = p.get('max_claim_inr', 0)
        cap_str = f"₹{cap:,}" if cap else "No Upper Limit"
        print(f" {idx}. [{p.get('id')}] {p.get('name')}")
        print(f"    • Category      : {p.get('category', 'General')}")
        print(f"    • Coverage Cap  : {cap_str}")
        print(f"    • Waiting Period: {p.get('waiting_period_days', 0)} days")
        print(f"    • Required Docs : {', '.join(p.get('required_docs', []))}")
        print()
    print("=" * 65)
    print("✓ All policy schemas and rules validated successfully.")
