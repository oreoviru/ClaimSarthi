/**
 * SurakshaSetu — API Client Module
 * Provides unified, typed fetch wrappers for all backend endpoints
 * with automatic error parsing and accessible toast notifications.
 */

const BASE_URL = '';

/**
 * Display Toast Notification in the DOM
 * @param {string} message
 * @param {'info' | 'success' | 'warning' | 'error'} type
 * @param {number} [duration=4000]
 */
export function showToast(message, type = 'info', duration = 4000) {
  const toastRegion = document.getElementById('toast-region');
  if (!toastRegion) {
    console.warn(`[Toast ${type}]: ${message}`);
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const textSpan = document.createElement('span');
  textSpan.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Dismiss notification');
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => toast.remove());

  toast.appendChild(textSpan);
  toast.appendChild(closeBtn);
  toastRegion.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, duration);
}

/**
 * Unified request handler with error parsing and automatic toast triggers
 * @template T
 * @param {string} endpoint
 * @param {RequestInit} [options={}]
 * @returns {Promise<T>}
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = { ...options };

  // If payload is not FormData, default to application/json
  if (config.body && !(config.body instanceof FormData)) {
    config.headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(config.headers || {}),
    };
  } else {
    config.headers = {
      Accept: 'application/json',
      ...(config.headers || {}),
    };
  }

  try {
    const res = await fetch(url, config);

    // Successful JSON Response
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await res.json();
      }
      return await res.text();
    }

    // Parse Error Body
    let errorMsg = `Server error (${res.status})`;
    try {
      const errData = await res.json();
      if (typeof errData.detail === 'string') {
        errorMsg = errData.detail;
      } else if (Array.isArray(errData.detail)) {
        // FastAPI 422 Validation Error structure
        errorMsg = errData.detail.map((d) => d.msg || `${d.loc?.join('.')}: invalid`).join('; ');
      } else if (errData.error) {
        errorMsg = typeof errData.error === 'string' ? errData.error : JSON.stringify(errData.error);
      } else if (errData.message) {
        errorMsg = errData.message;
      }
    } catch {
      const text = await res.text();
      if (text) errorMsg = text.slice(0, 160);
    }

    // Auto-display error toast
    showToast(errorMsg, 'error');
    throw new Error(errorMsg);
  } catch (err) {
    // Catch Network/Offline Errors
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const networkMsg = 'Network Error: Unable to connect to server. Check your connection.';
      showToast(networkMsg, 'error');
      throw new Error(networkMsg);
    }
    // Re-throw if already formatted
    throw err;
  }
}

// ==========================================================================
// 1. Policy Catalog & Scheme Discovery Endpoints
// ==========================================================================

/**
 * Fetch all available micro-insurance policies
 * GET /api/policies
 * @returns {Promise<Array<any>>}
 */
export async function fetchPolicies() {
  return await apiRequest('/api/policies');
}

/**
 * Fetch detailed specification for a single policy
 * GET /api/policies/{policy_id}
 * @param {string} policyId
 * @returns {Promise<any>}
 */
export async function fetchPolicyById(policyId) {
  return await apiRequest(`/api/policies/${encodeURIComponent(policyId)}`);
}

/**
 * Get personalized policy recommendations based on user profile
 * POST /api/recommend
 * @param {{
 *   age: number,
 *   annual_income_inr: number,
 *   occupation: string,
 *   has_bank_account: boolean,
 *   primary_risk?: string,
 *   max_annual_budget_inr?: number,
 *   family_size?: number,
 *   landholding_hectares?: number
 * }} payload
 * @returns {Promise<{ recommendations: Array<any>, total_eligible: number }>}
 */
export async function recommendPolicies(payload) {
  return await apiRequest('/api/recommend', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Calculate exact pro-rated or crop-specific premium
 * POST /api/calculate-premium
 * @param {{
 *   policy_id: string,
 *   enrollment_month?: number,
 *   sum_insured_inr?: number,
 *   crop_name?: string,
 *   season?: string,
 *   coverage_area_hectares?: number
 * }} payload
 * @returns {Promise<any>}
 */
export async function calculatePremium(payload) {
  return await apiRequest('/api/calculate-premium', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ==========================================================================
// 2. Pre-Claim Audit, Document OCR & Fix-It Processing Endpoints
// ==========================================================================

/**
 * Orchestrate complete claim analysis: file upload, OCR, and deterministic audit
 * POST /api/analyze-claim
 * @param {FormData} formData
 * @returns {Promise<any>}
 */
export async function analyzeClaim(formData) {
  return await apiRequest('/api/analyze-claim', {
    method: 'POST',
    body: formData,
  });
}

/**
 * Re-validate claim live after user manually corrects unreadable/missing fields
 * POST /api/revalidate-claim
 * @param {any} payload
 * @returns {Promise<any>}
 */
export async function revalidateClaim(payload) {
  return await apiRequest('/api/revalidate-claim', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Submit pre-validated claim into insurer queue
 * POST /api/submit-claim
 * @param {any} payload
 * @returns {Promise<any>}
 */
export async function submitClaim(payload) {
  return await apiRequest('/api/submit-claim', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ==========================================================================
// 3. Demo Samples & Judging Scenarios
// ==========================================================================

/**
 * List all pre-bundled realistic Indian demo samples
 * GET /api/samples
 * @returns {Promise<Array<any>>}
 */
export async function fetchSamples() {
  return await apiRequest('/api/samples');
}

/**
 * Analyze a bundled demo sample instantaneously
 * POST /api/analyze-sample/{sample_id}
 * @param {string} sampleId
 * @returns {Promise<any>}
 */
export async function analyzeSample(sampleId) {
  return await apiRequest(`/api/analyze-sample/${encodeURIComponent(sampleId)}`, {
    method: 'POST',
  });
}

// ==========================================================================
// 4. Insurer Portal Triage & Decision Desk Endpoints
// ==========================================================================

/**
 * Fetch all submitted claims and summary metrics for officer triage
 * GET /api/claims
 * @returns {Promise<{ metrics: any, claims: Array<any> }>}
 */
export async function fetchClaims() {
  return await apiRequest('/api/claims');
}

/**
 * Fetch full claim record details
 * GET /api/claims/{claim_id}
 * @param {string} claimId
 * @returns {Promise<any>}
 */
export async function fetchClaimById(claimId) {
  return await apiRequest(`/api/claims/${encodeURIComponent(claimId)}`);
}

/**
 * Submit officer decision (APPROVE, INFO_REQUESTED, REJECT)
 * PATCH /api/claims/{claim_id}/decision
 * @param {string} claimId
 * @param {{
 *   status: 'APPROVED' | 'INFO_REQUESTED' | 'REJECTED',
 *   approved_amount_inr?: number,
 *   reviewer_notes?: string
 * }} decisionPayload
 * @returns {Promise<any>}
 */
export async function updateClaimDecision(claimId, decisionPayload) {
  return await apiRequest(`/api/claims/${encodeURIComponent(claimId)}/decision`, {
    method: 'PATCH',
    body: JSON.stringify(decisionPayload),
  });
}

// ==========================================================================
// 5. System Health Check Endpoint
// ==========================================================================

/**
 * Fetch API service health and Gemini configuration status
 * GET /api/health
 * @returns {Promise<any>}
 */
export async function fetchHealth() {
  return await apiRequest('/api/health');
}
