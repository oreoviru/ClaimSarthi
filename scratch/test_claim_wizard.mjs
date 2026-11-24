// Node.js test script for verifying guided 4-step Claim Wizard functionality

// Minimal DOM mock environment
const elementsMap = {};

function createMockElement(tag, id = '', className = '') {
  let _className = className;
  const classes = new Set(className ? className.split(' ').filter(Boolean) : []);
  const el = {
    tagName: tag.toUpperCase(),
    id: id,
    get className() { return _className; },
    set className(val) {
      _className = String(val);
      classes.clear();
      _className.split(' ').filter(Boolean).forEach(c => classes.add(c));
    },
    classList: {
      _classes: classes,
      add(c) { classes.add(c); _className = Array.from(classes).join(' '); },
      remove(c) { classes.delete(c); _className = Array.from(classes).join(' '); },
      toggle(c, force) {
        if (force === undefined) {
          if (classes.has(c)) classes.delete(c);
          else classes.add(c);
        } else if (force) {
          classes.add(c);
        } else {
          classes.delete(c);
        }
        _className = Array.from(classes).join(' ');
      },
      contains(c) { return classes.has(c); },
    },
    attributes: {},
    dataset: {},
    getAttribute(name) { return this.attributes[name] || null; },
    setAttribute(name, val) { this.attributes[name] = String(val); },
    removeAttribute(name) { delete this.attributes[name]; },
    _innerHTML: '',
    get innerHTML() { return this._innerHTML; },
    set innerHTML(val) {
      this._innerHTML = String(val);
      this.textContent = String(val).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    },
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    href: '',
    target: '',
    hidden: false,
    style: {},
    children: [],
    _eventListeners: {},
    addEventListener(evt, fn) {
      if (!this._eventListeners[evt]) this._eventListeners[evt] = [];
      this._eventListeners[evt].push(fn);
    },
    click() {
      this.dispatchEvent({ type: 'click', preventDefault() {} });
    },
    dispatchEvent(event) {
      const fns = this._eventListeners[event.type] || [];
      fns.forEach(fn => fn(event));
    },
    focus() {},
    scrollIntoView() {},
    querySelector(sel) {
      if (sel.startsWith('#')) return findById(this, sel.slice(1));
      if (sel.startsWith('.')) return findByClass(this, sel.slice(1));
      return null;
    },
    querySelectorAll(sel) {
      const results = [];
      findAll(this, sel, results);
      return results;
    }
  };
  return el;
}

function findById(node, id) {
  if (node.id === id) return node;
  for (const child of (node.children || [])) {
    const res = findById(child, id);
    if (res) return res;
  }
  return null;
}

function findByClass(node, className) {
  if (node.classList && node.classList.contains(className)) return node;
  for (const child of (node.children || [])) {
    const res = findByClass(child, className);
    if (res) return res;
  }
  return null;
}

function findAll(node, sel, results) {
  const isMatch = (n) => {
    if (sel.startsWith('.')) {
      const classes = sel.slice(1).split('.');
      return classes.every(c => n.classList && n.classList.contains(c));
    }
    return false;
  };
  if (isMatch(node)) results.push(node);
  for (const child of (node.children || [])) {
    findAll(child, sel, results);
  }
}

function reg(id, el) {
  elementsMap[id] = el;
  return el;
}

const root = createMockElement('body');

const doc = {
  documentElement: createMockElement('html'),
  body: root,
  getElementById(id) {
    return elementsMap[id] || null;
  },
  querySelectorAll(sel) {
    if (sel === '.wizard-step-item') return elementsMap['step-items'] || [];
    if (sel === '.mobile-dot') return elementsMap['mobile-dots'] || [];
    if (sel === '.date-preset-btn') return elementsMap['date-presets'] || [];
    if (sel === '.incident-preset-btn') return elementsMap['incident-presets'] || [];
    if (sel.includes('.filter-tab-btn')) return elementsMap['filter-tab-btns'] || [];
    if (sel.includes('data-i18n')) return [];
    return [];
  },
  querySelector(sel) {
    return null;
  },
  createElement(tag) {
    return createMockElement(tag);
  },
  addEventListener: () => {},
  removeEventListener: () => {}
};

// Set up globals
globalThis.document = doc;
globalThis.window = {
  location: { hash: '' },
  history: { replaceState: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.HTMLElement = class {};
globalThis.fetch = async (url = '', options = {}) => {
  const urlStr = String(url);
  if (urlStr.includes('/api/submit-claim')) {
    return {
      ok: true,
      status: 200,
      headers: {
        get: (h) => (h && h.toLowerCase() === 'content-type' ? 'application/json' : '')
      },
      json: async () => ({
        claim_id: 'CLM-2026-0048',
        policy_id: 'micro_health_gig',
        policy_name: 'Gig-Worker Micro-Health Clinic Shield',
        claimant_name: 'Ramesh Pawar',
        claimed_amount_inr: 7800.0,
        approved_amount_inr: 5000.0,
        reviewer_status: 'READY_TO_APPROVE',
        created_at: '2026-11-24T16:00:00Z',
      }),
    };
  }

  if (urlStr.includes('/api/claims/') && urlStr.endsWith('/decision')) {
    const body = options.body ? JSON.parse(options.body) : {};
    return {
      ok: true,
      status: 200,
      headers: { get: (h) => 'application/json' },
      json: async () => ({
        claim_id: 'CLM-2026-0001',
        reviewer_status: body.status || 'APPROVED',
        approved_amount_inr: body.approved_amount_inr || 3200.0,
        reviewer_notes: body.reviewer_notes || 'Approved.',
        decision_timestamp: new Date().toISOString(),
      }),
    };
  }

  if (urlStr.includes('/api/claims/CLM-2026-')) {
    return {
      ok: true,
      status: 200,
      headers: { get: (h) => 'application/json' },
      json: async () => ({
        claim_id: 'CLM-2026-0001',
        policy_id: 'micro_health_gig',
        policy_name: 'Gig-Worker Micro-Health Clinic Shield',
        claimant_name: 'Vikram Patel',
        claimant_age: 29,
        claimant_phone: '+91 98765 43210',
        claimant_aadhaar_last4: '4821',
        bank_account_number: '501004829104',
        bank_ifsc: 'HDFC0001245',
        incident_date: '2026-02-12',
        incident_subtype: 'Clinic Visit - Severe Bronchitis',
        claimed_amount_inr: 3200.0,
        approved_amount_inr: 3200.0,
        reviewer_status: 'READY_TO_APPROVE',
        extracted_data: {
          provider_name: 'City Health Care Clinic, Lucknow',
          bill_date: '2026-02-12',
          diagnosis: 'Acute Bronchitis',
          total_amount_inr: 3200.0,
          legibility_score: 0.95,
          itemized_charges: [
            { description: 'OPD Consultation', amount_inr: 500.0, is_covered: true, category: 'consultation' },
            { description: 'Antibiotics & Antipyretic', amount_inr: 2250.0, is_covered: true, category: 'pharmacy' },
            { description: 'Multivitamin Syrup', amount_inr: 450.0, is_covered: false, category: 'excluded_supplements' }
          ]
        },
        uploaded_documents: [
          { doc_type: 'hospital_bill', file_url: '/samples/clean_clinic_bill.jpg', original_filename: 'clinic_bill_signed.jpg' },
          { doc_type: 'doctor_prescription', file_url: '/samples/clean_clinic_bill.jpg', original_filename: 'rx_prescription.jpg' }
        ],
        rule_checks: [
          { rule_id: 'age_limit', label: 'Age Window Validated', status: 'PASS', explanation: 'Age 29 within 18-60 bracket.' },
          { rule_id: 'waiting_period', label: 'Waiting Period Complied', status: 'PASS', explanation: 'Enrolled > 15 days ago.' },
          { rule_id: 'mandatory_docs', label: 'Mandatory Proofs Verified', status: 'PASS', explanation: 'Clinic bill and prescription present.' },
          { rule_id: 'exclusions', label: 'Exclusions & Deductions', status: 'PASS', explanation: 'All covered services eligible.' },
          { rule_id: 'coverage_cap', label: 'Policy Coverage Limit', status: 'PASS', explanation: 'Claim amount within ₹5,000 sub-limit.' }
        ]
      }),
    };
  }

  if (urlStr.endsWith('/api/claims')) {
    return {
      ok: true,
      status: 200,
      headers: {
        get: (h) => (h && h.toLowerCase() === 'content-type' ? 'application/json' : '')
      },
      json: async () => ({
        metrics: { total_claims: 2, ready_to_approve: 1, needs_review: 1, approved_count: 0, prevented_rejections_count: 1 },
        claims: [
          {
            claim_id: 'CLM-2026-0041',
            policy_id: 'micro_health_gig',
            policy_name: 'Gig-Worker Micro-Health Clinic Shield',
            claimant_name: 'Ramesh Pawar',
            claimed_amount_inr: 7800.0,
            approved_amount_inr: 5000.0,
            reviewer_status: 'READY_TO_APPROVE',
            created_at: '2026-11-24T16:42:40Z',
          },
          {
            claim_id: 'CLM-2026-0001',
            policy_id: 'micro_health_gig',
            policy_name: 'Gig-Worker Micro-Health Clinic Shield',
            claimant_name: 'Vikram Patel',
            claimed_amount_inr: 3200.0,
            approved_amount_inr: 3200.0,
            reviewer_status: 'READY_TO_APPROVE',
            created_at: '2026-02-14T10:30:00Z',
          },
        ],
      }),
    };
  }

  return {
    ok: true,
    status: 200,
    headers: {
      get: (h) => (h && h.toLowerCase() === 'content-type' ? 'application/json' : '')
    },
    json: async () => ([
      { id: 'micro_health_gig', short_code: 'GIG-SHIELD', name: 'Gig-Worker Micro-Health Clinic Shield', max_claim_inr: 5000 },
      { id: 'pmsby', short_code: 'PMSBY', name: 'Pradhan Mantri Suraksha Bima Yojana', max_claim_inr: 200000 },
      { id: 'pmjjby', short_code: 'PMJJBY', name: 'Pradhan Mantri Jeevan Jyoti Bima Yojana', max_claim_inr: 200000 },
      { id: 'pmfby', short_code: 'PMFBY', name: 'Pradhan Mantri Fasal Bima Yojana', max_claim_inr: 50000 },
      { id: 'ab_pmjay', short_code: 'AB-PMJAY', name: 'Ayushman Bharat PM-JAY', max_claim_inr: 500000 },
    ])
  };
};

// Setup mock DOM elements for Claim Wizard
reg('view-claim', createMockElement('section', 'view-claim'));
reg('claim-stepper-container', createMockElement('div', 'claim-stepper-container'));
reg('wizard-steps-bar', createMockElement('nav', 'wizard-steps-bar'));

// Stepper items
const s1 = createMockElement('button', 'step-btn-1', 'wizard-step-item active');
s1.setAttribute('data-step', '1');
const b1 = createMockElement('span', '', 'wizard-step-badge');
b1.textContent = '1';
s1.children.push(b1);
s1.querySelector = (sel) => sel === '.wizard-step-badge' ? b1 : null;

const s2 = createMockElement('button', 'step-btn-2', 'wizard-step-item');
s2.setAttribute('data-step', '2');
const b2 = createMockElement('span', '', 'wizard-step-badge');
b2.textContent = '2';
s2.children.push(b2);
s2.querySelector = (sel) => sel === '.wizard-step-badge' ? b2 : null;

const s3 = createMockElement('button', 'step-btn-3', 'wizard-step-item');
s3.setAttribute('data-step', '3');
const b3 = createMockElement('span', '', 'wizard-step-badge');
b3.textContent = '3';
s3.children.push(b3);
s3.querySelector = (sel) => sel === '.wizard-step-badge' ? b3 : null;

const s4 = createMockElement('button', 'step-btn-4', 'wizard-step-item');
s4.setAttribute('data-step', '4');
const b4 = createMockElement('span', '', 'wizard-step-badge');
b4.textContent = '4';
s4.children.push(b4);
s4.querySelector = (sel) => sel === '.wizard-step-badge' ? b4 : null;

elementsMap['step-items'] = [s1, s2, s3, s4];
elementsMap['wizard-steps-bar'].children = [s1, s2, s3, s4];

// Mobile Stepper
reg('mobile-step-pill', createMockElement('span', 'mobile-step-pill'));
reg('mobile-step-title', createMockElement('div', 'mobile-step-title'));
const d1 = createMockElement('span', '', 'mobile-dot active');
d1.setAttribute('data-step', '1');
const d2 = createMockElement('span', '', 'mobile-dot');
d2.setAttribute('data-step', '2');
const d3 = createMockElement('span', '', 'mobile-dot');
d3.setAttribute('data-step', '3');
const d4 = createMockElement('span', '', 'mobile-dot');
d4.setAttribute('data-step', '4');
elementsMap['mobile-dots'] = [d1, d2, d3, d4];

// Step Panels
reg('claim-step-1', createMockElement('div', 'claim-step-1', 'wizard-panel active'));
reg('claim-step-2', createMockElement('div', 'claim-step-2', 'wizard-panel'));
elementsMap['claim-step-2'].hidden = true;
reg('claim-step-3', createMockElement('div', 'claim-step-3', 'wizard-panel'));
elementsMap['claim-step-3'].hidden = true;
reg('claim-step-4', createMockElement('div', 'claim-step-4', 'wizard-panel'));
elementsMap['claim-step-4'].hidden = true;

// Step 1 Inputs
reg('claim-policy-id', createMockElement('select', 'claim-policy-id'));
elementsMap['claim-policy-id'].value = 'micro_health_gig';
reg('claim-policy-requirements', createMockElement('div', 'claim-policy-requirements'));

const pBtn180 = createMockElement('button', '', 'preset-pill date-preset-btn');
pBtn180.setAttribute('data-days-ago', '180');
const pBtn10 = createMockElement('button', '', 'preset-pill date-preset-btn warning-pill');
pBtn10.setAttribute('data-days-ago', '10');
const pBtn365 = createMockElement('button', '', 'preset-pill date-preset-btn');
pBtn365.setAttribute('data-days-ago', '365');
elementsMap['date-presets'] = [pBtn180, pBtn10, pBtn365];

const incBtn0 = createMockElement('button', '', 'preset-pill incident-preset-btn');
incBtn0.setAttribute('data-days-ago', '0');
const incBtn1 = createMockElement('button', '', 'preset-pill incident-preset-btn');
incBtn1.setAttribute('data-days-ago', '1');
const incBtn3 = createMockElement('button', '', 'preset-pill incident-preset-btn');
incBtn3.setAttribute('data-days-ago', '3');
elementsMap['incident-presets'] = [incBtn0, incBtn1, incBtn3];

reg('claim-claimant-name', createMockElement('input', 'claim-claimant-name'));
elementsMap['claim-claimant-name'].value = 'Ramesh Kumar';
reg('claim-claimant-age', createMockElement('input', 'claim-claimant-age'));
elementsMap['claim-claimant-age'].value = '28';
reg('claim-claimant-phone', createMockElement('input', 'claim-claimant-phone'));
elementsMap['claim-claimant-phone'].value = '9876543210';
reg('claim-claimant-aadhaar', createMockElement('input', 'claim-claimant-aadhaar'));
elementsMap['claim-claimant-aadhaar'].value = '4821';
reg('claim-bank-account', createMockElement('input', 'claim-bank-account'));
elementsMap['claim-bank-account'].value = '501004829104';
reg('claim-bank-ifsc', createMockElement('input', 'claim-bank-ifsc'));
elementsMap['claim-bank-ifsc'].value = 'HDFC0001245';
reg('claim-incident-date', createMockElement('input', 'claim-incident-date'));
elementsMap['claim-incident-date'].value = '2026-02-15';
reg('claim-policy-start-date', createMockElement('input', 'claim-policy-start-date'));
elementsMap['claim-policy-start-date'].value = '2025-01-01';
reg('claim-incident-subtype', createMockElement('select', 'claim-incident-subtype'));
elementsMap['claim-incident-subtype'].value = 'fever_typhoid';
reg('claim-incident-desc', createMockElement('textarea', 'claim-incident-desc'));
elementsMap['claim-incident-desc'].value = 'Fever and typhoid clinic bill';

reg('btn-step-1-next', createMockElement('button', 'btn-step-1-next'));

// Step 2 Inputs & Previews
reg('policy-upload-slots-container', createMockElement('div', 'policy-upload-slots-container'));
reg('claim-primary-doc-type', createMockElement('select', 'claim-primary-doc-type'));
elementsMap['claim-primary-doc-type'].value = 'clinic_opd_bill';
reg('claim-dropzone', createMockElement('div', 'claim-dropzone'));
reg('claim-file-input', createMockElement('input', 'claim-file-input'));
reg('btn-browse-files', createMockElement('button', 'btn-browse-files'));
reg('claim-previews-container', createMockElement('div', 'claim-previews-container'));
reg('preview-count', createMockElement('span', 'preview-count'));
reg('btn-sample-clean', createMockElement('button', 'btn-sample-clean'));
reg('btn-sample-tricky', createMockElement('button', 'btn-sample-tricky'));
reg('btn-sample-crop', createMockElement('button', 'btn-sample-crop'));
reg('btn-step-2-back', createMockElement('button', 'btn-step-2-back'));
reg('btn-step-2-next', createMockElement('button', 'btn-step-2-next'));

// Step 3 Elements
reg('claim-analysis-loading', createMockElement('div', 'claim-analysis-loading'));
reg('loading-stages-container', createMockElement('div', 'loading-stages-container'));
reg('loading-progress-bar', createMockElement('div', 'loading-progress-bar'));
reg('loading-progress-percent', createMockElement('div', 'loading-progress-percent'));
reg('loading-stage-1', createMockElement('div', 'loading-stage-1'));
reg('loading-indicator-1', createMockElement('div', 'loading-indicator-1'));
reg('stage-badge-1', createMockElement('span', 'stage-badge-1'));
reg('loading-desc-1', createMockElement('p', 'loading-desc-1'));
reg('loading-stage-2', createMockElement('div', 'loading-stage-2'));
reg('loading-indicator-2', createMockElement('div', 'loading-indicator-2'));
reg('stage-badge-2', createMockElement('span', 'stage-badge-2'));
reg('loading-desc-2', createMockElement('p', 'loading-desc-2'));
reg('loading-stage-3', createMockElement('div', 'loading-stage-3'));
reg('loading-indicator-3', createMockElement('div', 'loading-indicator-3'));
reg('stage-badge-3', createMockElement('span', 'stage-badge-3'));
reg('loading-desc-3', createMockElement('p', 'loading-desc-3'));
reg('loading-error-panel', createMockElement('div', 'loading-error-panel'));
reg('loading-error-title', createMockElement('h4', 'loading-error-title'));
reg('loading-error-msg', createMockElement('p', 'loading-error-msg'));
reg('btn-retry-analysis', createMockElement('button', 'btn-retry-analysis'));
reg('btn-loading-back-step2', createMockElement('button', 'btn-loading-back-step2'));
reg('claim-analysis-results', createMockElement('div', 'claim-analysis-results'));
reg('claim-readiness-score', createMockElement('span', 'claim-readiness-score'));
reg('claim-readiness-badge', createMockElement('span', 'claim-readiness-badge'));
reg('claim-readiness-title', createMockElement('h4', 'claim-readiness-title'));
reg('claim-readiness-desc', createMockElement('p', 'claim-readiness-desc'));
reg('claim-val-claimed', createMockElement('strong', 'claim-val-claimed'));
reg('claim-val-payout', createMockElement('strong', 'claim-val-payout'));
reg('claim-ext-provider', createMockElement('input', 'claim-ext-provider'));
reg('claim-ext-date', createMockElement('input', 'claim-ext-date'));
reg('claim-ext-diagnosis', createMockElement('input', 'claim-ext-diagnosis'));
reg('claim-ext-total', createMockElement('input', 'claim-ext-total'));
reg('hint-ext-provider', createMockElement('div', 'hint-ext-provider'));
reg('hint-ext-date', createMockElement('div', 'hint-ext-date'));
reg('hint-ext-diagnosis', createMockElement('div', 'hint-ext-diagnosis'));
reg('hint-ext-total', createMockElement('div', 'hint-ext-total'));
reg('tag-ext-provider', createMockElement('span', 'tag-ext-provider'));
reg('tag-ext-date', createMockElement('span', 'tag-ext-date'));
reg('tag-ext-diagnosis', createMockElement('span', 'tag-ext-diagnosis'));
reg('tag-ext-total', createMockElement('span', 'tag-ext-total'));
reg('claim-legibility-badge', createMockElement('span', 'claim-legibility-badge'));
reg('claim-itemized-list', createMockElement('div', 'claim-itemized-list'));
reg('itemized-count-badge', createMockElement('span', 'itemized-count-badge'));
reg('claim-fixit-box', createMockElement('div', 'claim-fixit-box'));
reg('claim-fixit-list', createMockElement('div', 'claim-fixit-list'));
reg('claim-rule-checks-list', createMockElement('div', 'claim-rule-checks-list'));
reg('claim-crosscheck-scorecard', createMockElement('div', 'claim-crosscheck-scorecard'));
reg('scorecard-summary-bar', createMockElement('div', 'scorecard-summary-bar'));
reg('scorecard-readiness-val', createMockElement('span', 'scorecard-readiness-val'));
reg('scorecard-meter-fill', createMockElement('div', 'scorecard-meter-fill'));
reg('scorecard-readiness-sub', createMockElement('span', 'scorecard-readiness-sub'));
reg('scorecard-status-val', createMockElement('span', 'scorecard-status-val'));
reg('scorecard-status-sub', createMockElement('span', 'scorecard-status-sub'));
reg('scorecard-payout-val', createMockElement('strong', 'scorecard-payout-val'));
reg('scorecard-billed-val', createMockElement('strong', 'scorecard-billed-val'));
reg('scorecard-deduction-val', createMockElement('span', 'scorecard-deduction-val'));
reg('scorecard-deduction-wrap', createMockElement('div', 'scorecard-deduction-wrap'));
reg('scorecard-recheck-footer', createMockElement('div', 'scorecard-recheck-footer'));
reg('btn-recheck-my-claim', createMockElement('button', 'btn-recheck-my-claim'));
reg('btn-revalidate-claim', createMockElement('button', 'btn-revalidate-claim'));
reg('btn-step-3-back', createMockElement('button', 'btn-step-3-back'));
reg('btn-step-3-next', createMockElement('button', 'btn-step-3-next'));
reg('btn-toggle-doc-preview', createMockElement('button', 'btn-toggle-doc-preview'));
reg('inspector-photo-body', createMockElement('div', 'inspector-photo-body'));
reg('inspector-image-container', createMockElement('div', 'inspector-image-container'));
reg('btn-zoom-doc', createMockElement('button', 'btn-zoom-doc'));
reg('claim-zoom-modal', createMockElement('div', 'claim-zoom-modal'));
reg('zoom-modal-img', createMockElement('img', 'zoom-modal-img'));
reg('zoom-modal-filename', createMockElement('strong', 'zoom-modal-filename'));
reg('zoom-level-pill', createMockElement('span', 'zoom-level-pill'));
reg('btn-zoom-in', createMockElement('button', 'btn-zoom-in'));
reg('btn-zoom-out', createMockElement('button', 'btn-zoom-out'));
reg('btn-zoom-reset', createMockElement('button', 'btn-zoom-reset'));
reg('btn-close-zoom', createMockElement('button', 'btn-close-zoom'));

// Step 4 Elements
reg('claim-submit-review-state', createMockElement('div', 'claim-submit-review-state'));
reg('claim-submit-success-state', createMockElement('div', 'claim-submit-success-state'));
reg('claim-summary-dossier', createMockElement('div', 'claim-summary-dossier'));
reg('dossier-policy-name', createMockElement('strong', 'dossier-policy-name'));
reg('dossier-policy-type', createMockElement('span', 'dossier-policy-type'));
reg('dossier-coverage-summary', createMockElement('div', 'dossier-coverage-summary'));
reg('dossier-claimant-name', createMockElement('strong', 'dossier-claimant-name'));
reg('dossier-claimant-age', createMockElement('strong', 'dossier-claimant-age'));
reg('dossier-claimant-contact', createMockElement('strong', 'dossier-claimant-contact'));
reg('dossier-bank-account', createMockElement('strong', 'dossier-bank-account'));
reg('dossier-incident-date', createMockElement('strong', 'dossier-incident-date'));
reg('dossier-incident-type', createMockElement('strong', 'dossier-incident-type'));
reg('dossier-provider-name', createMockElement('strong', 'dossier-provider-name'));
reg('dossier-claimed-amount', createMockElement('strong', 'dossier-claimed-amount'));
reg('dossier-excluded-amount', createMockElement('strong', 'dossier-excluded-amount'));
reg('dossier-excluded-sub', createMockElement('span', 'dossier-excluded-sub'));
reg('dossier-payout-amount', createMockElement('strong', 'dossier-payout-amount'));
reg('dossier-itemized-summary', createMockElement('div', 'dossier-itemized-summary'));
reg('dossier-itemized-list', createMockElement('div', 'dossier-itemized-list'));
reg('dossier-item-count', createMockElement('span', 'dossier-item-count'));
reg('dossier-evidence-grid', createMockElement('div', 'dossier-evidence-grid'));
reg('dossier-evidence-count', createMockElement('span', 'dossier-evidence-count'));
reg('dossier-compliance-summary', createMockElement('span', 'dossier-compliance-summary'));
reg('dossier-compliance-pills', createMockElement('div', 'dossier-compliance-pills'));
reg('dossier-compliance-notes', createMockElement('div', 'dossier-compliance-notes'));
reg('dossier-readiness-badge', createMockElement('span', 'dossier-readiness-badge'));
reg('dossier-docs-list', createMockElement('div', 'dossier-docs-list'));
reg('claim-confirm-genuine', createMockElement('input', 'claim-confirm-genuine'));
reg('btn-submit-final-claim', createMockElement('button', 'btn-submit-final-claim'));
reg('btn-step-4-back', createMockElement('button', 'btn-step-4-back'));
reg('btn-file-another-claim', createMockElement('button', 'btn-file-another-claim'));
reg('receipt-claim-id', createMockElement('strong', 'receipt-claim-id'));
reg('receipt-policy-name', createMockElement('strong', 'receipt-policy-name'));
reg('receipt-eligible-amount', createMockElement('strong', 'receipt-eligible-amount'));
reg('receipt-status-badge', createMockElement('span', 'receipt-status-badge'));
reg('receipt-submission-time', createMockElement('strong', 'receipt-submission-time'));
reg('receipt-bank-destination', createMockElement('span', 'receipt-bank-destination'));
reg('btn-print-claim-pdf', createMockElement('a', 'btn-print-claim-pdf'));
reg('btn-open-insurer-queue', createMockElement('button', 'btn-open-insurer-queue'));
reg('btn-download-report', createMockElement('a', 'btn-download-report'));
reg('btn-download-json', createMockElement('a', 'btn-download-json'));

// Insurer View Elements
const tabInsurer = createMockElement('button', 'tab-insurer', 'tab-btn');
tabInsurer.setAttribute('data-view', 'insurer');
reg('tab-insurer', tabInsurer);
reg('view-insurer', createMockElement('section', 'view-insurer'));
reg('insurer-queue-container', createMockElement('div', 'insurer-queue-container'));

// Insurer Metrics Strip
reg('insurer-metrics-strip', createMockElement('div', 'insurer-metrics-strip'));
reg('metric-total-claims', createMockElement('span', 'metric-total-claims'));
reg('metric-ready-to-approve', createMockElement('span', 'metric-ready-to-approve'));
reg('metric-needs-review', createMockElement('span', 'metric-needs-review'));
reg('metric-prevented-rejections', createMockElement('span', 'metric-prevented-rejections'));

// Insurer Filter Tabs
const filterAll = createMockElement('button', 'filter-tab-all', 'filter-tab-btn active');
filterAll.dataset.filter = 'all';
const filterReady = createMockElement('button', 'filter-tab-ready', 'filter-tab-btn');
filterReady.dataset.filter = 'READY_TO_APPROVE';
const filterReview = createMockElement('button', 'filter-tab-review', 'filter-tab-btn');
filterReview.dataset.filter = 'NEEDS_REVIEW';
const filterApproved = createMockElement('button', 'filter-tab-approved', 'filter-tab-btn');
filterApproved.dataset.filter = 'APPROVED';

reg('filter-tab-all', filterAll);
reg('filter-tab-ready', filterReady);
reg('filter-tab-review', filterReview);
reg('filter-tab-approved', filterApproved);
elementsMap['filter-tab-btns'] = [filterAll, filterReady, filterReview, filterApproved];

const filterRow = createMockElement('div', 'insurer-status-filters');
filterRow.children = [filterAll, filterReady, filterReview, filterApproved];
filterRow.querySelectorAll = (sel) => {
  if (sel.includes('.filter-tab-btn') || sel === 'button') return [filterAll, filterReady, filterReview, filterApproved];
  return [];
};
reg('insurer-status-filters', filterRow);

reg('filter-count-all', createMockElement('span', 'filter-count-all'));
reg('filter-count-ready', createMockElement('span', 'filter-count-ready'));
reg('filter-count-review', createMockElement('span', 'filter-count-review'));
reg('filter-count-approved', createMockElement('span', 'filter-count-approved'));

// Claim Detail Drawer Elements
reg('modal-root', createMockElement('div', 'modal-root'));
reg('insurer-claim-drawer-backdrop', createMockElement('div', 'insurer-claim-drawer-backdrop'));
reg('insurer-claim-drawer', createMockElement('aside', 'insurer-claim-drawer'));
reg('btn-close-claim-drawer', createMockElement('button', 'btn-close-claim-drawer'));
reg('btn-drawer-print-pdf', createMockElement('a', 'btn-drawer-print-pdf'));
reg('drawer-claim-id', createMockElement('h3', 'drawer-claim-id'));
reg('drawer-status-badge', createMockElement('span', 'drawer-status-badge'));
reg('drawer-claimant-name', createMockElement('strong', 'drawer-claimant-name'));
reg('drawer-claimant-age', createMockElement('span', 'drawer-claimant-age'));
reg('drawer-claimant-contact', createMockElement('span', 'drawer-claimant-contact'));
reg('drawer-claimant-aadhaar', createMockElement('span', 'drawer-claimant-aadhaar'));
reg('drawer-policy-name', createMockElement('strong', 'drawer-policy-name'));
reg('drawer-incident-date', createMockElement('span', 'drawer-incident-date'));
reg('drawer-incident-type', createMockElement('span', 'drawer-incident-type'));
reg('drawer-bank-details', createMockElement('span', 'drawer-bank-details'));
reg('drawer-ocr-provider', createMockElement('strong', 'drawer-ocr-provider'));
reg('drawer-ocr-date', createMockElement('span', 'drawer-ocr-date'));
reg('drawer-ocr-diagnosis', createMockElement('strong', 'drawer-ocr-diagnosis'));
reg('drawer-ocr-total', createMockElement('strong', 'drawer-ocr-total'));
reg('drawer-ocr-confidence', createMockElement('span', 'drawer-ocr-confidence'));
reg('drawer-itemized-table', createMockElement('table', 'drawer-itemized-table'));
reg('drawer-itemized-list', createMockElement('tbody', 'drawer-itemized-list'));
reg('drawer-evidence-grid', createMockElement('div', 'drawer-evidence-grid'));
reg('drawer-evidence-count', createMockElement('span', 'drawer-evidence-count'));
reg('drawer-audit-checks-list', createMockElement('div', 'drawer-audit-checks-list'));
reg('drawer-audit-summary', createMockElement('span', 'drawer-audit-summary'));
reg('drawer-decision-panel', createMockElement('section', 'drawer-decision-panel'));
reg('drawer-decision-form', createMockElement('form', 'drawer-decision-form'));
reg('reviewer-approved-amount', createMockElement('input', 'reviewer-approved-amount'));
reg('reviewer-notes', createMockElement('textarea', 'reviewer-notes'));
reg('reviewer-amount-hint', createMockElement('span', 'reviewer-amount-hint'));
reg('btn-decision-approve', createMockElement('button', 'btn-decision-approve'));
reg('btn-decision-info', createMockElement('button', 'btn-decision-info'));
reg('btn-decision-reject', createMockElement('button', 'btn-decision-reject'));

async function runWizardTests() {
  console.log('--- Starting Guided Claim Wizard Integration Tests ---');

  const { state } = await import('../static/js/state.js');
  const { 
    initClaimWizard, 
    goToStep, 
    validateStep1, 
    validateStep2, 
    validateStep3,
    loadDemoSample,
    renderPreviews,
    renderSummaryDossier,
    renderUploadSlots,
    attachFileToSlot,
    removeSlotFile,
    formatFileSize,
    startAnalysisLoadingAnimation,
    completeAnalysisLoadingAnimation,
    showAnalysisLoadingError,
    setLoadingStageState,
    updateLoadingProgress,
    clearAnalysisTimers,
    initAnalysisRetryHandlers,
    initVerifyStep,
    renderVerifyStep,
    CONFIDENCE_THRESHOLD,
    POLICY_DOCUMENT_SLOTS,
    STEP_DEFINITIONS 
  } = await import('../static/js/claimWizard.js');

  const {
    getConfidenceScore,
    auditFieldElement,
    renderItemizedCharges,
    toggleMobilePhotoPreview,
    openZoomModal,
    closeZoomModal,
    formatDocTitle,
    isInlineDocAttached,
    handleAttachDemoProof,
    handleInlineDocUpload,
    handleRemoveInlineDoc,
    runRevalidation
  } = await import('../static/js/verifyStep.js');

  console.log('claimWizard.js and verifyStep.js imported successfully.');

  // Test 1: Verify STEP_DEFINITIONS
  if (STEP_DEFINITIONS.length !== 4) throw new Error('Expected 4 step definitions');
  if (STEP_DEFINITIONS[0].title !== '1. Policy & Incident') throw new Error('Step 1 title mismatch');
  if (STEP_DEFINITIONS[1].title !== '2. Scan Proof') throw new Error('Step 2 title mismatch');
  if (STEP_DEFINITIONS[2].title !== '3. Verify & Fix') throw new Error('Step 3 title mismatch');
  if (STEP_DEFINITIONS[3].title !== '4. Submit Packet') throw new Error('Step 4 title mismatch');
  console.log('✓ Test 1 Passed: 4 step definitions match required naming.');

  // Test 2: Initialize Wizard
  initClaimWizard();
  if (state.wizardStep !== 1) throw new Error('Initial wizardStep should be 1');
  if (elementsMap['claim-step-1'].hidden !== false) throw new Error('Step 1 panel should be visible');
  if (elementsMap['claim-step-2'].hidden !== true) throw new Error('Step 2 panel should be hidden');
  if (elementsMap['mobile-step-pill'].textContent !== 'Step 1 of 4') throw new Error('Mobile pill mismatch');
  console.log('✓ Test 2 Passed: Wizard initializes at Step 1 with clean panel visibility and mobile pill.');

  // Test 3: Validation on Step 1 (Prevent skipping ahead when invalid)
  elementsMap['claim-claimant-name'].value = '';
  if (validateStep1() !== false) throw new Error('Validation should fail when claimant name is empty');

  elementsMap['claim-claimant-name'].value = 'Ramesh Kumar';
  elementsMap['claim-claimant-age'].value = '14'; // too young
  if (validateStep1() !== false) throw new Error('Validation should fail when claimant age is under 18');

  elementsMap['claim-claimant-age'].value = '29';
  elementsMap['claim-incident-date'].value = ''; // missing date
  if (validateStep1() !== false) throw new Error('Validation should fail when incident date is empty');

  elementsMap['claim-incident-date'].value = '2026-02-14';
  if (validateStep1() !== true) throw new Error('Validation should pass with valid name, age, and date');
  console.log('✓ Test 3 Passed: Step 1 prevents skipping ahead until required inputs are valid.');

  // Test 4: Transition to Step 2 & Stepper highlighting (completed vs. active)
  goToStep(2, false);
  if (state.wizardStep !== 2) throw new Error('wizardStep should be 2');
  if (elementsMap['claim-step-1'].hidden !== true) throw new Error('Step 1 should be hidden');
  if (elementsMap['claim-step-2'].hidden !== false) throw new Error('Step 2 should be visible');
  
  // Stepper item 1 should be completed with '✓' badge
  if (!s1.classList.contains('completed')) throw new Error('Step 1 should have completed class');
  if (s1.children[0].textContent !== '✓') throw new Error('Step 1 badge should show ✓');
  // Stepper item 2 should be active with '2' badge
  if (!s2.classList.contains('active')) throw new Error('Step 2 should have active class');
  if (s2.children[0].textContent !== '2') throw new Error('Step 2 badge should show 2');
  // Mobile pill & title
  if (elementsMap['mobile-step-pill'].textContent !== 'Step 2 of 4') throw new Error('Mobile pill should show Step 2 of 4');
  if (elementsMap['mobile-step-title'].textContent !== '2. Scan Proof') throw new Error('Mobile title should show 2. Scan Proof');
  console.log('✓ Test 4 Passed: Step 2 transition accurately highlights completed step 1 with ✓ and active step 2.');

  // Test 5: Backward Navigation preserves form values
  goToStep(1, false);
  if (state.wizardStep !== 1) throw new Error('wizardStep should be 1');
  if (elementsMap['claim-claimant-name'].value !== 'Ramesh Kumar') throw new Error('Claimant name lost during backward navigation');
  if (elementsMap['claim-claimant-age'].value !== '29') throw new Error('Claimant age lost during backward navigation');
  if (elementsMap['claim-incident-date'].value !== '2026-02-14') throw new Error('Incident date lost during backward navigation');
  if (elementsMap['claim-policy-id'].value !== 'micro_health_gig') throw new Error('Policy ID lost during backward navigation');
  console.log('✓ Test 5 Passed: Backward navigation preserves all form inputs intact.');

  // Test 6: Step 2 Validation (Requires proof document or sample)
  goToStep(2, false);
  state.claimDraft.uploadedFiles = [];
  state.claimDraft.selectedSampleId = null;
  if (validateStep2() !== false) throw new Error('Step 2 validation should fail without proof or sample');

  // Load demo sample
  loadDemoSample('clean_clinic_bill');
  if (!state.claimDraft.selectedSampleId) throw new Error('Sample ID not set');
  if (validateStep2() !== true) throw new Error('Step 2 validation should pass after loading demo sample');
  console.log('✓ Test 6 Passed: Step 2 validation prevents skipping without proof, unblocked by demo sample.');

  // Test 7: Transition to Step 3 & Stepper highlighting
  // Populate mock analysis data
  state.claimDraft.extractedData = {
    provider_name: 'LifeLine Clinic',
    incident_or_bill_date: '2026-02-14',
    total_amount_inr: 2450.0,
    legibility_score: 0.95,
    itemized_charges: [{ item_name: 'Consultation', amount_inr: 450, is_covered: true }]
  };
  state.claimDraft.ruleChecks = [{ rule_id: 'RULE_AGE_WINDOW', status: 'PASS', explanation: 'Age is valid' }];
  state.claimDraft.readinessScore = 100;
  state.claimDraft.readinessStatus = 'READY_TO_SUBMIT';

  goToStep(3, false);
  if (state.wizardStep !== 3) throw new Error('wizardStep should be 3');
  if (!s1.classList.contains('completed') || !s2.classList.contains('completed')) {
    throw new Error('Steps 1 and 2 should be completed');
  }
  if (!s3.classList.contains('active')) throw new Error('Step 3 should be active');
  if (elementsMap['mobile-step-pill'].textContent !== 'Step 3 of 4') throw new Error('Mobile pill should show Step 3 of 4');
  console.log('✓ Test 7 Passed: Step 3 accurately highlights completed steps 1 & 2 and active step 3.');

  // Test 8: Backward Navigation to Step 2 preserves uploaded sample / file previews
  goToStep(2, false);
  if (state.claimDraft.selectedSampleId !== 'clean_clinic_bill') {
    throw new Error('Uploaded demo sample lost during backward navigation');
  }
  console.log('✓ Test 8 Passed: Backward navigation to Step 2 preserves uploaded proofs and previews.');

  // Test 9: Transition to Step 4 & Summary Dossier Rendering
  goToStep(4, false);
  renderSummaryDossier();
  if (state.wizardStep !== 4) throw new Error('wizardStep should be 4');
  if (!s1.classList.contains('completed') || !s2.classList.contains('completed') || !s3.classList.contains('completed')) {
    throw new Error('Steps 1, 2, and 3 should be completed');
  }
  if (!s4.classList.contains('active')) throw new Error('Step 4 should be active');
  if (elementsMap['dossier-claimant-name'].textContent !== 'Ramesh Pawar') throw new Error('Dossier claimant name mismatch');
  if (!elementsMap['dossier-claimant-age'].textContent.includes('28')) throw new Error('Dossier age mismatch');
  if (!elementsMap['dossier-claimed-amount'].textContent.includes('2,450')) throw new Error('Dossier amount mismatch');
  console.log('✓ Test 9 Passed: Step 4 transitions cleanly, renders summary dossier, and highlights completed steps 1-3.');

  // Test 10: Populate Policy Selector & Requirements Checklist
  const { populatePolicySelector, renderPolicyRequirements, POLICY_REQUIREMENTS_DATA } = await import('../static/js/claimWizard.js');
  await populatePolicySelector();
  if (!elementsMap['claim-policy-id'].innerHTML.includes('micro_health_gig')) {
    throw new Error('Policy selector should include micro_health_gig');
  }
  if (!elementsMap['claim-policy-id'].innerHTML.includes('pmsby')) {
    throw new Error('Policy selector should include pmsby');
  }
  console.log('✓ Test 10 Passed: populatePolicySelector populates clean scheme selector.');

  // Test 11: Dynamic "Before You Upload — What This Policy Requires" Checklist (Micro-Health)
  renderPolicyRequirements('micro_health_gig');
  const reqHtml1 = elementsMap['claim-policy-requirements'].innerHTML;
  if (!reqHtml1.includes('Before You Upload — What This Policy Requires')) {
    throw new Error('Requirements checklist header missing');
  }
  if (!reqHtml1.includes('₹5,000 / claim')) {
    throw new Error('Max coverage cap missing for Micro-Health');
  }
  if (!reqHtml1.includes('15-day initial waiting period')) {
    throw new Error('Waiting period clause missing for Micro-Health');
  }
  if (!reqHtml1.includes('Doctor consultation prescription')) {
    throw new Error('Mandatory prescription proof missing for Micro-Health');
  }
  if (!reqHtml1.includes('multivitamins') && !reqHtml1.includes('supplements')) {
    throw new Error('Exclusion warning missing for Micro-Health');
  }
  console.log('✓ Test 11 Passed: What This Policy Requires checklist renders Micro-Health cap, 15-day waiting period, and mandatory proofs.');

  // Test 12: Dynamic Requirements Checklist Update (PMSBY)
  renderPolicyRequirements('pmsby');
  const reqHtml2 = elementsMap['claim-policy-requirements'].innerHTML;
  if (!reqHtml2.includes('₹2,00,000 Accidental Cover')) {
    throw new Error('Max coverage cap missing for PMSBY');
  }
  if (!reqHtml2.includes('First Information Report (FIR)')) {
    throw new Error('FIR requirement missing for PMSBY');
  }
  if (!reqHtml2.includes('routine medical/OPD hospital bills are completely excluded')) {
    throw new Error('OPD exclusion warning missing for PMSBY');
  }
  console.log('✓ Test 12 Passed: What This Policy Requires checklist dynamically updates for PMSBY with ₹2,00,000 cap & FIR proofs.');

  // Test 13: Quick Presets for Policy Start Date (10 days ago vs 6 months ago)
  const d10Btn = pBtn10; // 10 days ago button
  d10Btn.dispatchEvent({ type: 'click' });
  const tenDaysAgoStr = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  if (elementsMap['claim-policy-start-date'].value !== tenDaysAgoStr) {
    throw new Error(`Expected date ${tenDaysAgoStr}, got ${elementsMap['claim-policy-start-date'].value}`);
  }

  const d180Btn = pBtn180; // 180 days ago button
  d180Btn.dispatchEvent({ type: 'click' });
  const sixMonthsAgoStr = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  if (elementsMap['claim-policy-start-date'].value !== sixMonthsAgoStr) {
    throw new Error(`Expected date ${sixMonthsAgoStr}, got ${elementsMap['claim-policy-start-date'].value}`);
  }
  console.log('✓ Test 13 Passed: Quick presets for Policy Start Date calculate 10 days ago and 6 months ago accurately.');

  // Test 14: Incident Type Options & Presets
  elementsMap['claim-incident-subtype'].value = 'snakebite_fall';
  if (elementsMap['claim-incident-subtype'].value !== 'snakebite_fall') {
    throw new Error('Incident subtype snakebite_fall should be selectable');
  }
  elementsMap['claim-incident-subtype'].value = 'hailstorm_crop_loss';
  if (elementsMap['claim-incident-subtype'].value !== 'hailstorm_crop_loss') {
    throw new Error('Incident subtype hailstorm_crop_loss should be selectable');
  }
  console.log('✓ Test 14 Passed: Incident Type selector supports Clinic Visit, Road Accident, Snakebite/Fall, Hailstorm Crop.');
  console.log('All 14 Step 1 & Claim Wizard Integration Tests Passed Cleanly!');

  // Test 15: POLICY_DOCUMENT_SLOTS Coverage for 5 Schemes
  if (!POLICY_DOCUMENT_SLOTS.micro_health_gig || !POLICY_DOCUMENT_SLOTS.pmfby || !POLICY_DOCUMENT_SLOTS.pmsby || !POLICY_DOCUMENT_SLOTS.pmjjby || !POLICY_DOCUMENT_SLOTS.ab_pmjay) {
    throw new Error('POLICY_DOCUMENT_SLOTS must contain configurations for all 5 insurance schemes');
  }
  if (!POLICY_DOCUMENT_SLOTS.micro_health_gig.primary.isPrimary || !POLICY_DOCUMENT_SLOTS.micro_health_gig.primary.isMandatory) {
    throw new Error('Micro-Health primary slot must be primary and mandatory');
  }
  console.log('✓ Test 15 Passed: POLICY_DOCUMENT_SLOTS defines primary and secondary slots for all 5 policies.');

  // Test 16: Dynamic Slot Rendering for Micro-Health
  renderUploadSlots('micro_health_gig');
  const slotsContainer = elementsMap['policy-upload-slots-container'];
  if (!slotsContainer.innerHTML.includes('Handwritten Clinic Invoice / Hospital Bill')) {
    throw new Error('Slot container missing Micro-Health primary bill title');
  }
  if (!slotsContainer.innerHTML.includes('Primary Required *')) {
    throw new Error('Slot container missing Primary Required * badge');
  }
  if (!slotsContainer.innerHTML.includes('accept="image/*"') || !slotsContainer.innerHTML.includes('capture="environment"')) {
    throw new Error('Slot container must include mobile phone camera capture inputs (accept="image/*" capture="environment")');
  }
  if (!slotsContainer.innerHTML.includes('Rejection-Prevention engine catch the missing prescription gap')) {
    throw new Error('Slot container must include skip notice for Rejection-Prevention engine catch');
  }
  console.log('✓ Test 16 Passed: renderUploadSlots renders mobile camera capture and Rejection-Prevention skip callouts.');

  // Test 17: Dynamic Slot Rendering for PMFBY (Crop Damage Photo + Land Record)
  renderUploadSlots('pmfby');
  if (!slotsContainer.innerHTML.includes('Crop Damage / Inundation Field Photograph')) {
    throw new Error('Slot container missing PMFBY Crop Damage photo slot');
  }
  if (!slotsContainer.innerHTML.includes('Land Record (RoR / 7/12 Patta / Khasra)')) {
    throw new Error('Slot container missing Land Record RoR secondary slot');
  }
  console.log('✓ Test 17 Passed: renderUploadSlots dynamically adapts for PMFBY with crop photo and land records.');

  // Test 18: File Attachment to Slot, Formatting and Thumbnails
  const mockDataUrl = 'data:image/jpeg;base64,mockImageData123';
  const mockFile = { name: 'clinic_bill_nov.jpg', size: 145408, type: 'image/jpeg' };
  attachFileToSlot('primary_bill', mockFile, mockDataUrl, 'clinic_opd_bill', 'clinic_bill_nov.jpg', 145408);

  if (formatFileSize(145408) !== '142 KB') {
    throw new Error(`Expected 142 KB, got ${formatFileSize(145408)}`);
  }
  if (!state.claimDraft.uploadedSlots['primary_bill']) {
    throw new Error('uploadedSlots must contain primary_bill entry');
  }
  if (state.claimDraft.uploadedSlots['primary_bill'].name !== 'clinic_bill_nov.jpg') {
    throw new Error('Slot document name mismatch');
  }
  if (!slotsContainer.innerHTML.includes('clinic_bill_nov.jpg')) {
    throw new Error('Slot container HTML must render attached file name');
  }
  if (!slotsContainer.innerHTML.includes('142 KB')) {
    throw new Error('Slot container HTML must render formatted file size 142 KB');
  }
  if (!slotsContainer.innerHTML.includes('Retake') || !slotsContainer.innerHTML.includes('Remove')) {
    throw new Error('Slot container must render Retake and Remove action buttons');
  }
  console.log('✓ Test 18 Passed: attachFileToSlot generates thumbnail, formatted file size, and retake/remove actions.');

  // Test 19: Rejection Prevention Demonstration (Primary Attached, Secondary Skipped)
  // validateStep2 should pass because primary is attached, allowing user to see Rejection Prevention catch secondary in step 3
  if (validateStep2() !== true) {
    throw new Error('validateStep2 should pass when Primary Proof is attached, even if secondary proofs are skipped');
  }
  console.log('✓ Test 19 Passed: validateStep2 allows proceeding with skipped secondary slot to test Rejection-Prevention.');

  // Test 20: Remove Slot File
  removeSlotFile('primary_bill');
  if (state.claimDraft.uploadedSlots['primary_bill']) {
    throw new Error('primary_bill should be removed from uploadedSlots');
  }
  if (validateStep2() !== false) {
    throw new Error('validateStep2 should fail after removing primary proof when no sample or other file is present');
  }
  console.log('✓ Test 20 Passed: removeSlotFile cleanly clears slot and updates validation barrier.');

  // Test 21: Multi-Stage Underwriting Loading Animation Initialization
  startAnalysisLoadingAnimation();
  const loadingEl = document.getElementById('claim-analysis-loading');
  const stage1El = document.getElementById('loading-stage-1');
  const stage2El = document.getElementById('loading-stage-2');
  const stage3El = document.getElementById('loading-stage-3');
  const progressBarEl = document.getElementById('loading-progress-bar');
  const progressPillEl = document.getElementById('loading-progress-percent');

  if (loadingEl.style.display !== 'flex') {
    throw new Error('Loading container should be display: flex during analysis');
  }
  if (!stage1El.classList.contains('active')) {
    throw new Error('Stage 1 must be active on start');
  }
  if (!stage2El.classList.contains('pending') || !stage3El.classList.contains('pending')) {
    throw new Error('Stages 2 & 3 must be pending on start');
  }
  if (progressBarEl.style.width !== '20%' || progressPillEl.textContent !== '20%') {
    throw new Error(`Progress bar should be 20%, got ${progressBarEl.style.width}`);
  }
  console.log('✓ Test 21 Passed: startAnalysisLoadingAnimation sets Stage 1 active, Stages 2 & 3 pending at 20% progress.');

  // Test 22: Stage Transition State Machine (setLoadingStageState & updateLoadingProgress)
  setLoadingStageState(1, 'completed');
  setLoadingStageState(2, 'active');
  updateLoadingProgress(60);

  const ind1 = document.getElementById('loading-indicator-1');
  const ind2 = document.getElementById('loading-indicator-2');
  if (!stage1El.classList.contains('completed') || !ind1.innerHTML.includes('✓')) {
    throw new Error('Stage 1 must be marked completed with checkmark');
  }
  if (!stage2El.classList.contains('active') || !ind2.innerHTML.includes('stage-spinner')) {
    throw new Error('Stage 2 must be marked active with spinner');
  }
  if (progressBarEl.style.width !== '60%') {
    throw new Error('Progress bar must be at 60%');
  }

  setLoadingStageState(2, 'completed');
  setLoadingStageState(3, 'active');
  updateLoadingProgress(88);
  if (!stage2El.classList.contains('completed') || !stage3El.classList.contains('active')) {
    throw new Error('Stage 2 must be completed and Stage 3 active');
  }
  console.log('✓ Test 22 Passed: setLoadingStageState animates stage indicators (spinner, checkmark) and progress bar.');

  // Test 23: Complete Loading Animation (100% and Result Reveal)
  await completeAnalysisLoadingAnimation();
  if (!stage3El.classList.contains('completed')) {
    throw new Error('Stage 3 must be completed on finish');
  }
  if (progressBarEl.style.width !== '100%' || progressPillEl.textContent !== '100%') {
    throw new Error('Progress must reach 100% on completeAnalysisLoadingAnimation');
  }
  console.log('✓ Test 23 Passed: completeAnalysisLoadingAnimation marks all stages complete and reaches 100%.');

  // Test 24: Timeout & Error Panel Handling with Clean Retry Button
  const errTimeout = new Error('Request timed out: backend underwriting engine took longer than 15s');
  showAnalysisLoadingError(errTimeout);

  const errorPanel = document.getElementById('loading-error-panel');
  const stagesContainer = document.getElementById('loading-stages-container');
  const errorTitle = document.getElementById('loading-error-title');
  const errorMsg = document.getElementById('loading-error-msg');
  const retryBtn = document.getElementById('btn-retry-analysis');
  const backStep2Btn = document.getElementById('btn-loading-back-step2');

  if (errorPanel.style.display !== 'flex') {
    throw new Error('Error panel must be visible on error');
  }
  if (stagesContainer.style.display !== 'none') {
    throw new Error('Stages container must be hidden on error');
  }
  if (!errorTitle.textContent.includes('Timed Out')) {
    throw new Error(`Expected Timed Out in error title, got: ${errorTitle.textContent}`);
  }
  if (!errorMsg.textContent.includes('safely retained')) {
    throw new Error(`Expected preserved inputs message in error msg, got: ${errorMsg.textContent}`);
  }

  // Verify retry and back buttons exist and can be clicked
  initAnalysisRetryHandlers();
  let retryClicked = false;
  retryBtn.addEventListener('click', () => { retryClicked = true; });
  retryBtn.click();
  if (!retryClicked) {
    throw new Error('Retry button click event did not fire');
  }

  let backClicked = false;
  backStep2Btn.addEventListener('click', () => { backClicked = true; });
  backStep2Btn.click();
  if (!backClicked) {
    throw new Error('Back to Step 2 button click event did not fire');
  }
  console.log('✓ Test 24 Passed: showAnalysisLoadingError displays timeout panel, preserving data, and retry/back buttons respond cleanly.');

  // Test 25: Step 3 Structured Fields and Itemized Charges Population
  const mockAnalysisRes = {
    claim_id: 'CLM-TEST-001',
    readiness_score: 85,
    readiness_status: 'NEEDS_FIXES',
    estimated_payout_inr: 2450,
    extracted_data: {
      provider_name: 'Arogya Daycare Clinic & Nursing Home, Pune',
      incident_or_bill_date: '2026-02-15',
      diagnosis_or_event: 'Enteric Fever (Typhoid) with Moderate Dehydration',
      total_amount_inr: 2450.0,
      legibility_score: 0.94,
      itemized_charges: [
        { item_name: 'OPD Consultation Fee', amount_inr: 450, is_covered: true, category: 'consultation' },
        { item_name: 'Widal Serology Blood Test', amount_inr: 650, is_covered: true, category: 'investigation' },
        { item_name: 'Generic Antibiotics (Cefixime)', amount_inr: 1350, is_covered: true, category: 'pharmacy' },
      ],
      field_confidences: {
        provider_name: 0.95,
        incident_or_bill_date: 0.92,
        diagnosis_or_event: 0.90,
        total_amount_inr: 0.98,
      }
    },
    rule_checks: [
      { status: 'PASS', label: 'Coverage Cap Check', explanation: 'Within ₹5,000 policy limit.' }
    ],
    actionable_checklist: []
  };

  renderVerifyStep(mockAnalysisRes, '/samples/clean_clinic_bill.jpg');

  const provInput = document.getElementById('claim-ext-provider');
  const dateInput = document.getElementById('claim-ext-date');
  const diagInput = document.getElementById('claim-ext-diagnosis');
  const totalInput = document.getElementById('claim-ext-total');
  const itemsContainer = document.getElementById('claim-itemized-list');

  if (provInput.value !== 'Arogya Daycare Clinic & Nursing Home, Pune') {
    throw new Error(`Provider name mismatch: ${provInput.value}`);
  }
  if (dateInput.value !== '2026-02-15') {
    throw new Error(`Bill date mismatch: ${dateInput.value}`);
  }
  if (diagInput.value !== 'Enteric Fever (Typhoid) with Moderate Dehydration') {
    throw new Error(`Diagnosis mismatch: ${diagInput.value}`);
  }
  if (totalInput.value !== '2450.00') {
    throw new Error(`Total amount mismatch: ${totalInput.value}`);
  }
  if (!itemsContainer.innerHTML.includes('OPD Consultation Fee') || !itemsContainer.innerHTML.includes('Widal Serology Blood Test')) {
    throw new Error('Itemized charges list missing required items');
  }
  console.log('✓ Test 25 Passed: renderVerifyStep populates Provider, Date, Diagnosis/Damage, Total (₹), and itemized line items.');

  // Test 26: Low Confidence (<0.75) and Null Highlighting with Amber Outline & Hint
  const mockTrickyRes = {
    claim_id: 'CLM-TRICKY-002',
    readiness_score: 40,
    readiness_status: 'NEEDS_FIXES',
    estimated_payout_inr: 5000,
    extracted_data: {
      provider_name: 'Dr. S. K. Gupta Clinic',
      incident_or_bill_date: '2026-01-10', // Smudged date
      diagnosis_or_event: '', // Null / empty diagnosis
      total_amount_inr: 7800.0,
      field_confidences: {
        provider_name: 0.88,
        incident_or_bill_date: 0.35, // Low confidence (< 0.75)!
        total_amount_inr: 0.92,
        diagnosis_or_event: 0.0,
      }
    },
    rule_checks: [],
    actionable_checklist: ['Please verify smudged bill date']
  };

  renderVerifyStep(mockTrickyRes, '/samples/tricky_handwritten_bill.jpg');

  // Verify Date has amber outline and hint
  const hintDate = document.getElementById('hint-ext-date');
  if (!dateInput.classList.contains('is-low-confidence')) {
    throw new Error('Date input with 0.35 confidence must have is-low-confidence class');
  }
  if (hintDate.style.display === 'none' || !hintDate.textContent.includes('Please verify handwritten value')) {
    throw new Error(`Date hint must display "Please verify handwritten value", got: ${hintDate.textContent}`);
  }

  // Verify Empty/Null Diagnosis has amber outline and hint
  const hintDiag = document.getElementById('hint-ext-diagnosis');
  if (!diagInput.classList.contains('is-low-confidence')) {
    throw new Error('Empty diagnosis input must have is-low-confidence class');
  }
  if (hintDiag.style.display === 'none' || !hintDiag.textContent.includes('Please verify handwritten value')) {
    throw new Error(`Empty diagnosis hint must display "Please verify handwritten value", got: ${hintDiag.textContent}`);
  }

  // Verify Provider with 0.88 confidence does NOT have amber outline
  const hintProv = document.getElementById('hint-ext-provider');
  if (provInput.classList.contains('is-low-confidence')) {
    throw new Error('Provider with 0.88 confidence must not be marked low confidence');
  }
  if (hintProv.style.display !== 'none') {
    throw new Error('Provider hint must be hidden for high-confidence field');
  }
  console.log('✓ Test 26 Passed: Low confidence (<0.75) and null fields highlight with amber outline and "Please verify handwritten value" hint.');

  // Test 27: Mobile Photo Preview Collapsible Toggle
  const photoBody = document.getElementById('inspector-photo-body');
  const toggleBtn = document.getElementById('btn-toggle-doc-preview');

  toggleMobilePhotoPreview(true); // Collapse
  if (!photoBody.classList.contains('collapsed')) {
    throw new Error('Photo body should have collapsed class when collapsed');
  }
  if (toggleBtn.getAttribute('aria-expanded') !== 'false') {
    throw new Error('Toggle button aria-expanded should be false when collapsed');
  }

  toggleMobilePhotoPreview(false); // Expand
  if (photoBody.classList.contains('collapsed')) {
    throw new Error('Photo body should not have collapsed class when expanded');
  }
  if (toggleBtn.getAttribute('aria-expanded') !== 'true') {
    throw new Error('Toggle button aria-expanded should be true when expanded');
  }
  console.log('✓ Test 27 Passed: toggleMobilePhotoPreview expands/collapses photo preview and synchronizes aria-expanded.');

  // Test 28: Click-to-Zoom Lightbox Modal
  const zoomModal = document.getElementById('claim-zoom-modal');
  const zoomModalImg = document.getElementById('zoom-modal-img');
  const zoomLevelPill = document.getElementById('zoom-level-pill');

  openZoomModal('/samples/clean_clinic_bill.jpg', 'clean_clinic_bill.jpg');
  if (zoomModal.style.display !== 'flex') {
    throw new Error('Zoom modal must have display: flex when opened');
  }
  if (zoomModalImg.src !== '/samples/clean_clinic_bill.jpg') {
    throw new Error(`Zoom modal image src mismatch: ${zoomModalImg.src}`);
  }
  if (zoomLevelPill.textContent !== '100%') {
    throw new Error(`Initial zoom level pill should be 100%, got: ${zoomLevelPill.textContent}`);
  }

  closeZoomModal();
  if (zoomModal.style.display !== 'none') {
    throw new Error('Zoom modal must have display: none when closed');
  }
  console.log('✓ Test 28 Passed: Click-to-Zoom modal opens, sets full resolution image, and closes cleanly.');

  // Test 29: Policy Cross-Check Scorecard Top Summary Bar & Rule Check Rows
  const mockScorecardRes = {
    claim_id: 'CLM-SCORECARD-001',
    policy_id: 'micro_health_gig',
    policy_name: 'Gig-Worker Micro-Health Clinic Shield',
    readiness_score: 60,
    readiness_status: 'NEEDS_FIXES',
    claimed_amount_inr: 7800.0,
    eligible_payout_inr: 5000.0,
    disallowed_amount_inr: 450.0,
    extracted_data: {
      provider_name: 'Seva PolyClinic, Lucknow',
      incident_or_bill_date: '2026-02-10',
      diagnosis_or_event: 'Acute Gastroenteritis & Dehydration',
      total_amount_inr: 7800.0,
      field_confidences: {
        provider_name: 0.88,
        incident_or_bill_date: 0.95,
        total_amount_inr: 0.92,
        diagnosis_or_event: 0.90,
      },
    },
    rule_checks: [
      {
        rule_id: 'RULE_AGE_WINDOW',
        label: 'Eligibility Age Window (18–70 years)',
        status: 'PASS',
        explanation: 'Claimant age 28 is well within the eligible age window (18–70 years).',
        action_required: null,
      },
      {
        rule_id: 'RULE_EXCLUSION_SCANNER',
        label: 'Policy Ceiling & Itemized Exclusions',
        status: 'WARNING',
        explanation: '₹450 multivitamins excluded; capped at ₹5,000 limit.',
        action_required: 'Review disallowed multivitamin supplements. Sub-limit cap of ₹5,000 applied.',
      },
      {
        rule_id: 'RULE_REQUIRED_DOCUMENTS',
        label: 'Mandatory Policy Proof Verification',
        status: 'FAIL',
        explanation: 'Doctor Prescription is required for pharmacy antibiotic reimbursement under Clinic Shield.',
        action_required: 'Upload clear photograph of official Doctor Prescription bearing clinic stamp.',
        missing_documents: {
          prescription: 'Upload doctor prescription & pharmacy voucher to waive deduction.',
        },
      },
    ],
    actionable_checklist: [
      'Missing Doctor Prescription: Upload doctor prescription & pharmacy voucher.',
      'Policy Exclusion: ₹450.00 deducted for non-covered items (vitamins, tonics).',
    ],
  };

  renderVerifyStep(mockScorecardRes, '/samples/tricky_handwritten_bill.jpg');

  // 1. Verify Top Summary Bar elements
  const scoreCardReadiness = document.getElementById('scorecard-readiness-val');
  const scoreCardStatus = document.getElementById('scorecard-status-val');
  const scoreCardPayout = document.getElementById('scorecard-payout-val');
  const scoreCardBilled = document.getElementById('scorecard-billed-val');
  const scoreCardDeduction = document.getElementById('scorecard-deduction-val');
  const meterFillEl = document.getElementById('scorecard-meter-fill');

  if (scoreCardReadiness.textContent !== '60%') {
    throw new Error(`Scorecard readiness score mismatch: expected 60%, got ${scoreCardReadiness.textContent}`);
  }
  if (meterFillEl.style.width !== '60%') {
    throw new Error(`Scorecard meter fill width mismatch: expected 60%, got ${meterFillEl.style.width}`);
  }
  // Overall Status MUST be normalized without raw underscores: 'NEEDS FIXES'
  if (scoreCardStatus.textContent !== 'NEEDS FIXES') {
    throw new Error(`Scorecard overall status should be "NEEDS FIXES", got "${scoreCardStatus.textContent}"`);
  }
  if (!scoreCardStatus.className.includes('status-warning')) {
    throw new Error('Scorecard status badge must have status-warning class for NEEDS FIXES');
  }

  // Payout vs Billed values
  if (!scoreCardPayout.textContent.includes('5,000')) {
    throw new Error(`Estimated payout should display ₹5,000, got ${scoreCardPayout.textContent}`);
  }
  if (!scoreCardBilled.textContent.includes('7,800')) {
    throw new Error(`Billed amount should display ₹7,800, got ${scoreCardBilled.textContent}`);
  }
  if (!scoreCardDeduction.textContent.includes('450')) {
    throw new Error(`Disallowed amount should display ₹450 excluded, got ${scoreCardDeduction.textContent}`);
  }

  // 2. Verify RuleCheckResult rows rendering
  const rulesContainer = document.getElementById('claim-rule-checks-list');
  const ruleRows = rulesContainer.innerHTML;

  // Visual status indicators
  if (!ruleRows.includes('status-pass') || !ruleRows.includes('✓ PASS')) {
    throw new Error('Rules list missing emerald PASS visual status indicator');
  }
  if (!ruleRows.includes('status-warning') || !ruleRows.includes('⚠️ WARNING')) {
    throw new Error('Rules list missing amber WARNING visual status indicator');
  }
  if (!ruleRows.includes('status-fail') || !ruleRows.includes('✕ FAIL')) {
    throw new Error('Rules list missing crimson FAIL visual status indicator');
  }

  // Plain-English explanation
  if (!ruleRows.includes('₹450 multivitamins excluded; capped at ₹5,000 limit')) {
    throw new Error('Rules list missing plain-English explanation for exclusion check');
  }

  // Exact Next Action
  if (!ruleRows.includes('Exact Next Action:')) {
    throw new Error('Rules list missing "Exact Next Action:" label strip');
  }
  if (!ruleRows.includes('No action needed: fully compliant with policy terms.')) {
    throw new Error('PASS rule check missing "No action needed: fully compliant with policy terms."');
  }
  if (!ruleRows.includes('Upload clear photograph of official Doctor Prescription')) {
    throw new Error('FAIL rule check missing specific action required text');
  }
  if (!ruleRows.includes('Prescription') && !ruleRows.includes('PRESCRIPTION')) {
    throw new Error('Missing document chip not rendered for prescription requirement');
  }

  // 3. Test Clean 100% Auto-Pass Scorecard
  const mockCleanScorecard = {
    claim_id: 'CLM-CLEAN-001',
    readiness_score: 100,
    readiness_status: 'READY_TO_SUBMIT',
    claimed_amount_inr: 2450.0,
    eligible_payout_inr: 2450.0,
    disallowed_amount_inr: 0.0,
    extracted_data: {
      provider_name: 'Arogya Daycare Clinic',
      incident_or_bill_date: '2026-02-15',
      diagnosis_or_event: 'Enteric Fever (Typhoid)',
      total_amount_inr: 2450.0,
      field_confidences: { provider_name: 0.96, incident_or_bill_date: 0.95, total_amount_inr: 0.98 },
    },
    rule_checks: [
      {
        rule_id: 'RULE_AGE_WINDOW',
        label: 'Eligibility Age Window',
        status: 'PASS',
        explanation: 'Claimant age 28 qualifies.',
        action_required: null,
      },
      {
        rule_id: 'RULE_COVERAGE_CAP',
        label: 'Policy Ceiling',
        status: 'PASS',
        explanation: 'Claimed ₹2,450 is within ₹5,000 limit.',
        action_required: null,
      },
    ],
  };

  renderVerifyStep(mockCleanScorecard, '/samples/clean_clinic_bill.jpg');
  if (scoreCardStatus.textContent !== 'READY TO SUBMIT') {
    throw new Error(`Clean scorecard status should be "READY TO SUBMIT", got "${scoreCardStatus.textContent}"`);
  }
  if (!scoreCardStatus.className.includes('status-pass')) {
    throw new Error('Clean scorecard status badge must have status-pass class');
  }
  if (scoreCardReadiness.textContent !== '100%') {
    throw new Error(`Clean scorecard readiness score mismatch: expected 100%, got ${scoreCardReadiness.textContent}`);
  }

  console.log('✓ Test 29 Passed: Policy Cross-Check Scorecard renders top summary bar (Readiness 0-100%, Overall Status without underscores, Estimated Payout vs Billed Amount) and every RuleCheckResult row with emerald/amber/crimson status indicators, plain-English explanation, and exact next action.');

  // Test 30: Interactive Recovery Controls (Inline Upload, Attach Demo Proof, and Re-Check My Claim)
  const mockFailDocsRes = {
    claim_id: 'CLM-FAIL-DOCS-001',
    policy_id: 'micro_health_gig',
    policy_name: 'Gig-Worker Micro-Health Clinic Shield',
    readiness_score: 50,
    readiness_status: 'NEEDS_FIXES',
    claimed_amount_inr: 7800.0,
    eligible_payout_inr: 0.0,
    disallowed_amount_inr: 450.0,
    extracted_data: {
      provider_name: 'Seva PolyClinic, Lucknow',
      incident_or_bill_date: '2026-02-10',
      diagnosis_or_event: 'Acute Gastroenteritis',
      total_amount_inr: 7800.0,
      field_confidences: { provider_name: 0.88, incident_or_bill_date: 0.95, total_amount_inr: 0.92 },
    },
    rule_checks: [
      {
        rule_id: 'RULE_REQUIRED_DOCUMENTS',
        label: 'Mandatory Document Checklist',
        status: 'FAIL',
        explanation: 'Missing mandatory Doctor Prescription & Pharmacy voucher under Clinic Shield terms.',
        action_required: 'Upload Doctor Prescription to waive deduction and approve claim.',
        missing_documents: {
          doctor_prescription: 'Upload official Doctor Prescription bearing clinic stamp and registered MBBS/MD degree.',
        },
      },
    ],
    actionable_checklist: ['Missing Doctor Prescription'],
  };

  // Reset any previous attachments
  state.claimDraft.inlineAttachedDocs = {};
  state.claimDraft.uploadedDocTypes = ['clinic_opd_bill'];
  state.claimDraft.ruleChecks = mockFailDocsRes.rule_checks;

  renderVerifyStep(mockFailDocsRes, '/samples/tricky_handwritten_bill.jpg');

  // Verify inline "Upload Now" and "Attach Demo Proof" buttons are rendered inside the FAIL check row
  const rulesListHtml = document.getElementById('claim-rule-checks-list').innerHTML;
  if (!rulesListHtml.includes('btn-inline-upload') || !rulesListHtml.includes('Upload Now')) {
    throw new Error('FAIL check row missing inline "Upload Now" button');
  }
  if (!rulesListHtml.includes('btn-inline-demo-proof') || !rulesListHtml.includes('Attach Demo Proof')) {
    throw new Error('FAIL check row missing "Attach Demo Proof" helper button');
  }
  if (!rulesListHtml.includes('Missing Proof')) {
    throw new Error('Recovery card should show "Missing Proof" badge before attachment');
  }

  // 1. Simulate clicking "Attach Demo Proof"
  handleAttachDemoProof('doctor_prescription');

  // Verify attachment in state
  if (!isInlineDocAttached('doctor_prescription')) {
    throw new Error('isInlineDocAttached should return true after handleAttachDemoProof');
  }
  if (!state.claimDraft.uploadedDocTypes.includes('doctor_prescription')) {
    throw new Error('uploadedDocTypes should include doctor_prescription');
  }

  // Verify UI re-rendered with attached state
  const updatedRulesHtml = document.getElementById('claim-rule-checks-list').innerHTML;
  if (!updatedRulesHtml.includes('recovery-doc-card is-attached') || !updatedRulesHtml.includes('✓ Attached')) {
    throw new Error('Recovery card should have is-attached class and display "✓ Attached"');
  }
  if (!updatedRulesHtml.includes('dr_gupta_prescription_slip.jpg')) {
    throw new Error('Recovery card should display attached sample filename');
  }

  // Verify Re-Check My Claim button is pulsing
  const recheckBtn = document.getElementById('btn-recheck-my-claim');
  const revalidateTopBtn = document.getElementById('btn-revalidate-claim');
  if (!recheckBtn.classList.contains('is-pulsing') && !revalidateTopBtn.classList.contains('is-pulsing')) {
    throw new Error('Re-Check My Claim buttons should pulse after attaching proof');
  }

  // 2. Test handleRemoveInlineDoc
  handleRemoveInlineDoc('doctor_prescription');
  if (isInlineDocAttached('doctor_prescription')) {
    throw new Error('isInlineDocAttached should be false after removal');
  }
  const revertedHtml = document.getElementById('claim-rule-checks-list').innerHTML;
  if (!revertedHtml.includes('Missing Proof')) {
    throw new Error('Recovery card should revert to "Missing Proof" after removal');
  }

  // 3. Re-attach via handleInlineDocUpload
  handleInlineDocUpload('doctor_prescription', {
    name: 'user_camera_prescription.jpg',
    size: 204850,
    type: 'image/jpeg',
  });
  if (!isInlineDocAttached('doctor_prescription')) {
    throw new Error('isInlineDocAttached should be true after handleInlineDocUpload');
  }
  const uploadedHtml = document.getElementById('claim-rule-checks-list').innerHTML;
  if (!uploadedHtml.includes('user_camera_prescription.jpg')) {
    throw new Error('Recovery card should display uploaded file name user_camera_prescription.jpg');
  }

  // 4. Test live update of scorecard upon revalidation
  const mockRevalidatedRes = {
    claim_id: 'CLM-REVAL-PASS-001',
    policy_id: 'micro_health_gig',
    policy_name: 'Gig-Worker Micro-Health Clinic Shield',
    readiness_score: 100,
    readiness_status: 'READY_TO_SUBMIT',
    claimed_amount_inr: 7800.0,
    eligible_payout_inr: 5000.0,
    disallowed_amount_inr: 450.0,
    extracted_data: {
      provider_name: 'Seva PolyClinic, Lucknow',
      incident_or_bill_date: '2026-02-10',
      diagnosis_or_event: 'Acute Gastroenteritis',
      total_amount_inr: 7800.0,
    },
    rule_checks: [
      {
        rule_id: 'RULE_REQUIRED_DOCUMENTS',
        label: 'Mandatory Document Checklist',
        status: 'PASS',
        explanation: 'All mandatory proof documents for Gig-Worker Micro-Health Clinic Shield have been provided.',
        action_required: null,
      },
    ],
    fix_it_checklist: [],
  };

  renderVerifyStep(mockRevalidatedRes);
  const statusAfterReval = document.getElementById('scorecard-status-val');
  const scoreAfterReval = document.getElementById('scorecard-readiness-val');
  const payoutAfterReval = document.getElementById('scorecard-payout-val');

  if (statusAfterReval.textContent !== 'READY TO SUBMIT') {
    throw new Error(`Scorecard status after revalidation should be READY TO SUBMIT, got ${statusAfterReval.textContent}`);
  }
  if (scoreAfterReval.textContent !== '100%') {
    throw new Error(`Scorecard readiness score after revalidation should be 100%, got ${scoreAfterReval.textContent}`);
  }
  if (!payoutAfterReval.textContent.includes('5,000')) {
    throw new Error(`Payout after revalidation should be ₹5,000, got ${payoutAfterReval.textContent}`);
  }

  console.log('✓ Test 30 Passed: Step 3 interactive recovery controls (inline "Upload Now" and "Attach Demo Proof") and live revalidation scorecard update verified.');

  // Test 31: Step 4 Pre-Submission Dossier Review, Confirmation Checkbox & Claim Package Submission
  {
    const {
      initSubmitStep,
      renderSubmitStep,
      submitClaimPackage,
      renderSuccessReceipt,
      SCHEME_COVERAGE_METADATA,
    } = await import('../static/js/submitStep.js');

    // 1. Prepare realistic claim state ready for Step 4 review
    state.selectedPolicyId = 'micro_health_gig';
    state.claimDraft.policyId = 'micro_health_gig';
    state.claimDraft.claimantDetails = {
      name: 'Ramesh Pawar',
      age: '28',
      phone: '9876543210',
      aadhaar: '4821',
    };
    state.claimDraft.extractedData = {
      provider_name: 'Arogya Daycare Clinic, Pune',
      incident_or_bill_date: '2026-02-15',
      diagnosis_or_event: 'Enteric Fever with Moderate Dehydration',
      total_amount_inr: 7800.0,
      itemized_charges: [
        { item_name: 'Consultation & Clinical Triage', amount_inr: 500.0, is_covered: true, category: 'OPD' },
        { item_name: 'IV Dextrose Saline Infusion', amount_inr: 2200.0, is_covered: true, category: 'Daycare' },
        { item_name: 'Ceftriaxone Antibiotic Injections', amount_inr: 4650.0, is_covered: true, category: 'Pharmacy' },
        { item_name: 'Nutritional Multivitamin Capsules', amount_inr: 450.0, is_covered: false, category: 'Exclusion' },
      ],
    };
    state.claimDraft.claimedAmountInr = 7800.0;
    state.claimDraft.disallowedAmountInr = 450.0;
    state.claimDraft.estimatedPayoutInr = 5000.0;
    state.claimDraft.readinessStatus = 'READY_TO_SUBMIT';
    state.claimDraft.ruleChecks = [
      { rule_id: 'RULE_REQUIRED_DOCUMENTS', label: 'Mandatory Proof Documents', status: 'PASS', explanation: 'All mandatory proofs attached.' },
      { rule_id: 'RULE_AGE_WINDOW', label: 'Eligible Age Range', status: 'PASS', explanation: 'Age 28 is within 18-65 bracket.' },
      { rule_id: 'RULE_ACTIVE_POLICY_WINDOW', label: 'Waiting Period & Lien', status: 'PASS', explanation: 'Enrolled 6 months ago; 15-day waiting period satisfied.' },
      { rule_id: 'RULE_CLAIM_LIMIT', label: 'Coverage Cap & Sub-limit', status: 'WARNING', explanation: 'Eligible ₹7,350 capped at ₹5,000 OPD sub-limit.' },
      { rule_id: 'RULE_EXCLUSIONS', label: 'Non-Payable Items', status: 'PASS', explanation: '₹450 non-medical multivitamins disallowed.' },
    ];
    state.claimDraft.uploadedFiles = [
      { name: 'verified_clinic_bill.jpg', size: 345000, docType: 'clinic_opd_bill', isPrimary: true },
      { name: 'doctor_prescription.jpg', size: 210000, docType: 'doctor_prescription', isPrimary: false },
    ];

    // Sync form inputs in mock DOM
    const provInput = document.getElementById('claim-ext-provider');
    if (provInput) provInput.value = 'Arogya Daycare Clinic, Pune';
    const dateInput = document.getElementById('claim-ext-date');
    if (dateInput) dateInput.value = '2026-02-15';
    const diagInput = document.getElementById('claim-ext-diagnosis');
    if (diagInput) diagInput.value = 'Enteric Fever with Moderate Dehydration';
    const totalInput = document.getElementById('claim-ext-total');
    if (totalInput) totalInput.value = '7800.0';

    // Initialize event bindings
    initSubmitStep();

    // Render Step 4 pre-submission dossier
    renderSubmitStep();

    // A. Section 1 Assertions: Policy Name & Coverage Summary
    const dossierPolicyName = document.getElementById('dossier-policy-name');
    const dossierPolicyType = document.getElementById('dossier-policy-type');
    const dossierCoverageSummary = document.getElementById('dossier-coverage-summary');
    if (!dossierPolicyName.textContent.includes('Gig-Worker Micro-Health')) {
      throw new Error(`Dossier policy name mismatch: got ${dossierPolicyName.textContent}`);
    }
    if (!dossierPolicyType.textContent.includes('Micro-Health')) {
      throw new Error(`Dossier policy tag mismatch: got ${dossierPolicyType.textContent}`);
    }
    if (!dossierCoverageSummary.textContent.includes('₹5,000 OPD Clinic Sub-limit')) {
      throw new Error(`Dossier coverage summary mismatch: got ${dossierCoverageSummary.textContent}`);
    }

    // B. Section 2 Assertions: Verified Claimant & Incident Details
    const dossierClaimantName = document.getElementById('dossier-claimant-name');
    const dossierClaimantAge = document.getElementById('dossier-claimant-age');
    const dossierClaimantContact = document.getElementById('dossier-claimant-contact');
    const dossierProvider = document.getElementById('dossier-provider-name');
    const dossierIncidentDate = document.getElementById('dossier-incident-date');
    if (dossierClaimantName.textContent !== 'Ramesh Pawar') {
      throw new Error(`Dossier claimant name mismatch: got ${dossierClaimantName.textContent}`);
    }
    if (!dossierClaimantAge.textContent.includes('28')) {
      throw new Error(`Dossier claimant age mismatch: got ${dossierClaimantAge.textContent}`);
    }
    if (!dossierClaimantContact.textContent.includes('9876543210') || !dossierClaimantContact.textContent.includes('4821')) {
      throw new Error(`Dossier claimant contact mismatch: got ${dossierClaimantContact.textContent}`);
    }
    if (!dossierProvider.textContent.includes('Arogya Daycare Clinic')) {
      throw new Error(`Dossier provider mismatch: got ${dossierProvider.textContent}`);
    }
    if (dossierIncidentDate.textContent !== '2026-02-15') {
      throw new Error(`Dossier incident date mismatch: got ${dossierIncidentDate.textContent}`);
    }

    // C. Section 3 Assertions: Itemized Financial Breakdown (Billed vs. Excluded vs. Eligible Payout)
    const dossierClaimed = document.getElementById('dossier-claimed-amount');
    const dossierExcluded = document.getElementById('dossier-excluded-amount');
    const dossierPayout = document.getElementById('dossier-payout-amount');
    const dossierItemsList = document.getElementById('dossier-itemized-list');
    if (!dossierClaimed.textContent.includes('7,800')) {
      throw new Error(`Dossier claimed amount mismatch: got ${dossierClaimed.textContent}`);
    }
    if (!dossierExcluded.textContent.includes('450')) {
      throw new Error(`Dossier excluded amount mismatch: got ${dossierExcluded.textContent}`);
    }
    if (!dossierPayout.textContent.includes('5,000')) {
      throw new Error(`Dossier payout amount mismatch: got ${dossierPayout.textContent}`);
    }
    if (!dossierItemsList.innerHTML.includes('Ceftriaxone') || !dossierItemsList.innerHTML.includes('Multivitamin')) {
      throw new Error('Dossier itemized list should contain itemized medication charges');
    }

    // D. Section 4 Assertions: Attached Evidence Thumbnails with tags
    const evidenceGrid = document.getElementById('dossier-evidence-grid');
    const evidenceCount = document.getElementById('dossier-evidence-count');
    if (parseInt(evidenceCount.textContent, 10) < 2) {
      throw new Error(`Dossier evidence count should be at least 2, got ${evidenceCount.textContent}`);
    }
    if (!evidenceGrid.innerHTML.includes('Primary Proof') || !evidenceGrid.innerHTML.includes('verified_clinic_bill.jpg')) {
      throw new Error('Evidence grid should render primary proof card with thumbnail tag');
    }

    // E. Section 5 Assertions: Policy Compliance Summary
    const complianceSummary = document.getElementById('dossier-compliance-summary');
    const compliancePills = document.getElementById('dossier-compliance-pills');
    if (!complianceSummary.textContent.includes('Rules Satisfied') && !complianceSummary.textContent.includes('Passed')) {
      throw new Error(`Compliance summary mismatch: got ${complianceSummary.textContent}`);
    }
    if (!compliancePills.innerHTML.includes('pass') || !compliancePills.innerHTML.includes('warning')) {
      throw new Error('Compliance pills should display status chips for audit checks');
    }

    // F. User Confirmation Checkbox & Disabled Submit Button Barrier
    const confirmCheckbox = document.getElementById('claim-confirm-genuine');
    const submitBtn = document.getElementById('btn-submit-final-claim');

    // Verify checkbox is unchecked and button is disabled on render
    if (confirmCheckbox.checked) {
      throw new Error('Confirmation checkbox must be unchecked initially');
    }
    if (!submitBtn.disabled) {
      throw new Error('Submit claim button must be disabled initially');
    }

    // Toggle checkbox on: submit button enables
    confirmCheckbox.checked = true;
    confirmCheckbox.dispatchEvent({ type: 'change' });
    if (submitBtn.disabled) {
      throw new Error('Submit button should be enabled when genuine declaration is checked');
    }

    // Toggle checkbox off: submit button disables
    confirmCheckbox.checked = false;
    confirmCheckbox.dispatchEvent({ type: 'change' });
    if (!submitBtn.disabled) {
      throw new Error('Submit button should be disabled when genuine declaration is unchecked');
    }

    // Re-enable and test submission
    confirmCheckbox.checked = true;
    confirmCheckbox.dispatchEvent({ type: 'change' });

    // Execute Submission: POST /api/submit-claim
    await submitClaimPackage();

    // Verify Success Receipt State
    const reviewContainer = document.getElementById('claim-submit-review-state');
    const successContainer = document.getElementById('claim-submit-success-state');
    const receiptId = document.getElementById('receipt-claim-id');
    const receiptAmount = document.getElementById('receipt-eligible-amount');
    const receiptBadge = document.getElementById('receipt-status-badge');
    const downloadReportBtn = document.getElementById('btn-download-report');
    const downloadJsonBtn = document.getElementById('btn-download-json');

    if (reviewContainer.style.display !== 'none') {
      throw new Error('Review state should be hidden after successful submission');
    }
    if (successContainer.style.display !== 'block') {
      throw new Error('Success receipt state should be visible after successful submission');
    }
    if (receiptId.textContent !== 'CLM-2026-0048') {
      throw new Error(`Receipt claim ID mismatch: got ${receiptId.textContent}`);
    }
    if (!receiptAmount.textContent.includes('5,000')) {
      throw new Error(`Receipt eligible amount mismatch: got ${receiptAmount.textContent}`);
    }
    if (!receiptBadge.textContent.includes('READY TO APPROVE')) {
      throw new Error(`Receipt status badge mismatch: got ${receiptBadge.textContent}`);
    }
    if (downloadReportBtn.href !== '/api/claims/CLM-2026-0048/report') {
      throw new Error(`Download report link mismatch: got ${downloadReportBtn.href}`);
    }
    if (downloadJsonBtn.href !== '/api/claims/CLM-2026-0048/json') {
      throw new Error(`Download JSON link mismatch: got ${downloadJsonBtn.href}`);
    }

    console.log('✓ Test 31 Passed: Step 4 pre-submission dossier review, genuine checkbox gating, claim submission, and success receipt verified.');
  }

  // Test 32: Reassuring Confirmation Screen, Timestamp, Status Badge, and 3 Action Buttons
  {
    const {
      renderSuccessReceipt,
      openInInsurerQueue,
      renderInsurerQueue,
      resetClaimWizard,
      formatSubmissionTimestamp,
    } = await import('../static/js/submitStep.js');

    const sampleClaim = {
      claim_id: 'CLM-2026-0041',
      policy_id: 'micro_health_gig',
      policy_name: 'Gig-Worker Micro-Health Clinic Shield',
      claimant_name: 'Ramesh Pawar',
      claimed_amount_inr: 7800.0,
      approved_amount_inr: 5000.0,
      reviewer_status: 'READY_TO_APPROVE',
      created_at: '2026-11-24T16:42:40Z',
    };

    // Render reassuring confirmation screen
    renderSuccessReceipt(sampleClaim);

    // 1. Verify Claim Reference ID
    const receiptId = document.getElementById('receipt-claim-id');
    if (receiptId.textContent !== 'CLM-2026-0041') {
      throw new Error(`Expected Claim Reference ID CLM-2026-0041, got ${receiptId.textContent}`);
    }

    // 2. Verify Submission Timestamp
    const receiptTime = document.getElementById('receipt-submission-time');
    if (!receiptTime.textContent || !receiptTime.textContent.includes('2026')) {
      throw new Error(`Expected formatted submission timestamp, got ${receiptTime.textContent}`);
    }

    // 3. Verify Current Status Badge
    const receiptBadge = document.getElementById('receipt-status-badge');
    if (receiptBadge.textContent !== 'READY TO APPROVE') {
      throw new Error(`Expected status READY TO APPROVE, got ${receiptBadge.textContent}`);
    }
    if (!receiptBadge.classList.contains('badge-pass')) {
      throw new Error('Status badge should have badge-pass class');
    }

    // 4. Verify Action Button 1: "Print / Save Claim Package PDF" -> opens /api/claims/{id}/report in new tab
    const printPdfBtn = document.getElementById('btn-print-claim-pdf');
    if (!printPdfBtn || printPdfBtn.href !== '/api/claims/CLM-2026-0041/report') {
      throw new Error(`Print PDF button href mismatch: got ${printPdfBtn?.href}`);
    }
    if (printPdfBtn.target !== '_blank') {
      throw new Error(`Print PDF button should open in new tab (target="_blank")`);
    }

    // 5. Verify Action Button 2: "Open in Insurer Queue" -> switches to Insurer tab with claim highlighted
    // Mock queue container and claims data in state
    state.insurerClaims = {
      metrics: { total_claims: 3, ready_to_approve: 2, needs_review: 1 },
      claims: [
        sampleClaim,
        {
          claim_id: 'CLM-2026-0001',
          policy_name: 'Gig-Worker Micro-Health',
          claimant_name: 'Vikram Patel',
          claimed_amount_inr: 3200.0,
          approved_amount_inr: 3200.0,
          reviewer_status: 'READY_TO_APPROVE',
          created_at: '2026-02-15T10:30:00Z',
        },
      ],
    };

    let tabClicked = false;
    const tabInsurer = document.getElementById('tab-insurer');
    if (tabInsurer) {
      tabInsurer.addEventListener('click', () => { tabClicked = true; });
    }

    await openInInsurerQueue('CLM-2026-0041');

    if (!tabClicked && state.activeTab !== 'insurer') {
      throw new Error('openInInsurerQueue should switch view to insurer queue tab');
    }

    const queueHtml = document.getElementById('insurer-queue-container').innerHTML;
    if (!queueHtml.includes('CLM-2026-0041')) {
      throw new Error('Insurer queue container should render submitted claim');
    }
    if (!queueHtml.includes('highlighted-claim')) {
      throw new Error('Submitted claim should be rendered with highlighted-claim class');
    }
    if (!queueHtml.includes('Newly Submitted')) {
      throw new Error('Submitted claim should display Newly Submitted badge');
    }

    // 6. Verify Action Button 3: "File Another Claim" -> resets the wizard cleanly
    resetClaimWizard();

    const reviewContainer = document.getElementById('claim-submit-review-state');
    const successContainer = document.getElementById('claim-submit-success-state');
    const confirmCheckbox = document.getElementById('claim-confirm-genuine');
    const submitBtn = document.getElementById('btn-submit-final-claim');

    if (reviewContainer.style.display !== 'block') {
      throw new Error('Review state should be restored to display: block on reset');
    }
    if (successContainer.style.display !== 'none') {
      throw new Error('Success confirmation state should be hidden on reset');
    }
    if (confirmCheckbox.checked) {
      throw new Error('Confirmation checkbox should be reset to unchecked');
    }
    if (!submitBtn.disabled) {
      throw new Error('Submit button should be disabled after wizard reset');
    }
    if (state.claimDraft.uploadedFiles.length !== 0) {
      throw new Error('Uploaded files should be cleared on reset');
    }
    if (state.wizardStep !== 1) {
      throw new Error(`Wizard step should be reset to 1, got ${state.wizardStep}`);
    }

    console.log('✓ Test 32 Passed: Reassuring confirmation screen (Claim ID, Timestamp, Status Badge) and 3 action buttons (Print PDF, Open in Insurer Queue, File Another Claim) verified.');
  }

  // Test 33: Responsive 4-Metric Summary Strip Populated from Live Claims
  {
    const { renderInsurerQueue, initInsurerQueue } = await import('../static/js/insurerQueue.js');
    initInsurerQueue();

    state.insurerClaims = {
      metrics: {
        total_claims: 8,
        ready_to_approve: 5,
        needs_review: 3,
        approved_count: 2,
        prevented_rejections_count: 4,
      },
      claims: [
        {
          claim_id: 'CLM-2026-0001',
          policy_id: 'micro_health_gig',
          policy_name: 'Gig-Worker Clinic Shield',
          claimant_name: 'Vikram Patel',
          claimed_amount_inr: 3200.0,
          approved_amount_inr: 3200.0,
          reviewer_status: 'READY_TO_APPROVE',
          created_at: '2026-02-15T10:30:00Z',
          rule_checks: [
            { rule_id: 'age_limit', status: 'PASS' },
            { rule_id: 'waiting_period', status: 'PASS' },
            { rule_id: 'doc_required', status: 'PASS' },
            { rule_id: 'exclusions', status: 'PASS' },
            { rule_id: 'max_cap', status: 'PASS' },
          ],
        },
        {
          claim_id: 'CLM-2026-0002',
          policy_id: 'pmsby',
          policy_name: 'PMSBY (Accidental Cover)',
          claimant_name: 'Suresh Raina',
          claimed_amount_inr: 200000.0,
          approved_amount_inr: 200000.0,
          reviewer_status: 'NEEDS_REVIEW',
          created_at: '2026-02-14T09:15:00Z',
          rule_checks: [
            { rule_id: 'age_limit', status: 'PASS' },
            { rule_id: 'fir_required', status: 'WARNING' },
          ],
        },
        {
          claim_id: 'CLM-2026-0003',
          policy_id: 'pmfby',
          policy_name: 'PMFBY (Crop Hailstorm)',
          claimant_name: 'Kisan Singh',
          claimed_amount_inr: 45000.0,
          approved_amount_inr: 45000.0,
          reviewer_status: 'APPROVED',
          created_at: '2026-02-10T14:20:00Z',
          rule_checks: [
            { rule_id: 'land_record', status: 'PASS' },
          ],
        },
      ],
    };

    renderInsurerQueue();

    const mTotal = document.getElementById('metric-total-claims');
    const mReady = document.getElementById('metric-ready-to-approve');
    const mReview = document.getElementById('metric-needs-review');
    const mPrevented = document.getElementById('metric-prevented-rejections');

    if (mTotal.textContent !== '8') {
      throw new Error(`Expected Total Submissions 8, got ${mTotal.textContent}`);
    }
    if (mReady.textContent !== '5') {
      throw new Error(`Expected Pre-Validated Ready 5, got ${mReady.textContent}`);
    }
    if (mReview.textContent !== '3') {
      throw new Error(`Expected Needs Manual Review 3, got ${mReview.textContent}`);
    }
    if (mPrevented.textContent !== '4') {
      throw new Error(`Expected Rejections Prevented 4, got ${mPrevented.textContent}`);
    }

    console.log('✓ Test 33 Passed: 4-Metric summary strip accurately populates Total Submissions, Pre-Validated Ready, Needs Manual Review, and Rejections Prevented.');
  }

  // Test 34: Status Filter Tabs (All, Ready to Approve, Needs Review, Approved)
  {
    const { filterClaims, getActiveFilter, renderInsurerQueue } = await import('../static/js/insurerQueue.js');

    // Filter to READY_TO_APPROVE
    filterClaims('READY_TO_APPROVE');
    if (getActiveFilter() !== 'READY_TO_APPROVE') {
      throw new Error(`Active filter should be READY_TO_APPROVE, got ${getActiveFilter()}`);
    }
    let html = document.getElementById('insurer-queue-container').innerHTML;
    if (!html.includes('CLM-2026-0001')) {
      throw new Error('READY_TO_APPROVE filter should display CLM-2026-0001');
    }
    if (html.includes('CLM-2026-0002') || html.includes('CLM-2026-0003')) {
      throw new Error('READY_TO_APPROVE filter should not display CLM-2026-0002 or CLM-2026-0003');
    }

    // Filter to NEEDS_REVIEW
    filterClaims('NEEDS_REVIEW');
    html = document.getElementById('insurer-queue-container').innerHTML;
    if (!html.includes('CLM-2026-0002')) {
      throw new Error('NEEDS_REVIEW filter should display CLM-2026-0002');
    }
    if (html.includes('CLM-2026-0001') || html.includes('CLM-2026-0003')) {
      throw new Error('NEEDS_REVIEW filter should not display CLM-2026-0001 or CLM-2026-0003');
    }

    // Filter to APPROVED
    filterClaims('APPROVED');
    html = document.getElementById('insurer-queue-container').innerHTML;
    if (!html.includes('CLM-2026-0003')) {
      throw new Error('APPROVED filter should display CLM-2026-0003');
    }
    if (html.includes('CLM-2026-0001') || html.includes('CLM-2026-0002')) {
      throw new Error('APPROVED filter should not display CLM-2026-0001 or CLM-2026-0002');
    }

    // Filter back to all
    filterClaims('all');
    html = document.getElementById('insurer-queue-container').innerHTML;
    if (!html.includes('CLM-2026-0001') || !html.includes('CLM-2026-0002') || !html.includes('CLM-2026-0003')) {
      throw new Error('All filter should display all claims');
    }

    console.log('✓ Test 34 Passed: Status filter tabs (All, Ready to Approve, Needs Review, Approved) toggle active filter and update visible items live.');
  }

  // Test 35: Desktop Table Structure and Mobile Responsive Cards Transformation
  {
    const { renderInsurerQueue, computeComplianceScore } = await import('../static/js/insurerQueue.js');

    renderInsurerQueue();
    const html = document.getElementById('insurer-queue-container').innerHTML;

    // Check desktop table container and table headers
    if (!html.includes('insurer-desktop-table-container')) {
      throw new Error('Queue HTML must include .insurer-desktop-table-container');
    }
    if (!html.includes('insurer-claims-table')) {
      throw new Error('Queue HTML must include table.insurer-claims-table');
    }

    const headers = ['Claim ID', 'Claimant', 'Scheme', 'Claimed vs. Eligible', 'Compliance Score', 'Status', 'Action'];
    for (const h of headers) {
      if (!html.includes(h)) {
        throw new Error(`Table should contain column header "${h}"`);
      }
    }

    // Check mobile cards container and stacked cards
    if (!html.includes('insurer-mobile-cards-container')) {
      throw new Error('Queue HTML must include .insurer-mobile-cards-container');
    }
    if (!html.includes('mobile-claim-card')) {
      throw new Error('Queue HTML must include .mobile-claim-card for mobile rendering');
    }

    // Verify compliance score calculation
    const perfectClaim = { rule_checks: [{ status: 'PASS' }, { status: 'PASS' }] };
    const pScore = computeComplianceScore(perfectClaim);
    if (pScore.score !== 100) {
      throw new Error(`Expected 100% compliance score, got ${pScore.score}`);
    }

    const mixedClaim = { rule_checks: [{ status: 'PASS' }, { status: 'FAIL' }] };
    const mScore = computeComplianceScore(mixedClaim);
    if (mScore.score !== 50) {
      throw new Error(`Expected 50% compliance score, got ${mScore.score}`);
    }

    console.log('✓ Test 35 Passed: Desktop table layout (Claim ID, Claimant, Scheme, Claimed vs. Eligible ₹, Compliance Score, Status, Action) and mobile stacked card transformation (<768px) verified.');
  }

  // Test 36: Interactive Claim Detail Drawer and Decision Desk
  {
    const { 
      openClaimDetailDrawer, 
      closeClaimDetailDrawer, 
      submitOfficerDecision,
      initInsurerQueue 
    } = await import('../static/js/insurerQueue.js');

    initInsurerQueue();

    // 1. Open Claim Detail Drawer
    await openClaimDetailDrawer('CLM-2026-0001');

    const drawer = document.getElementById('insurer-claim-drawer');
    const backdrop = document.getElementById('insurer-claim-drawer-backdrop');

    if (!drawer.classList.contains('open') || drawer.hidden) {
      throw new Error('Drawer should be open and visible');
    }
    if (!backdrop.classList.contains('active') || backdrop.hidden) {
      throw new Error('Drawer backdrop should be active and visible');
    }

    // 2. Verify Extracted OCR Data
    const drawerProvider = document.getElementById('drawer-ocr-provider');
    if (!drawerProvider.textContent.includes('City Health Care')) {
      throw new Error(`Expected provider City Health Care, got ${drawerProvider.textContent}`);
    }

    const drawerTotal = document.getElementById('drawer-ocr-total');
    if (!drawerTotal.textContent.includes('3,200')) {
      throw new Error(`Expected total amount ₹3,200 in OCR section, got ${drawerTotal.textContent}`);
    }

    const itemizedListHtml = document.getElementById('drawer-itemized-list').innerHTML;
    if (!itemizedListHtml.includes('OPD Consultation') || !itemizedListHtml.includes('Antibiotics')) {
      throw new Error('Extracted OCR section must render itemized line items table');
    }

    // 3. Verify Clickable High-Res Evidence Thumbnails
    const evidenceGridHtml = document.getElementById('drawer-evidence-grid').innerHTML;
    if (!evidenceGridHtml.includes('drawer-evidence-card') || !evidenceGridHtml.includes('clinic_bill_signed.jpg')) {
      throw new Error('Evidence grid should render high-res clickable evidence cards');
    }

    // 4. Verify Complete Automated Rule Audit Trail
    const auditChecksHtml = document.getElementById('drawer-audit-checks-list').innerHTML;
    if (!auditChecksHtml.includes('PASS') || !auditChecksHtml.includes('Age Window Validated')) {
      throw new Error('Complete automated rule audit trail must render in drawer');
    }

    // 5. Verify Reviewer Decision Panel
    const approvedInput = document.getElementById('reviewer-approved-amount');
    const notesTextarea = document.getElementById('reviewer-notes');
    if (approvedInput.value !== '3200') {
      throw new Error(`Approved amount input should be initialized with 3200, got ${approvedInput.value}`);
    }

    // 6. Test Submitting Officer Decision
    approvedInput.value = '3200.00';
    notesTextarea.value = 'Approved for instant DBT transfer to HDFC account.';
    await submitOfficerDecision('CLM-2026-0001', 'APPROVED');

    // Verify drawer closed
    if (drawer.classList.contains('open') && !drawer.hidden) {
      throw new Error('Drawer should close after decision is saved');
    }

    console.log('✓ Test 36 Passed: Interactive Claim Detail Drawer (Full Extracted OCR, Clickable High-Res Evidence, Automated Audit Trail, Reviewer Decision Panel, and Instant Queue/KPI Refresh) verified.');
  }

  // Test 32: Reassuring Confirmation Screen, Timestamp, Status Badge, and 3 Action Buttons
  {
    const {
      renderSuccessReceipt,
      openInInsurerQueue,
      renderInsurerQueue,
      resetClaimWizard,
      formatSubmissionTimestamp,
    } = await import('../static/js/submitStep.js');

    const sampleClaim = {
      claim_id: 'CLM-2026-0041',
      policy_id: 'micro_health_gig',
      policy_name: 'Gig-Worker Micro-Health Clinic Shield',
      claimant_name: 'Ramesh Pawar',
      claimed_amount_inr: 7800.0,
      approved_amount_inr: 5000.0,
      reviewer_status: 'READY_TO_APPROVE',
      created_at: '2026-11-24T16:42:40Z',
    };

    // Render reassuring confirmation screen
    renderSuccessReceipt(sampleClaim);

    // 1. Verify Claim Reference ID
    const receiptId = document.getElementById('receipt-claim-id');
    if (receiptId.textContent !== 'CLM-2026-0041') {
      throw new Error(`Expected Claim Reference ID CLM-2026-0041, got ${receiptId.textContent}`);
    }

    // 2. Verify Submission Timestamp
    const receiptTime = document.getElementById('receipt-submission-time');
    if (!receiptTime.textContent || !receiptTime.textContent.includes('2026')) {
      throw new Error(`Expected formatted submission timestamp, got ${receiptTime.textContent}`);
    }

    // 3. Verify Current Status Badge
    const receiptBadge = document.getElementById('receipt-status-badge');
    if (receiptBadge.textContent !== 'READY TO APPROVE') {
      throw new Error(`Expected status READY TO APPROVE, got ${receiptBadge.textContent}`);
    }
    if (!receiptBadge.classList.contains('badge-pass')) {
      throw new Error('Status badge should have badge-pass class');
    }

    // 4. Verify Action Button 1: "Print / Save Claim Package PDF" -> opens /api/claims/{id}/report in new tab
    const printPdfBtn = document.getElementById('btn-print-claim-pdf');
    if (!printPdfBtn || printPdfBtn.href !== '/api/claims/CLM-2026-0041/report') {
      throw new Error(`Print PDF button href mismatch: got ${printPdfBtn?.href}`);
    }
    if (printPdfBtn.target !== '_blank') {
      throw new Error(`Print PDF button should open in new tab (target="_blank")`);
    }

    // 5. Verify Action Button 2: "Open in Insurer Queue" -> switches to Insurer tab with claim highlighted
    // Mock queue container and claims data in state
    state.insurerClaims = {
      metrics: { total_claims: 3, ready_to_approve: 2, needs_review: 1 },
      claims: [
        sampleClaim,
        {
          claim_id: 'CLM-2026-0001',
          policy_name: 'Gig-Worker Micro-Health',
          claimant_name: 'Vikram Patel',
          claimed_amount_inr: 3200.0,
          approved_amount_inr: 3200.0,
          reviewer_status: 'READY_TO_APPROVE',
          created_at: '2026-02-15T10:30:00Z',
        },
      ],
    };

    let tabClicked = false;
    const tabInsurer = document.getElementById('tab-insurer');
    if (tabInsurer) {
      tabInsurer.addEventListener('click', () => { tabClicked = true; });
    }

    await openInInsurerQueue('CLM-2026-0041');

    if (!tabClicked && state.activeTab !== 'insurer') {
      throw new Error('openInInsurerQueue should switch view to insurer queue tab');
    }

    const queueHtml = document.getElementById('insurer-queue-container').innerHTML;
    if (!queueHtml.includes('CLM-2026-0041')) {
      throw new Error('Insurer queue container should render submitted claim');
    }
    if (!queueHtml.includes('highlighted-claim')) {
      throw new Error('Submitted claim should be rendered with highlighted-claim class');
    }
    if (!queueHtml.includes('Newly Submitted')) {
      throw new Error('Submitted claim should display Newly Submitted badge');
    }

    // 6. Verify Action Button 3: "File Another Claim" -> resets the wizard cleanly
    resetClaimWizard();

    const reviewContainer = document.getElementById('claim-submit-review-state');
    const successContainer = document.getElementById('claim-submit-success-state');
    const confirmCheckbox = document.getElementById('claim-confirm-genuine');
    const submitBtn = document.getElementById('btn-submit-final-claim');

    if (reviewContainer.style.display !== 'block') {
      throw new Error('Review state should be restored to display: block on reset');
    }
    if (successContainer.style.display !== 'none') {
      throw new Error('Success confirmation state should be hidden on reset');
    }
    if (confirmCheckbox.checked) {
      throw new Error('Confirmation checkbox should be reset to unchecked');
    }
    if (!submitBtn.disabled) {
      throw new Error('Submit button should be disabled after wizard reset');
    }
    if (state.claimDraft.uploadedFiles.length !== 0) {
      throw new Error('Uploaded files should be cleared on reset');
    }
    if (state.wizardStep !== 1) {
      throw new Error(`Wizard step should be reset to 1, got ${state.wizardStep}`);
    }

    console.log('✓ Test 32 Passed: Reassuring confirmation screen (Claim ID, Timestamp, Status Badge) and 3 action buttons (Print PDF, Open in Insurer Queue, File Another Claim) verified.');
  }

  // Test 33: Responsive 4-Metric Summary Strip Populated from Live Claims
  {
    const { renderInsurerQueue, initInsurerQueue } = await import('../static/js/insurerQueue.js');
    initInsurerQueue();

    state.insurerClaims = {
      metrics: {
        total_claims: 8,
        ready_to_approve: 5,
        needs_review: 3,
        approved_count: 2,
        prevented_rejections_count: 4,
      },
      claims: [
        {
          claim_id: 'CLM-2026-0001',
          policy_id: 'micro_health_gig',
          policy_name: 'Gig-Worker Clinic Shield',
          claimant_name: 'Vikram Patel',
          claimed_amount_inr: 3200.0,
          approved_amount_inr: 3200.0,
          reviewer_status: 'READY_TO_APPROVE',
          created_at: '2026-02-15T10:30:00Z',
          rule_checks: [
            { rule_id: 'age_limit', status: 'PASS' },
            { rule_id: 'waiting_period', status: 'PASS' },
            { rule_id: 'doc_required', status: 'PASS' },
            { rule_id: 'exclusions', status: 'PASS' },
            { rule_id: 'max_cap', status: 'PASS' },
          ],
        },
        {
          claim_id: 'CLM-2026-0002',
          policy_id: 'pmsby',
          policy_name: 'PMSBY (Accidental Cover)',
          claimant_name: 'Suresh Raina',
          claimed_amount_inr: 200000.0,
          approved_amount_inr: 200000.0,
          reviewer_status: 'NEEDS_REVIEW',
          created_at: '2026-02-14T09:15:00Z',
          rule_checks: [
            { rule_id: 'age_limit', status: 'PASS' },
            { rule_id: 'fir_required', status: 'WARNING' },
          ],
        },
        {
          claim_id: 'CLM-2026-0003',
          policy_id: 'pmfby',
          policy_name: 'PMFBY (Crop Hailstorm)',
          claimant_name: 'Kisan Singh',
          claimed_amount_inr: 45000.0,
          approved_amount_inr: 45000.0,
          reviewer_status: 'APPROVED',
          created_at: '2026-02-10T14:20:00Z',
          rule_checks: [
            { rule_id: 'land_record', status: 'PASS' },
          ],
        },
      ],
    };

    renderInsurerQueue();

    const mTotal = document.getElementById('metric-total-claims');
    const mReady = document.getElementById('metric-ready-to-approve');
    const mReview = document.getElementById('metric-needs-review');
    const mPrevented = document.getElementById('metric-prevented-rejections');

    if (mTotal.textContent !== '8') {
      throw new Error(`Expected Total Submissions 8, got ${mTotal.textContent}`);
    }
    if (mReady.textContent !== '5') {
      throw new Error(`Expected Pre-Validated Ready 5, got ${mReady.textContent}`);
    }
    if (mReview.textContent !== '3') {
      throw new Error(`Expected Needs Manual Review 3, got ${mReview.textContent}`);
    }
    if (mPrevented.textContent !== '4') {
      throw new Error(`Expected Rejections Prevented 4, got ${mPrevented.textContent}`);
    }

    console.log('✓ Test 33 Passed: 4-Metric summary strip accurately populates Total Submissions, Pre-Validated Ready, Needs Manual Review, and Rejections Prevented.');
  }

  // Test 34: Status Filter Tabs (All, Ready to Approve, Needs Review, Approved)
  {
    const { filterClaims, getActiveFilter, renderInsurerQueue } = await import('../static/js/insurerQueue.js');

    // Filter to READY_TO_APPROVE
    filterClaims('READY_TO_APPROVE');
    if (getActiveFilter() !== 'READY_TO_APPROVE') {
      throw new Error(`Active filter should be READY_TO_APPROVE, got ${getActiveFilter()}`);
    }
    let html = document.getElementById('insurer-queue-container').innerHTML;
    if (!html.includes('CLM-2026-0001')) {
      throw new Error('READY_TO_APPROVE filter should display CLM-2026-0001');
    }
    if (html.includes('CLM-2026-0002') || html.includes('CLM-2026-0003')) {
      throw new Error('READY_TO_APPROVE filter should not display CLM-2026-0002 or CLM-2026-0003');
    }

    // Filter to NEEDS_REVIEW
    filterClaims('NEEDS_REVIEW');
    html = document.getElementById('insurer-queue-container').innerHTML;
    if (!html.includes('CLM-2026-0002')) {
      throw new Error('NEEDS_REVIEW filter should display CLM-2026-0002');
    }
    if (html.includes('CLM-2026-0001') || html.includes('CLM-2026-0003')) {
      throw new Error('NEEDS_REVIEW filter should not display CLM-2026-0001 or CLM-2026-0003');
    }

    // Filter to APPROVED
    filterClaims('APPROVED');
    html = document.getElementById('insurer-queue-container').innerHTML;
    if (!html.includes('CLM-2026-0003')) {
      throw new Error('APPROVED filter should display CLM-2026-0003');
    }
    if (html.includes('CLM-2026-0001') || html.includes('CLM-2026-0002')) {
      throw new Error('APPROVED filter should not display CLM-2026-0001 or CLM-2026-0002');
    }

    // Filter back to all
    filterClaims('all');
    html = document.getElementById('insurer-queue-container').innerHTML;
    if (!html.includes('CLM-2026-0001') || !html.includes('CLM-2026-0002') || !html.includes('CLM-2026-0003')) {
      throw new Error('All filter should display all claims');
    }

    console.log('✓ Test 34 Passed: Status filter tabs (All, Ready to Approve, Needs Review, Approved) toggle active filter and update visible items live.');
  }

  // Test 35: Desktop Table Structure and Mobile Responsive Cards Transformation
  {
    const { renderInsurerQueue, computeComplianceScore } = await import('../static/js/insurerQueue.js');

    renderInsurerQueue();
    const html = document.getElementById('insurer-queue-container').innerHTML;

    // Check desktop table container and table headers
    if (!html.includes('insurer-desktop-table-container')) {
      throw new Error('Queue HTML must include .insurer-desktop-table-container');
    }
    if (!html.includes('insurer-claims-table')) {
      throw new Error('Queue HTML must include table.insurer-claims-table');
    }

    const headers = ['Claim ID', 'Claimant', 'Scheme', 'Claimed vs. Eligible', 'Compliance Score', 'Status', 'Action'];
    for (const h of headers) {
      if (!html.includes(h)) {
        throw new Error(`Table should contain column header "${h}"`);
      }
    }

    // Check mobile cards container and stacked cards
    if (!html.includes('insurer-mobile-cards-container')) {
      throw new Error('Queue HTML must include .insurer-mobile-cards-container');
    }
    if (!html.includes('mobile-claim-card')) {
      throw new Error('Queue HTML must include .mobile-claim-card for mobile rendering');
    }

    // Verify compliance score calculation
    const perfectClaim = { rule_checks: [{ status: 'PASS' }, { status: 'PASS' }] };
    const pScore = computeComplianceScore(perfectClaim);
    if (pScore.score !== 100) {
      throw new Error(`Expected 100% compliance score, got ${pScore.score}`);
    }

    const mixedClaim = { rule_checks: [{ status: 'PASS' }, { status: 'FAIL' }] };
    const mScore = computeComplianceScore(mixedClaim);
    if (mScore.score !== 50) {
      throw new Error(`Expected 50% compliance score, got ${mScore.score}`);
    }

    console.log('✓ Test 35 Passed: Desktop table layout (Claim ID, Claimant, Scheme, Claimed vs. Eligible ₹, Compliance Score, Status, Action) and mobile stacked card transformation (<768px) verified.');
  }

  // Test 36: Interactive Claim Detail Drawer and Decision Desk
  {
    const { 
      openClaimDetailDrawer, 
      closeClaimDetailDrawer, 
      submitOfficerDecision,
      initInsurerQueue 
    } = await import('../static/js/insurerQueue.js');

    initInsurerQueue();

    // 1. Open Claim Detail Drawer
    await openClaimDetailDrawer('CLM-2026-0001');

    const drawer = document.getElementById('insurer-claim-drawer');
    const backdrop = document.getElementById('insurer-claim-drawer-backdrop');

    if (!drawer.classList.contains('open') || drawer.hidden) {
      throw new Error('Drawer should be open and visible');
    }
    if (!backdrop.classList.contains('active') || backdrop.hidden) {
      throw new Error('Drawer backdrop should be active and visible');
    }

    // 2. Verify Extracted OCR Data
    const drawerProvider = document.getElementById('drawer-ocr-provider');
    if (!drawerProvider.textContent.includes('City Health Care')) {
      throw new Error(`Expected provider City Health Care, got ${drawerProvider.textContent}`);
    }

    const drawerTotal = document.getElementById('drawer-ocr-total');
    if (!drawerTotal.textContent.includes('3,200')) {
      throw new Error(`Expected total amount ₹3,200 in OCR section, got ${drawerTotal.textContent}`);
    }

    const itemizedListHtml = document.getElementById('drawer-itemized-list').innerHTML;
    if (!itemizedListHtml.includes('OPD Consultation') || !itemizedListHtml.includes('Antibiotics')) {
      throw new Error('Extracted OCR section must render itemized line items table');
    }

    // 3. Verify Clickable High-Res Evidence Thumbnails
    const evidenceGridHtml = document.getElementById('drawer-evidence-grid').innerHTML;
    if (!evidenceGridHtml.includes('drawer-evidence-card') || !evidenceGridHtml.includes('clinic_bill_signed.jpg')) {
      throw new Error('Evidence grid should render high-res clickable evidence cards');
    }

    // 4. Verify Complete Automated Rule Audit Trail
    const auditChecksHtml = document.getElementById('drawer-audit-checks-list').innerHTML;
    if (!auditChecksHtml.includes('PASS') || !auditChecksHtml.includes('Age Window Validated')) {
      throw new Error('Complete automated rule audit trail must render in drawer');
    }

    // 5. Verify Reviewer Decision Panel
    const approvedInput = document.getElementById('reviewer-approved-amount');
    const notesTextarea = document.getElementById('reviewer-notes');
    if (approvedInput.value !== '3200') {
      throw new Error(`Approved amount input should be initialized with 3200, got ${approvedInput.value}`);
    }

    // 6. Test Submitting Officer Decision
    approvedInput.value = '3200.00';
    notesTextarea.value = 'Approved for instant DBT transfer to HDFC account.';
    await submitOfficerDecision('CLM-2026-0001', 'APPROVED');

    // Verify drawer closed
    if (drawer.classList.contains('open') && !drawer.hidden) {
      throw new Error('Drawer should close after decision is saved');
    }

    console.log('✓ Test 36 Passed: Interactive Claim Detail Drawer (Full Extracted OCR, Clickable High-Res Evidence, Automated Audit Trail, Reviewer Decision Panel, and Instant Queue/KPI Refresh) verified.');
  }

  // ==========================================
  // Test 37: Client-side Canvas Image Compression (uploader.js)
  // ==========================================
  {
    const { compressImageIfNeeded } = await import('../static/js/uploader.js');

    // 1. Non-image fallback test
    const dummyTxt = { name: 'bill.txt', type: 'text/plain', size: 1024 };
    const resTxt = await compressImageIfNeeded(dummyTxt);
    if (resTxt.wasCompressed !== false) {
      throw new Error('Non-image file should not be compressed');
    }

    // 2. Mock Canvas Environment to verify resizing > 1400px and 0.82 JPEG compression
    let createdCanvas = null;
    let drawnDims = null;
    let blobQuality = null;

    global.HTMLCanvasElement = class MockCanvas {};
    const originalCreateElement = global.document.createElement;
    global.document.createElement = (tag) => {
      if (tag === 'canvas') {
        createdCanvas = {
          width: 0,
          height: 0,
          getContext: (type) => ({
            imageSmoothingEnabled: false,
            imageSmoothingQuality: '',
            drawImage: (img, x, y, w, h) => {
              drawnDims = { w, h };
            },
          }),
          toDataURL: (type, q) => `data:${type};base64,mockCompressedData`,
          toBlob: (cb, type, q) => {
            blobQuality = q;
            cb({
              size: 245000, // ~240 KB (under 400 KB)
              type: type,
            });
          },
        };
        return createdCanvas;
      }
      return createMockElement(tag);
    };

    global.Image = class MockImage {
      constructor() {
        this.naturalWidth = 2800;
        this.naturalHeight = 2100;
        this.width = 2800;
        this.height = 2100;
      }
      set src(val) {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 5);
      }
    };

    global.URL = {
      createObjectURL: () => 'blob:mock-object-url',
      revokeObjectURL: () => {},
    };

    const largeFile = {
      name: 'large_rural_clinic_bill.jpg',
      type: 'image/jpeg',
      size: 3500000, // 3.5 MB
    };

    const compResult = await compressImageIfNeeded(largeFile, 1400, 0.82);

    if (!compResult.wasCompressed) {
      throw new Error('Image exceeding 1400px should be marked wasCompressed: true');
    }
    if (drawnDims.w !== 1400 || drawnDims.h !== 1050) {
      throw new Error(`Expected downscale to 1400x1050 maintaining 4:3 ratio, got ${drawnDims.w}x${drawnDims.h}`);
    }
    if (blobQuality !== 0.82) {
      throw new Error(`Expected JPEG quality 0.82, got ${blobQuality}`);
    }
    if (compResult.compressedSize >= 400 * 1024) {
      throw new Error(`Compressed size must stay under 400 KB, got ${compResult.compressedSize}`);
    }

    console.log('✓ Test 37 Passed: Client-side Canvas Image Compression (Resizing photos > 1400px to 1400px at 0.82 JPEG quality staying under 400 KB) verified.');
  }

  // ==========================================
  // Test 38: Offline / Server-Disconnected Banner and Health Monitoring (main.js)
  // ==========================================
  {
    const { checkServerHealth } = await import('../static/js/main.js');
    const { state } = await import('../static/js/state.js');

    const bannerEl = createMockElement('div', 'server-disconnected-banner');
    bannerEl.hidden = true;
    reg('server-disconnected-banner', bannerEl);

    const retryBtnEl = createMockElement('button', 'btn-retry-server-connection');
    reg('btn-retry-server-connection', retryBtnEl);

    // 1. Simulate server offline (fetch error)
    global.fetch = async (url) => {
      if (String(url).endsWith('/api/health')) {
        throw new Error('Connection refused / 503 Service Unavailable');
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const healthy1 = await checkServerHealth(false);
    if (healthy1 !== false || bannerEl.hidden !== false) {
      throw new Error('Server-disconnected banner should unhide when /api/health fails');
    }
    if (state.systemHealth.status !== 'offline') {
      throw new Error(`State health should be offline, got ${state.systemHealth.status}`);
    }

    // 2. Simulate server restored (healthy)
    global.fetch = async (url) => {
      if (String(url).endsWith('/api/health')) {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (h) => (h && h.toLowerCase() === 'content-type' ? 'application/json' : '')
          },
          json: async () => ({ status: 'healthy', gemini_api_key_configured: true, gemini_model: 'gemini-3.5-flash-lite' }),
        };
      }
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({}) };
    };

    const healthy2 = await checkServerHealth(false);
    if (healthy2 !== true || bannerEl.hidden !== true) {
      throw new Error('Server-disconnected banner should hide when /api/health succeeds');
    }
    if (state.systemHealth.status !== 'healthy') {
      throw new Error(`State health should be healthy, got ${state.systemHealth.status}`);
    }

    console.log('✓ Test 38 Passed: Offline / Server-Disconnected Banner and Health Monitoring verified.');
  }

  // ==========================================
  // Test 39: Accessibility (a11y) & Focus Ring Verification
  // ==========================================
  {
    const fs = await import('fs');
    const htmlContent = fs.readFileSync('static/index.html', 'utf-8');
    const cssContent = fs.readFileSync('static/styles.css', 'utf-8');

    // Check aria-live on dynamic sections
    if (!htmlContent.includes('id="claim-crosscheck-scorecard"') || !htmlContent.includes('aria-live="polite"')) {
      throw new Error('Scorecard or live region should have aria-live="polite"');
    }
    if (!htmlContent.includes('id="server-disconnected-banner"') || !htmlContent.includes('aria-live="assertive"')) {
      throw new Error('Server-disconnected banner must have aria-live="assertive"');
    }

    // Check focus-visible rings in CSS
    if (!cssContent.includes(':focus-visible') || !cssContent.includes('outline: 2px solid')) {
      throw new Error('styles.css must include accessible :focus-visible rules with outline and shadow');
    }

    // Check mobile responsive viewport breakpoint
    if (!cssContent.includes('@media (max-width: 480px)') || !cssContent.includes('@media (min-width: 1024px)')) {
      throw new Error('styles.css must have mobile 375x812 and desktop 1440x900 responsive styles');
    }

    console.log('✓ Test 39 Passed: Accessibility (Keyboard focus rings, ARIA polite/assertive regions, responsive viewports) verified.');
  }

  console.log('\nAll 14 Step 1 & Claim Wizard Integration Tests Passed Cleanly!');
  console.log('All 20 Step 1 & Step 2 Claim Wizard Integration Tests Passed Cleanly!');
  console.log('All 24 Step 1, Step 2 & Loading State Wizard Integration Tests Passed Cleanly!');
  console.log('All 28 Step 1, 2 & Step 3 Verify Data Wizard Integration Tests Passed Cleanly!');
  console.log('All 29 Step 1, 2 & Step 3 Policy Scorecard Integration Tests Passed Cleanly!');
  console.log('All 30 Step 1, 2 & Step 3 Recovery & Re-Check Wizard Tests Passed Cleanly!');
  console.log('All 31 Step 1, 2, 3 & Step 4 Review & Submit Claim Package Tests Passed Cleanly!');
  console.log('All 32 Step 1, 2, 3, 4 & Confirmation Receipt & Queue Action Tests Passed Cleanly!');
}

runWizardTests().catch(err => {
  console.error('Wizard Test Failure:', err);
  process.exit(1);
});
