import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
try:
    from fastapi import FastAPI, File, Form, Request, UploadFile, status
    from fastapi.exceptions import RequestValidationError
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
    from fastapi.staticfiles import StaticFiles
    from starlette.exceptions import HTTPException as StarletteHTTPException
except ImportError:
    class StarletteHTTPException(Exception):  # type: ignore
        def __init__(self, status_code: int, detail: Any = None):
            self.status_code = status_code
            self.detail = detail
            super().__init__(str(detail))

    class RequestValidationError(Exception):  # type: ignore
        def __init__(self, errors: Any = None):
            self._errors = errors or []
        def errors(self): return self._errors

    class Request:  # type: ignore
        method: str = "GET"
        class url:
            path: str = "/"

    class status:  # type: ignore
        HTTP_400_BAD_REQUEST = 400
        HTTP_404_NOT_FOUND = 404
        HTTP_422_UNPROCESSABLE_ENTITY = 422
        HTTP_500_INTERNAL_SERVER_ERROR = 500

    def File(default=..., **kwargs):  # type: ignore
        return default

    def Form(default=..., **kwargs):  # type: ignore
        return default

    class UploadFile:  # type: ignore
        def __init__(self, filename: str = "", file: Any = None, content_type: str = "image/jpeg"):
            self.filename = filename
            self.file = file
            self.content_type = content_type

        async def read(self) -> bytes:
            if hasattr(self.file, "read"):
                return self.file.read()
            if isinstance(self.file, bytes):
                return self.file
            return b""

    class JSONResponse:  # type: ignore
        def __init__(self, content: Any, status_code: int = 200, headers: Any = None):
            self.content = content
            self.status_code = status_code
            self.headers = headers or {}

    class HTMLResponse:  # type: ignore
        def __init__(self, content: str, status_code: int = 200, headers: Any = None):
            self.content = content
            self.status_code = status_code
            self.headers = headers or {}

    class FileResponse:  # type: ignore
        def __init__(self, path: Any, status_code: int = 200):
            self.path = path
            self.status_code = status_code

    class CORSMiddleware:  # type: ignore
        pass

    class StaticFiles:  # type: ignore
        def __init__(self, directory: str):
            self.directory = directory

    class FastAPI:  # type: ignore
        def __init__(self, *args, **kwargs):
            self.routes = []
        def add_middleware(self, *args, **kwargs): pass
        def mount(self, *args, **kwargs): pass
        def exception_handler(self, *args, **kwargs): return lambda f: f
        def get(self, *args, **kwargs): return lambda f: f
        def post(self, *args, **kwargs): return lambda f: f
        def patch(self, *args, **kwargs): return lambda f: f
        def put(self, *args, **kwargs): return lambda f: f
        def delete(self, *args, **kwargs): return lambda f: f

from models import (
    ClaimAnalysisResponse,
    ClaimDecisionRequest,
    ClaimRecord,
    ClaimsDashboardResponse,
    DamagePhotoAnalysis,
    ExtractedBillData,
    ItemizedCharge,
    PremiumCalculateRequest,
    PremiumBreakdownResponse,
    RecommendRequest,
    RecommendResponse,
    RevalidateClaimRequest,
    RuleCheckResult,
    SubmitClaimRequest,
)
from services.claim_store import (
    get_all_claims,
    get_claim_by_id as get_stored_claim_by_id,
    get_claims_dashboard,
    save_claim,
    update_claim_status,
)
from services.policy_service import (
    get_all_policies,
    get_policy_by_id,
    list_policies_by_category,
)
from services.premium_calculator import calculate_premium
from services.recommender_service import get_recommendations
from services.report_service import generate_claim_html_report
from services.sample_service import analyze_sample_case, get_all_samples, get_sample_by_id
from services.upload_service import process_image_bytes, process_image_upload
from services.ocr_service import analyze_damage_photo, extract_medical_bill
from services.validator_service import (
    check_required_documents,
    evaluate_extraction_confidence,
    revalidate_claim_data,
    validate_claim,
)

# ---------------------------------------------------------------------------
# Environment and Path Initialization
# ---------------------------------------------------------------------------
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("surakshasetu")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
UPLOADS_DIR = BASE_DIR / "uploads"
DATA_DIR = BASE_DIR / "data"
SAMPLES_DIR = BASE_DIR / "samples"

for path in [STATIC_DIR, UPLOADS_DIR, DATA_DIR, SAMPLES_DIR]:
    path.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# FastAPI Application Setup
# ---------------------------------------------------------------------------
APP_TITLE = "SurakshaSetu Micro-Insurance Assistant"

app = FastAPI(
    title=APP_TITLE,
    description="Multimodal Micro-Insurance Assistant with OCR Extraction, Scheme Recommendation, and Rule Audit.",
    version="1.0.0",
)

# Permissive CORS configuration for local development and hackathon testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static and upload directories
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/samples", StaticFiles(directory=str(SAMPLES_DIR)), name="samples")


# ---------------------------------------------------------------------------
# Global JSON Exception Handlers
# ---------------------------------------------------------------------------
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Ensures HTTP errors return structured JSON instead of HTML error pages."""
    logger.warning("HTTP error on %s %s: %s", request.method, request.url.path, exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail if isinstance(exc.detail, str) else "HTTP Exception",
            "details": exc.detail if not isinstance(exc.detail, str) else None,
            "status_code": exc.status_code,
            "path": request.url.path,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Ensures Pydantic schema validation failures return clean JSON details."""
    logger.warning("Validation error on %s %s: %s", request.method, request.url.path, exc.errors())
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": "Validation Error",
            "details": exc.errors(),
            "status_code": 422,
            "path": request.url.path,
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catches unhandled runtime exceptions and returns a clean JSON error response."""
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": "Internal Server Error",
            "message": str(exc),
            "status_code": 500,
            "path": request.url.path,
        },
    )


# ---------------------------------------------------------------------------
# Core Endpoints
# ---------------------------------------------------------------------------
@app.get("/", tags=["UI"])
async def serve_root():
    """Serves the main static/index.html UI at root GET /."""
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return HTMLResponse(
        content=f"<html><body><h1>{APP_TITLE}</h1><p>Index page is being initialized.</p></body></html>",
        status_code=200,
    )


@app.get("/api/health", tags=["Health"])
async def api_health():
    """Health status endpoint reporting service status and Gemini API key configuration."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    is_key_configured = bool(api_key and api_key != "your_gemini_api_key_here")
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    demo_fallback = os.getenv("DEMO_FALLBACK", "true").lower() in ("true", "1", "yes")

    return {
        "status": "healthy",
        "service": APP_TITLE,
        "gemini_api_key_configured": is_key_configured,
        "gemini_model": gemini_model,
        "demo_fallback": demo_fallback,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# Policy Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/policies", tags=["Policies"])
async def list_policies(category: Optional[str] = None):
    """Returns all micro-insurance schemes or filters them by category."""
    if category:
        return list_policies_by_category(category)
    return get_all_policies()


@app.get("/api/policies/{policy_id}", tags=["Policies"])
async def retrieve_policy(policy_id: str):
    """Returns complete policy details, exclusions, and upfront document checklists."""
    return get_policy_by_id(policy_id)


# ---------------------------------------------------------------------------
# Recommendation Endpoint
# ---------------------------------------------------------------------------
@app.post("/api/recommend", response_model=RecommendResponse, tags=["Recommendation"])
async def recommend_schemes(request: RecommendRequest):
    """
    Ranks micro-insurance schemes dynamically based on applicant age, occupation,
    protection risks, and annual budget.
    """
    return get_recommendations(request, top_k=3)


# ---------------------------------------------------------------------------
# Premium Calculation Endpoint
# ---------------------------------------------------------------------------
@app.post("/api/calculate-premium", response_model=PremiumBreakdownResponse, tags=["Premium"])
async def compute_premium(request: PremiumCalculateRequest):
    """
    Computes exact Indian micro-insurance premiums with pro-rata slabs (PMJJBY)
    and statutory crop rate caps (PMFBY).
    """
    try:
        result = calculate_premium(
            policy_id=request.policy_id,
            enrolment_month=request.enrolment_month,
            crop_season=request.crop_season,
            sum_insured_inr=request.sum_insured_inr,
            hectares=request.hectares,
            billing_cycle=request.billing_cycle,
        )
        return result
    except ValueError as e:
        raise StarletteHTTPException(status_code=400, detail=str(e))

# ---------------------------------------------------------------------------
# Upload Endpoint
# ---------------------------------------------------------------------------
@app.post("/api/upload", tags=["Upload"])
async def upload_document(file: UploadFile = File(...)):
    """
    Processes multipart document image uploads (JPG, PNG, WEBP), enforces a 10MB limit,
    corrects EXIF rotation, downscales oversized images (max 1600px), and runs
    lightweight quality audits.
    """
    return await process_image_upload(file)


# ---------------------------------------------------------------------------
# OCR Extraction Endpoint
# ---------------------------------------------------------------------------
@app.post("/api/extract-bill", response_model=ExtractedBillData, tags=["OCR"])
async def extract_bill(
    file: Optional[UploadFile] = File(None),
    file_path: Optional[str] = None
):
    """
    Extracts structured medical bill data using the configured Gemini model
    with specific handling for Indian handwritten clinic bills and receipts.
    """
    if file is not None:
        file_bytes = await file.read()
        mime_type = file.content_type or "image/jpeg"
    elif file_path:
        target = (BASE_DIR / file_path.lstrip("/")).resolve()
        if not target.exists():
            raise StarletteHTTPException(status_code=404, detail=f"File not found: {file_path}")
        file_bytes = target.read_bytes()
        mime_type = "image/png" if file_path.endswith(".png") else "image/jpeg"
    else:
        raise StarletteHTTPException(
            status_code=400,
            detail="Provide either a multipart 'file' upload or a valid 'file_path' parameter."
        )

    return extract_medical_bill(file_bytes, mime_type=mime_type)


@app.post("/api/analyze-damage-photo", response_model=DamagePhotoAnalysis, tags=["OCR"])
async def analyze_damage_image(
    file: Optional[UploadFile] = File(None),
    file_path: Optional[str] = None,
    claim_category: str = "crop"
):
    """
    Analyzes crop damage or accident photos to evaluate visual damage type,
    estimated severity, clarity, category match, and 2-sentence insurer summary.
    """
    if file is not None:
        file_bytes = await file.read()
        mime_type = file.content_type or "image/jpeg"
    elif file_path:
        target = (BASE_DIR / file_path.lstrip("/")).resolve()
        if not target.exists():
            raise StarletteHTTPException(status_code=404, detail=f"File not found: {file_path}")
        file_bytes = target.read_bytes()
        mime_type = "image/png" if file_path.endswith(".png") else "image/jpeg"
    else:
        raise StarletteHTTPException(
            status_code=400,
            detail="Provide either a multipart 'file' upload or a valid 'file_path' parameter."
        )

    return analyze_damage_photo(file_bytes, mime_type=mime_type, claim_category=claim_category)


# ---------------------------------------------------------------------------
# Claim Analysis Orchestration Endpoint
# ---------------------------------------------------------------------------
@app.post("/api/analyze-claim", response_model=ClaimAnalysisResponse, tags=["Claim Processing"])
async def analyze_claim(
    policy_id: str = Form(..., description="Selected policy ID (e.g. micro_health_gig, pmsby, pmfby)"),
    claimant_name: str = Form(..., description="Full legal name of claimant"),
    claimant_age: int = Form(..., ge=0, le=120, description="Age of claimant"),
    policy_start_date: Optional[str] = Form(None, description="Policy issuance date (YYYY-MM-DD)"),
    incident_date: Optional[str] = Form(None, description="Date of casualty or consultation (YYYY-MM-DD)"),
    incident_subtype: Optional[str] = Form(None, description="Accident or damage subtype"),
    primary_doc_type: str = Form("clinic_opd_bill", description="Primary uploaded document classification"),
    secondary_doc_types: Optional[str] = Form(None, description="Optional JSON list or comma-separated secondary doc tags"),
    files: Optional[List[UploadFile]] = File(None, description="Uploaded document images"),
    file: Optional[UploadFile] = File(None, description="Alternative single file upload"),
    file_path: Optional[str] = Form(None, description="Alternative local file path or sample path"),
):
    """
    Orchestrates end-to-end claim analysis:
    1. Saves & quality-audits images via upload_service
    2. Routes medical bills to extract_medical_bill and crop/accident photos to analyze_damage_photo
    3. Runs policy compliance, document completeness, and extraction confidence validators
    4. Computes estimated payout and policy sub-limits
    5. Returns ClaimAnalysisResponse with draft_id, uploaded URLs, extracted fields, scorecard, and Fix-It checklist.
    """
    # 1. Collect and process uploads
    all_uploads: List[UploadFile] = []
    if files and isinstance(files, (list, tuple)):
        all_uploads.extend(files)
    if file and isinstance(file, UploadFile) and file not in all_uploads:
        all_uploads.append(file)

    saved_urls: List[str] = []
    raw_bytes_list: List[tuple] = []
    quality_warnings: List[str] = []

    for uf in all_uploads:
        content = await uf.read()
        if content:
            proc = process_image_bytes(content, original_filename=uf.filename)
            saved_urls.append(proc["file_url"])
            raw_bytes_list.append((content, uf.content_type or "image/jpeg"))
            if proc.get("image_quality_warning"):
                quality_warnings.append(proc["image_quality_warning"])

    if not raw_bytes_list and file_path:
        target_path = (BASE_DIR / file_path.lstrip("/")).resolve()
        if target_path.exists():
            content = target_path.read_bytes()
            proc = process_image_bytes(content, original_filename=target_path.name)
            saved_urls.append(proc["file_url"])
            raw_bytes_list.append((content, "image/jpeg"))
            if proc.get("image_quality_warning"):
                quality_warnings.append(proc["image_quality_warning"])

    if not raw_bytes_list:
        raise StarletteHTTPException(
            status_code=400,
            detail="No document images provided. Please upload at least one claim document photo."
        )

    first_bytes, first_mime = raw_bytes_list[0]

    # 2. Route medical bills vs crop/accident photos
    policy = get_policy_by_id(policy_id)
    policy_name = policy.get("name", policy_id)
    is_crop_policy = policy_id.lower() == "pmfby"
    is_damage_photo = any(
        k in primary_doc_type.lower()
        for k in ["crop_damage", "field_photo", "damage_photo", "accident_photo", "scene_photo"]
    )

    if is_crop_policy or is_damage_photo:
        cat = "crop" if is_crop_policy else "accident"
        damage_analysis = analyze_damage_photo(first_bytes, mime_type=first_mime, claim_category=cat)
        extracted_data = ExtractedBillData(
            document_type=primary_doc_type,
            provider_name=f"Field Surveyor / Revenue Authority ({cat.capitalize()})",
            patient_or_claimant_name=claimant_name,
            incident_or_bill_date=incident_date or datetime.now().strftime("%Y-%m-%d"),
            diagnosis_or_event=damage_analysis.visual_summary,
            itemized_charges=[],
            total_amount_inr=0.0,
            has_stamp_or_signature=True,
            legibility_score=damage_analysis.clarity_score,
            field_confidences={"damage_type": 0.95, "severity": 0.90},
            unreadable_fields=[],
            damage_assessment=damage_analysis.damage_assessment,
        )
    else:
        extracted_data = extract_medical_bill(first_bytes, mime_type=first_mime)
        if not extracted_data.patient_or_claimant_name:
            extracted_data.patient_or_claimant_name = claimant_name
        if not extracted_data.incident_or_bill_date and incident_date:
            extracted_data.incident_or_bill_date = incident_date

    # 3. Document types & metadata preparation
    sec_types: List[str] = []
    if secondary_doc_types:
        sec_clean = secondary_doc_types.strip()
        if sec_clean.startswith("["):
            try:
                sec_types = json.loads(sec_clean)
            except Exception:
                sec_types = [
                    t.strip()
                    for t in sec_clean.strip("[]").replace('"', "").replace("'", "").split(",")
                    if t.strip()
                ]
        else:
            sec_types = [t.strip() for t in sec_clean.split(",") if t.strip()]

    all_doc_tags = [primary_doc_type] + sec_types

    days_since_enrollment = None
    if policy_start_date and incident_date:
        try:
            d_start = datetime.strptime(policy_start_date.strip()[:10], "%Y-%m-%d")
            d_inc = datetime.strptime(incident_date.strip()[:10], "%Y-%m-%d")
            days_since_enrollment = max(0, (d_inc - d_start).days)
        except Exception:
            pass

    user_metadata = {
        "age": claimant_age,
        "claimant_name": claimant_name,
        "policy_start_date": policy_start_date,
        "incident_date": incident_date,
        "incident_subtype": incident_subtype,
        "days_since_enrollment": days_since_enrollment,
        "uploaded_doc_types": all_doc_tags,
    }

    # 4. Run deterministic validators & confidence checks
    val_result = validate_claim(extracted_data, policy, user_metadata=user_metadata)
    conf_result = evaluate_extraction_confidence(extracted_data)

    all_rule_checks = val_result["rule_checks"] + conf_result.rule_checks

    # 5. Build plain-language Fix-It checklist
    fix_it_checklist: List[str] = []
    doc_rule = next((r for r in val_result["rule_checks"] if r.rule_id == "RULE_REQUIRED_DOCUMENTS"), None)
    if doc_rule and doc_rule.missing_documents:
        for doc_key, instr in doc_rule.missing_documents.items():
            fix_it_checklist.append(f"Missing {doc_key.replace('_', ' ').title()}: {instr}")

    for field_name, prompt in conf_result.field_prompts.items():
        fix_it_checklist.append(prompt)

    if val_result.get("disallowed_amount_inr", 0) > 0:
        fix_it_checklist.append(
            f"Policy Exclusion: ₹{val_result['disallowed_amount_inr']:,.2f} deducted for non-covered items (vitamins, tonics, or cosmetics)."
        )

    for warn in quality_warnings:
        fix_it_checklist.append(f"Image Quality Warning: {warn}")

    # Synthesize overall eligibility & recommended status
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

    draft_id = f"DRAFT-{uuid.uuid4().hex[:8].upper()}"

    return ClaimAnalysisResponse(
        claim_id=draft_id,
        draft_id=draft_id,
        policy_id=policy_id,
        policy_name=policy_name,
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


# ---------------------------------------------------------------------------
# Claim Revalidation Endpoint (Live Instantaneous Audit)
# ---------------------------------------------------------------------------
@app.post("/api/revalidate-claim", response_model=ClaimAnalysisResponse, tags=["Claim Processing"])
async def revalidate_claim_endpoint(request: RevalidateClaimRequest):
    """
    Re-evaluates claim rules instantaneously without re-calling OCR on already-extracted images.
    Marks manually verified fields as confidence 1.0, updates document checklist, and recomputes
    readiness score and payout estimate live so users see blockers turn green in real time.
    """
    if not request.updated_extracted_data:
        raise StarletteHTTPException(
            status_code=400,
            detail="Missing updated_extracted_data in revalidation request."
        )

    user_meta = {
        "age": request.claimant_age,
        "claimant_name": request.claimant_name,
        "policy_start_date": request.policy_start_date,
        "incident_date": request.incident_date,
        "incident_subtype": request.incident_subtype,
    }

    val_result, conf_result, final_extracted = revalidate_claim_data(
        policy_id=request.policy_id,
        extracted_data=request.updated_extracted_data,
        manual_overrides=request.manual_overrides,
        updated_uploaded_doc_types=request.updated_uploaded_doc_types,
        user_metadata=user_meta,
    )

    policy = get_policy_by_id(request.policy_id)
    policy_name = policy.get("name", request.policy_id)
    all_rule_checks = val_result["rule_checks"] + conf_result.rule_checks

    fix_it_checklist: List[str] = []
    doc_rule = next((r for r in val_result["rule_checks"] if r.rule_id == "RULE_REQUIRED_DOCUMENTS"), None)
    if doc_rule and doc_rule.missing_documents:
        for doc_key, instr in doc_rule.missing_documents.items():
            fix_it_checklist.append(f"Missing {doc_key.replace('_', ' ').title()}: {instr}")

    for field_name, prompt in conf_result.field_prompts.items():
        fix_it_checklist.append(prompt)

    if val_result.get("disallowed_amount_inr", 0) > 0:
        fix_it_checklist.append(
            f"Policy Exclusion: ₹{val_result['disallowed_amount_inr']:,.2f} deducted for non-covered items."
        )

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

    draft_id = request.claim_id or f"DRAFT-{uuid.uuid4().hex[:8].upper()}"

    return ClaimAnalysisResponse(
        claim_id=draft_id,
        draft_id=draft_id,
        policy_id=request.policy_id,
        policy_name=policy_name,
        extracted_data=final_extracted,
        rule_checks=all_rule_checks,
        overall_eligibility=overall_eligibility,
        recommended_status=recommended_status,
        claimed_amount_inr=val_result["claimed_amount_inr"],
        eligible_payout_inr=eligible_payout,
        disallowed_amount_inr=val_result["disallowed_amount_inr"],
        summary_notes=val_result["summary_notes"],
        uploaded_file_urls=request.existing_file_urls or [],
        fix_it_checklist=fix_it_checklist,
        readiness_score=conf_result.readiness_score,
        readiness_status=conf_result.status,
    )


# ---------------------------------------------------------------------------
# Claim Submission & Insurer Queue Endpoints
# ---------------------------------------------------------------------------
@app.post("/api/submit-claim", response_model=ClaimRecord, tags=["Claim Submission"])
async def submit_claim_endpoint(request: SubmitClaimRequest):
    """
    Submits a finalized claim dossier, generates formatted ID (e.g. CLM-2026-0041),
    persists full record to data/claims.json, and assigns initial triage queue status.
    """
    policy = get_policy_by_id(request.policy_id)
    policy_name = policy.get("name", request.policy_id)
    saved_record = save_claim(submit_req=request, policy_name=policy_name)
    return saved_record


@app.get("/api/claims", response_model=ClaimsDashboardResponse, tags=["Insurer Portal"])
async def list_all_claims_endpoint():
    """
    Returns all submitted claims sorted newest-first plus computed dashboard summary metrics:
    total_claims, ready_to_approve, needs_review, approved_count, prevented_rejections_count.
    """
    return get_claims_dashboard()


@app.get("/api/claims/{claim_id}", response_model=ClaimRecord, tags=["Insurer Portal"])
async def get_single_claim_endpoint(claim_id: str):
    """Retrieves a specific claim dossier by its formatted reference ID."""
    record = get_stored_claim_by_id(claim_id)
    if not record:
        raise StarletteHTTPException(
            status_code=404,
            detail=f"Claim with reference ID '{claim_id}' not found."
        )
    return record


@app.patch("/api/claims/{claim_id}/decision", response_model=ClaimRecord, tags=["Insurer Portal"])
async def claim_decision_endpoint(claim_id: str, decision: ClaimDecisionRequest):
    """
    Adjudicates a claim decision (APPROVED, INFO_REQUESTED, or REJECTED).
    Updates approved payout, reviewer notes, and decision timestamp in data/claims.json.
    """
    if isinstance(decision, dict):
        decision = ClaimDecisionRequest(**decision)

    updated_record = update_claim_status(
        claim_id=claim_id,
        new_status=decision.status,
        approved_amount=decision.approved_amount_inr,
        notes=decision.reviewer_notes,
    )
    if not updated_record:
        raise StarletteHTTPException(
            status_code=404,
            detail=f"Claim with reference ID '{claim_id}' not found."
        )
    return updated_record


@app.get("/api/claims/{claim_id}/report", response_class=HTMLResponse, tags=["Claim Reporting"])
async def get_claim_report_endpoint(claim_id: str):
    """
    Renders a clean, self-contained printable claim dossier HTML page.
    Includes A4 print styles, automatic print trigger, claim snapshot,
    itemized expenses, policy compliance matrix, evidence thumbnails,
    and a formal pre-validation declaration timestamp.
    """
    record = get_stored_claim_by_id(claim_id)
    if not record:
        raise StarletteHTTPException(
            status_code=404,
            detail=f"Claim with reference ID '{claim_id}' not found."
        )
    html_content = generate_claim_html_report(record)
    return HTMLResponse(content=html_content, status_code=200)


@app.get("/api/claims/{claim_id}/json", tags=["Claim Reporting"])
async def get_claim_json_endpoint(claim_id: str):
    """
    Returns the complete machine-readable claim dossier package as downloadable JSON.
    """
    record = get_stored_claim_by_id(claim_id)
    if not record:
        raise StarletteHTTPException(
            status_code=404,
            detail=f"Claim with reference ID '{claim_id}' not found."
        )
    return JSONResponse(
        content=record.model_dump(mode="json"),
        headers={"Content-Disposition": f'attachment; filename="{claim_id}.json"'},
    )


# ---------------------------------------------------------------------------
# Demo Samples Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/samples", tags=["Demo Samples"])
async def list_sample_scenarios_endpoint():
    """
    Returns pre-configured realistic Indian demo claim scenarios:
    1. clean_clinic_bill (₹2,450 clinic typhoid bill + prescription, passes all checks)
    2. tricky_handwritten_bill (₹7,800 bill with ₹450 multivitamins, smudged date, missing prescription)
    3. pmfby_hailstorm_crop (wheat crop hailstorm damage reported within 36h, missing RoR)
    """
    return get_all_samples()


@app.post("/api/analyze-sample/{sample_id}", response_model=ClaimAnalysisResponse, tags=["Demo Samples"])
async def analyze_sample_endpoint(sample_id: str):
    """
    Executes instantaneous full-pipeline pre-validation of a realistic demo scenario:
    extracts realistic fields, runs deterministic rule engine, evaluates confidence,
    caps payouts, and provides an actionable Fix-It checklist without waiting for live OCR.
    """
    sample = get_sample_by_id(sample_id)
    if not sample:
        raise StarletteHTTPException(
            status_code=404,
            detail=f"Sample scenario '{sample_id}' not found. Valid options: clean_clinic_bill, tricky_handwritten_bill, pmfby_hailstorm_crop"
        )
    try:
        response = analyze_sample_case(sample_id)
        return response
    except Exception as exc:
        logger.error("Error analyzing sample case %s: %s", sample_id, exc)
        raise StarletteHTTPException(
            status_code=500,
            detail=f"Failed to analyze sample scenario '{sample_id}': {exc}"
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
