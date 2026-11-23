import io
import os
from PIL import Image
from services.upload_service import process_image_bytes, HTTPException


def test_upload_valid_jpeg_and_resize():
    """Verify: uploading valid JPEG returns a resized file URL and downscales >1600px."""
    buf = io.BytesIO()
    img = Image.new("RGB", (2000, 1500), color=(180, 180, 180))
    img.save(buf, format="JPEG")

    result = process_image_bytes(buf.getvalue(), original_filename="photo.jpg")
    assert result["success"] is True
    assert result["is_resized"] is True
    assert result["width"] == 1600
    assert result["height"] == 1200
    assert result["file_url"].startswith("/uploads/")
    assert os.path.exists(result["file_path"])


def test_reject_non_image_with_http_400():
    """Verify: non-image files are rejected with HTTP 400."""
    try:
        process_image_bytes(b"This is a raw text file masquerading as an image.")
        assert False, "Should have raised HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "Invalid or corrupt image" in str(exc.detail)


def test_quality_checks():
    """Verify: images < 400px or extremely dark produce quality warnings."""
    # 1. Narrow image
    buf_narrow = io.BytesIO()
    img_narrow = Image.new("RGB", (250, 250), color=(120, 120, 120))
    img_narrow.save(buf_narrow, format="PNG")
    res_narrow = process_image_bytes(buf_narrow.getvalue())
    assert res_narrow["image_quality_warning"] is not None
    assert "narrow" in res_narrow["image_quality_warning"].lower()

    # 2. Dark image
    buf_dark = io.BytesIO()
    img_dark = Image.new("RGB", (600, 600), color=(5, 5, 5))
    img_dark.save(buf_dark, format="JPEG")
    res_dark = process_image_bytes(buf_dark.getvalue())
    assert res_dark["image_quality_warning"] is not None
    assert "dark" in res_dark["image_quality_warning"].lower()
