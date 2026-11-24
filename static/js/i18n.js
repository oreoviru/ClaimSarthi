/**
 * SurakshaSetu — Internationalization (i18n) Module
 * Bilingual dictionary and instantaneous DOM translation engine
 * Supports clean English and practical Hindi (Devanagari script).
 */

import { state, subscribe, setLanguage } from './state.js';

export const translations = {
  en: {
    // Brand & Top Header
    brand_name: 'SurakshaSetu',
    brand_tagline: 'Micro-Insurance Assistant • Claim Audit & Scheme Matcher',
    lang_toggle: 'EN / हिंदी',
    status_online: 'Online',
    status_fallback: 'Demo Fallback',
    status_degraded: 'Degraded',

    // 3-Step Promise Intro Strip
    promise_badge: 'Instant Pre-Audit',
    promise_step_1: 'Scan Bill',
    promise_step_2: 'Check Policy Rules',
    promise_step_3: 'Submit Verified Claim',

    // Desktop Tabs
    tab_recommend: 'Find Right Cover',
    tab_claim: 'File a Claim',
    tab_insurer: 'Insurer Queue',

    // Mobile Bottom Nav
    mobile_nav_recommend: 'Cover',
    mobile_nav_claim: 'Claim',
    mobile_nav_insurer: 'Queue',

    // View 1: Find Right Cover
    recommend_tag: 'Coverage Matcher',
    recommend_title: '1. Find Right Cover',
    recommend_desc: 'Discover affordable Indian government and micro-insurance schemes (PMSBY, PMJJBY, PMFBY, Ayushman Bharat, Micro-Health) tailored to your age, occupation, and family budget.',
    recommend_heading: 'Smart Scheme Recommendation Engine',
    recommend_subheading: 'Answer a few simple questions to see eligible schemes, verified benefits, and prorated premium estimates.',
    rec_occ_label: '1. Select Your Occupation / Livelihood',
    occ_gig: 'Gig / Delivery Worker',
    occ_gig_desc: 'Zomato, Swiggy, Zepto, Blinkit, Uber, Ola, courier delivery',
    occ_farmer: 'Farmer / Rural Household',
    occ_farmer_desc: 'Kisan, small & marginal farmers, tenant cultivators',
    occ_daily_wage: 'Daily Wage / Shopkeeper',
    occ_daily_wage_desc: 'Vendors, construction labor, trades, local retail',
    occ_senior: 'Senior Citizen 70+',
    occ_senior_desc: 'Elderly individuals, pensioners, senior parents',
    rec_risk_label: '2. Select Your Primary Protection Priority',
    risk_health: 'Hospital & Clinic Bills',
    risk_health_desc: 'Daycare OPD, doctor visits, medicines, acute surgeries',
    risk_accident: 'Accidents & Disability',
    risk_accident_desc: 'Road accidents, trauma injury, disability coverage',
    risk_crop: 'Crop Loss',
    risk_crop_desc: 'Hailstorm, unseasonal rain, localized flood, pest attack',
    risk_life: 'Family Life Cover',
    risk_life_desc: 'Pure term life security for surviving family members',
    rec_age_label: 'Your Age (Years)',
    rec_budget_label: 'Annual Budget Preference',
    budget_free: 'Free / Govt Schemes Only',
    budget_500: 'Under ₹500/year',
    budget_1000: 'Under ₹1,000/year',
    bank_account_label: 'I have an active Savings Bank or Post Office Account (Jan Dhan / Any Bank)',
    btn_find_cover: '🔍 Find Best Cover',
    results_title: 'Top Matching Schemes For You',
    results_subtitle: 'Scored deterministically based on your age, risk priority, occupation, and budget.',
    btn_select_and_claim: 'File Claim with This Scheme →',

    // View 2: File a Claim
    claim_tag: 'Pre-Validation & Audit',
    claim_title: '2. File a Claim',
    claim_desc: 'Upload hospital bills, prescriptions, or crop damage photos. Our Gemini AI audits your documents instantly against policy rules to catch rejections before submission.',
    claim_heading: 'Pre-Claim Audit & Fix-It Checklist',
    claim_subheading: 'Instant document OCR extraction, deterministic policy guardrails, and actionable one-click correction before formal submission.',

    // View 3: Insurer Queue
    insurer_tag: 'Officer Triage Portal',
    insurer_title: '3. Insurer Queue',
    insurer_desc: 'Review pre-audited claim packages, inspection scorecards, and approve legitimate claims with one click.',
    insurer_heading: 'Triage Dashboard & Decision Desk',
    insurer_subheading: 'Real-time queue metrics, verified OCR dossiers, printable A4 audit reports, and instant decision dispatch.',
    metric_total_submissions: 'Total Submissions',
    metric_pre_validated_ready: 'Pre-Validated Ready',
    metric_needs_manual_review: 'Needs Manual Review',
    metric_rejections_prevented: 'Rejections Prevented',
    filter_all: 'All',
    filter_ready_to_approve: 'Ready to Approve',
    filter_needs_review: 'Needs Review',
    filter_approved: 'Approved',

    // Wizard Step Labels (1–4)
    step_1_label: '1. Policy & Incident',
    step_2_label: '2. Scan Proof',
    step_3_label: '3. Verify & Fix',
    step_4_label: '4. Submit Packet',

    // Form Helper Prompts & Labels
    label_claimant_name: 'Claimant Full Name',
    label_claimant_age: 'Claimant Age',
    label_policy_select: 'Select Applicable Policy Scheme',
    label_incident_date: 'Date of Bill / Incident',
    label_incident_subtype: 'Incident Subtype (e.g. road accident, snakebite, illness, hailstorm)',
    label_primary_doc: 'Primary Proof Type',
    label_dropzone_title: 'Drop bill or damage photo here, or click to browse',
    label_dropzone_hint: 'Supports JPG, PNG, WebP up to 10MB. Cleared for blurry images.',

    // Action Buttons
    btn_next: 'Next Step →',
    btn_back: '← Back',
    btn_revalidate: 'Re-Check Rules',
    btn_submit_claim: 'Submit Claim to Insurer',
    btn_use_policy_claim: 'Use This Policy to File a Claim',
    btn_download_report: 'Download Printable Dossier (A4)',
    btn_download_json: 'Download Claim JSON',
    btn_approve: 'Approve Claim',
    btn_request_info: 'Request More Info',
    btn_reject: 'Reject Claim',
    btn_use_sample: 'Load Demo Sample',
    btn_scan_and_check: 'Scan & Check Policy Eligibility →',
    btn_retry_analysis: '🔄 Retry Policy Audit',

    // Multi-Stage Underwriting Loading HUD
    loading_engine_badge: 'Underwriting & Guardrails Engine',
    loading_hud_title: 'Scanning & Checking Policy Eligibility',
    loading_stage_1_title: '1. Checking photo clarity & handwriting...',
    loading_stage_2_title: '2. Extracting amounts, dates & items via AI Vision...',
    loading_stage_3_title: '3. Cross-checking against official policy limits & exclusions...',

    // Status Badges & Readiness
    status_ready_to_submit: 'Ready to Submit (Pass)',
    status_needs_fixes: 'Needs Fixes (Blockers Detected)',
    status_not_covered: 'Not Covered (Ineligible)',
    badge_pass: 'PASS',
    badge_warning: 'WARNING',
    badge_fail: 'FAIL',
    badge_pending: 'PENDING',
    badge_approved: 'APPROVED',
    badge_rejected: 'REJECTED',
    badge_info_requested: 'INFO REQUESTED',

    // Notifications
    msg_lang_switched: 'Language switched to English',
    msg_claim_submitted: 'Claim submitted successfully!',
    msg_revalidated: 'Claim re-validated live against policy rules.',
  },

  hi: {
    // Brand & Top Header
    brand_name: 'सुरक्षासेतु',
    brand_tagline: 'माइक्रो-इंश्योरेंस सहायक • क्लेम ऑडिट और सही बीमा चयन',
    lang_toggle: 'हिंदी / EN',
    status_online: 'सक्रिय (ऑनलाइन)',
    status_fallback: 'डेमो फॉलबैक सक्रिय',
    status_degraded: 'सीमित कनेक्टिविटी',

    // 3-Step Promise Intro Strip
    promise_badge: 'त्वरित प्री-ऑडिट',
    promise_step_1: 'बिल स्कैन करें',
    promise_step_2: 'पॉलिसी नियम जांचें',
    promise_step_3: 'सत्यापित दावा जमा करें',

    // Desktop Tabs
    tab_recommend: 'सही बीमा चुनें',
    tab_claim: 'क्लेम दर्ज करें',
    tab_insurer: 'बीमाकर्ता कतार',

    // Mobile Bottom Nav
    mobile_nav_recommend: 'बीमा',
    mobile_nav_claim: 'क्लेम',
    mobile_nav_insurer: 'कतार',

    // View 1: Find Right Cover
    recommend_tag: 'सुरक्षा योजना चयन',
    recommend_title: '1. सही बीमा चुनें',
    recommend_desc: 'अपनी आयु, व्यवसाय और पारिवारिक बजट के अनुसार भारत सरकार और माइक्रो-इंश्योरेंस योजनाओं (PMSBY, PMJJBY, PMFBY, आयुष्मान भारत) की पात्रता जानें।',
    recommend_heading: 'स्मार्ट बीमा योजना अनुशंसा प्रणाली',
    recommend_subheading: 'कुछ आसान सवालों के जवाब देकर अपनी पात्रता, सरकारी लाभ और सटीक प्रीमियम दरें जानें।',
    rec_occ_label: '1. अपना व्यवसाय / आजीविका चुनें',
    occ_gig: 'गिग / डिलीवरी वर्कर',
    occ_gig_desc: 'ज़ोमैटो, स्विगी, ज़ेप्टो, ब्लिंकिट, उबर, ओला, कूरियर डिलीवरी',
    occ_farmer: 'किसान / ग्रामीण परिवार',
    occ_farmer_desc: 'किसान, छोटे व सीमांत कृषक, बटाईदार',
    occ_daily_wage: 'दैनिक वेतनभोगी / दुकानदार',
    occ_daily_wage_desc: 'कारीगर, निर्माण श्रमिक, फुटकर विक्रेता, घरेलू कामगार',
    occ_senior: 'वरिष्ठ नागरिक (70+ वर्ष)',
    occ_senior_desc: 'वृद्ध नागरिक, पेंशनभोगी, वरिष्ठ अभिभावक',
    rec_risk_label: '2. अपनी मुख्य सुरक्षा प्राथमिकता चुनें',
    risk_health: 'अस्पताल व क्लीनिक खर्च',
    risk_health_desc: 'डेकेयर ओपीडी, डॉक्टर परामर्श, दवाइयां व अस्पताल भर्ती',
    risk_accident: 'दुर्घटना व दिव्यांगता',
    risk_accident_desc: 'सड़क दुर्घटना, आकस्मिक चोट, स्थायी दिव्यांगता सुरक्षा',
    risk_crop: 'फसल क्षति सुरक्षा',
    risk_crop_desc: 'ओलावृष्टि, बेमौसम बारिश, बाढ़ व कीट प्रकोप से नुकसान',
    risk_life: 'परिवार जीवन सुरक्षा',
    risk_life_desc: 'असमय मृत्यु की स्थिति में परिवार को एकमुश्त वित्तीय सुरक्षा',
    rec_age_label: 'आपकी आयु (वर्ष)',
    rec_budget_label: 'वार्षिक बजट प्राथमिकता',
    budget_free: 'निःशुल्क / केवल सरकारी योजनाएं',
    budget_500: '₹500/वर्ष से कम',
    budget_1000: '₹1,000/वर्ष से कम',
    bank_account_label: 'मेरे पास सक्रिय बचत बैंक या डाकघर खाता है (जनधन / कोई भी बैंक)',
    btn_find_cover: '🔍 सर्वश्रेष्ठ बीमा खोजें',
    results_title: 'आपके लिए सर्वोत्तम बीमा योजनाएं',
    results_subtitle: 'आपकी आयु, प्राथमिकता, कार्य और बजट के आधार पर स्वचालित रूप से मूल्यांकित।',
    btn_select_and_claim: 'इस योजना के तहत क्लेम दर्ज करें →',

    // View 2: File a Claim
    claim_tag: 'प्री-वैलिडेशन व ऑडिट',
    claim_title: '2. क्लेम दर्ज करें',
    claim_desc: 'अस्पताल का बिल, डॉक्टर का पर्चा या फसल नुकसान की फोटो अपलोड करें। हमारा AI नियम जांचकर खारिज होने वाले कारणों को पहले ही सुधारवाता है।',
    claim_heading: 'प्री-क्लेम ऑडिट और त्वरित समाधान सूची',
    claim_subheading: 'तुरंत दस्तावेज़ स्कैनिंग, कठोर नियम सत्यापन और आवेदन जमा करने से पहले एक-क्लिक सुधार।',

    // View 3: Insurer Queue
    insurer_tag: 'अधिकारी समीक्षा पोर्टल',
    insurer_title: '3. बीमाकर्ता कतार',
    insurer_desc: 'पहले से जांची गई क्लेम फाइलों की समीक्षा करें और वैध दावों को तुरंत एक क्लिक में स्वीकृत करें।',
    insurer_heading: 'समीक्षा डैशबोर्ड एवं निर्णय पटल',
    insurer_subheading: 'रीयल-टाइम कतार आंकड़े, सत्यापित OCR दस्तावेज़, प्रिंट योग्य A4 रिपोर्ट और त्वरित भुगतान निर्णय।',
    metric_total_submissions: 'कुल सबमिशन',
    metric_pre_validated_ready: 'पूर्व-सत्यापित तैयार',
    metric_needs_manual_review: 'मैनुअल समीक्षा आवश्यक',
    metric_rejections_prevented: 'खारिज होने से बचाए गए',
    filter_all: 'सभी',
    filter_ready_to_approve: 'स्वीकृति योग्य',
    filter_needs_review: 'समीक्षा आवश्यक',
    filter_approved: 'स्वीकृत',

    // Wizard Step Labels (1–4)
    step_1_label: '1. बीमा व घटना (Policy & Incident)',
    step_2_label: '2. बिल/फोटो स्कैन (Scan Proof)',
    step_3_label: '3. नियम जांचें व सुधारें (Verify & Fix)',
    step_4_label: '4. दावा जमा करें (Submit Packet)',

    // Form Helper Prompts & Labels
    label_claimant_name: 'दावेदार का पूरा नाम',
    label_claimant_age: 'दावेदार की आयु',
    label_policy_select: 'लागू बीमा योजना चुनें',
    label_incident_date: 'बिल / घटना की तारीख',
    label_incident_subtype: 'घटना का प्रकार (उदा. सड़क दुर्घटना, सर्पदंश, बीमारी, ओलावृष्टि)',
    label_primary_doc: 'मुख्य दस्तावेज़ का प्रकार',
    label_dropzone_title: 'बिल या फसल नुकसान की फोटो यहां खींचकर छोड़ें या चुनें',
    label_dropzone_hint: 'JPG, PNG, WebP प्रारूप (10MB तक)। धुंधली फोटो की स्वतः जांच।',

    // Action Buttons
    btn_next: 'अगला कदम →',
    btn_back: '← पीछे जाएं',
    btn_revalidate: 'नियम पुनः जांचें',
    btn_submit_claim: 'बीमा कंपनी को दावा जमा करें',
    btn_use_policy_claim: 'इस योजना से क्लेम दर्ज करें',
    btn_download_report: 'प्रिंट योग्य रिपोर्ट (A4) डाउनलोड करें',
    btn_download_json: 'क्लेम JSON डाउनलोड करें',
    btn_approve: 'दावा स्वीकृत करें',
    btn_request_info: 'अतिरिक्त जानकारी मांगें',
    btn_reject: 'दावा अस्वीकृत करें',
    btn_use_sample: 'डेमो सैंपल लोड करें',
    btn_scan_and_check: 'दस्तावेज स्कैन करें और पात्रता जांचें →',
    btn_retry_analysis: '🔄 पुनः प्रयास करें (रीट्राय)',

    // Multi-Stage Underwriting Loading HUD
    loading_engine_badge: 'अंडरराइटिंग व पॉलिसी सुरक्षा गार्डरेल्स',
    loading_hud_title: 'दस्तावेज स्कैन और पॉलिसी पात्रता जांच',
    loading_stage_1_title: '1. फोटो स्पष्टता और लिखावट की जांच...',
    loading_stage_2_title: '2. AI विजन द्वारा राशि, तिथियां और मदों का निष्कर्षण...',
    loading_stage_3_title: '3. आधिकारिक पॉलिसी सीमा व अपवादों से मिलान...',

    // Status Badges & Readiness
    status_ready_to_submit: 'जमा करने के लिए तैयार (सफल)',
    status_needs_fixes: 'सुधार आवश्यक (रुकावटें पाई गईं)',
    status_not_covered: 'कवर में शामिल नहीं (अपात्र)',
    badge_pass: 'पास (मान्य)',
    badge_warning: 'चेतावनी',
    badge_fail: 'विफल (अमान्य)',
    badge_pending: 'समीक्षा लंबित',
    badge_approved: 'स्वीकृत',
    badge_rejected: 'अस्वीकृत',
    badge_info_requested: 'जानकारी प्रतीक्षित',

    // Notifications
    msg_lang_switched: 'भाषा हिंदी में बदल दी गई है',
    msg_claim_submitted: 'दावा सफलतापूर्वक जमा हो गया!',
    msg_revalidated: 'पॉलिसी नियमों के अनुसार दावे की पुनः जांच पूर्ण हुई।',
  },
};

/**
 * Get translated text by key for a specific or current language
 * @param {string} key
 * @param {'en' | 'hi'} [lang]
 * @returns {string}
 */
export function t(key, lang = state.language) {
  const currentLang = lang === 'hi' ? 'hi' : 'en';
  const dict = translations[currentLang] || translations.en;
  return dict[key] || translations.en[key] || key;
}

/**
 * Update all DOM elements with data-i18n attributes in the active document
 * @param {'en' | 'hi'} [lang]
 */
export function applyTranslations(lang = state.language) {
  const currentLang = lang === 'hi' ? 'hi' : 'en';
  const dict = translations[currentLang] || translations.en;

  // 1. Text elements
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key && dict[key] !== undefined) {
      el.textContent = dict[key];
    }
  });

  // 2. HTML elements (with bold or formatted spans)
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    if (key && dict[key] !== undefined) {
      el.innerHTML = dict[key];
    }
  });

  // 3. Placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key && dict[key] !== undefined) {
      el.setAttribute('placeholder', dict[key]);
    }
  });

  // 4. Titles / aria-labels
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key && dict[key] !== undefined) {
      el.setAttribute('title', dict[key]);
    }
  });

  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    if (key && dict[key] !== undefined) {
      el.setAttribute('aria-label', dict[key]);
    }
  });

  // 5. Update html lang attribute
  if (document.documentElement) {
    document.documentElement.lang = currentLang;
  }

  // 6. Update font-family for Hindi Devanagari if needed
  if (document.body) {
    if (currentLang === 'hi') {
      document.body.classList.add('lang-hi');
    } else {
      document.body.classList.remove('lang-hi');
    }
  }
}

/**
 * Initialize internationalization engine and subscribe to reactive state changes
 */
export function initI18n() {
  // Apply initial translations
  applyTranslations(state.language);

  // Subscribe to state language changes
  subscribe((currentState, changedKey) => {
    if (changedKey === 'language') {
      applyTranslations(currentState.language);
    }
  });
}
