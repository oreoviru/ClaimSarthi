/**
 * SurakshaSetu — Step 3: Verify Policy Rules & Actionable Fix-It
 * File: static/js/verifyStep.js
 *
 * Responsive Layout:
 * - Desktop (>= 1024px): Pinned uploaded document proof on left with click-to-zoom modal,
 *   extracted structured data form & policy guardrails on right.
 * - Mobile (< 1024px): Collapsible photo preview stacked cleanly above editable fields.
 *
 * Verification Fields:
 * 1. Healthcare Provider / Clinic Name
 * 2. Bill / Incident Date
 * 3. Diagnosis / Damage Type
 * 4. Total Amount (₹)
 * 5. Itemized Line Items Extraction
 *
 * Guardrail Highlighting:
 * - Highlights any field flagged with low confidence (< 0.75) or null with an amber outline
 *   and a clear "Please verify handwritten value" hint.
 */

import { state } from './state.js';
import { revalidateClaim, showToast } from './api.js';

export const CONFIDENCE_THRESHOLD = 0.75;

// Zoom Modal State
let currentZoomLevel = 1.0;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.25;

// Mobile Collapsible Preview State
let isMobilePreviewCollapsed = false;

/**
 * Initialize Step 3 DOM Event Handlers:
 * - Click-to-Zoom Lightbox Modal
 * - Mobile Collapsible Preview Toggle
 * - Real-time Field Input Change & Verification Listeners
 * - Re-Validate Claim Rule Checks Button
 */
export function initVerifyStep() {
  initZoomModalHandlers();
  initMobilePreviewToggle();
  initFieldChangeListeners();
  initRevalidationHandler();
  initInlineRecoveryHandlers();
}

/**
 * Render complete Step 3 verification workspace:
 * @param {any} res - Backend analyze-claim or analyze-sample response
 * @param {string} [customImageUrl] - Custom preview image URL if provided
 */
export function renderVerifyStep(res, customImageUrl) {
  if (!res) return;

  const ext = res.extracted_data || {};
  const confidences = ext.field_confidences || res.confidence_scores || {};

  // 1. Update Document Image Inspector Preview
  updateDocumentPreview(res, ext, customImageUrl);

  // 2. Populate and highlight editable structured fields
  populateAndAuditFields(ext, confidences);

  // 3. Render Itemized Line Items
  renderItemizedCharges(ext.itemized_charges || []);

  // 4. Update Readiness Score & Status Banner
  updateReadinessBanner(res, ext);

  // 5. Update Policy Guardrail Checks List
  renderRuleChecksList(res.rule_checks || []);

  // 6. Update Actionable Fix-It Items List
  renderFixItList(res.actionable_checklist || res.fix_it_checklist || []);
}

/**
 * Update Document Image Preview, Filename, and Zoom Source
 */
function updateDocumentPreview(res, ext, customImageUrl) {
  const previewImg = document.getElementById('claim-inspector-image');
  const filenameEl = document.getElementById('inspector-doc-filename');
  const fullLink = document.getElementById('inspector-view-full');
  const docBadge = document.getElementById('inspector-doc-badge');
  const zoomModalImg = document.getElementById('zoom-modal-img');
  const zoomModalFilename = document.getElementById('zoom-modal-filename');

  const imageUrl =
    customImageUrl ||
    state.claimDraft.sampleImageUrl ||
    (res.uploaded_file_urls && res.uploaded_file_urls[0]) ||
    (state.claimDraft.uploadedFiles && state.claimDraft.uploadedFiles[0]?.dataUrl) ||
    '/samples/clean_clinic_bill.jpg';

  const filename = state.claimDraft.selectedSampleId
    ? `${state.claimDraft.selectedSampleId}.jpg`
    : state.claimDraft.uploadedFiles?.[0]?.name || 'document_proof.jpg';

  if (previewImg) {
    previewImg.src = imageUrl;
    previewImg.alt = ext.provider_name ? `${ext.provider_name} Document Proof` : 'Document Proof';
  }

  if (filenameEl) filenameEl.textContent = filename;
  if (fullLink) fullLink.href = imageUrl;
  if (zoomModalImg) zoomModalImg.src = imageUrl;
  if (zoomModalFilename) zoomModalFilename.textContent = filename;

  if (docBadge) {
    docBadge.textContent = state.claimDraft.selectedSampleId ? 'Sample Bill Preview' : 'Verified Upload';
  }
}

/**
 * Populate structured fields and apply amber outline for confidence < 0.75 or null
 * Fields:
 * - Provider / Clinic Name
 * - Bill / Incident Date
 * - Total Amount (₹)
 * - Diagnosis / Damage Type
 */
function populateAndAuditFields(ext, confidences) {
  // Provider / Clinic Name
  const providerInput = document.getElementById('claim-ext-provider');
  const providerVal = ext.provider_name || '';
  if (providerInput) providerInput.value = providerVal;
  const provConf = getConfidenceScore('provider_name', confidences, providerVal);
  auditFieldElement('claim-ext-provider', 'hint-ext-provider', 'tag-ext-provider', providerVal, provConf, 'Provider / Clinic Name');

  // Bill / Incident Date
  const dateInput = document.getElementById('claim-ext-date');
  const dateVal = ext.incident_or_bill_date || ext.bill_date || '';
  if (dateInput) dateInput.value = dateVal;
  const dateConf = getConfidenceScore('incident_or_bill_date', confidences, dateVal, ['bill_date']);
  auditFieldElement('claim-ext-date', 'hint-ext-date', 'tag-ext-date', dateVal, dateConf, 'Bill Date');

  // Total Amount (₹)
  const totalInput = document.getElementById('claim-ext-total');
  const totalVal = ext.total_amount_inr != null ? Number(ext.total_amount_inr) : null;
  if (totalInput) totalInput.value = totalVal != null ? totalVal.toFixed(2) : '';
  const totalConf = getConfidenceScore('total_amount_inr', confidences, totalVal, ['total_amount']);
  auditFieldElement('claim-ext-total', 'hint-ext-total', 'tag-ext-total', totalVal, totalConf, 'Total Amount');

  // Diagnosis / Damage Type
  const diagnosisInput = document.getElementById('claim-ext-diagnosis');
  const diagnosisVal = ext.diagnosis_or_event || ext.diagnosis || '';
  if (diagnosisInput) diagnosisInput.value = diagnosisVal;
  const diagConf = getConfidenceScore('diagnosis_or_event', confidences, diagnosisVal, ['diagnosis']);
  auditFieldElement('claim-ext-diagnosis', 'hint-ext-diagnosis', 'tag-ext-diagnosis', diagnosisVal, diagConf, 'Diagnosis / Event');

  // Legibility Badge
  const legibilityBadge = document.getElementById('claim-legibility-badge');
  if (legibilityBadge) {
    const legibilityPct = Math.round((ext.legibility_score != null ? ext.legibility_score : 0.94) * 100);
    legibilityBadge.textContent = `${legibilityPct}% Legibility`;
    legibilityBadge.className = `badge ${legibilityPct >= 80 ? 'badge-pass' : 'badge-warning'}`;
  }
}

/**
 * Get numerical confidence score for a field key with optional alias fallback
 * @param {string} key
 * @param {Record<string, number>} confidences
 * @param {any} value
 * @param {string[]} [aliases]
 * @returns {number}
 */
export function getConfidenceScore(key, confidences, value, aliases = []) {
  if (confidences && confidences[key] !== undefined && confidences[key] !== null) {
    return Number(confidences[key]);
  }
  for (const alias of aliases) {
    if (confidences && confidences[alias] !== undefined && confidences[alias] !== null) {
      return Number(confidences[alias]);
    }
  }
  // If value is missing / null / empty string, confidence is 0
  if (value === null || value === undefined || String(value).trim() === '') {
    return 0.0;
  }
  // Default fallback when not explicitly penalized
  return 1.0;
}

/**
 * Apply amber outline and hint if confidence < 0.75 or null, otherwise clear
 * @param {string} inputId
 * @param {string} hintId
 * @param {string} tagId
 * @param {any} value
 * @param {number} confidence
 * @param {string} label
 */
export function auditFieldElement(inputId, hintId, tagId, value, confidence, label) {
  const inputEl = document.getElementById(inputId);
  const hintEl = document.getElementById(hintId);
  const tagEl = document.getElementById(tagId);

  if (!inputEl) return;

  const isNullOrEmpty = value === null || value === undefined || String(value).trim() === '';
  const isLowConfidence = confidence < CONFIDENCE_THRESHOLD || isNullOrEmpty;

  if (isLowConfidence) {
    // Amber outline highlight
    inputEl.classList.add('is-low-confidence');
    inputEl.classList.remove('is-user-verified');

    if (hintEl) {
      hintEl.style.display = 'flex';
      hintEl.className = 'field-verify-hint hint-amber';
      const pctDisplay = isNullOrEmpty ? 'missing' : `${Math.round(confidence * 100)}% confidence`;
      hintEl.innerHTML = `
        <span class="hint-icon" aria-hidden="true">⚠️</span>
        <span class="hint-text">Please verify handwritten value</span>
        <span class="conf-badge-pill">${pctDisplay}</span>
      `;
    }

    if (tagEl) {
      tagEl.innerHTML = '<span class="badge badge-warning">Needs Verification</span>';
    }
  } else {
    // Normal / Verified state
    inputEl.classList.remove('is-low-confidence');

    if (hintEl) {
      hintEl.style.display = 'none';
      hintEl.innerHTML = '';
    }

    if (tagEl) {
      tagEl.innerHTML = '<span class="badge badge-pass">Verified ✓</span>';
    }
  }
}

/**
 * Render itemized line items list with badges and amounts
 * @param {Array<any>} charges
 */
export function renderItemizedCharges(charges = []) {
  const itemizedList = document.getElementById('claim-itemized-list');
  const countBadge = document.getElementById('itemized-count-badge');

  if (countBadge) {
    countBadge.textContent = `${charges.length} item${charges.length === 1 ? '' : 's'}`;
  }

  if (!itemizedList) return;

  if (charges.length === 0) {
    itemizedList.innerHTML = '<div class="empty-items-hint">No itemized charges extracted yet.</div>';
    return;
  }

  itemizedList.innerHTML = charges
    .map((c) => {
      const isCovered = c.is_covered !== false;
      const categoryTag = c.category ? `<span class="item-cat-badge">${c.category}</span>` : '';
      return `
        <div class="itemized-row ${isCovered ? 'item-pass' : 'item-excluded'}">
          <div class="item-info-wrap">
            <span class="item-name">${c.item_name || 'Line Item'}</span>
            ${categoryTag}
            ${c.exclusion_reason ? `<span class="item-exclusion-note">⚠️ ${c.exclusion_reason}</span>` : ''}
          </div>
          <div class="item-amt-wrap">
            <span class="badge ${isCovered ? 'badge-pass' : 'badge-fail'}">
              ${isCovered ? 'Covered' : 'Excluded'}
            </span>
            <strong class="item-amt">₹${Number(c.amount_inr || 0).toLocaleString('en-IN')}</strong>
          </div>
        </div>
      `;
    })
    .join('');
}

/**
 * Update Readiness Score and Summary Banner (both top banner and scorecard summary bar)
 * @param {any} res - Claim analysis response
 * @param {any} ext - Extracted bill data
 */
export function updateReadinessBanner(res, ext = {}) {
  // 1. Calculate and normalize Readiness Score (0-100%)
  const score = Math.round(res.readiness_score != null ? res.readiness_score : 100);
  const scoreVal = document.getElementById('claim-readiness-score');
  const scorecardReadinessVal = document.getElementById('scorecard-readiness-val');
  const meterFill = document.getElementById('scorecard-meter-fill');
  const scorecardReadinessSub = document.getElementById('scorecard-readiness-sub');

  if (scoreVal) scoreVal.textContent = `${score}%`;
  if (scorecardReadinessVal) scorecardReadinessVal.textContent = `${score}%`;

  if (meterFill) {
    meterFill.style.width = `${Math.min(100, Math.max(0, score))}%`;
    meterFill.className = `scorecard-meter-fill ${
      score >= 80 ? 'meter-pass' : score >= 50 ? 'meter-warning' : 'meter-fail'
    }`;
  }

  if (scorecardReadinessSub) {
    scorecardReadinessSub.textContent =
      score >= 80
        ? 'High OCR clarity & strong rule compliance'
        : score >= 50
        ? 'Verification needed for smudged or missing items'
        : 'Significant policy exclusions or missing mandatory proof';
  }

  // 2. Normalize Overall Status (READY TO SUBMIT, NEEDS FIXES, or NOT COVERED)
  let rawStatus = res.readiness_status || '';
  if (!rawStatus) {
    const elig = (res.overall_eligibility || '').toUpperCase();
    if (elig === 'PASS') rawStatus = 'READY_TO_SUBMIT';
    else if (elig === 'WARNING') rawStatus = 'NEEDS_FIXES';
    else if (elig === 'FAIL') rawStatus = 'NOT_COVERED';
    else rawStatus = 'READY_TO_SUBMIT';
  }

  // Strictly convert underscores to spaces: READY TO SUBMIT, NEEDS FIXES, NOT COVERED
  const cleanStatus = rawStatus.replace(/_/g, ' ').toUpperCase();
  const statusBadge = document.getElementById('claim-readiness-badge');
  const scorecardStatusVal = document.getElementById('scorecard-status-val');
  const scorecardStatusSub = document.getElementById('scorecard-status-sub');
  const readinessTitle = document.getElementById('claim-readiness-title');
  const readinessDesc = document.getElementById('claim-readiness-desc');

  const statusType =
    cleanStatus === 'READY TO SUBMIT'
      ? 'pass'
      : cleanStatus === 'NEEDS FIXES'
      ? 'warning'
      : 'fail';

  if (statusBadge) {
    statusBadge.textContent = cleanStatus;
    statusBadge.className = `badge badge-${statusType}`;
  }

  if (scorecardStatusVal) {
    scorecardStatusVal.textContent = cleanStatus;
    scorecardStatusVal.className = `scorecard-status-badge status-${statusType}`;
  }

  if (scorecardStatusSub) {
    scorecardStatusSub.textContent =
      statusType === 'pass'
        ? 'Passes underwriting guardrails'
        : statusType === 'warning'
        ? 'Actionable fixes required before submission'
        : 'Policy exclusions or eligibility limits exceeded';
  }

  if (readinessTitle) {
    readinessTitle.textContent =
      statusType === 'pass'
        ? 'Ready to Submit (Passes Underwriting Guardrails)'
        : statusType === 'warning'
        ? 'Fix-It Items Detected (Resolve Before Submission)'
        : 'Ineligible (Exclusions Detected)';
  }

  if (readinessDesc) {
    readinessDesc.textContent =
      statusType === 'pass'
        ? 'Zero blocker errors found. All proofs match policy terms.'
        : 'Address the highlighted items below to prevent claim rejection.';
  }

  // 3. Estimated Payable Payout (₹) vs Billed Amount
  const claimedAmt = document.getElementById('claim-val-claimed');
  const payoutAmt = document.getElementById('claim-val-payout');
  const scorecardBilledVal = document.getElementById('scorecard-billed-val');
  const scorecardPayoutVal = document.getElementById('scorecard-payout-val');
  const scorecardDeductionVal = document.getElementById('scorecard-deduction-val');
  const scorecardDeductionWrap = document.getElementById('scorecard-deduction-wrap');

  const billedTotal =
    ext.total_amount_inr != null
      ? Number(ext.total_amount_inr)
      : Number(res.claimed_amount_inr || 0);

  const estimatedPayout =
    res.eligible_payout_inr != null
      ? Number(res.eligible_payout_inr)
      : Number(res.estimated_payout_inr || 0);

  const disallowedAmt = Number(res.disallowed_amount_inr || 0);

  const billedFormatted = `₹${billedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const payoutFormatted = `₹${estimatedPayout.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (claimedAmt) claimedAmt.textContent = billedFormatted;
  if (payoutAmt) payoutAmt.textContent = payoutFormatted;
  if (scorecardBilledVal) scorecardBilledVal.textContent = billedFormatted;
  if (scorecardPayoutVal) scorecardPayoutVal.textContent = payoutFormatted;

  if (scorecardDeductionVal) {
    if (disallowedAmt > 0) {
      scorecardDeductionVal.textContent = `₹${disallowedAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} excluded`;
      scorecardDeductionVal.style.color = '#b45309';
      if (scorecardDeductionWrap) scorecardDeductionWrap.style.display = 'block';
    } else {
      scorecardDeductionVal.textContent = '₹0.00 excluded';
      scorecardDeductionVal.style.color = 'var(--color-ink-muted)';
      if (scorecardDeductionWrap) scorecardDeductionWrap.style.display = 'block';
    }
  }
}

/**
 * Format document key into human-readable official title
 * @param {string} key
 * @returns {string}
 */
export function formatDocTitle(key = '') {
  const map = {
    doctor_prescription: 'Doctor Consultation Prescription',
    prescription: 'Doctor Consultation Prescription & Pharmacy Voucher',
    land_record_ror: 'Land Record (RoR / 7/12 Patta / Khasra)',
    crop_damage_photo: 'Crop Damage / Inundation Field Photograph',
    sowing_certificate: 'Crop Sowing Certificate / Patwari Report',
    death_certificate: 'Death Certificate / Police Inquest Report',
    ayushman_ecard: 'Ayushman Bharat PM-JAY Golden e-Card',
    hospital_discharge_summary: 'Hospital Discharge Summary & Treatment Sheet',
    fir_or_police_report: 'Police First Information Report (FIR) / Panchnama',
    disability_certificate: 'Civil Surgeon Permanent Disability Certificate',
    hospital_bill: 'Handwritten Hospital Bill / Clinic Invoice',
    clinic_opd_bill: 'Handwritten Hospital Bill / Clinic Invoice',
  };
  return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Check if a specific document type has been attached (via Step 2 or inline recovery)
 * @param {string} docKey
 * @returns {boolean}
 */
export function isInlineDocAttached(docKey) {
  if (state.claimDraft.inlineAttachedDocs && state.claimDraft.inlineAttachedDocs[docKey]) {
    return true;
  }
  const aliases = [docKey];
  if (docKey === 'doctor_prescription') aliases.push('prescription');
  if (docKey === 'prescription') aliases.push('doctor_prescription');
  if (docKey === 'hospital_bill') aliases.push('clinic_opd_bill');
  if (docKey === 'clinic_opd_bill') aliases.push('hospital_bill');

  if (state.claimDraft.uploadedDocTypes && Array.isArray(state.claimDraft.uploadedDocTypes)) {
    if (aliases.some((a) => state.claimDraft.uploadedDocTypes.includes(a))) {
      return true;
    }
  }
  return false;
}

/**
 * Render Policy Guardrail Rule Checks List
 * Each row includes:
 * - Visual status indicator: PASS in emerald, WARNING in amber, FAIL in crimson
 * - Plain-English explanation (e.g., "₹450 multivitamins excluded; capped at ₹5,000 limit")
 * - Exact next action (e.g., "No action needed: fully compliant with policy terms" or required step)
 * - Interactive recovery controls for FAIL checks with missing documents:
 *     * Inline "Upload Now" file button
 *     * Quick "Attach Demo Proof" helper button for stage demos
 * @param {Array<any>} checks
 */
export function renderRuleChecksList(checks = []) {
  const rulesList = document.getElementById('claim-rule-checks-list');
  if (!rulesList) return;

  if (!checks || checks.length === 0) {
    rulesList.innerHTML = '<div class="empty-rules-hint">No rule checks available. Run an audit to inspect policy rules.</div>';
    return;
  }

  rulesList.innerHTML = checks
    .map((rc) => {
      const statusRaw = (rc.status || 'PASS').toUpperCase();
      const statusType = statusRaw === 'PASS' ? 'pass' : statusRaw === 'WARNING' ? 'warning' : 'fail';
      const statusIcon = statusRaw === 'PASS' ? '✓' : statusRaw === 'WARNING' ? '⚠️' : '✕';
      const statusBadgeText = `${statusIcon} ${statusRaw}`;

      // Plain-English explanation
      const explanation = rc.explanation || 'No detailed explanation provided.';

      // Exact next action
      let nextActionText = '';
      if (statusRaw === 'PASS') {
        nextActionText = rc.action_required || 'No action needed: fully compliant with policy terms.';
      } else {
        nextActionText = rc.action_required || 'Review document and verify highlighted details to resolve this check.';
      }

      // Missing Documents & Inline Interactive Recovery Controls
      let missingDocsHtml = '';
      if (
        rc.missing_documents &&
        typeof rc.missing_documents === 'object' &&
        Object.keys(rc.missing_documents).length > 0
      ) {
        if (statusRaw === 'FAIL') {
          // Interactive Recovery Controls for FAIL checks
          const recoveryItems = Object.entries(rc.missing_documents)
            .map(([docKey, docPrompt]) => {
              const isAttached = isInlineDocAttached(docKey);
              const attachedData = state.claimDraft.inlineAttachedDocs?.[docKey];
              const docTitle = formatDocTitle(docKey);

              if (isAttached) {
                return `
                  <div class="recovery-doc-card is-attached" data-doc-key="${docKey}">
                    <div class="recovery-doc-header">
                      <div class="recovery-doc-title-wrap">
                        <span class="recovery-doc-icon" aria-hidden="true">✓</span>
                        <strong class="recovery-doc-title">${docTitle}</strong>
                      </div>
                      <span class="recovery-doc-status-badge status-attached">✓ Attached</span>
                    </div>
                    <p class="recovery-doc-desc">Document attached and ready for rule verification.</p>
                    <div class="recovery-attached-strip">
                      <div class="attached-proof-meta">
                        <span class="attached-proof-icon" aria-hidden="true">📄</span>
                        <span class="attached-proof-filename">${attachedData?.filename || `${docTitle}.jpg`}</span>
                        <span class="badge badge-pass" style="font-size: 0.68rem;">Ready to Re-Check</span>
                      </div>
                      <button type="button" class="btn-remove-inline-doc" data-doc-key="${docKey}" aria-label="Remove uploaded ${docTitle}">Remove</button>
                    </div>
                  </div>
                `;
              } else {
                return `
                  <div class="recovery-doc-card" data-doc-key="${docKey}">
                    <div class="recovery-doc-header">
                      <div class="recovery-doc-title-wrap">
                        <span class="recovery-doc-icon" aria-hidden="true">⚠️</span>
                        <strong class="recovery-doc-title">${docTitle}</strong>
                      </div>
                      <span class="recovery-doc-status-badge status-missing">Missing Proof</span>
                    </div>
                    <p class="recovery-doc-desc">${docPrompt}</p>
                    <div class="recovery-actions-row">
                      <input type="file" id="inline-file-${docKey}" class="inline-doc-file-input visually-hidden" data-doc-key="${docKey}" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" aria-label="File upload for ${docTitle}">
                      <button type="button" class="btn btn-sm btn-inline-upload" data-doc-key="${docKey}" aria-label="Upload ${docTitle} now">
                        <span>📁 Upload Now</span>
                      </button>
                      <button type="button" class="btn btn-sm btn-inline-demo-proof" data-doc-key="${docKey}" title="Attach pre-configured verified proof for live demo" aria-label="Attach verified demo proof for ${docTitle}">
                        <span>⚡ Attach Demo Proof</span>
                      </button>
                    </div>
                  </div>
                `;
              }
            })
            .join('');
          missingDocsHtml = `<div class="recovery-controls-box">${recoveryItems}</div>`;
        } else {
          // Non-FAIL chips display
          const docItems = Object.entries(rc.missing_documents)
            .map(([docKey, docPrompt]) => {
              const docName = formatDocTitle(docKey);
              return `
                <div class="missing-doc-chip">
                  <span class="chip-label">📄 ${docName}:</span>
                  <span class="chip-desc">${docPrompt}</span>
                </div>
              `;
            })
            .join('');
          missingDocsHtml = `<div class="missing-docs-box">${docItems}</div>`;
        }
      }

      return `
        <div class="rule-check-row rule-${statusType}" data-rule-id="${rc.rule_id || ''}" data-status="${statusRaw}">
          <div class="rule-header-row">
            <div class="rule-title-group">
              <span class="rule-status-icon-dot ${statusType}" aria-hidden="true"></span>
              <strong class="rule-label">${rc.label || rc.rule_id}</strong>
            </div>
            <span class="rule-status-badge status-${statusType}">
              ${statusBadgeText}
            </span>
          </div>

          <div class="rule-body-row">
            <p class="rule-explanation">${explanation}</p>
          </div>

          <div class="rule-next-action-row action-${statusType}">
            <div class="action-label-wrap">
              <span class="action-icon" aria-hidden="true">${statusRaw === 'PASS' ? '✓' : '⚡'}</span>
              <span class="action-heading">Exact Next Action:</span>
            </div>
            <div class="action-text-wrap">
              <span class="action-text">${nextActionText}</span>
              ${missingDocsHtml}
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  // Wire interactive handlers for all newly rendered recovery buttons
  initInlineRecoveryHandlers();
}

/**
 * Render Actionable Fix-It Items Checklist
 * @param {Array<string>} fixItems
 */
function renderFixItList(fixItems = []) {
  const fixitList = document.getElementById('claim-fixit-list');
  if (!fixitList) return;

  if (fixItems.length === 0) {
    fixitList.innerHTML = '<div class="empty-fixit-hint">✓ All checks passed! No actions required.</div>';
    return;
  }

  fixitList.innerHTML = fixItems
    .map(
      (item, idx) => `
      <div class="fixit-item-card" data-fixit-idx="${idx}">
        <span class="fixit-bullet" aria-hidden="true">⚡</span>
        <div class="fixit-content">
          <span>${item}</span>
        </div>
      </div>
    `
    )
    .join('');
}

/**
 * Wire Click-to-Zoom Lightbox Modal controls
 */
function initZoomModalHandlers() {
  const modal = document.getElementById('claim-zoom-modal');
  const previewImg = document.getElementById('claim-inspector-image');
  const previewContainer = document.getElementById('inspector-image-container');
  const zoomBtn = document.getElementById('btn-zoom-doc');
  const fullLink = document.getElementById('inspector-view-full');
  const closeBtn = document.getElementById('btn-close-zoom');
  const zoomInBtn = document.getElementById('btn-zoom-in');
  const zoomOutBtn = document.getElementById('btn-zoom-out');
  const zoomResetBtn = document.getElementById('btn-zoom-reset');

  const triggerZoom = (e) => {
    if (e) e.preventDefault();
    const imgSrc = previewImg?.src || '/samples/clean_clinic_bill.jpg';
    const filename = document.getElementById('inspector-doc-filename')?.textContent || 'Document Proof';
    openZoomModal(imgSrc, filename);
  };

  if (previewImg && !previewImg.dataset.zoomBound) {
    previewImg.dataset.zoomBound = 'true';
    previewImg.addEventListener('click', triggerZoom);
  }

  if (previewContainer && !previewContainer.dataset.zoomBound) {
    previewContainer.dataset.zoomBound = 'true';
    previewContainer.addEventListener('click', triggerZoom);
  }

  if (zoomBtn && !zoomBtn.dataset.zoomBound) {
    zoomBtn.dataset.zoomBound = 'true';
    zoomBtn.addEventListener('click', triggerZoom);
  }

  if (fullLink && !fullLink.dataset.zoomBound) {
    fullLink.dataset.zoomBound = 'true';
    fullLink.addEventListener('click', (e) => {
      // In mobile or when preferred, open in modal
      if (window.innerWidth < 1024) {
        e.preventDefault();
        triggerZoom(e);
      }
    });
  }

  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = 'true';
    closeBtn.addEventListener('click', () => closeZoomModal());
  }

  if (zoomInBtn && !zoomInBtn.dataset.bound) {
    zoomInBtn.dataset.bound = 'true';
    zoomInBtn.addEventListener('click', () => adjustZoom(ZOOM_STEP));
  }

  if (zoomOutBtn && !zoomOutBtn.dataset.bound) {
    zoomOutBtn.dataset.bound = 'true';
    zoomOutBtn.addEventListener('click', () => adjustZoom(-ZOOM_STEP));
  }

  if (zoomResetBtn && !zoomResetBtn.dataset.bound) {
    zoomResetBtn.dataset.bound = 'true';
    zoomResetBtn.addEventListener('click', () => resetZoom());
  }

  if (modal && !modal.dataset.bound) {
    modal.dataset.bound = 'true';
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeZoomModal();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display !== 'none') {
        closeZoomModal();
      }
    });
  }
}

/**
 * Open Zoom Lightbox Modal with target image
 * @param {string} src
 * @param {string} [filename]
 */
export function openZoomModal(src, filename) {
  const modal = document.getElementById('claim-zoom-modal');
  const modalImg = document.getElementById('zoom-modal-img');
  const filenameEl = document.getElementById('zoom-modal-filename');

  if (modalImg && src) modalImg.src = src;
  if (filenameEl && filename) filenameEl.textContent = filename;

  currentZoomLevel = 1.0;
  applyZoomTransform();

  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Close Zoom Lightbox Modal
 */
export function closeZoomModal() {
  const modal = document.getElementById('claim-zoom-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

/**
 * Adjust Zoom Scale Level (+ / -)
 * @param {number} delta
 */
function adjustZoom(delta) {
  currentZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoomLevel + delta));
  applyZoomTransform();
}

/**
 * Reset Zoom Scale Level to 100%
 */
function resetZoom() {
  currentZoomLevel = 1.0;
  applyZoomTransform();
}

/**
 * Apply CSS transform to the modal image and update zoom pill
 */
function applyZoomTransform() {
  const modalImg = document.getElementById('zoom-modal-img');
  const pill = document.getElementById('zoom-level-pill');

  if (modalImg) {
    modalImg.style.transform = `scale(${currentZoomLevel})`;
  }
  if (pill) {
    pill.textContent = `${Math.round(currentZoomLevel * 100)}%`;
  }
}

/**
 * Wire Mobile Photo Preview Collapsible Toggle
 */
function initMobilePreviewToggle() {
  const toggleBtn = document.getElementById('btn-toggle-doc-preview');
  const photoBody = document.getElementById('inspector-photo-body');

  if (toggleBtn && !toggleBtn.dataset.bound) {
    toggleBtn.dataset.bound = 'true';
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMobilePhotoPreview();
    });
  }
}

/**
 * Toggle Mobile Photo Preview Collapsed / Expanded state
 * @param {boolean} [forceState]
 */
export function toggleMobilePhotoPreview(forceState) {
  const toggleBtn = document.getElementById('btn-toggle-doc-preview');
  const photoBody = document.getElementById('inspector-photo-body');

  if (forceState !== undefined) {
    isMobilePreviewCollapsed = forceState;
  } else {
    isMobilePreviewCollapsed = !isMobilePreviewCollapsed;
  }

  if (photoBody) {
    if (isMobilePreviewCollapsed) {
      photoBody.classList.add('collapsed');
    } else {
      photoBody.classList.remove('collapsed');
    }
  }

  if (toggleBtn) {
    toggleBtn.setAttribute('aria-expanded', String(!isMobilePreviewCollapsed));
    const textEl = toggleBtn.querySelector('.toggle-text');
    const iconEl = toggleBtn.querySelector('.toggle-icon');
    if (textEl) textEl.textContent = isMobilePreviewCollapsed ? 'Expand' : 'Collapse';
    if (iconEl) iconEl.textContent = isMobilePreviewCollapsed ? '▲' : '▼';
  }
}

/**
 * Attach real-time input change listeners to clear amber outline once manually verified
 */
function initFieldChangeListeners() {
  const fields = [
    { id: 'claim-ext-provider', hintId: 'hint-ext-provider', key: 'provider_name' },
    { id: 'claim-ext-date', hintId: 'hint-ext-date', key: 'incident_or_bill_date' },
    { id: 'claim-ext-diagnosis', hintId: 'hint-ext-diagnosis', key: 'diagnosis_or_event' },
    { id: 'claim-ext-total', hintId: 'hint-ext-total', key: 'total_amount_inr' },
  ];

  fields.forEach(({ id, hintId, key }) => {
    const input = document.getElementById(id);
    const hint = document.getElementById(hintId);

    if (input && !input.dataset.changeBound) {
      input.dataset.changeBound = 'true';
      const handleInput = () => {
        const val = input.value.trim();
        if (val) {
          // Field verified by user
          input.classList.remove('is-low-confidence');
          input.classList.add('is-user-verified');

          if (hint) {
            hint.style.display = 'flex';
            hint.className = 'field-verify-hint hint-verified';
            hint.innerHTML = '<span class="hint-icon" aria-hidden="true">✓</span> <span class="hint-text">Manually verified by user</span>';
          }

          // Sync into state.claimDraft.extractedData
          if (state.claimDraft.extractedData) {
            state.claimDraft.extractedData[key] = key === 'total_amount_inr' ? parseFloat(val) || 0 : val;
            if (!state.claimDraft.extractedData.field_confidences) {
              state.claimDraft.extractedData.field_confidences = {};
            }
            state.claimDraft.extractedData.field_confidences[key] = 1.0;
          }
        }
      };

      input.addEventListener('input', handleInput);
      input.addEventListener('change', handleInput);
    }
  });
}

/**
 * Pulse all "Re-Check My Claim" buttons to visually guide user after attaching proof
 */
export function pulseRecheckButtons() {
  const btns = [
    document.getElementById('btn-revalidate-claim'),
    document.getElementById('btn-recheck-my-claim'),
  ];
  btns.forEach((btn) => {
    if (btn) {
      btn.classList.add('is-pulsing');
    }
  });
}

/**
 * Handle "Attach Demo Proof" helper button for stage demos
 * Instantly attaches pre-configured verified proof documents:
 * - doctor_prescription / prescription -> /samples/clean_clinic_bill.jpg
 * - land_record_ror -> /samples/pmfby_hailstorm_crop.jpg
 * - crop_damage_photo -> /samples/pmfby_hailstorm_crop.jpg
 * - fir_or_police_report -> /samples/clean_clinic_bill.jpg
 * @param {string} docKey
 */
export function handleAttachDemoProof(docKey) {
  const demoSamplesMap = {
    doctor_prescription: {
      filename: 'dr_gupta_prescription_slip.jpg',
      url: '/samples/clean_clinic_bill.jpg',
      docType: 'doctor_prescription',
      aliases: ['prescription', 'doctor_prescription'],
    },
    prescription: {
      filename: 'dr_gupta_prescription_slip.jpg',
      url: '/samples/clean_clinic_bill.jpg',
      docType: 'prescription',
      aliases: ['prescription', 'doctor_prescription'],
    },
    land_record_ror: {
      filename: 'khasra_7_12_land_record_patta.jpg',
      url: '/samples/pmfby_hailstorm_crop.jpg',
      docType: 'land_record_ror',
      aliases: ['land_record_ror'],
    },
    crop_damage_photo: {
      filename: 'pmfby_hailstorm_wheat_crop.jpg',
      url: '/samples/pmfby_hailstorm_crop.jpg',
      docType: 'crop_damage_photo',
      aliases: ['crop_damage_photo'],
    },
    fir_or_police_report: {
      filename: 'police_inquest_fir_report.jpg',
      url: '/samples/clean_clinic_bill.jpg',
      docType: 'fir_or_police_report',
      aliases: ['fir_or_police_report'],
    },
  };

  const sample = demoSamplesMap[docKey] || {
    filename: `${docKey}_demo_proof.jpg`,
    url: '/samples/clean_clinic_bill.jpg',
    docType: docKey,
    aliases: [docKey],
  };

  if (!state.claimDraft.inlineAttachedDocs) {
    state.claimDraft.inlineAttachedDocs = {};
  }
  state.claimDraft.inlineAttachedDocs[docKey] = {
    filename: sample.filename,
    url: sample.url,
    docType: sample.docType,
    attachedAt: Date.now(),
  };

  if (!state.claimDraft.uploadedDocTypes) {
    state.claimDraft.uploadedDocTypes = [];
  }
  sample.aliases.forEach((alias) => {
    if (!state.claimDraft.uploadedDocTypes.includes(alias)) {
      state.claimDraft.uploadedDocTypes.push(alias);
    }
  });

  if (!state.claimDraft.uploadedFiles) {
    state.claimDraft.uploadedFiles = [];
  }
  state.claimDraft.uploadedFiles.push({
    name: sample.filename,
    size: 524288,
    type: 'image/jpeg',
    dataUrl: sample.url,
    docType: sample.docType,
  });

  // Re-render rule checks list so the card displays the attached state
  renderRuleChecksList(state.claimDraft.ruleChecks || []);
  pulseRecheckButtons();
  showToast(`Attached Demo Proof for ${formatDocTitle(docKey)}! Click "Re-Check My Claim" to verify.`, 'success');
}

/**
 * Handle user file selection from inline "Upload Now" button
 * @param {string} docKey
 * @param {File} file
 */
export function handleInlineDocUpload(docKey, file) {
  if (!file) return;

  const onFileReady = (dataUrl) => {
    if (!state.claimDraft.inlineAttachedDocs) {
      state.claimDraft.inlineAttachedDocs = {};
    }
    state.claimDraft.inlineAttachedDocs[docKey] = {
      filename: file.name,
      url: dataUrl,
      size: file.size,
      docType: docKey,
      attachedAt: Date.now(),
    };

    if (!state.claimDraft.uploadedDocTypes) {
      state.claimDraft.uploadedDocTypes = [];
    }
    const aliases = [docKey];
    if (docKey === 'doctor_prescription') aliases.push('prescription');
    if (docKey === 'prescription') aliases.push('doctor_prescription');
    if (docKey === 'hospital_bill') aliases.push('clinic_opd_bill');
    if (docKey === 'clinic_opd_bill') aliases.push('hospital_bill');

    aliases.forEach((alias) => {
      if (!state.claimDraft.uploadedDocTypes.includes(alias)) {
        state.claimDraft.uploadedDocTypes.push(alias);
      }
    });

    if (!state.claimDraft.uploadedFiles) {
      state.claimDraft.uploadedFiles = [];
    }
    state.claimDraft.uploadedFiles.push({
      name: file.name,
      size: file.size,
      type: file.type,
      dataUrl: dataUrl,
      docType: docKey,
    });

    renderRuleChecksList(state.claimDraft.ruleChecks || []);
    pulseRecheckButtons();
    showToast(`Attached ${file.name} for ${formatDocTitle(docKey)}! Click "Re-Check My Claim" to verify.`, 'success');
  };

  if (typeof FileReader !== 'undefined') {
    const reader = new FileReader();
    reader.onload = (e) => onFileReady(e.target.result);
    reader.onerror = () => onFileReady(`/uploads/${file.name}`);
    reader.readAsDataURL(file);
  } else {
    onFileReady(`/uploads/${file.name}`);
  }
}

/**
 * Handle removal of inline attached document
 * @param {string} docKey
 */
export function handleRemoveInlineDoc(docKey) {
  if (state.claimDraft.inlineAttachedDocs) {
    delete state.claimDraft.inlineAttachedDocs[docKey];
  }

  const aliases = [docKey];
  if (docKey === 'doctor_prescription') aliases.push('prescription');
  if (docKey === 'prescription') aliases.push('doctor_prescription');
  if (docKey === 'hospital_bill') aliases.push('clinic_opd_bill');
  if (docKey === 'clinic_opd_bill') aliases.push('hospital_bill');

  if (state.claimDraft.uploadedDocTypes) {
    state.claimDraft.uploadedDocTypes = state.claimDraft.uploadedDocTypes.filter(
      (t) => !aliases.includes(t)
    );
  }

  if (state.claimDraft.uploadedFiles) {
    state.claimDraft.uploadedFiles = state.claimDraft.uploadedFiles.filter(
      (f) => !aliases.includes(f.docType)
    );
  }

  renderRuleChecksList(state.claimDraft.ruleChecks || []);
  showToast(`Removed attachment for ${formatDocTitle(docKey)}.`, 'info');
}

/**
 * Initialize event listeners on inline recovery controls (Upload Now, Demo Proof, Remove)
 */
export function initInlineRecoveryHandlers() {
  const container = document.getElementById('claim-rule-checks-list');
  if (!container) return;

  // 1. "Upload Now" button triggers corresponding hidden file input
  const uploadBtns = container.querySelectorAll('.btn-inline-upload');
  uploadBtns.forEach((btn) => {
    if (!btn.dataset.bound) {
      btn.dataset.bound = 'true';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const docKey = btn.dataset.docKey;
        const fileInput = container.querySelector(`.inline-doc-file-input[data-doc-key="${docKey}"]`);
        if (fileInput) fileInput.click();
      });
    }
  });

  // 2. Hidden file input change event
  const fileInputs = container.querySelectorAll('.inline-doc-file-input');
  fileInputs.forEach((input) => {
    if (!input.dataset.bound) {
      input.dataset.bound = 'true';
      input.addEventListener('change', (e) => {
        const docKey = input.dataset.docKey;
        const file = e.target.files && e.target.files[0];
        if (file) {
          handleInlineDocUpload(docKey, file);
        }
      });
    }
  });

  // 3. "Attach Demo Proof" helper button
  const demoBtns = container.querySelectorAll('.btn-inline-demo-proof');
  demoBtns.forEach((btn) => {
    if (!btn.dataset.bound) {
      btn.dataset.bound = 'true';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const docKey = btn.dataset.docKey;
        handleAttachDemoProof(docKey);
      });
    }
  });

  // 4. "Remove" inline attachment button
  const removeBtns = container.querySelectorAll('.btn-remove-inline-doc');
  removeBtns.forEach((btn) => {
    if (!btn.dataset.bound) {
      btn.dataset.bound = 'true';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const docKey = btn.dataset.docKey;
        handleRemoveInlineDoc(docKey);
      });
    }
  });
}

/**
 * Wire Re-Validate Claim rules buttons (both header and footer)
 */
function initRevalidationHandler() {
  const revalidateBtns = [
    document.getElementById('btn-revalidate-claim'),
    document.getElementById('btn-recheck-my-claim'),
  ];
  revalidateBtns.forEach((btn) => {
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = 'true';
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        await runRevalidation();
      });
    }
  });
}

/**
 * Execute Re-validation of claim rules with all user-edited fields and newly added documents
 * Calls POST /api/revalidate-claim and updates scorecard, readiness meter, and payout estimate live.
 */
export async function runRevalidation() {
  const providerInput = document.getElementById('claim-ext-provider');
  const dateInput = document.getElementById('claim-ext-date');
  const totalInput = document.getElementById('claim-ext-total');
  const diagnosisInput = document.getElementById('claim-ext-diagnosis');

  const providerVal = providerInput?.value.trim() || state.claimDraft.extractedData?.provider_name || '';
  const dateVal = dateInput?.value.trim() || state.claimDraft.extractedData?.incident_or_bill_date || '';
  const totalVal = parseFloat(totalInput?.value || state.claimDraft.extractedData?.total_amount_inr || '0');
  const diagnosisVal = diagnosisInput?.value.trim() || state.claimDraft.extractedData?.diagnosis_or_event || '';

  // Claimant parameters from form or draft
  const claimantName =
    document.getElementById('claim-claimant-name')?.value ||
    state.claimDraft.claimantDetails?.name ||
    'Ramesh Kumar';
  const claimantAge = parseInt(
    document.getElementById('claim-claimant-age')?.value || state.claimDraft.claimantDetails?.age || '28',
    10
  );
  const policyStartDate =
    document.getElementById('claim-policy-start-date')?.value ||
    state.claimDraft.claimantDetails?.policyStartDate ||
    '2025-01-01';
  const incidentDate =
    dateVal ||
    document.getElementById('claim-incident-date')?.value ||
    state.claimDraft.claimantDetails?.incidentDate;
  const policyId =
    document.getElementById('claim-policy-id')?.value ||
    state.selectedPolicyId ||
    state.claimDraft.policyId ||
    'micro_health_gig';
  const incidentSubtype =
    document.getElementById('claim-incident-type')?.value ||
    state.claimDraft.claimantDetails?.incidentSubtype ||
    diagnosisVal;

  // Build complete updated_uploaded_doc_types
  const docTypesSet = new Set(state.claimDraft.uploadedDocTypes || []);

  // Include primary document type
  if (state.claimDraft.primaryDocType) {
    docTypesSet.add(state.claimDraft.primaryDocType);
  }
  const primarySelect = document.getElementById('claim-primary-doc-type');
  if (primarySelect?.value) {
    docTypesSet.add(primarySelect.value);
  }

  // Include any secondary document types from Step 2
  if (Array.isArray(state.claimDraft.secondaryDocTypes)) {
    state.claimDraft.secondaryDocTypes.forEach((t) => docTypesSet.add(t));
  }

  // Include any documents attached via inline recovery controls
  if (state.claimDraft.inlineAttachedDocs) {
    Object.keys(state.claimDraft.inlineAttachedDocs).forEach((docKey) => {
      docTypesSet.add(docKey);
      if (docKey === 'doctor_prescription') docTypesSet.add('prescription');
      if (docKey === 'prescription') docTypesSet.add('doctor_prescription');
      if (docKey === 'hospital_bill') docTypesSet.add('clinic_opd_bill');
      if (docKey === 'clinic_opd_bill') docTypesSet.add('hospital_bill');
    });
  }

  // Normalize aliases: if prescription is attached, ensure both variants are present
  if (docTypesSet.has('prescription') || docTypesSet.has('doctor_prescription')) {
    docTypesSet.add('prescription');
    docTypesSet.add('doctor_prescription');
  }
  if (docTypesSet.has('hospital_bill') || docTypesSet.has('clinic_opd_bill')) {
    docTypesSet.add('hospital_bill');
    docTypesSet.add('clinic_opd_bill');
  }

  const updatedDocTypes = Array.from(docTypesSet);

  // Preserve existing uploaded file URLs
  const fileUrls = [
    ...(state.claimDraft.uploadedFiles || []).map((f) => f.dataUrl || f.url).filter(Boolean),
    state.claimDraft.sampleImageUrl,
    ...(state.claimDraft.uploadedFileUrls || []),
  ].filter(Boolean);

  const payload = {
    claim_id: state.claimDraft.draftId || `DRAFT-${Date.now()}`,
    policy_id: policyId,
    claimant_name: claimantName,
    claimant_age: claimantAge,
    policy_start_date: policyStartDate,
    incident_date: incidentDate,
    incident_subtype: incidentSubtype,
    updated_extracted_data: {
      ...(state.claimDraft.extractedData || {}),
      provider_name: providerVal,
      incident_or_bill_date: dateVal,
      diagnosis_or_event: diagnosisVal,
      total_amount_inr: totalVal,
    },
    manual_overrides: {
      date_verified: true,
      provider_verified: true,
      exclude_multivitamins: true,
      ...(diagnosisVal ? { diagnosis_or_event: diagnosisVal } : {}),
      ...(dateVal ? { incident_or_bill_date: dateVal } : {}),
      ...(totalVal ? { total_amount_inr: totalVal } : {}),
      ...(providerVal ? { provider_name: providerVal } : {}),
    },
    updated_uploaded_doc_types: updatedDocTypes,
    existing_file_urls: fileUrls,
  };

  // Indicate loading state on re-check buttons
  const recheckBtns = [
    document.getElementById('btn-revalidate-claim'),
    document.getElementById('btn-recheck-my-claim'),
  ].filter(Boolean);

  recheckBtns.forEach((btn) => {
    btn.disabled = true;
    btn.innerHTML = '<span>🔄 Re-Checking Rules...</span>';
  });

  try {
    const res = await revalidateClaim(payload);
    if (res) {
      // 1. Update State
      state.claimDraft.ruleChecks = res.rule_checks || [];
      state.claimDraft.readinessScore = res.readiness_score != null ? res.readiness_score : 100;
      state.claimDraft.readinessStatus = res.readiness_status || 'READY_TO_SUBMIT';
      state.claimDraft.estimatedPayoutInr =
        res.eligible_payout_inr !== undefined ? res.eligible_payout_inr : (res.estimated_payout_inr || 0);
      state.claimDraft.disallowedAmountInr = res.disallowed_amount_inr || 0;
      state.claimDraft.actionableChecklist = res.fix_it_checklist || res.actionable_checklist || [];
      state.claimDraft.extractedData = res.extracted_data || payload.updated_extracted_data;
      state.claimDraft.uploadedDocTypes = updatedDocTypes;

      // 2. Live re-render Step 3 without page reload!
      renderVerifyStep(res);

      // 3. Remove pulsing
      recheckBtns.forEach((btn) => btn.classList.remove('is-pulsing'));

      // 4. Celebratory feedback toast
      const cleanStatus = (res.readiness_status || 'READY_TO_SUBMIT').replace(/_/g, ' ');
      const score = Math.round(res.readiness_score != null ? res.readiness_score : 100);
      showToast(`Claim re-checked live! Scorecard updated: ${score}% — ${cleanStatus}.`, 'success');
    }
  } catch (err) {
    console.error('Failed to revalidate claim:', err);
    showToast(`Re-validation error: ${err.message || 'Please retry'}`, 'error');
  } finally {
    recheckBtns.forEach((btn) => {
      btn.disabled = false;
      btn.innerHTML = '<span>🔄 Re-Check My Claim</span>';
    });
  }
}
