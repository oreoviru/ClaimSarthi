"""Tests for services/report_service.py and claim report endpoints in server.py."""

import asyncio
import json
from models import ClaimRecord
from services.claim_store import get_claim_by_id
from services.report_service import generate_claim_html_report
from server import get_claim_report_endpoint, get_claim_json_endpoint, StarletteHTTPException


def test_generate_claim_html_report_content():
    """Verify that generate_claim_html_report produces a clean, self-contained printable dossier."""
    claim = get_claim_by_id("CLM-2026-0001")
    assert claim is not None
    assert isinstance(claim, ClaimRecord)

    html_page = generate_claim_html_report(claim)

    # 1. Structure & Essential Meta
    assert "<!DOCTYPE html>" in html_page
    assert "CLM-2026-0001" in html_page
    assert "Gig-Worker Micro-Health Clinic Shield" in html_page
    assert "Vikram Patel" in html_page
    assert "READY TO APPROVE" in html_page or "APPROVED" in html_page

    # 2. Printability & A4 Print Styles
    assert "@media print" in html_page
    assert "size: A4 portrait" in html_page
    assert "window.print()" in html_page
    assert "no-print" in html_page

    # 3. Itemized Verified Charges
    assert "Itemized Verified Charges" in html_page
    assert "Emergency Consultation &amp; Vitals" in html_page or "Emergency Consultation & Vitals" in html_page
    assert "IV Saline &amp; Electrolyte Infusion" in html_page or "IV Saline & Electrolyte Infusion" in html_page
    assert "₹3,200.00" in html_page

    # 4. Policy Compliance Audit Table (PASS / WARNING / FAIL)
    assert "Policy Compliance &amp; Rule Audit Table" in html_page or "Policy Compliance & Rule Audit Table" in html_page
    assert "RULE_AGE_WINDOW" in html_page
    assert "RULE_COVERAGE_CAP" in html_page
    assert "RULE_EXCLUSION_SCANNER" in html_page
    assert "PASS" in html_page

    # 5. Embedded Thumbnails / Evidentiary proofs
    assert "Attached Evidentiary Documents" in html_page
    assert "seed_bill_01.jpg" in html_page

    # 6. Formal Pre-Validation Declaration & Audit Hash
    assert "Official Pre-Validation Declaration" in html_page
    assert "IRDAI MICRO-INSURANCE COMPLIANT" in html_page
    assert "SHA256:" in html_page
    assert "DIGITALLY SEALED" in html_page


def test_get_claim_report_endpoint_success_and_404():
    """Verify GET /api/claims/{claim_id}/report endpoint."""
    resp = asyncio.run(get_claim_report_endpoint("CLM-2026-0001"))
    assert resp.status_code == 200
    content = resp.body.decode("utf-8") if hasattr(resp, "body") else getattr(resp, "content", "")
    assert "CLM-2026-0001" in content
    assert "window.print()" in content
    assert "SURAKSHA SETU DOSSIER" in content

    # Check 404 on nonexistent claim
    try:
        asyncio.run(get_claim_report_endpoint("NON_EXISTENT_9999"))
        assert False, "Should have raised StarletteHTTPException 404"
    except StarletteHTTPException as e:
        assert e.status_code == 404
        assert "not found" in str(e.detail)


def test_get_claim_json_endpoint_download():
    """Verify GET /api/claims/{claim_id}/json downloads raw machine-readable JSON package."""
    resp = asyncio.run(get_claim_json_endpoint("CLM-2026-0001"))
    assert resp.status_code == 200
    assert resp.headers.get("Content-Disposition") == 'attachment; filename="CLM-2026-0001.json"'

    if hasattr(resp, "body"):
        data = json.loads(resp.body)
    else:
        data = resp.content
    assert isinstance(data, dict)
    assert data["claim_id"] == "CLM-2026-0001"
    assert data["claimant_name"] == "Vikram Patel"
    assert data["policy_id"] == "micro_health_gig"
    assert data["claimed_amount_inr"] == 3200.0
    assert len(data["rule_checks"]) >= 5
    assert len(data["extracted_data"]["itemized_charges"]) >= 3
