"""
Automated unit & integration tests for Policy Cross-Check Scorecard in Step 3.
Verifies:
1. HTML markup for Policy Cross-Check Scorecard:
   - Scorecard card (#claim-crosscheck-scorecard)
   - Top summary bar (#scorecard-summary-bar)
   - Readiness score element (#scorecard-readiness-val, #scorecard-meter-fill)
   - Overall status element (#scorecard-status-val)
   - Estimated payout vs billed amount (#scorecard-payout-val, #scorecard-billed-val)
   - Dynamic rule checks list container (#claim-rule-checks-list)
2. CSS styles for emerald, amber, crimson visual indicators:
   - PASS in emerald (#15803d, #dcfce7, #86efac)
   - WARNING in amber (#b45309, #fef3c7, #fde68a)
   - FAIL in crimson (#b91c1c, #fee2e2, #fca5a5)
   - Next action callouts (.rule-next-action-row, .action-pass, .action-warning, .action-fail)
3. Integration with validator_service:
   - RuleCheckResult objects have valid status, explanation, and action_required.
"""

from pathlib import Path
from models import ExtractedBillData, ItemizedCharge, RuleCheckResult
from services.policy_service import get_policy_by_id
from services.validator_service import validate_claim, evaluate_extraction_confidence


def test_scorecard_html_structure():
    """Verify static/index.html includes the Policy Cross-Check Scorecard and summary bar."""
    index_path = Path(__file__).parent.parent / "static" / "index.html"
    assert index_path.exists(), "index.html must exist"
    content = index_path.read_text(encoding="utf-8")

    # Scorecard container
    assert 'id="claim-crosscheck-scorecard"' in content
    assert "Policy Cross-Check Scorecard" in content

    # Top summary bar
    assert 'id="scorecard-summary-bar"' in content
    assert 'id="scorecard-readiness-val"' in content
    assert 'id="scorecard-meter-fill"' in content
    assert 'id="scorecard-status-val"' in content
    assert 'id="scorecard-payout-val"' in content
    assert 'id="scorecard-billed-val"' in content
    assert 'id="scorecard-deduction-val"' in content

    # Rule checks list container & fix-it checklist
    assert 'id="claim-rule-checks-list"' in content
    assert 'id="claim-fixit-box"' in content
    assert 'id="claim-fixit-list"' in content
    assert 'id="btn-revalidate-claim"' in content


def test_scorecard_css_status_colors():
    """Verify static/styles.css specifies emerald, amber, and crimson indicators."""
    css_path = Path(__file__).parent.parent / "static" / "styles.css"
    assert css_path.exists(), "styles.css must exist"
    content = css_path.read_text(encoding="utf-8")

    # Summary bar grid layout
    assert ".scorecard-summary-bar" in content
    assert ".scorecard-summary-box" in content
    assert ".scorecard-meter-fill" in content
    assert ".scorecard-status-badge" in content

    # Visual status indicators
    # Emerald (#15803d)
    assert "#15803d" in content or "--color-pass" in content
    assert ".status-pass" in content
    assert ".rule-pass" in content

    # Amber (#b45309)
    assert "#b45309" in content or "--color-accent" in content
    assert ".status-warning" in content
    assert ".rule-warning" in content

    # Crimson (#b91c1c)
    assert "#b91c1c" in content or "--color-fail" in content
    assert ".status-fail" in content
    assert ".rule-fail" in content

    # Exact Next Action strip
    assert ".rule-next-action-row" in content
    assert ".action-pass" in content
    assert ".action-warning" in content
    assert ".action-fail" in content
    assert ".action-heading" in content


def test_validator_service_generates_plain_english_scorecard():
    """Verify validator_service returns valid RuleCheckResult with plain explanations and actions."""
    policy = get_policy_by_id("micro_health_gig")
    assert policy is not None

    # Test tricky bill with ₹450 multivitamins (exceeding cap and exclusions)
    ext = ExtractedBillData(
        document_type="clinic_opd_bill",
        provider_name="Seva PolyClinic, Lucknow",
        incident_or_bill_date="2025-06-15",
        diagnosis_or_event="Acute Gastroenteritis",
        itemized_charges=[
            ItemizedCharge(item_name="Consultation", amount_inr=500.0, is_covered=True),
            ItemizedCharge(item_name="IV Fluids", amount_inr=2200.0, is_covered=True),
            ItemizedCharge(item_name="Antibiotics", amount_inr=4650.0, is_covered=True),
            ItemizedCharge(
                item_name="Multivitamin Tonic",
                amount_inr=450.0,
                is_covered=False,
                exclusion_reason="Dietary supplement disallowed",
            ),
        ],
        total_amount_inr=7800.0,
        legibility_score=0.72,
    )

    res = validate_claim(ext, policy, user_metadata={"age": 28, "uploaded_doc_types": ["clinic_opd_bill"]})
    checks = res["rule_checks"]
    assert len(checks) >= 5

    # Check that every rule check has status in PASS, WARNING, FAIL
    for c in checks:
        assert isinstance(c, RuleCheckResult)
        assert c.status in ("PASS", "WARNING", "FAIL")
        assert len(c.explanation) > 0
        # If WARNING or FAIL, should have an actionable or clear reason
        if c.status in ("WARNING", "FAIL"):
            assert c.action_required is not None or c.explanation is not None

    # Verify exclusion check flags multivitamins
    excl_rule = next((c for c in checks if "EXCLUSION" in c.rule_id), None)
    assert excl_rule is not None
    assert excl_rule.status == "WARNING"
    assert "450" in excl_rule.explanation

    # Verify coverage cap check
    cap_rule = next((c for c in checks if "COVERAGE_CAP" in c.rule_id), None)
    assert cap_rule is not None
    assert cap_rule.status == "WARNING"
    assert "5,000" in cap_rule.explanation
