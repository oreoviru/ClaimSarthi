/**
 * SurakshaSetu — Recommender Engine Client Module
 * Renders recommended policy results as clean, scannable cards (1 col mobile, 2-3 cols desktop).
 * Displays Scheme Name, Gov/Commercial tag, Match Score, Annual Cost & Maximum Cover,
 * 2 green checkmarks for What Is Covered, 2 amber warnings for Not Covered / Key Traps,
 * collapsible Documents Needed Later strip, and embedded inline calculators for PMJJBY & PMFBY.
 */

import { state, setSelectedPolicyId, setWizardStep, updateClaimDraft } from './state.js';
import { recommendPolicies, calculatePremium, showToast } from './api.js';
import { t, applyTranslations } from './i18n.js';
import { switchView } from './main.js';

// Policy Code Mapping for Confirmation Toasts
export const SCHEME_TOAST_CODES = {
  pmsby: 'PMSBY',
  pmjjby: 'PMJJBY',
  pmfby: 'PMFBY',
  ab_pmjay: 'AB-PMJAY',
  micro_health_gig: 'Micro-Health',
};

// Scheme Display & Verification Metadata
export const SCHEME_METADATA = {
  pmsby: {
    code: 'PMSBY',
    name: 'Pradhan Mantri Suraksha Bima Yojana',
    summary: '₹2,00,000 accidental death & disability protection. Strict exclusion: natural illness & routine medical bills.',
  },
  pmjjby: {
    code: 'PMJJBY',
    name: 'Pradhan Mantri Jeevan Jyoti Bima Yojana',
    summary: '₹2,00,000 life insurance for any cause of death. Strict 30-day initial lien period and age 18-50 eligibility.',
  },
  pmfby: {
    code: 'PMFBY',
    name: 'Pradhan Mantri Fasal Bima Yojana',
    summary: 'Comprehensive crop insurance against natural calamities. Mandatory 72-hour casualty intimation and RoR land record.',
  },
  ab_pmjay: {
    code: 'AB-PMJAY',
    name: 'Ayushman Bharat PM-JAY',
    summary: '₹5,00,000 cashless secondary and tertiary hospitalisation assurance per family. Standalone OPD consultations excluded.',
  },
  micro_health_gig: {
    code: 'Micro-Health',
    name: 'Gig-Worker Micro-Health Clinic Shield',
    summary: 'OPD clinic visits and acute medications up to ₹5,000 per claim. Strictly excludes multivitamins, supplements, and cosmetics.',
  },
};

/**
 * Highlight and update the Active Policy Banner in the Claim View
 * @param {string} policyId
 * @param {string} [policyName]
 * @param {string} [policyCode]
 * @param {string} [policySummary]
 */
export function highlightActivePolicyBanner(policyId, policyName, policyCode, policySummary) {
  const banner = document.getElementById('claim-active-policy-banner');
  if (!banner) return;

  const key = (policyId || '').toLowerCase();
  const meta = SCHEME_METADATA[key] || {};
  const code = policyCode || meta.code || SCHEME_TOAST_CODES[key] || (policyId || '').toUpperCase();
  const name = policyName || meta.name || policyId;
  const summary = policySummary || meta.summary || '';

  const codeEl = document.getElementById('claim-active-code');
  const nameEl = document.getElementById('claim-active-name');
  const summaryEl = document.getElementById('claim-active-summary');

  if (codeEl) codeEl.textContent = code;
  if (nameEl) nameEl.textContent = name;
  if (summaryEl && summary) summaryEl.textContent = summary;

  banner.style.display = 'block';
  banner.classList.remove('highlight-pulse');
  // Trigger DOM reflow to restart CSS animation cleanly
  void banner.offsetWidth;
  banner.classList.add('highlight-pulse');

  setTimeout(() => {
    banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}

// Pre-defined Scheme Content: What Is Covered, Exclusions/Key Traps, and Required Documents
export const SCHEME_CONTENT = {
  pmsby: {
    covered: [
      '₹2,00,000 benefit payable upon accidental death',
      '₹2,00,000 for permanent total disability (loss of both eyes or limbs)',
    ],
    traps: [
      'Natural death due to illness, disease, or cardiac arrest is completely excluded',
      'Routine OPD clinic consultations, hospital beds, and medicines are not covered',
    ],
    docs: [
      'Accidental Death Certificate or Civil Surgeon Disability Certificate',
      'First Information Report (FIR) or Police Inquest Report',
      'Post-Mortem Examination (PME) report (for death claims)',
      'Aadhaar card copy of the insured and nominee',
      'Bank passbook copy showing ₹20 auto-debit deduction',
    ],
  },
  pmjjby: {
    covered: [
      '₹2,00,000 pure life insurance benefit payable upon death due to ANY cause',
      'Quarterly pro-rata premium slabs for mid-year joiners: ₹436, ₹342, ₹228, ₹114',
    ],
    traps: [
      'Initial 30-day lien period: non-accidental death in first 30 days is excluded',
      'Strict entry age limit (18–50 years); coverage terminates upon reaching age 55',
    ],
    docs: [
      'Official Death Certificate of policyholder',
      'Claim form and discharge receipt signed by nominee',
      'Aadhaar card copy of subscriber and claimant nominee',
      'Nominee bank passbook copy or cancelled cheque for DBT transfer',
      'Proof of annual auto-debit deduction from savings bank account',
    ],
  },
  pmfby: {
    covered: [
      'Farmer share strictly capped: 1.5% (Rabi), 2.0% (Kharif), 5.0% (Commercial)',
      'Covers prevented sowing, mid-season adversity, hailstorm, flood, pest loss',
    ],
    traps: [
      'Localized crop loss must be formally reported within 72 hours of occurrence',
      'Damage post-harvest caused by theft, arson, or cattle grazing is excluded',
    ],
    docs: [
      '72-hour localized casualty intimation receipt',
      'Land Record (Record of Rights / 7/12 extract / Patta / Land possession)',
      'Sowing Certificate / Crop Declaration verified by Patwari / VAO',
      'Geo-tagged crop damage / inundation field photographs',
      'Bank passbook copy linked to Aadhaar showing premium deduction',
    ],
  },
  ab_pmjay: {
    covered: [
      '₹5,00,000 cashless annual healthcare assurance per family for secondary & tertiary care',
      'Day-one coverage for pre-existing medical conditions with zero waiting period',
    ],
    traps: [
      'Standalone outpatient (OPD) clinic consultations and retail medicines excluded',
      'Must be treated at an empanelled government or private network hospital',
    ],
    docs: [
      'Ayushman Bharat PM-JAY e-Card or ABHA Health Account ID',
      'Aadhaar card of patient / beneficiary',
      'Ration card or government family identification proof',
      'Hospital IPD admission slip and treatment pre-authorization',
      'Discharge summary with diagnostic reports and pharmacy logs',
    ],
  },
  micro_health_gig: {
    covered: [
      'Designed specifically for gig workers: daycare clinic visits, consultations & meds',
      'Flexible micro-subscription: ₹49/month with up to ₹5,000 per claim',
    ],
    traps: [
      'Dietary supplements, multivitamins, and cosmetics are strictly excluded',
      '₹5,00,0 single-claim ceiling and ₹10,000 annual aggregate limit apply',
    ],
    docs: [
      'Active delivery partner / driver platform profile screenshot',
      'Consultation prescription from a licensed doctor (MBBS/MD)',
      'Itemized clinic invoice with clinic stamp / doctor signature',
      'Itemized pharmacy receipt matching doctor prescription',
      'Aadhaar card and UPI ID / Bank account details for fast payout',
    ],
  },
};

/**
 * Render policy recommendation cards into results container
 * @param {Array<any>} recommendations
 * @param {HTMLElement} container
 */
export function renderRecommendations(recommendations, container) {
  if (!container) return;

  if (!recommendations || recommendations.length === 0) {
    container.innerHTML = `
      <div class="card placeholder-card" style="margin-top: 1.5rem;">
        <div class="placeholder-icon">🔍</div>
        <h3>No Direct Scheme Matches Found</h3>
        <p>Try adjusting your annual budget preference or selecting another protection priority to view eligible coverage options.</p>
      </div>
    `;
    return;
  }

  const cardsHtml = recommendations.map((rec, index) => {
    const isTop = index === 0;
    const policyId = (rec.policy_id || '').toLowerCase();
    const details = rec.policy_details || {};
    const content = SCHEME_CONTENT[policyId] || {
      covered: [
        'Statutory benefits matching specified scheme terms',
        'Standard social-security financial protection',
      ],
      traps: [
        'Claims filed without primary mandatory documents are rejected',
        'Submitting claims beyond policy coverage ceiling is disallowed',
      ],
      docs: rec.claim_readiness_checklist || ['Proof of identity', 'Primary loss proof'],
    };

    const isGovt = details.is_government_scheme !== undefined ? details.is_government_scheme : true;
    const govCommTag = isGovt ? 'Government Scheme' : 'Commercial';

    // Annual cost & Max cover display
    let initialCostDisplay = '₹0';
    if (policyId === 'pmsby') {
      initialCostDisplay = '₹20/year';
    } else if (policyId === 'pmjjby') {
      initialCostDisplay = '₹436/year';
    } else if (policyId === 'pmfby') {
      initialCostDisplay = '₹750/year (1.5% Rabi)';
    } else if (policyId === 'ab_pmjay') {
      initialCostDisplay = '₹0 (100% Free)';
    } else if (policyId === 'micro_health_gig') {
      initialCostDisplay = '₹588/year (₹49/mo)';
    } else if (details.annual_premium_inr > 0) {
      initialCostDisplay = `₹${Number(details.annual_premium_inr).toLocaleString('en-IN')}/year`;
    } else {
      initialCostDisplay = '₹0 (Free)';
    }

    const maxCoverDisplay = details.max_claim_inr
      ? `₹${Number(details.max_claim_inr).toLocaleString('en-IN')}`
      : '₹2,00,000';

    const scoreClass = rec.match_score >= 80 ? 'badge-pass' : rec.match_score >= 60 ? 'badge-warning' : 'badge-pending';

    // 2 concise green checkmarks
    const covered1 = content.covered[0] || 'Standard coverage benefits';
    const covered2 = content.covered[1] || 'Direct benefit transfer to bank account';

    // 2 concise amber warnings
    const trap1 = content.traps[0] || 'Excludes non-covered accidental or medical procedures';
    const trap2 = content.traps[1] || 'Late intimation or missing hospital bills lead to claim denial';

    // Collapsible docs
    const docsList = content.docs && content.docs.length > 0 ? content.docs : (rec.claim_readiness_checklist || []);

    // Embedded Calculator Markup
    let inlineCalculatorHtml = '';
    if (policyId === 'pmjjby') {
      inlineCalculatorHtml = `
        <div class="inline-calc-box pmjjby-calc-box" data-policy-id="pmjjby">
          <div class="calc-header">
            <span class="calc-icon">⚡</span>
            <span class="calc-title">PMJJBY Pro-Rata Premium Calculator</span>
          </div>
          <div class="form-group" style="margin-bottom: 0.5rem;">
            <label class="form-micro-label" for="pmjjby-month-select">Joining / Enrolment Month</label>
            <select class="form-select pmjjby-month-select" id="pmjjby-month-select" data-policy-id="pmjjby">
              <option value="6" selected>June (Annual Renewal - ₹436)</option>
              <option value="7">July (₹436)</option>
              <option value="8">August (₹436)</option>
              <option value="9">September (₹342)</option>
              <option value="10">October (₹342)</option>
              <option value="11">November (₹342)</option>
              <option value="12">December (₹228)</option>
              <option value="1">January (₹228)</option>
              <option value="2">February (₹228)</option>
              <option value="3">March (₹114)</option>
              <option value="4">April (₹114)</option>
              <option value="5">May (₹114)</option>
            </select>
          </div>
          <div class="calc-result-hint" id="pmjjby-calc-hint">
            Payable until May 31st: <strong id="pmjjby-payable-val">₹436</strong> (June – August slab)
          </div>
        </div>
      `;
    } else if (policyId === 'pmfby') {
      inlineCalculatorHtml = `
        <div class="inline-calc-box pmfby-calc-box" data-policy-id="pmfby">
          <div class="calc-header">
            <span class="calc-icon">⚡</span>
            <span class="calc-title">PMFBY Crop Share Calculator</span>
          </div>
          <div class="grid-2-col" style="gap: 0.5rem; margin-bottom: 0.5rem;">
            <div class="form-group">
              <label class="form-micro-label" for="pmfby-season-select">Crop Season</label>
              <select class="form-select pmfby-season-select" id="pmfby-season-select" data-policy-id="pmfby">
                <option value="rabi" selected>Rabi (1.5% Cap)</option>
                <option value="kharif">Kharif (2.0% Cap)</option>
                <option value="commercial">Commercial (5.0% Cap)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-micro-label" for="pmfby-si-input">Sum Insured (₹)</label>
              <input type="number" class="form-control pmfby-si-input" id="pmfby-si-input" value="50000" min="5000" step="5000" data-policy-id="pmfby">
            </div>
          </div>
          <div class="calc-result-hint" id="pmfby-calc-hint">
            Farmer Share: <strong id="pmfby-payable-val">₹750</strong> (Govt subsidy covers balance)
          </div>
        </div>
      `;
    }

    return `
      <article class="scheme-result-card ${isTop ? 'top-match-card' : ''}" data-policy-id="${policyId}" id="card-${policyId}">
        
        <!-- Header: Scheme Name + Government/Commercial Tag + Match Score -->
        <div class="scheme-card-header">
          <div class="scheme-title-group">
            ${isTop ? '<span class="top-match-badge" data-i18n="top_match_badge">★ #1 Top Match</span>' : ''}
            <div class="tags-row">
              <span class="badge ${isGovt ? 'badge-govt' : 'badge-comm'}">${govCommTag}</span>
              <span class="badge ${scoreClass} match-score-badge">${Math.round(rec.match_score)}% Match</span>
            </div>
            <h3 class="scheme-name">${rec.policy_name}</h3>
          </div>
        </div>

        <!-- Highlighted Cost & Maximum Cover Banner -->
        <div class="cost-benefit-banner">
          <div class="cost-item">
            <span class="highlight-label">Annual Cost</span>
            <span class="highlight-val cost-val" id="cost-val-${policyId}">${initialCostDisplay}</span>
          </div>
          <div class="cost-divider" aria-hidden="true"></div>
          <div class="cost-item">
            <span class="highlight-label">Maximum Cover</span>
            <span class="highlight-val benefit-val">${maxCoverDisplay}</span>
          </div>
        </div>

        <!-- 2 Concise Green Checkmarks: What Is Covered -->
        <div class="micro-section covered-section">
          <div class="section-micro-header">
            <span class="section-micro-title text-pass">✓ What Is Covered</span>
          </div>
          <ul class="micro-points-list covered-points">
            <li><span class="bullet-pass" aria-hidden="true">✓</span> <span>${covered1}</span></li>
            <li><span class="bullet-pass" aria-hidden="true">✓</span> <span>${covered2}</span></li>
          </ul>
        </div>

        <!-- 2 Concise Amber Warnings: Not Covered / Key Traps -->
        <div class="micro-section exclusions-section">
          <div class="section-micro-header">
            <span class="section-micro-title text-warning">⚠️ Not Covered / Key Traps</span>
          </div>
          <ul class="micro-points-list exclusion-points">
            <li><span class="bullet-warning" aria-hidden="true">⚠️</span> <span>${trap1}</span></li>
            <li><span class="bullet-warning" aria-hidden="true">⚠️</span> <span>${trap2}</span></li>
          </ul>
        </div>

        <!-- Embedded Inline Calculator for PMJJBY and PMFBY -->
        ${inlineCalculatorHtml}

        <!-- Collapsible Documents Needed Later for Claims Strip -->
        <details class="docs-collapsible">
          <summary class="docs-collapsible-summary">
            <span class="docs-summary-title">📋 Documents Needed Later for Claims</span>
            <span class="docs-count-pill">${docsList.length} proofs</span>
          </summary>
          <div class="docs-collapsible-body">
            <ul class="docs-bullets-list">
              ${docsList.map(doc => `<li>${doc.replace(/_/g, ' ')}</li>`).join('')}
            </ul>
          </div>
        </details>

        <!-- Card Action Footer -->
        <div class="scheme-card-footer">
          <button type="button" 
                  class="btn btn-primary btn-select-scheme btn-use-policy-claim" 
                  data-policy-id="${policyId}"
                  data-policy-name="${rec.policy_name || details.name || ''}"
                  data-policy-summary="${details.plain_summary || ''}">
            <span data-i18n="btn_use_policy_claim">Use This Policy to File a Claim</span>
          </button>
        </div>

      </article>
    `;
  }).join('');

  container.innerHTML = `
    <div class="results-header-banner">
      <h3 class="results-title" data-i18n="results_title">Top Matching Schemes For You</h3>
      <p class="results-subtitle" data-i18n="results_subtitle">Scored deterministically based on your age, risk priority, occupation, and budget.</p>
    </div>
    <div class="results-cards-grid">
      ${cardsHtml}
    </div>
  `;

  // Attach interactive listeners for PMJJBY & PMFBY inline calculators
  initInlineCalculators(container);

  // Attach click listener to "Use This Policy to File a Claim" buttons
  container.querySelectorAll('.btn-use-policy-claim, .btn-select-scheme').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const policyId = btn.getAttribute('data-policy-id');
      const policyName = btn.getAttribute('data-policy-name');
      const policySummary = btn.getAttribute('data-policy-summary');

      if (!policyId) return;

      // 1. Pre-fill user's age from recommender form into claim form
      const recAgeInput = document.getElementById('rec-age');
      const userAge = recAgeInput ? recAgeInput.value.trim() : '28';
      const claimAgeInput = document.getElementById('claim-claimant-age');
      if (claimAgeInput && userAge) {
        claimAgeInput.value = userAge;
      }
      const claimPolicyInput = document.getElementById('claim-policy-id');
      if (claimPolicyInput) {
        claimPolicyInput.value = policyId;
      }
      updateClaimDraft({ claimantDetails: { age: parseInt(userAge, 10) || 28 } });

      // 2. Set state.selectedPolicyId to that exact policy
      setSelectedPolicyId(policyId);

      // 3. Switch automatically to the File a Claim tab at Step 1
      setWizardStep(1);
      switchView('claim');

      // 4. Highlight the active policy banner
      const toastCode = SCHEME_TOAST_CODES[policyId.toLowerCase()] || policyId.toUpperCase();
      highlightActivePolicyBanner(policyId, policyName, toastCode, policySummary);

      // 5. Show confirmation toast
      showToast(`Activated ${toastCode} — ready to check your claim`, 'success');
    });
  });

  // Re-apply active translations to dynamically rendered elements
  applyTranslations(state.language);
}

/**
 * Initialize PMJJBY and PMFBY embedded inline calculators
 * @param {HTMLElement} container
 */
export function initInlineCalculators(container) {
  // 1. PMJJBY Enrolment Month Pro-Rata Calculator
  const pmjjbySelect = container.querySelector('.pmjjby-month-select');
  if (pmjjbySelect) {
    pmjjbySelect.addEventListener('change', async () => {
      const month = parseInt(pmjjbySelect.value, 10);
      try {
        const res = await calculatePremium({
          policy_id: 'pmjjby',
          enrolment_month: month,
        });

        const payable = res?.payable_premium_inr ?? 436.0;
        
        // Live update the displayed premium on the card
        const costValEl = container.querySelector('#cost-val-pmjjby');
        if (costValEl) {
          costValEl.textContent = `₹${payable}`;
        }

        const payableValEl = container.querySelector('#pmjjby-payable-val');
        if (payableValEl) {
          payableValEl.textContent = `₹${payable}`;
        }

        const hintEl = container.querySelector('#pmjjby-calc-hint');
        if (hintEl && res.breakdown_text) {
          hintEl.innerHTML = `Payable until May 31st: <strong id="pmjjby-payable-val">₹${payable}</strong> (${res.details?.slab_quarter || ''} slab)`;
        }
      } catch (err) {
        console.error('Failed to calculate PMJJBY pro-rata premium:', err);
      }
    });
  }

  // 2. PMFBY Crop Season & Sum Insured Calculator
  const pmfbySeasonSelect = container.querySelector('.pmfby-season-select');
  const pmfbySiInput = container.querySelector('.pmfby-si-input');

  const updatePmfby = async () => {
    const season = pmfbySeasonSelect ? pmfbySeasonSelect.value : 'rabi';
    const sumInsured = pmfbySiInput ? parseFloat(pmfbySiInput.value) || 50000.0 : 50000.0;

    try {
      const res = await calculatePremium({
        policy_id: 'pmfby',
        crop_season: season,
        sum_insured_inr: sumInsured,
      });

      const payable = res?.payable_premium_inr ?? 750.0;
      const ratePct = res?.details?.farmer_cap_percentage || (season === 'kharif' ? 2.0 : season === 'rabi' ? 1.5 : 5.0);

      const costValEl = container.querySelector('#cost-val-pmfby');
      if (costValEl) {
        costValEl.textContent = `₹${payable} (${ratePct}% ${season.toUpperCase()})`;
      }

      const payableValEl = container.querySelector('#pmfby-payable-val');
      if (payableValEl) {
        payableValEl.textContent = `₹${payable}`;
      }

      const hintEl = container.querySelector('#pmfby-calc-hint');
      if (hintEl) {
        hintEl.innerHTML = `Farmer Share: <strong id="pmfby-payable-val">₹${payable}</strong> (${ratePct}% of ₹${Number(sumInsured).toLocaleString('en-IN')})`;
      }
    } catch (err) {
      console.error('Failed to calculate PMFBY crop premium:', err);
    }
  };

  if (pmfbySeasonSelect) pmfbySeasonSelect.addEventListener('change', updatePmfby);
  if (pmfbySiInput) pmfbySiInput.addEventListener('input', updatePmfby);
}

/**
 * Initialize Recommender Intake Form Events and Logic
 */
export function initRecommender() {
  const form = document.getElementById('recommend-form');
  const resultsContainer = document.getElementById('recommend-results');
  if (!form || !resultsContainer) return;

  const ageInput = document.getElementById('rec-age');
  const budgetInput = document.getElementById('rec-budget');
  const occupationCards = form.querySelectorAll('.occupation-choice-card');
  const riskCards = form.querySelectorAll('.risk-choice-card');
  const budgetPresets = form.querySelectorAll('.budget-preset-btn');
  const submitBtn = document.getElementById('btn-find-cover');

  // 1. Occupation Card Click Handler
  occupationCards.forEach((card) => {
    card.addEventListener('click', () => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        occupationCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        // Smart preset defaults if age is untouched
        const val = radio.value;
        if (ageInput && (!ageInput.value || ageInput.value === '28')) {
          if (val === 'senior') ageInput.value = '72';
          else if (val === 'farmer') ageInput.value = '42';
          else if (val === 'daily_wage') ageInput.value = '35';
          else if (val === 'gig_delivery') ageInput.value = '28';
        }
      }
    });
  });

  // 2. Risk Card Click Handler
  riskCards.forEach((card) => {
    card.addEventListener('click', () => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        riskCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      }
    });
  });

  // 3. Budget Preset Buttons Click Handler
  budgetPresets.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const budgetVal = btn.getAttribute('data-budget');
      if (budgetInput && budgetVal !== null) {
        budgetInput.value = budgetVal;
        budgetPresets.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
    });
  });

  // 4. Form Submission Handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedOccRadio = form.querySelector('input[name="occupation"]:checked');
    const selectedRiskRadio = form.querySelector('input[name="primary_risk"]:checked');
    const bankCheckbox = document.getElementById('rec-bank-account');

    if (!selectedOccRadio) {
      showToast('Please select your occupation', 'warning');
      return;
    }
    if (!selectedRiskRadio) {
      showToast('Please select your primary protection priority', 'warning');
      return;
    }

    const age = parseInt(ageInput?.value || '28', 10);
    if (isNaN(age) || age < 1 || age > 120) {
      showToast('Please enter a valid age (18 to 100 years)', 'warning');
      ageInput?.focus();
      return;
    }

    const maxBudget = parseFloat(budgetInput?.value || '1000');
    const hasBankAccount = bankCheckbox ? bankCheckbox.checked : true;

    const payload = {
      occupation: selectedOccRadio.value,
      age: age,
      primary_risk: selectedRiskRadio.value,
      max_annual_budget_inr: maxBudget,
      has_bank_account: hasBankAccount,
    };

    // UI Loading State
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('loading');
      submitBtn.innerHTML = `
        <span class="spinner" aria-hidden="true"></span>
        <span>Matching Schemes...</span>
      `;
    }

    resultsContainer.innerHTML = `
      <div class="card placeholder-card" style="margin-top: 1.5rem;">
        <div class="spinner-large" aria-hidden="true"></div>
        <h3>Evaluating Indian Micro-Insurance Schemes...</h3>
        <p>Calculating age eligibility, risk alignment, pro-rated premiums, and banking requirements.</p>
      </div>
    `;

    try {
      const response = await recommendPolicies(payload);
      const recommendations = response?.recommendations || [];

      renderRecommendations(recommendations, resultsContainer);

      // Smoothly scroll to results
      setTimeout(() => {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      console.error('Recommendation failed:', err);
      resultsContainer.innerHTML = `
        <div class="card placeholder-card error-card" style="margin-top: 1.5rem;">
          <div class="placeholder-icon">⚠️</div>
          <h3>Unable to Load Recommendations</h3>
          <p>${err.message || 'Please check your connection and try again.'}</p>
        </div>
      `;
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitBtn.innerHTML = `<span data-i18n="btn_find_cover">${t('btn_find_cover', state.language)}</span>`;
      }
    }
  });
}
