/**
 * SurakshaSetu — Guided 4-Step Claim Wizard Module
 * 1. Policy & Incident → 2. Scan Proof → 3. Verify & Fix → 4. Submit Packet.
 * 
 * Features:
 * - Crisp top progress stepper showing active vs. completed steps cleanly.
 * - Compact mobile stepper header for narrow mobile screens.
 * - Full backward navigation preserving all form inputs and uploaded previews.
 * - Validation barriers preventing skipping ahead until required inputs are ready.
 * - Dropzone image uploads with thumbnails & file removal.
 * - Instant judging demo scenario buttons.
 * - OCR extraction display, rule checks scorecard, Fix-It checklist, and live re-validation.
 * - Summary dossier review and persistent claim submission with receipt.
 */

import {
  state,
  subscribe,
  setWizardStep,
  updateClaimDraft,
  setSelectedPolicyId,
  setPolicies,
} from './state.js';

import {
  fetchPolicies,
  fetchSamples,
  analyzeClaim,
  analyzeSample,
  revalidateClaim,
  submitClaim,
  showToast,
} from './api.js';

import { t, applyTranslations } from './i18n.js';
import {
  highlightActivePolicyBanner,
  SCHEME_TOAST_CODES,
  SCHEME_METADATA,
} from './recommender.js';

import {
  initUploader,
  renderUploadSlots,
  loadDemoSample as uploaderLoadDemoSample,
  renderPreviews as uploaderRenderPreviews,
  validateStep2 as uploaderValidateStep2,
  attachFileToSlot,
  removeSlotFile,
  formatFileSize,
  POLICY_DOCUMENT_SLOTS,
} from './uploader.js';

import {
  initVerifyStep,
  renderVerifyStep,
  runRevalidation as verifyRunRevalidation,
  CONFIDENCE_THRESHOLD,
} from './verifyStep.js';

import {
  initSubmitStep,
  renderSubmitStep,
  submitClaimPackage,
  renderSuccessReceipt,
  SCHEME_COVERAGE_METADATA,
  openInInsurerQueue,
  renderInsurerQueue,
  resetClaimWizard as submitResetClaimWizard,
  formatSubmissionTimestamp,
} from './submitStep.js';

export {
  initUploader,
  renderUploadSlots,
  attachFileToSlot,
  removeSlotFile,
  formatFileSize,
  POLICY_DOCUMENT_SLOTS,
  initVerifyStep,
  renderVerifyStep,
  CONFIDENCE_THRESHOLD,
  initSubmitStep,
  renderSubmitStep,
  submitClaimPackage,
  renderSuccessReceipt,
  SCHEME_COVERAGE_METADATA,
  openInInsurerQueue,
  renderInsurerQueue,
  formatSubmissionTimestamp,
};

// 3 Realistic Pre-Bundled Indian Demo Scenarios for Instant Stage Judging
export const DEMO_SCENARIOS = {
  clean_clinic_bill: {
    id: 'clean_clinic_bill',
    title: 'Clean ₹2,450 Clinic Bill (Auto-Pass)',
    shortTitle: 'Clean Clinic Bill',
    policy_id: 'micro_health_gig',
    claimant_name: 'Ramesh Pawar',
    claimant_age: 28,
    policy_start_date: '2025-01-01',
    incident_date: '2026-11-19',
    incident_subtype: 'acute illness / enteric fever',
    primary_doc_type: 'clinic_opd_bill',
    secondary_doc_types: ['doctor_prescription'],
    sample_filename: 'clean_clinic_bill.jpg',
    sample_image_url: '/samples/clean_clinic_bill.jpg',
    claimed_amount_inr: 2450.0,
    badgeText: 'Auto-Pass',
    badgeClass: 'badge-pass',
    caseNum: '(1)',
    metaText: 'Gig Micro-Health • Full ₹2,450 Reimbursement',
    toastMessage: 'Clean Clinic Bill: 100% Readiness — ₹2,450 pre-approved for instant settlement!',
    toastType: 'success',
  },
  tricky_handwritten_bill: {
    id: 'tricky_handwritten_bill',
    title: 'Problematic ₹7,800 Handwritten Bill (Catch 3 Traps)',
    shortTitle: 'Problematic Bill',
    policy_id: 'micro_health_gig',
    claimant_name: 'Dinesh Kumar',
    claimant_age: 31,
    policy_start_date: '2025-01-01',
    incident_date: '2026-02-10',
    incident_subtype: 'acute illness / viral gastroenteritis',
    primary_doc_type: 'clinic_opd_bill',
    secondary_doc_types: [],
    sample_filename: 'tricky_handwritten_bill.jpg',
    sample_image_url: '/samples/tricky_handwritten_bill.jpg',
    claimed_amount_inr: 7800.0,
    badgeText: 'Catch 3 Traps',
    badgeClass: 'badge-warning',
    caseNum: '(2)',
    metaText: 'Exclusion scan + ₹5k cap + missing Rx',
    toastMessage: 'Problematic Bill: Caught 3 rejection traps (₹450 multivitamin exclusion, smudged date, missing prescription).',
    toastType: 'warning',
  },
  pmfby_hailstorm_crop: {
    id: 'pmfby_hailstorm_crop',
    title: 'PMFBY Crop Hailstorm Photo (Missing Land Proof)',
    shortTitle: 'PMFBY Crop Hailstorm',
    policy_id: 'pmfby',
    claimant_name: 'Suresh Chandra',
    claimant_age: 46,
    policy_start_date: '2025-10-15',
    incident_date: '2026-11-23',
    incident_subtype: 'hailstorm',
    primary_doc_type: 'crop_damage_photo',
    secondary_doc_types: [],
    sample_filename: 'pmfby_hailstorm_crop.jpg',
    sample_image_url: '/samples/pmfby_hailstorm_crop.jpg',
    claimed_amount_inr: 35000.0,
    badgeText: 'Missing Land Proof',
    badgeClass: 'badge-info',
    caseNum: '(3)',
    metaText: '72h notice PASS • Flags missing 7/12 RoR',
    toastMessage: 'PMFBY Hailstorm Photo: 72h notice validated — Missing 7/12 land record flagged to prevent rejection.',
    toastType: 'info',
  },
};

export function validateStep2() {
  return uploaderValidateStep2();
}

/**
 * Execute 1-click demo scenario for judges:
 * 1. Sets matching policy and claimant context
 * 2. Navigates to Step 3 with scanning transition
 * 3. Calls POST /api/analyze-sample/{sample_id}
 * 4. Lands on Step 3 with realistic data & sample image preview ready to inspect
 * @param {string} sampleId
 */
export async function runJudgeSampleDemo(sampleId) {
  const sample = (state.samples || []).find((s) => s.id === sampleId) || DEMO_SCENARIOS[sampleId];
  if (!sample) return;

  const targetPolicyId = sample.policy_id || 'micro_health_gig';
  const imageUrl = sample.sample_image_url || `/samples/${sample.sample_filename || sampleId + '.jpg'}`;

  // 1. Set matching policy and claimant context
  setSelectedPolicyId(targetPolicyId);
  highlightActivePolicyBanner(targetPolicyId);
  renderPolicyRequirements(targetPolicyId);

  // Sync Step 1 form fields
  const policySelect = document.getElementById('claim-policy-id');
  const nameInput = document.getElementById('claim-claimant-name');
  const ageInput = document.getElementById('claim-claimant-age');
  const policyStartInput = document.getElementById('claim-policy-start-date');
  const incidentDateInput = document.getElementById('claim-incident-date');
  const incidentSubtypeInput = document.getElementById('claim-incident-subtype');
  const primaryDocSelect = document.getElementById('claim-primary-doc-type');

  if (policySelect) policySelect.value = targetPolicyId;
  if (nameInput) nameInput.value = sample.claimant_name || 'Claimant';
  if (ageInput) ageInput.value = String(sample.claimant_age || 30);
  if (policyStartInput && sample.policy_start_date) policyStartInput.value = sample.policy_start_date;
  if (incidentDateInput && sample.incident_date) incidentDateInput.value = sample.incident_date;
  if (incidentSubtypeInput && sample.incident_subtype) incidentSubtypeInput.value = sample.incident_subtype;
  if (primaryDocSelect && sample.primary_doc_type) primaryDocSelect.value = sample.primary_doc_type;

  updateClaimDraft({
    claimantDetails: {
      name: sample.claimant_name,
      age: sample.claimant_age,
      policyStartDate: sample.policy_start_date,
      incidentDate: sample.incident_date,
      incidentSubtype: sample.incident_subtype,
    },
    selectedSampleId: sampleId,
    sampleImageUrl: imageUrl,
    primaryDocType: sample.primary_doc_type,
    secondaryDocTypes: sample.secondary_doc_types || [],
  });

  // Attach sample into Primary Proof slot in uploader
  const pConfig = POLICY_DOCUMENT_SLOTS[targetPolicyId] || POLICY_DOCUMENT_SLOTS.micro_health_gig;
  state.claimDraft.uploadedSlots = {
    [pConfig.primary.slotId]: {
      slotId: pConfig.primary.slotId,
      name: sample.sample_filename || `${sampleId}.jpg`,
      size: sampleId === 'clean_clinic_bill' ? 78051 : sampleId === 'tricky_handwritten_bill' ? 55338 : 99152,
      type: 'image/jpeg',
      dataUrl: imageUrl,
      file: null,
      docType: sample.primary_doc_type,
      isPrimary: true,
      isSample: true,
      sampleTitle: sample.title,
    },
  };
  renderUploadSlots(targetPolicyId);

  // 2. Display scanning transition and navigate directly to Step 3
  goToStep(3);

  // Animate multi-stage underwriting loading HUD
  startAnalysisLoadingAnimation();
  showToast(`Auditing ${sample.title} via Gemini OCR & policy rules...`, 'info', 2500);

  // 3. Call POST /api/analyze-sample/{sample_id}
  try {
    const res = await analyzeSample(sampleId);

    // 4. Update state with realistic data
    state.claimDraft.draftId = res.draft_id || res.claim_id;
    state.claimDraft.extractedData = res.extracted_data;
    state.claimDraft.ruleChecks = res.rule_checks || [];
    state.claimDraft.readinessScore = res.readiness_score || 0;
    state.claimDraft.readinessStatus = res.readiness_status || 'NEEDS_FIXES';
    state.claimDraft.estimatedPayoutInr =
      res.eligible_payout_inr !== undefined ? res.eligible_payout_inr : (res.estimated_payout_inr || 0);
    state.claimDraft.disallowedAmountInr = res.disallowed_amount_inr || 0;
    state.claimDraft.actionableChecklist = res.fix_it_checklist || res.actionable_checklist || [];

    // Complete loading stages smoothly to 100%
    await completeAnalysisLoadingAnimation();

    // Render realistic data and sample image preview in Step 3
    renderStep3Results(res, imageUrl);

    const cfg = DEMO_SCENARIOS[sampleId];
    if (cfg) {
      showToast(cfg.toastMessage, cfg.toastType, 3500);
    }
  } catch (err) {
    console.error('Failed to analyze sample scenario:', err);
    showAnalysisLoadingError(err);
    showToast(`Audit failed: ${err.message || 'Please retry'}`, 'error');
  }
}

/**
 * Load demo sample: synchronously configures context and initiates the 1-click audit
 * @param {string} sampleId
 */
export function loadDemoSample(sampleId) {
  const sample = (state.samples || []).find((s) => s.id === sampleId) || DEMO_SCENARIOS[sampleId];
  if (sample) {
    const targetPolicyId = sample.policy_id || 'micro_health_gig';
    const imageUrl = sample.sample_image_url || `/samples/${sample.sample_filename || sampleId + '.jpg'}`;
    state.claimDraft.selectedSampleId = sampleId;
    state.claimDraft.sampleImageUrl = imageUrl;
    setSelectedPolicyId(targetPolicyId);
    highlightActivePolicyBanner(targetPolicyId);
    renderPolicyRequirements(targetPolicyId);

    const policySelect = document.getElementById('claim-policy-id');
    const nameInput = document.getElementById('claim-claimant-name');
    const ageInput = document.getElementById('claim-claimant-age');
    const primaryDocSelect = document.getElementById('claim-primary-doc-type');

    if (policySelect) policySelect.value = targetPolicyId;
    if (nameInput) nameInput.value = sample.claimant_name || 'Claimant';
    if (ageInput) ageInput.value = String(sample.claimant_age || 30);
    if (primaryDocSelect) primaryDocSelect.value = sample.primary_doc_type || 'clinic_opd_bill';

    updateClaimDraft({
      claimantDetails: {
        name: sample.claimant_name,
        age: sample.claimant_age,
        policyStartDate: sample.policy_start_date,
        incidentDate: sample.incident_date,
        incidentSubtype: sample.incident_subtype,
      },
      selectedSampleId: sampleId,
      sampleImageUrl: imageUrl,
      primaryDocType: sample.primary_doc_type,
      secondaryDocTypes: sample.secondary_doc_types || [],
    });

    const pConfig = POLICY_DOCUMENT_SLOTS[targetPolicyId] || POLICY_DOCUMENT_SLOTS.micro_health_gig;
    state.claimDraft.uploadedSlots = {
      [pConfig.primary.slotId]: {
        slotId: pConfig.primary.slotId,
        name: sample.sample_filename || `${sampleId}.jpg`,
        size: sampleId === 'clean_clinic_bill' ? 78051 : sampleId === 'tricky_handwritten_bill' ? 55338 : 99152,
        type: 'image/jpeg',
        dataUrl: imageUrl,
        file: null,
        docType: sample.primary_doc_type,
        isPrimary: true,
        isSample: true,
        sampleTitle: sample.title,
      },
    };
    renderUploadSlots(targetPolicyId);
    renderPreviews();
  }

  // Also trigger full pipeline
  return runJudgeSampleDemo(sampleId);
}

export function renderPreviews() {
  return uploaderRenderPreviews();
}

/**
 * Initialize Quick Demo Cases (For Judges) Bar
 * Populated from GET /api/samples with 3 one-click buttons
 */
export async function initJudgesDemoBar() {
  const bar = document.getElementById('judges-demo-bar');
  if (!bar) return;

  // Attempt to fetch fresh samples from GET /api/samples
  try {
    if (!state.samples || state.samples.length === 0) {
      const apiSamples = await fetchSamples();
      if (Array.isArray(apiSamples) && apiSamples.length > 0) {
        state.samples = apiSamples;
      }
    }
  } catch (err) {
    console.warn('Using pre-bundled demo samples for judges bar:', err);
  }

  // Wire 3 one-click buttons
  bar.querySelectorAll('[data-sample-id]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const sampleId = btn.getAttribute('data-sample-id');
      if (sampleId) {
        await runJudgeSampleDemo(sampleId);
      }
    });
  });
}

// Scheme Requirements Data for "Before You Upload — What This Policy Requires"
export const POLICY_REQUIREMENTS_DATA = {
  micro_health_gig: {
    schemeName: 'Gig-Worker Micro-Health Clinic Shield',
    maxCapDisplay: '₹5,000 / claim (₹10,000 annual limit)',
    maxCapAmount: 5000,
    waitingPeriodDays: 15,
    waitingPeriodText: '15-day initial waiting period for medical sickness (road accident trauma covered from minute one).',
    coverageScope: 'Daycare outpatient consultations, clinic procedures, and doctor-prescribed acute illness medications.',
    mandatoryProofs: [
      'Doctor consultation prescription from licensed MBBS/MD practitioner',
      'Itemized clinic invoice with doctor stamp and authorized signature',
      'Itemized pharmacy receipt matching doctor prescription',
      'Active gig platform profile screenshot or courier ID card',
      'Bank account number & IFSC or UPI ID for direct 24h reimbursement',
    ],
    exclusionsWarning: 'Dietary supplements, multivitamins, tonics, protein powders, and cosmetic treatments are strictly non-reimbursable. Any single claim above ₹5,000 will be capped.',
  },
  pmsby: {
    schemeName: 'Pradhan Mantri Suraksha Bima Yojana (PMSBY)',
    maxCapDisplay: '₹2,00,000 Accidental Cover',
    maxCapAmount: 200000,
    waitingPeriodDays: 0,
    waitingPeriodText: '0 days — Immediate day-one coverage upon auto-debit.',
    coverageScope: '₹2,00,000 for accidental death or permanent total disability; ₹1,00,000 for permanent partial disability.',
    mandatoryProofs: [
      'Accidental Death Certificate or Civil Surgeon Disability Certificate',
      'First Information Report (FIR) or Police Inquest Panchnama report',
      'Post-Mortem Examination (PME) report (for death claims)',
      'Bank passbook copy showing ₹20 annual auto-debit deduction',
      'Aadhaar card copies of subscriber and nominee',
    ],
    exclusionsWarning: 'Natural death (illness, disease, cardiac arrest) and routine medical/OPD hospital bills are completely excluded. Accidents under drug/alcohol influence disallowed.',
  },
  pmjjby: {
    schemeName: 'Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY)',
    maxCapDisplay: '₹2,00,000 Life Benefit',
    maxCapAmount: 200000,
    waitingPeriodDays: 30,
    waitingPeriodText: 'Strict 30-day initial lien period (non-accidental death in first 30 days excluded).',
    coverageScope: '₹2,00,000 pure life term insurance payable to nominee upon death due to ANY cause.',
    mandatoryProofs: [
      'Official Death Certificate of policyholder issued by Registrar / Municipal authority',
      'Claim form and discharge receipt signed by registered nominee',
      'Bank passbook proof of annual auto-debit premium deduction (₹436/₹342/₹228/₹114)',
      'Aadhaar card of deceased subscriber and nominee',
      'Nominee bank passbook copy or cancelled cheque for direct benefit transfer',
    ],
    exclusionsWarning: 'Entry strictly restricted to ages 18–50 (terminates at 55). Death within first 30 days from enrollment is excluded unless caused by an accident.',
  },
  pmfby: {
    schemeName: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    maxCapDisplay: 'Crop Sum Insured (100% loss cap)',
    maxCapAmount: 50000,
    waitingPeriodDays: 0,
    waitingPeriodText: '0 days — Mandatory 72-hour casualty intimation window from event.',
    coverageScope: 'Non-preventable natural risks: hailstorm, drought, flood, pests, unseasonal weather.',
    mandatoryProofs: [
      '72-hour localized casualty intimation receipt (Crop Insurance App / Bank / Toll-free)',
      'Land Record (Record of Rights / 7/12 extract / Patta / Land possession proof)',
      'Sowing Certificate / Crop Declaration certified by Patwari / VAO',
      'Geo-tagged crop damage / field inundation photographs',
      'Aadhaar-linked bank passbook copy proving premium deduction',
    ],
    exclusionsWarning: 'Must intimate loss within 72 hours of hailstorm or localized calamity. Post-harvest damage from theft, arson, or domestic cattle is excluded.',
  },
  ab_pmjay: {
    schemeName: 'Ayushman Bharat PM-JAY',
    maxCapDisplay: '₹5,00,000 Cashless Family Floater',
    maxCapAmount: 500000,
    waitingPeriodDays: 0,
    waitingPeriodText: '0 days — Zero waiting period for all pre-existing medical conditions.',
    coverageScope: 'Cashless secondary and tertiary hospitalization across 29,000+ empanelled network hospitals.',
    mandatoryProofs: [
      'Ayushman Bharat PM-JAY e-Card or ABHA Health Account ID',
      'Hospital in-patient (IPD) admission slip and pre-authorization docket',
      'Hospital discharge summary with clinical notes, diagnostics, and pharmacy logs',
      'Government ration card or family socio-economic identification document',
      'Aadhaar card copy of patient / beneficiary',
    ],
    exclusionsWarning: 'Standalone outpatient (OPD) clinic consultations and retail medicines are excluded. Treatment must be at an empanelled hospital.',
  },
};

// Step Metadata
export const STEP_DEFINITIONS = [
  { step: 1, key: 'step_1_label', title: '1. Policy & Incident' },
  { step: 2, key: 'step_2_label', title: '2. Scan Proof' },
  { step: 3, key: 'step_3_label', title: '3. Verify & Fix' },
  { step: 4, key: 'step_4_label', title: '4. Submit Packet' },
];

/**
 * Initialize the Guided Claim Wizard
 */
export function initClaimWizard() {
  const claimView = document.getElementById('view-claim');
  if (!claimView) return;

  // 1. Initialize Form Defaults
  initFormDefaults();

  // 2. Wire Step 1 Inputs, Presets & Policy Selector
  initStep1();

  // 3. Wire Step 2 Dropzone, Previews & Demo Samples
  initStep2();

  // 4. Wire Step 3 Verification & Re-Validation
  initStep3();

  // 5. Wire Step 4 Review & Submission
  initStep4();

  // 6. Wire Stepper Button Clicks
  initStepperClicks();

  // 7. Subscribe to Reactive Policy Selection Changes
  initWizardSubscriptions();

  // 8. Initial UI Sync with Current State
  goToStep(state.wizardStep || 1, false);
}

/**
 * Set sensible defaults if empty
 */
function initFormDefaults() {
  const incidentDateInput = document.getElementById('claim-incident-date');
  if (incidentDateInput && !incidentDateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    incidentDateInput.value = today;
  }
}

/**
 * Subscribe to state changes affecting Claim Wizard
 */
function initWizardSubscriptions() {
  subscribe((currentState, changedKey) => {
    if (changedKey === 'selectedPolicyId' && currentState.selectedPolicyId) {
      const policySelect = document.getElementById('claim-policy-id');
      if (policySelect && policySelect.value !== currentState.selectedPolicyId) {
        policySelect.value = currentState.selectedPolicyId;
      }
      renderPolicyRequirements(currentState.selectedPolicyId);
      renderUploadSlots(currentState.selectedPolicyId);
    }
  });
}

/**
 * Step 1: Policy & Incident Information
 */
export async function initStep1() {
  const policySelect = document.getElementById('claim-policy-id');
  const nameInput = document.getElementById('claim-claimant-name');
  const ageInput = document.getElementById('claim-claimant-age');
  const phoneInput = document.getElementById('claim-claimant-phone');
  const aadhaarInput = document.getElementById('claim-claimant-aadhaar');
  const bankAccInput = document.getElementById('claim-bank-account');
  const bankIfscInput = document.getElementById('claim-bank-ifsc');
  const incidentDateInput = document.getElementById('claim-incident-date');
  const policyStartInput = document.getElementById('claim-policy-start-date');
  const incidentSubtypeInput = document.getElementById('claim-incident-subtype');
  const incidentDescInput = document.getElementById('claim-incident-desc');
  const nextBtn = document.getElementById('btn-step-1-next');

  // Populate Policy Selector from /api/policies
  await populatePolicySelector();

  // Policy Dropdown Change -> sync banner & selected policy & requirements
  if (policySelect) {
    policySelect.addEventListener('change', () => {
      const policyId = policySelect.value;
      setSelectedPolicyId(policyId);
      highlightActivePolicyBanner(policyId);
      renderPolicyRequirements(policyId);
      renderUploadSlots(policyId);
    });
  }

  // Policy Start Date Presets (e.g. 6 months ago, 10 days ago, 1 year ago)
  const datePresetBtns = document.querySelectorAll('.date-preset-btn');
  datePresetBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      const daysAgo = parseInt(btn.getAttribute('data-days-ago') || '0', 10);
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - daysAgo);
      const dateStr = targetDate.toISOString().split('T')[0];

      if (policyStartInput) {
        policyStartInput.value = dateStr;
      }
      datePresetBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      syncToDraft();

      if (daysAgo === 10) {
        showToast('Enrolled 10 days ago set — useful to test waiting-period / lien catches!', 'warning');
      } else if (daysAgo === 180) {
        showToast('Enrolled 6 months ago set — qualifies for all waiting periods.', 'info');
      }
    });
  });

  // Incident Date Presets (Today, Yesterday, 3 days ago)
  const incidentPresetBtns = document.querySelectorAll('.incident-preset-btn');
  incidentPresetBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      const daysAgo = parseInt(btn.getAttribute('data-days-ago') || '0', 10);
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - daysAgo);
      const dateStr = targetDate.toISOString().split('T')[0];

      if (incidentDateInput) {
        incidentDateInput.value = dateStr;
      }
      incidentPresetBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      syncToDraft();
    });
  });

  // Save changes into state.claimDraft on input
  const syncToDraft = () => {
    updateClaimDraft({
      claimantDetails: {
        name: nameInput?.value?.trim() || '',
        age: ageInput?.value?.trim() || '',
        phone: phoneInput?.value?.trim() || '',
        aadhaarLast4: aadhaarInput?.value?.trim() || '',
        bankAccount: bankAccInput?.value?.trim() || '',
        bankIfsc: bankIfscInput?.value?.trim() || '',
        incidentDate: incidentDateInput?.value || '',
        policyStartDate: policyStartInput?.value || '',
        incidentSubtype: incidentSubtypeInput?.value || '',
        description: incidentDescInput?.value || '',
      },
    });
  };

  [
    nameInput,
    ageInput,
    phoneInput,
    aadhaarInput,
    bankAccInput,
    bankIfscInput,
    incidentDateInput,
    policyStartInput,
    incidentSubtypeInput,
    incidentDescInput,
  ].forEach((input) => {
    if (input) {
      input.addEventListener('input', syncToDraft);
      input.addEventListener('change', syncToDraft);
    }
  });

  // Next Button Step 1 -> Step 2
  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (validateStep1()) {
        syncToDraft();
        goToStep(2);
      }
    });
  }
}

/**
 * Populate active policy selector from /api/policies or state.policies
 */
export async function populatePolicySelector() {
  const policySelect = document.getElementById('claim-policy-id');
  if (!policySelect) return;

  let policiesList = state.policies || [];
  if (!policiesList || policiesList.length === 0) {
    try {
      policiesList = await fetchPolicies();
      if (Array.isArray(policiesList) && policiesList.length > 0) {
        setPolicies(policiesList);
      }
    } catch (err) {
      console.warn('Unable to load /api/policies, using static catalog:', err);
    }
  }

  if (!policiesList || policiesList.length === 0) {
    policiesList = [
      { id: 'micro_health_gig', short_code: 'GIG-SHIELD', name: 'Gig-Worker Micro-Health Clinic Shield', max_claim_inr: 5000 },
      { id: 'pmsby', short_code: 'PMSBY', name: 'Pradhan Mantri Suraksha Bima Yojana', max_claim_inr: 200000 },
      { id: 'pmjjby', short_code: 'PMJJBY', name: 'Pradhan Mantri Jeevan Jyoti Bima Yojana', max_claim_inr: 200000 },
      { id: 'pmfby', short_code: 'PMFBY', name: 'Pradhan Mantri Fasal Bima Yojana', max_claim_inr: 50000 },
      { id: 'ab_pmjay', short_code: 'AB-PMJAY', name: 'Ayushman Bharat PM-JAY', max_claim_inr: 500000 },
    ];
  }

  const selectedVal = (state.selectedPolicyId || policySelect.value || 'micro_health_gig').toLowerCase();

  policySelect.innerHTML = policiesList
    .map((p) => {
      const pId = (p.id || '').toLowerCase();
      const code = p.short_code || SCHEME_TOAST_CODES[pId] || pId.toUpperCase();
      const name = p.name || code;
      const maxCover = p.max_claim_inr ? ` (₹${Number(p.max_claim_inr).toLocaleString('en-IN')} Cap)` : '';
      const isSelected = pId === selectedVal;
      return `<option value="${pId}" ${isSelected ? 'selected' : ''}>${code} — ${name}${maxCover}</option>`;
    })
    .join('');

  const finalVal = policySelect.value || selectedVal;
  setSelectedPolicyId(finalVal);
  renderPolicyRequirements(finalVal);
}

/**
 * Dynamically render "Before You Upload — What This Policy Requires" checklist
 * @param {string} policyId
 */
export function renderPolicyRequirements(policyId) {
  const container = document.getElementById('claim-policy-requirements');
  if (!container) return;

  const key = (policyId || '').toLowerCase();
  const req = POLICY_REQUIREMENTS_DATA[key] || POLICY_REQUIREMENTS_DATA.micro_health_gig;

  container.innerHTML = `
    <div class="policy-req-card" id="policy-req-card-${key}">
      <div class="policy-req-header">
        <div class="req-header-left">
          <span class="req-icon" aria-hidden="true">📋</span>
          <div>
            <h4 class="req-title">Before You Upload — What This Policy Requires</h4>
            <span class="req-policy-tag">${req.schemeName}</span>
          </div>
        </div>
        <div class="req-header-right">
          <span class="badge badge-pass req-cap-badge">Max Cap: ${req.maxCapDisplay}</span>
        </div>
      </div>

      <div class="policy-req-body">
        <!-- Waiting Period & Coverage Scope Strip -->
        <div class="req-clause-strip">
          <div class="clause-item">
            <span class="clause-icon" aria-hidden="true">⏱️</span>
            <div>
              <strong class="clause-label">Waiting / Lien Period:</strong>
              <span class="clause-text">${req.waitingPeriodText}</span>
            </div>
          </div>
          <div class="clause-item">
            <span class="clause-icon" aria-hidden="true">🛡️</span>
            <div>
              <strong class="clause-label">Coverage Scope:</strong>
              <span class="clause-text">${req.coverageScope}</span>
            </div>
          </div>
        </div>

        <!-- Mandatory Proofs Checklist -->
        <div class="req-checklist-section">
          <span class="checklist-heading">Mandatory Proof Documents Checklist:</span>
          <ul class="mandatory-proofs-list">
            ${req.mandatoryProofs
              .map(
                (proof) => `
              <li class="proof-item">
                <span class="check-bullet" aria-hidden="true">✓</span>
                <span class="proof-text">${proof}</span>
              </li>
            `
              )
              .join('')}
          </ul>
        </div>

        <!-- Disallowed / Key Traps Warning -->
        <div class="req-exclusions-warning">
          <span class="warning-icon" aria-hidden="true">⚠️</span>
          <div class="warning-content">
            <strong class="warning-title">Key Traps &amp; Common Disallowances:</strong>
            <p class="warning-text">${req.exclusionsWarning}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Validate Step 1 required inputs
 * @returns {boolean}
 */
export function validateStep1() {
  const policySelect = document.getElementById('claim-policy-id');
  const nameInput = document.getElementById('claim-claimant-name');
  const ageInput = document.getElementById('claim-claimant-age');
  const incidentDateInput = document.getElementById('claim-incident-date');

  const policyId = policySelect?.value || state.selectedPolicyId;
  const name = nameInput?.value?.trim();
  const age = parseInt(ageInput?.value || '', 10);
  const incidentDate = incidentDateInput?.value;

  if (!policyId) {
    showToast('Please select an applicable insurance policy scheme.', 'warning');
    policySelect?.focus();
    return false;
  }

  if (!name || name.length < 2) {
    showToast('Please enter the claimant full legal name (at least 2 characters).', 'warning');
    nameInput?.focus();
    return false;
  }

  if (isNaN(age) || age < 18 || age > 100) {
    showToast('Please enter a valid claimant age between 18 and 100 years.', 'warning');
    ageInput?.focus();
    return false;
  }

  if (!incidentDate) {
    showToast('Please specify the date of bill or incident.', 'warning');
    incidentDateInput?.focus();
    return false;
  }

  return true;
}

/**
 * Step 2: Document Upload, Previews & Demo Samples (delegated to static/js/uploader.js)
 */
function initStep2() {
  initUploader();
  initJudgesDemoBar();

  const backBtn = document.getElementById('btn-step-2-back');
  const nextBtn = document.getElementById('btn-step-2-next');

  // Back Button Step 2 -> Step 1
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      goToStep(1);
    });
  }

  // Next Button Step 2 -> Step 3
  if (nextBtn) {
    nextBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (validateStep2()) {
        goToStep(3);
        await runClaimAnalysis();
      }
    });
  }
}

/**
 * Step 3: Verify & Fix Logic
 */
function initStep3() {
  const backBtn = document.getElementById('btn-step-3-back');
  const nextBtn = document.getElementById('btn-step-3-next');

  // Initialize Retry & Back Handlers in Loading HUD
  initAnalysisRetryHandlers();

  // Initialize Step 3 Verification Handlers (Zoom Modal, Mobile Collapse, Field Watchers, Revalidate)
  initVerifyStep();

  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      goToStep(2);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (validateStep3()) {
        renderSummaryDossier();
        goToStep(4);
      }
    });
  }
}

/**
 * Validate Step 3: requires completed analysis
 * @returns {boolean}
 */
export function validateStep3() {
  if (!state.claimDraft.extractedData) {
    showToast('Please wait for document analysis to complete before proceeding.', 'warning');
    return false;
  }
  return true;
}

// ==========================================================================
// Multi-Stage Underwriting Engine Animation Controller
// Stage 1: "1. Checking photo clarity & handwriting..."
// Stage 2: "2. Extracting amounts, dates & items via AI Vision..."
// Stage 3: "3. Cross-checking against official policy limits & exclusions..."
// ==========================================================================

export let analysisStageTimers = [];

/**
 * Clear all scheduled loading stage timers
 */
export function clearAnalysisTimers() {
  analysisStageTimers.forEach((t) => clearTimeout(t));
  analysisStageTimers = [];
}

/**
 * Set visual state for a given stage item
 * @param {number} stageNum (1, 2, 3)
 * @param {'active'|'completed'|'pending'} status
 */
export function setLoadingStageState(stageNum, status) {
  const stageEl = document.getElementById(`loading-stage-${stageNum}`);
  const indicatorEl = document.getElementById(`loading-indicator-${stageNum}`);
  const badgeEl = document.getElementById(`stage-badge-${stageNum}`);

  if (stageEl) {
    stageEl.classList.remove('active', 'completed', 'pending');
    stageEl.classList.add(status);
  }

  if (indicatorEl) {
    if (status === 'active') {
      indicatorEl.innerHTML = '<span class="stage-spinner" aria-hidden="true"></span>';
    } else if (status === 'completed') {
      indicatorEl.innerHTML = '<span class="stage-check-icon" aria-hidden="true">✓</span>';
    } else {
      indicatorEl.innerHTML = `<span class="stage-pending-dot" aria-hidden="true">${stageNum}</span>`;
    }
  }

  if (badgeEl) {
    badgeEl.classList.remove('badge-active', 'badge-pass', 'badge-pending');
    if (status === 'active') {
      badgeEl.classList.add('badge-active');
      badgeEl.textContent = 'In Progress';
    } else if (status === 'completed') {
      badgeEl.classList.add('badge-pass');
      badgeEl.textContent = 'Done ✓';
    } else {
      badgeEl.classList.add('badge-pending');
      badgeEl.textContent = 'Queued';
    }
  }
}

/**
 * Update the loading progress bar fill and percentage pill
 * @param {number} percent
 */
export function updateLoadingProgress(percent) {
  const barEl = document.getElementById('loading-progress-bar');
  const pillEl = document.getElementById('loading-progress-percent');
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  if (barEl) barEl.style.width = `${clamped}%`;
  if (pillEl) pillEl.textContent = `${clamped}%`;
}

/**
 * Start the 3-stage animated Underwriting Engine loading HUD
 */
export function startAnalysisLoadingAnimation() {
  clearAnalysisTimers();

  const loadingEl = document.getElementById('claim-analysis-loading');
  const resultsEl = document.getElementById('claim-analysis-results');
  const stagesContainer = document.getElementById('loading-stages-container');
  const errorPanel = document.getElementById('loading-error-panel');

  if (loadingEl) loadingEl.style.display = 'flex';
  if (resultsEl) resultsEl.style.opacity = '0.2';
  if (stagesContainer) stagesContainer.style.display = 'block';
  if (errorPanel) errorPanel.style.display = 'none';

  // Initialize Stage 1 (0ms - 1200ms)
  setLoadingStageState(1, 'active');
  setLoadingStageState(2, 'pending');
  setLoadingStageState(3, 'pending');
  updateLoadingProgress(20);

  // Transition to Stage 2 at 1200ms
  const t1 = setTimeout(() => {
    setLoadingStageState(1, 'completed');
    setLoadingStageState(2, 'active');
    setLoadingStageState(3, 'pending');
    updateLoadingProgress(60);
  }, 1200);

  // Transition to Stage 3 at 2600ms
  const t2 = setTimeout(() => {
    setLoadingStageState(1, 'completed');
    setLoadingStageState(2, 'completed');
    setLoadingStageState(3, 'active');
    updateLoadingProgress(88);
  }, 2600);

  analysisStageTimers.push(t1, t2);
}

/**
 * Complete all 3 stages with 100% progress and reveal Step 3 inspection results
 * @returns {Promise<void>}
 */
export function completeAnalysisLoadingAnimation() {
  clearAnalysisTimers();
  setLoadingStageState(1, 'completed');
  setLoadingStageState(2, 'completed');
  setLoadingStageState(3, 'completed');
  updateLoadingProgress(100);

  return new Promise((resolve) => {
    const t = setTimeout(() => {
      const loadingEl = document.getElementById('claim-analysis-loading');
      const resultsEl = document.getElementById('claim-analysis-results');
      if (loadingEl) loadingEl.style.display = 'none';
      if (resultsEl) {
        resultsEl.style.display = 'block';
        resultsEl.style.opacity = '1';
      }
      resolve();
    }, 400);
    analysisStageTimers.push(t);
  });
}

/**
 * Display clean timeout or error panel with retry button
 * @param {string|Error} err
 */
export function showAnalysisLoadingError(err) {
  clearAnalysisTimers();
  const stagesContainer = document.getElementById('loading-stages-container');
  const errorPanel = document.getElementById('loading-error-panel');
  const titleEl = document.getElementById('loading-error-title');
  const msgEl = document.getElementById('loading-error-msg');
  const resultsEl = document.getElementById('claim-analysis-results');

  if (resultsEl) resultsEl.style.opacity = '0.2';
  if (stagesContainer) stagesContainer.style.display = 'none';
  if (errorPanel) errorPanel.style.display = 'flex';

  const errMsg = typeof err === 'string' ? err : (err?.message || 'Request timed out');
  const isTimeout = /timeout|timed out|abort/i.test(errMsg);

  if (titleEl) {
    titleEl.textContent = isTimeout ? 'Document Audit Request Timed Out' : 'Document Audit Paused (Error)';
  }
  if (msgEl) {
    msgEl.textContent = isTimeout
      ? 'The policy underwriting engine took longer than expected to analyze the document. Your uploaded proof and claimant details are safely retained. Tap retry below.'
      : `Audit encountered an issue: ${errMsg}. Your inputs are safely preserved. Please retry.`;
  }
}

/**
 * Wire the Retry Button and Back Button inside the Loading HUD
 */
export function initAnalysisRetryHandlers() {
  const retryBtn = document.getElementById('btn-retry-analysis');
  const backStep2Btn = document.getElementById('btn-loading-back-step2');

  if (retryBtn) {
    if (!retryBtn.dataset) retryBtn.dataset = {};
    if (!retryBtn.dataset.bound) {
      retryBtn.dataset.bound = 'true';
      retryBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        showToast('Retrying document scan & policy audit...', 'info', 2000);
        await runClaimAnalysis();
      });
    }
  }

  if (backStep2Btn) {
    if (!backStep2Btn.dataset) backStep2Btn.dataset = {};
    if (!backStep2Btn.dataset.bound) {
      backStep2Btn.dataset.bound = 'true';
      backStep2Btn.addEventListener('click', (e) => {
        e.preventDefault();
        clearAnalysisTimers();
        const loadingEl = document.getElementById('claim-analysis-loading');
        if (loadingEl) loadingEl.style.display = 'none';
        goToStep(2);
      });
    }
  }
}

/**
 * Execute OCR extraction and Rule Guardrail checks with live 3-stage animated HUD
 */
export async function runClaimAnalysis() {
  startAnalysisLoadingAnimation();

  try {
    let res = null;

    // 15-second client timeout guard
    const timeoutPromise = new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Request timed out: backend underwriting engine took longer than 15s'));
      }, 15000);
      analysisStageTimers.push(timer);
    });

    const executionPromise = (async () => {
      if (state.claimDraft.selectedSampleId) {
        // Analyze bundled demo sample
        return await analyzeSample(state.claimDraft.selectedSampleId);
      } else if (state.claimDraft.uploadedFiles && state.claimDraft.uploadedFiles.length > 0) {
        // Real user Form-Data upload
        const formData = new FormData();
        const policyId = document.getElementById('claim-policy-id')?.value || state.selectedPolicyId || 'micro_health_gig';
        const claimantName = document.getElementById('claim-claimant-name')?.value || 'Ramesh Kumar';
        const claimantAge = document.getElementById('claim-claimant-age')?.value || '28';
        const incidentDate = document.getElementById('claim-incident-date')?.value || new Date().toISOString().split('T')[0];
        const policyStartDate = document.getElementById('claim-policy-start-date')?.value || '';
        const incidentSubtype = document.getElementById('claim-incident-subtype')?.value || '';

        const primaryDoc = state.claimDraft.primaryDocType || document.getElementById('claim-primary-doc-type')?.value || 'clinic_opd_bill';
        const secondaryDocs = state.claimDraft.secondaryDocTypes || [];

        formData.append('policy_id', policyId);
        formData.append('claimant_name', claimantName);
        formData.append('claimant_age', claimantAge);
        if (policyStartDate) formData.append('policy_start_date', policyStartDate);
        if (incidentDate) formData.append('incident_date', incidentDate);
        if (incidentSubtype) formData.append('incident_subtype', incidentSubtype);
        formData.append('primary_doc_type', primaryDoc);
        if (secondaryDocs.length > 0) {
          formData.append('secondary_doc_types', JSON.stringify(secondaryDocs));
        }

        state.claimDraft.uploadedFiles.forEach((f) => {
          if (f.file) formData.append('files', f.file);
        });

        return await analyzeClaim(formData);
      } else {
        // Fallback demo scenario
        return await analyzeSample('clean_clinic_bill');
      }
    })();

    res = await Promise.race([executionPromise, timeoutPromise]);

    if (res) {
      // Store into state.claimDraft
      state.claimDraft.draftId = res.draft_id || res.claim_id;
      state.claimDraft.extractedData = res.extracted_data;
      state.claimDraft.ruleChecks = res.rule_checks || [];
      state.claimDraft.readinessScore = res.readiness_score || 0;
      state.claimDraft.readinessStatus = res.readiness_status || 'NEEDS_FIXES';
      state.claimDraft.estimatedPayoutInr =
        res.eligible_payout_inr !== undefined ? res.eligible_payout_inr : (res.estimated_payout_inr || 0);
      state.claimDraft.disallowedAmountInr = res.disallowed_amount_inr || 0;
      state.claimDraft.actionableChecklist = res.fix_it_checklist || res.actionable_checklist || [];

      // Complete 3-stage loading animation with visual 100% completion
      await completeAnalysisLoadingAnimation();

      renderStep3Results(res);
      showToast('Document audited against policy guardrails successfully.', 'success');
    }
  } catch (err) {
    console.error('Failed to analyze claim:', err);
    showAnalysisLoadingError(err);
    showToast(`Analysis delayed: ${err.message || 'Please retry'}`, 'error');
  }
}

/**
 * Render Extracted Fields, Rule Checks Scorecard, Fix-It items, and Document Proof Image in Step 3
 * Delegates directly to the modular static/js/verifyStep.js engine (updating claim-inspector-image)
 * @param {any} res
 * @param {string} [customImageUrl]
 */
export function renderStep3Results(res, customImageUrl) {
  renderVerifyStep(res, customImageUrl);
}

/**
 * Re-validate claim live via POST /api/revalidate-claim
 */
export async function runRevalidation() {
  return await verifyRunRevalidation();
}

/**
 * Step 4: Final Summary Dossier Review & Official Submission (delegated to static/js/submitStep.js)
 */
function initStep4() {
  const backBtn = document.getElementById('btn-step-4-back');
  const fileAnotherBtn = document.getElementById('btn-file-another-claim');

  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      goToStep(3);
    });
  }

  // Initialize Step 4 pre-submission review, genuine checkbox & submit handler
  initSubmitStep();

  if (fileAnotherBtn) {
    fileAnotherBtn.addEventListener('click', (e) => {
      e.preventDefault();
      resetClaimWizard();
    });
  }
}

/**
 * Render Summary Dossier Review Card in Step 4
 */
export function renderSummaryDossier() {
  renderSubmitStep();
}

/**
 * Submit Final Claim to POST /api/submit-claim
 */
export async function submitFinalClaim() {
  return await submitClaimPackage();
}

/**
 * Reset wizard to Step 1 for filing another claim
 */
export function resetClaimWizard() {
  submitResetClaimWizard();
  uploaderRenderPreviews();
  goToStep(1);
}

/**
 * Bind direct clicks on Stepper Breadcrumb buttons
 */
function initStepperClicks() {
  const stepperBar = document.getElementById('wizard-steps-bar');
  if (!stepperBar) return;

  stepperBar.querySelectorAll('.wizard-step-item').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetStep = parseInt(btn.getAttribute('data-step') || '1', 10);
      const currentStep = state.wizardStep || 1;

      // Allow clicking backward to any previous step without restrictions
      if (targetStep < currentStep) {
        goToStep(targetStep);
        return;
      }

      // If jumping forward, validate intermediate steps sequentially
      if (targetStep > currentStep) {
        if (currentStep === 1 && !validateStep1()) return;
        if (currentStep <= 2 && targetStep > 2 && !validateStep2()) return;
        if (currentStep <= 3 && targetStep > 3 && !validateStep3()) return;
        goToStep(targetStep);
      }
    });
  });
}

/**
 * Transition wizard to target step (1 to 4)
 * @param {number} step
 * @param {boolean} [scroll=true]
 */
export function goToStep(step, scroll = true) {
  const clampedStep = Math.max(1, Math.min(4, Math.floor(step)));
  setWizardStep(clampedStep);

  // 1. Show active panel, hide others
  for (let s = 1; s <= 4; s++) {
    const panel = document.getElementById(`claim-step-${s}`);
    if (panel) {
      if (s === clampedStep) {
        panel.hidden = false;
        panel.classList.add('active');
      } else {
        panel.hidden = true;
        panel.classList.remove('active');
      }
    }
  }

  // 2. Update Desktop / Tablet Stepper Bar
  const stepItems = document.querySelectorAll('.wizard-step-item');
  stepItems.forEach((item) => {
    const itemStep = parseInt(item.getAttribute('data-step') || '1', 10);
    const badge = item.querySelector('.wizard-step-badge');

    if (itemStep < clampedStep) {
      item.classList.remove('active');
      item.classList.add('completed');
      item.removeAttribute('aria-current');
      if (badge) badge.textContent = '✓';
    } else if (itemStep === clampedStep) {
      item.classList.add('active');
      item.classList.remove('completed');
      item.setAttribute('aria-current', 'step');
      if (badge) badge.textContent = String(itemStep);
    } else {
      item.classList.remove('active', 'completed');
      item.removeAttribute('aria-current');
      if (badge) badge.textContent = String(itemStep);
    }
  });

  // 3. Update Mobile Compact Stepper Header (< 768px)
  const mobilePill = document.getElementById('mobile-step-pill');
  const mobileTitle = document.getElementById('mobile-step-title');
  const mobileDots = document.querySelectorAll('.mobile-dot');

  const stepDef = STEP_DEFINITIONS.find((d) => d.step === clampedStep);

  if (mobilePill) {
    mobilePill.textContent = `Step ${clampedStep} of 4`;
  }
  if (mobileTitle && stepDef) {
    mobileTitle.textContent = stepDef.title;
  }
  mobileDots.forEach((dot) => {
    const dStep = parseInt(dot.getAttribute('data-step') || '1', 10);
    dot.classList.toggle('active', dStep === clampedStep);
    dot.classList.toggle('completed', dStep < clampedStep);
  });

  // 4. Re-apply translations for dynamic step elements
  applyTranslations(state.language);

  // 5. If transitioning to Step 4, compile and render the pre-submission dossier
  if (clampedStep === 4) {
    renderSubmitStep();
  }

  // 5. Scroll smoothly to top of claim view
  if (scroll) {
    const stepperContainer = document.getElementById('claim-stepper-container');
    if (stepperContainer) {
      stepperContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}
