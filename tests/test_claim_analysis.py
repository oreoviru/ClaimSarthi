import asyncio
import io
from models import ClaimAnalysisResponse
from server import UploadFile, analyze_claim


def test_analyze_claim_endpoint_orchestration():
    """Verify: Posting a real image + policy_id returns structured OCR data, rule checks, and payout estimate in one response."""
    with open("samples/sample_clinic_bill.jpg", "rb") as f:
        bill_bytes = f.read()

    try:
        upload_file = UploadFile(file=io.BytesIO(bill_bytes), filename="clinic_bill.jpg", headers={"content-type": "image/jpeg"})
    except TypeError:
        upload_file = UploadFile(filename="clinic_bill.jpg", file=bill_bytes, content_type="image/jpeg")

    async def _run():
        return await analyze_claim(
            policy_id="micro_health_gig",
            claimant_name="Ramesh Pawar",
            claimant_age=28,
            policy_start_date="2025-01-01",
            incident_date="2025-05-12",
            incident_subtype="road traffic accident",
            primary_doc_type="clinic_opd_bill",
            secondary_doc_types='["doctor_prescription"]',
            file=upload_file,
        )

    response = asyncio.run(_run())

    assert isinstance(response, ClaimAnalysisResponse)
    assert response.draft_id.startswith("DRAFT-")
    assert len(response.uploaded_file_urls) >= 1
    assert response.claimed_amount_inr == 1750.0
    assert response.disallowed_amount_inr == 250.0
    assert response.eligible_payout_inr == 1500.0
    assert len(response.rule_checks) >= 6
    assert response.overall_eligibility == "WARNING"
    assert response.recommended_status == "NEEDS_REVIEW"
    assert len(response.fix_it_checklist) >= 1


def test_revalidate_claim_flips_needs_fixes_to_ready_to_submit():
    """Verify: Adding a missing date and secondary doctor_prescription flips a NEEDS_FIXES draft to READY_TO_SUBMIT."""
    from models import ExtractedBillData, ItemizedCharge, RevalidateClaimRequest
    from server import revalidate_claim_endpoint
    from services.validator_service import evaluate_extraction_confidence

    initial_extracted = ExtractedBillData(
        document_type="clinic_opd_bill",
        provider_name="Shree Clinic & Nursing Home",
        patient_or_claimant_name="Karan Johar",
        incident_or_bill_date=None,  # Missing date
        diagnosis_or_event="Acute gastroenteritis",
        itemized_charges=[
            ItemizedCharge(item_name="Doctor Consultation Fee", amount_inr=400.0, category="consultation"),
            ItemizedCharge(item_name="IV Fluid Infusion", amount_inr=1100.0, category="procedure"),
        ],
        total_amount_inr=1500.0,
        has_stamp_or_signature=True,
        legibility_score=0.92,
        field_confidences={
            "provider_name": 0.95,
            "patient_or_claimant_name": 0.92,
            "diagnosis_or_event": 0.88,
            "total_amount_inr": 0.95,
            "incident_or_bill_date": 0.0,
        },
        unreadable_fields=["bill_date"],
    )

    initial_conf = evaluate_extraction_confidence(initial_extracted)
    assert initial_conf.status == "NEEDS_FIXES"
    assert "bill_date" in initial_conf.field_prompts

    reval_req = RevalidateClaimRequest(
        claim_id="DRAFT-TEST-001",
        policy_id="micro_health_gig",
        claimant_age=30,
        claimant_name="Karan Johar",
        updated_extracted_data=initial_extracted,
        manual_overrides={"incident_or_bill_date": "2025-06-15"},
        updated_uploaded_doc_types=["hospital_bill", "doctor_prescription"],
        existing_file_urls=["/uploads/sample.jpg"],
    )

    reval_res = asyncio.run(revalidate_claim_endpoint(reval_req))

    assert reval_res.readiness_status == "READY_TO_SUBMIT"
    assert reval_res.overall_eligibility == "PASS"
    assert reval_res.recommended_status == "READY_TO_APPROVE"
    assert reval_res.readiness_score == 100.0
    assert reval_res.extracted_data.field_confidences.get("incident_or_bill_date") == 1.0
    assert reval_res.eligible_payout_inr == 1500.0
    assert len(reval_res.fix_it_checklist) == 0
