"""Dossier reporting service generating self-contained printable A4 HTML packets for claims."""

from datetime import datetime
import hashlib
import html
from typing import Any, Dict, List, Union

from models import ClaimRecord


def _hash_audit_seal(claim_id: str, claimant_name: str, policy_id: str, timestamp_str: str) -> str:
    """Computes a deterministic cryptographic audit seal for the claim dossier."""
    raw = f"{claim_id}|{claimant_name}|{policy_id}|{timestamp_str}|SURAKSHA_SETU_AUDIT_V1"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest().upper()


def _format_currency(amount: Union[float, int, None]) -> str:
    """Formats an INR currency amount."""
    if amount is None:
        return "₹0.00"
    return f"₹{amount:,.2f}"


def _get_status_badge(status: str) -> tuple[str, str, str]:
    """Returns (background_color, text_color, border_color) for a review or rule status."""
    st = (status or "").upper()
    if st in ("PASS", "READY_TO_APPROVE", "APPROVED"):
        return "#ecfdf5", "#065f46", "#a7f3d0"  # emerald
    elif st in ("WARNING", "NEEDS_REVIEW", "INFO_REQUESTED"):
        return "#fffbeb", "#92400e", "#fde68a"  # amber
    elif st in ("FAIL", "REJECTED"):
        return "#fef2f2", "#991b1b", "#fecaca"  # red
    return "#f1f5f9", "#334155", "#cbd5e1"  # slate


def generate_claim_html_report(claim_data: Union[ClaimRecord, Dict[str, Any]]) -> str:
    """
    Renders a self-contained, high-fidelity printable HTML claim dossier.
    Includes A4 print media queries, embedded thumbnails, itemized charges,
    rule compliance matrix, and a formal pre-validation declaration.
    """
    if isinstance(claim_data, ClaimRecord):
        data = claim_data.model_dump()
    else:
        data = dict(claim_data)

    claim_id = html.escape(str(data.get("claim_id", "UNKNOWN-CLAIM")))
    policy_id = html.escape(str(data.get("policy_id", "UNKNOWN-POLICY")))
    policy_name = html.escape(str(data.get("policy_name", "Micro-Insurance Scheme")))
    claimant_name = html.escape(str(data.get("claimant_name", "N/A")))
    claimant_phone = html.escape(str(data.get("claimant_phone") or "Not Provided"))
    aadhaar_last4 = html.escape(str(data.get("claimant_aadhaar_last4") or "XXXX"))
    bank_account = html.escape(str(data.get("bank_account_number") or "N/A"))
    bank_ifsc = html.escape(str(data.get("bank_ifsc") or "N/A"))
    reviewer_status = str(data.get("reviewer_status", "NEEDS_REVIEW")).upper()
    reviewer_notes = html.escape(str(data.get("reviewer_notes") or "Verified against policy parameters."))

    claimed_amount = data.get("claimed_amount_inr", 0.0)
    approved_amount = data.get("approved_amount_inr", claimed_amount)
    disallowed_amount = max(0.0, (claimed_amount or 0.0) - (approved_amount or 0.0))

    created_at_raw = data.get("created_at")
    if isinstance(created_at_raw, datetime):
        created_at_str = created_at_raw.strftime("%Y-%m-%d %H:%M:%S UTC")
    else:
        created_at_str = str(created_at_raw or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"))

    audit_hash = _hash_audit_seal(claim_id, claimant_name, policy_id, created_at_str)

    # Status Badge Colors
    status_bg, status_color, status_border = _get_status_badge(reviewer_status)

    # Extracted data
    extracted = data.get("extracted_data") or {}
    provider_name = html.escape(str(extracted.get("provider_name") or "Medical Provider / Local Authority"))
    incident_date = html.escape(str(extracted.get("incident_or_bill_date") or "N/A"))
    diagnosis = html.escape(str(extracted.get("diagnosis_or_event") or "Routine Consultation / Covered Event"))
    has_stamp = extracted.get("has_stamp_or_signature", False)
    legibility = extracted.get("legibility_score")
    legibility_pct = f"{int(legibility * 100)}%" if legibility is not None else "Verified"

    # Itemized charges rows
    itemized_charges = extracted.get("itemized_charges") or []
    itemized_rows_html = ""
    if itemized_charges:
        for idx, item in enumerate(itemized_charges, 1):
            name = html.escape(str(item.get("item_name", f"Item #{idx}")))
            cat = html.escape(str(item.get("category", "General")).title())
            amt = item.get("amount_inr", 0.0)
            covered = item.get("is_covered", True)
            cov_badge = (
                '<span class="badge badge-pass">Covered</span>'
                if covered
                else '<span class="badge badge-fail">Disallowed (Exclusion)</span>'
            )
            itemized_rows_html += f"""
            <tr>
              <td class="text-center">{idx}</td>
              <td><strong>{name}</strong></td>
              <td><span class="category-tag">{cat}</span></td>
              <td class="text-right">{_format_currency(amt)}</td>
              <td class="text-center">{cov_badge}</td>
            </tr>
            """
    else:
        itemized_rows_html = f"""
        <tr>
          <td colspan="5" class="text-center text-muted" style="padding: 18px;">
            Primary lump-sum benefit or statutory sum insured assessment. Claimed: <strong>{_format_currency(claimed_amount)}</strong>
          </td>
        </tr>
        """

    # Rule checks rows
    rule_checks = data.get("rule_checks") or []
    rule_rows_html = ""
    for r in rule_checks:
        rid = html.escape(str(r.get("rule_id", "")))
        label = html.escape(str(r.get("label", rid)))
        rst = str(r.get("status", "PASS")).upper()
        exp = html.escape(str(r.get("explanation", "")))

        rbg, rcolor, rborder = _get_status_badge(rst)
        badge_icon = "✓ " if rst == "PASS" else ("⚠️ " if rst == "WARNING" else "✗ ")
        rule_rows_html += f"""
        <tr>
          <td><code class="rule-id">{rid}</code></td>
          <td><strong>{label}</strong></td>
          <td class="text-center">
            <span class="badge" style="background-color: {rbg}; color: {rcolor}; border: 1px solid {rborder};">
              {badge_icon}{rst}
            </span>
          </td>
          <td class="audit-explanation">{exp}</td>
        </tr>
        """

    if not rule_checks:
        rule_rows_html = """
        <tr><td colspan="4" class="text-center text-muted">No specific automated rule records found.</td></tr>
        """

    # Attached Evidence Thumbnails
    document_paths = data.get("document_paths") or []
    thumbnails_html = ""
    if document_paths:
        for idx, doc_path in enumerate(document_paths, 1):
            clean_path = html.escape(str(doc_path))
            filename = clean_path.split("/")[-1]
            is_image = any(clean_path.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp"])
            
            if is_image:
                preview_content = f"""
                <img src="{clean_path}" alt="{filename}" class="evidence-thumb-img"
                     onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'doc-fallback-icon\\'>📄</div><div class=\\'doc-fallback-label\\'>Image not accessible directly</div>';" />
                """
            else:
                preview_content = """
                <div class="doc-fallback-icon">📄</div>
                <div class="doc-fallback-label">Document Proof</div>
                """

            thumbnails_html += f"""
            <div class="evidence-card">
              <div class="evidence-img-container">
                {preview_content}
              </div>
              <div class="evidence-meta">
                <span class="evidence-title">Document #{idx}</span>
                <span class="evidence-filename" title="{filename}">{filename}</span>
                <a href="{clean_path}" target="_blank" class="evidence-link">Open Original &rarr;</a>
              </div>
            </div>
            """
    else:
        thumbnails_html = """
        <div class="no-evidence-notice">
          <p>No external evidentiary image attachments stored with this claim package.</p>
        </div>
        """

    stamp_html = (
        '<span class="stamp-verified">✓ Verified Clinic Stamp / Signature</span>'
        if has_stamp
        else '<span class="stamp-unverified">⚠️ Stamp/Signature Verification Pending</span>'
    )

    now_year = datetime.now().year

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claim Dossier - {claim_id} | SurakshaSetu</title>
  <style>
    /* =====================================================================
       Base Typography & Screen Layout
       ===================================================================== */
    :root {{
      --primary: #1e3a8a;
      --primary-light: #eff6ff;
      --accent: #2563eb;
      --text-main: #0f172a;
      --text-muted: #475569;
      --border: #e2e8f0;
      --card-bg: #ffffff;
      --page-bg: #f8fafc;
    }}

    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}

    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--page-bg);
      color: var(--text-main);
      font-size: 13px;
      line-height: 1.5;
      padding-bottom: 60px;
    }}

    /* Floating Action Bar (hidden on print) */
    .action-bar {{
      position: sticky;
      top: 0;
      z-index: 100;
      background: #0f172a;
      color: #fff;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }}

    .action-bar-title {{
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    }}

    .action-bar-buttons {{
      display: flex;
      gap: 10px;
    }}

    .btn {{
      padding: 7px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      transition: background 0.15s ease;
    }}

    .btn-print {{
      background: #2563eb;
      color: #ffffff;
    }}
    .btn-print:hover {{ background: #1d4ed8; }}

    .btn-json {{
      background: #334155;
      color: #e2e8f0;
    }}
    .btn-json:hover {{ background: #475569; }}

    .btn-back {{
      background: transparent;
      color: #94a3b8;
      border: 1px solid #475569;
    }}
    .btn-back:hover {{ background: #1e293b; color: #fff; }}

    /* Dossier Container */
    .dossier-wrapper {{
      max-width: 860px;
      margin: 24px auto;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
      overflow: hidden;
      padding: 32px 36px;
    }}

    /* Dossier Header */
    .dossier-header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }}

    .org-branding {{
      display: flex;
      align-items: center;
      gap: 14px;
    }}

    .org-logo-badge {{
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #1e3a8a, #3b82f6);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 24px;
      font-weight: 800;
      box-shadow: 0 2px 6px rgba(37,99,235,0.3);
    }}

    .org-title h1 {{
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.3px;
    }}

    .org-title p {{
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.8px;
      margin-top: 2px;
    }}

    .header-ref-box {{
      text-align: right;
    }}

    .ref-id {{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 20px;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: 0.5px;
    }}

    .header-meta {{
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
    }}

    .status-pill {{
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.3px;
      margin-top: 6px;
    }}

    /* Section Styles */
    .section-title {{
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #1e3a8a;
      border-left: 3px solid #2563eb;
      padding-left: 8px;
      margin: 22px 0 12px 0;
    }}

    /* Info Grid */
    .info-grid {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }}

    .info-card {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
    }}

    .info-label {{
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 4px;
    }}

    .info-value {{
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      word-break: break-word;
    }}

    .payout-card {{
      background: #eff6ff;
      border-color: #bfdbfe;
    }}

    .payout-value {{
      font-size: 17px;
      font-weight: 800;
      color: #1d4ed8;
    }}

    /* Tables */
    table.data-table {{
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }}

    table.data-table th {{
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      text-align: left;
    }}

    table.data-table td {{
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }}

    table.data-table tr:last-child td {{
      border-bottom: none;
    }}

    table.data-table tr:hover {{
      background-color: #f8fafc;
    }}

    .text-center {{ text-align: center; }}
    .text-right {{ text-align: right; }}
    .text-muted {{ color: #64748b; }}

    .badge {{
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
    }}

    .badge-pass {{
      background-color: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }}

    .badge-fail {{
      background-color: #fef2f2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }}

    .category-tag {{
      background: #e2e8f0;
      color: #334155;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
    }}

    .rule-id {{
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 11px;
      color: #1e3a8a;
      background: #eff6ff;
      padding: 2px 5px;
      border-radius: 3px;
    }}

    .audit-explanation {{
      font-size: 11.5px;
      color: #334155;
    }}

    /* Evidence Previews */
    .evidence-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }}

    .evidence-card {{
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
      background: #f8fafc;
      transition: transform 0.1s ease, box-shadow 0.1s ease;
    }}

    .evidence-img-container {{
      width: 100%;
      height: 120px;
      background: #e2e8f0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }}

    .evidence-thumb-img {{
      width: 100%;
      height: 100%;
      object-fit: cover;
    }}

    .doc-fallback-icon {{
      font-size: 32px;
      margin-bottom: 4px;
    }}

    .doc-fallback-label {{
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
    }}

    .evidence-meta {{
      padding: 8px 10px;
    }}

    .evidence-title {{
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      display: block;
    }}

    .evidence-filename {{
      font-size: 11px;
      font-weight: 600;
      color: #0f172a;
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }}

    .evidence-link {{
      font-size: 10px;
      color: #2563eb;
      text-decoration: none;
      font-weight: 600;
      display: inline-block;
      margin-top: 4px;
    }}

    .no-evidence-notice {{
      padding: 16px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      color: #64748b;
      text-align: center;
      font-size: 12px;
    }}

    .stamp-verified {{
      color: #059669;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }}

    .stamp-unverified {{
      color: #d97706;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }}

    /* Pre-validation Declaration Certificate Box */
    .declaration-certificate {{
      background: #fafaf9;
      border: 2px solid #d6d3d1;
      border-radius: 8px;
      padding: 20px;
      margin-top: 28px;
      position: relative;
    }}

    .declaration-header {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      border-bottom: 1px dashed #d6d3d1;
      padding-bottom: 8px;
    }}

    .declaration-title {{
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #44403c;
    }}

    .declaration-badge {{
      font-size: 10px;
      font-weight: 700;
      background: #292524;
      color: #fff;
      padding: 3px 8px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }}

    .declaration-body {{
      font-size: 11.5px;
      color: #44403c;
      line-height: 1.6;
      margin-bottom: 14px;
    }}

    .declaration-signatures {{
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 16px;
      align-items: flex-end;
      padding-top: 10px;
      border-top: 1px dashed #d6d3d1;
    }}

    .audit-seal-hash {{
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 9.5px;
      color: #78716c;
      word-break: break-all;
    }}

    .audit-seal-title {{
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #44403c;
      margin-bottom: 2px;
    }}

    .stamp-signoff {{
      border: 2px solid #15803d;
      color: #15803d;
      border-radius: 6px;
      padding: 6px 12px;
      text-align: center;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      transform: rotate(-1deg);
    }}

    /* =====================================================================
       Crisp A4 Print Stylesheet
       ===================================================================== */
    @media print {{
      @page {{
        size: A4 portrait;
        margin: 12mm 15mm 15mm 15mm;
      }}

      body {{
        background: #ffffff !important;
        font-size: 11pt !important;
        color: #000000 !important;
        padding-bottom: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }}

      .action-bar,
      .no-print {{
        display: none !important;
      }}

      .dossier-wrapper {{
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        box-shadow: none !important;
      }}

      .dossier-header {{
        border-bottom: 2pt solid #000000 !important;
      }}

      .info-card {{
        border: 1pt solid #cbd5e1 !important;
        background: #f8fafc !important;
      }}

      table.data-table {{
        border: 1pt solid #cbd5e1 !important;
      }}

      table.data-table th {{
        background: #f1f5f9 !important;
        color: #000 !important;
        border-bottom: 1pt solid #cbd5e1 !important;
      }}

      table.data-table td {{
        border-bottom: 0.5pt solid #e2e8f0 !important;
      }}

      .evidence-card {{
        border: 1pt solid #cbd5e1 !important;
        break-inside: avoid;
        page-break-inside: avoid;
      }}

      .declaration-certificate {{
        border: 1.5pt solid #78716c !important;
        background: #fafaf9 !important;
        break-inside: avoid;
        page-break-inside: avoid;
      }}

      .avoid-break {{
        break-inside: avoid;
        page-break-inside: avoid;
      }}
    }}
  </style>
</head>
<body>

  <!-- Floating Sticky Action Bar for Web Viewing -->
  <header class="action-bar no-print">
    <div class="action-bar-title">
      <span>🛡️ SurakshaSetu Claims Gateway</span>
      <span style="opacity: 0.4;">|</span>
      <span>Dossier: {claim_id}</span>
    </div>
    <div class="action-bar-buttons">
      <a href="/" class="btn btn-back">&larr; Return to Portal</a>
      <a href="/api/claims/{claim_id}/json" class="btn btn-json" download="{claim_id}.json">📥 Download Machine JSON</a>
      <button onclick="window.print()" class="btn btn-print">🖨️ Print Claim Dossier (A4)</button>
    </div>
  </header>

  <!-- Printable A4 Dossier Document -->
  <main class="dossier-wrapper">

    <!-- Document Header -->
    <header class="dossier-header">
      <div class="org-branding">
        <div class="org-logo-badge">SS</div>
        <div class="org-title">
          <h1>SURAKSHA SETU DOSSIER</h1>
          <p>National Micro-Insurance Pre-Validation &amp; Claim Settlement Gateway</p>
        </div>
      </div>
      <div class="header-ref-box">
        <div class="ref-id">{claim_id}</div>
        <div class="header-meta">Logged: {created_at_str}</div>
        <span class="status-pill" style="background-color: {status_bg}; color: {status_color}; border: 1px solid {status_border};">
          ● {reviewer_status.replace('_', ' ')}
        </span>
      </div>
    </header>

    <!-- Overview Grid -->
    <section>
      <h2 class="section-title">1. Claim &amp; Policy Snapshot</h2>
      <div class="info-grid">
        <div class="info-card">
          <div class="info-label">Scheme &amp; Policy</div>
          <div class="info-value">{policy_name}</div>
          <div class="info-label" style="margin-top: 6px;">Scheme Code</div>
          <div class="info-value"><code>{policy_id}</code></div>
        </div>
        <div class="info-card">
          <div class="info-label">Claimant Name</div>
          <div class="info-value">{claimant_name}</div>
          <div class="info-label" style="margin-top: 6px;">Contact Mobile</div>
          <div class="info-value">{claimant_phone}</div>
        </div>
        <div class="info-card payout-card">
          <div class="info-label">Eligible Payout (INR)</div>
          <div class="payout-value">{_format_currency(approved_amount)}</div>
          <div class="info-label" style="margin-top: 6px;">Total Claimed</div>
          <div class="info-value">{_format_currency(claimed_amount)}</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-card">
          <div class="info-label">Aadhaar (Last 4)</div>
          <div class="info-value">XXXX-XXXX-{aadhaar_last4}</div>
        </div>
        <div class="info-card">
          <div class="info-label">DBT Settlement Account</div>
          <div class="info-value">{bank_account}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Bank Branch IFSC</div>
          <div class="info-value">{bank_ifsc}</div>
        </div>
      </div>
    </section>

    <!-- Clinical / Incident Verification -->
    <section>
      <h2 class="section-title">2. Incident &amp; Treatment Assessment</h2>
      <div class="info-grid">
        <div class="info-card">
          <div class="info-label">Medical Provider / Authority</div>
          <div class="info-value">{provider_name}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Incident / Consultation Date</div>
          <div class="info-value">{incident_date}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Authenticity &amp; Legibility</div>
          <div class="info-value">{stamp_html}</div>
          <div class="header-meta" style="margin-top: 3px;">OCR Confidence: {legibility_pct}</div>
        </div>
      </div>
      <div class="info-card" style="margin-bottom: 20px;">
        <div class="info-label">Clinical Diagnosis / Event Summary</div>
        <div class="info-value" style="font-weight: 500;">{diagnosis}</div>
        <div class="info-label" style="margin-top: 8px;">Reviewer Adjudication Notes</div>
        <div class="info-value" style="font-weight: 500; color: #334155;">{reviewer_notes}</div>
      </div>
    </section>

    <!-- Itemized Verified Expenses -->
    <section class="avoid-break">
      <h2 class="section-title">3. Itemized Verified Charges</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th class="text-center" style="width: 40px;">#</th>
            <th>Item / Service Description</th>
            <th style="width: 120px;">Category</th>
            <th class="text-right" style="width: 120px;">Amount</th>
            <th class="text-center" style="width: 140px;">Underwriting Status</th>
          </tr>
        </thead>
        <tbody>
          {itemized_rows_html}
        </tbody>
        <tfoot>
          <tr style="background: #f8fafc; font-weight: 700;">
            <td colspan="3" class="text-right" style="padding: 10px 12px;">Total Claimed Amount:</td>
            <td class="text-right" style="padding: 10px 12px;">{_format_currency(claimed_amount)}</td>
            <td></td>
          </tr>
          <tr style="background: #eff6ff; font-weight: 800; color: #1e3a8a;">
            <td colspan="3" class="text-right" style="padding: 10px 12px;">Net Verified Payout (After Cap &amp; Exclusions):</td>
            <td class="text-right" style="padding: 10px 12px; font-size: 14px;">{_format_currency(approved_amount)}</td>
            <td class="text-center" style="font-size: 11px; color: #059669;">PAYABLE</td>
          </tr>
        </tfoot>
      </table>
    </section>

    <!-- Policy Compliance Audit Matrix -->
    <section class="avoid-break">
      <h2 class="section-title">4. Policy Compliance &amp; Rule Audit Table</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 150px;">Rule Identifier</th>
            <th style="width: 180px;">Verification Check</th>
            <th class="text-center" style="width: 100px;">Audit Status</th>
            <th>Automated Underwriting Finding</th>
          </tr>
        </thead>
        <tbody>
          {rule_rows_html}
        </tbody>
      </table>
    </section>

    <!-- Attached Evidentiary Documents Previews -->
    <section class="avoid-break">
      <h2 class="section-title">5. Attached Evidentiary Documents &amp; Proofs</h2>
      <div class="evidence-grid">
        {thumbnails_html}
      </div>
    </section>

    <!-- Formal Pre-Validation Declaration Certificate -->
    <section class="declaration-certificate avoid-break">
      <div class="declaration-header">
        <span class="declaration-title">Official Pre-Validation Declaration</span>
        <span class="declaration-badge">IRDAI MICRO-INSURANCE COMPLIANT</span>
      </div>
      <p class="declaration-body">
        This claim dossier has been algorithmically parsed, cross-referenced against statutory scheme limits
        (under Central Government &amp; IRDAI Micro-Insurance Underwriting Regulations), and verified against
        claimant identity proofs. All exclusions, waiting periods, and benefit caps have been deterministically audited.
        This electronic record serves as an authenticated pre-validated dossier for Direct Benefit Transfer (DBT) disbursement.
      </p>
      <div class="declaration-signatures">
        <div>
          <div class="audit-seal-title">Cryptographic Digital Audit Trail</div>
          <div class="audit-seal-hash">SHA256: {audit_hash}</div>
          <div class="header-meta" style="margin-top: 4px;">Certified at: {created_at_str} | Portal: SurakshaSetu Gateway</div>
        </div>
        <div>
          <div class="stamp-signoff">
            DIGITALLY SEALED<br/>
            <span style="font-size: 9px; font-weight: 600;">SURAKSHASETU AI ENGINE</span>
          </div>
        </div>
      </div>
    </section>

  </main>

</body>
</html>
"""
