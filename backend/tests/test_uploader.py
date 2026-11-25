"""
Automated unit & integration tests for Step 2 Document Uploader (static/js/uploader.js).
Verifies:
1. static/js/uploader.js existence and clean ES module exports.
2. Mobile phone camera capture support: accept="image/*" and capture="environment".
3. Desktop drag-and-drop: dragenter, dragover, dragleave, drop handlers.
4. Clearly labeled upload slots driven by selected policy's required_docs:
   - Primary Proof slot (e.g., Handwritten Hospital Bill or Crop Damage Photo) [Required *]
   - Optional Secondary Proof slots (e.g., Doctor Prescription, FIR Copy, Land Record) [Can Skip]
   - Rejection-Prevention engine skip callout for demonstrating audit catches.
5. Crisp image thumbnail display, formatted file sizes, and remove/retake buttons.
6. HTML landmarks in static/index.html and responsive CSS in static/styles.css.
"""

from pathlib import Path


def test_uploader_js_exports():
    """Verify uploader.js has all required ES module exports."""
    uploader_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "js" / "uploader.js"
    assert uploader_path.exists(), "static/js/uploader.js must exist"
    content = uploader_path.read_text(encoding="utf-8")

    expected_exports = [
        "export const POLICY_DOCUMENT_SLOTS",
        "export function formatFileSize",
        "export function getSlotConfig",
        "export function syncDraftFromSlots",
        "export function attachFileToSlot",
        "export function removeSlotFile",
        "export function loadDemoSample",
        "export function renderUploadSlots",
        "export function renderPreviews",
        "export function validateStep2",
        "export function initUploader",
    ]
    for exp in expected_exports:
        assert exp in content, f"uploader.js must contain export: {exp}"


def test_uploader_camera_capture_and_drag_drop():
    """Verify mobile phone camera capture and desktop drag-and-drop attributes."""
    uploader_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "js" / "uploader.js"
    content = uploader_path.read_text(encoding="utf-8")

    # Camera capture
    assert 'accept="image/*"' in content
    assert 'capture="environment"' in content

    # Desktop file browse
    assert 'accept="image/jpeg,image/png,image/webp"' in content

    # Drag-and-drop event binding
    assert "dragenter" in content
    assert "dragover" in content
    assert "dragleave" in content
    assert "drop" in content
    assert "dataTransfer" in content


def test_uploader_policy_document_slots_coverage():
    """Verify slots are defined for all 5 insurance policies with primary and secondary slots."""
    uploader_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "js" / "uploader.js"
    content = uploader_path.read_text(encoding="utf-8")

    policies = ["micro_health_gig", "pmfby", "pmsby", "pmjjby", "ab_pmjay"]
    for p in policies:
        assert f"{p}:" in content, f"POLICY_DOCUMENT_SLOTS must contain policy {p}"

    # Verify primary proof keys
    assert "clinic_opd_bill" in content
    assert "crop_damage_photo" in content
    assert "fir_or_police_report" in content
    assert "death_certificate" in content
    assert "hospital_discharge_summary" in content

    # Verify secondary proof keys
    assert "doctor_prescription" in content
    assert "land_record_ror" in content
    assert "sowing_certificate" in content
    assert "pme_report" in content
    assert "ayushman_ecard" in content

    # Verify Rejection-Prevention skip notices
    assert "Rejection-Prevention" in content or "Rejection Guard" in content
    assert "skip" in content.lower()


def test_uploader_html_structure():
    """Verify static/index.html includes the dynamic upload slots container and judges demo bar."""
    index_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "index.html"
    content = index_path.read_text(encoding="utf-8")

    assert 'id="policy-upload-slots-container"' in content
    assert 'class="upload-slots-container"' in content
    assert 'id="claim-step-2"' in content
    assert 'id="judges-demo-bar"' in content or 'id="demo-samples-bar"' in content
    assert 'id="claim-dropzone"' in content
    assert 'id="claim-previews-container"' in content


def test_uploader_css_styles():
    """Verify static/styles.css contains styling for upload slots, camera buttons, and previews."""
    css_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "styles.css"
    content = css_path.read_text(encoding="utf-8")

    required_selectors = [
        ".upload-slots-container",
        ".upload-slot-card",
        ".slot-card-primary",
        ".slot-card-secondary",
        ".slot-header",
        ".badge-primary-required",
        ".badge-secondary-optional",
        ".slot-dropzone",
        ".btn-slot-camera",
        ".btn-slot-browse",
        ".slot-skip-box",
        ".slot-preview-box",
        ".slot-thumb-container",
        ".slot-thumb-img",
        ".btn-retake-action",
        ".btn-remove-action",
    ]
    for sel in required_selectors:
        assert sel in content, f"styles.css must contain selector: {sel}"

    # Verify mobile 48px touch target
    assert "min-height: 48px" in content


def test_claim_wizard_uploader_integration():
    """Verify static/js/claimWizard.js properly imports and re-exports uploader functions."""
    wizard_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "js" / "claimWizard.js"
    content = wizard_path.read_text(encoding="utf-8")

    assert "from './uploader.js'" in content
    assert "initUploader" in content
    assert "renderUploadSlots" in content
    assert "loadDemoSample" in content
    assert "renderPreviews" in content
    assert "validateStep2" in content
