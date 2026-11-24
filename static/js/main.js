/**
 * SurakshaSetu — Micro-Insurance Assistant
 * ES Module main application coordinator
 */

import {
  state,
  subscribe,
  setActiveTab,
  setLanguage,
  setPolicies,
  setInsurerClaims,
  setSystemHealth,
  setSamples,
} from './state.js';

import {
  fetchPolicies,
  fetchClaims,
  fetchHealth,
  fetchSamples,
  showToast,
} from './api.js';

import {
  initI18n,
  applyTranslations,
  t,
} from './i18n.js';

import { initRecommender } from './recommender.js';
import { initClaimWizard } from './claimWizard.js';
import { initInsurerQueue, renderInsurerQueue, fetchAndRenderQueue } from './insurerQueue.js';

// DOM Elements Cache
const elements = {
  desktopTabs: document.querySelectorAll('.desktop-nav .tab-btn'),
  mobileNavBtns: document.querySelectorAll('.mobile-nav-btn'),
  viewSections: {
    recommend: document.getElementById('view-recommend'),
    claim: document.getElementById('view-claim'),
    insurer: document.getElementById('view-insurer'),
  },
  insurerPendingBadge: document.getElementById('insurer-pending-badge'),
  mobileInsurerBadge: document.getElementById('mobile-insurer-badge'),
  langToggleBtn: document.getElementById('lang-toggle-btn'),
  langText: document.getElementById('lang-text'),
  healthIndicator: document.getElementById('health-indicator'),
  toastRegion: document.getElementById('toast-region'),
  modalRoot: document.getElementById('modal-root'),
};

/**
 * Switch view section and synchronize both desktop & mobile navigation
 * @param {'recommend' | 'claim' | 'insurer'} viewName
 */
export function switchView(viewName) {
  if (!elements.viewSections[viewName]) {
    console.warn(`View "${viewName}" does not exist.`);
    return;
  }

  setActiveTab(viewName);

  // 1. Update Sections
  Object.entries(elements.viewSections).forEach(([name, section]) => {
    if (section) {
      if (name === viewName) {
        section.hidden = false;
        section.classList.add('active');
        section.focus({ preventScroll: true });
        if (viewName === 'insurer') {
          fetchAndRenderQueue();
        }
      } else {
        section.hidden = true;
        section.classList.remove('active');
      }
    }
  });

  // 2. Update Desktop Tabs
  elements.desktopTabs.forEach((tab) => {
    const isTarget = tab.dataset.view === viewName;
    tab.classList.toggle('active', isTarget);
    tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  // 3. Update Mobile Bottom Nav Buttons
  elements.mobileNavBtns.forEach((btn) => {
    const isTarget = btn.dataset.view === viewName;
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  // 4. Update URL Hash without page jump
  if (typeof window !== 'undefined' && window.location && window.history) {
    if (window.location.hash !== `#view-${viewName}`) {
      window.history.replaceState(null, '', `#view-${viewName}`);
    }
  }
}

/**
 * Toggle Language between English and Hindi
 */
export function toggleLanguage() {
  const newLang = state.language === 'en' ? 'hi' : 'en';
  setLanguage(newLang);
  applyTranslations(newLang);

  if (elements.langText) {
    elements.langText.textContent = newLang === 'en' ? 'EN / हिंदी' : 'हिंदी / EN';
  }

  showToast(
    t('msg_lang_switched', newLang),
    'info',
    2500
  );
}

/**
 * Update UI pending count badges from state
 * @param {number} count
 */
function updatePendingBadges(count) {
  const badgeText = String(count || 0);
  if (elements.insurerPendingBadge) {
    elements.insurerPendingBadge.textContent = badgeText;
  }
  if (elements.mobileInsurerBadge) {
    elements.mobileInsurerBadge.textContent = badgeText;
  }
}

/**
 * Update UI health status pill from state
 * @param {{ status: string, geminiActive: boolean }} health
 */
function updateHealthPill(health) {
  if (!elements.healthIndicator) return;
  const dot = elements.healthIndicator.querySelector('.status-dot');
  const label = elements.healthIndicator.querySelector('.status-label');

  if (health.status === 'healthy') {
    if (dot) dot.style.backgroundColor = '#15803d'; // Emerald
    if (label) label.textContent = health.geminiActive ? 'Online' : 'Demo Fallback';
  } else if (health.status === 'offline') {
    if (dot) dot.style.backgroundColor = '#b91c1c'; // Crimson
    if (label) label.textContent = 'Disconnected';
  } else {
    if (dot) dot.style.backgroundColor = '#b45309'; // Amber
    if (label) label.textContent = 'Degraded';
  }
}

/**
 * Check backend server health (/api/health) and handle offline/disconnected state
 * @param {boolean} [notifySuccess=false]
 */
export async function checkServerHealth(notifySuccess = false) {
  const banner = document.getElementById('server-disconnected-banner');
  const retryBtn = document.getElementById('btn-retry-server-connection');

  // Check client network status first
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (banner) banner.hidden = false;
    setSystemHealth({
      status: 'offline',
      geminiActive: false,
      model: 'none',
    });
    return false;
  }

  if (retryBtn) {
    retryBtn.disabled = true;
    retryBtn.innerHTML = '<span class="retry-icon spin" aria-hidden="true">↻</span><span>Reconnecting...</span>';
  }

  try {
    const health = await fetchHealth();
    if (health && (health.status === 'healthy' || health.gemini_model)) {
      if (banner) banner.hidden = true;
      setSystemHealth({
        status: 'healthy',
        geminiActive: Boolean(health.gemini_api_key_configured),
        model: health.gemini_model || 'gemini-3.5-flash-lite',
      });
      if (notifySuccess) {
        showToast('Connection restored. Backend server is online.', 'success');
      }
      return true;
    } else {
      throw new Error('Health check returned non-healthy status');
    }
  } catch (err) {
    console.warn('Server health check failed:', err);
    if (banner) banner.hidden = false;
    setSystemHealth({
      status: 'offline',
      geminiActive: false,
      model: 'none',
    });
    if (notifySuccess) {
      showToast('Unable to reach server. Please check that backend is running.', 'error');
    }
    return false;
  } finally {
    if (retryBtn) {
      retryBtn.disabled = false;
      retryBtn.innerHTML = '<span class="retry-icon" aria-hidden="true">↻</span><span>Retry Connection</span>';
    }
  }
}

/**
 * Initialize reactive state subscriptions
 */
function initSubscriptions() {
  subscribe((currentState, changedKey) => {
    if (changedKey === 'activeTab') {
      // Sync tabs if changed via state setter
      elements.desktopTabs.forEach((tab) => {
        const isTarget = tab.dataset.view === currentState.activeTab;
        tab.classList.toggle('active', isTarget);
        tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
      });
      elements.mobileNavBtns.forEach((btn) => {
        const isTarget = btn.dataset.view === currentState.activeTab;
        btn.classList.toggle('active', isTarget);
        btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
      });
    }

    if (changedKey === 'insurerClaims') {
      const pendingCount =
        (currentState.insurerClaims.metrics?.ready_to_approve || 0) +
        (currentState.insurerClaims.metrics?.needs_review || 0);
      updatePendingBadges(pendingCount);
      renderInsurerQueue();
    }

    if (changedKey === 'systemHealth') {
      updateHealthPill(currentState.systemHealth);
    }

    if (changedKey === 'wizardStep') {
      const stepItems = document.querySelectorAll('.wizard-step-item');
      stepItems.forEach((item) => {
        const stepNum = parseInt(item.getAttribute('data-step') || '1', 10);
        item.classList.toggle('active', stepNum === currentState.wizardStep);
      });
    }

    if (changedKey === 'selectedPolicyId') {
      const claimPolicyInput = document.getElementById('claim-policy-id');
      if (claimPolicyInput && currentState.selectedPolicyId) {
        claimPolicyInput.value = currentState.selectedPolicyId;
      }
    }
  });
}

/**
 * Initialize DOM interactive event listeners
 */
function initEventListeners() {
  // Desktop Tab Clicks
  elements.desktopTabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const view = tab.dataset.view;
      if (view) switchView(view);
    });
  });

  // Mobile Bottom Nav Clicks
  elements.mobileNavBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const view = btn.dataset.view;
      if (view) switchView(view);
    });
  });

  // Language Toggle
  if (elements.langToggleBtn) {
    elements.langToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleLanguage();
    });
  }

  // Window Hash Routing
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#view-', '');
    if (['recommend', 'claim', 'insurer'].includes(hash) && hash !== state.activeTab) {
      switchView(hash);
    }
  });

  // Initial Hash check
  const initialHash = window.location.hash.replace('#view-', '');
  if (['recommend', 'claim', 'insurer'].includes(initialHash)) {
    switchView(initialHash);
  }

  // Network & Server Connectivity Listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      checkServerHealth(true);
    });

    window.addEventListener('offline', () => {
      const banner = document.getElementById('server-disconnected-banner');
      if (banner) banner.hidden = false;
      setSystemHealth({
        status: 'offline',
        geminiActive: false,
        model: 'none',
      });
      showToast('Network connection lost. Running in offline mode.', 'warning');
    });
  }

  // Retry Connection Button in Disconnected Banner
  const retryBtn = document.getElementById('btn-retry-server-connection');
  if (retryBtn) {
    retryBtn.addEventListener('click', (e) => {
      e.preventDefault();
      checkServerHealth(true);
    });
  }
}

/**
 * Load initial data on application boot
 * Fetches /api/policies and /api/claims cleanly
 */
export async function loadInitialData() {
  try {
    // 1. Fetch policies, claims, and demo samples in parallel
    const [policiesResult, claimsResult, healthResult, samplesResult] = await Promise.allSettled([
      fetchPolicies(),
      fetchClaims(),
      fetchHealth(),
      fetchSamples(),
    ]);

    // Handle Policies
    if (policiesResult.status === 'fulfilled') {
      setPolicies(policiesResult.value);
    } else {
      console.warn('Failed to load policies catalog:', policiesResult.reason);
    }

    // Handle Demo Samples for Quick Demo Cases (For Judges)
    if (samplesResult.status === 'fulfilled' && Array.isArray(samplesResult.value)) {
      setSamples(samplesResult.value);
    } else {
      console.warn('Failed to load demo samples:', samplesResult.reason);
    }

    // Handle Claims & Dashboard Metrics
    if (claimsResult.status === 'fulfilled') {
      setInsurerClaims(claimsResult.value);
      const pending =
        (claimsResult.value?.metrics?.ready_to_approve || 0) +
        (claimsResult.value?.metrics?.needs_review || 0);
      updatePendingBadges(pending);
      renderInsurerQueue();
    } else {
      console.warn('Failed to load insurer claims:', claimsResult.reason);
    }

    // Handle Health Status & Disconnected Banner
    const banner = document.getElementById('server-disconnected-banner');
    if (healthResult.status === 'fulfilled' && healthResult.value && healthResult.value.status === 'healthy') {
      const h = healthResult.value;
      if (banner) banner.hidden = true;
      setSystemHealth({
        status: 'healthy',
        geminiActive: !!h.gemini_api_key_configured,
        model: h.gemini_model || 'gemini-3.5-flash-lite',
      });
    } else {
      if (banner) banner.hidden = false;
      setSystemHealth({
        status: 'offline',
        geminiActive: false,
        model: 'none',
      });
    }

    // Periodic background health check every 45s
    if (typeof window !== 'undefined' && typeof setInterval === 'function') {
      setInterval(() => {
        checkServerHealth(false);
      }, 45000);
    }
  } catch (err) {
    console.error('Error during initial data bootstrap:', err);
  }
}

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  initSubscriptions();
  initEventListeners();
  initRecommender();
  initClaimWizard();
  initInsurerQueue();
  loadInitialData();
});
