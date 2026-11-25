"""Deterministic rule validation engine for Indian micro-insurance claims."""

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from models import (
    DamageAssessment,
    ExtractionConfidenceResult,
    ExtractedBillData,
    ItemizedCharge,
    RuleCheckResult,
)

logger = logging.getLogger("surakshasetu.validator_service")

# Standardized exclusion keywords
EXCLUSION_KEYWORDS = {
    "vitamins_supplements": [
        "vitamin", "multivitamin", "zinc", "calcium", "supplement", "protein",
        "tonic", "immunity", "nutritional", "cod liver", "horlicks", "pediasure",
        "revital", "becosules", "supradyn", "limcee", "shelcal"
    ],
    "cosmetic_aesthetic": [
        "cosmetic", "aesthetic", "botox", "whitening", "skin glow", "derma",
        "anti-aging", "liposuction", "scar removal", "hair transplant",
        "rhinoplasty", "tattoo", "blemish"
    ],
    "routine_dental": [
        "dental cleaning", "scaling", "teeth bleaching", "denture", "braces",
        "orthodontic", "cosmetic crown", "cavity polish"
    ],
}


def evaluate_extraction_confidence(extracted: ExtractedBillData) -> ExtractionConfidenceResult:
    """
    Guardrail function inspecting key OCR extracted fields:
    - bill_date (incident_or_bill_date)
    - total_amount_inr
    - provider_name
    - diagnosis_or_event
    Generates WARNING or FAIL rule checks for null, unreadable, or confidence < 0.75 fields,
    instructing user to verify or type manually.
    Flags missing doctor stamp/signature as a soft warning.
    Computes readiness_score (0-100) and status (READY_TO_SUBMIT, NEEDS_FIXES, NOT_COVERED).
    """
    rule_checks: List[RuleCheckResult] = []
    field_prompts: Dict[str, str] = {}
    unreadable: List[str] = list(extracted.unreadable_fields or [])

    confidences = extracted.field_confidences or {}
    readiness_deductions = 0.0

    # 1. Bill Date Check
    date_val = extracted.incident_or_bill_date
    date_conf = confidences.get("incident_or_bill_date", confidences.get("bill_date", 1.0 if date_val else 0.0))
    if not date_val or "bill_date" in unreadable or "incident_or_bill_date" in unreadable:
        prompt = "Bill date is missing or illegible in the document. Please enter the date of consultation or treatment (YYYY-MM-DD) manually."
        field_prompts["bill_date"] = prompt
        if "bill_date" not in unreadable:
            unreadable.append("bill_date")
        rule_checks.append(RuleCheckResult(
            rule_id="CHECK_CONF_BILL_DATE",
            label="Bill / Incident Date Verification",
            status="FAIL",
            explanation="Bill date is missing, smudged, or null in the uploaded image.",
            action_required=prompt,
        ))
        readiness_deductions += 25.0
    elif date_conf < 0.75:
        prompt = f"Bill date was extracted with low OCR confidence ({date_conf:.0%}). Please verify that '{date_val}' is correct or type the correct date."
        field_prompts["bill_date"] = prompt
        rule_checks.append(RuleCheckResult(
            rule_id="CHECK_CONF_BILL_DATE",
            label="Bill / Incident Date Verification",
            status="WARNING",
            explanation=f"Bill date '{date_val}' has low confidence ({date_conf:.0%}, minimum expected 75%).",
            action_required=prompt,
        ))
        readiness_deductions += 15.0
    else:
        rule_checks.append(RuleCheckResult(
            rule_id="CHECK_CONF_BILL_DATE",
            label="Bill / Incident Date Verification",
            status="PASS",
            explanation=f"Bill date verified: {date_val} ({date_conf:.0%} confidence).",
            action_required=None,
        ))

    # 2. Total Amount Check
    amt_val = extracted.total_amount_inr
    amt_conf = confidences.get("total_amount_inr", confidences.get("total_amount", 1.0 if amt_val is not None else 0.0))
    if amt_val is None or "total_amount_inr" in unreadable:
        prompt = "Total billed amount could not be read. Please check your physical bill and enter the exact total amount in INR."
        field_prompts["total_amount_inr"] = prompt
        if "total_amount_inr" not in unreadable:
            unreadable.append("total_amount_inr")
        rule_checks.append(RuleCheckResult(
            rule_id="CHECK_CONF_TOTAL_AMOUNT",
            label="Total Billed Amount Verification",
            status="FAIL",
            explanation="Total amount is missing or unreadable.",
            action_required=prompt,
        ))
        readiness_deductions += 25.0
    elif amt_conf < 0.75:
        prompt = f"Total amount of ₹{amt_val:,.2f} has low confidence ({amt_conf:.0%}). Please verify and confirm the exact total amount in INR."
        field_prompts["total_amount_inr"] = prompt
        rule_checks.append(RuleCheckResult(
            rule_id="CHECK_CONF_TOTAL_AMOUNT",
            label="Total Billed Amount Verification",
            status="WARNING",
            explanation=f"Total amount of ₹{amt_val:,.2f} confidence ({amt_conf:.0%}) is below the 75% threshold.",
            action_required=prompt,
        ))
        readiness_deductions += 15.0
    else:
        rule_checks.append(RuleCheckResult(
            rule_id="CHECK_CONF_TOTAL_AMOUNT",
            label="Total Billed Amount Verification",
            status="PASS",
            explanation=f"Total amount verified: ₹{amt_val:,.2f} ({amt_conf:.0%} confidence).",
            action_required=None,
        ))

    # 3. Provider Name Check
    prov_val = extracted.provider_name
    prov_conf = confidences.get("provider_name", 1.0 if prov_val else 0.0)
    if not prov_val or "provider_name" in unreadable:
        prompt = "Hospital or clinic name could not be extracted. Please type the full issuing clinic or hospital name."
        field_prompts["provider_name"] = prompt
        if "provider_name" not in unreadable:
            unreadable.append("provider_name")
        rule_checks.append(RuleCheckResult(
            rule_id="CHECK_CONF_PROVIDER_NAME",
            label="Clinic / Hospital Provider Name",
            status="FAIL",
            explanation="Provider name is missing or unreadable.",
            action_required=prompt,
        ))
        readiness_deductions += 20.0
    elif prov_conf < 0.75:
        prompt = f"Provider name '{prov_val}' has low confidence ({prov_conf:.0%}). Please confirm or edit the clinic name."
        field_prompts["provider_name"] = prompt
        rule_checks.append(RuleCheckResult(
            rule_id="CHECK_CONF_PROVIDER_NAME",
            label="Clinic / Hospital Provider Name",
            status="WARNING",
            explanation=f"Provider name confidence ({prov_conf:.0%}) is below 75%.",
            action_required=prompt,
        ))
        readiness_deductions += 10.0
    else:
        rule_checks.append(RuleCheckResult(
            rule_id="CHECK_CONF_PROVIDER_NAME",
            label="Clinic / Hospital Provider Name",
            status="PASS",
            explanation=f"Provider name verified: {prov_val} ({prov_conf:.0%} confidence).",
            action_required=None,
        ))

    # 4. Diagnosis or Event Check
    diag_val = extracted.diagnosis_or_event
    diag_conf = confidences.get("diagnosis_or_event", 1.0 if diag_val else 0.0)
    if not diag_val or "diagnosis_or_event" in unreadable:
        prompt = "Diagnosis or reason for casualty was not clearly legible. Please type your medical condition or casualty event."
        field_prompts["diagnosis_or_event"] = prompt
        if "diagnosis_or_event" not in unreadable:
            unreadable.append("diagnosis_or_event")
        rule_checks.append(RuleCheckResult(
            rule_id="CHECK_CONF_DIAGNOSIS",
            label="Clinical Diagnosis & Event",
            status="FAIL",
            explanation="Diagnosis / casualty description is missing or unreadable.",
            action_required=prompt,
        ))
        readiness_deductions += 20.0
    elif diag_conf < 0.75:
        prompt = f"Diagnosis '{diag_val}' has low confidence ({diag_conf:.0%}). Please verify and edit the diagnosis."
        field_prompts["diagnosis_or_event"] = prompt
        rule_checks.append(RuleCheckResult(
            rule_id="CHECK_CONF_DIAGNOSIS",
            label="Clinical Diagnosis & Event",
            status="WARNING",
            explanation=f"Diagnosis confidence ({diag_conf:.0%}) is below 75%.",
            action_required=prompt,
        ))
        readiness_deductions += 10.0
    else:
        rule_checks.append(RuleCheckResult(
            rule_id="CHECK_CONF_DIAGNOSIS",
            label="Clinical Diagnosis & Event",
            status="PASS",
            explanation=f"Diagnosis verified: {diag_val} ({diag_conf:.0%} confidence).",
            action_required=None,
        ))

    # 5. Soft Warning: Clinic Stamp / Signature
    has_stamp_warning = False
    if not extracted.has_stamp_or_signature:
        has_stamp_warning = True
        readiness_deductions += 10.0
        prompt = "No doctor seal, clinic stamp, or authorized signature was detected. Please verify that your document has an official stamp before final claim submission."
        field_prompts["has_stamp_or_signature"] = prompt
        rule_checks.append(RuleCheckResult(
            rule_id="CHECK_DOC_STAMP_SIGNATURE",
            label="Doctor Stamp & Signature Presence",
            status="WARNING",
            explanation="Doctor stamp or authorized signature was not detected on this document image.",
            action_required=prompt,
        ))
    else:
        rule_checks.append(RuleCheckResult(
            rule_id="CHECK_DOC_STAMP_SIGNATURE",
            label="Doctor Stamp & Signature Presence",
            status="PASS",
            explanation="Doctor stamp or authorized signature clearly detected on document.",
            action_required=None,
        ))

    # Compute overall readiness score
    base_score = 100.0 - readiness_deductions
    legibility = extracted.legibility_score if extracted.legibility_score is not None else 0.8
    if legibility < 0.5:
        base_score = base_score * max(0.4, legibility)

    readiness_score = max(0.0, min(100.0, round(base_score, 1)))

    # Determine submission readiness status
    if readiness_score < 30.0 or (extracted.legibility_score and extracted.legibility_score < 0.3):
        readiness_status = "NOT_COVERED"
        summary = "Document is severely blurred, cropped, or illegible. Image quality is insufficient for processing."
    elif field_prompts or readiness_score < 80.0:
        readiness_status = "NEEDS_FIXES"
        summary = f"Document needs manual verification. {len(field_prompts)} field(s) require claimant review or manual entry before submission."
    else:
        readiness_status = "READY_TO_SUBMIT"
        summary = "All mandatory fields and signatures have been successfully verified with high confidence."

    return ExtractionConfidenceResult(
        readiness_score=readiness_score,
        status=readiness_status,
        rule_checks=rule_checks,
        field_prompts=field_prompts,
        unreadable_fields=list(set(unreadable)),
        has_stamp_warning=has_stamp_warning,
        summary=summary,
    )


DOCUMENT_INSTRUCTIONS = {
    "doctor_prescription": "Obtain a signed clinical prescription from your consulting MBBS/MD doctor specifying your diagnosis and prescribed medicines.",
    "hospital_bill": "Request an itemized cash receipt or invoice from the clinic or hospital counter showing consultation, procedure, and medicine charges.",
    "gig_platform_id": "Take a screenshot of your active delivery partner or driver profile from your work app (e.g. Zomato, Swiggy, Uber).",
    "fir_or_police_report": "Visit the local police station having jurisdiction over the accident location to collect a certified copy of the FIR or police inquest Panchnama.",
    "immediate_hospital_medical_report": "Obtain an Emergency Medical Treatment Report or Medico-Legal Certificate (MLC) from the treating hospital stating the accident circumstance.",
    "land_record_ror": "Download your Record of Rights (RoR / 7/12 / Patta extract) from your State land revenue portal or local Taluk office.",
    "crop_damage_photo": "Take clear geo-tagged photographs of the flooded or lodged field using the Crop Insurance Mobile App or camera.",
    "sowing_certificate": "Obtain a sowing certificate or crop declaration endorsed by your Village Administrative Officer (Patwari / Revenue Authority).",
    "ayushman_ecard": "Download your Ayushman Bharat e-Card or ABHA ID from the national portal (beneficiary.nha.gov.in) or present your eligible ration card.",
    "hospital_discharge_summary": "Collect your detailed discharge summary along with in-patient clinical notes from the hospital billing desk.",
    "death_certificate": "Obtain an official Death Certificate issued by the local Municipal Corporation, Gram Panchayat, or Registrar of Births & Deaths.",
    "aadhaar_card": "Upload a clear photo or photocopy of your Aadhaar card for KYC verification.",
    "bank_passbook": "Upload a photo of your bank passbook front page or cancelled cheque showing your name, IFSC, and account number.",
}


class DocumentCheckResult(RuleCheckResult):
    """RuleCheckResult that also allows unpacking: rule_check, missing_docs = check_required_documents(...)"""
    def __iter__(self):
        return iter((self, self.missing_documents or {}))


def check_required_documents(
    policy: Dict[str, Any],
    uploaded_doc_types: List[str],
    incident_subtype: Optional[str] = None
) -> DocumentCheckResult:
    """
    Compares uploaded document tags against mandatory scheme requirements.
    Includes smart conditional rules:
    - For PMSBY road/drowning accidents: requires FIR / police report.
    - For PMSBY snakebite/fall: accepts an immediate hospital medical report.
    - For Micro-Health: requires doctor_prescription and hospital_bill.
    Returns DocumentCheckResult with missing document keys and 1-sentence upload instructions.
    """
    policy_id = policy.get("id", "").lower()
    policy_name = policy.get("short_code", policy.get("name", "Policy"))

    # Normalize uploaded tags
    normalized_uploads = set()
    for tag in uploaded_doc_types:
        clean = tag.strip().lower().replace(" ", "_").replace("-", "_")
        normalized_uploads.add(clean)
        # Aliases
        if any(k in clean for k in ("bill", "receipt", "invoice", "cash_memo", "opd")):
            normalized_uploads.add("hospital_bill")
        if any(k in clean for k in ("prescription", "rx", "clinical_note")):
            normalized_uploads.add("doctor_prescription")
        if clean in ("fir", "police_report", "inquest_report", "panchnama"):
            normalized_uploads.add("fir_or_police_report")
        if clean in ("mlc", "hospital_report", "emergency_report", "treatment_slip"):
            normalized_uploads.add("immediate_hospital_medical_report")
        if clean in ("ror", "7_12", "712", "patta", "land_record"):
            normalized_uploads.add("land_record_ror")
        if clean in ("crop_photo", "damage_photo", "field_photo"):
            normalized_uploads.add("crop_damage_photo")
        if clean in ("ayushman_card", "abha_card", "pmjay_card"):
            normalized_uploads.add("ayushman_ecard")
        if clean in ("discharge_summary", "ipd_summary"):
            normalized_uploads.add("hospital_discharge_summary")

    missing_docs: Dict[str, str] = {}
    subtype_clean = (incident_subtype or "").strip().lower()

    if policy_id == "micro_health_gig":
        # Mandatory: hospital_bill AND doctor_prescription
        if "hospital_bill" not in normalized_uploads:
            missing_docs["hospital_bill"] = DOCUMENT_INSTRUCTIONS["hospital_bill"]
        if "doctor_prescription" not in normalized_uploads:
            missing_docs["doctor_prescription"] = DOCUMENT_INSTRUCTIONS["doctor_prescription"]

    elif policy_id == "pmsby":
        # Smart conditional accident rules
        is_road_or_drowning = any(k in subtype_clean for k in ["road", "traffic", "vehicle", "crash", "drowning", "hit_and_run"])
        is_snakebite_or_fall = any(k in subtype_clean for k in ["snakebite", "snake", "fall", "tree", "terrace", "roof", "slip", "poisoning"])

        if is_road_or_drowning:
            if "fir_or_police_report" not in normalized_uploads:
                missing_docs["fir_or_police_report"] = DOCUMENT_INSTRUCTIONS["fir_or_police_report"]
        elif is_snakebite_or_fall:
            # Accepts either hospital report OR police report
            if not ("immediate_hospital_medical_report" in normalized_uploads or "fir_or_police_report" in normalized_uploads):
                missing_docs["immediate_hospital_medical_report"] = DOCUMENT_INSTRUCTIONS["immediate_hospital_medical_report"]
        else:
            # Unspecified accident: requires at least one official report
            if not ("fir_or_police_report" in normalized_uploads or "immediate_hospital_medical_report" in normalized_uploads):
                missing_docs["fir_or_police_report"] = DOCUMENT_INSTRUCTIONS["fir_or_police_report"]

    elif policy_id == "pmfby":
        if "land_record_ror" not in normalized_uploads:
            missing_docs["land_record_ror"] = DOCUMENT_INSTRUCTIONS["land_record_ror"]
        if "crop_damage_photo" not in normalized_uploads:
            missing_docs["crop_damage_photo"] = DOCUMENT_INSTRUCTIONS["crop_damage_photo"]
        if "sowing_certificate" not in normalized_uploads:
            missing_docs["sowing_certificate"] = DOCUMENT_INSTRUCTIONS["sowing_certificate"]

    elif policy_id == "ab_pmjay":
        if "ayushman_ecard" not in normalized_uploads:
            missing_docs["ayushman_ecard"] = DOCUMENT_INSTRUCTIONS["ayushman_ecard"]
        if "hospital_discharge_summary" not in normalized_uploads:
            missing_docs["hospital_discharge_summary"] = DOCUMENT_INSTRUCTIONS["hospital_discharge_summary"]

    elif policy_id == "pmjjby":
        if "death_certificate" not in normalized_uploads:
            missing_docs["death_certificate"] = DOCUMENT_INSTRUCTIONS["death_certificate"]

    if missing_docs:
        missing_keys_str = ", ".join(missing_docs.keys())
        instructions_summary = "; ".join(f"{k}: {inst}" for k, inst in missing_docs.items())
        return DocumentCheckResult(
            rule_id="RULE_REQUIRED_DOCUMENTS",
            label="Mandatory Document Checklist",
            status="FAIL",
            explanation=f"Missing {len(missing_docs)} mandatory document(s) for {policy_name}: {missing_keys_str}.",
            action_required=instructions_summary,
            missing_documents=missing_docs,
        )

    return DocumentCheckResult(
        rule_id="RULE_REQUIRED_DOCUMENTS",
        label="Mandatory Document Checklist",
        status="PASS",
        explanation=f"All mandatory proof documents for {policy_name} have been provided.",
        action_required=None,
        missing_documents={},
    )


def revalidate_claim_data(
    policy_id: str,
    extracted_data: ExtractedBillData,
    manual_overrides: Optional[Dict[str, Any]] = None,
    updated_uploaded_doc_types: Optional[List[str]] = None,
    user_metadata: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict[str, Any], ExtractionConfidenceResult, ExtractedBillData]:
    """
    Re-runs deterministic validation instantaneously on updated/corrected claim data
    without re-calling OCR. Marks manually verified fields as confidence: 1.0.
    """
    from services.policy_service import get_policy_by_id

    policy = get_policy_by_id(policy_id)

    # Clone or prepare extracted_data copy
    data_dict = extracted_data.model_dump()
    field_confidences = dict(data_dict.get("field_confidences") or {})
    unreadable = list(data_dict.get("unreadable_fields") or [])

    # Apply manual overrides if provided
    if manual_overrides:
        for key, val in manual_overrides.items():
            if hasattr(extracted_data, key):
                data_dict[key] = val
                field_confidences[key] = 1.0
                if key in unreadable:
                    unreadable.remove(key)
            if key in ("bill_date", "incident_or_bill_date"):
                data_dict["incident_or_bill_date"] = val
                field_confidences["incident_or_bill_date"] = 1.0
                field_confidences["bill_date"] = 1.0
                for alias in ("bill_date", "incident_or_bill_date"):
                    if alias in unreadable:
                        unreadable.remove(alias)
            if key in ("total_amount", "total_amount_inr"):
                data_dict["total_amount_inr"] = float(val) if val is not None else None
                field_confidences["total_amount_inr"] = 1.0
                field_confidences["total_amount"] = 1.0
                for alias in ("total_amount", "total_amount_inr"):
                    if alias in unreadable:
                        unreadable.remove(alias)

    # If date is now populated, clean up unreadable list and mark confidence 1.0
    if data_dict.get("incident_or_bill_date"):
        field_confidences["incident_or_bill_date"] = 1.0
        field_confidences["bill_date"] = 1.0
        for alias in ("bill_date", "incident_or_bill_date"):
            if alias in unreadable:
                unreadable.remove(alias)

    # If field is populated and was previously unreadable, mark confidence 1.0
    for field_name in ["incident_or_bill_date", "total_amount_inr", "provider_name", "diagnosis_or_event"]:
        val = data_dict.get(field_name)
        if val is not None and str(val).strip():
            if field_name in unreadable:
                unreadable.remove(field_name)
            if field_confidences.get(field_name, 0.0) < 0.75:
                field_confidences[field_name] = 1.0

    data_dict["field_confidences"] = field_confidences
    data_dict["unreadable_fields"] = unreadable

    updated_extracted = ExtractedBillData(**data_dict)

    # Merge metadata
    meta = dict(user_metadata or {})
    if updated_uploaded_doc_types:
        meta["uploaded_doc_types"] = updated_uploaded_doc_types

    # Execute deterministic validators instantaneously
    val_result = validate_claim(updated_extracted, policy, user_metadata=meta)
    conf_result = evaluate_extraction_confidence(updated_extracted)

    return val_result, conf_result, updated_extracted


def check_age_and_window(
    extracted_data: ExtractedBillData,
    policy: Dict[str, Any],
    user_metadata: Optional[Dict[str, Any]] = None
) -> RuleCheckResult:
    """
    Rule 1: Age & Policy Window Check
    Verifies that the claimant age falls within policy min_age and max_age.
    """
    meta = user_metadata or {}
    age = meta.get("age") or meta.get("claimant_age")
    min_age = policy.get("min_age", 0)
    max_age = policy.get("max_age", 100)
    policy_name = policy.get("short_code", policy.get("name", "Policy"))

    if age is None:
        return RuleCheckResult(
            rule_id="RULE_AGE_WINDOW",
            label="Age & Policy Eligibility Window",
            status="WARNING",
            explanation=f"Claimant age was not provided in metadata. Scheme requires age {min_age}–{max_age} years.",
            action_required="Provide Aadhaar card or age proof to substantiate age eligibility.",
        )

    if age < min_age:
        return RuleCheckResult(
            rule_id="RULE_AGE_WINDOW",
            label="Age & Policy Eligibility Window",
            status="FAIL",
            explanation=f"Claimant age ({age}) is below minimum allowable entry age of {min_age} years for {policy_name}.",
            action_required="Claim is ineligible due to entry age restriction.",
        )

    if age > max_age:
        return RuleCheckResult(
            rule_id="RULE_AGE_WINDOW",
            label="Age & Policy Eligibility Window",
            status="FAIL",
            explanation=f"Claimant age ({age}) exceeds maximum statutory age limit of {max_age} years for {policy_name}.",
            action_required="Claim is ineligible due to age band restriction.",
        )

    return RuleCheckResult(
        rule_id="RULE_AGE_WINDOW",
        label="Age & Policy Eligibility Window",
        status="PASS",
        explanation=f"Claimant age ({age}) is within the allowable range of {min_age}–{max_age} years.",
        action_required=None,
    )


def check_waiting_and_lien_period(
    extracted_data: ExtractedBillData,
    policy: Dict[str, Any],
    user_metadata: Optional[Dict[str, Any]] = None
) -> RuleCheckResult:
    """
    Rule 2: Waiting / Lien Period Check
    - PMJJBY: 30-day non-accidental lien period.
    - Micro-Health: 15-day medical illness waiting period (accidents covered day one).
    - PMSBY / AB-PMJAY / PMFBY: 0 days waiting period.
    """
    policy_id = policy.get("id", "").lower()
    meta = user_metadata or {}
    days_enrolled = meta.get("days_since_enrollment")
    is_accidental = meta.get("is_accidental", False)

    # If diagnosis indicates trauma/road accident, treat as accidental
    diagnosis = (extracted_data.diagnosis_or_event or "").lower()
    if any(k in diagnosis for k in ["accident", "fall", "fracture", "trauma", "crash", "laceration", "suture"]):
        is_accidental = True

    if policy_id == "pmjjby":
        # 30-day lien applies to non-accidental deaths
        if is_accidental:
            return RuleCheckResult(
                rule_id="RULE_WAITING_LIEN_PERIOD",
                label="PMJJBY 30-Day Lien Period Check",
                status="PASS",
                explanation="Accidental death claims are exempted from the PMJJBY 30-day initial lien period.",
                action_required=None,
            )
        if days_enrolled is not None and days_enrolled < 30:
            return RuleCheckResult(
                rule_id="RULE_WAITING_LIEN_PERIOD",
                label="PMJJBY 30-Day Lien Period Check",
                status="FAIL",
                explanation=(
                    f"Death occurred within {days_enrolled} days of enrollment. "
                    "PMJJBY enforces a strict 30-day lien period for non-accidental mortality."
                ),
                action_required="Non-accidental claims within the first 30 days are statutorily barred.",
            )
        return RuleCheckResult(
            rule_id="RULE_WAITING_LIEN_PERIOD",
            label="PMJJBY 30-Day Lien Period Check",
            status="PASS",
            explanation="Claim satisfies the PMJJBY 30-day lien period requirement.",
            action_required=None,
        )

    elif policy_id == "micro_health_gig":
        # 15-day waiting period for sickness; zero for accidents
        if is_accidental:
            return RuleCheckResult(
                rule_id="RULE_WAITING_LIEN_PERIOD",
                label="Micro-Health 15-Day Waiting Period",
                status="PASS",
                explanation="Accidental trauma and minor injury treatments have zero waiting period (covered from day one).",
                action_required=None,
            )
        if days_enrolled is not None and days_enrolled < 15:
            return RuleCheckResult(
                rule_id="RULE_WAITING_LIEN_PERIOD",
                label="Micro-Health 15-Day Waiting Period",
                status="FAIL",
                explanation=f"Medical illness occurred {days_enrolled} days after policy issuance (15-day waiting period applies).",
                action_required="Treatment commenced before the 15-day waiting window completed.",
            )
        return RuleCheckResult(
            rule_id="RULE_WAITING_LIEN_PERIOD",
            label="Micro-Health 15-Day Waiting Period",
            status="PASS",
            explanation="Claim satisfies the policy waiting period criteria.",
            action_required=None,
        )

    return RuleCheckResult(
        rule_id="RULE_WAITING_LIEN_PERIOD",
        label="Waiting Period Verification",
        status="PASS",
        explanation="Scheme has zero waiting period; coverage is active from day one.",
        action_required=None,
    )


def check_claim_type_compatibility(
    extracted_data: ExtractedBillData,
    policy: Dict[str, Any],
    user_metadata: Optional[Dict[str, Any]] = None
) -> RuleCheckResult:
    """
    Rule 3: Claim Type Compatibility Check
    Hard FAIL if user submits routine OPD clinic bill under PMSBY or AB-PMJAY.
    """
    policy_id = policy.get("id", "").lower()
    doc_type = (extracted_data.document_type or "").lower()
    diagnosis = (extracted_data.diagnosis_or_event or "").lower()

    # PMSBY: Strictly Personal Accident & Permanent Disability
    if policy_id == "pmsby":
        if any(term in doc_type for term in ["clinic_opd", "pharmacy", "doctor_consultation"]) and not any(
            t in diagnosis for t in ["disability", "amputation", "fatal", "death", "permanent loss"]
        ):
            return RuleCheckResult(
                rule_id="RULE_CLAIM_TYPE_COMPATIBILITY",
                label="Claim Type Scope & Compatibility",
                status="FAIL",
                explanation=(
                    "PMSBY (Pradhan Mantri Suraksha Bima Yojana) is strictly a Personal Accident Death & "
                    "Permanent Disability assurance scheme. Routine out-patient clinic bills, consultations, "
                    "and medicines are strictly excluded."
                ),
                action_required="Submit under a micro-health or outpatient insurance scheme instead.",
            )

    # AB-PMJAY: Secondary & Tertiary Inpatient Hospitalization Only (No standalone OPD)
    elif policy_id == "ab_pmjay":
        if any(term in doc_type for term in ["clinic_opd", "pharmacy_receipt", "retail_bill", "opd_consultation"]):
            return RuleCheckResult(
                rule_id="RULE_CLAIM_TYPE_COMPATIBILITY",
                label="Claim Type Scope & Compatibility",
                status="FAIL",
                explanation=(
                    "AB-PMJAY covers secondary and tertiary inpatient hospitalization with overnight admission. "
                    "Standalone outpatient clinic visits and standalone pharmacy receipts are strictly excluded."
                ),
                action_required="AB-PMJAY claims require an IPD hospitalization discharge summary from an empanelled hospital.",
            )

    # PMFBY: Agricultural crop damage only
    elif policy_id == "pmfby":
        if any(t in doc_type for t in ["medical", "clinic", "hospital", "pharmacy"]):
            return RuleCheckResult(
                rule_id="RULE_CLAIM_TYPE_COMPATIBILITY",
                label="Claim Type Scope & Compatibility",
                status="FAIL",
                explanation="PMFBY is an agricultural crop loss scheme and cannot process human medical or healthcare bills.",
                action_required="Upload crop loss intimation documents or land survey records.",
            )

    return RuleCheckResult(
        rule_id="RULE_CLAIM_TYPE_COMPATIBILITY",
        label="Claim Type Scope & Compatibility",
        status="PASS",
        explanation=f"Document type '{extracted_data.document_type}' is compatible with {policy.get('name')} coverage scope.",
        action_required=None,
    )


def check_coverage_caps(
    extracted_data: ExtractedBillData,
    policy: Dict[str, Any],
    net_admissible_amount: float
) -> Tuple[RuleCheckResult, float]:
    """
    Rule 4: Coverage Cap Check
    WARNING with exact payable cap calculation if bill exceeds policy limits
    (e.g., ₹5,000 Micro-Health per-claim cap).
    Returns (RuleCheckResult, payable_capped_amount).
    """
    policy_id = policy.get("id", "").lower()
    total_billed = extracted_data.total_amount_inr or net_admissible_amount

    # Per-claim cap mapping
    if policy_id == "micro_health_gig":
        per_claim_cap = 5000.0
        if net_admissible_amount > per_claim_cap:
            capped_payout = per_claim_cap
            excess = net_admissible_amount - per_claim_cap
            return (
                RuleCheckResult(
                    rule_id="RULE_COVERAGE_CAP",
                    label="Coverage Sub-Limit & Policy Cap",
                    status="WARNING",
                    explanation=(
                        f"Admissible claim amount of ₹{net_admissible_amount:,.2f} exceeds the ₹{per_claim_cap:,.0f} "
                        f"single-claim policy cap. Payout is capped at ₹{per_claim_cap:,.0f} (₹{excess:,.2f} excess borne by claimant)."
                    ),
                    action_required=f"Payable estimate capped at ₹{per_claim_cap:,.0f} per policy terms.",
                ),
                capped_payout,
            )
        return (
            RuleCheckResult(
                rule_id="RULE_COVERAGE_CAP",
                label="Coverage Sub-Limit & Policy Cap",
                status="PASS",
                explanation=f"Claim amount of ₹{net_admissible_amount:,.2f} is within the ₹{per_claim_cap:,.0f} per-claim cap.",
                action_required=None,
            ),
            net_admissible_amount,
        )

    elif policy_id in ("pmsby", "pmjjby"):
        cap = float(policy.get("max_claim_inr", 200000.0))
        payable = min(net_admissible_amount, cap)
        return (
            RuleCheckResult(
                rule_id="RULE_COVERAGE_CAP",
                label="Policy Sum Insured Cap",
                status="PASS" if net_admissible_amount <= cap else "WARNING",
                explanation=f"Policy limit is ₹{cap:,.0f}. Net admissible: ₹{payable:,.2f}.",
                action_required=None,
            ),
            payable,
        )

    elif policy_id == "ab_pmjay":
        cap = float(policy.get("max_claim_inr", 500000.0))
        payable = min(net_admissible_amount, cap)
        return (
            RuleCheckResult(
                rule_id="RULE_COVERAGE_CAP",
                label="AB-PMJAY Family Floater Cap",
                status="PASS",
                explanation=f"Cashless treatment admissible within the ₹{cap:,.0f} family floater limit.",
                action_required=None,
            ),
            payable,
        )

    return (
        RuleCheckResult(
            rule_id="RULE_COVERAGE_CAP",
            label="Policy Coverage Cap",
            status="PASS",
            explanation=f"Admissible amount: ₹{net_admissible_amount:,.2f}.",
            action_required=None,
        ),
        net_admissible_amount,
    )


def scan_exclusion_keywords(
    extracted_data: ExtractedBillData,
    policy: Dict[str, Any]
) -> Tuple[RuleCheckResult, float, List[ItemizedCharge]]:
    """
    Rule 5: Exclusion Keyword Scanner
    Scans itemized line items for excluded categories (vitamins, dietary tonics,
    cosmetics, routine dental).
    Returns (RuleCheckResult, total_disallowed_inr, updated_itemized_charges).
    """
    policy_id = policy.get("id", "").lower()
    disallowed_sum = 0.0
    flagged_reasons = []
    audited_charges: List[ItemizedCharge] = []

    # Compile regex patterns
    all_exclusions = (
        EXCLUSION_KEYWORDS["vitamins_supplements"]
        + EXCLUSION_KEYWORDS["cosmetic_aesthetic"]
        + EXCLUSION_KEYWORDS["routine_dental"]
    )
    pattern = re.compile(r"\b(" + "|".join(re.escape(k) for k in all_exclusions) + r")\b", re.IGNORECASE)

    for item in extracted_data.itemized_charges:
        name_lower = item.item_name.lower()
        amt = item.amount_inr

        # Only apply non-clinical exclusions if policy excludes them (e.g. Micro-Health, AB-PMJAY)
        match = pattern.search(name_lower)
        if match and policy_id in ("micro_health_gig", "ab_pmjay"):
            matched_word = match.group(0)
            disallowed_sum += amt
            flagged_reasons.append(f"₹{amt:,.0f} for '{item.item_name}' ({matched_word})")
            audited_charges.append(
                ItemizedCharge(
                    item_name=item.item_name,
                    amount_inr=amt,
                    category=item.category,
                    is_covered=False,
                    exclusion_reason=f"Excluded non-essential item: {matched_word}",
                )
            )
        else:
            audited_charges.append(
                ItemizedCharge(
                    item_name=item.item_name,
                    amount_inr=amt,
                    category=item.category,
                    is_covered=True,
                    exclusion_reason=None,
                )
            )

    if disallowed_sum > 0:
        return (
            RuleCheckResult(
                rule_id="RULE_EXCLUSION_SCANNER",
                label="Itemized Exclusion Scanner",
                status="WARNING",
                explanation=(
                    f"Disallowed ₹{disallowed_sum:,.2f} for policy exclusions: {', '.join(flagged_reasons)}. "
                    "Cosmetics, nutritional tonics, multi-vitamins, and routine dental items are excluded."
                ),
                action_required=f"Deducted ₹{disallowed_sum:,.2f} from admissible payout.",
            ),
            disallowed_sum,
            audited_charges,
        )

    return (
        RuleCheckResult(
            rule_id="RULE_EXCLUSION_SCANNER",
            label="Itemized Exclusion Scanner",
            status="PASS",
            explanation="No excluded vitamins, supplements, cosmetics, or dental items detected.",
            action_required=None,
        ),
        0.0,
        audited_charges,
    )


def check_72h_intimation(
    extracted_data: ExtractedBillData,
    policy: Dict[str, Any],
    user_metadata: Optional[Dict[str, Any]] = None
) -> RuleCheckResult:
    """
    Rule 6: 72-Hour Intimation Check for PMFBY Localized Calamities
    Enforces mandatory 72-hour reporting rule from casualty event to intimation.
    """
    policy_id = policy.get("id", "").lower()
    if policy_id != "pmfby":
        return RuleCheckResult(
            rule_id="RULE_72H_INTIMATION",
            label="72-Hour Calamity Intimation Rule",
            status="PASS",
            explanation="72-hour intimation rule is not applicable to non-agricultural policies.",
            action_required=None,
        )

    meta = user_metadata or {}
    hours_elapsed = None

    if extracted_data.damage_assessment and extracted_data.damage_assessment.intimation_hours_elapsed is not None:
        hours_elapsed = extracted_data.damage_assessment.intimation_hours_elapsed
    elif "hours_since_calamity" in meta:
        hours_elapsed = float(meta["hours_since_calamity"])

    if hours_elapsed is None:
        return RuleCheckResult(
            rule_id="RULE_72H_INTIMATION",
            label="72-Hour Calamity Intimation Rule",
            status="WARNING",
            explanation="Exact time of localized calamity occurrence was not specified. PMFBY requires intimation within 72 hours.",
            action_required="Provide date/time of storm or inundation event via village revenue officer intimation slip.",
        )

    if hours_elapsed > 72.0:
        return RuleCheckResult(
            rule_id="RULE_72H_INTIMATION",
            label="72-Hour Calamity Intimation Rule",
            status="FAIL",
            explanation=(
                f"Calamity was reported after {hours_elapsed:.1f} hours. "
                "PMFBY guidelines strictly mandate intimation within 72 hours of localized disasters."
            ),
            action_required="Localized calamity claim is disqualified due to delayed reporting beyond 72 hours.",
        )

    return RuleCheckResult(
        rule_id="RULE_72H_INTIMATION",
        label="72-Hour Calamity Intimation Rule",
        status="PASS",
        explanation=f"Calamity was intimated within {hours_elapsed:.1f} hours (under the 72-hour statutory threshold).",
        action_required=None,
    )


def validate_claim(
    extracted_data: ExtractedBillData,
    policy: Dict[str, Any],
    user_metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Executes all 6 deterministic verification rules sequentially,
    calculates exact deductions and coverage caps, and determines overall eligibility.
    """
    rule_results: List[RuleCheckResult] = []

    # 1. Age & Window Check
    r1 = check_age_and_window(extracted_data, policy, user_metadata)
    rule_results.append(r1)

    # 2. Waiting / Lien Period Check
    r2 = check_waiting_and_lien_period(extracted_data, policy, user_metadata)
    rule_results.append(r2)

    # 3. Claim Type Compatibility Check
    r3 = check_claim_type_compatibility(extracted_data, policy, user_metadata)
    rule_results.append(r3)

    # 4 & 5. Exclusion Scanning & Coverage Cap Calculations
    r5, disallowed_inr, updated_items = scan_exclusion_keywords(extracted_data, policy)
    rule_results.append(r5)

    # Calculate net admissible before policy cap
    total_billed = extracted_data.total_amount_inr or sum(item.amount_inr for item in extracted_data.itemized_charges)
    net_admissible = max(0.0, total_billed - disallowed_inr)

    r4, payable_capped_inr = check_coverage_caps(extracted_data, policy, net_admissible)
    rule_results.append(r4)

    # 6. 72-Hour Intimation Check
    r6 = check_72h_intimation(extracted_data, policy, user_metadata)
    rule_results.append(r6)

    # 7. Document Checklist Verification (if uploaded_doc_types explicitly provided)
    meta = user_metadata or {}
    ordered_results = [r1, r2, r3, r4, r5, r6]
    if "uploaded_doc_types" in meta:
        uploaded_tags = meta["uploaded_doc_types"]
        incident_subtype = meta.get("incident_subtype") or extracted_data.diagnosis_or_event
        r7 = check_required_documents(policy, uploaded_tags, incident_subtype)
        ordered_results.append(r7)

    # Synthesize overall eligibility
    has_fail = any(r.status == "FAIL" for r in ordered_results)
    has_warning = any(r.status == "WARNING" for r in ordered_results)

    if has_fail:
        overall_eligibility = "FAIL"
        recommended_status = "REJECTED"
        eligible_payout = 0.0
        summary_notes = "Claim rejected: Failed mandatory policy compliance checks. Review detailed rule failures."
    elif has_warning:
        overall_eligibility = "WARNING"
        recommended_status = "NEEDS_REVIEW"
        eligible_payout = payable_capped_inr
        summary_notes = (
            f"Claim conditionally admissible with warnings. Disallowed ₹{disallowed_inr:,.2f} in exclusions; "
            f"payable payout estimated at ₹{eligible_payout:,.2f}."
        )
    else:
        overall_eligibility = "PASS"
        recommended_status = "READY_TO_APPROVE"
        eligible_payout = payable_capped_inr
        summary_notes = f"All compliance checks passed. Full estimated payable sum: ₹{eligible_payout:,.2f}."

    return {
        "rule_checks": ordered_results,
        "claimed_amount_inr": total_billed,
        "disallowed_amount_inr": disallowed_inr,
        "eligible_payout_inr": eligible_payout,
        "overall_eligibility": overall_eligibility,
        "recommended_status": recommended_status,
        "summary_notes": summary_notes,
        "updated_itemized_charges": updated_items,
    }
