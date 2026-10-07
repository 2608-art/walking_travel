"""Download and resize individually licensed Wikimedia Commons place photos."""

from io import BytesIO
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "photos"
FILES = {
    "hwangseong-forest": "Hwangseong Forest.jpg",
    "dori-village": "Dori Village, Gyeonju.jpg",
    "igyeondae": "Igyeondae.jpg",
    "hyanggyo": "Gyeongju Hyanggyo 1.jpg",
    "oreung": "Oreung.jpg",
    "solgeo": "Solgeo Art Museum, Gyeongju on December 25th, 2018.jpg",
    "silla-great-bell": "Silla Great Bell 2.jpg",
    "yakgwa-example": "Yakgwa.jpg",
    "bookstore-example": "Bookstore shelves.jpg",
    "sundubu-example": "Sundubu jjigae stew.jpg",
    "galbisal-example": "Korean BBQ-Galbisal-01.jpg",
}


def main():
    for slug, filename in FILES.items():
        if (OUT / f"gyeongju-{slug}.jpg").exists():
            continue
        title = "File:" + filename
        query = urlencode({
            "action": "query", "titles": title, "prop": "imageinfo",
            "iiprop": "url|extmetadata", "iiurlwidth": "1200", "format": "json",
        })
        req = Request("https://commons.wikimedia.org/w/api.php?" + query,
                      headers={"User-Agent": "HangeoreumResearch/1.0 (portfolio photo audit)"})
        data = json.load(urlopen(req, timeout=25))
        page = next(iter(data["query"]["pages"].values()))
        if "imageinfo" not in page:
            print(f"MISSING {title}")
            continue
        info = page["imageinfo"][0]
        license_name = info.get("extmetadata", {}).get("LicenseShortName", {}).get("value", "")
        if not any(x in license_name for x in ("CC BY", "CC0", "Public domain")):
            print(f"LICENSE UNCLEAR {title}: {license_name}")
            continue
        url = info.get("thumburl", info["url"])
        raw = urlopen(Request(url, headers={"User-Agent": "HangeoreumResearch/1.0"}), timeout=40).read()
        image = Image.open(BytesIO(raw)).convert("RGB")
        image.thumbnail((1200, 900), Image.Resampling.LANCZOS)
        target = OUT / f"gyeongju-{slug}.jpg"
        image.save(target, "JPEG", quality=82, optimize=True)
        print(f"OK {title} -> {target.name} {image.size} {license_name}")


if __name__ == "__main__":
    main()
