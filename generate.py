import argparse
import hashlib
import json
import math
import random
from pathlib import Path
from typing import Dict, List, Tuple

from crystal_receipt.canonicalize import canonical_receipt_hash, load_receipt
from crystal_receipt.seeds import derive_seed_material
from crystal_receipt.traits import derive_visual_traits

WIDTH = 1200
HEIGHT = 1200
CENTER_X = WIDTH / 2
CENTER_Y = HEIGHT / 2
GENERATOR_VERSION = "0.2"
RULESET = "receipt-derived-v0.2"

PALETTES = {
    "oxide_rainbow": ["#f72585", "#7209b7", "#4361ee", "#4cc9f0", "#f1fa8c"],
    "blue_gold": ["#1d3557", "#457b9d", "#a8dadc", "#ffd166", "#ffb703"],
    "violet_green": ["#5a189a", "#7b2cbf", "#9d4edd", "#80ed99", "#57cc99"],
    "silver_rose": ["#f8f9fa", "#ced4da", "#adb5bd", "#ffcad4", "#f4acb7"],
}

HASH_MODE_PALETTES = [
    ["#61dafb", "#b388ff", "#ff79c6", "#f1fa8c", "#50fa7b"],
    ["#f72585", "#7209b7", "#3a0ca3", "#4361ee", "#4cc9f0"],
    ["#ffadad", "#ffd6a5", "#fdffb6", "#caffbf", "#9bf6ff"],
    ["#9d4edd", "#7b2cbf", "#5a189a", "#3c096c", "#240046"],
    ["#f8f9fa", "#dee2e6", "#adb5bd", "#6c757d", "#343a40"],
]


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# -----------------------------
# Existing hash-mode generator
# -----------------------------
def seed_from_hash(receipt_hash: str) -> Tuple[str, int]:
    digest = sha256_hex(receipt_hash)
    seed = int(digest[:16], 16)
    return digest, seed


def point_on_ring(radius: float, angle_deg: float) -> Tuple[float, float]:
    angle = math.radians(angle_deg)
    return CENTER_X + math.cos(angle) * radius, CENTER_Y + math.sin(angle) * radius


def polygon_points(radius: float, sides: int, rotation_deg: float, y_scale: float) -> List[Tuple[float, float]]:
    pts = []
    for i in range(sides):
        angle = rotation_deg + (360 / sides) * i
        x, y = point_on_ring(radius, angle)
        y = CENTER_Y + (y - CENTER_Y) * y_scale
        pts.append((round(x, 2), round(y, 2)))
    return pts


def points_to_svg(points: List[Tuple[float, float]]) -> str:
    return " ".join(f"{x},{y}" for x, y in points)


def generate_hash_mode_spec(receipt_hash: str) -> Dict:
    digest, seed = seed_from_hash(receipt_hash)
    rng = random.Random(seed)

    palette = HASH_MODE_PALETTES[int(digest[16:18], 16) % len(HASH_MODE_PALETTES)]
    sides = 6 + (int(digest[18:20], 16) % 3)
    layers = 7 + (int(digest[20:22], 16) % 6)
    rotation = int(digest[22:24], 16) % 360
    y_scale = 0.72 + ((int(digest[24:26], 16) % 18) / 100)
    inner_cut = 0.52 + ((int(digest[26:28], 16) % 20) / 100)

    layer_specs = []
    max_radius = 460
    min_radius = 110
    radius_step = (max_radius - min_radius) / max(layers - 1, 1)

    for i in range(layers):
        radius = max_radius - i * radius_step
        wobble = rng.uniform(-10, 10)
        layer_rotation = rotation + wobble + i * rng.uniform(4, 11)
        opacity = round(0.2 + (layers - i) / layers * 0.45, 3)
        stroke_width = round(1.5 + (i % 3) * 0.5, 2)
        color = palette[i % len(palette)]
        layer_specs.append(
            {
                "radius": round(radius, 2),
                "rotation": round(layer_rotation, 2),
                "opacity": opacity,
                "stroke_width": stroke_width,
                "color": color,
            }
        )

    return {
        "mode": "hash",
        "receiptHash": receipt_hash,
        "sha256": digest,
        "seed": seed,
        "width": WIDTH,
        "height": HEIGHT,
        "palette": palette,
        "sides": sides,
        "layers": layers,
        "rotation": rotation,
        "y_scale": round(y_scale, 3),
        "inner_cut": round(inner_cut, 3),
        "layer_specs": layer_specs,
    }


def render_hash_mode_svg(spec: Dict) -> str:
    defs = """
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#10131a" />
      <stop offset="100%" stop-color="#030507" />
    </radialGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
"""
    body = [f'<rect width="100%" height="100%" fill="url(#bg)" />']
    body.append('<g filter="url(#glow)">')

    for idx, layer in enumerate(spec["layer_specs"]):
        outer = polygon_points(layer["radius"], spec["sides"], layer["rotation"], spec["y_scale"])
        inner = polygon_points(layer["radius"] * spec["inner_cut"], spec["sides"], layer["rotation"] + 180 / spec["sides"], spec["y_scale"])
        body.append(
            f'<polygon points="{points_to_svg(outer)}" fill="{layer["color"]}" fill-opacity="{layer["opacity"]}" '
            f'stroke="#ffffff" stroke-opacity="0.18" stroke-width="{layer["stroke_width"]}" />'
        )
        body.append(
            f'<polygon points="{points_to_svg(inner)}" fill="#02060a" fill-opacity="{round(layer["opacity"] * 0.45, 3)}" '
            f'stroke="{layer["color"]}" stroke-opacity="0.35" stroke-width="1" />'
        )
        if idx < len(spec["layer_specs"]) - 1:
            ridge_a = outer[idx % len(outer)]
            ridge_b = inner[(idx + 1) % len(inner)]
            body.append(
                f'<line x1="{ridge_a[0]}" y1="{ridge_a[1]}" x2="{ridge_b[0]}" y2="{ridge_b[1]}" '
                f'stroke="{layer["color"]}" stroke-opacity="0.35" stroke-width="1.2" />'
            )

    body.append("</g>")
    body.append(
        f'<text x="{CENTER_X}" y="1140" text-anchor="middle" fill="#b7c0cc" '
        f'font-family="monospace" font-size="20">seed:{spec["seed"]}</text>'
    )

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">\n'
        + defs
        + "\n".join(f"  {line}" for line in body)
        + "\n</svg>\n"
    )


# -----------------------------
# Receipt-derived generator
# -----------------------------
def _receipt_summary(receipt: Dict) -> Dict:
    return {
        "session_id": receipt.get("session_id"),
        "agent_id": receipt.get("agent_id"),
        "receiptHash": receipt.get("receiptHash"),
        "diffHash": receipt.get("diffHash"),
        "eventRoot": receipt.get("eventRoot"),
        "timestamp": receipt.get("timestamp"),
        "changed_files": receipt.get("changed_files", []),
    }


def _rect(x: float, y: float, w: float, h: float) -> str:
    return f"M {x:.2f} {y:.2f} H {x+w:.2f} V {y+h:.2f} H {x:.2f} Z"


def _hopper_paths(layer_count: int, shard_count: int, symmetry: str, edge_bias: float) -> List[Dict[str, float]]:
    paths = []
    steps = max(layer_count, 1)
    symmetry_factor = {"low": 0.72, "medium": 0.86, "high": 1.0}[symmetry]
    cx = CENTER_X
    cy = CENTER_Y - 10
    base_w = 620 * symmetry_factor
    base_h = 620 * symmetry_factor
    inset_w = (base_w * 0.58) / max(steps, 1)
    inset_h = (base_h * 0.58) / max(steps, 1)

    for i in range(steps):
        w = base_w - i * inset_w
        h = base_h - i * inset_h
        x = cx - w / 2
        y = cy - h / 2
        paths.append({"x": x, "y": y, "w": w, "h": h})

    shard_cols = max(2, round(math.sqrt(shard_count) * 0.9))
    shard_rows = max(2, math.ceil(shard_count / shard_cols))
    grid_w = base_w * 0.82
    grid_h = base_h * 0.82
    cell_w = grid_w / shard_cols
    cell_h = grid_h / shard_rows
    start_x = cx - grid_w / 2
    start_y = cy - grid_h / 2
    offset_scale = edge_bias * 10

    for idx in range(shard_count):
        col = idx % shard_cols
        row = idx // shard_cols
        if row >= shard_rows:
            break
        bias_x = (col - shard_cols / 2) * offset_scale * 0.15
        bias_y = (row - shard_rows / 2) * offset_scale * 0.15
        paths.append(
            {
                "x": start_x + col * cell_w + 6 + bias_x,
                "y": start_y + row * cell_h + 6 + bias_y,
                "w": max(10, cell_w - 12 - edge_bias * 6),
                "h": max(10, cell_h - 12 - edge_bias * 6),
            }
        )
    return paths


def render_receipt_mode_svg(metadata: Dict) -> str:
    traits = metadata["visual_traits"]
    derived_seeds = metadata["derived_seeds"]
    palette = PALETTES[traits["palette_name"]]
    defs = f"""
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090b10" />
      <stop offset="100%" stop-color="#151922" />
    </linearGradient>
    <linearGradient id="oxide" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{palette[0]}" stop-opacity="{0.35 + traits['oxide_intensity'] * 0.3:.4f}" />
      <stop offset="35%" stop-color="{palette[1]}" stop-opacity="{0.45 + traits['oxide_intensity'] * 0.2:.4f}" />
      <stop offset="70%" stop-color="{palette[2]}" stop-opacity="{0.55 + traits['oxide_intensity'] * 0.15:.4f}" />
      <stop offset="100%" stop-color="{palette[3]}" stop-opacity="{0.7 + traits['oxide_intensity'] * 0.1:.4f}" />
    </linearGradient>
    <filter id="softGlow">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
"""
    body = [f'<rect width="100%" height="100%" fill="url(#bg)" />']
    body.append('<g filter="url(#softGlow)">')

    hopper = _hopper_paths(traits["layer_count"], traits["shard_count"], traits["symmetry"], traits["edge_bias"])
    layer_paths = hopper[: traits["layer_count"]]
    shard_paths = hopper[traits["layer_count"] :]

    stroke_base = 1.4 + traits["edge_bias"] * 2.2
    for idx, rect in enumerate(layer_paths):
        color = palette[idx % len(palette)]
        opacity = round(0.2 + ((traits["layer_count"] - idx) / max(traits["layer_count"], 1)) * (0.35 + traits["oxide_intensity"] * 0.2), 4)
        body.append(
            f'<path d="{_rect(rect["x"], rect["y"], rect["w"], rect["h"])}" fill="none" '
            f'stroke="{color}" stroke-width="{stroke_base + (idx % 2) * 0.6:.2f}" stroke-opacity="{opacity}" />'
        )
        inset = max(8, 18 - idx)
        inner_w = max(24, rect["w"] - inset * 2)
        inner_h = max(24, rect["h"] - inset * 2)
        body.append(
            f'<path d="{_rect(rect["x"] + inset, rect["y"] + inset, inner_w, inner_h)}" fill="rgba(0,0,0,0)" '
            f'stroke="{palette[(idx + 1) % len(palette)]}" stroke-width="1.1" stroke-opacity="{max(0.15, opacity - 0.08):.4f}" />'
        )

    for idx, rect in enumerate(shard_paths):
        color = palette[(idx + 2) % len(palette)]
        fill_opacity = round(0.08 + traits["oxide_intensity"] * 0.25, 4)
        body.append(
            f'<path d="{_rect(rect["x"], rect["y"], rect["w"], rect["h"])}" fill="{color}" fill-opacity="{fill_opacity}" '
            f'stroke="#f8f9fa" stroke-opacity="0.10" stroke-width="0.8" />'
        )

    if traits["rarity"] in {"rare", "mythic"}:
        radius = 260 if traits["rarity"] == "rare" else 320
        accent = palette[-1]
        body.append(
            f'<circle cx="{CENTER_X:.2f}" cy="{CENTER_Y:.2f}" r="{radius:.2f}" fill="none" '
            f'stroke="{accent}" stroke-opacity="0.25" stroke-dasharray="10 12" stroke-width="2.4" />'
        )

    body.append('</g>')
    body.append(
        f'<text x="{CENTER_X}" y="1134" text-anchor="middle" fill="#c7d0dc" font-family="monospace" font-size="18">'
        f'{metadata["canonical_receipt_hash"][:22]}…</text>'
    )
    body.append(
        f'<text x="{CENTER_X}" y="1162" text-anchor="middle" fill="#7d8896" font-family="monospace" font-size="14">'
        f'{traits["geometry_style"]} / {traits["palette_name"]} / {traits["rarity"]}</text>'
    )

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">\n'
        + defs
        + "\n".join(f"  {line}" for line in body)
        + "\n</svg>\n"
    )


def generate_receipt_mode_metadata(receipt_path: Path) -> Dict:
    receipt = load_receipt(str(receipt_path))
    canonical_hash = canonical_receipt_hash(receipt)
    seed_material = derive_seed_material(canonical_hash)
    visual_traits = derive_visual_traits(seed_material)
    return {
        "mode": "receipt",
        "generator_version": GENERATOR_VERSION,
        "ruleset": RULESET,
        "source_receipt": {
            "path": str(receipt_path).replace('\\', '/'),
            **_receipt_summary(receipt),
        },
        "canonical_receipt_hash": canonical_hash,
        "derived_seeds": seed_material,
        "visual_traits": visual_traits,
        "artifact_file": "crystal.svg",
        "boundary": "The crystal is a visual artifact derived from receipt evidence. It is not the security verifier.",
        "width": WIDTH,
        "height": HEIGHT,
    }


def write_hash_outputs(receipt_hash: str, out_dir: Path) -> Dict:
    spec = generate_hash_mode_spec(receipt_hash)
    svg = render_hash_mode_svg(spec)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "crystal.svg").write_text(svg, encoding="utf-8")
    (out_dir / "crystal.metadata.json").write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")
    return spec


def write_receipt_outputs(receipt_path: Path, out_dir: Path) -> Dict:
    metadata = generate_receipt_mode_metadata(receipt_path)
    svg = render_receipt_mode_svg(metadata)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "crystal.svg").write_text(svg, encoding="utf-8")
    (out_dir / "crystal.metadata.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a deterministic crystal receipt fingerprint.")
    parser.add_argument("--hash", dest="receipt_hash", help="Receipt hash string")
    parser.add_argument("--receipt", dest="receipt_path", help="Path to receipt JSON")
    parser.add_argument("--out", required=True, help="Output directory")
    args = parser.parse_args()

    if bool(args.receipt_hash) == bool(args.receipt_path):
        parser.error("Provide exactly one of --hash or --receipt")

    out_dir = Path(args.out)
    if args.receipt_hash:
        spec = write_hash_outputs(args.receipt_hash, out_dir)
        print(json.dumps({"ok": True, "mode": "hash", "out": args.out, "seed": spec["seed"], "sha256": spec["sha256"]}, indent=2))
    else:
        metadata = write_receipt_outputs(Path(args.receipt_path), out_dir)
        print(
            json.dumps(
                {
                    "ok": True,
                    "mode": "receipt",
                    "out": args.out,
                    "canonical_receipt_hash": metadata["canonical_receipt_hash"],
                    "master_seed": metadata["derived_seeds"]["master_seed"],
                },
                indent=2,
            )
        )


if __name__ == "__main__":
    main()
