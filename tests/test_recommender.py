from models import RecommendRequest
from services.recommender_service import get_recommendations


def test_gig_worker_recommendation():
    """Verify: 28yo gig worker requesting medical + accident under ₹700 receives micro_health_gig & pmsby at top."""
    req = RecommendRequest(
        occupation="gig_worker",
        age=28,
        primary_risk="medical + accident",
        max_annual_budget_inr=700,
        has_bank_account=True,
    )
    result = get_recommendations(req, top_k=3)

    assert len(result.recommendations) >= 2
    top_ids = [r.policy_id for r in result.recommendations[:2]]
    assert top_ids == ["micro_health_gig", "pmsby"]
    assert result.recommendations[0].match_score >= 90
    assert result.recommendations[1].match_score >= 85

    # Check that required_docs are present in the checklist
    assert len(result.recommendations[0].claim_readiness_checklist) > 0
    assert len(result.recommendations[1].claim_readiness_checklist) > 0


def test_age_55_disqualifies_pmjjby():
    """Verify age 55 is disqualified from PMJJBY (age range 18-50)."""
    req = RecommendRequest(
        occupation="small_shopkeeper",
        age=55,
        primary_risk="life",
        max_annual_budget_inr=1000,
        has_bank_account=True,
    )
    result = get_recommendations(req, top_k=5)
    assert not any(r.policy_id == "pmjjby" for r in result.recommendations)
