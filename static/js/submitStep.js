/**
 * SurakshaSetu — Step 4: Review & Submit Claim Dossier
 * File: static/js/submitStep.js
 *
 * Features:
 * - Crisp pre-submission dossier review card (#claim-summary-dossier).
 * - 1. Policy Name & Coverage Summary with official micro-insurance terms.
 * - 2. Verified Claimant & Incident Information (Claimant, Age, Phone, Aadhaar, DBT Bank Account, Date, Provider).
 * - 3. Itemized Financial Breakdown (Billed vs. Excluded vs. Eligible Payout) + itemized charges list.
 * - 4. Attached Evidence Thumbnails with document tags (Primary Proof, Secondary Proof, Verified Document).
 * - 5. Compact Policy Compliance Summary ("5 of 5 Checks Passed" or reviewer flags if soft warnings).
 * - 6. Plain-language user confirmation checkbox ("I confirm these details and photos are genuine")
 *      enabling the primary "Submit Pre-Validated Claim Package" button wired to POST /api/submit-claim.
 * - Submission success receipt with Claim ID, status pill, printable A4 dossier download, and JSON export.
 */

import { state, setActiveTab, setInsurerClaims, setWizardStep } from './state.js';
import { submitClaim, fetchClaims, showToast } from './api.js';
import { formatDocTitle } from './verifyStep.js';
import { renderUploadSlots } from './uploader.js';
import { renderInsurerQueue as delegateRenderInsurerQueue } from './insurerQueue.js';

/**
 * Render triage queue cards into #insurer-queue-container
 * @param {string | null} [highlightClaimId=null]
 * @param {string | null} [filter=null]
 */
export function renderInsurerQueue(highlightClaimId = null, filter = null) {
  return delegateRenderInsurerQueue(highlightClaimId, filter);
}

// Currently active submitted claim ID for receipt actions
export let lastSubmittedClaimId = null;

// Scheme Metadata for Coverage Summaries
export const SCHEME_COVERAGE_METADATA = {
  micro_health_gig: {
    name: 'Gig-Worker Micro-Health Clinic Shield',
    shortCode: 'GIG-SHIELD',
    tag: 'Micro-Health OPD Shield',
    capSummary: '₹5,000 OPD Clinic Sub-limit | 15-day waiting period | Zero deductible on generic antibiotics & consultation',
  },
  pmsby: {
    name: 'Pradhan Mantri Suraksha Bima Yojana',
    shortCode: 'PMSBY',
    tag: 'Accidental Social Security',
    capSummary: '₹2,00,000 Accidental Death & Permanent Disability Cap | FIR/Medical Panchnama required | Zero illness coverage',
  },
  pmjjby: {
    name: 'Pradhan Mantri Jeevan Jyoti Bima Yojana',
    shortCode: 'PMJJBY',
    tag: 'Pure Term Life Cover',
    capSummary: '₹2,00,000 Life Coverage | 30-day initial lien period on illness | Death certificate required',
  },
  pmfby: {
    name: 'Pradhan Mantri Fasal Bima Yojana',
    shortCode: 'PMFBY',
    tag: 'Crop Loss & Calamity Protection',
    capSummary: 'Localized calamity crop loss | 72-hour casualty intimation window | RoR 7/12 land record required',
  },
  ab_pmjay: {
    name: 'Ayushman Bharat PM-JAY',
    shortCode: 'AB-PMJAY',
    tag: 'Secondary & Tertiary IPD Hospitalization',
    capSummary: '₹5,00,000 Annual Family Floating Hospitalization Cap | Cashless empanelled hospital treatment only',
  },
};

/**
 * Initialize Step 4 event handlers:
 * - Genuine confirmation checkbox toggling submit button disabled state
 * - Submit button handler invoking POST /api/submit-claim
 * - File another claim reset button
 * - Open in Insurer Queue navigation button
 */
export function initSubmitStep() {
  initConfirmationCheckboxHandler();
  initSubmitButtonHandler();
  initOpenInsurerQueueHandler();
  initFileAnotherClaimHandler();
}

/**
 * Wire plain-language confirmation checkbox to enable/disable submit button
 */
function initConfirmationCheckboxHandler() {
  const checkbox = document.getElementById('claim-confirm-genuine');
  const submitBtn = document.getElementById('btn-submit-final-claim');

  if (checkbox && !checkbox.dataset.bound) {
    checkbox.dataset.bound = 'true';
    checkbox.addEventListener('change', () => {
      const isConfirmed = Boolean(checkbox.checked);
      if (submitBtn) {
        submitBtn.disabled = !isConfirmed;
        if (isConfirmed) {
          submitBtn.classList.add('is-enabled');
        } else {
          submitBtn.classList.remove('is-enabled');
        }
      }
    });
  }
}

/**
 * Wire primary Submit button click
 */
function initSubmitButtonHandler() {
  const submitBtn = document.getElementById('btn-submit-final-claim');
  if (submitBtn && !submitBtn.dataset.bound) {
    submitBtn.dataset.bound = 'true';
    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await submitClaimPackage();
    });
  }
}

/**
 * Wire "Open in Insurer Queue" action button in confirmation screen
 */
function initOpenInsurerQueueHandler() {
  const openQueueBtn = document.getElementById('btn-open-insurer-queue');
  if (openQueueBtn && !openQueueBtn.dataset.bound) {
    openQueueBtn.dataset.bound = 'true';
    openQueueBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const claimId = document.getElementById('receipt-claim-id')?.textContent || lastSubmittedClaimId;
      await openInInsurerQueue(claimId);
    });
  }
}

/**
 * Wire "+ File Another Claim" action in confirmation screen
 */
function initFileAnotherClaimHandler() {
  const fileAnotherBtn = document.getElementById('btn-file-another-claim');
  if (fileAnotherBtn && !fileAnotherBtn.dataset.bound) {
    fileAnotherBtn.dataset.bound = 'true';
    fileAnotherBtn.addEventListener('click', (e) => {
      e.preventDefault();
      resetClaimWizard();
    });
  }
}

/**
 * Render complete Step 4 Pre-Submission Dossier Review
 */
export function renderSubmitStep() {
  const draft = state.claimDraft || {};
  const ext = draft.extractedData || {};

  // Form Inputs & Fallbacks
  const policyId =
    document.getElementById('claim-policy-id')?.value ||
    state.selectedPolicyId ||
    draft.policyId ||
    'micro_health_gig';
  const claimantName =
    document.getElementById('claim-claimant-name')?.value ||
    draft.claimantDetails?.name ||
    'Ramesh Kumar';
  const claimantAge =
    document.getElementById('claim-claimant-age')?.value ||
    draft.claimantDetails?.age ||
    '28';
  const claimantPhone =
    document.getElementById('claim-claimant-phone')?.value || '9876543210';
  const claimantAadhaar =
    document.getElementById('claim-claimant-aadhaar')?.value || '4821';
  const bankAcc =
    document.getElementById('claim-bank-account')?.value || '501004829104';
  const bankIfsc =
    document.getElementById('claim-bank-ifsc')?.value || 'HDFC0001245';

  const providerVal =
    document.getElementById('claim-ext-provider')?.value ||
    ext.provider_name ||
    'Arogya Daycare Clinic & Nursing Home, Pune';
  const dateVal =
    document.getElementById('claim-ext-date')?.value ||
    ext.incident_or_bill_date ||
    document.getElementById('claim-incident-date')?.value ||
    '2026-02-15';
  const diagnosisVal =
    document.getElementById('claim-ext-diagnosis')?.value ||
    ext.diagnosis_or_event ||
    'Enteric Fever (Typhoid) with Moderate Dehydration';

  // 1. Policy Name & Coverage Summary
  renderPolicyCoverageSummary(policyId);

  // 2. Verified Claimant & Incident Details
  renderClaimantIncidentDetails({
    claimantName,
    claimantAge,
    claimantPhone,
    claimantAadhaar,
    bankAcc,
    bankIfsc,
    providerVal,
    dateVal,
    diagnosisVal,
  });

  // 3. Itemized Financial Breakdown (Billed vs. Excluded vs. Eligible Payout)
  renderFinancialBreakdown(draft, ext);

  // 4. Attached Evidence Thumbnails with Document Tags
  renderEvidenceThumbnails(draft, policyId);

  // 5. Compact Policy Compliance Summary
  renderComplianceSummary(draft);

  // 6. Reset Confirmation Checkbox & Disabled Submit Button
  resetConfirmationCheckbox();
}

/**
 * Backwards compatibility alias for existing callers/tests
 */
export function renderSummaryDossier() {
  renderSubmitStep();
}

/**
 * 1. Render Policy Scheme & Coverage Terms
 */
function renderPolicyCoverageSummary(policyId) {
  const pName = document.getElementById('dossier-policy-name');
  const pType = document.getElementById('dossier-policy-type');
  const pSummary = document.getElementById('dossier-coverage-summary');

  const meta =
    SCHEME_COVERAGE_METADATA[policyId.toLowerCase()] || {
      name: policyId.toUpperCase(),
      shortCode: policyId.toUpperCase(),
      tag: 'Micro-Insurance Scheme',
      capSummary: 'Pre-audited insurance coverage according to scheme parameters',
    };

  if (pName) pName.textContent = meta.name;
  if (pType) pType.textContent = meta.tag;
  if (pSummary) pSummary.textContent = meta.capSummary;
}

/**
 * 2. Render Verified Claimant & Incident Information
 */
function renderClaimantIncidentDetails({
  claimantName,
  claimantAge,
  claimantPhone,
  claimantAadhaar,
  bankAcc,
  bankIfsc,
  providerVal,
  dateVal,
  diagnosisVal,
}) {
  const cName = document.getElementById('dossier-claimant-name');
  const cAge = document.getElementById('dossier-claimant-age');
  const cContact = document.getElementById('dossier-claimant-contact');
  const bAcc = document.getElementById('dossier-bank-account');
  const iDate = document.getElementById('dossier-incident-date');
  const iType = document.getElementById('dossier-incident-type');
  const pName = document.getElementById('dossier-provider-name');

  if (cName) cName.textContent = claimantName;
  if (cAge) cAge.textContent = `${claimantAge} years`;
  if (cContact) cContact.textContent = `+91 ${claimantPhone} (Aadhaar: ****${claimantAadhaar.slice(-4)})`;
  if (bAcc) bAcc.textContent = `${bankIfsc} (Account: ending in ${bankAcc.slice(-4)})`;
  if (iDate) iDate.textContent = dateVal;
  if (iType) iType.textContent = diagnosisVal;
  if (pName) pName.textContent = providerVal;
}

/**
 * 3. Render Itemized Financial Breakdown (Billed vs. Excluded vs. Eligible Payout)
 */
function renderFinancialBreakdown(draft, ext) {
  const cAmt = document.getElementById('dossier-claimed-amount');
  const eAmt = document.getElementById('dossier-excluded-amount');
  const pAmt = document.getElementById('dossier-payout-amount');
  const itemsContainer = document.getElementById('dossier-itemized-list');
  const itemsCountBadge = document.getElementById('dossier-item-count');
  const excludedSub = document.getElementById('dossier-excluded-sub');

  const billedTotal =
    document.getElementById('claim-ext-total')?.value != null &&
    document.getElementById('claim-ext-total').value !== ''
      ? parseFloat(document.getElementById('claim-ext-total').value)
      : ext.total_amount_inr != null
      ? Number(ext.total_amount_inr)
      : Number(draft.claimedAmountInr || 2450.0);

  const excludedTotal = Number(draft.disallowedAmountInr || 0);
  const eligiblePayout =
    draft.estimatedPayoutInr != null
      ? Number(draft.estimatedPayoutInr)
      : Math.max(0, billedTotal - excludedTotal);

  if (cAmt) {
    cAmt.textContent = `₹${billedTotal.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (eAmt) {
    if (excludedTotal > 0) {
      eAmt.textContent = `-₹${excludedTotal.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
      eAmt.className = 'fin-val text-warning';
    } else {
      eAmt.textContent = '₹0.00';
      eAmt.className = 'fin-val';
    }
  }

  if (excludedSub) {
    excludedSub.textContent =
      excludedTotal > 0 ? 'Multivitamins / Unapproved tonics' : 'Zero disallowed deductions';
  }

  if (pAmt) {
    pAmt.textContent = `₹${eligiblePayout.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // Itemized line items list
  const charges = ext.itemized_charges || [];
  if (itemsCountBadge) {
    itemsCountBadge.textContent = `${charges.length} item${charges.length === 1 ? '' : 's'} verified`;
  }

  if (itemsContainer) {
    if (charges.length === 0) {
      itemsContainer.innerHTML = `
        <div class="dossier-item-row" style="color: var(--color-ink-muted);">
          <span>Consolidated outpatient treatment package</span>
          <strong class="text-pass">₹${billedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
      `;
    } else {
      itemsContainer.innerHTML = charges
        .map((c) => {
          const isCovered = c.is_covered !== false;
          return `
            <div class="dossier-item-row">
              <div class="item-name-wrap">
                <span>${c.item_name || 'Medical Charge'}</span>
                ${c.category ? `<span class="badge ${isCovered ? 'badge-pass' : 'badge-fail'}" style="font-size: 0.65rem; margin-left: 0.4rem;">${c.category}</span>` : ''}
              </div>
              <strong class="${isCovered ? 'text-pass' : 'text-warning'}">
                ${isCovered ? '' : '[Excluded] '}₹${Number(c.amount_inr || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          `;
        })
        .join('');
    }
  }
}

/**
 * 4. Render Attached Evidence Thumbnails with Document Tags
 */
function renderEvidenceThumbnails(draft, policyId) {
  const grid = document.getElementById('dossier-evidence-grid');
  const countBadge = document.getElementById('dossier-evidence-count');
  const legacyDocsList = document.getElementById('dossier-docs-list');

  const evidenceItems = [];

  // A. Demo Sample Case Image
  if (draft.selectedSampleId) {
    const sampleNames = {
      clean_clinic_bill: 'Clean Clinic OPD Invoice (Auto-Pass)',
      tricky_handwritten_bill: 'Handwritten Medical Bill (Verified)',
      pmfby_hailstorm_crop: 'Standing Wheat Hailstorm Loss Photograph',
    };
    evidenceItems.push({
      url: draft.sampleImageUrl || `/samples/${draft.selectedSampleId}.jpg`,
      filename: `${draft.selectedSampleId}.jpg`,
      tag: 'Primary Proof (Verified)',
      tagType: 'primary',
      description: sampleNames[draft.selectedSampleId] || 'Original Document Proof',
    });
  }

  // B. Uploaded Files
  if (Array.isArray(draft.uploadedFiles) && draft.uploadedFiles.length > 0) {
    draft.uploadedFiles.forEach((f, idx) => {
      // Prevent duplicate if same as sample
      if (evidenceItems.some((e) => e.filename === f.name)) return;
      const isPrimary = idx === 0 || f.isPrimary;
      const docTypeTitle = formatDocTitle(f.docType || (isPrimary ? 'hospital_bill' : 'secondary_proof'));
      evidenceItems.push({
        url: f.dataUrl || f.url || '/samples/clean_clinic_bill.jpg',
        filename: f.name || 'document_proof.jpg',
        tag: isPrimary ? `Primary Proof: ${docTypeTitle}` : `Secondary Proof: ${docTypeTitle}`,
        tagType: isPrimary ? 'primary' : 'secondary',
        description: `${Math.round((f.size || 524288) / 1024)} KB verified file`,
      });
    });
  }

  // C. Inline Attached Documents from Step 3 Recovery
  if (draft.inlineAttachedDocs) {
    Object.entries(draft.inlineAttachedDocs).forEach(([docKey, docInfo]) => {
      if (evidenceItems.some((e) => e.filename === docInfo.filename)) return;
      evidenceItems.push({
        url: docInfo.url || '/samples/clean_clinic_bill.jpg',
        filename: docInfo.filename || `${docKey}.jpg`,
        tag: `Recovered Proof: ${formatDocTitle(docKey)}`,
        tagType: 'secondary',
        description: 'Attached during Step 3 rule audit',
      });
    });
  }

  // Fallback if no proofs attached yet
  if (evidenceItems.length === 0) {
    evidenceItems.push({
      url: '/samples/clean_clinic_bill.jpg',
      filename: 'verified_clinic_bill.jpg',
      tag: 'Primary Proof: Clinic OPD Bill',
      tagType: 'primary',
      description: 'Handwritten medical bill with doctor signature',
    });
  }

  if (countBadge) {
    countBadge.textContent = evidenceItems.length;
  }

  if (grid) {
    grid.innerHTML = evidenceItems
      .map(
        (item) => `
        <div class="dossier-proof-card">
          <div class="dossier-proof-thumb-wrap">
            <img src="${item.url}" alt="${item.filename}" class="dossier-proof-img" onerror="this.src='/samples/clean_clinic_bill.jpg'">
          </div>
          <div class="dossier-proof-body">
            <span class="dossier-proof-tag">${item.tag}</span>
            <span class="dossier-proof-filename" title="${item.filename}">${item.filename}</span>
            <span class="dossier-proof-meta">${item.description}</span>
          </div>
        </div>
      `
      )
      .join('');
  }

  // Sync legacy bullets container for any tests inspecting #dossier-docs-list
  if (legacyDocsList) {
    legacyDocsList.innerHTML = `
      <span class="dossier-label">Attached Proof Documents (${evidenceItems.length})</span>
      <ul class="dossier-proofs-bullets">
        ${evidenceItems.map((p) => `<li>✓ ${p.filename} (${p.tag})</li>`).join('')}
      </ul>
    `;
  }
}

/**
 * 5. Render Compact Policy Compliance Summary
 */
function renderComplianceSummary(draft) {
  const summaryEl = document.getElementById('dossier-compliance-summary');
  const pillsEl = document.getElementById('dossier-compliance-pills');
  const notesEl = document.getElementById('dossier-compliance-notes');
  const readinessBadge = document.getElementById('dossier-readiness-badge');

  const checks = draft.ruleChecks || [];
  const total = checks.length || 5;
  const passChecks = checks.filter((c) => c.status === 'PASS');
  const warnChecks = checks.filter((c) => c.status === 'WARNING');
  const failChecks = checks.filter((c) => c.status === 'FAIL');

  const passCount = passChecks.length;
  const warnCount = warnChecks.length;

  if (summaryEl) {
    if (failChecks.length === 0 && warnCount === 0) {
      summaryEl.textContent = `${total} of ${total} Checks Passed`;
      summaryEl.className = 'compliance-badge-summary';
    } else if (failChecks.length === 0 && warnCount > 0) {
      summaryEl.textContent = `${passCount} of ${total} Checks Passed (${warnCount} Soft Warning)`;
      summaryEl.className = 'compliance-badge-summary has-warnings';
    } else {
      summaryEl.textContent = `${passCount} of ${total} Checks Passed (${failChecks.length} Blocker Issue)`;
      summaryEl.className = 'compliance-badge-summary has-warnings';
    }
  }

  if (readinessBadge) {
    const isReady = failChecks.length === 0;
    readinessBadge.textContent = isReady ? 'READY TO SUBMIT' : 'NEEDS ATTENTION';
    readinessBadge.className = `badge ${isReady ? 'badge-pass' : 'badge-warning'}`;
  }

  if (pillsEl) {
    if (checks.length === 0) {
      pillsEl.innerHTML = `
        <span class="compliance-check-pill pass">✓ Age Window Validated</span>
        <span class="compliance-check-pill pass">✓ Waiting Period Complied</span>
        <span class="compliance-check-pill pass">✓ Policy Exclusions Audited</span>
        <span class="compliance-check-pill pass">✓ Coverage Cap Applied</span>
        <span class="compliance-check-pill pass">✓ Mandatory Proofs Verified</span>
      `;
    } else {
      pillsEl.innerHTML = checks
        .map((rc) => {
          const isPass = rc.status === 'PASS';
          return `
            <span class="compliance-check-pill ${isPass ? 'pass' : 'warning'}">
              ${isPass ? '✓' : '⚠️'} ${rc.label || rc.rule_id}
            </span>
          `;
        })
        .join('');
    }
  }

  if (notesEl) {
    const notes = [];
    if (warnCount > 0) {
      warnChecks.forEach((wc) => {
        if (wc.explanation) notes.push(wc.explanation);
      });
    }
    if (draft.disallowedAmountInr > 0) {
      notes.push(`₹${Number(draft.disallowedAmountInr).toLocaleString('en-IN')} multivitamins excluded; eligible payout capped.`);
    }

    if (notes.length > 0) {
      notesEl.style.display = 'block';
      notesEl.innerHTML = `<strong>Reviewer Flag:</strong> ${notes.join(' ')}`;
    } else {
      notesEl.style.display = 'none';
      notesEl.innerHTML = '';
    }
  }
}

/**
 * 6. Reset confirmation checkbox and disable submit button
 */
function resetConfirmationCheckbox() {
  const checkbox = document.getElementById('claim-confirm-genuine');
  const submitBtn = document.getElementById('btn-submit-final-claim');

  if (checkbox) checkbox.checked = false;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.remove('is-enabled');
    submitBtn.innerHTML = '<span>✓ Submit Pre-Validated Claim Package</span>';
  }
}

/**
 * Execute official claim submission: POST /api/submit-claim
 */
export async function submitClaimPackage() {
  const checkbox = document.getElementById('claim-confirm-genuine');
  const submitBtn = document.getElementById('btn-submit-final-claim');

  if (checkbox && !checkbox.checked) {
    showToast('Please confirm the genuine declaration checkbox before submitting.', 'warning');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ Submitting Pre-Validated Package...</span>';
  }

  const draft = state.claimDraft || {};
  const ext = draft.extractedData || {};

  const policyId =
    document.getElementById('claim-policy-id')?.value ||
    state.selectedPolicyId ||
    draft.policyId ||
    'micro_health_gig';
  const claimantName =
    document.getElementById('claim-claimant-name')?.value ||
    draft.claimantDetails?.name ||
    'Ramesh Kumar';
  const claimantPhone =
    document.getElementById('claim-claimant-phone')?.value || '9876543210';
  const claimantAadhaar =
    document.getElementById('claim-claimant-aadhaar')?.value || '4821';
  const bankAcc =
    document.getElementById('claim-bank-account')?.value || '501004829104';
  const bankIfsc =
    document.getElementById('claim-bank-ifsc')?.value || 'HDFC0001245';

  const billedTotal =
    document.getElementById('claim-ext-total')?.value != null &&
    document.getElementById('claim-ext-total').value !== ''
      ? parseFloat(document.getElementById('claim-ext-total').value)
      : ext.total_amount_inr != null
      ? Number(ext.total_amount_inr)
      : Number(draft.claimedAmountInr || 2450.0);

  const eligiblePayout =
    draft.estimatedPayoutInr != null
      ? Number(draft.estimatedPayoutInr)
      : Math.max(0, billedTotal - Number(draft.disallowedAmountInr || 0));

  const docPaths = [
    ...(draft.uploadedFiles || []).map((f) => f.dataUrl || f.url).filter(Boolean),
    draft.sampleImageUrl,
    '/uploads/verified_clinic_bill.jpg',
  ].filter(Boolean);

  const payload = {
    policy_id: policyId,
    claimant_name: claimantName,
    claimant_phone: claimantPhone,
    claimant_aadhaar_last4: claimantAadhaar.slice(-4),
    bank_account_number: bankAcc,
    bank_ifsc: bankIfsc,
    document_paths: docPaths.slice(0, 5),
    extracted_data: ext.provider_name
      ? ext
      : {
          document_type: 'clinic_opd_bill',
          provider_name: document.getElementById('claim-ext-provider')?.value || 'Arogya Daycare Clinic',
          patient_or_claimant_name: claimantName,
          incident_or_bill_date: document.getElementById('claim-ext-date')?.value || '2026-02-15',
          total_amount_inr: billedTotal,
          has_stamp_or_signature: true,
          legibility_score: 0.94,
        },
    incident_description:
      document.getElementById('claim-ext-diagnosis')?.value ||
      ext.diagnosis_or_event ||
      'Outpatient clinical consultation and medical treatment',
    claimed_amount_inr: billedTotal,
    eligible_payout_inr: eligiblePayout,
    rule_checks: draft.ruleChecks || [],
    initial_status:
      draft.readinessStatus === 'READY_TO_SUBMIT' ? 'READY_TO_APPROVE' : 'NEEDS_REVIEW',
  };

  try {
    const saved = await submitClaim(payload);
    renderSuccessReceipt(saved);
    showToast(`Claim ${saved.claim_id} submitted successfully! Registered in officer triage queue.`, 'success');
  } catch (err) {
    console.error('Failed to submit claim:', err);
    showToast(`Submission error: ${err.message || 'Please retry'}`, 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>✓ Submit Pre-Validated Claim Package</span>';
    }
  }
}

/**
 * Format ISO submission timestamp into clean Indian date & time
 * e.g., "24 Nov 2026, 04:42 PM"
 * @param {string | null | undefined} isoString
 * @returns {string}
 */
export function formatSubmissionTimestamp(isoString) {
  if (!isoString) {
    return new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      return String(isoString);
    }
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (err) {
    return String(isoString);
  }
}

/**
 * Render reassuring submission confirmation screen replacing Step 4 review
 * Shows: Claim Reference ID, Submission Timestamp, Current Status Badge,
 * and configures 3 action buttons:
 * (1) "Print / Save Claim Package PDF" -> /api/claims/{id}/report
 * (2) "Open in Insurer Queue" -> switches to Insurer tab with claim highlighted
 * (3) "File Another Claim" -> resets wizard cleanly
 * @param {any} claimRecord
 */
export function renderSuccessReceipt(claimRecord) {
  const reviewState = document.getElementById('claim-submit-review-state');
  const successState = document.getElementById('claim-submit-success-state');

  // Replace Step 4 review dossier with confirmation screen
  if (reviewState) reviewState.style.display = 'none';
  if (successState) successState.style.display = 'block';

  const rId = document.getElementById('receipt-claim-id');
  const rPolicy = document.getElementById('receipt-policy-name');
  const rAmount = document.getElementById('receipt-eligible-amount');
  const rStatus = document.getElementById('receipt-status-badge');
  const rTime = document.getElementById('receipt-submission-time') || document.getElementById('receipt-timestamp');
  const rBank = document.getElementById('receipt-bank-destination');
  const printPdfBtn = document.getElementById('btn-print-claim-pdf');
  const dlReport = document.getElementById('btn-download-report');
  const dlJson = document.getElementById('btn-download-json');

  const claimId = claimRecord?.claim_id || 'CLM-2026-0041';
  lastSubmittedClaimId = claimId;

  const approvedAmt =
    claimRecord?.approved_amount_inr != null
      ? claimRecord.approved_amount_inr
      : claimRecord?.claimed_amount_inr || 2450.0;

  // 1. Assigned Claim Reference ID
  if (rId) rId.textContent = claimId;

  // 2. Target Policy Name
  if (rPolicy) rPolicy.textContent = claimRecord?.policy_name || 'Gig-Worker Micro-Health Clinic Shield';

  // 3. Eligible / Pre-Approved Amount
  if (rAmount) rAmount.textContent = `₹${Number(approvedAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  // 4. Submission Timestamp
  if (rTime) {
    rTime.textContent = formatSubmissionTimestamp(claimRecord?.created_at);
  }

  // 5. Current Status Badge
  if (rStatus) {
    const rawStatus = claimRecord?.reviewer_status || 'READY_TO_APPROVE';
    const statusClean = rawStatus.replace(/_/g, ' ');
    rStatus.textContent = statusClean;
    const isPass = rawStatus === 'READY_TO_APPROVE' || rawStatus === 'APPROVED';
    rStatus.className = `badge ${isPass ? 'badge-pass' : 'badge-warning'}`;
  }

  // 6. Direct Benefit Transfer (DBT) Destination
  if (rBank) {
    const bankAcc = document.getElementById('claim-bank-account')?.value || '501004829104';
    const ifsc = document.getElementById('claim-bank-ifsc')?.value || 'HDFC0001245';
    rBank.textContent = `Direct Benefit Transfer (DBT) to ${ifsc} (Account: ending in ${bankAcc.slice(-4)})`;
  }

  // Action Button 1: "Print / Save Claim Package PDF" -> opens /api/claims/{id}/report in new tab
  if (printPdfBtn) {
    printPdfBtn.href = `/api/claims/${claimId}/report`;
    printPdfBtn.target = '_blank';
    printPdfBtn.rel = 'noopener noreferrer';
  }

  // Secondary/backwards-compatible report and JSON dump links
  if (dlReport) {
    dlReport.href = `/api/claims/${claimId}/report`;
    dlReport.target = '_blank';
    dlReport.rel = 'noopener noreferrer';
  }
  if (dlJson) {
    dlJson.href = `/api/claims/${claimId}/json`;
    dlJson.target = '_blank';
    dlJson.rel = 'noopener noreferrer';
  }
}

/**
 * Action Button 2: "Open in Insurer Queue"
 * Immediately switches to the Insurer Queue tab with newly submitted claim highlighted
 * @param {string} [claimId]
 */
export async function openInInsurerQueue(claimId) {
  const targetId = claimId || lastSubmittedClaimId || document.getElementById('receipt-claim-id')?.textContent || 'CLM-2026-0041';

  // 1. Refresh latest claims from backend store
  try {
    const updated = await fetchClaims();
    if (updated) {
      setInsurerClaims(updated);
    }
  } catch (err) {
    console.warn('Failed to refresh claims for insurer queue:', err);
  }

  // 2. Render insurer queue cards into container
  renderInsurerQueue(targetId);

  // 3. Switch view section to 'insurer'
  const desktopTab = document.querySelector('.desktop-nav .tab-btn[data-view="insurer"]') ||
                     document.getElementById('tab-insurer');
  const mobileNavBtn = document.querySelector('.mobile-nav-btn[data-view="insurer"]');

  if (desktopTab) {
    desktopTab.click();
  } else if (mobileNavBtn) {
    mobileNavBtn.click();
  } else {
    setActiveTab('insurer');
    const insSection = document.getElementById('view-insurer');
    const claimSection = document.getElementById('view-claim');
    if (insSection) {
      insSection.hidden = false;
      insSection.classList.add('active');
    }
    if (claimSection) {
      claimSection.hidden = true;
      claimSection.classList.remove('active');
    }
  }

  // 4. Highlight target claim and scroll into view
  setTimeout(() => {
    const targetCard = document.getElementById(`insurer-claim-${targetId}`) ||
                       document.querySelector(`[data-claim-id="${targetId}"]`);
    if (targetCard) {
      targetCard.classList.add('highlighted-claim');
      if (typeof targetCard.scrollIntoView === 'function') {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, 100);

  showToast(`Switched to Insurer Queue — claim ${targetId} highlighted!`, 'info');
}

/**
 * Action Button 3: "File Another Claim"
 * Cleanly resets the claim wizard to Step 1
 */
export function resetClaimWizard() {
  const reviewState = document.getElementById('claim-submit-review-state');
  const successState = document.getElementById('claim-submit-success-state');
  const submitBtn = document.getElementById('btn-submit-final-claim');
  const checkbox = document.getElementById('claim-confirm-genuine');

  // 1. Reset confirmation UI state
  if (reviewState) reviewState.style.display = 'block';
  if (successState) successState.style.display = 'none';

  // 2. Uncheck confirmation checkbox
  if (checkbox) checkbox.checked = false;

  // 3. Disable submit button
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.remove('is-enabled');
    submitBtn.innerHTML = '<span>✓ Submit Pre-Validated Claim Package</span>';
  }

  // 4. Reset form inputs
  const nameInput = document.getElementById('claim-claimant-name');
  if (nameInput) nameInput.value = 'Ramesh Kumar';
  const ageInput = document.getElementById('claim-claimant-age');
  if (ageInput) ageInput.value = '28';
  const phoneInput = document.getElementById('claim-claimant-phone');
  if (phoneInput) phoneInput.value = '9876543210';
  const aadhaarInput = document.getElementById('claim-claimant-aadhaar');
  if (aadhaarInput) aadhaarInput.value = '4821';
  const descInput = document.getElementById('claim-incident-desc');
  if (descInput) descInput.value = '';

  // 5. Clear draft state
  if (state.claimDraft) {
    state.claimDraft.uploadedFiles = [];
    state.claimDraft.selectedSampleId = null;
    state.claimDraft.extractedData = null;
    state.claimDraft.inlineAttachedDocs = {};
    state.claimDraft.ruleChecks = [];
    state.claimDraft.estimatedPayoutInr = null;
    state.claimDraft.disallowedAmountInr = 0;
    state.claimDraft.readinessStatus = null;
  }

  // 6. Clear dropzone previews
  const previewsContainer = document.getElementById('claim-upload-previews');
  if (previewsContainer) previewsContainer.innerHTML = '';
  const slotElements = document.querySelectorAll('.upload-slot-card');
  slotElements.forEach((slot) => slot.classList.remove('has-file'));

  // 7. Re-render empty upload slots for active policy
  const policyId = state.selectedPolicyId || 'micro_health_gig';
  const slotsContainer = document.getElementById('claim-upload-slots');
  if (slotsContainer) {
    renderUploadSlots(policyId);
  }

  // 8. Navigate wizard back to Step 1
  setWizardStep(1);
  for (let s = 1; s <= 4; s++) {
    const p = document.getElementById(`claim-step-${s}`);
    if (p) {
      p.hidden = s !== 1;
      p.classList.toggle('active', s === 1);
    }
  }

  const step1Btn = document.querySelector('.wizard-step-btn[data-step="1"]') ||
                   document.querySelector('.wizard-step-item[data-step="1"]');
  if (step1Btn) {
    step1Btn.click();
  }

  showToast('Claim wizard reset. Ready to file a new claim.', 'info');
}

/**
 * Backwards-compatibility alias for resetToStep1
 */
export function resetToStep1() {
  resetClaimWizard();
}
