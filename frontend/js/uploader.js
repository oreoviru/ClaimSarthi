/**
 * SurakshaSetu — Step 2 Document Uploader Module
 * File: static/js/uploader.js
 * 
 * Features:
 * - Mobile-friendly upload area supporting phone camera capture (accept="image/*" capture="environment").
 * - Desktop drag-and-drop on individual slots and master dropzone.
 * - Clearly labeled upload slots driven by selected policy's required_docs:
 *     * Primary Proof Slot (e.g., Handwritten Hospital Bill or Crop Damage Photo) [Required *]
 *     * Secondary Proof Slots (e.g., Doctor Prescription, FIR Copy, Land Record) [Optional / Can Skip]
 * - Users can upload now or skip optional slots to see the Rejection-Prevention engine catch the gap.
 * - Crisp image thumbnails, formatted file sizes, and remove/retake buttons.
 * - Full synchronization with state.claimDraft (uploadedSlots, uploadedFiles, primaryDocType, secondaryDocTypes).
 */

import {
  state,
  subscribe,
  updateClaimDraft,
  setSelectedPolicyId,
} from './state.js';

import { showToast } from './api.js';
import { highlightActivePolicyBanner } from './recommender.js';

/**
 * Upload Slots Configuration driven by policy required_docs & rejection rules
 */
export const POLICY_DOCUMENT_SLOTS = {
  micro_health_gig: {
    policyId: 'micro_health_gig',
    policyName: 'Gig-Worker Micro-Health Clinic Shield',
    primary: {
      slotId: 'primary_bill',
      title: 'Handwritten Clinic Invoice / Hospital Bill',
      titleHi: 'अस्पताल / क्लिनिक का बिल',
      docType: 'clinic_opd_bill',
      isPrimary: true,
      isMandatory: true,
      badgeText: 'Primary Proof *',
      icon: '🧾',
      description: 'Itemized outpatient bill with clinic name, date, doctor stamp, and authorized signature.',
      placeholderHint: 'Clear photo of final clinic invoice or cash receipt',
    },
    secondary: [
      {
        slotId: 'doctor_prescription',
        title: 'Doctor Consultation Prescription',
        titleHi: 'डॉक्टर का पर्चा (Prescription)',
        docType: 'doctor_prescription',
        isPrimary: false,
        isMandatory: false,
        badgeText: 'Secondary (Recommended)',
        icon: '🩺',
        description: 'Prescription from licensed MBBS/MD doctor with diagnosis matching medicines billed.',
        skipNotice: 'Optional: Upload now or skip to see the Rejection-Prevention engine catch the missing prescription gap.',
      },
      {
        slotId: 'gig_partner_profile',
        title: 'Active Gig Worker Profile / ID Card',
        titleHi: 'गिग पार्टनर आईडी / प्रोफाइल',
        docType: 'gig_profile',
        isPrimary: false,
        isMandatory: false,
        badgeText: 'Secondary (Optional)',
        icon: '📱',
        description: 'Screenshot of active delivery/driver profile (Swiggy, Zomato, Urban Company, Uber, Blinkit).',
        skipNotice: 'Optional: Upload now or skip for automated profile verification during settlement.',
      },
    ],
  },

  pmfby: {
    policyId: 'pmfby',
    policyName: 'Pradhan Mantri Fasal Bima Yojana',
    primary: {
      slotId: 'primary_crop_photo',
      title: 'Crop Damage / Inundation Field Photograph',
      titleHi: 'फसल नुकसान / जलभराव की फोटो',
      docType: 'crop_damage_photo',
      isPrimary: true,
      isMandatory: true,
      badgeText: 'Primary Proof *',
      icon: '🌾',
      description: 'Clear photograph of damaged standing crop (hailstorm, flood inundation, drought) with visible plot context.',
      placeholderHint: 'Geo-tagged field photo taken within 72 hours of damage',
    },
    secondary: [
      {
        slotId: 'land_record_ror',
        title: 'Land Record (RoR / 7/12 Patta / Khasra)',
        titleHi: 'भूमि रिकॉर्ड (7/12 खसरा / खतौनी)',
        docType: 'land_record_ror',
        isPrimary: false,
        isMandatory: false,
        badgeText: 'Secondary (Recommended)',
        icon: '📜',
        description: 'Record of Rights (RoR) or 7/12 land possession extract showing survey plot number.',
        skipNotice: 'Optional: Upload now or skip to see the Rejection-Prevention engine catch missing land possession proof.',
      },
      {
        slotId: 'sowing_certificate',
        title: 'Sowing Certificate / Crop Declaration',
        titleHi: 'बुवाई प्रमाण पत्र (Sowing Certificate)',
        docType: 'sowing_certificate',
        isPrimary: false,
        isMandatory: false,
        badgeText: 'Secondary (Recommended)',
        icon: '🌱',
        description: 'Crop sowing declaration certified by Village Revenue Officer (Patwari / Agriculture Officer).',
        skipNotice: 'Optional: Upload now or skip to see Rejection-Prevention detect missing crop sowing verification.',
      },
    ],
  },

  pmsby: {
    policyId: 'pmsby',
    policyName: 'Pradhan Mantri Suraksha Bima Yojana',
    primary: {
      slotId: 'primary_accident_report',
      title: 'FIR Copy / Police Inquest / Hospital Medical Report',
      titleHi: 'एफआईआर (FIR) / आपातकालीन मेडिकल रिपोर्ट',
      docType: 'fir_or_police_report',
      isPrimary: true,
      isMandatory: true,
      badgeText: 'Primary Proof *',
      icon: '📋',
      description: 'Police FIR / Panchnama (for road/traffic accidents) or Emergency Hospital Medical Report (for snakebite/fall).',
      placeholderHint: 'Official police report or government hospital emergency casualty sheet',
    },
    secondary: [
      {
        slotId: 'pme_disability',
        title: 'Post-Mortem Report or Disability Certificate',
        titleHi: 'पोस्टमॉर्टम / दिव्यांगता प्रमाण पत्र',
        docType: 'pme_report',
        isPrimary: false,
        isMandatory: false,
        badgeText: 'Secondary (Recommended)',
        icon: '📄',
        description: 'Post-Mortem Examination (PME) report (for death) or Civil Surgeon Disability Certificate.',
        skipNotice: 'Optional: Upload now or skip to see how accidental cause validation detects casualty records.',
      },
      {
        slotId: 'bank_passbook',
        title: 'Bank Passbook Copy (Premium Auto-Debit Proof)',
        titleHi: 'बैंक पासबुक (प्रीमियम कटौती प्रमाण)',
        docType: 'bank_passbook',
        isPrimary: false,
        isMandatory: false,
        badgeText: 'Secondary (Optional)',
        icon: '🏦',
        description: 'Copy of bank passbook or statement proving auto-debit of ₹20 annual premium.',
        skipNotice: 'Optional: Upload now or skip for automated bank account lookup.',
      },
    ],
  },

  pmjjby: {
    policyId: 'pmjjby',
    policyName: 'Pradhan Mantri Jeevan Jyoti Bima Yojana',
    primary: {
      slotId: 'primary_death_cert',
      title: 'Death Certificate of Insured Member',
      titleHi: 'मृत्यु प्रमाण पत्र (Death Certificate)',
      docType: 'death_certificate',
      isPrimary: true,
      isMandatory: true,
      badgeText: 'Primary Proof *',
      icon: '📄',
      description: 'Official death certificate issued by Municipal Registrar or Panchayat with registration number.',
      placeholderHint: 'Original or certified copy of municipal death certificate',
    },
    secondary: [
      {
        slotId: 'claim_form_discharge',
        title: 'PMJJBY Claim Form & Nominee Discharge Receipt',
        titleHi: 'क्लेम फॉर्म एवं डिस्चार्ज रसीद',
        docType: 'claim_form_discharge',
        isPrimary: false,
        isMandatory: false,
        badgeText: 'Secondary (Recommended)',
        icon: '✍️',
        description: 'Signed claim form and discharge voucher executed by the registered nominee.',
        skipNotice: 'Optional: Upload now or skip to see missing nominee discharge warning in the audit engine.',
      },
      {
        slotId: 'bank_passbook',
        title: 'Nominee Bank Passbook / DBT Cancelled Cheque',
        titleHi: 'नॉमिनी बैंक खाता प्रमाण / चेक',
        docType: 'bank_passbook',
        isPrimary: false,
        isMandatory: false,
        badgeText: 'Secondary (Optional)',
        icon: '🏦',
        description: 'Nominee savings bank passbook copy for direct ₹2,00,000 benefit transfer.',
        skipNotice: 'Optional: Account proof for direct electronic reimbursement payout.',
      },
    ],
  },

  ab_pmjay: {
    policyId: 'ab_pmjay',
    policyName: 'Ayushman Bharat PM-JAY',
    primary: {
      slotId: 'primary_discharge_summary',
      title: 'Hospital IPD Discharge Summary & Treatment Log',
      titleHi: 'अस्पताल डिस्चार्ज सारांश (Discharge Summary)',
      docType: 'hospital_discharge_summary',
      isPrimary: true,
      isMandatory: true,
      badgeText: 'Primary Proof *',
      icon: '🏥',
      description: 'Hospital IPD discharge card showing admission date, diagnostic summary, and doctor signature.',
      placeholderHint: 'Official hospital discharge summary and bed admission record',
    },
    secondary: [
      {
        slotId: 'ayushman_ecard',
        title: 'Ayushman Golden Card / ABHA ID',
        titleHi: 'आयुष्मान गोल्डन कार्ड / ABHA आईडी',
        docType: 'ayushman_ecard',
        isPrimary: false,
        isMandatory: false,
        badgeText: 'Secondary (Recommended)',
        icon: '🪪',
        description: 'Ayushman Bharat PM-JAY e-card or ABHA digital health ID of the admitted patient.',
        skipNotice: 'Optional: Upload now or skip to see Rejection-Prevention verify PM-JAY beneficiary linkage.',
      },
      {
        slotId: 'aadhaar_card',
        title: 'Aadhaar Card Copy of Beneficiary',
        titleHi: 'आधार कार्ड (Aadhaar Card)',
        docType: 'aadhaar_card',
        isPrimary: false,
        isMandatory: false,
        badgeText: 'Secondary (Optional)',
        icon: '🆔',
        description: 'Government identity proof matching hospital IPD patient registration.',
        skipNotice: 'Optional: Identity proof for family beneficiary verification.',
      },
    ],
  },
};

/**
 * Format bytes into human-readable size string (KB / MB)
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get document slot definition for policy and slotId
 * @param {string} policyId
 * @param {string} slotId
 * @returns {any | null}
 */
export function getSlotConfig(policyId, slotId) {
  const pConfig = POLICY_DOCUMENT_SLOTS[policyId] || POLICY_DOCUMENT_SLOTS.micro_health_gig;
  if (pConfig.primary.slotId === slotId) return pConfig.primary;
  return pConfig.secondary.find((s) => s.slotId === slotId) || null;
}

/**
 * Synchronize state.claimDraft with current uploaded slots
 */
export function syncDraftFromSlots() {
  state.claimDraft.uploadedSlots = state.claimDraft.uploadedSlots || {};
  const slots = state.claimDraft.uploadedSlots;
  const policyId = state.selectedPolicyId || 'micro_health_gig';
  const pConfig = POLICY_DOCUMENT_SLOTS[policyId] || POLICY_DOCUMENT_SLOTS.micro_health_gig;

  // Primary slot docType
  const primarySlotFile = slots[pConfig.primary.slotId];
  if (primarySlotFile) {
    state.claimDraft.primaryDocType = primarySlotFile.docType || pConfig.primary.docType;
  } else {
    state.claimDraft.primaryDocType = pConfig.primary.docType;
  }

  // Secondary slot docTypes
  const secondaryFiles = pConfig.secondary
    .map((s) => slots[s.slotId])
    .filter(Boolean);

  state.claimDraft.secondaryDocTypes = secondaryFiles.map((f) => f.docType);

  // Synchronize uploadedFiles array for backward-compatibility with backend & tests
  const allFiles = Object.values(slots).filter(Boolean);
  state.claimDraft.uploadedFiles = allFiles;

  // Synced all doc tags
  state.claimDraft.uploadedDocTypes = [
    state.claimDraft.primaryDocType,
    ...state.claimDraft.secondaryDocTypes,
  ];

  // Also update primary doc type select element if present
  const primarySelect = document.getElementById('claim-primary-doc-type');
  if (primarySelect && state.claimDraft.primaryDocType) {
    primarySelect.value = state.claimDraft.primaryDocType;
  }

  renderPreviews();
}

/**
 * Attach file or image data to an upload slot
 * @param {string} slotId
 * @param {File | Blob | null} file
 * @param {string} dataUrl
 * @param {string} [customDocType]
 * @param {string} [customName]
 * @param {number} [customSize]
 */
export function attachFileToSlot(slotId, file, dataUrl, customDocType, customName, customSize) {
  const policyId = state.selectedPolicyId || 'micro_health_gig';
  const slotConfig = getSlotConfig(policyId, slotId);
  const docType = customDocType || slotConfig?.docType || 'clinic_opd_bill';
  const fileName = customName || file?.name || `${slotConfig?.title || 'Document'}.jpg`;
  const fileSize = customSize !== undefined ? customSize : (file?.size || 0);

  const fileEntry = {
    slotId,
    name: fileName,
    size: fileSize,
    type: file?.type || 'image/jpeg',
    dataUrl: dataUrl || '',
    file: file || null,
    docType: docType,
    isPrimary: Boolean(slotConfig?.isPrimary),
    attachedAt: Date.now(),
  };

  state.claimDraft.uploadedSlots = state.claimDraft.uploadedSlots || {};
  state.claimDraft.uploadedSlots[slotId] = fileEntry;

  // If manual file attached to primary slot, clear demo sample
  if (slotConfig?.isPrimary) {
    state.claimDraft.selectedSampleId = null;
  }

  // Reset extracted analysis so step 3 re-runs with new proof
  state.claimDraft.extractedData = null;

  syncDraftFromSlots();
  renderUploadSlots(policyId);
  showToast(`Attached ${slotConfig?.title || fileName} successfully.`, 'success');
}

/**
 * Remove file from a specific slot
 * @param {string} slotId
 */
export function removeSlotFile(slotId) {
  const policyId = state.selectedPolicyId || 'micro_health_gig';
  const slotConfig = getSlotConfig(policyId, slotId);

  state.claimDraft.uploadedSlots = state.claimDraft.uploadedSlots || {};
  if (state.claimDraft.uploadedSlots[slotId]) {
    delete state.claimDraft.uploadedSlots[slotId];
  }

  if (slotConfig?.isPrimary && state.claimDraft.selectedSampleId) {
    state.claimDraft.selectedSampleId = null;
  }

  state.claimDraft.extractedData = null;

  syncDraftFromSlots();
  renderUploadSlots(policyId);
  showToast(`Removed ${slotConfig?.title || 'document'}.`, 'info');
}

/**
 * Load bundled demo scenario
 * @param {'clean_clinic_bill' | 'tricky_handwritten_bill' | 'pmfby_hailstorm_crop'} sampleId
 */
export function loadDemoSample(sampleId) {
  state.claimDraft.selectedSampleId = sampleId;
  state.claimDraft.uploadedSlots = {};
  state.claimDraft.uploadedFiles = [];
  state.claimDraft.extractedData = null;

  const sampleMeta = {
    clean_clinic_bill: {
      name: 'clean_clinic_bill.jpg',
      size: 78051,
      policyId: 'micro_health_gig',
      claimant: 'Ramesh Pawar',
      age: 28,
      docType: 'clinic_opd_bill',
      toast: 'Loaded Clean Clinic Bill (₹2,450 Micro-Health)',
      primaryTitle: 'Clean Clinic Bill (₹2,450 Typhoid OPD)',
    },
    tricky_handwritten_bill: {
      name: 'tricky_handwritten_bill.jpg',
      size: 55338,
      policyId: 'micro_health_gig',
      claimant: 'Suresh Kumar',
      age: 34,
      docType: 'clinic_opd_bill',
      toast: 'Loaded Tricky Handwritten Bill (3 rejection catches)',
      primaryTitle: 'Tricky Handwritten Bill (₹7,800 + Multivitamins)',
    },
    pmfby_hailstorm_crop: {
      name: 'pmfby_hailstorm_wheat.jpg',
      size: 99152,
      policyId: 'pmfby',
      claimant: 'Balwinder Singh',
      age: 44,
      docType: 'crop_damage_photo',
      toast: 'Loaded PMFBY Hailstorm Wheat Crop Loss sample',
      primaryTitle: 'PMFBY Hailstorm Wheat Crop Damage Photo',
    },
  }[sampleId];

  if (sampleMeta) {
    // Update step 1 fields
    const policySelect = document.getElementById('claim-policy-id');
    const nameInput = document.getElementById('claim-claimant-name');
    const ageInput = document.getElementById('claim-claimant-age');
    const docTypeSelect = document.getElementById('claim-primary-doc-type');

    if (policySelect) policySelect.value = sampleMeta.policyId;
    if (nameInput) nameInput.value = sampleMeta.claimant;
    if (ageInput) ageInput.value = String(sampleMeta.age);
    if (docTypeSelect) docTypeSelect.value = sampleMeta.docType;

    setSelectedPolicyId(sampleMeta.policyId);
    highlightActivePolicyBanner(sampleMeta.policyId);

    updateClaimDraft({
      claimantDetails: {
        name: sampleMeta.claimant,
        age: sampleMeta.age,
      },
    });

    // Populate Primary Proof slot with sample reference
    const pConfig = POLICY_DOCUMENT_SLOTS[sampleMeta.policyId] || POLICY_DOCUMENT_SLOTS.micro_health_gig;
    state.claimDraft.uploadedSlots = {
      [pConfig.primary.slotId]: {
        slotId: pConfig.primary.slotId,
        name: sampleMeta.name,
        size: sampleMeta.size,
        type: 'image/jpeg',
        dataUrl: '', // Sample loaded from backend by sampleId
        file: null,
        docType: sampleMeta.docType,
        isPrimary: true,
        isSample: true,
        sampleTitle: sampleMeta.primaryTitle,
      },
    };

    syncDraftFromSlots();
    renderUploadSlots(sampleMeta.policyId);
    showToast(sampleMeta.toast, 'info');
  }
}

/**
 * Render dynamic upload slots based on selected policy's required_docs
 * @param {string} [policyId]
 */
export function renderUploadSlots(policyId) {
  const targetPolicyId = policyId || state.selectedPolicyId || 'micro_health_gig';
  const container = document.getElementById('policy-upload-slots-container');
  if (!container) return;

  const config = POLICY_DOCUMENT_SLOTS[targetPolicyId] || POLICY_DOCUMENT_SLOTS.micro_health_gig;
  const uploadedSlots = state.claimDraft.uploadedSlots || {};
  const sampleId = state.claimDraft.selectedSampleId;

  const slotsList = [config.primary, ...config.secondary];

  let html = `
    <div class="slots-section-header">
      <div class="slots-heading-wrap">
        <h4 class="slots-heading">Document Proof Slots for ${config.policyName}</h4>
        <span class="slots-subtext">Required proofs driven by official policy rules &amp; anti-rejection guardrails</span>
      </div>
    </div>
    <div class="slots-cards-grid">
  `;

  slotsList.forEach((slot) => {
    const isPrimary = slot.isPrimary;
    const attached = uploadedSlots[slot.slotId];
    const isSample = attached?.isSample || (isPrimary && Boolean(sampleId));
    const cardClass = [
      'upload-slot-card',
      isPrimary ? 'slot-card-primary' : 'slot-card-secondary',
      attached || isSample ? 'slot-has-file' : 'slot-empty',
    ].join(' ');

    html += `
      <div class="${cardClass}" id="slot-card-${slot.slotId}" data-slot-id="${slot.slotId}" data-doc-type="${slot.docType}">
        <div class="slot-header">
          <div class="slot-title-col">
            <span class="slot-icon" aria-hidden="true">${slot.icon}</span>
            <div class="slot-title-meta">
              <strong class="slot-title">${slot.title}</strong>
              <span class="slot-desc">${slot.description}</span>
            </div>
          </div>
          <div class="slot-badge-wrap">
            <span class="slot-badge ${isPrimary ? 'badge-primary-required' : 'badge-secondary-optional'}">
              ${isPrimary ? 'Primary Required *' : 'Optional (Can Skip)'}
            </span>
          </div>
        </div>
    `;

    // If Document is attached or Demo Sample is active
    if (attached || isSample) {
      const fileName = attached?.name || (sampleId ? `${sampleId}.jpg` : 'Attached Document');
      const fileSize = attached?.size ? formatFileSize(attached.size) : 'Demo High-Res';
      const hasThumb = Boolean(attached?.dataUrl);

      html += `
        <div class="slot-preview-box" id="slot-preview-${slot.slotId}">
          <div class="slot-thumb-container">
            ${
              hasThumb
                ? `<img src="${attached.dataUrl}" alt="${fileName}" class="slot-thumb-img">`
                : `<div class="slot-thumb-placeholder">${slot.icon}</div>`
            }
          </div>
          <div class="slot-meta-container">
            <div class="slot-file-name-row">
              <span class="slot-file-name" title="${fileName}">${attached?.sampleTitle || fileName}</span>
              ${isSample ? '<span class="pill-demo-tag">Instant Demo Case</span>' : '<span class="pill-attached-tag">✓ Ready</span>'}
            </div>
            <div class="slot-file-specs">
              <span>Size: ${fileSize}</span>
              <span>•</span>
              <span>Type: ${slot.docType}</span>
            </div>
          </div>
          <div class="slot-btn-actions">
            <button type="button" class="btn-slot-control btn-retake-action" data-action="retake" data-slot-id="${slot.slotId}" title="Retake or replace this document" aria-label="Retake or replace ${slot.title}">
              📷 Retake
            </button>
            <button type="button" class="btn-slot-control btn-remove-action" data-action="remove" data-slot-id="${slot.slotId}" title="Remove document" aria-label="Remove ${slot.title}">
              ✕ Remove
            </button>
          </div>
        </div>
      `;
    } else {
      // Empty Slot: Provide Camera Capture + Desktop File Browse + Drag-and-drop
      html += `
        <div class="slot-dropzone" id="dropzone-${slot.slotId}" data-slot-id="${slot.slotId}" tabindex="0" role="button" aria-label="Drop or upload ${slot.title}">
          <!-- Hidden Inputs for Mobile Camera Capture and File Picker -->
          <input type="file" id="camera-input-${slot.slotId}" accept="image/*" capture="environment" class="visually-hidden" data-slot-id="${slot.slotId}" aria-label="Camera capture for ${slot.title}">
          <input type="file" id="browse-input-${slot.slotId}" accept="image/jpeg,image/png,image/webp" class="visually-hidden" data-slot-id="${slot.slotId}" aria-label="File picker for ${slot.title}">

          <div class="slot-drop-actions">
            <button type="button" class="btn btn-primary btn-slot-camera" data-target-input="camera-input-${slot.slotId}" data-slot-id="${slot.slotId}" aria-label="Take photo of ${slot.title}">
              <span class="btn-icon">📷</span>
              <span>Take Photo</span>
            </button>
            <button type="button" class="btn btn-outline btn-slot-browse" data-target-input="browse-input-${slot.slotId}" data-slot-id="${slot.slotId}" aria-label="Browse image of ${slot.title}">
              <span class="btn-icon">📁</span>
              <span>Browse Image</span>
            </button>
            <span class="slot-drag-hint">or drop file here</span>
          </div>

          ${
            !isPrimary && slot.skipNotice
              ? `
              <div class="slot-skip-box">
                <span class="skip-pill">Rejection Guard</span>
                <span class="skip-note">${slot.skipNotice}</span>
              </div>
            `
              : ''
          }
        </div>
      `;
    }

    html += `</div>`; // Close slot card
  });

  html += `</div>`; // Close grid
  container.innerHTML = html;

  // Bind interactive handlers to the newly rendered slots
  bindSlotEvents(container, targetPolicyId);
}

/**
 * Bind camera, browse, drag-drop, retake, and remove events to slot elements
 * @param {HTMLElement} container
 * @param {string} policyId
 */
function bindSlotEvents(container, policyId) {
  // 1. Camera Buttons (Phone Camera Capture)
  container.querySelectorAll('.btn-slot-camera').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const inputId = btn.getAttribute('data-target-input');
      const inputEl = document.getElementById(inputId);
      if (inputEl) inputEl.click();
    });
  });

  // 2. Browse Buttons (File Picker)
  container.querySelectorAll('.btn-slot-browse').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const inputId = btn.getAttribute('data-target-input');
      const inputEl = document.getElementById(inputId);
      if (inputEl) inputEl.click();
    });
  });

  // 3. File Input Change Listeners (Both Camera and Browse)
  container.querySelectorAll('input[type="file"][data-slot-id]').forEach((inputEl) => {
    inputEl.addEventListener('change', () => {
      const slotId = inputEl.getAttribute('data-slot-id');
      if (inputEl.files && inputEl.files.length > 0) {
        handleFileSelectedForSlot(slotId, inputEl.files[0]);
      }
    });
  });

  // 4. Desktop Drag & Drop on Slot Dropzones
  container.querySelectorAll('.slot-dropzone').forEach((dz) => {
    const slotId = dz.getAttribute('data-slot-id');

    ['dragenter', 'dragover'].forEach((eventName) => {
      dz.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dz.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.remove('dragover');
      });
    });

    dz.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleFileSelectedForSlot(slotId, files[0]);
      }
    });
  });

  // 5. Remove Button
  container.querySelectorAll('.btn-remove-action').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const slotId = btn.getAttribute('data-slot-id');
      if (slotId) removeSlotFile(slotId);
    });
  });

  // 6. Retake Button
  container.querySelectorAll('.btn-retake-action').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const slotId = btn.getAttribute('data-slot-id');
      // Clear current file then trigger browse
      if (slotId) {
        removeSlotFile(slotId);
        // Find input after re-render
        setTimeout(() => {
          const browseInput = document.getElementById(`browse-input-${slotId}`);
          if (browseInput) browseInput.click();
        }, 50);
      }
    });
  });
}

/**
 * Client-side Canvas Image Compression
 * Resizes photos exceeding maxDimension (1400px) and compresses to JPEG at target quality (0.82).
 * Ensures rural 3G/4G phone uploads stay under 400 KB while preserving document clarity.
 *
 * @param {File} file
 * @param {number} [maxDimension=1400]
 * @param {number} [quality=0.82]
 * @returns {Promise<{ file: File | Blob, dataUrl: string, wasCompressed: boolean, originalSize: number, compressedSize: number }>}
 */
export async function compressImageIfNeeded(file, maxDimension = 1400, quality = 0.82) {
  if (!file) {
    return { file: null, dataUrl: '', wasCompressed: false, originalSize: 0, compressedSize: 0 };
  }

  const originalSize = file.size || 0;

  // Graceful fallback for non-browser environments (e.g. Node test runners) or non-images
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof Image === 'undefined' ||
    typeof HTMLCanvasElement === 'undefined' ||
    !file.type ||
    !file.type.startsWith('image/')
  ) {
    return new Promise((resolve) => {
      if (typeof FileReader !== 'undefined') {
        const reader = new FileReader();
        reader.onload = (e) => resolve({
          file,
          dataUrl: e.target?.result || '',
          wasCompressed: false,
          originalSize,
          compressedSize: originalSize,
        });
        reader.onerror = () => resolve({
          file,
          dataUrl: '',
          wasCompressed: false,
          originalSize,
          compressedSize: originalSize,
        });
        reader.readAsDataURL(file);
      } else {
        resolve({
          file,
          dataUrl: '',
          wasCompressed: false,
          originalSize,
          compressedSize: originalSize,
        });
      }
    });
  }

  return new Promise((resolve) => {
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
    } catch (e) {
      // Fallback if URL.createObjectURL fails
      const reader = new FileReader();
      reader.onload = (ev) => resolve({
        file,
        dataUrl: ev.target?.result || '',
        wasCompressed: false,
        originalSize,
        compressedSize: originalSize,
      });
      reader.onerror = () => resolve({
        file,
        dataUrl: '',
        wasCompressed: false,
        originalSize,
        compressedSize: originalSize,
      });
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      const needsResize = width > maxDimension || height > maxDimension;
      const needsCompression = originalSize > 400 * 1024; // > 400 KB

      // If dimensions are <= 1400 and file size is <= 400KB and already JPEG, no canvas resize required
      if (!needsResize && !needsCompression && file.type === 'image/jpeg') {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            file,
            dataUrl: e.target?.result || '',
            wasCompressed: false,
            originalSize,
            compressedSize: originalSize,
          });
        };
        reader.onerror = () => {
          resolve({
            file,
            dataUrl: '',
            wasCompressed: false,
            originalSize,
            compressedSize: originalSize,
          });
        };
        reader.readAsDataURL(file);
        return;
      }

      // Calculate aspect-ratio preserved dimensions
      let targetWidth = width;
      let targetHeight = height;

      if (width > height) {
        if (width > maxDimension) {
          targetHeight = Math.round((height * maxDimension) / width);
          targetWidth = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          targetWidth = Math.round((width * maxDimension) / height);
          targetHeight = maxDimension;
        }
      }

      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve({
            file,
            dataUrl: '',
            wasCompressed: false,
            originalSize,
            compressedSize: originalSize,
          });
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        if (typeof canvas.toBlob === 'function') {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve({
                  file,
                  dataUrl,
                  wasCompressed: false,
                  originalSize,
                  compressedSize: originalSize,
                });
                return;
              }

              const cleanBaseName = (file.name || 'document').replace(/\.[^.]+$/, '');
              const compressedFileName = `${cleanBaseName}.jpg`;

              let compressedFile;
              try {
                compressedFile = new File([blob], compressedFileName, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
              } catch (err) {
                blob.name = compressedFileName;
                compressedFile = blob;
              }

              resolve({
                file: compressedFile,
                dataUrl,
                wasCompressed: true,
                originalSize,
                compressedSize: blob.size,
              });
            },
            'image/jpeg',
            quality
          );
        } else {
          resolve({
            file,
            dataUrl,
            wasCompressed: false,
            originalSize,
            compressedSize: originalSize,
          });
        }
      } catch (err) {
        console.warn('Canvas compression exception:', err);
        resolve({
          file,
          dataUrl: '',
          wasCompressed: false,
          originalSize,
          compressedSize: originalSize,
        });
      }
    };

    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          file,
          dataUrl: e.target?.result || '',
          wasCompressed: false,
          originalSize,
          compressedSize: originalSize,
        });
      };
      reader.onerror = () => {
        resolve({
          file,
          dataUrl: '',
          wasCompressed: false,
          originalSize,
          compressedSize: originalSize,
        });
      };
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Handle file selected by camera or file chooser for a specific slot
 * @param {string} slotId
 * @param {File} file
 */
async function handleFileSelectedForSlot(slotId, file) {
  if (!file) return;

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const isValidType = allowedTypes.includes(file.type) || file.name.match(/\.(jpg|jpeg|png|webp)$/i);

  if (!isValidType) {
    showToast('Please upload a clear JPG, PNG, or WebP document image.', 'warning');
    return;
  }

  // 15MB initial size check
  if (file.size > 15 * 1024 * 1024) {
    showToast('Document image size exceeds 15MB limit. Please retake or crop.', 'warning');
    return;
  }

  try {
    // Compress image: resize if > 1400px at 0.82 JPEG quality
    const { file: processedFile, dataUrl, wasCompressed, originalSize, compressedSize } =
      await compressImageIfNeeded(file, 1400, 0.82);

    const targetFile = processedFile || file;
    const policyId = state.selectedPolicyId || 'micro_health_gig';
    const slotConfig = getSlotConfig(policyId, slotId);

    attachFileToSlot(
      slotId,
      targetFile,
      dataUrl,
      slotConfig?.docType,
      targetFile?.name || file.name,
      targetFile?.size || file.size
    );

    if (wasCompressed && originalSize > compressedSize) {
      const savedKb = Math.round((originalSize - compressedSize) / 1024);
      const finalKb = Math.round(compressedSize / 1024);
      console.log(`[Compression] Reduced photo from ${Math.round(originalSize / 1024)} KB to ${finalKb} KB (saved ${savedKb} KB) for rural upload.`);
    }
  } catch (err) {
    console.warn('Canvas compression error, using original file:', err);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result;
      const policyId = state.selectedPolicyId || 'micro_health_gig';
      const slotConfig = getSlotConfig(policyId, slotId);
      attachFileToSlot(slotId, file, dataUrl, slotConfig?.docType, file.name, file.size);
    };
    reader.readAsDataURL(file);
  }
}

/**
 * Render document preview thumbnails in Step 2 summary section
 */
export function renderPreviews() {
  const container = document.getElementById('claim-previews-container');
  const countEl = document.getElementById('preview-count');
  if (!container) return;

  const uploadedSlots = state.claimDraft.uploadedSlots || {};
  const files = Object.values(uploadedSlots).filter(Boolean);
  const sampleId = state.claimDraft.selectedSampleId;

  if (files.length === 0 && !sampleId) {
    container.innerHTML = `
      <div class="empty-previews-hint" id="empty-previews-hint">
        No documents attached yet. Drop an image into an upload slot above or select an instant demo case.
      </div>
    `;
    if (countEl) countEl.textContent = '0';
    return;
  }

  let html = '';

  // Render Sample Card if active
  if (sampleId) {
    const sampleTitles = {
      clean_clinic_bill: 'Clean Clinic Bill (₹2,450 Typhoid Bill)',
      tricky_handwritten_bill: 'Tricky Handwritten Bill (₹7,800 + Multivitamins)',
      pmfby_hailstorm_crop: 'PMFBY Hailstorm Crop Damage Photo',
    };
    html += `
      <div class="preview-card sample-preview-card" id="sample-preview-card">
        <div class="preview-badge-sample">Demo Case</div>
        <div class="preview-thumbnail sample-thumb">
          <span class="sample-icon">📄</span>
        </div>
        <div class="preview-details">
          <strong class="preview-name">${sampleTitles[sampleId] || sampleId}</strong>
          <span class="preview-meta">Pre-bundled high-res photo • Ready for instant OCR audit</span>
        </div>
        <button type="button" class="btn-preview-remove" id="btn-remove-sample" title="Remove sample" aria-label="Remove sample">
          &times;
        </button>
      </div>
    `;
  }

  // Render uploaded slot files
  files.forEach((file, index) => {
    if (file.isSample) return; // Already rendered sample card
    const sizeFormatted = formatFileSize(file.size);
    html += `
      <div class="preview-card" data-slot-id="${file.slotId || ''}" data-file-index="${index}">
        <div class="preview-thumbnail">
          ${file.dataUrl ? `<img src="${file.dataUrl}" alt="${file.name}" class="preview-img">` : '<span class="thumb-icon">📁</span>'}
        </div>
        <div class="preview-details">
          <strong class="preview-name">${file.name}</strong>
          <span class="preview-meta">${sizeFormatted} • ${file.docType || 'Document'}</span>
        </div>
        <button type="button" class="btn-preview-remove" data-remove-slot="${file.slotId || ''}" title="Remove file" aria-label="Remove file">
          &times;
        </button>
      </div>
    `;
  });

  const totalCount = files.length + (sampleId && !files.some((f) => f.isSample) ? 1 : 0);
  if (countEl) countEl.textContent = String(totalCount);

  container.innerHTML = html;

  // Bind Remove Buttons in preview section
  const removeSampleBtn = container.querySelector('#btn-remove-sample');
  if (removeSampleBtn) {
    removeSampleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.claimDraft.selectedSampleId = null;
      syncDraftFromSlots();
      renderUploadSlots();
    });
  }

  container.querySelectorAll('.btn-preview-remove[data-remove-slot]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const slotId = btn.getAttribute('data-remove-slot');
      if (slotId) removeSlotFile(slotId);
    });
  });
}

/**
 * Validate Step 2: requires at least 1 document in Primary Proof slot or a demo sample
 * Optional secondary slots can be skipped intentionally to test Rejection-Prevention
 * @returns {boolean}
 */
export function validateStep2() {
  const policyId = state.selectedPolicyId || 'micro_health_gig';
  const config = POLICY_DOCUMENT_SLOTS[policyId] || POLICY_DOCUMENT_SLOTS.micro_health_gig;
  const primarySlotId = config.primary.slotId;

  const uploadedSlots = state.claimDraft.uploadedSlots || {};
  const hasPrimaryFile = Boolean(uploadedSlots[primarySlotId]);
  const hasSample = Boolean(state.claimDraft.selectedSampleId);
  const anyFileUploaded = Object.keys(uploadedSlots).length > 0;

  if (!hasPrimaryFile && !hasSample && !anyFileUploaded) {
    showToast(
      `Please upload your Primary Proof (${config.primary.title}) or pick a demo case to proceed.`,
      'warning'
    );
    return false;
  }
  return true;
}

/**
 * Initialize Step 2 Uploader
 */
export function initUploader() {
  const policyId = state.selectedPolicyId || 'micro_health_gig';
  renderUploadSlots(policyId);

  // General Dropzone compatibility
  const generalDropzone = document.getElementById('claim-dropzone');
  const generalFileInput = document.getElementById('claim-file-input');
  const generalBrowseBtn = document.getElementById('btn-browse-files');

  if (generalBrowseBtn && generalFileInput) {
    generalBrowseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      generalFileInput.click();
    });
  }

  if (generalDropzone && generalFileInput) {
    generalDropzone.addEventListener('click', () => generalFileInput.click());

    ['dragenter', 'dragover'].forEach((eventName) => {
      generalDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        generalDropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      generalDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        generalDropzone.classList.remove('dragover');
      });
    });

    generalDropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        // Route to primary slot
        const curPolicy = state.selectedPolicyId || 'micro_health_gig';
        const pCfg = POLICY_DOCUMENT_SLOTS[curPolicy] || POLICY_DOCUMENT_SLOTS.micro_health_gig;
        handleFileSelectedForSlot(pCfg.primary.slotId, files[0]);
      }
    });

    generalFileInput.addEventListener('change', () => {
      if (generalFileInput.files && generalFileInput.files.length > 0) {
        const curPolicy = state.selectedPolicyId || 'micro_health_gig';
        const pCfg = POLICY_DOCUMENT_SLOTS[curPolicy] || POLICY_DOCUMENT_SLOTS.micro_health_gig;
        handleFileSelectedForSlot(pCfg.primary.slotId, generalFileInput.files[0]);
      }
    });
  }

  // Demo Sample Buttons
  const sampleCleanBtn = document.getElementById('btn-sample-clean');
  const sampleTrickyBtn = document.getElementById('btn-sample-tricky');
  const sampleCropBtn = document.getElementById('btn-sample-crop');

  if (sampleCleanBtn) {
    sampleCleanBtn.addEventListener('click', () => loadDemoSample('clean_clinic_bill'));
  }
  if (sampleTrickyBtn) {
    sampleTrickyBtn.addEventListener('click', () => loadDemoSample('tricky_handwritten_bill'));
  }
  if (sampleCropBtn) {
    sampleCropBtn.addEventListener('click', () => loadDemoSample('pmfby_hailstorm_crop'));
  }

  // Subscribe to policy selection changes to re-render slots
  subscribe((currentState, changedKey) => {
    if (changedKey === 'selectedPolicyId' && currentState.selectedPolicyId) {
      renderUploadSlots(currentState.selectedPolicyId);
    }
  });

  renderPreviews();
}
