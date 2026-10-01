from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent / "dist"
for size in (192, 512):
    image = Image.new("RGB", (size, size), "#123348")
    draw = ImageDraw.Draw(image)
    pad = size // 7
    draw.rounded_rectangle((pad, pad, size - pad, size - pad), radius=size // 6, fill="#71e0bc")
    width = max(8, size // 24)
    x0, y0 = int(size * .33), int(size * .68)
    x1, y1 = int(size * .68), int(size * .33)
    draw.line((x0, y0, x1, y1), fill="#123348", width=width)
    draw.line((int(size * .47), y1, x1, y1), fill="#123348", width=width)
    draw.line((x1, y1, x1, int(size * .53)), fill="#123348", width=width)
    image.save(ROOT / f"icon-{size}.png")
