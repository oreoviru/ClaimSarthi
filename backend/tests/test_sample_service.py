"""Tests for services/sample_service.py and demo samples endpoints in server.py."""

import asyncio
from models import ClaimAnalysisResponse
from services.sample_service import get_all_samples, get_sample_by_id, analyze_sample_case
from server import list_sample_scenarios_endpoint, analyze_sample_endpoint, StarletteHTTPException


def test_list_all_samples():
    """Verify GET /api/samples returns all 3 realistic Indian demo scenarios."""
    samples = asyncio.run(list_sample_scenarios_endpoint())
    assert isinstance(samples, list)
    assert len(samples) == 3

    sample_ids = [s["id"] for s in samples]
    assert "clean_clinic_bill" in sample_ids
    assert "tricky_handwritten_bill" in sample_ids
    assert "pmfby_hailstorm_crop" in sample_ids

    # Check tricky bill metadata
    tricky = next(s for s in samples if s["id"] == "tricky_handwritten_bill")
    assert tricky["policy_id"] == "micro_health_gig"
    assert tricky["claimed_amount_inr"] == 7800.0
    assert len(tricky["expected_catches"]) >= 3


def test_analyze_sample_tricky_handwritten_bill():
    """
    Verify: Calling POST /api/analyze-sample/tricky_handwritten_bill returns
    rich realistic extraction and 3 actionable Fix-It items instantaneously.
    """
    response = asyncio.run(analyze_sample_endpoint("tricky_handwritten_bill"))

    assert isinstance(response, ClaimAnalysisResponse)
    assert response.draft_id.startswith("DRAFT-SAMPLE-")
    assert response.policy_id == "micro_health_gig"

    # 1. Rich realistic extraction
    extracted = response.extracted_data
    assert extracted is not None
    assert extracted.provider_name == "Seva PolyClinic, Lucknow"
    assert extracted.patient_or_claimant_name == "Dinesh Kumar"
    assert extracted.total_amount_inr == 7800.0
    assert extracted.incident_or_bill_date is None  # Smudged/unreadable date
    assert "bill_date" in extracted.unreadable_fields or "incident_or_bill_date" in extracted.unreadable_fields

    # Multivitamin line item
    items = extracted.itemized_charges
    assert len(items) == 4
    vitamin_item = next(it for it in items if "Multivitamin" in it.item_name)
    assert vitamin_item.amount_inr == 450.0
    assert vitamin_item.is_covered is False

    # 2. Payout and Policy Cap
    assert response.claimed_amount_inr == 7800.0
    assert response.disallowed_amount_inr == 450.0
    assert response.overall_eligibility in ("WARNING", "FAIL")
    assert response.recommended_status in ("NEEDS_REVIEW", "REJECTED")

    # 3. Exactly 3 Actionable Fix-It Checklist Items
    checklist = response.fix_it_checklist
    assert len(checklist) == 3, f"Expected exactly 3 Fix-It items, got {len(checklist)}: {checklist}"

    # Catch 1: Missing Doctor Prescription
    has_prescription_fix = any("Doctor Prescription" in item for item in checklist)
    assert has_prescription_fix, "Missing Fix-It item for Doctor Prescription"

    # Catch 2: Smudged Date Prompt
    has_date_prompt = any("date" in item.lower() for item in checklist)
    assert has_date_prompt, "Missing Fix-It item for smudged/missing date"

    # Catch 3: Policy Exclusion ₹450 Deduction
    has_exclusion_fix = any("₹450" in item and "deducted" in item.lower() for item in checklist)
    assert has_exclusion_fix, "Missing Fix-It item for ₹450 multivitamin policy exclusion"


def test_analyze_sample_clean_clinic_bill_passes_all_checks():
    """Verify clean_clinic_bill passes all checks with full approved payout of ₹2,450."""
    response = asyncio.run(analyze_sample_endpoint("clean_clinic_bill"))

    assert isinstance(response, ClaimAnalysisResponse)
    assert response.claimed_amount_inr == 2450.0
    assert response.disallowed_amount_inr == 0.0
    assert response.eligible_payout_inr == 2450.0
    assert response.overall_eligibility == "PASS"
    assert response.recommended_status == "READY_TO_APPROVE"
    assert len(response.fix_it_checklist) == 0  # No blockers or warnings!


def test_analyze_sample_pmfby_hailstorm_crop():
    """Verify pmfby_hailstorm_crop validates 72h window and flags missing RoR land record."""
    response = asyncio.run(analyze_sample_endpoint("pmfby_hailstorm_crop"))

    assert isinstance(response, ClaimAnalysisResponse)
    assert response.policy_id == "pmfby"

    # Check 72h rule PASS
    rule_72h = next((r for r in response.rule_checks if r.rule_id in ("RULE_72H_INTIMATION", "RULE_72_HOUR_INTIMATION")), None)
    assert rule_72h is not None
    assert rule_72h.status == "PASS"

    # Check missing Land Record RoR flagged in Fix-It checklist
    assert any("Land Record" in item for item in response.fix_it_checklist)


def test_analyze_sample_404_on_invalid_id():
    """Verify 404 error on nonexistent sample ID."""
    try:
        asyncio.run(analyze_sample_endpoint("unknown_scenario_xyz"))
        assert False, "Should raise 404 for invalid sample ID"
    except StarletteHTTPException as e:
        assert e.status_code == 404
        assert "not found" in str(e.detail).lower()
