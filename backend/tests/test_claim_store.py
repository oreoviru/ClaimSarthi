"""Tests for services/claim_store.py and POST /api/submit-claim in server.py."""

import asyncio
import json
import os
import shutil
import tempfile
from pathlib import Path

from models import ExtractedBillData, RuleCheckResult, SubmitClaimRequest, ClaimRecord
from services.claim_store import (
    generate_claim_id,
    get_all_claims,
    get_all_raw_claims,
    get_claim_by_id,
    save_claim,
    update_claim_status,
    CLAIMS_FILE,
)
from server import submit_claim_endpoint, list_all_claims_endpoint, get_single_claim_endpoint


def test_seed_claims_present():
    """Verify that data/claims.json is seeded with the 2 realistic historical claims."""
    claims = get_all_claims()
    assert len(claims) >= 2
    ids = [c.claim_id for c in claims]
    assert "CLM-2026-0001" in ids
    assert "CLM-2026-0002" in ids

    c1 = get_claim_by_id("CLM-2026-0001")
    assert c1 is not None
    assert c1.claimant_name == "Vikram Patel"
    assert c1.policy_id == "micro_health_gig"
    assert c1.approved_amount_inr == 3200.0
    assert c1.reviewer_status in ("READY_TO_APPROVE", "APPROVED")

    c2 = get_claim_by_id("CLM-2026-0002")
    assert c2 is not None
    assert c2.claimant_name == "Sunita Devi (Nominee)"
    assert c2.policy_id == "pmsby"
    assert c2.approved_amount_inr == 200000.0
    assert c2.reviewer_status in ("NEEDS_REVIEW", "INFO_REQUESTED", "APPROVED")


def test_generate_claim_id_format():
    """Verify generated ID matches CLM-YYYY-XXXX (CLM-2026-0041 when seeds are 0001 and 0002)."""
    claim_id = generate_claim_id()
    assert claim_id.startswith("CLM-2026-")
    seq = int(claim_id.split("-")[-1])
    assert seq >= 41


def test_submit_claim_endpoint_and_persistence():
    """Verify submitting a claim via the endpoint persists to claims.json and survives restarts."""
    req = SubmitClaimRequest(
        policy_id="micro_health_gig",
        claimant_name="Aarav Sharma",
        claimant_phone="9876501234",
        claimant_aadhaar_last4="5512",
        bank_account_number="918273645012",
        bank_ifsc="PUNB0123456",
        claimed_amount_inr=4500.0,
        eligible_payout_inr=4500.0,
        document_paths=["/uploads/aarav_opd_bill.jpg", "/uploads/aarav_prescription.jpg"],
        extracted_data=ExtractedBillData(
            document_type="clinic_opd_bill",
            provider_name="City Community Clinic",
            patient_or_claimant_name="Aarav Sharma",
            incident_or_bill_date="2026-02-18",
            diagnosis_or_event="Viral Bronchitis",
            total_amount_inr=4500.0,
            has_stamp_or_signature=True,
            legibility_score=0.95,
        ),
        rule_checks=[
            RuleCheckResult(
                rule_id="RULE_AGE_WINDOW",
                label="Age Window Check",
                status="PASS",
                explanation="Age 29 is within 18–60 range.",
            ),
            RuleCheckResult(
                rule_id="RULE_REQUIRED_DOCUMENTS",
                label="Document Checklist",
                status="PASS",
                explanation="All required proofs present.",
            ),
        ],
    )

    record = asyncio.run(submit_claim_endpoint(req))

    assert isinstance(record, ClaimRecord)
    assert record.claim_id.startswith("CLM-2026-")
    assert record.claimant_name == "Aarav Sharma"
    assert record.policy_name == "Gig-Worker Micro-Health Clinic Shield"
    assert record.reviewer_status == "READY_TO_APPROVE"
    assert record.approved_amount_inr == 4500.0

    # Verify disk persistence directly
    with open(CLAIMS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    matching = [c for c in data if c["claim_id"] == record.claim_id]
    assert len(matching) == 1
    assert matching[0]["claimant_name"] == "Aarav Sharma"
    assert matching[0]["claimed_amount_inr"] == 4500.0

    # Test retrieval via get_single_claim_endpoint
    fetched = asyncio.run(get_single_claim_endpoint(record.claim_id))
    assert fetched.claim_id == record.claim_id
    assert fetched.claimant_name == "Aarav Sharma"


def test_update_claim_status():
    """Verify updating claim status modifies claims.json."""
    c1 = get_claim_by_id("CLM-2026-0001")
    assert c1 is not None

    updated = update_claim_status(
        claim_id="CLM-2026-0001",
        new_status="APPROVED",
        approved_amount=3200.0,
        notes="DBT transfer completed successfully via Aadhaar Payment Bridge.",
    )
    assert updated is not None
    assert updated.reviewer_status == "APPROVED"

    # Reset back to READY_TO_APPROVE
    reset = update_claim_status(
        claim_id="CLM-2026-0001",
        new_status="READY_TO_APPROVE",
        approved_amount=3200.0,
        notes="Pre-approved for instant UPI reimbursement.",
    )
    assert reset.reviewer_status == "READY_TO_APPROVE"
