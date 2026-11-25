"""
Automated tests for File a Claim workspace and static/js/claimWizard.js.
Verifies:
1. Guided 4-step wizard with crisp top progress stepper:
   1. Policy & Incident -> 2. Scan Proof -> 3. Verify & Fix -> 4. Submit Packet.
2. Step transitions preserve all form values across backward and forward navigation.
3. Uploaded previews and demo cases preserved on back navigation.
4. Skipping ahead prevented until required inputs are ready.
5. Completed vs. active steps accurately highlighted.
6. Compact mobile progress indicator rendered for narrow viewports.
7. Step 1 Policy Selector populated by /api/policies.
8. Step 1 "Before You Upload — What This Policy Requires" checklist directly below selector.
9. Step 1 Policy Start Date quick presets (6 months ago, 10 days ago) for demoing waiting period catches.
10. Step 1 Incident Date & Incident Type (Clinic Visit, Road Accident, Snakebite/Fall, Hailstorm Crop Damage).
"""

from pathlib import Path
import subprocess


def test_claim_wizard_html_structure():
    """Verify static/index.html contains the crisp stepper and all 4 step panels."""
    index_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "index.html"
    assert index_path.exists(), "index.html must exist"
    content = index_path.read_text(encoding="utf-8")

    # Stepper container and mobile indicator
    assert 'id="claim-stepper-container"' in content
    assert 'id="wizard-mobile-stepper"' in content
    assert 'id="mobile-step-pill"' in content
    assert 'id="mobile-step-title"' in content
    assert 'id="wizard-steps-bar"' in content

    # 4 Stepper step titles
    assert "1. Policy &amp; Incident" in content or "1. Policy & Incident" in content
    assert "2. Scan Proof" in content
    assert "3. Verify &amp; Fix" in content or "3. Verify & Fix" in content
    assert "4. Submit Packet" in content

    # 4 Step panels
    assert 'id="claim-step-1"' in content
    assert 'id="claim-step-2"' in content
    assert 'id="claim-step-3"' in content
    assert 'id="claim-step-4"' in content

    # Essential inputs & buttons
    assert 'id="claim-policy-id"' in content
    assert 'id="claim-policy-requirements"' in content
    assert 'id="claim-claimant-name"' in content
    assert 'id="claim-claimant-age"' in content
    assert 'id="claim-policy-start-date"' in content
    assert 'id="claim-incident-date"' in content
    assert 'id="claim-incident-subtype"' in content
    assert 'id="claim-dropzone"' in content
    assert 'id="claim-previews-container"' in content
    assert 'id="btn-revalidate-claim"' in content
    assert 'id="btn-submit-final-claim"' in content


def test_step_1_policy_requirements_and_presets_html():
    """Verify Step 1 HTML contains requirements container, date presets, and incident types."""
    index_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "index.html"
    content = index_path.read_text(encoding="utf-8")

    # Policy selector & requirements checklist
    assert 'id="claim-policy-id"' in content
    assert 'id="claim-policy-requirements"' in content

    # Policy start date quick presets
    assert "Enrolled 6 months ago" in content
    assert "Enrolled 10 days ago (Demo Waiting-Period Catch)" in content
    assert 'data-days-ago="180"' in content
    assert 'data-days-ago="10"' in content

    # Incident Date presets
    assert 'data-days-ago="0"' in content
    assert 'data-days-ago="1"' in content
    assert 'data-days-ago="3"' in content

    # Incident Types
    assert 'value="clinic_visit"' in content
    assert 'Clinic Visit' in content
    assert 'value="road_accident"' in content
    assert 'Road Accident' in content
    assert 'value="snakebite_fall"' in content
    assert 'Snakebite / Fall' in content
    assert 'value="hailstorm_crop_loss"' in content
    assert 'Hailstorm Crop Damage' in content


def test_claim_wizard_js_logic_and_exports():
    """Verify static/js/claimWizard.js exports required handlers and definitions."""
    wizard_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "js" / "claimWizard.js"
    assert wizard_path.exists(), "claimWizard.js must exist"
    content = wizard_path.read_text(encoding="utf-8")

    assert "export function initClaimWizard" in content
    assert "export function goToStep" in content
    assert "export function validateStep1" in content
    assert "export function validateStep2" in content
    assert "export function validateStep3" in content
    assert "export function loadDemoSample" in content
    assert "export function renderPreviews" in content
    assert "export function renderSummaryDossier" in content
    assert "populatePolicySelector" in content
    assert "export function renderPolicyRequirements" in content
    assert "export const POLICY_REQUIREMENTS_DATA" in content
    assert "export const STEP_DEFINITIONS" in content

    # 4 steps in STEP_DEFINITIONS
    assert "'1. Policy & Incident'" in content
    assert "'2. Scan Proof'" in content
    assert "'3. Verify & Fix'" in content
    assert "'4. Submit Packet'" in content

    # Requirements data checks
    assert "micro_health_gig" in content
    assert "₹5,000 / claim" in content
    assert "15-day initial waiting period" in content
    assert "pmsby" in content
    assert "₹2,00,000 Accidental Cover" in content
    assert "pmjjby" in content
    assert "30-day initial lien period" in content
    assert "pmfby" in content
    assert "72-hour localized casualty intimation" in content
    assert "ab_pmjay" in content
    assert "₹5,00,000 Cashless" in content


def test_claim_wizard_css_styling():
    """Verify static/styles.css includes stepper, policy requirements card, and presets styles."""
    css_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "styles.css"
    assert css_path.exists(), "styles.css must exist"
    content = css_path.read_text(encoding="utf-8")

    assert ".wizard-stepper-container" in content
    assert ".wizard-mobile-stepper" in content
    assert ".wizard-steps-bar" in content
    assert ".wizard-step-item.active" in content
    assert ".wizard-step-item.completed" in content
    assert ".policy-requirements-container" in content
    assert ".policy-req-card" in content
    assert ".policy-req-header" in content
    assert ".req-cap-badge" in content
    assert ".req-clause-strip" in content
    assert ".mandatory-proofs-list" in content
    assert ".req-exclusions-warning" in content
    assert ".date-presets-row" in content
    assert ".date-preset-btn" in content
    assert ".incident-preset-btn" in content


def test_claim_wizard_i18n_dictionary():
    """Verify static/js/i18n.js has the 4 step titles in English and Hindi."""
    i18n_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "js" / "i18n.js"
    assert i18n_path.exists(), "i18n.js must exist"
    content = i18n_path.read_text(encoding="utf-8")

    assert "step_1_label: '1. Policy & Incident'" in content
    assert "step_2_label: '2. Scan Proof'" in content
    assert "step_3_label: '3. Verify & Fix'" in content
    assert "step_4_label: '4. Submit Packet'" in content


def test_node_claim_wizard_headless_verification():
    """Run Node.js headless tests verifying Step 1 requirements, presets, navigation, and validation gates."""
    script_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "tests" / "test_claim_wizard.mjs"
    assert script_path.exists(), "test_claim_wizard.mjs must exist"

    result = subprocess.run(
        ["node", str(script_path)],
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert result.returncode == 0, f"Node test failed:\n{result.stderr}\n{result.stdout}"
    assert "All 14 Step 1 & Claim Wizard Integration Tests Passed Cleanly!" in result.stdout
