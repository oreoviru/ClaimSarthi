"""
Automated unit & integration tests for Step 3 (Verify & Fix) and static/js/verifyStep.js.
Verifies:
1. Responsive split layout:
   - Desktop (>=1024px): Uploaded bill/damage photo pinned on left (sticky) with click-to-zoom preview,
     extracted structured data form on right.
   - Mobile (<1024px): Collapsible photo preview stacked cleanly above editable fields.
2. Form fields displayed & editable:
   - Provider/Clinic Name (#claim-ext-provider)
   - Bill/Incident Date (#claim-ext-date)
   - Diagnosis/Damage Type (#claim-ext-diagnosis)
   - Total Amount (₹) (#claim-ext-total)
   - Itemized line items (#claim-itemized-list)
3. Low confidence (<0.75) and null field highlighting:
   - Amber outline (.is-low-confidence)
   - "Please verify handwritten value" hint (.field-verify-hint)
4. Click-to-Zoom lightbox modal (#claim-zoom-modal, #zoom-modal-img, zoom controls).
5. Modular exports in static/js/verifyStep.js and integration into static/js/claimWizard.js.
"""

from pathlib import Path


def test_verify_step_html_structure():
    """Verify static/index.html includes the pinned photo, zoom modal, and all 5 verification fields."""
    index_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "index.html"
    assert index_path.exists(), "index.html must exist"
    content = index_path.read_text(encoding="utf-8")

    # Split Inspector container and columns
    assert 'class="split-bill-inspector"' in content
    assert 'verify-photo-col' in content
    assert 'verify-form-col' in content

    # Left Column: Document Proof Image & Mobile Collapse
    assert 'id="claim-doc-inspector-preview"' in content
    assert 'id="btn-toggle-doc-preview"' in content
    assert 'id="inspector-photo-body"' in content
    assert 'id="claim-inspector-image"' in content
    assert 'id="inspector-doc-filename"' in content
    assert 'id="btn-zoom-doc"' in content or 'btn-zoom-action' in content

    # Right Column: Extracted Structured Data Form
    assert 'id="claim-inspector-fields"' in content
    assert 'id="claim-ext-provider"' in content
    assert 'Healthcare Provider / Clinic Name' in content or 'Healthcare Provider / Clinic' in content
    assert 'id="claim-ext-date"' in content
    assert 'Bill / Incident Date' in content
    assert 'id="claim-ext-diagnosis"' in content
    assert 'Diagnosis / Damage Type' in content
    assert 'id="claim-ext-total"' in content
    assert 'Total Amount' in content

    # Hint containers for low-confidence warnings
    assert 'id="hint-ext-provider"' in content
    assert 'id="hint-ext-date"' in content
    assert 'id="hint-ext-diagnosis"' in content
    assert 'id="hint-ext-total"' in content

    # Itemized Charges List
    assert 'id="claim-itemized-list"' in content
    assert 'Itemized' in content

    # Click-to-Zoom Lightbox Modal
    assert 'id="claim-zoom-modal"' in content
    assert 'id="zoom-modal-img"' in content
    assert 'id="btn-zoom-in"' in content
    assert 'id="btn-zoom-out"' in content
    assert 'id="btn-zoom-reset"' in content
    assert 'id="btn-close-zoom"' in content


def test_verify_step_css_responsive_and_amber_highlight():
    """Verify static/styles.css includes desktop pinned layout, mobile collapse, and amber outline."""
    css_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "styles.css"
    assert css_path.exists(), "styles.css must exist"
    content = css_path.read_text(encoding="utf-8")

    # Responsive Desktop Pinned Layout (>=1024px)
    assert "@media (min-width: 1024px)" in content
    assert "position: sticky" in content
    assert ".split-bill-inspector" in content

    # Mobile Collapsible Preview
    assert ".btn-toggle-doc-preview" in content
    assert ".inspector-photo-body.collapsed" in content

    # Amber Outline for Low Confidence (<0.75) or Null Fields
    assert ".is-low-confidence" in content or ".form-control.is-low-confidence" in content
    assert "#b45309" in content or "var(--color-accent" in content
    assert ".field-verify-hint" in content
    assert "Please verify handwritten value" in content or ".hint-amber" in content

    # Zoom Modal Styles
    assert ".zoom-modal-backdrop" in content
    assert ".zoom-modal-content" in content
    assert ".zoom-modal-viewport" in content
    assert ".zoom-modal-img" in content


def test_verify_step_js_module_exports_and_logic():
    """Verify static/js/verifyStep.js exists and exports required functions and constants."""
    verify_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "js" / "verifyStep.js"
    assert verify_path.exists(), "verifyStep.js must exist"
    content = verify_path.read_text(encoding="utf-8")

    assert "export const CONFIDENCE_THRESHOLD = 0.75" in content or "CONFIDENCE_THRESHOLD = 0.75" in content
    assert "export function initVerifyStep" in content
    assert "export function renderVerifyStep" in content
    assert "export function getConfidenceScore" in content
    assert "export function auditFieldElement" in content
    assert "export function renderItemizedCharges" in content
    assert "export function openZoomModal" in content
    assert "export function closeZoomModal" in content
    assert "export function toggleMobilePhotoPreview" in content
    assert "export async function runRevalidation" in content

    # Check that amber outline class and hint message are present in logic
    assert "is-low-confidence" in content
    assert "Please verify handwritten value" in content
    assert "claim-ext-diagnosis" in content
    assert "claim-ext-provider" in content
    assert "claim-ext-date" in content
    assert "claim-ext-total" in content


def test_claim_wizard_integration_with_verify_step():
    """Verify static/js/claimWizard.js delegates Step 3 rendering and init to verifyStep.js."""
    wizard_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "js" / "claimWizard.js"
    assert wizard_path.exists(), "claimWizard.js must exist"
    content = wizard_path.read_text(encoding="utf-8")

    assert "from './verifyStep.js'" in content
    assert "initVerifyStep" in content
    assert "renderVerifyStep" in content
    assert "renderStep3Results" in content
