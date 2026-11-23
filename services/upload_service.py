"""Service for processing and validating multipart claim document uploads."""

import io
import logging
import os
import uuid
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from PIL import Image, ImageOps, ImageStat, UnidentifiedImageError

try:
    from fastapi import HTTPException, UploadFile, status
except ImportError:
    class HTTPException(Exception):  # type: ignore
        def __init__(self, status_code: int, detail: Any):
            self.status_code = status_code
            self.detail = detail
            super().__init__(str(detail))

    class UploadFile:  # type: ignore
        filename: str = ""
        content_type: str = ""
        async def read(self) -> bytes: return b""

    class status:  # type: ignore
        HTTP_400_BAD_REQUEST = 400
        HTTP_413_REQUEST_ENTITY_TOO_LARGE = 413

logger = logging.getLogger("surakshasetu.upload_service")

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB limit
MAX_LONGEST_EDGE = 1600  # Max dimension for fast OCR
MIN_RESOLUTION_WIDTH = 400  # Flag if narrower than this
ALLOWED_FORMATS = {"JPEG", "JPG", "PNG", "WEBP"}


def analyze_image_quality(img: Image.Image) -> Tuple[Optional[str], Dict[str, float]]:
    """
    Performs lightweight sharpness/contrast and resolution checks.
    Flags images < 400px wide or extremely dark / low-contrast documents.
    """
    width, height = img.size
    warnings = []

    # 1. Resolution Check
    if width < MIN_RESOLUTION_WIDTH:
        warnings.append(
            f"Image is narrow ({width}px wide, recommended min 400px). Small text or stamps may fail OCR."
        )

    # 2. Luminosity & Contrast Check
    gray = img.convert("L")
    stat = ImageStat.Stat(gray)
    mean_brightness = stat.mean[0]
    contrast_stddev = stat.stddev[0]

    if mean_brightness < 35.0:
        warnings.append(
            f"Image appears very dark (brightness {mean_brightness:.1f}/255). Ensure text is clearly visible."
        )
    elif mean_brightness > 248.0:
        warnings.append(
            f"Image appears washed out/overexposed (brightness {mean_brightness:.1f}/255)."
        )

    if contrast_stddev < 18.0:
        warnings.append(
            f"Low contrast detected (std dev {contrast_stddev:.1f}). Text may blend into background."
        )

    warning_str = " | ".join(warnings) if warnings else None
    metrics = {
        "mean_brightness": round(mean_brightness, 1),
        "contrast_stddev": round(contrast_stddev, 1),
    }

    return warning_str, metrics


def process_image_bytes(
    file_bytes: Optional[bytes] = None,
    original_filename: Optional[str] = None,
    image_bytes: Optional[bytes] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """
    Validates image bytes, corrects EXIF orientation, downscales if >1600px,
    evaluates quality, and persists the cleaned file into uploads/.
    Accepts either file_bytes or image_bytes keyword argument.
    """
    data = file_bytes if file_bytes is not None else image_bytes
    if data is None:
        data = b""
    file_bytes = data

    if len(file_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of 10 MB ({len(file_bytes)/(1024*1024):.2f} MB provided).",
        )

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    try:
        raw_image = Image.open(io.BytesIO(file_bytes))
        raw_format = (raw_image.format or "").upper()
        if raw_format == "JPG":
            raw_format = "JPEG"
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or corrupt image file. Only JPG, PNG, and WEBP formats are accepted.",
        )

    if raw_format not in ALLOWED_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format '{raw_format}'. Supported formats are: JPG, PNG, WEBP.",
        )

    # 1. Auto-orient via EXIF transposition
    try:
        oriented_image = ImageOps.exif_transpose(raw_image)
        if oriented_image is not None:
            raw_image = oriented_image
    except Exception as e:
        logger.warning("Could not apply EXIF transposition: %s", e)

    # 2. Downscale oversized photos to max 1600px on the longest edge
    orig_w, orig_h = raw_image.size
    longest_edge = max(orig_w, orig_h)
    is_resized = False

    if longest_edge > MAX_LONGEST_EDGE:
        scale_factor = MAX_LONGEST_EDGE / float(longest_edge)
        new_w = max(1, int(round(orig_w * scale_factor)))
        new_h = max(1, int(round(orig_h * scale_factor)))
        raw_image = raw_image.resize((new_w, new_h), Image.Resampling.LANCZOS)
        is_resized = True
        logger.info("Downscaled image from %dx%d to %dx%d for OCR efficiency.", orig_w, orig_h, new_w, new_h)

    curr_w, curr_h = raw_image.size

    # 3. Quality & Sharpness Audit
    quality_warning, quality_metrics = analyze_image_quality(raw_image)

    # 4. Generate persistent UUID filename
    if raw_format == "PNG":
        ext = ".png"
        save_format = "PNG"
    elif raw_format == "WEBP":
        ext = ".webp"
        save_format = "WEBP"
    else:
        ext = ".jpg"
        save_format = "JPEG"

    unique_filename = f"{uuid.uuid4().hex}{ext}"
    saved_file_path = UPLOADS_DIR / unique_filename

    # Ensure RGB conversion for JPEG if image has alpha channel
    if save_format == "JPEG":
        if raw_image.mode in ("RGBA", "LA", "P"):
            rgb_canvas = Image.new("RGB", raw_image.size, (255, 255, 255))
            if raw_image.mode == "RGBA":
                rgb_canvas.paste(raw_image, mask=raw_image.split()[3])
            else:
                rgb_canvas.paste(raw_image.convert("RGB"))
            raw_image = rgb_canvas
        elif raw_image.mode != "RGB":
            raw_image = raw_image.convert("RGB")

    # Persist optimized file
    if save_format == "JPEG":
        raw_image.save(saved_file_path, format="JPEG", quality=88, optimize=True)
    elif save_format == "PNG":
        raw_image.save(saved_file_path, format="PNG", optimize=True)
    elif save_format == "WEBP":
        raw_image.save(saved_file_path, format="WEBP", quality=85)

    saved_size_bytes = saved_file_path.stat().st_size
    public_url = f"/uploads/{unique_filename}"

    logger.info("Saved verified image to %s (%d bytes)", public_url, saved_size_bytes)

    return {
        "success": True,
        "filename": unique_filename,
        "file_path": str(saved_file_path),
        "file_url": public_url,
        "url": public_url,
        "width": curr_w,
        "height": curr_h,
        "format": save_format,
        "size_bytes": saved_size_bytes,
        "is_resized": is_resized,
        "image_quality_warning": quality_warning,
        "quality_metrics": quality_metrics,
        "original_filename": original_filename or unique_filename,
    }


async def process_image_upload(upload_file: UploadFile) -> Dict[str, Any]:
    """Handles FastAPI UploadFile multipart request."""
    # Fast mime-type pre-check if provided
    content_type = (upload_file.content_type or "").lower()
    if content_type and not (
        content_type.startswith("image/")
        or "jpeg" in content_type
        or "png" in content_type
        or "webp" in content_type
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rejected content-type '{content_type}'. Only JPG, PNG, and WEBP image files are allowed.",
        )

    file_bytes = await upload_file.read()
    return process_image_bytes(file_bytes, original_filename=upload_file.filename)
