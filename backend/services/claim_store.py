"""Thread-safe persistent JSON claim store for SurakshaSetu."""

import json
import logging
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from models import (
    ClaimRecord,
    ExtractedBillData,
    ItemizedCharge,
    ReviewerStatusType,
    RuleCheckResult,
    SubmitClaimRequest,
)

logger = logging.getLogger("surakshasetu.claim_store")

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CLAIMS_FILE = DATA_DIR / "claims.json"

_STORE_LOCK = threading.RLock()


def _get_seed_claims() -> List[Dict[str, Any]]:
    """Generates two realistic historical claim dossiers so the Insurer Queue is populated."""
    return [
        {
            "claim_id": "CLM-2026-0001",
            "policy_id": "micro_health_gig",
            "policy_name": "Gig-Worker Micro-Health Clinic Shield",
            "claimant_name": "Vikram Patel",
            "claimant_phone": "9876543210",
            "claimant_aadhaar_last4": "8821",
            "bank_account_number": "501004829104",
            "bank_ifsc": "HDFC0001245",
            "claimed_amount_inr": 3200.0,
            "approved_amount_inr": 3200.0,
            "reviewer_status": "READY_TO_APPROVE",
            "document_paths": ["/uploads/seed_bill_01.jpg"],
            "incident_description": "Acute food poisoning with severe dehydration after delivery shift.",
            "extracted_data": {
                "document_type": "clinic_opd_bill",
                "provider_name": "LifeLine Daycare Clinic, Ahmedabad",
                "patient_or_claimant_name": "Vikram Patel",
                "incident_or_bill_date": "2026-02-14",
                "diagnosis_or_event": "Acute Food Poisoning & Dehydration",
                "itemized_charges": [
                    {"item_name": "Emergency Consultation & Vitals", "amount_inr": 400.0, "category": "consultation", "is_covered": True},
                    {"item_name": "IV Saline & Electrolyte Infusion", "amount_inr": 1200.0, "category": "procedure", "is_covered": True},
                    {"item_name": "Ciprofloxacin & Antiemetic Injections", "amount_inr": 1600.0, "category": "pharmacy", "is_covered": True}
                ],
                "total_amount_inr": 3200.0,
                "has_stamp_or_signature": True,
                "legibility_score": 0.94,
                "field_confidences": {"provider_name": 0.96, "total_amount_inr": 0.98, "incident_or_bill_date": 0.95},
                "unreadable_fields": []
            },
            "rule_checks": [
                {"rule_id": "RULE_AGE_WINDOW", "label": "Age Window Check", "status": "PASS", "explanation": "Age 27 is within 18–60 range."},
                {"rule_id": "RULE_WAITING_LIEN_PERIOD", "label": "Waiting Period", "status": "PASS", "explanation": "Claim occurred 65 days after enrollment (exceeds 15-day requirement)."},
                {"rule_id": "RULE_CLAIM_TYPE_COMPATIBILITY", "label": "Scope Match", "status": "PASS", "explanation": "Daycare clinic OPD bill compatible with Micro-Health Shield."},
                {"rule_id": "RULE_COVERAGE_CAP", "label": "Policy Cap", "status": "PASS", "explanation": "Claim of ₹3,200 is within the ₹5,000 per-claim ceiling."},
                {"rule_id": "RULE_EXCLUSION_SCANNER", "label": "Exclusion Scanner", "status": "PASS", "explanation": "No disallowed cosmetics, tonics, or vitamins detected."},
                {"rule_id": "RULE_REQUIRED_DOCUMENTS", "label": "Checklist", "status": "PASS", "explanation": "Doctor prescription and itemized clinic invoice attached."}
            ],
            "reviewer_notes": "All medical expenses verified against doctor's prescription. Pre-approved for instant UPI reimbursement.",
            "created_at": "2026-02-15T10:30:00Z",
            "updated_at": "2026-02-15T10:30:00Z"
        },
        {
            "claim_id": "CLM-2026-0002",
            "policy_id": "pmsby",
            "policy_name": "Pradhan Mantri Suraksha Bima Yojana",
            "claimant_name": "Sunita Devi (Nominee)",
            "claimant_phone": "9123456780",
            "claimant_aadhaar_last4": "4392",
            "bank_account_number": "31049281749",
            "bank_ifsc": "SBIN0004812",
            "claimed_amount_inr": 200000.0,
            "approved_amount_inr": 200000.0,
            "reviewer_status": "NEEDS_REVIEW",
            "document_paths": ["/uploads/seed_fir_death_cert.jpg"],
            "incident_description": "Fatal vehicular collision on National Highway involving deceased bank subscriber.",
            "extracted_data": {
                "document_type": "death_certificate",
                "provider_name": "District Civil Hospital & Police Station, Varanasi",
                "patient_or_claimant_name": "Late Rajesh Kumar",
                "incident_or_bill_date": "2026-01-20",
                "diagnosis_or_event": "Fatal road traffic collision trauma",
                "itemized_charges": [],
                "total_amount_inr": 200000.0,
                "has_stamp_or_signature": True,
                "legibility_score": 0.91,
                "field_confidences": {"provider_name": 0.93, "total_amount_inr": 0.95},
                "unreadable_fields": []
            },
            "rule_checks": [
                {"rule_id": "RULE_AGE_WINDOW", "label": "Age Window Check", "status": "PASS", "explanation": "Subscriber was 42 years old (within 18–70 eligibility limit)."},
                {"rule_id": "RULE_WAITING_LIEN_PERIOD", "label": "Lien Check", "status": "PASS", "explanation": "Zero waiting period for accidental mortality under PMSBY."},
                {"rule_id": "RULE_CLAIM_TYPE_COMPATIBILITY", "label": "Scope Match", "status": "PASS", "explanation": "Accidental death claim conforms to PMSBY benefits."},
                {"rule_id": "RULE_COVERAGE_CAP", "label": "Statutory Cap", "status": "PASS", "explanation": "Sum of ₹2,00,000 matches statutory accidental death cover."},
                {"rule_id": "RULE_REQUIRED_DOCUMENTS", "label": "Checklist", "status": "WARNING", "explanation": "FIR and Death Certificate verified; nominee bank passbook stamp requires bank verification."}
            ],
            "reviewer_notes": "Police inquest Panchnama and post-mortem verified. Needs final bank branch verification before DBT dispatch.",
            "created_at": "2026-01-25T14:15:00Z",
            "updated_at": "2026-01-25T14:15:00Z"
        }
    ]


def _ensure_file_initialized() -> None:
    """Ensures data/claims.json exists, initialized with seed data if absent."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not CLAIMS_FILE.exists():
        logger.info("Initializing claims store with 2 realistic historical claims at %s", CLAIMS_FILE)
        seeds = _get_seed_claims()
        with open(CLAIMS_FILE, "w", encoding="utf-8") as f:
            json.dump(seeds, f, indent=2)


def get_all_raw_claims() -> List[Dict[str, Any]]:
    """Thread-safe read of all claims as dictionaries from data/claims.json."""
    with _STORE_LOCK:
        _ensure_file_initialized()
        try:
            with open(CLAIMS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error("Error reading %s: %s", CLAIMS_FILE, e)
            return []


def _save_raw_claims(claims: List[Dict[str, Any]]) -> None:
    """Thread-safe persistence of claims array to data/claims.json."""
    _ensure_file_initialized()
    temp_file = CLAIMS_FILE.with_suffix(".tmp")
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(claims, f, indent=2, default=str)
    temp_file.replace(CLAIMS_FILE)


def generate_claim_id() -> str:
    """Generates next formatted reference ID in CLM-YYYY-XXXX format (e.g. CLM-2026-0041)."""
    current_year = datetime.now().year
    prefix = f"CLM-{current_year}-"

    claims = get_all_raw_claims()
    max_seq = 0
    for c in claims:
        cid = c.get("claim_id", "")
        if cid.startswith(prefix):
            try:
                seq = int(cid.split("-")[-1])
                if seq > max_seq:
                    max_seq = seq
            except ValueError:
                pass

    next_seq = max(max_seq + 1, 41)
    return f"{prefix}{next_seq:04d}"


def get_all_claims() -> List[ClaimRecord]:
    """Returns all claims as parsed ClaimRecord models."""
    raw_list = get_all_raw_claims()
    results = []
    for raw in raw_list:
        try:
            results.append(ClaimRecord(**raw))
        except Exception as e:
            logger.warning("Could not parse claim %s into ClaimRecord: %s", raw.get("claim_id"), e)
    return results


def get_claim_by_id(claim_id: str) -> Optional[ClaimRecord]:
    """Retrieves a single claim record by ID."""
    clean_id = claim_id.strip().upper()
    claims = get_all_raw_claims()
    for c in claims:
        if c.get("claim_id", "").strip().upper() == clean_id:
            try:
                return ClaimRecord(**c)
            except Exception:
                return None
    return None


def save_claim(
    submit_req: SubmitClaimRequest,
    policy_name: str,
    approved_amount: Optional[float] = None,
    rule_scorecard: Optional[List[RuleCheckResult]] = None,
    status: Optional[ReviewerStatusType] = None
) -> ClaimRecord:
    """
    Constructs, persists, and returns a new ClaimRecord in data/claims.json.
    Assigns a formatted ID like CLM-2026-0041 and initial queue status.
    """
    with _STORE_LOCK:
        new_claim_id = generate_claim_id()
        now_iso = datetime.utcnow().isoformat() + "Z"

        # Determine initial queue status
        initial_status = status or submit_req.initial_status
        if not initial_status:
            scorecard = rule_scorecard or submit_req.rule_checks
            has_fail = any(r.status == "FAIL" for r in scorecard)
            has_warning = any(r.status == "WARNING" for r in scorecard)
            if has_fail or has_warning:
                initial_status = "NEEDS_REVIEW"
            else:
                initial_status = "READY_TO_APPROVE"

        # Determine claimed & approved amounts
        claimed_amt = submit_req.claimed_amount_inr or 0.0
        if claimed_amt == 0.0 and submit_req.extracted_data and submit_req.extracted_data.total_amount_inr:
            claimed_amt = submit_req.extracted_data.total_amount_inr

        final_approved = approved_amount if approved_amount is not None else submit_req.eligible_payout_inr
        if final_approved is None:
            final_approved = claimed_amt

        record_dict = {
            "claim_id": new_claim_id,
            "policy_id": submit_req.policy_id,
            "policy_name": policy_name,
            "claimant_name": submit_req.claimant_name,
            "claimant_phone": submit_req.claimant_phone,
            "claimant_aadhaar_last4": submit_req.claimant_aadhaar_last4,
            "bank_account_number": submit_req.bank_account_number,
            "bank_ifsc": submit_req.bank_ifsc,
            "claimed_amount_inr": claimed_amt,
            "approved_amount_inr": final_approved,
            "reviewer_status": initial_status,
            "document_paths": submit_req.document_paths,
            "extracted_data": submit_req.extracted_data.model_dump() if submit_req.extracted_data else None,
            "rule_checks": [r.model_dump() for r in (rule_scorecard or submit_req.rule_checks)],
            "reviewer_notes": submit_req.reviewer_notes or "Submitted via SurakshaSetu self-service portal.",
            "created_at": now_iso,
            "updated_at": now_iso,
        }

        # Read current, append, and atomic write
        current_claims = get_all_raw_claims()
        current_claims.append(record_dict)
        _save_raw_claims(current_claims)

        logger.info("Successfully persisted new claim %s to %s", new_claim_id, CLAIMS_FILE)
        return ClaimRecord(**record_dict)


def update_claim_status(
    claim_id: str,
    new_status: ReviewerStatusType,
    approved_amount: Optional[float] = None,
    notes: Optional[str] = None,
    decision_timestamp: Optional[str] = None
) -> Optional[ClaimRecord]:
    """Updates status, approved payout, notes, and decision timestamp for an existing claim."""
    with _STORE_LOCK:
        claims = get_all_raw_claims()
        clean_id = claim_id.strip().upper()
        found_idx = None

        for idx, c in enumerate(claims):
            if c.get("claim_id", "").strip().upper() == clean_id:
                found_idx = idx
                break

        if found_idx is None:
            return None

        target = claims[found_idx]
        target["reviewer_status"] = new_status
        if approved_amount is not None:
            target["approved_amount_inr"] = approved_amount
        if notes:
            target["reviewer_notes"] = notes
        now_iso = datetime.utcnow().isoformat() + "Z"
        dec_time = decision_timestamp or now_iso
        target["decision_timestamp"] = dec_time
        target["decided_at"] = dec_time
        target["updated_at"] = now_iso

        claims[found_idx] = target
        _save_raw_claims(claims)

        return ClaimRecord(**target)


def get_claims_dashboard() -> Dict[str, Any]:
    """
    Returns all submitted claims sorted newest-first plus computed dashboard summary metrics:
    - total_claims
    - ready_to_approve
    - needs_review
    - approved_count
    - prevented_rejections_count
    - claims (List[ClaimRecord])
    """
    claims = get_all_claims()

    # Sort newest-first (descending by created_at)
    def _parse_created_at(c: ClaimRecord):
        if isinstance(c.created_at, datetime):
            return c.created_at
        try:
            return datetime.fromisoformat(str(c.created_at).replace("Z", "+00:00"))
        except Exception:
            return datetime.min

    claims.sort(key=_parse_created_at, reverse=True)

    total_claims = len(claims)
    ready_to_approve = sum(1 for c in claims if c.reviewer_status == "READY_TO_APPROVE")
    needs_review = sum(1 for c in claims if c.reviewer_status == "NEEDS_REVIEW")
    approved_count = sum(1 for c in claims if c.reviewer_status == "APPROVED")

    # Prevented rejections count:
    # Measures claims where pre-validation audited rules, flagged exclusions/caps/warnings,
    # or prepared the claim so it was not rejected outright by the insurer
    prevented_rejections = 0
    for c in claims:
        has_warnings = any(r.status == "WARNING" for r in (c.rule_checks or []))
        has_exclusions = False
        if c.extracted_data and c.extracted_data.itemized_charges:
            has_exclusions = any(not item.is_covered for item in c.extracted_data.itemized_charges)
        has_deduction = (c.claimed_amount_inr or 0.0) > (c.approved_amount_inr or 0.0)
        is_viable = c.reviewer_status in ("READY_TO_APPROVE", "APPROVED", "NEEDS_REVIEW")

        if is_viable and (has_warnings or has_exclusions or has_deduction or c.reviewer_status == "READY_TO_APPROVE"):
            prevented_rejections += 1

    return {
        "total_claims": total_claims,
        "ready_to_approve": ready_to_approve,
        "needs_review": needs_review,
        "approved_count": approved_count,
        "prevented_rejections_count": max(prevented_rejections, ready_to_approve + approved_count),
        "claims": claims,
    }


# Initialize on import
_ensure_file_initialized()
