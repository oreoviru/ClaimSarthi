"""
Automated unit & integration tests for the Multi-Stage Loading State and Policy Underwriting Engine HUD.
Verifies:
1. "Scan & Check Policy Eligibility" primary action button (#btn-step-2-next) in Step 2.
2. Animated 3 meaningful real-world stages in static/index.html:
   - "1. Checking photo clarity & handwriting..."
   - "2. Extracting amounts, dates & items via AI Vision..."
   - "3. Cross-checking against official policy limits & exclusions..."
3. Animated progress bar (#loading-progress-bar) and percentage pill (#loading-progress-percent).
4. Error & Timeout recovery panel (#loading-error-panel) with clean Retry Button (#btn-retry-analysis)
   and Back to Upload button (#btn-loading-back-step2).
5. CSS classes and keyframe animations in static/styles.css.
6. JavaScript stage controller, timeout handling, retry bindings in static/js/claimWizard.js.
7. Bilingual translations in static/js/i18n.js.
"""

from pathlib import Path


def test_step2_primary_button_scan_and_check():
    """Verify Step 2 button text updated to 'Scan & Check Policy Eligibility'."""
    index_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "index.html"
    assert index_path.exists(), "index.html must exist"
    content = index_path.read_text(encoding="utf-8")

    assert 'id="btn-step-2-next"' in content
    assert "Scan &amp; Check Policy Eligibility" in content or "Scan & Check Policy Eligibility" in content
    assert 'data-i18n="btn_scan_and_check"' in content


def test_three_real_world_loading_stages_html():
    """Verify static/index.html defines the 3 exact underwriting stages and progress bar."""
    index_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "index.html"
    content = index_path.read_text(encoding="utf-8")

    # Loading HUD container
    assert 'id="claim-analysis-loading"' in content
    assert 'id="loading-stages-container"' in content
    assert 'id="loading-progress-bar"' in content
    assert 'id="loading-progress-percent"' in content
    assert 'id="loading-stages-stepper"' in content

    # Stage 1: Checking photo clarity & handwriting...
    assert 'id="loading-stage-1"' in content
    assert "1. Checking photo clarity &amp; handwriting..." in content or "1. Checking photo clarity & handwriting..." in content
    assert 'id="loading-indicator-1"' in content

    # Stage 2: Extracting amounts, dates & items via AI Vision...
    assert 'id="loading-stage-2"' in content
    assert "2. Extracting amounts, dates &amp; items via AI Vision..." in content or "2. Extracting amounts, dates & items via AI Vision..." in content
    assert 'id="loading-indicator-2"' in content

    # Stage 3: Cross-checking against official policy limits & exclusions...
    assert 'id="loading-stage-3"' in content
    assert "3. Cross-checking against official policy limits &amp; exclusions..." in content or "3. Cross-checking against official policy limits & exclusions..." in content
    assert 'id="loading-indicator-3"' in content


def test_timeout_error_panel_and_retry_button_html():
    """Verify clean timeout/error panel and retry button in static/index.html."""
    index_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "index.html"
    content = index_path.read_text(encoding="utf-8")

    assert 'id="loading-error-panel"' in content
    assert 'id="loading-error-title"' in content
    assert 'id="loading-error-msg"' in content
    assert 'id="btn-retry-analysis"' in content
    assert "Retry Policy Audit" in content or "Retry" in content
    assert 'id="btn-loading-back-step2"' in content


def test_loading_state_css_classes():
    """Verify static/styles.css provides styling for HUD, progress, indicators, and retry button."""
    css_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "styles.css"
    assert css_path.exists(), "styles.css must exist"
    content = css_path.read_text(encoding="utf-8")

    required_classes = [
        ".analysis-loading-card",
        ".loading-stages-container",
        ".loading-hud-header",
        ".loading-engine-badge",
        ".engine-pulse-dot",
        ".loading-progress-track",
        ".loading-progress-fill",
        ".loading-stages-stepper",
        ".loading-stage-item",
        ".loading-stage-item.active",
        ".loading-stage-item.completed",
        ".loading-stage-item.pending",
        ".stage-status-indicator",
        ".stage-spinner",
        ".stage-check-icon",
        ".loading-error-panel",
        ".btn-retry-analysis",
    ]

    for cls in required_classes:
        assert cls in content, f"Missing CSS class or rule: {cls}"


def test_claim_wizard_js_loading_exports_and_stages():
    """Verify static/js/claimWizard.js exports loading animation and retry helpers."""
    wizard_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "js" / "claimWizard.js"
    assert wizard_path.exists(), "claimWizard.js must exist"
    content = wizard_path.read_text(encoding="utf-8")

    assert "export function startAnalysisLoadingAnimation" in content
    assert "export function completeAnalysisLoadingAnimation" in content
    assert "export function showAnalysisLoadingError" in content
    assert "export function initAnalysisRetryHandlers" in content
    assert "export function setLoadingStageState" in content
    assert "export function updateLoadingProgress" in content
    assert "export async function runClaimAnalysis" in content or "export function runClaimAnalysis" in content

    # Check timeout handling and stage timer references
    assert "analysisStageTimers" in content
    assert "timeoutPromise" in content
    assert "btn-retry-analysis" in content
    assert "btn-loading-back-step2" in content


def test_i18n_dictionary_loading_keys():
    """Verify static/js/i18n.js includes translations for button and loading stages."""
    i18n_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "js" / "i18n.js"
    assert i18n_path.exists(), "i18n.js must exist"
    content = i18n_path.read_text(encoding="utf-8")

    # English
    assert "btn_scan_and_check: 'Scan & Check Policy Eligibility →'" in content
    assert "btn_retry_analysis: '🔄 Retry Policy Audit'" in content
    assert "loading_stage_1_title: '1. Checking photo clarity & handwriting...'" in content
    assert "loading_stage_2_title: '2. Extracting amounts, dates & items via AI Vision...'" in content
    assert "loading_stage_3_title: '3. Cross-checking against official policy limits & exclusions...'" in content

    # Hindi
    assert "btn_scan_and_check: 'दस्तावेज स्कैन करें और पात्रता जांचें →'" in content
    assert "btn_retry_analysis: '🔄 पुनः प्रयास करें (रीट्राय)'" in content
    assert "loading_stage_1_title: '1. फोटो स्पष्टता और लिखावट की जांच...'" in content
    assert "loading_stage_2_title: '2. AI विजन द्वारा राशि, तिथियां और मदों का निष्कर्षण...'" in content
    assert "loading_stage_3_title: '3. आधिकारिक पॉलिसी सीमा व अपवादों से मिलान...'" in content
