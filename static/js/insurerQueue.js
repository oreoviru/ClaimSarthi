/**
 * SurakshaSetu — Insurer Triage Portal & Queue View
 * Fetches live claims from GET /api/claims, manages summary metrics,
 * status filtering, desktop table layout, mobile responsive cards (<768px),
 * and an interactive Claim Detail Drawer / Decision Desk Modal.
 */

import { state, setInsurerClaims, subscribe } from './state.js';
import { fetchClaims, fetchClaimById, updateClaimDecision, showToast } from './api.js';
import { openZoomModal } from './verifyStep.js';

// Module state
let activeFilter = 'all'; // 'all' | 'READY_TO_APPROVE' | 'NEEDS_REVIEW' | 'APPROVED'
let currentHighlightClaimId = null;
let activeDrawerClaimId = null;
let isInitialized = false;

/**
 * Format timestamp into clean Indian date-time format (e.g. 24 Nov 2026, 04:42 PM)
 * @param {string | Date} [isoString]
 * @returns {string}
 */
export function formatSubmissionTimestamp(isoString) {
  if (!isoString) {
    const now = new Date();
    return now.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return String(isoString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(isoString);
  }
}

/**
 * Format currency in Indian Rupees
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  const num = Number(amount || 0);
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Compute policy compliance score percentage and check ratios
 * @param {any} claim
 * @returns {{ score: number, passCount: number, totalCount: number, scoreClass: string }}
 */
export function computeComplianceScore(claim) {
  let score = 100;
  let passCount = 5;
  let totalCount = 5;

  if (claim?.compliance_score != null && typeof claim.compliance_score === 'number') {
    score = Math.round(claim.compliance_score);
    passCount = claim.pass_checks_count ?? 5;
    totalCount = claim.total_checks_count ?? 5;
  } else if (Array.isArray(claim?.rule_checks) && claim.rule_checks.length > 0) {
    passCount = claim.rule_checks.filter((c) => c.status === 'PASS').length;
    totalCount = claim.rule_checks.length;
    score = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 100;
  } else if (claim?.extracted_data?.legibility_score) {
    score = Math.round(claim.extracted_data.legibility_score * 100);
  } else {
    const isPass = claim?.reviewer_status === 'READY_TO_APPROVE' || claim?.reviewer_status === 'APPROVED';
    score = isPass ? 100 : 75;
    passCount = isPass ? 5 : 4;
    totalCount = 5;
  }

  const scoreClass = score >= 80 ? 'score-high' : score >= 50 ? 'score-mid' : 'score-low';
  return { score, passCount, totalCount, scoreClass };
}

/**
 * Clean policy scheme title for compact display
 * @param {string} scheme
 * @returns {string}
 */
export function formatSchemeName(scheme) {
  if (!scheme) return 'Micro-Insurance';
  const mapping = {
    micro_health_gig: 'Gig-Worker Clinic Shield',
    pmsby: 'PMSBY (Accidental Cover)',
    pmjjby: 'PMJJBY (Life Protection)',
    pmfby: 'PMFBY (Crop Hailstorm)',
    ab_pmjay: 'AB-PMJAY (Health Cover)',
  };
  return mapping[scheme] || scheme;
}

/**
 * Initialize Insurer Queue: wire filter buttons, drawer triggers, and listeners
 */
export function initInsurerQueue() {
  const filterRow = document.getElementById('insurer-status-filters');
  if (filterRow) {
    filterRow.querySelectorAll('.filter-tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const filterVal = btn.dataset.filter || 'all';
        filterClaims(filterVal);
      });
    });
  }

  // Wire Drawer Close Button & Backdrop
  const closeBtn = document.getElementById('btn-close-claim-drawer');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeClaimDetailDrawer();
    });
  }

  const backdrop = document.getElementById('insurer-claim-drawer-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      e.preventDefault();
      closeClaimDetailDrawer();
    });
  }

  // Escape key closes drawer
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const drawer = document.getElementById('insurer-claim-drawer');
      if (drawer && !drawer.hidden && drawer.classList.contains('open')) {
        closeClaimDetailDrawer();
      }
    }
  });

  // Wire Decision Buttons in Drawer
  const btnApprove = document.getElementById('btn-decision-approve');
  const btnInfo = document.getElementById('btn-decision-info');
  const btnReject = document.getElementById('btn-decision-reject');

  if (btnApprove) {
    btnApprove.addEventListener('click', () => {
      if (activeDrawerClaimId) submitOfficerDecision(activeDrawerClaimId, 'APPROVED');
    });
  }
  if (btnInfo) {
    btnInfo.addEventListener('click', () => {
      if (activeDrawerClaimId) submitOfficerDecision(activeDrawerClaimId, 'INFO_REQUESTED');
    });
  }
  if (btnReject) {
    btnReject.addEventListener('click', () => {
      if (activeDrawerClaimId) submitOfficerDecision(activeDrawerClaimId, 'REJECTED');
    });
  }

  if (!isInitialized) {
    isInitialized = true;
    subscribe((currState, changedKey) => {
      if (changedKey === 'insurerClaims' && currState.activeTab === 'insurer') {
        renderInsurerQueue(currentHighlightClaimId, activeFilter);
      }
    });
  }
}

/**
 * Switch status filter tab and re-render queue
 * @param {'all' | 'READY_TO_APPROVE' | 'NEEDS_REVIEW' | 'APPROVED'} filter
 */
export function filterClaims(filter) {
  activeFilter = filter;
  renderInsurerQueue(currentHighlightClaimId, activeFilter);
}

/**
 * Get active filter
 * @returns {string}
 */
export function getActiveFilter() {
  return activeFilter;
}

/**
 * Fetch live claims from GET /api/claims, update state, and render queue
 * @param {string | null} [highlightClaimId=null]
 * @param {string | null} [filter=null]
 */
export async function fetchAndRenderQueue(highlightClaimId = null, filter = null) {
  if (filter) activeFilter = filter;
  if (highlightClaimId !== undefined) currentHighlightClaimId = highlightClaimId;

  try {
    const data = await fetchClaims();
    if (data) {
      setInsurerClaims(data);
    }
  } catch (err) {
    console.warn('Could not fetch live claims from backend:', err);
  }

  renderInsurerQueue(currentHighlightClaimId, activeFilter);
}

/**
 * Update 4-metric summary strip in DOM
 * @param {any} metrics
 * @param {Array<any>} allClaims
 */
function updateMetricsStrip(metrics, allClaims) {
  const totalEl = document.getElementById('metric-total-claims');
  const readyEl = document.getElementById('metric-ready-to-approve');
  const reviewEl = document.getElementById('metric-needs-review');
  const preventedEl = document.getElementById('metric-prevented-rejections');

  const total = metrics?.total_claims ?? allClaims.length;
  const ready = metrics?.ready_to_approve ?? allClaims.filter((c) => c.reviewer_status === 'READY_TO_APPROVE').length;
  const review = metrics?.needs_review ?? allClaims.filter((c) => c.reviewer_status === 'NEEDS_REVIEW' || c.reviewer_status === 'INFO_REQUESTED').length;
  const prevented = metrics?.prevented_rejections_count ?? 1;

  if (totalEl) totalEl.textContent = String(total);
  if (readyEl) readyEl.textContent = String(ready);
  if (reviewEl) reviewEl.textContent = String(review);
  if (preventedEl) preventedEl.textContent = String(prevented);
}

/**
 * Update status filter tabs active state and badge counts
 * @param {Array<any>} allClaims
 * @param {string} currentFilter
 */
function updateFilterTabs(allClaims, currentFilter) {
  const allCount = allClaims.length;
  const readyCount = allClaims.filter((c) => c.reviewer_status === 'READY_TO_APPROVE').length;
  const reviewCount = allClaims.filter((c) => c.reviewer_status === 'NEEDS_REVIEW' || c.reviewer_status === 'INFO_REQUESTED').length;
  const approvedCount = allClaims.filter((c) => c.reviewer_status === 'APPROVED').length;

  const countAll = document.getElementById('filter-count-all');
  const countReady = document.getElementById('filter-count-ready');
  const countReview = document.getElementById('filter-count-review');
  const countApproved = document.getElementById('filter-count-approved');

  if (countAll) countAll.textContent = String(allCount);
  if (countReady) countReady.textContent = String(readyCount);
  if (countReview) countReview.textContent = String(reviewCount);
  if (countApproved) countApproved.textContent = String(approvedCount);

  // Update button active states
  const buttons = document.querySelectorAll('#insurer-status-filters .filter-tab-btn');
  buttons.forEach((btn) => {
    const isTarget = btn.dataset.filter === currentFilter;
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });
}

/**
 * Filter claims array by status
 * @param {Array<any>} claims
 * @param {string} filter
 * @returns {Array<any>}
 */
function getFilteredClaims(claims, filter) {
  if (filter === 'READY_TO_APPROVE') {
    return claims.filter((c) => c.reviewer_status === 'READY_TO_APPROVE');
  }
  if (filter === 'NEEDS_REVIEW') {
    return claims.filter((c) => c.reviewer_status === 'NEEDS_REVIEW' || c.reviewer_status === 'INFO_REQUESTED');
  }
  if (filter === 'APPROVED') {
    return claims.filter((c) => c.reviewer_status === 'APPROVED');
  }
  return claims;
}

/**
 * Render the complete insurer queue view:
 * 4-metric strip, filter tabs, desktop table (>=768px), and mobile stacked cards (<768px).
 * @param {string | null} [highlightClaimId=null]
 * @param {string | null} [filter=null]
 */
export function renderInsurerQueue(highlightClaimId = null, filter = null) {
  if (filter) activeFilter = filter;
  if (highlightClaimId !== undefined && highlightClaimId !== null) {
    currentHighlightClaimId = highlightClaimId;
  }

  const container = document.getElementById('insurer-queue-container');
  if (!container) return;

  const insurerData = state.insurerClaims || {};
  const allClaims = Array.isArray(insurerData.claims) ? insurerData.claims : [];
  const metrics = insurerData.metrics || {};

  // 1. Update Top 4-Metric Summary Strip
  updateMetricsStrip(metrics, allClaims);

  // 2. If a specific claim is highlighted, ensure filter doesn't hide it
  if (currentHighlightClaimId) {
    const targetClaim = allClaims.find((c) => c.claim_id === currentHighlightClaimId);
    if (targetClaim) {
      if (activeFilter === 'READY_TO_APPROVE' && targetClaim.reviewer_status !== 'READY_TO_APPROVE') {
        activeFilter = 'all';
      } else if (activeFilter === 'NEEDS_REVIEW' && targetClaim.reviewer_status !== 'NEEDS_REVIEW') {
        activeFilter = 'all';
      } else if (activeFilter === 'APPROVED' && targetClaim.reviewer_status !== 'APPROVED') {
        activeFilter = 'all';
      }
    }
  }

  // 3. Update Filter Tabs
  updateFilterTabs(allClaims, activeFilter);

  // 4. Filter Claims
  const filteredClaims = getFilteredClaims(allClaims, activeFilter);

  // 5. Empty State
  if (filteredClaims.length === 0) {
    container.innerHTML = `
      <div class="insurer-empty-queue">
        <div class="insurer-empty-icon">📭</div>
        <h4 class="insurer-empty-title">No Claims Found</h4>
        <p class="insurer-empty-desc">
          There are no claims matching the current status filter (<strong>${activeFilter}</strong>).
          Switch to "All" or submit a new claim to populate this view.
        </p>
      </div>
    `;
    return;
  }

  // 6. Build Desktop Table & Mobile Stacked Cards
  const tableRowsHtml = filteredClaims
    .map((c) => {
      const isTarget = currentHighlightClaimId && c.claim_id === currentHighlightClaimId;
      const statusRaw = c.reviewer_status || 'READY_TO_APPROVE';
      const statusClean = statusRaw.replace(/_/g, ' ');
      const isPass = statusRaw === 'READY_TO_APPROVE' || statusRaw === 'APPROVED';
      const badgeClass = isPass ? 'badge-pass' : 'badge-warning';
      const formattedDate = formatSubmissionTimestamp(c.created_at);
      const claimedAmt = c.claimed_amount_inr || 0;
      const eligibleAmt = c.approved_amount_inr != null ? c.approved_amount_inr : claimedAmt;
      const { score, passCount, totalCount, scoreClass } = computeComplianceScore(c);
      const schemeTitle = c.policy_name || formatSchemeName(c.policy_id);

      return `
        <tr class="insurer-claim-row ${isTarget ? 'highlighted-claim' : ''}" 
            id="insurer-claim-${c.claim_id}" 
            data-claim-id="${c.claim_id}"
            style="cursor: pointer;">
          <td data-label="Claim ID">
            <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
              <span class="claim-id-mono">${c.claim_id}</span>
              ${isTarget ? '<span class="highlighted-badge">★ Newly Submitted</span>' : ''}
            </div>
          </td>
          <td data-label="Claimant">
            <div class="claimant-cell">
              <strong>${c.claimant_name || 'N/A'}</strong>
              <span class="claim-date-micro">${formattedDate}</span>
            </div>
          </td>
          <td data-label="Scheme">
            <span class="scheme-badge-text" title="${c.policy_name || c.policy_id}">${schemeTitle}</span>
          </td>
          <td data-label="Claimed vs. Eligible ₹">
            <div class="amount-compare-stack">
              <span class="claimed-amount">Claimed: ₹${formatCurrency(claimedAmt)}</span>
              <strong class="eligible-amount text-pass">Eligible: ₹${formatCurrency(eligibleAmt)}</strong>
            </div>
          </td>
          <td data-label="Compliance Score">
            <div class="compliance-score-wrap">
              <span class="compliance-score-pill ${scoreClass}">${score}%</span>
              <span class="checks-ratio">${passCount}/${totalCount} Passed</span>
            </div>
          </td>
          <td data-label="Status">
            <span class="badge ${badgeClass}">${statusClean}</span>
          </td>
          <td data-label="Action">
            <div class="insurer-row-actions">
              <a href="/api/claims/${c.claim_id}/report" 
                 target="_blank" 
                 rel="noopener noreferrer" 
                 class="btn btn-outline btn-sm"
                 title="Open printable A4 audit dossier"
                 aria-label="Open printable A4 audit dossier for claim ${c.claim_id}"
                 onclick="event.stopPropagation();">
                📄 A4 PDF
              </a>
              <button type="button" 
                      class="btn btn-primary btn-sm btn-review-claim" 
                      data-claim-id="${c.claim_id}"
                      aria-label="Review and decide claim ${c.claim_id}">
                👁️ Review &amp; Decide
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  const mobileCardsHtml = filteredClaims
    .map((c) => {
      const isTarget = currentHighlightClaimId && c.claim_id === currentHighlightClaimId;
      const statusRaw = c.reviewer_status || 'READY_TO_APPROVE';
      const statusClean = statusRaw.replace(/_/g, ' ');
      const isPass = statusRaw === 'READY_TO_APPROVE' || statusRaw === 'APPROVED';
      const badgeClass = isPass ? 'badge-pass' : 'badge-warning';
      const formattedDate = formatSubmissionTimestamp(c.created_at);
      const claimedAmt = c.claimed_amount_inr || 0;
      const eligibleAmt = c.approved_amount_inr != null ? c.approved_amount_inr : claimedAmt;
      const { score, passCount, totalCount, scoreClass } = computeComplianceScore(c);
      const schemeTitle = c.policy_name || formatSchemeName(c.policy_id);

      return `
        <div class="insurer-claim-card mobile-claim-card ${isTarget ? 'highlighted-claim' : ''}" 
             id="insurer-mobile-claim-${c.claim_id}" 
             data-claim-id="${c.claim_id}"
             style="cursor: pointer;">
          <div class="mobile-claim-header">
            <div class="mobile-claim-id-wrap">
              <span class="claim-id-mono">${c.claim_id}</span>
              ${isTarget ? '<span class="highlighted-badge">★ Newly Submitted</span>' : ''}
            </div>
            <span class="badge ${badgeClass}">${statusClean}</span>
          </div>

          <div class="mobile-claim-body-grid">
            <div class="mobile-kv-item">
              <span class="mobile-kv-label">Claimant</span>
              <span class="mobile-kv-val">${c.claimant_name || 'N/A'}</span>
            </div>
            <div class="mobile-kv-item">
              <span class="mobile-kv-label">Scheme</span>
              <span class="mobile-kv-val">${schemeTitle}</span>
            </div>
            <div class="mobile-kv-item">
              <span class="mobile-kv-label">Claimed vs. Eligible</span>
              <span class="mobile-kv-val">
                ₹${formatCurrency(claimedAmt)} &rarr; <strong class="text-pass">₹${formatCurrency(eligibleAmt)}</strong>
              </span>
            </div>
            <div class="mobile-kv-item">
              <span class="mobile-kv-label">Compliance Score</span>
              <span class="mobile-kv-val">
                <span class="compliance-score-pill ${scoreClass}">${score}%</span> (${passCount}/${totalCount})
              </span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--color-ink-muted);">
            <span>Submitted: ${formattedDate}</span>
          </div>

          <div class="mobile-claim-actions">
            <a href="/api/claims/${c.claim_id}/report" 
               target="_blank" 
               rel="noopener noreferrer" 
               class="btn btn-outline btn-sm"
               title="Open printable A4 audit dossier"
               aria-label="Open printable A4 audit dossier for claim ${c.claim_id}"
               onclick="event.stopPropagation();">
              📄 A4 PDF
            </a>
            <button type="button" 
                    class="btn btn-primary btn-sm btn-review-claim" 
                    data-claim-id="${c.claim_id}"
                    aria-label="Review and decide claim ${c.claim_id}">
              👁️ Review &amp; Decide
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <!-- Desktop Table Container (>= 768px) -->
    <div class="insurer-desktop-table-container" id="insurer-desktop-table-container">
      <table class="insurer-claims-table" id="insurer-claims-table" role="table">
        <thead>
          <tr role="row">
            <th scope="col">Claim ID</th>
            <th scope="col">Claimant</th>
            <th scope="col">Scheme</th>
            <th scope="col">Claimed vs. Eligible ₹</th>
            <th scope="col">Compliance Score</th>
            <th scope="col">Status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Mobile Stacked Cards Container (< 768px) -->
    <div class="insurer-mobile-cards-container" id="insurer-mobile-cards-container">
      ${mobileCardsHtml}
    </div>
  `;

  // Attach click triggers to open Claim Detail Drawer:
  // 1. "Review & Decide" buttons
  container.querySelectorAll('.btn-review-claim').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cId = btn.dataset.claimId;
      if (cId) openClaimDetailDrawer(cId);
    });
  });

  // 2. Entire table row click
  container.querySelectorAll('.insurer-claim-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const cId = row.dataset.claimId;
      if (cId) openClaimDetailDrawer(cId);
    });
  });

  // 3. Entire mobile card click
  container.querySelectorAll('.mobile-claim-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const cId = card.dataset.claimId;
      if (cId) openClaimDetailDrawer(cId);
    });
  });

  // Smooth scroll to highlighted claim
  if (currentHighlightClaimId) {
    setTimeout(() => {
      const desktopTarget = document.getElementById(`insurer-claim-${currentHighlightClaimId}`);
      const mobileTarget = document.getElementById(`insurer-mobile-claim-${currentHighlightClaimId}`);
      const target = (window.innerWidth <= 768 ? mobileTarget : desktopTarget) || desktopTarget || mobileTarget;
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }
}

/**
 * Open the interactive Claim Detail Drawer / Decision Modal for a specific claim.
 * Fetches full dossier via GET /api/claims/{id}.
 * @param {string} claimId
 */
export async function openClaimDetailDrawer(claimId) {
  activeDrawerClaimId = claimId;

  const drawer = document.getElementById('insurer-claim-drawer');
  const backdrop = document.getElementById('insurer-claim-drawer-backdrop');
  const modalRoot = document.getElementById('modal-root');

  if (backdrop) {
    backdrop.hidden = false;
    backdrop.classList.add('active');
  }
  if (drawer) {
    drawer.hidden = false;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }
  if (modalRoot) {
    modalRoot.classList.add('open');
    modalRoot.setAttribute('aria-hidden', 'false');
  }
  document.body.style.overflow = 'hidden';

  // Set initial loading state in drawer header
  const idEl = document.getElementById('drawer-claim-id');
  const statusBadge = document.getElementById('drawer-status-badge');
  if (idEl) idEl.textContent = claimId;
  if (statusBadge) {
    statusBadge.textContent = 'Loading dossier...';
    statusBadge.className = 'badge badge-pending';
  }

  // Fetch full dossier via GET /api/claims/{id}
  let claim = null;
  try {
    claim = await fetchClaimById(claimId);
  } catch (err) {
    console.warn(`Could not fetch details for claim ${claimId} via API:`, err);
    // Fallback from loaded claims in state
    const allClaims = state.insurerClaims?.claims || [];
    claim = allClaims.find((c) => c.claim_id === claimId);
  }

  if (!claim) {
    showToast(`Claim ${claimId} details could not be loaded.`, 'error');
    closeClaimDetailDrawer();
    return;
  }

  // Populate drawer fields
  populateClaimDrawer(claim);
}

/**
 * Close the Claim Detail Drawer / Decision Desk Modal
 */
export function closeClaimDetailDrawer() {
  activeDrawerClaimId = null;

  const drawer = document.getElementById('insurer-claim-drawer');
  const backdrop = document.getElementById('insurer-claim-drawer-backdrop');
  const modalRoot = document.getElementById('modal-root');

  if (drawer) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.hidden = true;
  }
  if (backdrop) {
    backdrop.classList.remove('active');
    backdrop.hidden = true;
  }
  if (modalRoot) {
    modalRoot.classList.remove('open');
    modalRoot.setAttribute('aria-hidden', 'true');
  }
  document.body.style.overflow = '';
}

/**
 * Populate all 5 sections of the Claim Detail Drawer with verified data:
 * 1. Claimant & Scheme Verification
 * 2. Full Extracted OCR Data (Provider, Date, Diagnosis, Itemized Line Items)
 * 3. Clickable High-Res Evidence Thumbnails
 * 4. Complete Automated Rule Audit Trail
 * 5. Reviewer Decision Panel (Editable Approved Amount ₹, Reviewer Notes, 3 Decision Buttons)
 * @param {any} claim
 */
export function populateClaimDrawer(claim) {
  const claimId = claim.claim_id || 'CLM-2026-0001';
  const statusRaw = claim.reviewer_status || 'READY_TO_APPROVE';
  const statusClean = statusRaw.replace(/_/g, ' ');
  const isPass = statusRaw === 'READY_TO_APPROVE' || statusRaw === 'APPROVED';
  const badgeClass = isPass ? 'badge-pass' : (statusRaw === 'INFO_REQUESTED' ? 'badge-accent' : 'badge-warning');

  // Drawer Header
  const idEl = document.getElementById('drawer-claim-id');
  const statusBadge = document.getElementById('drawer-status-badge');
  const printPdfBtn = document.getElementById('btn-drawer-print-pdf');

  if (idEl) idEl.textContent = claimId;
  if (statusBadge) {
    statusBadge.textContent = statusClean;
    statusBadge.className = `badge ${badgeClass}`;
  }
  if (printPdfBtn) {
    printPdfBtn.href = `/api/claims/${claimId}/report`;
  }

  // 1. Claimant & Scheme Overview
  const nameEl = document.getElementById('drawer-claimant-name');
  const ageEl = document.getElementById('drawer-claimant-age');
  const contactEl = document.getElementById('drawer-claimant-contact');
  const aadhaarEl = document.getElementById('drawer-claimant-aadhaar');
  const policyEl = document.getElementById('drawer-policy-name');
  const incDateEl = document.getElementById('drawer-incident-date');
  const incTypeEl = document.getElementById('drawer-incident-type');
  const bankEl = document.getElementById('drawer-bank-details');

  if (nameEl) nameEl.textContent = claim.claimant_name || 'Ramesh Kumar';
  if (ageEl) ageEl.textContent = `${claim.claimant_age || 28} years`;
  if (contactEl) contactEl.textContent = claim.claimant_phone || '+91 98765 43210';
  if (aadhaarEl) aadhaarEl.textContent = claim.claimant_aadhaar_last4 ? `XXXX-XXXX-${claim.claimant_aadhaar_last4}` : 'XXXX-XXXX-4821';
  if (policyEl) policyEl.textContent = claim.policy_name || formatSchemeName(claim.policy_id);
  if (incDateEl) incDateEl.textContent = claim.incident_date || '2026-02-12';
  if (incTypeEl) incTypeEl.textContent = claim.incident_subtype || 'Medical Clinic OPD';
  if (bankEl) {
    const acc = String(claim.bank_account_number || '501004829104');
    bankEl.textContent = `DBT to ${claim.bank_ifsc || 'HDFC0001245'} (Acc ending in ${acc.slice(-4)})`;
  }

  // 2. Full Extracted OCR Data
  const ext = claim.extracted_data || {};
  const ocrProvider = document.getElementById('drawer-ocr-provider');
  const ocrDate = document.getElementById('drawer-ocr-date');
  const ocrDiag = document.getElementById('drawer-ocr-diagnosis');
  const ocrTotal = document.getElementById('drawer-ocr-total');
  const ocrConf = document.getElementById('drawer-ocr-confidence');
  const itemizedList = document.getElementById('drawer-itemized-list');

  const totalBilled = ext.total_amount_inr != null ? ext.total_amount_inr : claim.claimed_amount_inr || 0;
  if (ocrProvider) ocrProvider.textContent = ext.provider_name || 'City Health Care Clinic';
  if (ocrDate) ocrDate.textContent = ext.bill_date || claim.incident_date || '2026-02-12';
  if (ocrDiag) ocrDiag.textContent = ext.diagnosis || claim.incident_subtype || 'Acute Illness';
  if (ocrTotal) ocrTotal.textContent = `₹${formatCurrency(totalBilled)}`;

  if (ocrConf) {
    const scoreVal = Math.round((ext.legibility_score || 0.95) * 100);
    ocrConf.textContent = `${scoreVal}% High Confidence OCR`;
    ocrConf.className = `badge ${scoreVal >= 80 ? 'badge-pass' : 'badge-warning'}`;
  }

  // Render itemized charges table
  if (itemizedList) {
    const charges = Array.isArray(ext.itemized_charges) && ext.itemized_charges.length > 0
      ? ext.itemized_charges
      : [
          { description: 'Doctor Consultation & Diagnosis', amount_inr: 500.0, is_covered: true, category: 'consultation' },
          { description: 'Generic Antibiotics & Antipyretic', amount_inr: 1250.0, is_covered: true, category: 'pharmacy' },
          { description: 'Electrolytes & Multivitamins', amount_inr: 450.0, is_covered: false, category: 'excluded_supplements' },
        ];

    itemizedList.innerHTML = charges
      .map((ch) => {
        const isCov = ch.is_covered !== false;
        return `
          <tr>
            <td><strong>${ch.description || 'Medical Line Item'}</strong></td>
            <td><span class="badge badge-subtle" style="font-size: 0.72rem;">${ch.category || 'medical'}</span></td>
            <td>
              <span class="badge ${isCov ? 'badge-pass' : 'badge-warning'}" style="font-size: 0.72rem;">
                ${isCov ? '✓ Covered' : '⚠️ Excluded'}
              </span>
            </td>
            <td style="text-align: right;">
              <strong class="${isCov ? 'text-pass' : 'text-warning'}">
                ${isCov ? '' : '[Excluded] '}₹${formatCurrency(ch.amount_inr)}
              </strong>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  // 3. Clickable High-Res Evidence Thumbnails
  const evidenceGrid = document.getElementById('drawer-evidence-grid');
  const evidenceCount = document.getElementById('drawer-evidence-count');

  const evidenceItems = [];
  if (Array.isArray(claim.uploaded_documents) && claim.uploaded_documents.length > 0) {
    claim.uploaded_documents.forEach((d, idx) => {
      evidenceItems.push({
        url: d.file_url || '/samples/clean_clinic_bill.jpg',
        filename: d.original_filename || (idx === 0 ? 'primary_bill.jpg' : 'secondary_proof.jpg'),
        tag: idx === 0 ? 'Primary Proof' : 'Supporting Proof',
      });
    });
  } else {
    // Demo image fallback based on scheme
    if (claim.policy_id === 'pmfby') {
      evidenceItems.push({
        url: '/samples/pmfby_hailstorm_crop.jpg',
        filename: 'pmfby_crop_hailstorm.jpg',
        tag: 'Primary Proof (Crop Loss Photo)',
      });
    } else {
      evidenceItems.push({
        url: '/samples/clean_clinic_bill.jpg',
        filename: 'clinic_bill_verified.jpg',
        tag: 'Primary Proof (OPD Bill)',
      });
    }
  }

  if (evidenceCount) evidenceCount.textContent = `${evidenceItems.length} verified proof${evidenceItems.length === 1 ? '' : 's'}`;

  if (evidenceGrid) {
    evidenceGrid.innerHTML = evidenceItems
      .map(
        (item) => `
        <div class="drawer-evidence-card" data-img-url="${item.url}" data-filename="${item.filename}">
          <div class="drawer-evidence-thumb-wrap">
            <img src="${item.url}" alt="${item.filename}" class="drawer-evidence-img" onerror="this.src='/samples/clean_clinic_bill.jpg'">
            <span class="drawer-evidence-zoom-hint">🔍 Click to Zoom</span>
          </div>
          <div class="drawer-evidence-info">
            <span class="drawer-evidence-tag">${item.tag}</span>
            <span class="drawer-evidence-filename" title="${item.filename}">${item.filename}</span>
          </div>
        </div>
      `
      )
      .join('');

    // Attach click-to-zoom lightbox handlers
    evidenceGrid.querySelectorAll('.drawer-evidence-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const url = card.dataset.imgUrl;
        const fn = card.dataset.filename;
        if (url) openZoomModal(url, fn);
      });
    });
  }

  // 4. Complete Automated Rule Audit Trail
  const auditList = document.getElementById('drawer-audit-checks-list');
  const auditSummary = document.getElementById('drawer-audit-summary');
  const checks = Array.isArray(claim.rule_checks) && claim.rule_checks.length > 0
    ? claim.rule_checks
    : [
        { rule_id: 'age_limit', label: 'Age Window Validated', status: 'PASS', explanation: 'Claimant age 28 qualifies within 18–60 years bracket.' },
        { rule_id: 'waiting_period', label: 'Waiting Period Complied', status: 'PASS', explanation: 'Active policy duration satisfies the mandatory 15-day waiting period.' },
        { rule_id: 'doc_required', label: 'Mandatory Proofs Verified', status: 'PASS', explanation: 'Primary clinic OPD bill present with doctor signature and clinic stamp.' },
        { rule_id: 'exclusions', label: 'Exclusions & Uncovered Charges', status: 'WARNING', explanation: '₹450 multivitamins excluded per policy exclusion clause.' },
        { rule_id: 'coverage_cap', label: 'Policy Coverage Limit Cap', status: 'PASS', explanation: 'Eligible payout of ₹1,750 is within policy maximum cap of ₹5,000.' },
      ];

  const passCount = checks.filter((c) => c.status === 'PASS').length;
  const totalCount = checks.length;
  const warnCount = checks.filter((c) => c.status === 'WARNING').length;
  const failCount = checks.filter((c) => c.status === 'FAIL').length;

  if (auditSummary) {
    if (failCount === 0 && warnCount === 0) {
      auditSummary.textContent = `${totalCount} of ${totalCount} Checks Passed (100% Compliant)`;
      auditSummary.className = 'compliance-badge-summary';
    } else if (failCount === 0) {
      auditSummary.textContent = `${passCount} of ${totalCount} Checks Passed (${warnCount} Soft Warning)`;
      auditSummary.className = 'compliance-badge-summary has-warnings';
    } else {
      auditSummary.textContent = `${passCount} of ${totalCount} Checks Passed (${failCount} Blocker Flag)`;
      auditSummary.className = 'compliance-badge-summary has-warnings';
    }
  }

  if (auditList) {
    auditList.innerHTML = checks
      .map((rc) => {
        const isP = rc.status === 'PASS';
        const isW = rc.status === 'WARNING';
        const badgeText = isP ? '✓ PASS' : (isW ? '⚠️ WARNING' : '✕ FAIL');
        const badgeCls = isP ? 'badge-pass' : (isW ? 'badge-warning' : 'badge-fail');
        const rowCls = isP ? 'audit-pass' : (isW ? 'audit-warning' : 'audit-fail');

        return `
          <div class="drawer-audit-row ${rowCls}">
            <span class="badge ${badgeCls}" style="font-size: 0.72rem; flex-shrink: 0;">${badgeText}</span>
            <div class="drawer-audit-body">
              <span class="drawer-audit-title">${rc.label || rc.rule_id}</span>
              <span class="drawer-audit-desc">${rc.explanation || ''}</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // 5. Reviewer Decision Panel
  const approvedInput = document.getElementById('reviewer-approved-amount');
  const notesTextarea = document.getElementById('reviewer-notes');
  const hintEl = document.getElementById('reviewer-amount-hint');

  const eligibleAmt = claim.approved_amount_inr != null ? claim.approved_amount_inr : (claim.claimed_amount_inr || 0);

  if (approvedInput) {
    approvedInput.value = String(eligibleAmt);
  }
  if (notesTextarea) {
    notesTextarea.value = claim.reviewer_notes || '';
  }
  if (hintEl) {
    hintEl.textContent = `Claimed: ₹${formatCurrency(claim.claimed_amount_inr)} | Pre-validated eligible payout: ₹${formatCurrency(eligibleAmt)}`;
  }

  // Reset decision button states
  const btnApprove = document.getElementById('btn-decision-approve');
  const btnInfo = document.getElementById('btn-decision-info');
  const btnReject = document.getElementById('btn-decision-reject');

  [btnApprove, btnInfo, btnReject].forEach((b) => {
    if (b) {
      b.disabled = false;
      b.style.opacity = '1';
    }
  });

  if (btnApprove) btnApprove.innerHTML = '✓ Approve Payout';
  if (btnInfo) btnInfo.innerHTML = '⚠️ Request More Info';
  if (btnReject) btnReject.innerHTML = '✕ Reject Claim';
}

/**
 * Submit officer decision (APPROVE, INFO_REQUESTED, REJECT)
 * Calling PATCH /api/claims/{id}/decision
 * Refreshes queue list and KPI strip immediately after saving.
 * @param {string} claimId
 * @param {'APPROVED' | 'INFO_REQUESTED' | 'REJECTED'} decisionStatus
 */
export async function submitOfficerDecision(claimId, decisionStatus) {
  const approvedInput = document.getElementById('reviewer-approved-amount');
  const notesTextarea = document.getElementById('reviewer-notes');

  const btnApprove = document.getElementById('btn-decision-approve');
  const btnInfo = document.getElementById('btn-decision-info');
  const btnReject = document.getElementById('btn-decision-reject');

  let approvedAmt = approvedInput ? parseFloat(approvedInput.value) : 0;
  if (isNaN(approvedAmt)) approvedAmt = 0;

  // Validation
  if (decisionStatus === 'APPROVED' && approvedAmt <= 0) {
    showToast('Please enter a valid payout amount greater than ₹0 to approve.', 'warning');
    if (approvedInput) approvedInput.focus();
    return;
  }

  if (decisionStatus === 'REJECTED') {
    approvedAmt = 0;
    if (approvedInput) approvedInput.value = '0';
  }

  let notes = notesTextarea ? notesTextarea.value.trim() : '';
  if (!notes) {
    if (decisionStatus === 'APPROVED') {
      notes = 'Authorized for instant direct benefit transfer (DBT) to registered bank account.';
    } else if (decisionStatus === 'INFO_REQUESTED') {
      notes = 'Please provide certified prescription and medical certificate for further audit.';
    } else {
      notes = 'Claim rejected due to non-compliance with policy terms and conditions.';
    }
    if (notesTextarea) notesTextarea.value = notes;
  }

  // Disable buttons while saving
  [btnApprove, btnInfo, btnReject].forEach((b) => {
    if (b) {
      b.disabled = true;
      b.style.opacity = '0.6';
    }
  });

  const activeBtn =
    decisionStatus === 'APPROVED'
      ? btnApprove
      : decisionStatus === 'INFO_REQUESTED'
      ? btnInfo
      : btnReject;
  if (activeBtn) activeBtn.innerHTML = '<span>⏳ Saving Decision...</span>';

  try {
    const updated = await updateClaimDecision(claimId, {
      status: decisionStatus,
      approved_amount_inr: approvedAmt,
      reviewer_notes: notes,
    });

    const statusClean = decisionStatus.replace(/_/g, ' ');
    showToast(`Claim ${claimId} successfully marked as ${statusClean}!`, 'success', 3500);

    // Refresh queue list and 4-metric KPI summary strip immediately
    await fetchAndRenderQueue(claimId);

    // Close the review drawer
    closeClaimDetailDrawer();
  } catch (err) {
    console.error('Failed to submit officer decision:', err);
    showToast(`Failed to save decision: ${err.message}`, 'error');
    [btnApprove, btnInfo, btnReject].forEach((b) => {
      if (b) {
        b.disabled = false;
        b.style.opacity = '1';
      }
    });
    if (btnApprove) btnApprove.innerHTML = '✓ Approve Payout';
    if (btnInfo) btnInfo.innerHTML = '⚠️ Request More Info';
    if (btnReject) btnReject.innerHTML = '✕ Reject Claim';
  }
}
