"""Build a nonshipping commander portrait comparison board.

The board reads the current and an earlier committed artpack without altering
either one, then places them beside the latest matching local study render.

Usage:
    python artgen/commander_sweep.py
"""

import argparse
import base64
import io
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PREFLIGHT_DIR = ROOT / "artgen" / "preflight"
DEFAULT_IDS = ("vanta", "seraph", "sevra", "rake")
DEFAULT_LEGACY = "e3b8d9992d9f092d1d77eeeff4f430c19469f38e"
TILE = 360
MARGIN = 28
GAP = 20
TITLE_HEIGHT = 92
LABEL_HEIGHT = 42


def artpack_at(revision):
    if revision == "HEAD":
        source = (ROOT / "js" / "artpack.js").read_text(encoding="utf-8")
    else:
        result = subprocess.run(
            ["git", "show", f"{revision}:js/artpack.js"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode:
            raise RuntimeError(result.stderr.strip() or f"could not read {revision}:js/artpack.js")
        source = result.stdout
    marker = "const ARTPACK = "
    start = source.find(marker)
    if start < 0:
        raise RuntimeError(f"ARTPACK object not found in {revision}")
    # The pack continues with ARTVID and other JavaScript declarations. Decode
    # exactly one object rather than assuming ARTPACK reaches end of file.
    object_start = start + len(marker)
    try:
        artpack, _ = json.JSONDecoder().raw_decode(source[object_start:])
    except json.JSONDecodeError as error:
        raise RuntimeError(f"invalid ARTPACK object in {revision}: {error}") from error
    return artpack


def image_from_uri(uri):
    if not uri.startswith("data:image/") or ";base64," not in uri:
        raise ValueError("artpack entry is not a base64 image URI")
    encoded = uri.split(",", 1)[1]
    with Image.open(io.BytesIO(base64.b64decode(encoded))) as image:
        return image.convert("RGB")


def latest_study(commander_id, study):
    stem = f"cmd_{commander_id}_{study.replace('-', '_')}_"
    matches = sorted(PREFLIGHT_DIR.glob(f"{stem}*.png"), key=lambda path: path.stat().st_mtime)
    if not matches:
        raise RuntimeError(f"no local {study} study found for cmd_{commander_id}")
    return matches[-1]


def fitted(image):
    tile = Image.new("RGB", (TILE, TILE), "#0a0e17")
    contained = ImageOps.contain(image, (TILE, TILE), method=Image.Resampling.LANCZOS)
    offset = ((TILE - contained.width) // 2, (TILE - contained.height) // 2)
    tile.paste(contained, offset)
    return tile


def font(size):
    for path in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ):
        if Path(path).is_file():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def draw_centered(draw, box, text, font_value, fill):
    left, top, right, bottom = box
    draw.text(
        ((left + right) // 2, (top + bottom) // 2),
        text,
        font=font_value,
        fill=fill,
        anchor="mm",
        align="center",
    )


def main():
    parser = argparse.ArgumentParser(description="Build a local commander before-and-after review board")
    parser.add_argument("--ids", default=",".join(DEFAULT_IDS), help="comma-separated commander ids")
    parser.add_argument("--study", default="oil-water-abstract", help="study name from comfy_krea.py")
    parser.add_argument("--legacy", default=DEFAULT_LEGACY, help="earlier artpack revision")
    parser.add_argument(
        "--output",
        type=Path,
        default=PREFLIGHT_DIR / "commander_sweep_oil_water_abstract.png",
        help="ignored nonshipping comparison PNG",
    )
    args = parser.parse_args()
    ids = tuple(part.strip() for part in args.ids.split(",") if part.strip())
    if not ids:
        parser.error("at least one commander id is required")

    current = artpack_at("HEAD")
    legacy = artpack_at(args.legacy)
    width = MARGIN * 2 + TILE * 3 + GAP * 2
    height = TITLE_HEIGHT + MARGIN + len(ids) * (LABEL_HEIGHT + TILE + GAP)
    board = Image.new("RGB", (width, height), "#060912")
    draw = ImageDraw.Draw(board)
    title_font = font(28)
    header_font = font(15)
    row_font = font(18)

    draw_centered(
        draw,
        (MARGIN, 0, width - MARGIN, TITLE_HEIGHT // 2),
        "COMMANDER SWEEP: OIL-AND-WATER ILLUSTRATIVE STUDY",
        title_font,
        "#e2e8f0",
    )
    column_labels = (
        "BEFORE\nCURRENT SHIPPING",
        f"BEFORE\nEARLIER SHIPPING {args.legacy[:7]}",
        "AFTER\nLOCAL LORE STUDY",
    )
    for index, label in enumerate(column_labels):
        left = MARGIN + index * (TILE + GAP)
        draw_centered(draw, (left, TITLE_HEIGHT // 2, left + TILE, TITLE_HEIGHT), label, header_font, "#94a3b8")

    sources = []
    for row, commander_id in enumerate(ids):
        key = f"cmd_{commander_id}"
        if key not in current or key not in legacy:
            raise RuntimeError(f"missing {key} in current or legacy artpack")
        study_path = latest_study(commander_id, args.study)
        with Image.open(study_path) as study_image:
            images = (
                image_from_uri(current[key]),
                image_from_uri(legacy[key]),
                study_image.convert("RGB"),
            )
        top = TITLE_HEIGHT + MARGIN + row * (LABEL_HEIGHT + TILE + GAP)
        draw.text((MARGIN, top + 10), commander_id.upper(), font=row_font, fill="#e2e8f0")
        for column, image in enumerate(images):
            left = MARGIN + column * (TILE + GAP)
            board.paste(fitted(image), (left, top + LABEL_HEIGHT))
        sources.append({"key": key, "study": str(study_path)})

    args.output.parent.mkdir(parents=True, exist_ok=True)
    board.save(args.output, format="PNG", optimize=True)
    manifest = args.output.with_suffix(".json")
    manifest.write_text(
        json.dumps(
            {
                "shipping_status": "nonshipping",
                "purpose": "commander portrait comparison board",
                "current_artpack": "HEAD",
                "legacy_artpack": args.legacy,
                "study": args.study,
                "sources": sources,
                "output": str(args.output),
            },
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {args.output}")
    print(f"wrote {manifest}")


if __name__ == "__main__":
    main()
