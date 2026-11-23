from models import DamagePhotoAnalysis, ExtractedBillData
from services.ocr_service import analyze_damage_photo, extract_medical_bill


def test_extract_medical_bill_sample():
    """Verify: Passing a phone photo of a handwritten clinic bill returns valid ExtractedBillData JSON."""
    with open("samples/sample_clinic_bill.jpg", "rb") as f:
        image_bytes = f.read()

    result = extract_medical_bill(image_bytes, mime_type="image/jpeg")

    assert isinstance(result, ExtractedBillData)
    assert result.provider_name is not None
    assert result.patient_or_claimant_name is not None
    assert result.total_amount_inr == 1750.0
    assert result.has_stamp_or_signature is True
    assert result.legibility_score >= 0.8
    assert len(result.itemized_charges) >= 3

    amounts = [item.amount_inr for item in result.itemized_charges]
    assert 300.0 in amounts
    assert 450.0 in amounts
    assert sum(amounts) == result.total_amount_inr


def test_analyze_crop_damage_photo():
    """Verify: Uploading a crop field damage image populates damage_assessment with severity and category match status."""
    with open("samples/sample_crop_damage.jpg", "rb") as f:
        crop_bytes = f.read()

    analysis = analyze_damage_photo(crop_bytes, mime_type="image/jpeg", claim_category="crop")

    assert isinstance(analysis, DamagePhotoAnalysis)
    assert analysis.matches_claim_category is True
    assert analysis.severity in ("low", "moderate", "severe", "unclear")
    assert analysis.damage_assessment is not None
    assert analysis.damage_assessment.severity == analysis.severity
    assert analysis.damage_assessment.category_match is True
    assert analysis.damage_assessment.calamity_type is not None
    assert len(analysis.visual_summary) > 20


def test_catch_wrong_upload():
    """Verify: Selfie uploaded under crop category is flagged as mismatched."""
    with open("samples/sample_selfie_wrong_upload.jpg", "rb") as f:
        selfie_bytes = f.read()

    analysis = analyze_damage_photo(selfie_bytes, mime_type="image/jpeg", claim_category="crop")
    assert analysis.matches_claim_category is False
    assert analysis.mismatch_reason is not None
    assert analysis.damage_assessment.category_match is False
