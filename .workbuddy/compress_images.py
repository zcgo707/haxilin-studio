"""Compress blog images: resize to max 1280px wide and re-encode as WebP at quality 82."""
from PIL import Image
from pathlib import Path
import os

ASSETS_DIR = Path(r"D:\ai\haxilin\src\assets")
MAX_WIDTH = 1280
QUALITY = 82

results = []

for img_file in sorted(ASSETS_DIR.glob("*.webp")):
    img = Image.open(img_file)
    orig_size = img_file.stat().st_size
    orig_dims = img.size

    # Resize if wider than MAX_WIDTH
    if img.width > MAX_WIDTH:
        new_height = round(img.height * MAX_WIDTH / img.width)
        img = img.resize((MAX_WIDTH, new_height), Image.LANCZOS)

    # Save as WebP with compression
    tmp_path = img_file.with_suffix(".webp.tmp")
    img.save(tmp_path, "WEBP", quality=QUALITY, method=6)

    new_size = tmp_path.stat().st_size
    tmp_path.replace(img_file)

    reduction = (1 - new_size / orig_size) * 100
    results.append(
        f"{img_file.name}: {orig_dims[0]}x{orig_dims[1]} {orig_size/1024:.0f}KB "
        f"-> {img.width}x{img.height} {new_size/1024:.0f}KB ({reduction:.0f}% smaller)"
    )

for r in results:
    print(r)
