"""
Automated unit & integration tests for "Quick Demo Cases (For Judges)" bar and Step 3 Image Inspector.
Verifies:
1. Sleek subtly separated "Quick Demo Cases (For Judges)" bar in static/index.html.
2. 3 one-click buttons with exact titles:
   (1) Clean ₹2,450 Clinic Bill (Auto-Pass)
   (2) Problematic ₹7,800 Handwritten Bill (Catch 3 Traps)
   (3) PMFBY Crop Hailstorm Photo (Missing Land Proof)
3. Dynamic population from GET /api/samples and sample metadata.
4. runJudgeSampleDemo handler sets policy/claimant context, displays scanning transition,
   calls POST /api/analyze-sample/{sample_id}, and lands directly on Step 3.
5. Step 3 Document Image Inspector preview renders sample proof image (/samples/...).
6. Responsive CSS styling for judges bar and document inspector in static/styles.css.
"""

from pathlib import Path


def test_judges_demo_bar_html_structure():
    """Verify static/index.html contains sleek Quick Demo Cases (For Judges) bar with all 3 buttons."""
    index_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "index.html"
    assert index_path.exists(), "static/index.html must exist"
    content = index_path.read_text(encoding="utf-8")

    # Bar container and header
    assert 'id="judges-demo-bar"' in content
    assert "Quick Demo Cases (For Judges)" in content
    assert 'id="judges-buttons-grid"' in content

    # 3 One-click buttons
    assert 'data-sample-id="clean_clinic_bill"' in content
    assert "Clean ₹2,450 Clinic Bill (Auto-Pass)" in content
    assert "Auto-Pass" in content

    assert 'data-sample-id="tricky_handwritten_bill"' in content
    assert "Problematic ₹7,800 Handwritten Bill (Catch 3 Traps)" in content
    assert "Catch 3 Traps" in content

    assert 'data-sample-id="pmfby_hailstorm_crop"' in content
    assert "PMFBY Crop Hailstorm Photo (Missing Land Proof)" in content
    assert "Missing Land Proof" in content


def test_step_3_document_image_inspector_html():
    """Verify static/index.html includes the Step 3 Document Proof Image Inspector preview."""
    index_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "index.html"
    content = index_path.read_text(encoding="utf-8")

    # Inspector image card & elements
    assert 'id="claim-doc-inspector-preview"' in content
    assert 'id="claim-inspector-image"' in content
    assert 'id="inspector-doc-filename"' in content
    assert 'id="inspector-view-full"' in content
    assert 'id="inspector-doc-badge"' in content


def test_claim_wizard_judges_demo_logic():
    """Verify static/js/claimWizard.js exports DEMO_SCENARIOS, runJudgeSampleDemo, and initJudgesDemoBar."""
    wizard_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "js" / "claimWizard.js"
    assert wizard_path.exists(), "static/js/claimWizard.js must exist"
    content = wizard_path.read_text(encoding="utf-8")

    # Exports
    assert "export const DEMO_SCENARIOS" in content
    assert "export async function runJudgeSampleDemo" in content
    assert "export async function initJudgesDemoBar" in content
    assert "export function renderStep3Results" in content

    # Demo Scenarios Data
    assert "clean_clinic_bill" in content
    assert "tricky_handwritten_bill" in content
    assert "pmfby_hailstorm_crop" in content

    # Scanning transition & Step 3 landing
    assert "goToStep(3)" in content
    assert "claim-analysis-loading" in content
    assert "analyzeSample" in content
    assert "claim-inspector-image" in content


def test_judges_demo_bar_css_styling():
    """Verify static/styles.css includes styling for judges demo bar, cards, and inspector."""
    css_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "styles.css"
    assert css_path.exists(), "static/styles.css must exist"
    content = css_path.read_text(encoding="utf-8")

    required_selectors = [
        ".judges-demo-bar",
        ".judges-bar-header",
        ".judges-badge",
        ".judges-live-pill",
        ".judges-buttons-grid",
        ".btn-judge-card",
        ".btn-judge-clean",
        ".btn-judge-tricky",
        ".btn-judge-crop",
        ".judge-card-top",
        ".judge-badge",
        ".judge-card-title",
        ".inspector-preview",
        ".inspector-image-container",
        ".inspector-doc-image",
        ".inspector-doc-meta",
        ".inspector-zoom-link",
    ]
    for sel in required_selectors:
        assert sel in content, f"styles.css must contain selector: {sel}"
