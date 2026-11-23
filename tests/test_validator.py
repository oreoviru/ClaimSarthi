from models import ExtractedBillData, ItemizedCharge, DamageAssessment
from services.policy_service import get_policy_by_id
from services.validator_service import (
    check_required_documents,
    evaluate_extraction_confidence,
    validate_claim,
)


def test_micro_health_exclusions_and_cap():
    """Verify: A ₹7,800 clinic bill with ₹400 vitamins under Micro-Health flags the ₹400 exclusion and caps payable estimate at ₹5,000."""
    policy = get_policy_by_id("micro_health_gig")

    bill = ExtractedBillData(
        document_type="clinic_opd_bill",
        provider_name="City Care Clinic",
        patient_or_claimant_name="Amit Singh",
        incident_or_bill_date="2025-06-10",
        diagnosis_or_event="Acute Gastroenteritis & Dehydration",
        itemized_charges=[
            ItemizedCharge(item_name="Doctor Consultation Fee", amount_inr=500.0, category="consultation"),
            ItemizedCharge(item_name="IV Saline Infusion & Daycare Bed", amount_inr=2400.0, category="procedure"),
            ItemizedCharge(item_name="Antibiotic & Antiemetic Injections", amount_inr=4500.0, category="pharmacy"),
            ItemizedCharge(item_name="Multivitamin & Zinc Syrup Pack", amount_inr=400.0, category="pharmacy"),
        ],
        total_amount_inr=7800.0,
        has_stamp_or_signature=True,
        legibility_score=0.95,
        field_confidences={},
        unreadable_fields=[],
    )

    result = validate_claim(bill, policy, user_metadata={"age": 29, "days_since_enrollment": 45})

    assert result["claimed_amount_inr"] == 7800.0
    assert result["disallowed_amount_inr"] == 400.0
    assert result["eligible_payout_inr"] == 5000.0
    assert result["overall_eligibility"] == "WARNING"
    assert result["recommended_status"] == "NEEDS_REVIEW"

    rules = {r.rule_id: r for r in result["rule_checks"]}
    assert rules["RULE_EXCLUSION_SCANNER"].status == "WARNING"
    assert "400" in rules["RULE_EXCLUSION_SCANNER"].explanation
    assert rules["RULE_COVERAGE_CAP"].status == "WARNING"
    assert "5,000" in rules["RULE_COVERAGE_CAP"].explanation


def test_pmsby_and_ab_pmjay_opd_rejection():
    """Verify: OPD clinic bill submitted under PMSBY or AB-PMJAY hard-fails compatibility check."""
    bill = ExtractedBillData(
        document_type="clinic_opd_bill",
        provider_name="Local Clinic",
        patient_or_claimant_name="Ramesh",
        incident_or_bill_date="2025-06-10",
        diagnosis_or_event="Viral Fever",
        itemized_charges=[],
        total_amount_inr=800.0,
        has_stamp_or_signature=True,
        legibility_score=0.9,
    )

    pmsby_res = validate_claim(bill, get_policy_by_id("pmsby"), {"age": 30})
    pmsby_rules = {r.rule_id: r for r in pmsby_res["rule_checks"]}
    assert pmsby_rules["RULE_CLAIM_TYPE_COMPATIBILITY"].status == "FAIL"
    assert pmsby_res["overall_eligibility"] == "FAIL"

    pmjay_res = validate_claim(bill, get_policy_by_id("ab_pmjay"), {"age": 30})
    pmjay_rules = {r.rule_id: r for r in pmjay_res["rule_checks"]}
    assert pmjay_rules["RULE_CLAIM_TYPE_COMPATIBILITY"].status == "FAIL"
    assert pmjay_res["overall_eligibility"] == "FAIL"


def test_pmfby_72_hour_intimation_check():
    """Verify: PMFBY intimation past 72 hours results in hard FAIL."""
    bill = ExtractedBillData(
        document_type="crop_loss_intimation",
        provider_name="Revenue Office",
        patient_or_claimant_name="Farmer X",
        incident_or_bill_date="2025-07-20",
        diagnosis_or_event="Flood Damage",
        itemized_charges=[],
        total_amount_inr=30000.0,
        has_stamp_or_signature=True,
        legibility_score=0.9,
        damage_assessment=DamageAssessment(intimation_hours_elapsed=80.0),
    )

    result = validate_claim(bill, get_policy_by_id("pmfby"), {"age": 40})
    rules = {r.rule_id: r for r in result["rule_checks"]}
    assert rules["RULE_72H_INTIMATION"].status == "FAIL"
    assert result["overall_eligibility"] == "FAIL"


def test_check_required_documents_micro_health():
    """Verify: Uploading only a hospital_bill for Micro-Health triggers a FAIL check requesting doctor_prescription."""
    policy = get_policy_by_id("micro_health_gig")
    rule_check = check_required_documents(policy, uploaded_doc_types=["hospital_bill"])

    assert rule_check.status == "FAIL"
    assert "doctor_prescription" in rule_check.missing_documents
    assert "signed clinical prescription" in rule_check.missing_documents["doctor_prescription"]


def test_check_required_documents_pmsby_conditional():
    """Verify: Road accident requires FIR; snakebite accepts immediate hospital report."""
    policy = get_policy_by_id("pmsby")

    res_road = check_required_documents(policy, ["hospital_bill"], incident_subtype="road vehicle crash")
    assert res_road.status == "FAIL"
    assert "fir_or_police_report" in res_road.missing_documents

    res_snake = check_required_documents(policy, ["immediate_hospital_medical_report"], incident_subtype="snakebite")
    assert res_snake.status == "PASS"


def test_evaluate_extraction_confidence_null_date_low_amount_conf():
    """Verify: A bill with a null date and 0.62 total_amount confidence sets status to NEEDS_FIXES with specific field prompts."""
    bill = ExtractedBillData(
        document_type="clinic_opd_bill",
        provider_name="Apex Care",
        patient_or_claimant_name="Vikas",
        incident_or_bill_date=None,
        diagnosis_or_event="Fracture",
        itemized_charges=[ItemizedCharge(item_name="Dressing", amount_inr=200.0)],
        total_amount_inr=1200.0,
        has_stamp_or_signature=True,
        legibility_score=0.85,
        field_confidences={
            "provider_name": 0.9,
            "patient_or_claimant_name": 0.9,
            "incident_or_bill_date": 0.0,
            "diagnosis_or_event": 0.85,
            "total_amount_inr": 0.62,
        },
        unreadable_fields=["bill_date"],
    )

    audit = evaluate_extraction_confidence(bill)
    assert audit.status == "NEEDS_FIXES"
    assert "bill_date" in audit.field_prompts
    assert "total_amount_inr" in audit.field_prompts
    assert audit.readiness_score < 80.0
