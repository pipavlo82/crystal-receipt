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


def short_hash(value: str, length: int = 12) -> str:
    return value[:length]


def ellipsize_hash(value: str, head: int = 10, tail: int = 6) -> str:
    if len(value) <= head + tail:
        return value
    return f"{value[:head]}...{value[-tail:]}"


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


def _action_growth_map(receipt: Dict) -> Dict:
    scope = receipt.get("scope")
    authority = receipt.get("authority")
    verifier_result = receipt.get("verifier_result")
    signature_trust_block = receipt.get("signature_trust_block")

    return {
        "session_id": {
            "source": receipt.get("session_id"),
            "visual_effect": "base_orientation",
        },
        "agent_id": {
            "source": receipt.get("agent_id"),
            "visual_effect": "core_geometry_bias",
        },
        "receiptHash": {
            "source": receipt.get("receiptHash"),
            "visual_effect": "primary_crystal_identity",
        },
        "eventRoot": {
            "source": receipt.get("eventRoot"),
            "visual_effect": "global_growth_structure",
        },
        "diffHash": {
            "source": receipt.get("diffHash"),
            "visual_effect": "fracture_step_pattern",
        },
        "changed_files": {
            "source": receipt.get("changed_files", []),
            "visual_effect": "terrace_branch_count",
        },
        "scope": {
            "source": scope,
            "visual_effect": "outer_boundary",
        },
        "authority": {
            "source": authority,
            "visual_effect": "boundary_strength",
        },
        "verifier_result": {
            "source": verifier_result,
            "visual_effect": "seal_clarity_glow",
        },
        "signature_trust_block": {
            "source": signature_trust_block,
            "visual_effect": "trust_ring_edge_accent",
        },
        "timestamp": {
            "source": receipt.get("timestamp"),
            "visual_effect": "layer_rhythm",
        },
    }


def _hopper_rectangles(layer_count: int, shard_count: int, symmetry: str, edge_bias: float, geometry_style: str) -> Tuple[List[Dict[str, float]], List[Dict[str, float]]]:
    terraces: List[Dict[str, float]] = []
    shards: List[Dict[str, float]] = []

    symmetry_factor = {"low": 0.76, "medium": 0.88, "high": 1.0}[symmetry]
    geometry_scale = {
        "hopper": 1.0,
        "radial": 0.9,
        "stepped": 0.96,
        "fractured": 0.86,
    }[geometry_style]

    cx = CENTER_X
    cy = CENTER_Y - 14
    base_w = 640 * symmetry_factor * geometry_scale
    base_h = 640 * symmetry_factor * geometry_scale
    terrace_step = max(12.0, (42.0 - edge_bias * 10.0) * geometry_scale)
    notch_step = max(8.0, terrace_step * 0.6)

    for idx in range(layer_count):
        inset = idx * terrace_step
        w = max(120.0, base_w - inset * 2)
        h = max(120.0, base_h - inset * 2)
        x = cx - w / 2
        y = cy - h / 2
        terraces.append(
            {
                "x": x,
                "y": y,
                "w": w,
                "h": h,
                "notch": max(6.0, notch_step + (idx % 3) * 2.5),
            }
        )

    inner = terraces[min(max(layer_count // 3, 0), len(terraces) - 1)] if terraces else {"x": cx - 120, "y": cy - 120, "w": 240, "h": 240}
    shard_cols = max(2, round(math.sqrt(shard_count) * 0.72))
    shard_rows = max(2, math.ceil(shard_count / shard_cols))
    cell_w = inner["w"] / shard_cols
    cell_h = inner["h"] / shard_rows
    offset_push = edge_bias * 8.0

    for idx in range(shard_count):
        col = idx % shard_cols
        row = idx // shard_cols
        if row >= shard_rows:
            break
        if geometry_style == "radial":
            skip = (row + col) % 3 == 2
        elif geometry_style == "fractured":
            skip = (row * 2 + col) % 4 == 1
        elif geometry_style == "stepped":
            skip = col % 4 == 3 and row % 2 == 1
        else:
            skip = False
        if skip:
            continue

        step_offset = ((row - col) if geometry_style == "fractured" else (col - row)) * offset_push * 0.18
        x = inner["x"] + col * cell_w + 6 + max(0, step_offset)
        y = inner["y"] + row * cell_h + 6 + max(0, -step_offset)
        w = max(10.0, cell_w - 12 - edge_bias * 7)
        h = max(10.0, cell_h - 12 - edge_bias * 7)
        if geometry_style == "radial":
            x += abs(col - shard_cols / 2) * 2.5
            y += abs(row - shard_rows / 2) * 1.8
        elif geometry_style == "stepped":
            y += (row % 3) * 2.0
        elif geometry_style == "fractured":
            x += (idx % 3) * 3.0
            h = max(10.0, h - (idx % 2) * 4.0)

        shards.append({"x": x, "y": y, "w": w, "h": h})

    return terraces, shards


def render_receipt_mode_svg(metadata: Dict) -> str:
    traits = metadata["visual_traits"]
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

    terraces, shards = _hopper_rectangles(
        traits["layer_count"],
        traits["shard_count"],
        traits["symmetry"],
        traits["edge_bias"],
        traits["geometry_style"],
    )

    if terraces:
        outer = terraces[0]
        body.append(
            f'<rect x="{outer["x"]:.2f}" y="{outer["y"]:.2f}" width="{outer["w"]:.2f}" height="{outer["h"]:.2f}" '
            f'fill="url(#oxide)" fill-opacity="{0.16 + traits["oxide_intensity"] * 0.18:.4f}" stroke="none" />'
        )

    stroke_base = 1.4 + traits["edge_bias"] * 2.2
    for idx, rect in enumerate(terraces):
        color = palette[idx % len(palette)]
        opacity = round(0.2 + ((traits["layer_count"] - idx) / max(traits["layer_count"], 1)) * (0.35 + traits["oxide_intensity"] * 0.2), 4)
        body.append(
            f'<rect x="{rect["x"]:.2f}" y="{rect["y"]:.2f}" width="{rect["w"]:.2f}" height="{rect["h"]:.2f}" fill="none" '
            f'stroke="{color}" stroke-width="{stroke_base + (idx % 2) * 0.6:.2f}" stroke-opacity="{opacity}" />'
        )
        inset = max(8.0, min(rect["notch"], 18.0 - min(idx, 8)))
        inner_w = max(24.0, rect["w"] - inset * 2)
        inner_h = max(24.0, rect["h"] - inset * 2)
        body.append(
            f'<rect x="{rect["x"] + inset:.2f}" y="{rect["y"] + inset:.2f}" width="{inner_w:.2f}" height="{inner_h:.2f}" fill="none" '
            f'stroke="{palette[(idx + 1) % len(palette)]}" stroke-width="1.10" stroke-opacity="{max(0.15, opacity - 0.08):.4f}" />'
        )

    for idx, rect in enumerate(shards):
        color = palette[(idx + 2) % len(palette)]
        fill_opacity = round(0.08 + traits["oxide_intensity"] * 0.25, 4)
        body.append(
            f'<rect x="{rect["x"]:.2f}" y="{rect["y"]:.2f}" width="{rect["w"]:.2f}" height="{rect["h"]:.2f}" fill="{color}" fill-opacity="{fill_opacity}" '
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


def render_receipt_card_svg(metadata: Dict, crystal_svg_hash: str) -> str:
    source = metadata["source_receipt"]
    traits = metadata["visual_traits"]
    action_growth_map = metadata["action_growth_map"]
    verifier_result = action_growth_map["verifier_result"]["source"] or {}
    signature_block = action_growth_map["signature_trust_block"]["source"] or {}
    status = verifier_result.get("status", "UNKNOWN") if isinstance(verifier_result, dict) else str(verifier_result)
    session_label = source.get("session_id") or source.get("receiptHash") or "unknown-receipt"
    canonical_short = ellipsize_hash(metadata["canonical_receipt_hash"], 10, 6)
    artifact_short = ellipsize_hash(crystal_svg_hash, 10, 6)
    receipt_hash_short = ellipsize_hash(source.get("receiptHash") or "", 10, 6)
    diff_hash_short = ellipsize_hash(source.get("diffHash") or "", 10, 6)
    event_root_short = ellipsize_hash(source.get("eventRoot") or "", 10, 6)
    agent_label = source.get("agent_id") or "unknown-agent"
    changed_files = source.get("changed_files", [])
    changed_summary = ", ".join(changed_files[:2]) if changed_files else "none"
    if len(changed_files) > 2:
        changed_summary += f" +{len(changed_files) - 2} more"
    scope_label = action_growth_map["scope"]["source"] or {}
    authority_label = action_growth_map["authority"]["source"] or {}
    scope_summary = scope_label.get("permission", "unknown") if isinstance(scope_label, dict) else str(scope_label)
    authority_summary = authority_label.get("mode", "unknown") if isinstance(authority_label, dict) else str(authority_label)
    timestamp_label = source.get("timestamp") or "unknown"
    signature_summary = signature_block.get("algorithm", "unknown") if isinstance(signature_block, dict) else str(signature_block)
    visual_summary = f'{traits["geometry_style"]} / {traits["palette_name"]} / {traits["rarity"]}'
    action_summary = "changed_files→terraces · verifier_result→seal/glow · scope/authority→boundary · diff/eventRoot→growth pattern"

    crystal_mark_small = """
  <g transform="translate(800 250)">
    <rect x="-78" y="-78" width="156" height="156" fill="none" stroke="#67e8f9" stroke-width="4" opacity="0.9" />
    <rect x="-56" y="-56" width="112" height="112" fill="none" stroke="#a78bfa" stroke-width="3.2" opacity="0.95" />
    <rect x="-34" y="-34" width="68" height="68" fill="none" stroke="#f472b6" stroke-width="2.6" opacity="0.95" />
    <rect x="-16" y="-16" width="32" height="32" fill="#f8fafc" fill-opacity="0.15" stroke="#fef08a" stroke-width="2.2" />
    <rect x="-70" y="-8" width="26" height="18" fill="#67e8f9" fill-opacity="0.10" stroke="#67e8f9" stroke-width="1.6" />
    <rect x="44" y="-8" width="26" height="18" fill="#a78bfa" fill-opacity="0.10" stroke="#a78bfa" stroke-width="1.6" />
    <rect x="-8" y="44" width="18" height="26" fill="#86efac" fill-opacity="0.10" stroke="#86efac" stroke-width="1.6" />
    <rect x="-8" y="-70" width="18" height="26" fill="#f472b6" fill-opacity="0.10" stroke="#f472b6" stroke-width="1.6" />
  </g>
"""

    crystal_mark_large = """
  <g transform="translate(1175 590)">
    <rect x="-142" y="-142" width="284" height="284" fill="none" stroke="#67e8f9" stroke-width="5" opacity="0.95" />
    <rect x="-104" y="-104" width="208" height="208" fill="none" stroke="#a78bfa" stroke-width="4" opacity="0.95" />
    <rect x="-68" y="-68" width="136" height="136" fill="none" stroke="#f472b6" stroke-width="3.2" opacity="0.95" />
    <rect x="-30" y="-30" width="60" height="60" fill="#f8fafc" fill-opacity="0.12" stroke="#fef08a" stroke-width="2.6" />
    <rect x="-122" y="-12" width="46" height="26" fill="#67e8f9" fill-opacity="0.10" stroke="#67e8f9" stroke-width="2" />
    <rect x="76" y="-12" width="46" height="26" fill="#a78bfa" fill-opacity="0.10" stroke="#a78bfa" stroke-width="2" />
    <rect x="-12" y="76" width="26" height="46" fill="#86efac" fill-opacity="0.10" stroke="#86efac" stroke-width="2" />
    <rect x="-12" y="-122" width="26" height="46" fill="#f472b6" fill-opacity="0.10" stroke="#f472b6" stroke-width="2" />
  </g>
"""

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <rect width="100%" height="100%" fill="#090b14" />
  <rect x="20" y="20" width="1560" height="960" rx="28" ry="28" fill="#0f1724" stroke="#24364f" stroke-width="3" />
  <rect x="20" y="20" width="1560" height="8" fill="#67e8f9" rx="6" ry="6" />

  <text x="60" y="88" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="700">CRYSTAL RECEIPT</text>
  <text x="60" y="124" fill="#b7c4d8" font-family="Segoe UI, Arial, sans-serif" font-size="22">RECEIPT EVIDENCE -&gt; DETERMINISTIC CRYSTAL -&gt; VISUAL ARTIFACT</text>
{crystal_mark_small}

  <rect x="50" y="160" width="460" height="700" rx="24" ry="24" fill="#121c2b" stroke="#2b3d59" stroke-width="2.5" />
  <text x="78" y="208" fill="#67e8f9" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="700">INPUT: RECEIPT EVIDENCE</text>
  <text x="78" y="252" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">SESSION_ID</text>
  <text x="78" y="278" fill="#d7e3f4" font-family="Consolas, monospace" font-size="18">{session_label}</text>
  <text x="78" y="324" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">RECEIPT_HASH</text>
  <text x="78" y="350" fill="#d7e3f4" font-family="Consolas, monospace" font-size="18">{receipt_hash_short}</text>
  <text x="78" y="396" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">DIFF_HASH</text>
  <text x="78" y="422" fill="#d7e3f4" font-family="Consolas, monospace" font-size="18">{diff_hash_short}</text>
  <text x="78" y="468" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">EVENT_ROOT</text>
  <text x="78" y="494" fill="#d7e3f4" font-family="Consolas, monospace" font-size="18">{event_root_short}</text>
  <text x="78" y="540" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">AGENT_ID</text>
  <text x="78" y="566" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">{agent_label}</text>
  <text x="78" y="612" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">SCOPE / AUTHORITY</text>
  <text x="78" y="638" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">{scope_summary} / {authority_summary}</text>
  <text x="78" y="684" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">CHANGED_FILES</text>
  <text x="78" y="710" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">{changed_summary}</text>
  <text x="78" y="756" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">TIMESTAMP</text>
  <text x="78" y="782" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">{timestamp_label}</text>
  <text x="78" y="828" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">VERIFIER_RESULT</text>
  <text x="78" y="854" fill="#d7e3f4" font-family="Consolas, monospace" font-size="18">{status}</text>
  <text x="78" y="900" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">SIGNATURE_BLOCK</text>
  <text x="78" y="926" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">{signature_summary}</text>

  <rect x="540" y="160" width="500" height="700" rx="24" ry="24" fill="#101826" stroke="#2b3d59" stroke-width="2.5" />
  <text x="568" y="208" fill="#a78bfa" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="700">PROCESS: DETERMINISTIC CRYSTAL GENERATION</text>
  <text x="568" y="258" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">CANONICALIZATION</text>
  <text x="568" y="284" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">sorted keys → compact JSON → SHA-256</text>
  <text x="568" y="330" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">CANONICAL_RECEIPT_HASH</text>
  <text x="568" y="356" fill="#d7e3f4" font-family="Consolas, monospace" font-size="18">{canonical_short}</text>
  <text x="568" y="402" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">SEED DERIVATION</text>
  <text x="568" y="428" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">MASTER_SEED · SHAPE_SEED · PALETTE_SEED</text>
  <text x="568" y="454" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">SYMMETRY_SEED · LAYER_SEED · OXIDE_SEED · TRAIT_SEED</text>
  <text x="568" y="500" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">VISUAL TRAIT DERIVATION</text>
  <text x="568" y="526" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">geometry_style={traits["geometry_style"]}</text>
  <text x="568" y="552" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">palette_name={traits["palette_name"]}</text>
  <text x="568" y="578" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">symmetry={traits["symmetry"]} · layer_count={traits["layer_count"]}</text>
  <text x="568" y="604" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">shard_count={traits["shard_count"]} · rarity={traits["rarity"]}</text>
  <line x1="790" y1="620" x2="790" y2="760" stroke="#35507c" stroke-width="2" stroke-dasharray="8 8" />
  <text x="568" y="792" fill="#b7c4d8" font-family="Segoe UI, Arial, sans-serif" font-size="18">receipt evidence is transformed into a reproducible bismuth / hopper crystal grammar</text>

  <rect x="1070" y="160" width="480" height="700" rx="24" ry="24" fill="#121c2b" stroke="#2b3d59" stroke-width="2.5" />
  <text x="1098" y="208" fill="#f472b6" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="700">OUTPUT: CRYSTAL ARTIFACT &amp; METADATA</text>
{crystal_mark_large}
  <text x="1098" y="270" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">METADATA SUMMARY</text>
  <text x="1098" y="300" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">canonical_receipt_hash: {canonical_short}</text>
  <text x="1098" y="330" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">visual_traits: {visual_summary}</text>
  <text x="1098" y="360" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">ACTION_GROWTH_MAP: semantic evidence → mutation map</text>
  <text x="1098" y="390" fill="#d7e3f4" font-family="Consolas, monospace" font-size="16">{action_summary}</text>
  <text x="1098" y="420" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">receipt_card file: receipt-card.svg</text>
  <text x="1098" y="450" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">provenance: deterministic / reproducible / shareable</text>
  <text x="1098" y="760" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">CRYSTAL PREVIEW</text>
  <text x="1098" y="790" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">crystal.svg · crystal.metadata.json · receipt-card.svg</text>
  <text x="1098" y="820" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">artifact hash: {artifact_short}</text>

  <rect x="50" y="890" width="1500" height="70" rx="18" ry="18" fill="#121212" stroke="#334155" stroke-width="2.5" />
  <text x="78" y="922" fill="#fef08a" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700">IMPORTANT BOUNDARY:</text>
  <text x="78" y="948" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="20">Visual artifact, not verifier. The crystal is not the security verifier. Verification must be performed by an independent verifier.</text>
</svg>
'''


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
        "action_growth_map": _action_growth_map(receipt),
        "artifact_file": "crystal.svg",
        "receipt_card": {
            "file": "receipt-card.svg",
            "purpose": "shareable Crystal Receipt proof card",
            "boundary": "Visual artifact, not verifier",
        },
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


def write_outputs(receipt_hash: str, out_dir: Path) -> Dict:
    return write_hash_outputs(receipt_hash, out_dir)


def write_receipt_outputs(receipt_path: Path, out_dir: Path) -> Dict:
    metadata = generate_receipt_mode_metadata(receipt_path)
    svg = render_receipt_mode_svg(metadata)
    crystal_svg_hash = sha256_hex(svg)
    receipt_card_svg = render_receipt_card_svg(metadata, crystal_svg_hash)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "crystal.svg").write_text(svg, encoding="utf-8")
    (out_dir / "receipt-card.svg").write_text(receipt_card_svg, encoding="utf-8")
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
