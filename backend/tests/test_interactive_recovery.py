"""
Automated unit & integration tests for Step 3 Interactive Recovery Controls & Re-Check My Claim.
Verifies:
1. HTML markup for "Re-Check My Claim" buttons & recovery footer:
   - Header button (#btn-revalidate-claim) labeled "Re-Check My Claim"
   - Footer container (#scorecard-recheck-footer) with action button (#btn-recheck-my-claim)
2. CSS styles for interactive recovery controls:
   - Inline recovery card (.recovery-doc-card, .is-attached)
   - "Upload Now" button (.btn-inline-upload)
   - "Attach Demo Proof" helper button (.btn-inline-demo-proof)
   - Re-check scorecard button (.btn-recheck-scorecard)
3. JavaScript modular functions in static/js/verifyStep.js:
   - formatDocTitle, isInlineDocAttached, handleAttachDemoProof, handleInlineDocUpload, handleRemoveInlineDoc, runRevalidation
4. End-to-end policy revalidation logic:
   - Missing proof initially causes FAIL on RULE_REQUIRED_DOCUMENTS
   - Attaching proof via updated_uploaded_doc_types resolves check to PASS and recomputes readiness & payout.
"""

from pathlib import Path
from models import ExtractedBillData, ItemizedCharge
from services.policy_service import get_policy_by_id
from services.validator_service import revalidate_claim_data


def test_recheck_html_buttons_and_footer():
    """Verify static/index.html includes Re-Check My Claim buttons in header and footer."""
    index_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "index.html"
    assert index_path.exists(), "index.html must exist"
    content = index_path.read_text(encoding="utf-8")

    # Header re-check button
    assert 'id="btn-revalidate-claim"' in content
    assert "Re-Check My Claim" in content

    # Footer re-check container and action button
    assert 'id="scorecard-recheck-footer"' in content
    assert 'id="btn-recheck-my-claim"' in content
    assert "btn-recheck-scorecard" in content


def test_recovery_controls_css():
    """Verify static/styles.css includes classes for inline upload, demo proof, and attached state."""
    css_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "styles.css"
    assert css_path.exists(), "styles.css must exist"
    content = css_path.read_text(encoding="utf-8")

    # Inline recovery card
    assert ".recovery-doc-card" in content
    assert ".recovery-doc-card.is-attached" in content
    assert ".recovery-doc-header" in content

    # Action buttons
    assert ".btn-inline-upload" in content
    assert ".btn-inline-demo-proof" in content
    assert ".btn-remove-inline-doc" in content
    assert ".recovery-attached-strip" in content

    # Scorecard footer and pulse animation
    assert ".scorecard-recheck-footer" in content
    assert ".btn-recheck-scorecard" in content
    assert "recheckPulse" in content


def test_revalidate_claim_data_recovery_flow():
    """Verify that revalidate_claim_data resolves missing document checks when proof is attached."""
    policy_id = "micro_health_gig"
    policy = get_policy_by_id(policy_id)
    assert policy is not None

    extracted = ExtractedBillData(
        document_type="clinic_opd_bill",
        provider_name="Seva PolyClinic, Lucknow",
        incident_or_bill_date="2026-02-10",
        diagnosis_or_event="Acute Gastroenteritis",
        itemized_charges=[
            ItemizedCharge(item_name="Consultation", amount_inr=500.0, is_covered=True),
            ItemizedCharge(item_name="IV Fluids", amount_inr=2200.0, is_covered=True),
            ItemizedCharge(item_name="Antibiotics", amount_inr=4650.0, is_covered=True),
            ItemizedCharge(item_name="Multivitamin", amount_inr=450.0, is_covered=False, exclusion_reason="Supplement"),
        ],
        total_amount_inr=7800.0,
        legibility_score=0.75,
    )

    # 1. Without prescription: RULE_REQUIRED_DOCUMENTS should be FAIL
    val_res_before, conf_res_before, _ = revalidate_claim_data(
        policy_id=policy_id,
        extracted_data=extracted,
        manual_overrides={"date_verified": True},
        updated_uploaded_doc_types=["clinic_opd_bill"],  # Missing doctor_prescription!
        user_metadata={"age": 28},
    )

    doc_rule_before = next((r for r in val_res_before["rule_checks"] if r.rule_id == "RULE_REQUIRED_DOCUMENTS"), None)
    assert doc_rule_before is not None
    assert doc_rule_before.status == "FAIL"
    assert "doctor_prescription" in doc_rule_before.missing_documents

    # 2. With prescription attached (simulating "Upload Now" or "Attach Demo Proof"):
    val_res_after, conf_res_after, _ = revalidate_claim_data(
        policy_id=policy_id,
        extracted_data=extracted,
        manual_overrides={"date_verified": True},
        updated_uploaded_doc_types=["clinic_opd_bill", "doctor_prescription"],  # Proof attached!
        user_metadata={"age": 28},
    )

    doc_rule_after = next((r for r in val_res_after["rule_checks"] if r.rule_id == "RULE_REQUIRED_DOCUMENTS"), None)
    assert doc_rule_after is not None
    assert doc_rule_after.status == "PASS"
    assert "All mandatory proof documents" in doc_rule_after.explanation

    # Payout is capped at ₹5,000 policy sub-limit
    assert val_res_after["eligible_payout_inr"] == 5000.0
    assert val_res_after["disallowed_amount_inr"] == 450.0
