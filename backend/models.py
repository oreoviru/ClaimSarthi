"""Pydantic v2 data models and contracts for micro-insuranceassistant."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------------------------
# Auxiliary Sub-Models
# ---------------------------------------------------------------------------

class ItemizedCharge(BaseModel):
    """Itemized line item charge from a medical bill, pharmacy receipt, or repair invoice."""
    model_config = ConfigDict(extra="ignore")

    item_name: str = Field(..., description="Description or name of the service, medicine, or procedure")
    amount_inr: float = Field(..., ge=0.0, description="Cost of the item in Indian Rupees (INR)")
    category: Optional[str] = Field(
        None,
        description="Category such as consultation, pharmacy, diagnostic_lab, procedure, or consumable"
    )
    is_covered: Optional[bool] = Field(
        None,
        description="Whether this item is eligible for coverage under the evaluated policy"
    )
    exclusion_reason: Optional[str] = Field(
        None,
        description="Explanation if the item is disallowed (e.g. vitamins, cosmetics, routine dental)"
    )


class DamageAssessment(BaseModel):
    """Detailed damage or loss parameters for crop and disability claims."""
    model_config = ConfigDict(extra="ignore")

    calamity_type: Optional[str] = Field(
        None,
        description="Type of natural calamity (e.g. hailstorm, landslide, inundation, drought, unseasonal rain)"
    )
    crop_name: Optional[str] = Field(None, description="Affected crop species or produce")
    affected_area_acres: Optional[float] = Field(None, ge=0.0, description="Farm area damaged in acres")
    loss_percentage: Optional[float] = Field(None, ge=0.0, le=100.0, description="Estimated crop loss percentage")
    intimation_hours_elapsed: Optional[float] = Field(
        None,
        ge=0.0,
        description="Hours elapsed between localized casualty event and claim intimation (threshold 72h)"
    )
    post_harvest_days: Optional[int] = Field(
        None,
        ge=0,
        description="Days since harvest if crop was drying in cut-and-spread condition (threshold 14 days)"
    )
    disability_type: Optional[str] = Field(
        None,
        description="Type of permanent disability (total, partial, or none)"
    )
    disability_percentage: Optional[float] = Field(
        None,
        ge=0.0,
        le=100.0,
        description="Disability percentage certified by Civil Surgeon / Government Medical Board"
    )
    severity: Optional[Literal["low", "moderate", "severe", "unclear"]] = Field(
        None,
        description="Visible damage severity level"
    )
    category_match: Optional[bool] = Field(
        None,
        description="Whether image content matches the claimed loss domain"
    )
    visual_evidence_summary: Optional[str] = Field(
        None,
        description="Concise description of visual damage for insurer packet"
    )


class DamagePhotoAnalysis(BaseModel):
    """Visual evidence evaluation result for crop loss or accident trauma claims."""
    model_config = ConfigDict(extra="ignore")

    claim_category: str = Field(..., description="Target claim category ('crop' or 'accident')")
    matches_claim_category: bool = Field(..., description="Whether photo actually matches the claimed category")
    mismatch_reason: Optional[str] = Field(None, description="Explanation if wrong upload detected")
    damage_type: str = Field(..., description="Identified loss type (e.g. lodged_crop, flood_inundation, vehicular_crash, injury_bandaging)")
    severity: Literal["low", "moderate", "severe", "unclear"] = Field(..., description="Estimated visible loss severity")
    clarity_score: float = Field(..., ge=0.0, le=1.0, description="Photo sharpness and lighting clarity score")
    visual_summary: str = Field(..., description="2-sentence plain-English visual summary for the insurer packet")
    detected_features: List[str] = Field(default_factory=list, description="Visual markers detected in photo")
    damage_assessment: DamageAssessment = Field(..., description="Normalized damage assessment data")


class PolicySummaryDetails(BaseModel):
    """Embedded summary representation of policy parameters."""
    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., description="Unique scheme identifier")
    name: str = Field(..., description="Full official scheme name")
    short_code: str = Field(..., description="Short acronym (e.g. PMSBY, PMJJBY, AB-PMJAY)")
    category: str = Field(..., description="Coverage domain")
    annual_premium_inr: float = Field(..., ge=0.0, description="Annual base or capped premium in INR")
    max_claim_inr: float = Field(..., ge=0.0, description="Maximum coverage cap in INR")
    waiting_period_days: int = Field(..., ge=0, description="Waiting period before coverage begins")
    is_government_scheme: bool = Field(..., description="Flag indicating government social security scheme")
    plain_summary: str = Field(..., description="Layman friendly description of coverage")


# ---------------------------------------------------------------------------
# Recommendation Contracts
# ---------------------------------------------------------------------------

class RecommendRequest(BaseModel):
    """User profile input for matching and recommending suitable micro-insurance schemes."""
    model_config = ConfigDict(extra="ignore")

    occupation: str = Field(
        ...,
        min_length=2,
        description="Occupation or livelihood (e.g. Farmer, Delivery Partner, Street Vendor, Construction Worker)"
    )
    age: int = Field(..., ge=0, le=120, description="Applicant age in completed years")
    primary_risk: str = Field(
        ...,
        description="Primary protection concern: 'accident', 'life', 'health', 'crop', or 'general'"
    )
    max_annual_budget_inr: float = Field(
        ...,
        ge=0.0,
        description="Maximum annual budget available for insurance premiums in INR"
    )
    has_bank_account: bool = Field(
        ...,
        description="Indicates whether applicant holds an active savings bank or post office account"
    )
    crop_season: Optional[str] = Field(
        None,
        description="Relevant for agricultural schemes: 'kharif', 'rabi', or 'commercial'"
    )


class PolicyRecommendation(BaseModel):
    """Recommendation assessment for a single micro-insurance policy."""
    model_config = ConfigDict(extra="ignore")

    policy_id: str = Field(..., description="Target policy identifier")
    policy_name: str = Field(..., description="Full policy name")
    policy_details: PolicySummaryDetails = Field(..., description="Summary details of the matched policy")
    match_score: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Compatibility ranking score from 0 (incompatible) to 100 (perfect match)"
    )
    match_reasons: List[str] = Field(..., description="Bullet points explaining why this policy suits the user")
    estimated_premium_inr: float = Field(
        ...,
        ge=0.0,
        description="Estimated annual premium payable in INR based on profile parameters"
    )
    claim_readiness_checklist: List[str] = Field(
        ...,
        description="Checklist of documents and immediate actions needed to file claims seamlessly"
    )


class RecommendResponse(BaseModel):
    """Response containing ranked policy recommendations."""
    model_config = ConfigDict(extra="ignore")

    recommendations: List[PolicyRecommendation] = Field(default_factory=list)
    total_evaluated: int = Field(..., ge=0)
    top_recommendation_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Claim Extraction and OCR Contracts
# ---------------------------------------------------------------------------

class ExtractedBillData(BaseModel):
    """Structured data extracted from uploaded claim documents via multimodal AI / OCR."""
    model_config = ConfigDict(extra="ignore")

    document_type: str = Field(
        ...,
        description="Type of document (e.g. 'hospital_discharge_summary', 'crop_loss_intimation', 'clinic_opd_bill', 'death_certificate', 'disability_certificate')"
    )
    provider_name: Optional[str] = Field(
        None,
        description="Name of hospital, clinic, revenue authority, doctor, or issuing institution"
    )
    patient_or_claimant_name: Optional[str] = Field(
        None,
        description="Name of the patient, deceased, farmer, or insured individual"
    )
    incident_or_bill_date: Optional[str] = Field(
        None,
        description="Date of event, hospitalization admission, or invoice issuance (YYYY-MM-DD format if known)"
    )
    diagnosis_or_event: Optional[str] = Field(
        None,
        description="Diagnosis, cause of death, injury details, or natural calamity description"
    )
    itemized_charges: List[ItemizedCharge] = Field(
        default_factory=list,
        description="List of itemized expenses extracted from the bill"
    )
    total_amount_inr: Optional[float] = Field(
        None,
        ge=0.0,
        description="Total billed or claimed monetary amount in INR"
    )
    has_stamp_or_signature: bool = Field(
        False,
        description="Whether a visible hospital/doctor/revenue stamp or signature was detected"
    )
    legibility_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score in document clarity and readability from 0.0 to 1.0"
    )
    field_confidences: Dict[str, float] = Field(
        default_factory=dict,
        description="Confidence level (0.0 to 1.0) for individual extracted fields"
    )
    unreadable_fields: List[str] = Field(
        default_factory=list,
        description="List of fields obscured, blurry, missing, or cropped in the document"
    )
    damage_assessment: Optional[DamageAssessment] = Field(
        None,
        description="Crop damage or physical disability metrics if applicable"
    )


# ---------------------------------------------------------------------------
# Rule Evaluation and Verification Contracts
# ---------------------------------------------------------------------------

class RuleCheckResult(BaseModel):
    """Validation result for a single regulatory or policy verification rule."""
    model_config = ConfigDict(extra="ignore")

    rule_id: str = Field(..., description="Unique rule code (e.g. 'RULE_AGE_LIMIT', 'RULE_72H_INTIMATION')")
    label: str = Field(..., description="Human-readable rule title")
    status: Literal["PASS", "WARNING", "FAIL"] = Field(
        ...,
        description="Verification outcome: PASS (compliant), WARNING (review needed), FAIL (disqualified)"
    )
    explanation: str = Field(..., description="Clear explanation of the determination and rule criteria")
    action_required: Optional[str] = Field(
        None,
        description="Remedial action required by the claimant or reviewer if status is WARNING or FAIL"
    )
    missing_documents: Optional[Dict[str, str]] = Field(
        default_factory=dict,
        description="Dictionary mapping missing document keys to 1-sentence upload instructions"
    )


ExtractionReadinessStatus = Literal["READY_TO_SUBMIT", "NEEDS_FIXES", "NOT_COVERED"]


class ExtractionConfidenceResult(BaseModel):
    """Evaluation result for document OCR confidence and submission readiness."""
    model_config = ConfigDict(extra="ignore")

    readiness_score: float = Field(..., ge=0.0, le=100.0, description="Readiness score from 0 to 100")
    status: ExtractionReadinessStatus = Field(..., description="READY_TO_SUBMIT, NEEDS_FIXES, or NOT_COVERED")
    rule_checks: List[RuleCheckResult] = Field(default_factory=list, description="Per-field validation results")
    field_prompts: Dict[str, str] = Field(default_factory=dict, description="Field-specific manual fix instructions")
    unreadable_fields: List[str] = Field(default_factory=list, description="Fields requiring manual entry")
    has_stamp_warning: bool = Field(False, description="Whether doctor stamp is missing")
    summary: str = Field(..., description="Executive readiness evaluation")


# ---------------------------------------------------------------------------
# Claim Analysis and Lifecycle Contracts
# ---------------------------------------------------------------------------

ReviewerStatusType = Literal[
    "READY_TO_APPROVE",
    "NEEDS_REVIEW",
    "APPROVED",
    "INFO_REQUESTED",
    "REJECTED"
]


class ClaimAnalysisResponse(BaseModel):
    """Comprehensive AI evaluation response returned after analyzing an uploaded claim."""
    model_config = ConfigDict(extra="ignore")

    claim_id: str = Field(..., description="Unique generated claim reference ID")
    policy_id: str = Field(..., description="Policy scheme against which the claim was audited")
    policy_name: str = Field(..., description="Official scheme name")
    extracted_data: ExtractedBillData = Field(..., description="Data parsed from the uploaded document(s)")
    rule_checks: List[RuleCheckResult] = Field(..., description="Detailed outcomes of all policy rule checks")
    overall_eligibility: Literal["PASS", "WARNING", "FAIL"] = Field(
        ...,
        description="Overall synthesized compliance status"
    )
    recommended_status: ReviewerStatusType = Field(
        ...,
        description="Suggested triage status for reviewer review"
    )
    claimed_amount_inr: float = Field(0.0, ge=0.0, description="Total amount claimed by applicant")
    eligible_payout_inr: Optional[float] = Field(
        None,
        ge=0.0,
        description="Calculated payable amount within policy caps and exclusion limits"
    )
    disallowed_amount_inr: Optional[float] = Field(
        0.0,
        ge=0.0,
        description="Excluded or disallowed amount (e.g. unapproved consumables, sub-limit deductions)"
    )
    summary_notes: str = Field(..., description="Executive summary of the claim analysis for reviewer and claimant")
    analyzed_at: datetime = Field(default_factory=datetime.utcnow, description="UTC timestamp of the analysis")
    draft_id: Optional[str] = Field(None, description="Temporary draft ID for the claim submission")
    uploaded_file_urls: List[str] = Field(default_factory=list, description="Public URLs of uploaded documents")
    fix_it_checklist: List[str] = Field(default_factory=list, description="Plain-language checklist of issues requiring user fix")
    readiness_score: Optional[float] = Field(None, description="Document OCR extraction readiness score (0-100)")
    readiness_status: Optional[str] = Field(None, description="READY_TO_SUBMIT, NEEDS_FIXES, or NOT_COVERED")


class RevalidateClaimRequest(BaseModel):
    """Request contract to re-run automated rule validation with updated or manually corrected data."""
    model_config = ConfigDict(extra="ignore")

    claim_id: Optional[str] = Field(None, description="Existing draft/claim ID to re-evaluate")
    policy_id: str = Field(..., description="Policy scheme identifier")
    updated_extracted_data: Optional[ExtractedBillData] = Field(
        None,
        description="Corrected or updated bill/claim data after manual audit"
    )
    manual_overrides: Optional[Dict[str, Any]] = Field(
        None,
        description="Specific field-level overrides (e.g. {'incident_or_bill_date': '2025-06-15', 'total_amount_inr': 1500.0})"
    )
    updated_uploaded_doc_types: Optional[List[str]] = Field(
        default_factory=list,
        description="Updated list of uploaded document types (e.g. ['hospital_bill', 'doctor_prescription'])"
    )
    claimant_age: Optional[int] = Field(None, ge=0, le=120, description="Applicant age")
    claimant_name: Optional[str] = Field(None, description="Claimant name")
    policy_start_date: Optional[str] = Field(None, description="Policy issuance date")
    incident_date: Optional[str] = Field(None, description="Casualty/consultation date")
    incident_subtype: Optional[str] = Field(None, description="Casualty subtype")
    existing_file_urls: Optional[List[str]] = Field(default_factory=list, description="Preserved file URLs from earlier draft")
    additional_notes: Optional[str] = Field(
        None,
        description="Reviewer or claimant notes justifying the re-evaluation"
    )


class SubmitClaimRequest(BaseModel):
    """Request payload to officially log and register an audited claim into the system."""
    model_config = ConfigDict(extra="ignore")

    policy_id: str = Field(..., description="Target policy ID (pmsby, pmjjby, pmfby, ab_pmjay, micro_health_gig)")
    claimant_name: str = Field(..., min_length=2, description="Full legal name of claimant")
    claimant_phone: Optional[str] = Field(None, description="Contact mobile number")
    claimant_aadhaar_last4: Optional[str] = Field(None, min_length=4, max_length=4, description="Last 4 digits of Aadhaar")
    bank_account_number: Optional[str] = Field(None, description="Bank account number for DBT settlement")
    bank_ifsc: Optional[str] = Field(None, description="Bank branch IFSC code")
    document_paths: List[str] = Field(default_factory=list, description="Relative paths to uploaded source files")
    extracted_data: Optional[ExtractedBillData] = Field(None, description="Audited extracted bill data")
    incident_description: Optional[str] = Field(None, description="Narrative description of casualty or treatment")
    claimed_amount_inr: Optional[float] = Field(None, ge=0.0, description="Total amount claimed in INR")
    eligible_payout_inr: Optional[float] = Field(None, ge=0.0, description="Pre-calculated eligible payout")
    rule_checks: List[RuleCheckResult] = Field(default_factory=list, description="Scorecard from analysis")
    initial_status: Optional[ReviewerStatusType] = Field(None, description="Initial triage queue status")
    reviewer_notes: Optional[str] = Field(None, description="Initial submission notes")


class ClaimRecord(BaseModel):
    """Persistent storage contract for a processed insurance claim."""
    model_config = ConfigDict(extra="ignore")

    claim_id: str = Field(..., description="Unique claim reference code (e.g. CLM-2026-0041)")
    policy_id: str = Field(..., description="Scheme ID")
    policy_name: str = Field(..., description="Full scheme title")
    claimant_name: str = Field(..., description="Claimant full name")
    claimant_phone: Optional[str] = Field(None, description="Claimant phone number")
    claimant_aadhaar_last4: Optional[str] = Field(None, description="Last 4 digits of Aadhaar")
    bank_account_number: Optional[str] = Field(None, description="Bank account number for DBT settlement")
    bank_ifsc: Optional[str] = Field(None, description="Bank branch IFSC code")
    claimed_amount_inr: float = Field(..., ge=0.0, description="Original requested claim sum in INR")
    approved_amount_inr: Optional[float] = Field(None, ge=0.0, description="Final approved payout sum in INR")
    reviewer_status: ReviewerStatusType = Field(
        ...,
        description="Workflow state: READY_TO_APPROVE, NEEDS_REVIEW, APPROVED, INFO_REQUESTED, REJECTED"
    )
    document_paths: List[str] = Field(default_factory=list, description="URLs or local paths to attached proofs")
    extracted_data: Optional[ExtractedBillData] = Field(
        None,
        description="Extracted and verified document parameters"
    )
    rule_checks: List[RuleCheckResult] = Field(
        default_factory=list,
        description="Automated rule execution results"
    )
    reviewer_notes: Optional[str] = Field(
        None,
        description="Reviewer commentary, justification, or clarification notes"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last status update timestamp")
    decision_timestamp: Optional[datetime] = Field(
        None,
        description="Timestamp when the claim adjudication decision was recorded"
    )
    decided_at: Optional[datetime] = Field(
        None,
        description="Timestamp when the claim adjudication decision was recorded"
    )


DecisionStatusType = Literal["APPROVED", "INFO_REQUESTED", "REJECTED"]


class ClaimDecisionRequest(BaseModel):
    """Payload for adjudicating a claim decision by an insurer officer."""
    model_config = ConfigDict(extra="ignore")

    status: DecisionStatusType = Field(
        ...,
        description="Reviewer decision status (APPROVED, INFO_REQUESTED, or REJECTED)"
    )
    approved_amount_inr: Optional[float] = Field(
        None,
        ge=0.0,
        description="Final authorized payout amount in INR"
    )
    reviewer_notes: Optional[str] = Field(
        None,
        description="Reviewer decision rationale or clarification request notes"
    )


class ClaimsDashboardResponse(BaseModel):
    """Insurer dashboard response contract containing triage queue metrics and sorted claims."""
    model_config = ConfigDict(extra="ignore")

    total_claims: int = Field(..., ge=0, description="Total number of submitted claims")
    ready_to_approve: int = Field(..., ge=0, description="Claims passing all deterministic rules")
    needs_review: int = Field(..., ge=0, description="Claims requiring human review")
    approved_count: int = Field(..., ge=0, description="Total approved claims count")
    prevented_rejections_count: int = Field(..., ge=0, description="Claims pre-validated or adjusted to avoid rejection")
    claims: List[ClaimRecord] = Field(default_factory=list, description="Submitted claims sorted newest-first")


# ---------------------------------------------------------------------------
# Premium Calculation Contracts
# ---------------------------------------------------------------------------

class PremiumCalculateRequest(BaseModel):
    """Parameters for computing exact and pro-rata micro-insurance scheme premiums."""
    model_config = ConfigDict(extra="ignore")

    policy_id: str = Field(
        ...,
        description="Scheme code: 'pmjjby', 'pmfby', 'pmsby', 'ab_pmjay', or 'micro_health_gig'"
    )
    enrolment_month: Optional[int] = Field(
        None,
        ge=1,
        le=12,
        description="Month of enrolment (1-12) used to determine PMJJBY pro-rata slab (e.g. October=10)"
    )
    crop_season: Optional[str] = Field(
        None,
        description="Crop season for PMFBY: 'kharif' (2%), 'rabi' (1.5%), or 'commercial' (5%)"
    )
    sum_insured_inr: Optional[float] = Field(
        50000.0,
        ge=0.0,
        description="Sum insured per hectare for PMFBY calculation (defaults to ₹50,000)"
    )
    hectares: Optional[float] = Field(
        1.0,
        ge=0.0,
        description="Farm area in hectares for PMFBY calculation (defaults to 1.0)"
    )
    billing_cycle: Optional[str] = Field(
        "monthly",
        description="Billing cycle for micro_health_gig: 'monthly' (₹49) or 'annual' (₹588)"
    )


class PremiumBreakdownResponse(BaseModel):
    """Structured premium calculation breakdown and government subsidy metrics."""
    model_config = ConfigDict(extra="ignore")

    policy_id: str
    policy_name: str
    payable_premium_inr: float
    monthly_equivalent_inr: float
    annual_equivalent_inr: float
    breakdown_text: str
    details: Dict[str, Any] = Field(default_factory=dict)

