"""Automated end-to-end API test suite for SurakshaSetu Micro-Insurance Assistant.

Uses FastAPI's TestClient to verify the 8 required core workflows:
1. Policy catalog loading (GET /api/policies)
2. Age-aware policy recommendation (POST /api/recommend)
3. PMJJBY pro-rata & PMFBY crop premium calculations (POST /api/calculate-premium)
4. PMSBY rejection of routine OPD clinic bills (hard FAIL check)
5. Micro-Health exclusion and ₹5,000 cap enforcement
6. Re-validation flipping blockers to green (POST /api/revalidate-claim)
7. Claim submission persistence to data/claims.json (POST /api/submit-claim)
8. Insurer approval decision update (PATCH /api/claims/{id}/decision)
"""

import asyncio
import json
from pathlib import Path
from typing import Any, Dict, Optional

# Attempt official FastAPI TestClient, falling back to seamless direct dispatch client
try:
    from fastapi.testclient import TestClient
    from server import app
    _native_client = TestClient(app, raise_server_exceptions=False)
except ImportError:
    _native_client = None


class MockResponse:
    """Mock HTTP response matching TestClient response interface."""
    def __init__(self, status_code: int, content: Any, headers: Optional[Dict[str, str]] = None):
        self.status_code = status_code
        self._content = content
        self.headers = headers or {}

    def json(self) -> Any:
        if isinstance(self._content, (dict, list)):
            return self._content
        if hasattr(self._content, "model_dump"):
            return self._content.model_dump(mode="json")
        if isinstance(self._content, str):
            try:
                return json.loads(self._content)
            except Exception:
                return self._content
        return self._content

    @property
    def text(self) -> str:
        if isinstance(self._content, str):
            return self._content
        return json.dumps(self.json(), default=str)


def _run_async(coro):
    """Safely runs an async coroutine synchronously across Python 3.10+ runtimes."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            return pool.submit(asyncio.run, coro).result()
    return asyncio.run(coro)


class StandaloneTestClient:
    """Zero-dependency TestClient providing synchronous HTTP API over FastAPI route handlers."""
    def __init__(self):
        import server
        self.server = server

    def get(self, url: str, params: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None) -> MockResponse:
        if url == "/api/policies":
            cat = params.get("category") if params else None
            res = _run_async(self.server.list_policies(category=cat))
            return MockResponse(200, res)

        if url.startswith("/api/policies/"):
            pid = url.split("/")[-1]
            try:
                res = _run_async(self.server.retrieve_policy(pid))
                return MockResponse(200, res)
            except self.server.StarletteHTTPException as e:
                return MockResponse(e.status_code, {"error": str(e.detail)})

        if url == "/api/claims":
            res = _run_async(self.server.list_all_claims_endpoint())
            return MockResponse(200, res)

        if url.startswith("/api/claims/") and url.endswith("/report"):
            cid = url.split("/")[3]
            try:
                res = _run_async(self.server.get_claim_report_endpoint(cid))
                return MockResponse(200, res.content, headers={"Content-Type": "text/html"})
            except self.server.StarletteHTTPException as e:
                return MockResponse(e.status_code, {"error": str(e.detail)})

        if url.startswith("/api/claims/") and url.endswith("/json"):
            cid = url.split("/")[3]
            try:
                res = _run_async(self.server.get_claim_json_endpoint(cid))
                return MockResponse(200, res.content, headers=res.headers)
            except self.server.StarletteHTTPException as e:
                return MockResponse(e.status_code, {"error": str(e.detail)})

        if url.startswith("/api/claims/"):
            cid = url.split("/")[-1]
            try:
                res = _run_async(self.server.get_single_claim_endpoint(cid))
                return MockResponse(200, res)
            except self.server.StarletteHTTPException as e:
                return MockResponse(e.status_code, {"error": str(e.detail)})

        if url == "/api/samples":
            res = _run_async(self.server.list_sample_scenarios_endpoint())
            return MockResponse(200, res)

        return MockResponse(404, {"error": f"Route {url} not found"})

    def post(self, url: str, json: Optional[Dict[str, Any]] = None, data: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None) -> MockResponse:
        if url == "/api/recommend":
            from models import RecommendRequest
            req = RecommendRequest(**(json or {}))
            res = _run_async(self.server.recommend_schemes(req))
            return MockResponse(200, res)

        if url == "/api/calculate-premium":
            from models import PremiumCalculateRequest
            req = PremiumCalculateRequest(**(json or {}))
            try:
                res = _run_async(self.server.compute_premium(req))
                return MockResponse(200, res)
            except self.server.StarletteHTTPException as e:
                return MockResponse(e.status_code, {"error": str(e.detail)})

        if url == "/api/revalidate-claim":
            from models import RevalidateClaimRequest
            req = RevalidateClaimRequest(**(json or {}))
            try:
                res = _run_async(self.server.revalidate_claim_endpoint(req))
                return MockResponse(200, res)
            except self.server.StarletteHTTPException as e:
                return MockResponse(e.status_code, {"error": str(e.detail)})

        if url == "/api/submit-claim":
            from models import SubmitClaimRequest
            req = SubmitClaimRequest(**(json or {}))
            try:
                res = _run_async(self.server.submit_claim_endpoint(req))
                return MockResponse(200, res)
            except self.server.StarletteHTTPException as e:
                return MockResponse(e.status_code, {"error": str(e.detail)})

        if url.startswith("/api/analyze-sample/"):
            sid = url.split("/")[-1]
            try:
                res = _run_async(self.server.analyze_sample_endpoint(sid))
                return MockResponse(200, res)
            except self.server.StarletteHTTPException as e:
                return MockResponse(e.status_code, {"error": str(e.detail)})

        return MockResponse(404, {"error": f"POST route {url} not found"})

    def patch(self, url: str, json: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None) -> MockResponse:
        if url.startswith("/api/claims/") and url.endswith("/decision"):
            cid = url.split("/")[3]
            from models import ClaimDecisionRequest
            req = ClaimDecisionRequest(**(json or {}))
            try:
                res = _run_async(self.server.claim_decision_endpoint(cid, req))
                return MockResponse(200, res)
            except self.server.StarletteHTTPException as e:
                return MockResponse(e.status_code, {"error": str(e.detail)})

        return MockResponse(404, {"error": f"PATCH route {url} not found"})


# Active client instance
client = _native_client if _native_client is not None else StandaloneTestClient()


# ---------------------------------------------------------------------------
# Test 1: Policy Catalog Loading
# ---------------------------------------------------------------------------
def test_policy_catalog_loading():
    """Verify: GET /api/policies returns the 5 real Indian micro-insurance schemes."""
    response = client.get("/api/policies")
    assert response.status_code == 200
    policies = response.json()
    assert isinstance(policies, list)
    assert len(policies) == 5

    policy_ids = {p["id"] for p in policies}
    expected_ids = {"pmsby", "pmjjby", "pmfby", "ab_pmjay", "micro_health_gig"}
    assert expected_ids.issubset(policy_ids)

    # Verify single policy fetch
    res_pmjjby = client.get("/api/policies/pmjjby")
    assert res_pmjjby.status_code == 200
    p = res_pmjjby.json()
    assert p["name"] == "Pradhan Mantri Jeevan Jyoti Bima Yojana"
    assert "Life" in p["category"]
    assert p["max_claim_inr"] == 200000
    assert p["annual_premium_inr"] == 436


# ---------------------------------------------------------------------------
# Test 2: Age-Aware Policy Recommendation
# ---------------------------------------------------------------------------
def test_age_aware_policy_recommendation():
    """
    Verify: Age 55 claimant is disqualified from PMJJBY (age cap 50).
    A 28yo gig worker receives Micro-Health Clinic Shield as a top recommendation.
    """
    # Case A: Age 55 disqualification
    req_senior = {
        "age": 55,
        "annual_income_inr": 200000,
        "occupation": "small_shopkeeper",
        "has_bank_account": True,
        "primary_risk": "life",
        "max_annual_budget_inr": 1000.0,
    }
    res_senior = client.post("/api/recommend", json=req_senior)
    assert res_senior.status_code == 200
    data_senior = res_senior.json()

    # Age 55 exceeds PMJJBY 18-50 age limit, so PMJJBY must not be in recommendations
    assert not any(r["policy_id"] == "pmjjby" for r in data_senior["recommendations"])

    # Case B: 28yo gig worker
    req_gig = {
        "age": 28,
        "annual_income_inr": 180000,
        "occupation": "gig_worker",
        "has_bank_account": True,
        "primary_risk": "medical + accident",
        "max_annual_budget_inr": 700.0,
    }
    res_gig = client.post("/api/recommend", json=req_gig)
    assert res_gig.status_code == 200
    top_ids = [r["policy_id"] for r in res_gig.json()["recommendations"][:2]]
    assert "micro_health_gig" in top_ids


# ---------------------------------------------------------------------------
# Test 3: Premium Calculations (PMJJBY Pro-Rata & PMFBY Crop)
# ---------------------------------------------------------------------------
def test_premium_calculations_pmjjby_and_pmfby():
    """
    Verify: Real Indian scheme premium math:
    - PMJJBY in October (enrolment month 10, Q2 slab) returns exactly ₹342.
    - PMFBY Rabi wheat on ₹50,000 sum insured returns exactly ₹750 farmer share (1.5%).
    - PMSBY returns ₹20 annual premium.
    """
    # PMJJBY October slab (Sep-Nov slab = ₹342)
    res_pmjjby = client.post("/api/calculate-premium", json={"policy_id": "pmjjby", "enrolment_month": 10})
    assert res_pmjjby.status_code == 200
    d_pmjjby = res_pmjjby.json()
    assert d_pmjjby["payable_premium_inr"] == 342.0
    assert d_pmjjby["details"]["months_covered"] == 9

    # PMFBY Rabi crop (1.5% statutory cap)
    res_pmfby = client.post(
        "/api/calculate-premium",
        json={"policy_id": "pmfby", "crop_season": "rabi", "sum_insured_inr": 50000.0}
    )
    assert res_pmfby.status_code == 200
    d_pmfby = res_pmfby.json()
    assert d_pmfby["payable_premium_inr"] == 750.0  # 1.5% of ₹50,000
    assert d_pmfby["details"]["farmer_cap_percentage"] == 1.5

    # PMSBY ₹20/year
    res_pmsby = client.post("/api/calculate-premium", json={"policy_id": "pmsby"})
    assert res_pmsby.status_code == 200
    assert res_pmsby.json()["payable_premium_inr"] == 20.0


# ---------------------------------------------------------------------------
# Test 4: PMSBY Rejection of Routine OPD Bills
# ---------------------------------------------------------------------------
def test_pmsby_rejection_of_routine_opd_bills():
    """
    Verify: Submitting a routine OPD clinic bill under PMSBY triggers a hard FAIL
    compatibility rule check explaining that PMSBY only covers accidental death and permanent disability.
    """
    from models import ExtractedBillData
    from services.policy_service import get_policy_by_id
    from services.validator_service import validate_claim

    opd_bill = ExtractedBillData(
        document_type="clinic_opd_bill",
        provider_name="City Community Clinic",
        patient_or_claimant_name="Amit Shah",
        total_amount_inr=1200.0,
        legibility_score=0.90,
    )
    pmsby_policy = get_policy_by_id("pmsby")
    val_result = validate_claim(
        opd_bill,
        pmsby_policy,
        user_metadata={"uploaded_doc_types": ["clinic_opd_bill"]}
    )

    compat_rule = next(r for r in val_result["rule_checks"] if r.rule_id == "RULE_CLAIM_TYPE_COMPATIBILITY")
    assert compat_rule.status == "FAIL"
    assert val_result["overall_eligibility"] == "FAIL"
    assert val_result["eligible_payout_inr"] == 0.0


# ---------------------------------------------------------------------------
# Test 5: Micro-Health Exclusion and ₹5,000 Cap Enforcement
# ---------------------------------------------------------------------------
def test_micro_health_exclusion_and_cap_enforcement():
    """
    Verify: A ₹7,800 clinic bill containing ₹400 multivitamins under Micro-Health:
    1. Scans and deducts the ₹400 exclusion item (RULE_EXCLUSION_SCANNER).
    2. Capped payout is clamped at the ₹5,000 statutory limit (RULE_COVERAGE_CAP).
    """
    from models import ExtractedBillData, ItemizedCharge
    from services.policy_service import get_policy_by_id
    from services.validator_service import validate_claim

    bill = ExtractedBillData(
        document_type="clinic_opd_bill",
        provider_name="Apex Care Clinic",
        patient_or_claimant_name="Vikram Rao",
        itemized_charges=[
            ItemizedCharge(item_name="Doctor Consultation", amount_inr=400.0, category="consultation"),
            ItemizedCharge(item_name="IV Fluid Infusion & Daycare Bed", amount_inr=7000.0, category="procedure"),
            ItemizedCharge(item_name="Multivitamin & Zinc Health Tonic", amount_inr=400.0, category="pharmacy"),
        ],
        total_amount_inr=7800.0,
        has_stamp_or_signature=True,
        legibility_score=0.92,
    )
    policy = get_policy_by_id("micro_health_gig")
    val = validate_claim(
        bill,
        policy,
        user_metadata={"uploaded_doc_types": ["clinic_opd_bill", "doctor_prescription"]}
    )

    assert val["claimed_amount_inr"] == 7800.0
    assert val["disallowed_amount_inr"] == 400.0
    assert val["eligible_payout_inr"] == 5000.0  # ₹7,800 - ₹400 = ₹7,400 -> clamped at ₹5,000 cap!

    cap_rule = next(r for r in val["rule_checks"] if r.rule_id == "RULE_COVERAGE_CAP")
    assert cap_rule.status == "WARNING"
    assert "5,000" in cap_rule.explanation


# ---------------------------------------------------------------------------
# Test 6: Revalidation Flips Blockers to Green
# ---------------------------------------------------------------------------
def test_revalidation_flips_blockers_to_green():
    """
    Verify: POST /api/revalidate-claim instantaneous live audit flips a NEEDS_FIXES draft
    with a smudged date and missing prescription to READY_TO_SUBMIT when resolved.
    """
    reval_payload = {
        "policy_id": "micro_health_gig",
        "claimant_name": "Karan Johar",
        "claimant_age": 28,
        "policy_start_date": "2025-01-01",
        "incident_date": "2026-02-14",
        "incident_subtype": "acute gastroenteritis",
        "updated_extracted_data": {
            "document_type": "clinic_opd_bill",
            "provider_name": "Shree Clinic & Nursing Home",
            "patient_or_claimant_name": "Karan Johar",
            "incident_or_bill_date": None,  # Initially missing
            "diagnosis_or_event": "Acute gastroenteritis",
            "itemized_charges": [
                {"item_name": "Doctor Consultation Fee", "amount_inr": 400.0, "category": "consultation"},
                {"item_name": "IV Fluid Infusion", "amount_inr": 1100.0, "category": "procedure"},
            ],
            "total_amount_inr": 1500.0,
            "has_stamp_or_signature": True,
            "legibility_score": 0.92,
            "field_confidences": {"provider_name": 0.95, "total_amount_inr": 0.98},
            "unreadable_fields": ["bill_date"],
        },
        "manual_overrides": {
            "incident_or_bill_date": "2026-02-14",
            "total_amount_inr": 1500.0,
        },
        "updated_uploaded_doc_types": ["clinic_opd_bill", "doctor_prescription"],
    }

    response = client.post("/api/revalidate-claim", json=reval_payload)
    assert response.status_code == 200
    data = response.json()

    assert data["overall_eligibility"] == "PASS"
    assert data["recommended_status"] == "READY_TO_APPROVE"
    assert data["readiness_status"] == "READY_TO_SUBMIT"
    assert data["eligible_payout_inr"] == 1500.0
    assert len(data["fix_it_checklist"]) == 0


# ---------------------------------------------------------------------------
# Test 7: Claim Submission Persistence
# ---------------------------------------------------------------------------
def test_claim_submission_persistence():
    """
    Verify: POST /api/submit-claim generates formatted sequential reference ID (CLM-2026-004X),
    persists full dossier to data/claims.json, and is retrievable via GET /api/claims/{claim_id}.
    """
    submit_payload = {
        "policy_id": "micro_health_gig",
        "claimant_name": "Sunita Verma",
        "claimant_phone": "9812345678",
        "claimant_aadhaar_last4": "3821",
        "bank_account_number": "501004829104",
        "bank_ifsc": "HDFC0001245",
        "claimed_amount_inr": 2800.0,
        "eligible_payout_inr": 2800.0,
        "document_paths": ["/uploads/sunita_opd_bill.jpg"],
        "extracted_data": {
            "document_type": "clinic_opd_bill",
            "provider_name": "LifeLine Daycare Clinic",
            "patient_or_claimant_name": "Sunita Verma",
            "incident_or_bill_date": "2026-02-15",
            "diagnosis_or_event": "Acute Viral Bronchitis",
            "itemized_charges": [],
            "total_amount_inr": 2800.0,
            "has_stamp_or_signature": True,
            "legibility_score": 0.94,
        },
        "rule_checks": [
            {"rule_id": "RULE_AGE_WINDOW", "label": "Age Window Check", "status": "PASS", "explanation": "Age 29 is valid."},
            {"rule_id": "RULE_REQUIRED_DOCUMENTS", "label": "Checklist", "status": "PASS", "explanation": "All proofs attached."},
        ],
    }

    submit_res = client.post("/api/submit-claim", json=submit_payload)
    assert submit_res.status_code == 200
    saved = submit_res.json()
    new_claim_id = saved["claim_id"]

    assert new_claim_id.startswith("CLM-2026-")
    assert saved["claimant_name"] == "Sunita Verma"
    assert saved["reviewer_status"] == "READY_TO_APPROVE"

    # Verify retrieval
    fetch_res = client.get(f"/api/claims/{new_claim_id}")
    assert fetch_res.status_code == 200
    fetched = fetch_res.json()
    assert fetched["claim_id"] == new_claim_id
    assert fetched["bank_account_number"] == "501004829104"
    assert fetched["claimed_amount_inr"] == 2800.0


# ---------------------------------------------------------------------------
# Test 8: Insurer Approval Decision Update
# ---------------------------------------------------------------------------
def test_insurer_approval_decision_update():
    """
    Verify: PATCH /api/claims/{claim_id}/decision adjudicates claim,
    updates status to APPROVED, records decision_timestamp in data/claims.json,
    and increments approved_count in GET /api/claims dashboard metrics.
    """
    # 1. Read initial dashboard metrics
    initial_dash_res = client.get("/api/claims")
    assert initial_dash_res.status_code == 200
    initial_approved = initial_dash_res.json()["approved_count"]

    # 2. Submit a fresh claim for adjudication
    submit_payload = {
        "policy_id": "micro_health_gig",
        "claimant_name": "Adjudication Test User",
        "claimed_amount_inr": 1800.0,
        "eligible_payout_inr": 1800.0,
    }
    created = client.post("/api/submit-claim", json=submit_payload).json()
    cid = created["claim_id"]

    # 3. PATCH decision
    decision_payload = {
        "status": "APPROVED",
        "approved_amount_inr": 1800.0,
        "reviewer_notes": "Adjudicated and approved by claims officer. Dispatched via Aadhaar DBT.",
    }
    patch_res = client.patch(f"/api/claims/{cid}/decision", json=decision_payload)
    assert patch_res.status_code == 200
    decided = patch_res.json()

    assert decided["reviewer_status"] == "APPROVED"
    assert decided["approved_amount_inr"] == 1800.0
    assert "decision_timestamp" in decided or "decided_at" in decided
    assert decided["reviewer_notes"] == "Adjudicated and approved by claims officer. Dispatched via Aadhaar DBT."

    # 4. Verify increment in dashboard
    updated_dash_res = client.get("/api/claims")
    assert updated_dash_res.status_code == 200
    new_approved = updated_dash_res.json()["approved_count"]
    assert new_approved == initial_approved + 1
