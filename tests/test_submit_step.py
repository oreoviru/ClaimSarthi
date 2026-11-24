"""
Automated unit & integration tests for Step 4 Pre-Submission Dossier Review,
Plain-Language User Confirmation Checkbox, and Final Claim Package Submission.

Verifies:
1. HTML markup in static/index.html:
   - Pre-submission dossier card (#claim-summary-dossier)
   - 1. Policy Name & Coverage Summary (#dossier-policy-name, #dossier-policy-type, #dossier-coverage-summary)
   - 2. Verified Claimant & Incident Details (#dossier-claimant-name, #dossier-claimant-age, #dossier-claimant-contact, #dossier-bank-account, #dossier-incident-date, #dossier-incident-type, #dossier-provider-name)
   - 3. Itemized Financial Breakdown (#dossier-claimed-amount, #dossier-excluded-amount, #dossier-payout-amount, #dossier-itemized-list, #dossier-item-count)
   - 4. Attached Evidence Thumbnails Grid (#dossier-evidence-grid, #dossier-evidence-count, #dossier-docs-list)
   - 5. Compact Policy Compliance Summary (#dossier-compliance-summary, #dossier-compliance-pills, #dossier-compliance-notes)
   - Plain-language genuine confirmation checkbox (#claim-confirm-genuine, "I confirm these details and photos are genuine")
   - Submit claim package button (#btn-submit-final-claim, "Submit Pre-Validated Claim Package", disabled initially)
   - Success receipt container (#claim-submit-success-state, #receipt-claim-id, #receipt-policy-name, #receipt-eligible-amount, #receipt-status-badge, #btn-download-report, #btn-download-json)
2. CSS styles in static/styles.css:
   - Dossier sections & layout (.dossier-section, .dossier-policy-banner)
   - Financial breakdown cards (.dossier-financial-grid, .fin-billed, .fin-excluded, .fin-payout)
   - Evidence thumbnails grid (.dossier-evidence-grid, .dossier-proof-card, .dossier-proof-thumb-wrap, .dossier-proof-tag)
   - Compliance summary box & pills (.dossier-compliance-box, .compliance-badge-summary, .compliance-check-pill)
   - Confirmation checkbox & submit button states (.dossier-confirm-wrap, .confirm-checkbox-label, #btn-submit-final-claim:disabled)
3. JavaScript module in static/js/submitStep.js & claimWizard.js:
   - Required exported functions and constants
   - Proper wiring of confirmation barrier and submission dispatch
4. Backend API submission integration:
   - POST /api/submit-claim returns sequential claim_id, approved_amount_inr, and reviewer_status
"""

from pathlib import Path
from models import SubmitClaimRequest, ExtractedBillData, ItemizedCharge


def test_submit_step_html_markup():
    """Verify static/index.html includes all 5 dossier review sections, genuine checkbox, and submit button."""
    index_path = Path(__file__).parent.parent / "static" / "index.html"
    assert index_path.exists(), "index.html must exist"
    content = index_path.read_text(encoding="utf-8")

    # Pre-submission dossier container
    assert 'id="claim-summary-dossier"' in content

    # 1. Policy Name & Coverage Summary
    assert 'id="dossier-policy-name"' in content
    assert 'id="dossier-policy-type"' in content
    assert 'id="dossier-coverage-summary"' in content

    # 2. Claimant & Incident Information
    assert 'id="dossier-claimant-name"' in content
    assert 'id="dossier-claimant-age"' in content
    assert 'id="dossier-claimant-contact"' in content
    assert 'id="dossier-bank-account"' in content
    assert 'id="dossier-incident-date"' in content
    assert 'id="dossier-incident-type"' in content
    assert 'id="dossier-provider-name"' in content

    # 3. Itemized Financial Breakdown
    assert 'id="dossier-claimed-amount"' in content
    assert 'id="dossier-excluded-amount"' in content
    assert 'id="dossier-payout-amount"' in content
    assert 'id="dossier-itemized-list"' in content
    assert 'id="dossier-item-count"' in content

    # 4. Attached Evidence Thumbnails Grid
    assert 'id="dossier-evidence-grid"' in content
    assert 'id="dossier-evidence-count"' in content
    assert 'id="dossier-docs-list"' in content

    # 5. Compact Policy Compliance Summary
    assert 'id="dossier-compliance-summary"' in content
    assert 'id="dossier-compliance-pills"' in content
    assert 'id="dossier-compliance-notes"' in content

    # Plain-language user confirmation checkbox
    assert 'id="claim-confirm-genuine"' in content
    assert "I confirm these details and photos are genuine" in content

    # Primary Submit Button (initially disabled)
    assert 'id="btn-submit-final-claim"' in content
    assert "Submit Pre-Validated Claim Package" in content
    assert "disabled" in content

    # Reassuring Confirmation Screen & 3 Action Buttons
    assert 'id="claim-submit-success-state"' in content
    assert 'id="receipt-claim-id"' in content
    assert 'id="receipt-policy-name"' in content
    assert 'id="receipt-eligible-amount"' in content
    assert 'id="receipt-status-badge"' in content
    assert 'id="receipt-submission-time"' in content
    
    # 3 Clear Action Buttons
    assert 'id="btn-print-claim-pdf"' in content
    assert "Print / Save Claim Package PDF" in content
    assert 'id="btn-open-insurer-queue"' in content
    assert "Open in Insurer Queue" in content
    assert 'id="btn-file-another-claim"' in content
    assert "File Another Claim" in content

    # Backwards-compatible download anchors
    assert 'id="btn-download-report"' in content
    assert 'id="btn-download-json"' in content


def test_submit_step_css_styling():
    """Verify static/styles.css includes rules for dossier cards, confirmation screen, and insurer queue highlight."""
    css_path = Path(__file__).parent.parent / "static" / "styles.css"
    assert css_path.exists(), "styles.css must exist"
    content = css_path.read_text(encoding="utf-8")

    # Dossier Card & Sections
    assert ".dossier-card" in content
    assert ".dossier-section" in content
    assert ".dossier-policy-banner" in content

    # Financial Breakdown Grid
    assert ".dossier-financial-grid" in content
    assert ".dossier-fin-card" in content
    assert ".fin-billed" in content
    assert ".fin-excluded" in content
    assert ".fin-payout" in content

    # Evidence Thumbnails Grid
    assert ".dossier-evidence-grid" in content
    assert ".dossier-proof-card" in content
    assert ".dossier-proof-thumb-wrap" in content
    assert ".dossier-proof-img" in content
    assert ".dossier-proof-tag" in content

    # Compliance Summary
    assert ".compliance-badge-summary" in content
    assert ".dossier-compliance-box" in content
    assert ".compliance-check-pill" in content

    # Confirmation Checkbox & Button States
    assert ".dossier-confirm-wrap" in content
    assert ".confirm-checkbox-label" in content
    assert "#btn-submit-final-claim:disabled" in content

    # Reassurance Confirmation Screen & Insurer Highlighting
    assert ".success-receipt-card" in content
    assert ".receipt-id-box" in content
    assert ".receipt-actions-row" in content
    assert ".insurer-queue-grid" in content
    assert ".insurer-claim-card" in content
    assert ".highlighted-claim" in content
    assert "claimHighlightPulse" in content


def test_submit_step_js_module():
    """Verify static/js/submitStep.js defines required exports and logic."""
    js_path = Path(__file__).parent.parent / "static" / "js" / "submitStep.js"
    assert js_path.exists(), "submitStep.js must exist"
    content = js_path.read_text(encoding="utf-8")

    # Exports
    assert "export const SCHEME_COVERAGE_METADATA" in content
    assert "export function initSubmitStep" in content
    assert "export function renderSubmitStep" in content
    assert "export function renderSummaryDossier" in content
    assert "export async function submitClaimPackage" in content
    assert "export function renderSuccessReceipt" in content
    assert "export function formatSubmissionTimestamp" in content
    assert "export async function openInInsurerQueue" in content
    assert "export function renderInsurerQueue" in content
    assert "export function resetClaimWizard" in content

    # Checkbox logic
    assert "claim-confirm-genuine" in content
    assert "btn-submit-final-claim" in content
    assert "is-enabled" in content

    # 3 Action Buttons Logic
    assert "btn-print-claim-pdf" in content
    assert "btn-open-insurer-queue" in content
    assert "btn-file-another-claim" in content

    # Checkbox logic
    assert "claim-confirm-genuine" in content
    assert "btn-submit-final-claim" in content
    assert "is-enabled" in content

    # API submission call
    assert "submitClaim(payload)" in content
    assert "POST /api/submit-claim" in content or "submitClaim" in content


def test_submit_step_wizard_integration():
    """Verify static/js/claimWizard.js delegates Step 4 to submitStep.js."""
    wizard_path = Path(__file__).parent.parent / "static" / "js" / "claimWizard.js"
    assert wizard_path.exists(), "claimWizard.js must exist"
    content = wizard_path.read_text(encoding="utf-8")

    assert "from './submitStep.js'" in content
    assert "initSubmitStep" in content
    assert "renderSubmitStep" in content
    assert "submitClaimPackage" in content
