"""
Tests for "Use This Policy to File a Claim" integration.
Verifies that:
1. Recommender card template renders prominent primary button labeled "Use This Policy to File a Claim".
2. Clicking it sets state.selectedPolicyId to that exact policy.
3. Pre-fills user's age from recommender form (#rec-age) into claim form (#claim-claimant-age).
4. Switches automatically to File a Claim tab at Step 1 (setWizardStep(1), switchView('claim')).
5. Highlights the active policy banner (#claim-active-policy-banner) with scheme code, name, and pulse class.
6. Displays confirmation toast ("Activated PMSBY — ready to check your claim", "Activated Micro-Health — ready to check your claim", "Activated PMFBY — ready to check your claim").
"""

import os
import re
import subprocess
from pathlib import Path


def test_recommender_js_has_use_policy_claim_button():
    """Verify static/js/recommender.js contains the button markup and event wiring."""
    recommender_path = Path(__file__).parent.parent / "static" / "js" / "recommender.js"
    assert recommender_path.exists(), "recommender.js must exist"
    content = recommender_path.read_text(encoding="utf-8")

    # 1. Button markup check
    assert 'class="btn btn-primary btn-select-scheme btn-use-policy-claim"' in content
    assert 'data-i18n="btn_use_policy_claim"' in content
    assert "Use This Policy to File a Claim" in content
    assert 'data-policy-id="${policyId}"' in content

    # 2. Click listener logic check
    assert "setSelectedPolicyId(policyId)" in content
    assert "setWizardStep(1)" in content
    assert "switchView('claim')" in content
    assert "claimAgeInput.value = userAge" in content
    assert "highlightActivePolicyBanner(" in content
    assert "Activated ${toastCode} — ready to check your claim" in content


def test_scheme_toast_codes_and_metadata():
    """Verify mapping of schemes to exact toast codes and active policy summaries."""
    recommender_path = Path(__file__).parent.parent / "static" / "js" / "recommender.js"
    content = recommender_path.read_text(encoding="utf-8")

    assert "pmsby: 'PMSBY'" in content
    assert "pmjjby: 'PMJJBY'" in content
    assert "pmfby: 'PMFBY'" in content
    assert "ab_pmjay: 'AB-PMJAY'" in content
    assert "micro_health_gig: 'Micro-Health'" in content


def test_active_policy_banner_in_index_html():
    """Verify static/index.html includes the active policy banner and claim input fields."""
    index_path = Path(__file__).parent.parent / "static" / "index.html"
    assert index_path.exists(), "index.html must exist"
    content = index_path.read_text(encoding="utf-8")

    assert 'id="claim-active-policy-banner"' in content
    assert 'id="claim-active-code"' in content
    assert 'id="claim-active-name"' in content
    assert 'id="claim-active-summary"' in content
    assert 'id="claim-claimant-age"' in content
    assert 'id="claim-policy-id"' in content


def test_active_policy_banner_css_styles():
    """Verify static/styles.css includes active policy banner and pulse animation."""
    css_path = Path(__file__).parent.parent / "static" / "styles.css"
    assert css_path.exists(), "styles.css must exist"
    content = css_path.read_text(encoding="utf-8")

    assert ".active-policy-banner" in content
    assert ".active-policy-banner.highlight-pulse" in content
    assert "@keyframes pulseGlow" in content
    assert ".btn-use-policy-claim" in content


def test_i18n_has_use_policy_claim_translations():
    """Verify i18n dictionaries include English and Hindi translations for the button."""
    i18n_path = Path(__file__).parent.parent / "static" / "js" / "i18n.js"
    assert i18n_path.exists(), "i18n.js must exist"
    content = i18n_path.read_text(encoding="utf-8")

    assert "btn_use_policy_claim: 'Use This Policy to File a Claim'" in content
    assert "btn_use_policy_claim: 'इस योजना से क्लेम दर्ज करें'" in content


def test_node_claim_activation_execution():
    """Run Node.js headless DOM test to verify button click, age pre-fill, tab switch, and toast."""
    script_path = Path(__file__).parent.parent / "scratch" / "test_claim_activation.mjs"
    assert script_path.exists(), "test_claim_activation.mjs must exist"

    result = subprocess.run(
        ["node", str(script_path)],
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert result.returncode == 0, f"Node test failed with error:\n{result.stderr}\n{result.stdout}"
    assert "All 6 Claim Activation Tests Passed Cleanly!" in result.stdout
