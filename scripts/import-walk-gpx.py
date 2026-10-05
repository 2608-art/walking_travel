"""Turn a supplied GPX walking track into a draft for human route review.

The draft is never written into public/walk-paths.json automatically.
"""

import argparse
import json
import math
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent.parent
PLACES = ROOT / "public" / "places.json"
MAX_BYTES = 4_000_000
MAX_POINTS = 5000


def distance_m(a, b):
    lat1, lon1 = map(math.radians, (a[1], a[0]))
    lat2, lon2 = map(math.radians, (b[1], b[0]))
    dy, dx = lat2 - lat1, lon2 - lon1
    value = math.sin(dy / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dx / 2) ** 2
    return 12_742_000 * math.asin(min(1, math.sqrt(value)))


def gpx_points(file):
    if file.stat().st_size > MAX_BYTES:
        raise ValueError("GPX file is too large")
    root = ET.parse(file).getroot()
    def local(tag):
        return tag.rsplit("}", 1)[-1]
    tracks = [e for e in root.iter() if local(e.tag) == "trkseg"]
    if tracks:
        if len(tracks) != 1:
            raise ValueError("GPX must contain exactly one continuous track segment")
        nodes = [e for e in tracks[0] if local(e.tag) == "trkpt"]
    else:
        routes = [e for e in root.iter() if local(e.tag) == "rte"]
        if len(routes) != 1:
            raise ValueError("GPX must contain one route or one track segment")
        nodes = [e for e in routes[0] if local(e.tag) == "rtept"]
    if not 2 <= len(nodes) <= MAX_POINTS:
        raise ValueError("GPX needs 2 to 5000 points")
    points = []
    for node in nodes:
        lon, lat = float(node.attrib["lon"]), float(node.attrib["lat"])
        if not math.isfinite(lon) or not math.isfinite(lat) or not (124 <= lon <= 132 and 33 <= lat <= 39):
            raise ValueError("GPX contains an invalid or non-Korean coordinate")
        points.append([lon, lat])
    return points


def positive(value):
    result = float(value)
    if not math.isfinite(result) or result <= 0:
        raise argparse.ArgumentTypeError("must be a positive finite number")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gpx", required=True, type=Path)
    parser.add_argument("--from", dest="from_id", required=True)
    parser.add_argument("--to", dest="to_id", required=True)
    parser.add_argument("--source-label", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--meters", required=True, type=positive, help="Reviewed map distance, not calculated from GPX")
    parser.add_argument("--minutes", required=True, type=positive, help="Reviewed map duration, not calculated from GPX")
    parser.add_argument("--variant-id", default="gpx-1")
    parser.add_argument("--variant-label", default="도보 경로")
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    if args.from_id == args.to_id:
        parser.error("start and end IDs must differ")
    if not args.source_label.strip() or not args.variant_id.strip() or not args.variant_label.strip():
        parser.error("labels and variant ID must not be blank")
    parsed = urlparse(args.source_url)
    if parsed.scheme != "https" or not parsed.netloc:
        parser.error("source URL must be HTTPS")
    places = {p["id"]: p for p in json.loads(PLACES.read_text(encoding="utf-8"))["places"]}
    places["station"] = {"id": "station", "lat": 34.7914, "lon": 126.3859}
    endpoints = []
    for place_id in (args.from_id, args.to_id):
        place = places.get(place_id)
        if not place or not isinstance(place.get("lat"), (int, float)) or not isinstance(place.get("lon"), (int, float)):
            parser.error(f"unknown or ungeocoded place: {place_id}")
        endpoints.append({"id": place_id, "lat": place["lat"], "lon": place["lon"]})
    try:
        points = gpx_points(args.gpx)
    except (OSError, ET.ParseError, KeyError, ValueError) as exc:
        parser.error(f"cannot read GPX: {exc}")
    for name, point, endpoint in (("start", points[0], endpoints[0]), ("end", points[-1], endpoints[1])):
        gap = distance_m(point, [endpoint["lon"], endpoint["lat"]])
        if gap > 50:
            parser.error(f"GPX {name} is {gap:.0f} m from the registered place; check the entrance and direction")
    length = sum(distance_m(a, b) for a, b in zip(points, points[1:]))
    draft = {
        "reviewStatus": "needs-review",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "reviewNotes": ["Confirm entrances, direction, route access and measured distance/time before publishing."],
        "gpxLengthMeters": round(length),
        "catalogEntry": {
            "from": endpoints[0], "to": endpoints[1],
            "source": {"label": args.source_label.strip(), "url": args.source_url},
            "variants": [{"id": args.variant_id.strip(), "label": args.variant_label.strip(),
                          "meters": args.meters, "minutes": args.minutes, "points": points}],
        },
    }
    if args.out.resolve() == (ROOT / "public" / "walk-paths.json").resolve():
        parser.error("write a review draft, not the public path catalog")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    if args.out.exists():
        parser.error("output already exists; choose a new draft path")
    args.out.write_text(json.dumps(draft, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Draft saved: {args.out} ({len(points)} GPX points, ~{length:.0f} m geometry)")


if __name__ == "__main__":
    main()
