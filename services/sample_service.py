"""Sample demo cases service for SurakshaSetu micro-insurance assistant.

Contains 3 realistic Indian demo cases with bundled sample images:
1. clean_clinic_bill: ₹2,450 local clinic fever/typhoid bill + prescription under Micro-Health (passes all checks)
2. tricky_handwritten_bill: ₹7,800 bill with ₹450 multivitamins, smudged date, missing prescription (3 rejection-prevention catches)
3. pmfby_hailstorm_crop: wheat hailstorm loss reported 36h after incident under PMFBY Rabi (flags missing RoR land record)
"""

from datetime import datetime, timedelta
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

from models import (
    ClaimAnalysisResponse,
    DamageAssessment,
    ExtractedBillData,
    ItemizedCharge,
)
from services.policy_service import get_policy_by_id
from services.upload_service import process_image_bytes
from services.validator_service import (
    check_required_documents,
    evaluate_extraction_confidence,
    validate_claim,
)

logger = logging.getLogger("surakshasetu.sample_service")

BASE_DIR = Path(__file__).resolve().parent.parent
SAMPLES_DIR = BASE_DIR / "samples"


def _get_samples_metadata() -> Dict[str, Dict[str, Any]]:
    """Returns dynamic realistic sample cases metadata with relative timestamps."""
    now = datetime.now()
    five_days_ago = (now - timedelta(days=5)).strftime("%Y-%m-%d")
    thirty_six_hours_ago = (now - timedelta(hours=36)).strftime("%Y-%m-%d")

    return {
        "clean_clinic_bill": {
            "id": "clean_clinic_bill",
            "title": "Clean Clinic Bill - Acute Typhoid Treatment",
            "description": "₹2,450 handwritten local clinic fever/typhoid bill + prescription under Gig-Worker Micro-Health Clinic Shield. Passes all underwriting checks.",
            "policy_id": "micro_health_gig",
            "policy_name": "Gig-Worker Micro-Health Clinic Shield",
            "claimant_name": "Ramesh Pawar",
            "claimant_age": 28,
            "policy_start_date": "2025-01-01",
            "incident_date": five_days_ago,
            "incident_subtype": "acute illness / enteric fever",
            "primary_doc_type": "clinic_opd_bill",
            "secondary_doc_types": ["doctor_prescription"],
            "sample_filename": "clean_clinic_bill.jpg",
            "sample_image_url": "/samples/clean_clinic_bill.jpg",
            "claimed_amount_inr": 2450.0,
            "expected_outcome": "Passes all policy checks. Full reimbursement of ₹2,450 pre-approved.",
            "expected_catches": [],
        },
        "tricky_handwritten_bill": {
            "id": "tricky_handwritten_bill",
            "title": "Tricky Handwritten Clinic Bill with ₹450 Multivitamins & Smudged Date",
            "description": "₹7,800 handwritten clinic bill with ₹450 multivitamins (exclusion), smudged date, and missing doctor prescription under Micro-Health Clinic Shield. Triggers 3 real rejection-prevention catches.",
            "policy_id": "micro_health_gig",
            "policy_name": "Gig-Worker Micro-Health Clinic Shield",
            "claimant_name": "Dinesh Kumar",
            "claimant_age": 31,
            "policy_start_date": "2025-01-01",
            "incident_date": "2026-02-10",
            "incident_subtype": "acute illness / viral gastroenteritis",
            "primary_doc_type": "clinic_opd_bill",
            "secondary_doc_types": [],  # Missing doctor prescription!
            "sample_filename": "tricky_handwritten_bill.jpg",
            "sample_image_url": "/samples/tricky_handwritten_bill.jpg",
            "claimed_amount_inr": 7800.0,
            "expected_outcome": "Pre-validation catches 3 blockers: deducts ₹450 exclusion, caps payout at ₹5,000, and gives actionable Fix-It list.",
            "expected_catches": [
                "Policy Exclusion: ₹450 multivitamins detected and deducted",
                "Smudged/Missing bill date flagged for manual verification",
                "Missing Doctor Prescription requested to prevent claim rejection",
            ],
        },
        "pmfby_hailstorm_crop": {
            "id": "pmfby_hailstorm_crop",
            "title": "PMFBY Hailstorm Wheat Crop Loss (36h Calamity Notice)",
            "description": "Wheat crop hailstorm damage photo reported 36 hours after localized calamity under PMFBY Rabi. Validates 72h intimation window and flags missing RoR land record.",
            "policy_id": "pmfby",
            "policy_name": "Pradhan Mantri Fasal Bima Yojana",
            "claimant_name": "Suresh Chandra",
            "claimant_age": 46,
            "policy_start_date": "2025-10-15",
            "incident_date": thirty_six_hours_ago,
            "incident_subtype": "hailstorm",
            "primary_doc_type": "crop_damage_photo",
            "secondary_doc_types": [],  # Missing land_record_ror!
            "sample_filename": "pmfby_hailstorm_crop.jpg",
            "sample_image_url": "/samples/pmfby_hailstorm_crop.jpg",
            "claimed_amount_inr": 35000.0,
            "expected_outcome": "72-hour window validated; prompts claimant for 7/12 land record to complete packet.",
            "expected_catches": [
                "72-Hour Intimation Window: PASS (reported within 36 hours)",
                "Missing Land Record RoR (7/12 extract or Khasra) flagged",
            ],
        },
    }


def get_all_samples() -> List[Dict[str, Any]]:
    """Returns a list of all pre-configured demo sample scenarios."""
    samples_map = _get_samples_metadata()
    return list(samples_map.values())


def get_sample_by_id(sample_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves a specific sample configuration by key."""
    clean_id = sample_id.strip().lower()
    samples_map = _get_samples_metadata()
    return samples_map.get(clean_id)


def _get_sample_extracted_data(sample_id: str, sample_info: Dict[str, Any]) -> ExtractedBillData:
    """Builds rich, realistic extracted data corresponding to the sample case."""
    if sample_id == "tricky_handwritten_bill":
        return ExtractedBillData(
            document_type="clinic_opd_bill",
            provider_name="Seva PolyClinic, Lucknow",
            patient_or_claimant_name="Dinesh Kumar",
            incident_or_bill_date=None,  # Smudged/unreadable date
            diagnosis_or_event="Acute Gastroenteritis & Severe Dehydration",
            itemized_charges=[
                ItemizedCharge(
                    item_name="Emergency Consultation & Vital Monitoring",
                    amount_inr=500.0,
                    category="consultation",
                    is_covered=True,
                ),
                ItemizedCharge(
                    item_name="IV Fluid Rehydration (RL + DNS 4 Pints) & Daycare Nursing",
                    amount_inr=2200.0,
                    category="procedure",
                    is_covered=True,
                ),
                ItemizedCharge(
                    item_name="Ofloxacin & Ornidazole Antibiotic Injections",
                    amount_inr=4650.0,
                    category="pharmacy",
                    is_covered=True,
                ),
                ItemizedCharge(
                    item_name="Multivitamin, Zinc & Energy Syrup (Health Tonic)",
                    amount_inr=450.0,
                    category="pharmacy",
                    is_covered=False,
                    exclusion_reason="Disallowed dietary multivitamin / wellness supplement",
                ),
            ],
            total_amount_inr=7800.0,
            has_stamp_or_signature=True,
            legibility_score=0.68,
            field_confidences={
                "provider_name": 0.88,
                "patient_or_claimant_name": 0.85,
                "total_amount_inr": 0.92,
                "incident_or_bill_date": 0.35,  # Low confidence due to ink smudge
            },
            unreadable_fields=["bill_date", "incident_or_bill_date"],
        )

    elif sample_id == "clean_clinic_bill":
        return ExtractedBillData(
            document_type="clinic_opd_bill",
            provider_name="Arogya Daycare Clinic & Nursing Home, Pune",
            patient_or_claimant_name="Ramesh Pawar",
            incident_or_bill_date=sample_info["incident_date"],
            diagnosis_or_event="Enteric Fever (Typhoid) with Moderate Dehydration",
            itemized_charges=[
                ItemizedCharge(
                    item_name="Doctor OPD Consultation & Vitals Triage",
                    amount_inr=400.0,
                    category="consultation",
                    is_covered=True,
                ),
                ItemizedCharge(
                    item_name="Widal Typhoid Diagnostic Lab Antigen Test",
                    amount_inr=450.0,
                    category="diagnostic_lab",
                    is_covered=True,
                ),
                ItemizedCharge(
                    item_name="IV Saline & Ciprofloxacin Infusion",
                    amount_inr=1100.0,
                    category="procedure",
                    is_covered=True,
                ),
                ItemizedCharge(
                    item_name="Oral Paracetamol & Cefixime Tablets",
                    amount_inr=500.0,
                    category="pharmacy",
                    is_covered=True,
                ),
            ],
            total_amount_inr=2450.0,
            has_stamp_or_signature=True,
            legibility_score=0.95,
            field_confidences={
                "provider_name": 0.96,
                "patient_or_claimant_name": 0.94,
                "total_amount_inr": 0.98,
                "incident_or_bill_date": 0.95,
            },
            unreadable_fields=[],
        )

    else:
        # pmfby_hailstorm_crop
        da = DamageAssessment(
            calamity_type="hailstorm",
            crop_name="Wheat (Rabi)",
            affected_area_acres=2.0,
            loss_percentage=70.0,
            severity="severe",
            category_match=True,
            intimation_hours_elapsed=36.0,
            visual_evidence_summary=(
                "Severe localized hailstorm impact with extensive lodging and grain shattering "
                "across standing wheat crop canopy. Approximately 70% visible yield damage."
            ),
        )
        return ExtractedBillData(
            document_type="crop_damage_photo",
            provider_name="District Agriculture Office & Patwari Circle, Alwar",
            patient_or_claimant_name="Suresh Chandra",
            incident_or_bill_date=sample_info["incident_date"],
            diagnosis_or_event="Severe Hailstorm & Lodging on Rabi Wheat Crop",
            itemized_charges=[],
            total_amount_inr=35000.0,
            has_stamp_or_signature=True,
            legibility_score=0.94,
            field_confidences={
                "provider_name": 0.85,
                "incident_or_bill_date": 0.92,
                "total_amount_inr": 0.88,
            },
            unreadable_fields=[],
            damage_assessment=da,
        )


def analyze_sample_case(sample_id: str) -> ClaimAnalysisResponse:
    """
    Executes instantaneous full-pipeline pre-validation of a realistic demo case.
    Saves image into uploads/, runs deterministic validators, evaluates extraction
    confidence, calculates capped payout, and produces an actionable Fix-It checklist.
    """
    clean_id = sample_id.strip().lower()
    sample_info = get_sample_by_id(clean_id)
    if not sample_info:
        raise KeyError(f"Sample case '{sample_id}' not found.")

    policy_id = sample_info["policy_id"]
    policy = get_policy_by_id(policy_id)
    if not policy:
        raise ValueError(f"Policy '{policy_id}' not found.")

    # 1. Load sample image and persist through upload_service
    image_path = SAMPLES_DIR / sample_info["sample_filename"]
    saved_urls: List[str] = []
    quality_warnings: List[str] = []

    if image_path.exists():
        img_bytes = image_path.read_bytes()
        upload_meta = process_image_bytes(
            file_bytes=img_bytes,
            original_filename=sample_info["sample_filename"],
        )
        saved_url = upload_meta.get("file_url") or upload_meta.get("url") or f"/uploads/{upload_meta.get('filename')}"
        saved_urls.append(saved_url)
        if upload_meta.get("image_quality_warning"):
            quality_warnings.append(upload_meta["image_quality_warning"])
    else:
        saved_urls.append(sample_info["sample_image_url"])

    # 2. Get rich realistic extraction data
    extracted_data = _get_sample_extracted_data(clean_id, sample_info)

    # 3. Assemble metadata for deterministic rule engine
    all_doc_tags = [sample_info["primary_doc_type"]] + list(sample_info.get("secondary_doc_types", []))
    
    # Days since enrollment calculation
    days_since_enrollment = 100
    try:
        p_start = datetime.strptime(sample_info["policy_start_date"], "%Y-%m-%d")
        inc_d = datetime.strptime(sample_info["incident_date"], "%Y-%m-%d")
        days_since_enrollment = max(0, (inc_d - p_start).days)
    except Exception:
        pass

    user_metadata = {
        "age": sample_info["claimant_age"],
        "claimant_name": sample_info["claimant_name"],
        "policy_start_date": sample_info["policy_start_date"],
        "incident_date": sample_info["incident_date"],
        "incident_subtype": sample_info["incident_subtype"],
        "days_since_enrollment": days_since_enrollment,
        "hours_since_calamity": 36.0 if clean_id == "pmfby_hailstorm_crop" else None,
        "uploaded_doc_types": all_doc_tags,
    }

    # 4. Deterministic validation & confidence guardrail
    val_result = validate_claim(extracted_data, policy, user_metadata=user_metadata)
    conf_result = evaluate_extraction_confidence(extracted_data)

    all_rule_checks = val_result["rule_checks"] + conf_result.rule_checks

    # 5. Build actionable Fix-It checklist
    fix_it_checklist: List[str] = []

    # Missing documents check
    doc_rule = next((r for r in val_result["rule_checks"] if r.rule_id == "RULE_REQUIRED_DOCUMENTS"), None)
    if doc_rule and doc_rule.missing_documents:
        for doc_key, instr in doc_rule.missing_documents.items():
            if doc_key not in sample_info["primary_doc_type"]:
                fix_it_checklist.append(f"Missing {doc_key.replace('_', ' ').title()}: {instr}")

    # Field confidence / smudged field prompts
    for field_name, prompt in conf_result.field_prompts.items():
        fix_it_checklist.append(prompt)

    # Policy exclusions / disallowed items
    if val_result.get("disallowed_amount_inr", 0) > 0:
        fix_it_checklist.append(
            f"Policy Exclusion: ₹{val_result['disallowed_amount_inr']:,.2f} deducted for non-covered items (vitamins, tonics, or cosmetics)."
        )

    # Image warnings
    for warn in quality_warnings:
        fix_it_checklist.append(f"Image Quality Warning: {warn}")

    # Synthesize eligibility & status
    has_fail = any(r.status == "FAIL" for r in all_rule_checks)
    has_warning = any(r.status == "WARNING" for r in all_rule_checks)

    if has_fail:
        overall_eligibility = "FAIL"
        recommended_status = "REJECTED"
        eligible_payout = 0.0
    elif has_warning or conf_result.status == "NEEDS_FIXES":
        overall_eligibility = "WARNING"
        recommended_status = "NEEDS_REVIEW"
        eligible_payout = val_result["eligible_payout_inr"]
    else:
        overall_eligibility = "PASS"
        recommended_status = "READY_TO_APPROVE"
        eligible_payout = val_result["eligible_payout_inr"]

    draft_id = f"DRAFT-SAMPLE-{clean_id.upper()[:12]}-{uuid.uuid4().hex[:6].upper()}"

    return ClaimAnalysisResponse(
        claim_id=draft_id,
        draft_id=draft_id,
        policy_id=policy_id,
        policy_name=policy.get("name", policy_id),
        extracted_data=extracted_data,
        rule_checks=all_rule_checks,
        overall_eligibility=overall_eligibility,
        recommended_status=recommended_status,
        claimed_amount_inr=val_result["claimed_amount_inr"],
        eligible_payout_inr=eligible_payout,
        disallowed_amount_inr=val_result["disallowed_amount_inr"],
        summary_notes=val_result["summary_notes"],
        uploaded_file_urls=saved_urls,
        fix_it_checklist=fix_it_checklist,
        readiness_score=conf_result.readiness_score,
        readiness_status=conf_result.status,
    )
