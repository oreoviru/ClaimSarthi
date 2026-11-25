from services.premium_calculator import (
    calculate_pmjjby_premium,
    calculate_pmfby_premium,
    calculate_pmsby_premium,
    calculate_ab_pmjay_premium,
    calculate_micro_health_gig_premium,
    calculate_premium,
)


def test_pmjjby_october_pro_rata():
    """Verify: PMJJBY in October returns ₹342."""
    res = calculate_premium(policy_id="pmjjby", enrolment_month=10)
    assert res["payable_premium_inr"] == 342.0
    assert "September - November" in res["details"]["slab_quarter"]
    assert res["details"]["months_covered"] == 9


def test_pmfby_rabi_wheat():
    """Verify: PMFBY Rabi wheat on ₹50,000 sum insured returns ₹750 farmer share."""
    res = calculate_premium(
        policy_id="pmfby",
        crop_season="rabi",
        sum_insured_inr=50000.0,
        hectares=1.0,
    )
    assert res["payable_premium_inr"] == 750.0
    assert res["details"]["farmer_cap_percentage"] == 1.5
    assert res["details"]["estimated_government_subsidy_inr"] > 0


def test_other_schemes_metrics():
    """Verify exact annual and monthly metrics for PMSBY, AB-PMJAY, and Micro-Health."""
    pmsby = calculate_premium("pmsby")
    assert pmsby["payable_premium_inr"] == 20.0
    assert pmsby["monthly_equivalent_inr"] == 1.67

    ab = calculate_premium("ab_pmjay")
    assert ab["payable_premium_inr"] == 0.0

    gig_mo = calculate_premium("micro_health_gig", billing_cycle="monthly")
    assert gig_mo["payable_premium_inr"] == 49.0
    assert gig_mo["monthly_equivalent_inr"] == 49.0
    assert gig_mo["annual_equivalent_inr"] == 588.0
