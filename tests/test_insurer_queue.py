"""
Automated unit & integration tests for Insurer Queue View:
4-Metric Summary Strip, Status Filter Tabs, Desktop Table, and Mobile Stacked Cards (<768px).

Verifies:
1. HTML markup in static/index.html:
   - #view-insurer container
   - 4-metric summary strip: #insurer-metrics-strip
     * Total Submissions: #metric-total-claims
     * Pre-Validated Ready: #metric-ready-to-approve
     * Needs Manual Review: #metric-needs-review
     * Rejections Prevented: #metric-prevented-rejections
   - Status filter tabs: #insurer-status-filters
     * All: data-filter="all", #filter-tab-all
     * Ready to Approve: data-filter="READY_TO_APPROVE", #filter-tab-ready
     * Needs Review: data-filter="NEEDS_REVIEW", #filter-tab-review
     * Approved: data-filter="APPROVED", #filter-tab-approved
   - Queue container: #insurer-queue-container
2. CSS styling in static/styles.css:
   - .insurer-metrics-strip (responsive grid)
   - .metric-card, .metric-icon, .metric-value, .metric-label
   - .insurer-filters-row, .filter-tab-btn, .filter-count-badge
   - .insurer-desktop-table-container, .insurer-claims-table
   - .insurer-mobile-cards-container, .mobile-claim-card
   - @media (max-width: 768px) responsive transformation rules
   - .compliance-score-pill, .amount-compare-stack
3. JavaScript module in static/js/insurerQueue.js:
   - Required functions: initInsurerQueue, renderInsurerQueue, fetchAndRenderQueue, filterClaims
   - Calculations: computeComplianceScore, formatCurrency, formatSubmissionTimestamp
4. Backend API compliance with GET /api/claims dashboard summary metrics.
"""

from pathlib import Path
import asyncio
from services.claim_store import get_claims_dashboard, _get_seed_claims, CLAIMS_FILE
import json


def test_insurer_queue_html_markup():
    """Verify static/index.html includes 4-metric summary strip, status filter tabs, and queue container."""
    index_path = Path(__file__).parent.parent / "static" / "index.html"
    assert index_path.exists(), "index.html must exist"
    content = index_path.read_text(encoding="utf-8")

    # 1. View Container
    assert 'id="view-insurer"' in content

    # 2. 4-Metric Summary Strip
    assert 'id="insurer-metrics-strip"' in content
    assert 'id="metric-total-claims"' in content
    assert 'id="metric-ready-to-approve"' in content
    assert 'id="metric-needs-review"' in content
    assert 'id="metric-prevented-rejections"' in content

    # Plain text / i18n labels
    assert "Total Submissions" in content
    assert "Pre-Validated Ready" in content
    assert "Needs Manual Review" in content
    assert "Rejections Prevented" in content

    # 3. Status Filter Tabs
    assert 'id="insurer-status-filters"' in content
    assert 'data-filter="all"' in content
    assert 'data-filter="READY_TO_APPROVE"' in content
    assert 'data-filter="NEEDS_REVIEW"' in content
    assert 'data-filter="APPROVED"' in content

    assert 'id="filter-tab-all"' in content
    assert 'id="filter-tab-ready"' in content
    assert 'id="filter-tab-review"' in content
    assert 'id="filter-tab-approved"' in content

    assert 'id="filter-count-all"' in content
    assert 'id="filter-count-ready"' in content
    assert 'id="filter-count-review"' in content
    assert 'id="filter-count-approved"' in content

    # 4. Insurer Queue Container
    assert 'id="insurer-queue-container"' in content


def test_claim_detail_drawer_html_markup():
    """Verify static/index.html includes complete Claim Detail Drawer & Reviewer Decision Desk."""
    index_path = Path(__file__).parent.parent / "static" / "index.html"
    assert index_path.exists(), "index.html must exist"
    content = index_path.read_text(encoding="utf-8")

    # Drawer container & Backdrop
    assert 'id="insurer-claim-drawer"' in content
    assert 'id="insurer-claim-drawer-backdrop"' in content
    assert 'id="btn-close-claim-drawer"' in content

    # Header & Status
    assert 'id="drawer-claim-id"' in content
    assert 'id="drawer-status-badge"' in content
    assert 'id="btn-drawer-print-pdf"' in content

    # 1. Claimant & Scheme Verification
    assert 'id="drawer-claimant-name"' in content
    assert 'id="drawer-claimant-age"' in content
    assert 'id="drawer-claimant-contact"' in content
    assert 'id="drawer-claimant-aadhaar"' in content
    assert 'id="drawer-policy-name"' in content
    assert 'id="drawer-incident-date"' in content
    assert 'id="drawer-incident-type"' in content
    assert 'id="drawer-bank-details"' in content

    # 2. Extracted OCR Data & Itemized Charges
    assert 'id="drawer-ocr-provider"' in content
    assert 'id="drawer-ocr-date"' in content
    assert 'id="drawer-ocr-diagnosis"' in content
    assert 'id="drawer-ocr-total"' in content
    assert 'id="drawer-ocr-confidence"' in content
    assert 'id="drawer-itemized-table"' in content
    assert 'id="drawer-itemized-list"' in content

    # 3. Evidence Thumbnails
    assert 'id="drawer-evidence-grid"' in content
    assert 'id="drawer-evidence-count"' in content

    # 4. Automated Rule Audit Trail
    assert 'id="drawer-audit-checks-list"' in content
    assert 'id="drawer-audit-summary"' in content

    # 5. Reviewer Decision Panel
    assert 'id="drawer-decision-panel"' in content
    assert 'id="reviewer-approved-amount"' in content
    assert 'id="reviewer-notes"' in content
    assert 'id="btn-decision-approve"' in content
    assert 'id="btn-decision-info"' in content
    assert 'id="btn-decision-reject"' in content
    assert 'data-decision="APPROVED"' in content
    assert 'data-decision="INFO_REQUESTED"' in content
    assert 'data-decision="REJECTED"' in content


def test_insurer_queue_css_styling():
    """Verify static/styles.css includes rules for metrics strip, filter tabs, desktop table, and mobile transformation."""
    css_path = Path(__file__).parent.parent / "static" / "styles.css"
    assert css_path.exists(), "styles.css must exist"
    content = css_path.read_text(encoding="utf-8")

    # 1. 4-Metric Strip
    assert ".insurer-metrics-strip" in content
    assert ".metric-card" in content
    assert ".metric-icon" in content
    assert ".metric-value" in content
    assert ".metric-label" in content
    assert ".metric-card-pass" in content
    assert ".metric-card-warning" in content
    assert ".metric-card-shield" in content

    # 2. Filter Tabs
    assert ".insurer-filters-row" in content
    assert ".filter-tab-btn" in content
    assert ".filter-count-badge" in content

    # 3. Desktop Table
    assert ".insurer-desktop-table-container" in content
    assert ".insurer-claims-table" in content
    assert ".claim-id-mono" in content
    assert ".amount-compare-stack" in content
    assert ".compliance-score-wrap" in content
    assert ".compliance-score-pill" in content

    # 4. Mobile Stacked Cards & Responsive <768px rules
    assert ".insurer-mobile-cards-container" in content
    assert ".mobile-claim-card" in content
    assert "@media (max-width: 768px)" in content
    assert "display: none !important" in content
    assert "display: flex !important" in content

    # 5. Claim Detail Drawer & Decision Panel
    assert ".insurer-drawer-backdrop" in content
    assert ".insurer-claim-drawer" in content
    assert ".insurer-claim-drawer.open" in content
    assert ".drawer-header" in content
    assert ".drawer-close-btn" in content
    assert ".drawer-body" in content
    assert ".drawer-section" in content
    assert ".drawer-evidence-grid" in content
    assert ".drawer-evidence-card" in content
    assert ".drawer-audit-row" in content
    assert ".drawer-decision-section" in content
    assert ".drawer-decision-actions" in content


def test_insurer_queue_js_module_structure():
    """Verify static/js/insurerQueue.js exists and exports all required functions."""
    js_path = Path(__file__).parent.parent / "static" / "js" / "insurerQueue.js"
    assert js_path.exists(), "insurerQueue.js must exist"
    content = js_path.read_text(encoding="utf-8")

    assert "export function initInsurerQueue" in content
    assert "export function renderInsurerQueue" in content
    assert "fetchAndRenderQueue" in content
    assert "export function filterClaims" in content
    assert "export function getActiveFilter" in content
    assert "export function computeComplianceScore" in content
    assert "export function formatSubmissionTimestamp" in content
    assert "export function formatCurrency" in content

    # Verify column headers in generated markup
    assert "Claim ID" in content
    assert "Claimant" in content
    assert "Scheme" in content
    assert "Claimed vs. Eligible" in content
    assert "Compliance Score" in content
    assert "Status" in content
    assert "Action" in content

    # Verify data-labels for mobile responsiveness
    assert 'data-label="Claim ID"' in content
    assert 'data-label="Claimant"' in content
    assert 'data-label="Scheme"' in content
    assert 'data-label="Claimed vs. Eligible ₹"' in content
    assert 'data-label="Compliance Score"' in content
    assert 'data-label="Status"' in content
    assert 'data-label="Action"' in content

    # Verify 4 filter statuses handled
    assert "READY_TO_APPROVE" in content
    assert "NEEDS_REVIEW" in content
    assert "APPROVED" in content
    assert "all" in content

    # Verify Claim Detail Drawer and Decision Desk
    assert "openClaimDetailDrawer" in content
    assert "closeClaimDetailDrawer" in content
    assert "populateClaimDrawer" in content
    assert "submitOfficerDecision" in content
    assert "updateClaimDecision" in content
    assert "fetchClaimById" in content
    assert "openZoomModal" in content


def test_backend_claims_dashboard_metrics_contract():
    """Verify backend get_claims_dashboard returns required 4 metrics and claims list."""
    # Reset seed
    with open(CLAIMS_FILE, "w", encoding="utf-8") as f:
        json.dump(_get_seed_claims(), f, indent=2)

    dashboard = get_claims_dashboard()
    assert "total_claims" in dashboard
    assert "ready_to_approve" in dashboard
    assert "needs_review" in dashboard
    assert "approved_count" in dashboard
    assert "prevented_rejections_count" in dashboard
    assert "claims" in dashboard

    assert dashboard["total_claims"] >= 2
    assert dashboard["ready_to_approve"] >= 1
    assert dashboard["needs_review"] >= 1
    assert dashboard["prevented_rejections_count"] >= 1
    assert len(dashboard["claims"]) >= 2
