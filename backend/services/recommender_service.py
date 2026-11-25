"""Recommender service for ranking micro-insurance policies based on applicant profile."""

import logging
from typing import Any, Dict, List, Optional, Tuple

from models import PolicyRecommendation, PolicySummaryDetails, RecommendRequest, RecommendResponse
from services.policy_service import get_all_policies

logger = logging.getLogger("surakshasetu.recommender_service")


def _is_age_eligible(age: int, min_age: int, max_age: int) -> Tuple[bool, str]:
    """Checks whether the applicant age is strictly within the allowable policy window."""
    if age < min_age:
        return False, f"Applicant age ({age}) is below minimum eligible age ({min_age})."
    if age > max_age:
        return False, f"Applicant age ({age}) exceeds maximum entry age limit ({max_age})."
    return True, f"Age {age} is within eligible range ({min_age}–{max_age} years)."


def _evaluate_risk_match(primary_risk: str, policy: Dict[str, Any]) -> Tuple[float, List[str]]:
    """Calculates risk alignment score (0 to 35 points) based on primary risk keywords."""
    risk_query = primary_risk.lower().replace("+", " ").replace("&", " ").replace(",", " ")
    tokens = set(risk_query.split())

    policy_id = policy.get("id", "").lower()
    category = policy.get("category", "").lower()
    highlights = " ".join(policy.get("covered_highlights", [])).lower()

    score = 0.0
    reasons: List[str] = []

    # Risk mapping groups
    has_medical = any(t in tokens for t in ["medical", "health", "hospital", "clinic", "opd", "doctor", "illness"])
    has_accident = any(t in tokens for t in ["accident", "accidental", "disability", "trauma", "injury", "fracture"])
    has_life = any(t in tokens for t in ["life", "death", "family", "survivor", "term"])
    has_crop = any(t in tokens for t in ["crop", "agriculture", "farmer", "farming", "weather", "harvest", "drought", "flood"])

    # Scheme-specific matching
    if policy_id == "micro_health_gig":
        if has_medical:
            score += 25.0
            reasons.append("Covers OPD clinic consultations, acute medications, and doctor visits.")
        if has_accident:
            score += 10.0
            reasons.append("Day-one coverage for road traffic accident trauma and wound suturing.")
        elif not has_medical and not has_accident:
            score += 5.0

    elif policy_id == "pmsby":
        if has_accident:
            score += 35.0
            reasons.append("Full ₹2,00,000 accidental death & permanent disability coverage.")
        elif has_life:
            score += 12.0
            reasons.append("Covers accidental death benefit of ₹2,00,000 for surviving family.")
        elif has_medical:
            # Note: PMSBY does NOT cover routine medical
            score += 5.0
        else:
            score += 8.0

    elif policy_id == "pmjjby":
        if has_life:
            score += 35.0
            reasons.append("Provides ₹2,00,000 pure term life cover for any cause of death.")
        elif has_accident:
            score += 12.0
            reasons.append("Covers death resulting from accidents as part of all-cause life cover.")
        else:
            score += 8.0

    elif policy_id == "ab_pmjay":
        if has_medical:
            score += 30.0
            reasons.append("Offers ₹5,00,000 cashless inpatient hospitalization and tertiary healthcare.")
        else:
            score += 10.0

    elif policy_id == "pmfby":
        if has_crop:
            score += 35.0
            reasons.append("Protects against crop damage from localized weather disasters and pest attacks.")
        else:
            score = 0.0  # PMFBY is strictly for crops

    # Fallback keyword match in highlights
    if score == 0.0:
        for t in tokens:
            if t in category or t in highlights:
                score += 10.0
                reasons.append(f"Matches requested protection area: {t}.")
                break

    return min(score, 35.0), reasons


def _evaluate_occupation_fit(occupation: str, age: int, policy: Dict[str, Any]) -> Tuple[float, List[str]]:
    """Evaluates occupation fit (0 to 25 points)."""
    occ = occupation.lower().replace("-", " ").replace("_", " ")
    policy_id = policy.get("id", "").lower()
    target_occs = [t.lower() for t in policy.get("target_occupations", [])]

    score = 10.0  # Base score for general citizens
    reasons: List[str] = []

    # Gig workers (delivery partners, drivers, etc.)
    is_gig = any(k in occ for k in ["gig", "delivery", "zomato", "swiggy", "driver", "courier", "rider", "uber", "ola", "zepto", "blinkit"])
    is_farmer = any(k in occ for k in ["farmer", "kisan", "cultivator", "agriculture", "sharecropper"])
    is_daily_wage = any(k in occ for k in ["daily wage", "labor", "labour", "domestic", "vendor", "construction", "artisan"])
    is_senior = age >= 60 or "senior" in occ

    if is_gig:
        if policy_id == "micro_health_gig":
            score = 25.0
            reasons.append("Tailored specifically for platform delivery executives and gig riders.")
        elif policy_id in ("pmsby", "pmjjby"):
            score = 20.0
            reasons.append("Ideal safety net for informal and platform gig economy earners.")
        elif policy_id == "ab_pmjay":
            score = 12.0
        elif policy_id == "pmfby":
            score = 0.0  # Irrelevant for gig workers

    elif is_farmer:
        if policy_id == "pmfby":
            score = 25.0
            reasons.append("Official national crop protection scheme designed for agricultural cultivators.")
        elif policy_id in ("pmsby", "pmjjby"):
            score = 20.0
            reasons.append("Provides vital accident and life security for rural farming households.")
        elif policy_id == "ab_pmjay":
            score = 18.0
        elif policy_id == "micro_health_gig":
            score = 8.0

    elif is_daily_wage:
        if policy_id in ("pmsby", "ab_pmjay"):
            score = 25.0
            reasons.append("Government social security scheme tailored for unorganized daily-wage workers.")
        elif policy_id == "pmjjby":
            score = 20.0
            reasons.append("Affordable term life insurance for informal labor families.")
        elif policy_id == "micro_health_gig":
            score = 12.0
        elif policy_id == "pmfby":
            score = 0.0

    elif is_senior:
        if policy_id == "ab_pmjay":
            score = 25.0
            if age >= 70:
                reasons.append("Universal senior citizen entitlement: Dedicated ₹5,00,000 top-up cover for age 70+.")
            else:
                reasons.append("Comprehensive inpatient hospital assurance for senior healthcare needs.")
        elif policy_id == "pmsby" and age <= 70:
            score = 18.0
            reasons.append("Accident safety coverage available up to age 70.")
        elif policy_id == "pmjjby":
            score = 0.0  # Senior outside entry age 50
        else:
            score = 10.0

    else:
        # Check direct target occupations
        for target in target_occs:
            if any(word in target for word in occ.split()):
                score = 22.0
                reasons.append(f"Explicitly covers {occupation} under eligible occupation criteria.")
                break

    return score, reasons


def _evaluate_affordability(
    annual_premium: float,
    max_budget: float,
    has_bank_account: bool,
    policy: Dict[str, Any]
) -> Tuple[float, bool, List[str]]:
    """
    Evaluates premium affordability (0 to 15 points) and bank account feasibility.
    Returns (score, is_affordable, reasons).
    """
    reasons: List[str] = []
    policy_id = policy.get("id", "").lower()

    # Budget check
    if annual_premium > max_budget:
        return 0.0, False, [f"Annual premium (₹{annual_premium:,.0f}) exceeds your budget of ₹{max_budget:,.0f}."]

    # Bank account requirement check
    requires_bank = policy_id in ("pmsby", "pmjjby")
    if requires_bank and not has_bank_account:
        return 2.0, True, ["Requires opening an active savings bank account for automated annual premium debit."]

    score = 15.0
    if annual_premium == 0:
        reasons.append("100% government subsidized (₹0 annual premium).")
    elif annual_premium <= (max_budget * 0.3):
        reasons.append(f"Extremely affordable at just ₹{annual_premium:,.0f}/year, using under 30% of your budget.")
    else:
        reasons.append(f"Comfortably within your stated budget at ₹{annual_premium:,.0f}/year.")

    return score, True, reasons


def score_policy(req: RecommendRequest, policy: Dict[str, Any]) -> Tuple[float, List[str]]:
    """
    Evaluates and scores a single policy from 0 to 100 based on:
    1. Exact Age Eligibility (25 pts or Disqualification)
    2. Risk Match (35 pts)
    3. Occupation Fit (25 pts)
    4. Affordability & Banking (15 pts)
    """
    min_age = policy.get("min_age", 0)
    max_age = policy.get("max_age", 100)
    annual_premium = float(policy.get("annual_premium_inr", 0))

    # 1. Age Eligibility Gate
    age_ok, age_msg = _is_age_eligible(req.age, min_age, max_age)
    if not age_ok:
        # Disqualify policy outside age window
        return 0.0, [age_msg]

    age_score = 25.0

    # 2. Risk Match
    risk_score, risk_reasons = _evaluate_risk_match(req.primary_risk, policy)

    # 3. Occupation Fit
    occ_score, occ_reasons = _evaluate_occupation_fit(req.occupation, req.age, policy)
    if occ_score == 0.0:
        # Irrelevant occupation (e.g. gig worker for crop insurance)
        return 0.0, [f"Not applicable for {req.occupation} livelihood."]

    # 4. Affordability & Bank Account
    afford_score, afford_ok, afford_reasons = _evaluate_affordability(
        annual_premium, req.max_annual_budget_inr, req.has_bank_account, policy
    )
    if not afford_ok:
        return 0.0, afford_reasons

    # Calculate aggregate score
    total_score = age_score + risk_score + occ_score + afford_score
    total_score = max(0.0, min(100.0, round(total_score, 1)))

    # Synthesize 2-3 concise, high-value reasons
    combined_reasons = []
    if risk_reasons:
        combined_reasons.append(risk_reasons[0])
    if occ_reasons:
        combined_reasons.append(occ_reasons[0])
    if afford_reasons:
        combined_reasons.append(afford_reasons[0])

    if not combined_reasons:
        combined_reasons.append(policy.get("plain_summary", "Matches applicant eligibility criteria."))

    return total_score, combined_reasons[:3]


def get_recommendations(req: RecommendRequest, top_k: int = 3) -> RecommendResponse:
    """
    Evaluates all micro-insurance policies, sorts by highest score,
    and returns the top recommendations.
    """
    policies = get_all_policies()
    scored_candidates: List[PolicyRecommendation] = []

    for policy in policies:
        score, reasons = score_policy(req, policy)
        if score <= 0.0:
            continue

        details = PolicySummaryDetails(
            id=policy["id"],
            name=policy["name"],
            short_code=policy["short_code"],
            category=policy["category"],
            annual_premium_inr=float(policy.get("annual_premium_inr", 0)),
            max_claim_inr=float(policy.get("max_claim_inr", 0)),
            waiting_period_days=int(policy.get("waiting_period_days", 0)),
            is_government_scheme=bool(policy.get("is_government_scheme", False)),
            plain_summary=policy.get("plain_summary", ""),
        )

        # Include exact required_docs buyers must keep safe for future claims
        checklist = policy.get("required_docs", [])

        recommendation = PolicyRecommendation(
            policy_id=policy["id"],
            policy_name=policy["name"],
            policy_details=details,
            match_score=score,
            match_reasons=reasons,
            estimated_premium_inr=float(policy.get("annual_premium_inr", 0)),
            claim_readiness_checklist=checklist,
        )
        scored_candidates.append(recommendation)

    # Sort highest score first; tie-break with lower premium
    scored_candidates.sort(
        key=lambda item: (item.match_score, -item.estimated_premium_inr),
        reverse=True
    )

    top_recs = scored_candidates[:top_k]
    top_id = top_recs[0].policy_id if top_recs else None

    return RecommendResponse(
        recommendations=top_recs,
        total_evaluated=len(policies),
        top_recommendation_id=top_id,
    )
