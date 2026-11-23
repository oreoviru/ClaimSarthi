"""Tests for insurer portal endpoints: GET /api/claims, GET /api/claims/{id}, PATCH /api/claims/{id}/decision."""

import asyncio
import json
from datetime import datetime
from pathlib import Path

from models import ClaimDecisionRequest, ClaimsDashboardResponse, ClaimRecord
from services.claim_store import _get_seed_claims, CLAIMS_FILE
from server import (
    list_all_claims_endpoint,
    get_single_claim_endpoint,
    claim_decision_endpoint,
    StarletteHTTPException,
)


def _reset_seed_claims():
    """Resets data/claims.json to known initial seed state."""
    with open(CLAIMS_FILE, "w", encoding="utf-8") as f:
        json.dump(_get_seed_claims(), f, indent=2)


def test_get_claims_dashboard_summary_metrics():
    """Verify: GET /api/claims returns newest-first claims and computed dashboard metrics."""
    _reset_seed_claims()

    dashboard = asyncio.run(list_all_claims_endpoint())
    assert isinstance(dashboard, dict) or isinstance(dashboard, ClaimsDashboardResponse)
    if isinstance(dashboard, ClaimsDashboardResponse):
        dash_dict = dashboard.model_dump()
    else:
        dash_dict = dashboard

    assert "total_claims" in dash_dict
    assert "ready_to_approve" in dash_dict
    assert "needs_review" in dash_dict
    assert "approved_count" in dash_dict
    assert "prevented_rejections_count" in dash_dict
    assert "claims" in dash_dict

    assert dash_dict["total_claims"] >= 2
    assert dash_dict["ready_to_approve"] >= 1
    assert dash_dict["needs_review"] >= 1
    assert dash_dict["approved_count"] == 0
    assert dash_dict["prevented_rejections_count"] >= 1

    # Verify newest-first sorting
    claims = dash_dict["claims"]
    assert len(claims) >= 2
    for i in range(len(claims) - 1):
        c1 = claims[i]
        c2 = claims[i + 1]
        t1 = c1.created_at if isinstance(c1, ClaimRecord) else c1["created_at"]
        t2 = c2.created_at if isinstance(c2, ClaimRecord) else c2["created_at"]
        assert str(t1) >= str(t2)


def test_get_single_claim_full_details():
    """Verify: GET /api/claims/{id} returns full dossier details or 404."""
    claim = asyncio.run(get_single_claim_endpoint("CLM-2026-0001"))
    assert isinstance(claim, ClaimRecord)
    assert claim.claim_id == "CLM-2026-0001"
    assert claim.claimant_name == "Vikram Patel"
    assert claim.policy_id == "micro_health_gig"
    assert claim.claimed_amount_inr == 3200.0
    assert claim.reviewer_status == "READY_TO_APPROVE"
    assert len(claim.rule_checks) >= 5

    # Test 404
    try:
        asyncio.run(get_single_claim_endpoint("CLM-NONEXISTENT-999"))
        assert False, "Should have raised StarletteHTTPException 404"
    except StarletteHTTPException as e:
        assert e.status_code == 404


def test_patch_claim_decision_and_increments_approved_count():
    """
    Verify: PATCH /api/claims/{id}/decision updates claim status and
    increments approved_count in GET /api/claims.
    """
    _reset_seed_claims()

    # Step 1: Initial state check
    initial_dash = asyncio.run(list_all_claims_endpoint())
    initial_approved = initial_dash["approved_count"]
    assert initial_approved == 0

    # Step 2: PATCH decision to approve CLM-2026-0001
    decision_payload = ClaimDecisionRequest(
        status="APPROVED",
        approved_amount_inr=3200.0,
        reviewer_notes="Authorized for instant direct benefit transfer (DBT) to HDFC account.",
    )

    updated = asyncio.run(claim_decision_endpoint("CLM-2026-0001", decision_payload))
    assert isinstance(updated, ClaimRecord)
    assert updated.claim_id == "CLM-2026-0001"
    assert updated.reviewer_status == "APPROVED"
    assert updated.approved_amount_inr == 3200.0
    assert updated.reviewer_notes == "Authorized for instant direct benefit transfer (DBT) to HDFC account."
    assert updated.decision_timestamp is not None or updated.decided_at is not None

    # Step 3: Verify disk persistence of decision_timestamp in data/claims.json
    with open(CLAIMS_FILE, "r", encoding="utf-8") as f:
        stored_claims = json.load(f)
    matching = [c for c in stored_claims if c["claim_id"] == "CLM-2026-0001"][0]
    assert matching["reviewer_status"] == "APPROVED"
    assert "decision_timestamp" in matching
    assert matching["reviewer_notes"] == "Authorized for instant direct benefit transfer (DBT) to HDFC account."

    # Step 4: Verify GET /api/claims increments approved_count
    updated_dash = asyncio.run(list_all_claims_endpoint())
    assert updated_dash["approved_count"] == initial_approved + 1
    assert updated_dash["approved_count"] == 1

    # Step 5: Test INFO_REQUESTED decision on CLM-2026-0002
    info_req_payload = ClaimDecisionRequest(
        status="INFO_REQUESTED",
        approved_amount_inr=200000.0,
        reviewer_notes="Please upload certified bank passbook copy for nominee DBT verification.",
    )
    updated2 = asyncio.run(claim_decision_endpoint("CLM-2026-0002", info_req_payload))
    assert updated2.reviewer_status == "INFO_REQUESTED"

    # Step 6: Test 404 on nonexistent claim
    try:
        asyncio.run(claim_decision_endpoint("CLM-NONEXISTENT", decision_payload))
        assert False, "Should raise 404 for nonexistent claim"
    except StarletteHTTPException as e:
        assert e.status_code == 404
