/**
 * SurakshaSetu — Centralized Reactive State Store
 * Manages active tab, language, policies, claim draft, wizard step, and insurer triage.
 */

// Initial Claim Draft Template
const initialClaimDraft = {
  draftId: null,
  uploadedFiles: [],
  uploadedDocTypes: [],
  primaryDocType: null,
  secondaryDocTypes: [],
  extractedData: null,
  ruleChecks: [],
  readinessScore: 0,
  readinessStatus: 'NOT_COVERED', // 'READY_TO_SUBMIT' | 'NEEDS_FIXES' | 'NOT_COVERED'
  estimatedPayoutInr: 0,
  disallowedAmountInr: 0,
  actionableChecklist: [],
  claimantDetails: {
    name: '',
    age: '',
    policyStartDate: '',
    incidentDate: '',
    incidentSubtype: '',
  },
};

// State Store Instance
export const state = {
  // Navigation & Localization
  activeTab: 'recommend', // 'recommend' | 'claim' | 'insurer'
  language: 'en',        // 'en' | 'hi'

  // Policy Catalog & Selection
  policies: [],
  selectedPolicyId: null,

  // Wizard Navigation (1–4)
  // Step 1: Policy & Claimant Info
  // Step 2: Upload Documents / Photos
  // Step 3: Review OCR Extraction & Fix-It Guardrails
  // Step 4: Submission Confirmation & Report Download
  wizardStep: 1,

  // Active Pre-Validation Claim Draft
  claimDraft: { ...initialClaimDraft },

  // Insurer Triage State
  insurerClaims: {
    metrics: {
      total_claims: 0,
      ready_to_approve: 0,
      needs_review: 0,
      approved_count: 0,
      prevented_rejections_count: 0,
    },
    claims: [],
  },

  // Active Selected Claim in Officer Portal (for modal/dossier inspector)
  activeClaimDetail: null,

  // Demo Samples
  samples: [],

  // System Health
  systemHealth: {
    status: 'checking',
    geminiActive: false,
    model: 'gemini-3.5-flash-lite',
  },
};

// Subscriber Listeners
const listeners = new Set();

/**
 * Subscribe to state changes
 * @param {(state: typeof state, changedKey?: string) => void} listener
 * @returns {() => void} Unsubscribe function
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Notify all subscribers of state mutation
 * @param {string} [changedKey]
 */
function notify(changedKey) {
  listeners.forEach((listener) => {
    try {
      listener(state, changedKey);
    } catch (err) {
      console.error('Error in state subscriber listener:', err);
    }
  });
}

/**
 * Merge partial updates into centralized state and notify subscribers
 * @param {Partial<typeof state>} partialState
 */
export function setState(partialState) {
  let changedKey = null;
  const keys = Object.keys(partialState);
  if (keys.length === 1) {
    changedKey = keys[0];
  }

  Object.assign(state, partialState);
  notify(changedKey);
}

/**
 * Get current snapshot of centralized state
 * @returns {typeof state}
 */
export function getState() {
  return state;
}

// ==========================================================================
// Specialized State Action Helpers
// ==========================================================================

/**
 * Set active navigation tab ('recommend' | 'claim' | 'insurer')
 * @param {'recommend' | 'claim' | 'insurer'} tabName
 */
export function setActiveTab(tabName) {
  if (['recommend', 'claim', 'insurer'].includes(tabName)) {
    state.activeTab = tabName;
    notify('activeTab');
  }
}

/**
 * Set language ('en' | 'hi')
 * @param {'en' | 'hi'} lang
 */
export function setLanguage(lang) {
  if (lang === 'en' || lang === 'hi') {
    state.language = lang;
    notify('language');
  }
}

/**
 * Set loaded policies catalog list
 * @param {Array<any>} policiesList
 */
export function setPolicies(policiesList) {
  state.policies = Array.isArray(policiesList) ? policiesList : [];
  notify('policies');
}

/**
 * Set currently selected policy ID
 * @param {string | null} policyId
 */
export function setSelectedPolicyId(policyId) {
  state.selectedPolicyId = policyId;
  notify('selectedPolicyId');
}

/**
 * Set active wizard step (1 to 4)
 * @param {number} step
 */
export function setWizardStep(step) {
  const clamped = Math.max(1, Math.min(4, Math.floor(step)));
  state.wizardStep = clamped;
  notify('wizardStep');
}

/**
 * Increment wizard step
 */
export function nextWizardStep() {
  if (state.wizardStep < 4) {
    state.wizardStep += 1;
    notify('wizardStep');
  }
}

/**
 * Decrement wizard step
 */
export function prevWizardStep() {
  if (state.wizardStep > 1) {
    state.wizardStep -= 1;
    notify('wizardStep');
  }
}

/**
 * Partially update active claim draft
 * @param {Partial<typeof initialClaimDraft>} updates
 */
export function updateClaimDraft(updates) {
  state.claimDraft = {
    ...state.claimDraft,
    ...updates,
    claimantDetails: {
      ...state.claimDraft.claimantDetails,
      ...(updates.claimantDetails || {}),
    },
  };
  notify('claimDraft');
}

/**
 * Reset claim draft to fresh empty template
 */
export function resetClaimDraft() {
  state.claimDraft = JSON.parse(JSON.stringify(initialClaimDraft));
  state.wizardStep = 1;
  notify('claimDraft');
}

/**
 * Update insurer portal dashboard and claims list
 * @param {{ metrics: any, claims: Array<any> }} data
 */
export function setInsurerClaims(data) {
  const rawMetrics = data?.metrics || {};
  const claimsList = Array.isArray(data?.claims) ? data.claims : [];
  
  const totalClaims = rawMetrics.total_claims ?? data?.total_claims ?? claimsList.length;
  const readyToApprove = rawMetrics.ready_to_approve ?? data?.ready_to_approve ?? claimsList.filter(c => c.reviewer_status === 'READY_TO_APPROVE').length;
  const needsReview = rawMetrics.needs_review ?? data?.needs_review ?? claimsList.filter(c => c.reviewer_status === 'NEEDS_REVIEW' || c.reviewer_status === 'INFO_REQUESTED').length;
  const approvedCount = rawMetrics.approved_count ?? data?.approved_count ?? claimsList.filter(c => c.reviewer_status === 'APPROVED').length;
  const preventedRejections = rawMetrics.prevented_rejections_count ?? data?.prevented_rejections_count ?? 1;

  const metrics = {
    total_claims: totalClaims,
    ready_to_approve: readyToApprove,
    needs_review: needsReview,
    approved_count: approvedCount,
    prevented_rejections_count: preventedRejections,
  };

  state.insurerClaims = {
    metrics,
    total_claims: totalClaims,
    ready_to_approve: readyToApprove,
    needs_review: needsReview,
    approved_count: approvedCount,
    prevented_rejections_count: preventedRejections,
    claims: claimsList,
  };
  notify('insurerClaims');
}

/**
 * Set single claim detail for officer review
 * @param {any | null} claim
 */
export function setActiveClaimDetail(claim) {
  state.activeClaimDetail = claim;
  notify('activeClaimDetail');
}

/**
 * Set demo samples list
 * @param {Array<any>} samples
 */
export function setSamples(samples) {
  state.samples = Array.isArray(samples) ? samples : [];
  notify('samples');
}

/**
 * Update system health state
 * @param {any} health
 */
export function setSystemHealth(health) {
  state.systemHealth = {
    ...state.systemHealth,
    ...health,
  };
  notify('systemHealth');
}
