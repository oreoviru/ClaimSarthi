"""Premium calculation engine for Indian micro-insurance schemes."""

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("surakshasetu.premium_calculator")

# Pro-rata premium slabs for PMJJBY (June 1st to May 31st policy year)
PMJJBY_SLABS = {
    # June, July, August
    (6, 7, 8): {"quarter": "June - August", "premium": 436.0, "months_covered": 12},
    # September, October, November
    (9, 10, 11): {"quarter": "September - November", "premium": 342.0, "months_covered": 9},
    # December, January, February
    (12, 1, 2): {"quarter": "December - February", "premium": 228.0, "months_covered": 6},
    # March, April, May
    (3, 4, 5): {"quarter": "March - May", "premium": 114.0, "months_covered": 3},
}

# Farmer premium caps for PMFBY
PMFBY_SEASON_RATES = {
    "kharif": {
        "rate_pct": 2.0,
        "crops_example": "Paddy, Bajra, Maize, Cotton, Soybean",
        "description": "Kharif food grains and oilseeds"
    },
    "rabi": {
        "rate_pct": 1.5,
        "crops_example": "Wheat, Mustard, Barley, Gram, Pulses",
        "description": "Rabi food grains and oilseeds"
    },
    "commercial": {
        "rate_pct": 5.0,
        "crops_example": "Sugarcane, Cotton, Potato, Ginger, Fruits",
        "description": "Annual commercial and horticultural crops"
    },
    "horticultural": {
        "rate_pct": 5.0,
        "crops_example": "Fruits, Vegetables, Spices",
        "description": "Annual commercial and horticultural crops"
    }
}


def calculate_pmjjby_premium(enrolment_month: int = 6) -> Dict[str, Any]:
    """
    Computes official quarterly pro-rata premium for PMJJBY based on enrolment month (1-12).
    June-Aug: ₹436, Sep-Nov: ₹342, Dec-Feb: ₹228, Mar-May: ₹114.
    """
    if not (1 <= enrolment_month <= 12):
        raise ValueError(f"Enrolment month must be between 1 and 12, got {enrolment_month}")

    selected_slab = None
    for months, slab_info in PMJJBY_SLABS.items():
        if enrolment_month in months:
            selected_slab = slab_info
            break

    if not selected_slab:
        selected_slab = {"quarter": "June - August", "premium": 436.0, "months_covered": 12}

    payable = selected_slab["premium"]
    quarter = selected_slab["quarter"]
    months_covered = selected_slab["months_covered"]

    month_names = [
        "", "January", "February", "March", "April", "May",
        "June", "July", "August", "September", "October", "November", "December"
    ]
    month_str = month_names[enrolment_month]

    breakdown_text = (
        f"Enrolling in {month_str} falls into the {quarter} pro-rata slab. "
        f"You pay ₹{payable:,.0f} for {months_covered} months of coverage until May 31st. "
        f"Upon annual renewal on June 1st, standard ₹436/year applies."
    )

    return {
        "policy_id": "pmjjby",
        "policy_name": "Pradhan Mantri Jeevan Jyoti Bima Yojana",
        "payable_premium_inr": payable,
        "monthly_equivalent_inr": round(payable / months_covered, 2),
        "annual_equivalent_inr": 436.0,
        "breakdown_text": breakdown_text,
        "details": {
            "enrolment_month": enrolment_month,
            "enrolment_month_name": month_str,
            "slab_quarter": quarter,
            "months_covered": months_covered,
            "renewal_date": "June 1st",
            "annual_renewal_rate_inr": 436.0
        }
    }


def calculate_pmfby_premium(
    crop_season: str = "rabi",
    sum_insured_inr: float = 50000.0,
    hectares: float = 1.0
) -> Dict[str, Any]:
    """
    Computes farmer premium share under PMFBY.
    Kharif: 2.0%, Rabi: 1.5%, Commercial/Horticultural: 5.0%.
    """
    season_clean = crop_season.strip().lower()
    if season_clean not in PMFBY_SEASON_RATES:
        # Default to rabi if unknown
        season_clean = "rabi"

    rate_info = PMFBY_SEASON_RATES[season_clean]
    rate_pct = rate_info["rate_pct"]

    total_sum_insured = sum_insured_inr * max(hectares, 0.1)
    farmer_share = round((total_sum_insured * rate_pct) / 100.0, 2)

    # Indicative actuarial rate is typically ~12% in India
    indicative_actuarial_pct = 12.0
    actuarial_premium = (total_sum_insured * indicative_actuarial_pct) / 100.0
    estimated_gov_subsidy = max(0.0, actuarial_premium - farmer_share)

    breakdown_text = (
        f"For {rate_info['description']} ({rate_info['crops_example']}), farmer share is capped at "
        f"{rate_pct}% of the sum insured. On ₹{total_sum_insured:,.0f} sum insured ({hectares:.1f} ha), "
        f"your payable premium is ₹{farmer_share:,.0f}. The remaining estimated subsidy of "
        f"₹{estimated_gov_subsidy:,.0f} (~{(indicative_actuarial_pct - rate_pct):.1f}%) is co-funded 50:50 by Central and State Governments."
    )

    return {
        "policy_id": "pmfby",
        "policy_name": "Pradhan Mantri Fasal Bima Yojana",
        "payable_premium_inr": farmer_share,
        "monthly_equivalent_inr": round(farmer_share / 12.0, 2),
        "annual_equivalent_inr": farmer_share,
        "breakdown_text": breakdown_text,
        "details": {
            "crop_season": season_clean,
            "season_description": rate_info["description"],
            "farmer_cap_percentage": rate_pct,
            "sum_insured_per_ha_inr": sum_insured_inr,
            "hectares": hectares,
            "total_sum_insured_inr": total_sum_insured,
            "estimated_government_subsidy_inr": estimated_gov_subsidy,
            "helpline": "14447"
        }
    }


def calculate_pmsby_premium() -> Dict[str, Any]:
    """Returns fixed annual and monthly equivalent for PMSBY (₹20/year)."""
    return {
        "policy_id": "pmsby",
        "policy_name": "Pradhan Mantri Suraksha Bima Yojana",
        "payable_premium_inr": 20.0,
        "monthly_equivalent_inr": round(20.0 / 12.0, 2),
        "annual_equivalent_inr": 20.0,
        "breakdown_text": (
            "Affordable flat annual premium of ₹20 auto-debited in a single installment from your savings "
            "bank account in May/June (equivalent to just ₹1.67/month) for ₹2,00,000 accidental death & disability protection."
        ),
        "details": {
            "payment_mode": "Auto-debit from savings bank account",
            "coverage_period": "June 1 to May 31",
            "per_month_equivalent_inr": 1.67
        }
    }


def calculate_ab_pmjay_premium() -> Dict[str, Any]:
    """Returns ₹0 premium details for AB-PMJAY."""
    return {
        "policy_id": "ab_pmjay",
        "policy_name": "Ayushman Bharat Pradhan Mantri Jan Arogya Yojana",
        "payable_premium_inr": 0.0,
        "monthly_equivalent_inr": 0.0,
        "annual_equivalent_inr": 0.0,
        "breakdown_text": (
            "₹0 premium. 100% fully funded by Central and State Governments for eligible households and "
            "senior citizens aged 70+, offering ₹5,00,000 cashless annual secondary and tertiary hospital care."
        ),
        "details": {
            "beneficiary_contribution": 0.0,
            "government_subsidy": "100%",
            "annual_family_cover_inr": 500000.0,
            "senior_topup_inr": 500000.0
        }
    }


def calculate_micro_health_gig_premium(billing_cycle: str = "monthly") -> Dict[str, Any]:
    """Returns exact monthly and annual subscription metrics for Gig-Worker Micro-Health."""
    is_annual = billing_cycle.lower() in ("annual", "yearly")
    payable = 588.0 if is_annual else 49.0
    breakdown_text = (
        "Flexible micro-subscription of ₹49/month (₹588 annual equivalent) providing up to ₹5,000 per claim "
        "and ₹10,000 annual aggregate coverage for outpatient clinic visits, prescription medicines, and day-care minor trauma."
    )
    return {
        "policy_id": "micro_health_gig",
        "policy_name": "Gig-Worker Micro-Health Clinic Shield",
        "payable_premium_inr": payable,
        "monthly_equivalent_inr": 49.0,
        "annual_equivalent_inr": 588.0,
        "breakdown_text": breakdown_text,
        "details": {
            "monthly_rate_inr": 49.0,
            "annual_rate_inr": 588.0,
            "per_claim_cap_inr": 5000.0,
            "annual_cap_inr": 10000.0,
            "waiting_period_days": 15
        }
    }


def calculate_premium(
    policy_id: str,
    enrolment_month: Optional[int] = None,
    crop_season: Optional[str] = None,
    sum_insured_inr: Optional[float] = 50000.0,
    hectares: Optional[float] = 1.0,
    billing_cycle: Optional[str] = "monthly"
) -> Dict[str, Any]:
    """Unified calculator dispatcher routing to the scheme-specific calculation formula."""
    pid = policy_id.strip().lower()

    if pid == "pmjjby":
        month = enrolment_month if enrolment_month and (1 <= enrolment_month <= 12) else 6
        return calculate_pmjjby_premium(enrolment_month=month)

    elif pid == "pmfby":
        season = crop_season or "rabi"
        si = sum_insured_inr if (sum_insured_inr and sum_insured_inr > 0) else 50000.0
        ha = hectares if (hectares and hectares > 0) else 1.0
        return calculate_pmfby_premium(crop_season=season, sum_insured_inr=si, hectares=ha)

    elif pid == "pmsby":
        return calculate_pmsby_premium()

    elif pid == "ab_pmjay":
        return calculate_ab_pmjay_premium()

    elif pid == "micro_health_gig":
        cycle = billing_cycle or "monthly"
        return calculate_micro_health_gig_premium(billing_cycle=cycle)

    else:
        raise ValueError(
            f"Unsupported policy_id '{policy_id}'. Supported: pmjjby, pmfby, pmsby, ab_pmjay, micro_health_gig"
        )
