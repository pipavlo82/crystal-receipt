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


def _capsule_spec(symmetry: str, edge_bias: float, geometry_style: str) -> Dict[str, float]:
    symmetry_factor = {"low": 0.92, "medium": 1.0, "high": 1.08}[symmetry]
    style_factor = {
        "hopper": 1.0,
        "radial": 0.94,
        "stepped": 0.98,
        "fractured": 0.9,
    }[geometry_style]
    w = (118 + edge_bias * 34) * symmetry_factor * style_factor
    h = (272 + edge_bias * 44) * symmetry_factor
    x = CENTER_X - w / 2
    y = (CENTER_Y - 18) - h / 2
    return {"x": round(x, 2), "y": round(y, 2), "w": round(w, 2), "h": round(h, 2), "r": round(min(34.0, w * 0.34), 2)}


def _rects_overlap(a: Dict[str, float], b: Dict[str, float], padding: float = 0.0) -> bool:
    return not (
        a["x"] + a["w"] + padding <= b["x"]
        or b["x"] + b["w"] + padding <= a["x"]
        or a["y"] + a["h"] + padding <= b["y"]
        or b["y"] + b["h"] + padding <= a["y"]
    )


def _hopper_rectangles(
    layer_count: int,
    shard_count: int,
    symmetry: str,
    edge_bias: float,
    geometry_style: str,
) -> Tuple[List[Dict[str, float]], List[Dict[str, float]], Dict[str, float]]:
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
    capsule = _capsule_spec(symmetry, edge_bias, geometry_style)

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
    cavity = {
        "x": capsule["x"] - 12,
        "y": capsule["y"] - 14,
        "w": capsule["w"] + 24,
        "h": capsule["h"] + 28,
    }

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

        shard = {"x": x, "y": y, "w": w, "h": h}
        if _rects_overlap(shard, cavity):
            continue

        shard_center_x = shard["x"] + shard["w"] / 2
        shard_center_y = shard["y"] + shard["h"] / 2
        dx = shard_center_x - CENTER_X
        dy = shard_center_y - (CENTER_Y - 18)
        if abs(dx) < capsule["w"] * 0.82 and abs(dy) < capsule["h"] * 0.74:
            shard["x"] += 10 if dx >= 0 else -10
            shard["y"] += 6 if dy >= 0 else -6
            if _rects_overlap(shard, cavity, padding=3):
                continue

        shards.append(shard)

    return terraces, shards, capsule


def _stepped_rect_points(rect: Dict[str, float], inset: float = 0.0) -> List[Tuple[float, float]]:
    x = rect["x"] + inset
    y = rect["y"] + inset
    w = max(10.0, rect["w"] - inset * 2)
    h = max(10.0, rect["h"] - inset * 2)
    notch = max(6.0, min(rect["notch"], w * 0.28, h * 0.28))
    mid_w = max(10.0, w * 0.22)
    mid_h = max(10.0, h * 0.22)
    return [
        (x, y),
        (x + w, y),
        (x + w, y + h * 0.34),
        (x + w - notch, y + h * 0.34),
        (x + w - notch, y + h - notch),
        (x + w - notch - mid_w, y + h - notch),
        (x + w - notch - mid_w, y + h),
        (x + notch, y + h),
        (x + notch, y + h - mid_h),
        (x, y + h - mid_h),
    ]


def _offset_points(points: List[Tuple[float, float]], dx: float, dy: float) -> List[Tuple[float, float]]:
    return [(round(px + dx, 2), round(py + dy, 2)) for px, py in points]


def _polygon_tag(points: List[Tuple[float, float]], **attrs: object) -> str:
    joined = points_to_svg([(round(px, 2), round(py, 2)) for px, py in points])
    attr_text = " ".join(f'{key.replace("_", "-")}="{value}"' for key, value in attrs.items())
    return f'<polygon points="{joined}" {attr_text} />'


def _terrace_surface_polygons(rect: Dict[str, float], lift: float, depth: float) -> Dict[str, List[Tuple[float, float]]]:
    front = _stepped_rect_points(rect)
    top = _offset_points(front, -lift, -lift * 0.82)
    side = _offset_points(front, depth, depth * 0.55)
    return {"front": front, "top": top, "side": side}


def _terrace_connectors(front: List[Tuple[float, float]], shifted: List[Tuple[float, float]], edge_indexes: List[int]) -> List[List[Tuple[float, float]]]:
    quads: List[List[Tuple[float, float]]] = []
    count = len(front)
    for idx in edge_indexes:
        next_idx = (idx + 1) % count
        quads.append([front[idx], front[next_idx], shifted[next_idx], shifted[idx]])
    return quads


def _render_capsule_hopper_shell(body: List[str], capsule: Dict[str, float], palette: List[str], traits: Dict[str, object]) -> None:
    x = capsule["x"]
    y = capsule["y"]
    w = capsule["w"]
    h = capsule["h"]
    shell_x = x - 16
    shell_y = y - 18
    shell_w = w + 32
    shell_h = h + 36
    edge_bias = float(traits["edge_bias"])
    oxide = float(traits["oxide_intensity"])
    symmetry = str(traits["symmetry"])
    bridge = 22 + edge_bias * 20
    lip = 18 + oxide * 12
    shoulder = 26 + (6 if symmetry == "high" else 0)
    waist = max(18.0, shell_w * (0.15 if symmetry == "low" else 0.18))
    brace_color = palette[-1]
    facet_color = palette[1]

    shell_facets = [
        [
            (shell_x - shoulder, shell_y + shell_h * 0.18),
            (shell_x + shell_w * 0.24, shell_y + shell_h * 0.10),
            (shell_x + shell_w * 0.38, shell_y + shell_h * 0.24),
            (shell_x + shell_w * 0.16, shell_y + shell_h * 0.36),
        ],
        [
            (shell_x + shell_w * 0.76, shell_y + shell_h * 0.10),
            (shell_x + shell_w + shoulder, shell_y + shell_h * 0.18),
            (shell_x + shell_w + shell_w * 0.02, shell_y + shell_h * 0.36),
            (shell_x + shell_w * 0.62, shell_y + shell_h * 0.24),
        ],
        [
            (shell_x + shell_w * 0.18, shell_y - lip),
            (shell_x + shell_w * 0.82, shell_y - lip),
            (shell_x + shell_w * 0.68, shell_y + shell_h * 0.07),
            (shell_x + shell_w * 0.32, shell_y + shell_h * 0.07),
        ],
        [
            (shell_x + shell_w * 0.28, shell_y + shell_h * 0.93),
            (shell_x + shell_w * 0.72, shell_y + shell_h * 0.93),
            (shell_x + shell_w * 0.84, shell_y + shell_h + lip),
            (shell_x + shell_w * 0.16, shell_y + shell_h + lip),
        ],
    ]
    for idx, facet in enumerate(shell_facets):
        body.append(
            _polygon_tag(
                facet,
                fill=facet_color if idx % 2 == 0 else brace_color,
                fill_opacity=f"{0.11 + oxide * 0.16:.4f}",
                stroke="#f8fbff",
                stroke_opacity="0.08",
                stroke_width="0.9",
            )
        )

    brace_rects = [
        {"x": shell_x - bridge, "y": shell_y + shell_h * 0.24, "w": bridge + 10, "h": shell_h * 0.16},
        {"x": shell_x + shell_w - 10, "y": shell_y + shell_h * 0.24, "w": bridge + 10, "h": shell_h * 0.16},
        {"x": shell_x - waist * 0.4, "y": shell_y + shell_h * 0.44, "w": waist, "h": shell_h * 0.12},
        {"x": shell_x + shell_w - waist * 0.6, "y": shell_y + shell_h * 0.44, "w": waist, "h": shell_h * 0.12},
    ]
    for idx, rect in enumerate(brace_rects):
        body.append(
            f'<rect x="{rect["x"]:.2f}" y="{rect["y"]:.2f}" width="{rect["w"]:.2f}" height="{rect["h"]:.2f}" '
            f'rx="{max(8.0, rect["h"] * 0.32):.2f}" ry="{max(8.0, rect["h"] * 0.32):.2f}" fill="{palette[(idx + 2) % len(palette)]}" '
            f'fill-opacity="{0.14 + oxide * 0.16:.4f}" stroke="#ffffff" stroke-opacity="0.08" stroke-width="0.8" />'
        )


def _render_center_capsule(body: List[str], capsule: Dict[str, float], palette: List[str], traits: Dict[str, object]) -> None:
    x = capsule["x"]
    y = capsule["y"]
    w = capsule["w"]
    h = capsule["h"]
    r = capsule["r"]
    shell_x = x - 16
    shell_y = y - 18
    shell_w = w + 32
    shell_h = h + 36
    shell_r = min(44.0, r + 10)
    status_glow = 0.16 + float(traits["oxide_intensity"]) * 0.18

    body.append(
        f'<ellipse id="capsule-aura" cx="{CENTER_X:.2f}" cy="{CENTER_Y - 8:.2f}" rx="{w * 0.92:.2f}" ry="{h * 0.58:.2f}" '
        f'fill="url(#capsuleAura)" fill-opacity="{status_glow:.4f}" />'
    )
    body.append(
        f'<rect id="capsule-shell" x="{shell_x:.2f}" y="{shell_y:.2f}" width="{shell_w:.2f}" height="{shell_h:.2f}" '
        f'rx="{shell_r:.2f}" ry="{shell_r:.2f}" fill="#04070d" fill-opacity="0.76" stroke="{palette[-1]}" stroke-opacity="0.22" stroke-width="1.4" />'
    )
    body.append(
        f'<rect id="capsule-core" x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" '
        f'rx="{r:.2f}" ry="{r:.2f}" fill="url(#coreFace)" stroke="#f8fbff" stroke-opacity="0.52" stroke-width="1.6" />'
    )
    body.append(
        f'<rect id="capsule-core-inner" x="{x + 8:.2f}" y="{y + 10:.2f}" width="{w - 16:.2f}" height="{h - 20:.2f}" '
        f'rx="{max(12.0, r - 7):.2f}" ry="{max(12.0, r - 7):.2f}" fill="#090c13" fill-opacity="0.18" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1.0" />'
    )
    body.append(
        f'<rect id="capsule-spine" x="{x + w * 0.46:.2f}" y="{y + 22:.2f}" width="{w * 0.08:.2f}" height="{h - 44:.2f}" '
        f'rx="{max(7.0, w * 0.045):.2f}" ry="{max(7.0, w * 0.045):.2f}" fill="#eef5ff" fill-opacity="0.16" />'
    )
    core_facets = [
        (CENTER_X, y + h * 0.34),
        (x + w * 0.62, y + h * 0.50),
        (CENTER_X, y + h * 0.68),
        (x + w * 0.38, y + h * 0.50),
    ]
    body.append(
        _polygon_tag(
            core_facets,
            id="capsule-seal",
            fill="#ffffff",
            fill_opacity="0.07",
            stroke="#f8fbff",
            stroke_opacity="0.16",
            stroke_width="1.0",
        )
    )
    body.append(
        f'<line x1="{x + 18:.2f}" y1="{y + h * 0.28:.2f}" x2="{x + w - 18:.2f}" y2="{y + h * 0.28:.2f}" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1.0" />'
    )
    body.append(
        f'<line x1="{x + 18:.2f}" y1="{y + h * 0.72:.2f}" x2="{x + w - 18:.2f}" y2="{y + h * 0.72:.2f}" stroke="#ffffff" stroke-opacity="0.08" stroke-width="0.9" />'
    )
    body.append(
        f'<rect x="{x + 10:.2f}" y="{y + 12:.2f}" width="{w - 20:.2f}" height="{h * 0.14:.2f}" rx="{max(10.0, r * 0.48):.2f}" '
        f'ry="{max(10.0, r * 0.48):.2f}" fill="#ffffff" fill-opacity="0.08" />'
    )


def render_receipt_mode_svg(metadata: Dict) -> str:
    traits = metadata["visual_traits"]
    palette = PALETTES[traits["palette_name"]]
    rng = random.Random(int(metadata["derived_seeds"]["master_seed"][:16], 16))
    glow_std = 3.6 + traits["oxide_intensity"] * 2.4
    shadow_shift = 18 + traits["edge_bias"] * 18
    defs = f"""
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#07090e" />
      <stop offset="52%" stop-color="#121722" />
      <stop offset="100%" stop-color="#030407" />
    </linearGradient>
    <linearGradient id="oxide" x1="18%" y1="6%" x2="82%" y2="94%">
      <stop offset="0%" stop-color="{palette[0]}" stop-opacity="{0.42 + traits['oxide_intensity'] * 0.22:.4f}" />
      <stop offset="22%" stop-color="{palette[1]}" stop-opacity="{0.54 + traits['oxide_intensity'] * 0.18:.4f}" />
      <stop offset="48%" stop-color="{palette[2]}" stop-opacity="{0.66 + traits['oxide_intensity'] * 0.15:.4f}" />
      <stop offset="74%" stop-color="{palette[3]}" stop-opacity="{0.78 + traits['oxide_intensity'] * 0.12:.4f}" />
      <stop offset="100%" stop-color="{palette[4]}" stop-opacity="{0.88 + traits['oxide_intensity'] * 0.08:.4f}" />
    </linearGradient>
    <linearGradient id="coreFace" x1="15%" y1="8%" x2="82%" y2="88%">
      <stop offset="0%" stop-color="#eef5ff" stop-opacity="0.92" />
      <stop offset="42%" stop-color="#bfd0f8" stop-opacity="0.30" />
      <stop offset="100%" stop-color="#0f1117" stop-opacity="0.16" />
    </linearGradient>
    <radialGradient id="capsuleAura" cx="50%" cy="42%" r="64%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.78" />
      <stop offset="55%" stop-color="{palette[1]}" stop-opacity="0.24" />
      <stop offset="100%" stop-color="{palette[3]}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="sideShade" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0d14" stop-opacity="0.04" />
      <stop offset="100%" stop-color="#04060a" stop-opacity="0.65" />
    </linearGradient>
    <filter id="softGlow">
      <feGaussianBlur stdDeviation="{glow_std:.2f}" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="deepShadow">
      <feDropShadow dx="0" dy="{shadow_shift * 0.42:.2f}" stdDeviation="{12 + traits['edge_bias'] * 6:.2f}" flood-color="#000000" flood-opacity="0.34" />
    </filter>
  </defs>
"""
    body = [f'<rect width="100%" height="100%" fill="url(#bg)" />']
    body.append(
        f'<ellipse cx="{CENTER_X:.2f}" cy="{CENTER_Y + 250:.2f}" rx="320" ry="94" fill="#000000" fill-opacity="0.28" filter="url(#deepShadow)" />'
    )

    terraces, shards, capsule = _hopper_rectangles(
        traits["layer_count"],
        traits["shard_count"],
        traits["symmetry"],
        traits["edge_bias"],
        traits["geometry_style"],
    )

    if terraces:
        outer = terraces[0]
        body.append(
            f'<rect x="{outer["x"] - 36:.2f}" y="{outer["y"] - 48:.2f}" width="{outer["w"] + 72:.2f}" height="{outer["h"] + 96:.2f}" '
            f'fill="url(#oxide)" fill-opacity="{0.14 + traits["oxide_intensity"] * 0.16:.4f}" stroke="none" rx="44" ry="44" />'
        )

    body.append('<g filter="url(#softGlow)">')
    for idx, rect in enumerate(reversed(terraces)):
        layer_idx = len(terraces) - 1 - idx
        color = palette[layer_idx % len(palette)]
        polys = _terrace_surface_polygons(rect, lift=10 + layer_idx * 1.1, depth=13 + layer_idx * 1.6)
        front = polys["front"]
        top = polys["top"]
        side = polys["side"]
        side_quads = _terrace_connectors(front, side, [1, 2, 3, 4, 5, 6])
        top_quads = _terrace_connectors(front, top, [0, 1, 8, 9])
        face_opacity = round(0.14 + ((layer_idx + 1) / max(len(terraces), 1)) * (0.22 + traits["oxide_intensity"] * 0.18), 4)
        edge_opacity = round(0.22 + face_opacity * 0.9, 4)

        for quad in side_quads:
            body.append(_polygon_tag(quad, fill=color, fill_opacity=f"{face_opacity * 0.88:.4f}", stroke="#f8fbff", stroke_opacity="0.05", stroke_width="0.8"))
        for quad in top_quads:
            body.append(_polygon_tag(quad, fill=palette[(layer_idx + 1) % len(palette)], fill_opacity=f"{min(0.72, face_opacity + 0.16):.4f}", stroke="#ffffff", stroke_opacity="0.08", stroke_width="0.8"))

        body.append(
            _polygon_tag(
                front,
                fill="url(#oxide)",
                fill_opacity=f"{min(0.82, face_opacity + 0.12):.4f}",
                stroke=color,
                stroke_opacity=f"{edge_opacity:.4f}",
                stroke_width=f"{1.2 + (layer_idx % 2) * 0.5:.2f}",
            )
        )

        inset = max(10.0, min(rect["notch"] + 3.0, rect["w"] * 0.18, rect["h"] * 0.18))
        inner = _stepped_rect_points(rect, inset=inset)
        body.append(_polygon_tag(inner, fill="#05070c", fill_opacity=f"{0.22 + layer_idx * 0.012:.4f}", stroke=palette[(layer_idx + 2) % len(palette)], stroke_opacity=f"{max(0.14, edge_opacity - 0.12):.4f}", stroke_width="1.0"))
        if layer_idx < len(terraces) - 1:
            inner_top = _offset_points(inner, -(7 + layer_idx * 0.7), -(6 + layer_idx * 0.55))
            for quad in _terrace_connectors(inner, inner_top, [0, 1, 8, 9]):
                body.append(_polygon_tag(quad, fill="#f7fbff", fill_opacity="0.05", stroke="none"))

    body.append('</g>')
    body.append('<g>')
    for idx, rect in enumerate(shards):
        color = palette[(idx + 2) % len(palette)]
        lift = 6 + (idx % 4) * 1.8
        depth = 7 + (idx % 5) * 1.5
        front = [(rect["x"], rect["y"]), (rect["x"] + rect["w"], rect["y"]), (rect["x"] + rect["w"], rect["y"] + rect["h"]), (rect["x"], rect["y"] + rect["h"])]
        top = _offset_points(front, -lift, -lift * 0.72)
        side = _offset_points(front, depth, depth * 0.48)
        body.append(_polygon_tag([front[1], front[2], side[2], side[1]], fill=color, fill_opacity=f"{0.14 + traits['oxide_intensity'] * 0.18:.4f}", stroke="none"))
        body.append(_polygon_tag([front[0], front[1], top[1], top[0]], fill="#ffffff", fill_opacity=f"{0.06 + (idx % 3) * 0.015:.4f}", stroke="none"))
        body.append(
            f'<rect x="{rect["x"]:.2f}" y="{rect["y"]:.2f}" width="{rect["w"]:.2f}" height="{rect["h"]:.2f}" fill="{color}" fill-opacity="{0.10 + traits["oxide_intensity"] * 0.22:.4f}" '
            f'stroke="#f8f9fa" stroke-opacity="0.08" stroke-width="0.8" />'
        )
        if idx % 4 != 1:
            stripe_count = 1 + (idx % 3)
            for stripe in range(stripe_count):
                band_y = rect["y"] + 2.5 + stripe * max(3.0, rect["h"] / 4)
                body.append(
                    f'<line x1="{rect["x"] + 2:.2f}" y1="{band_y:.2f}" x2="{rect["x"] + rect["w"] - 2:.2f}" y2="{band_y:.2f}" '
                    f'stroke="#ffffff" stroke-opacity="0.07" stroke-width="0.9" />'
                )

    band_count = 6 + int(traits["oxide_intensity"] * 6)
    outer = terraces[0] if terraces else {"x": CENTER_X - 180, "y": CENTER_Y - 180, "w": 360, "h": 360}
    for band_idx in range(band_count):
        y = outer["y"] + 34 + band_idx * ((outer["h"] - 68) / max(band_count, 1))
        x1 = outer["x"] + 24 + (band_idx % 3) * 18
        x2 = outer["x"] + outer["w"] - 24 - ((band_idx + 1) % 3) * 14
        body.append(
            f'<line x1="{x1:.2f}" y1="{y:.2f}" x2="{x2:.2f}" y2="{y - rng.uniform(10, 26):.2f}" '
            f'stroke="{palette[band_idx % len(palette)]}" stroke-opacity="{0.12 + traits["oxide_intensity"] * 0.12:.4f}" stroke-width="{3.2 - (band_idx % 2) * 0.6:.2f}" />'
        )
    _render_capsule_hopper_shell(body, capsule, palette, traits)
    _render_center_capsule(body, capsule, palette, traits)
    body.append('</g>')

    if traits["rarity"] in {"rare", "mythic"}:
        radius = 268 if traits["rarity"] == "rare" else 324
        accent = palette[-1]
        body.append(
            f'<circle cx="{CENTER_X:.2f}" cy="{CENTER_Y - 12:.2f}" r="{radius:.2f}" fill="none" '
            f'stroke="{accent}" stroke-opacity="0.18" stroke-dasharray="18 14" stroke-width="2.8" />'
        )

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
    verifier_result = metadata["action_growth_map"]["verifier_result"]["source"] or {}
    status = verifier_result.get("status", "UNKNOWN") if isinstance(verifier_result, dict) else str(verifier_result)
    session_label = source.get("session_id") or source.get("receiptHash") or "unknown-receipt"
    canonical_short = short_hash(metadata["canonical_receipt_hash"], 16)
    artifact_short = short_hash(crystal_svg_hash, 16)
    ruleset_label = f'{metadata["ruleset"]} / {metadata["generator_version"]}'

    crystal_mark = """
  <g transform="translate(650 265)">
    <polygon points="-78,-60 78,-60 56,-18 56,42 18,78 -18,78 -56,42 -56,-18" fill="none" stroke="#151515" stroke-width="4" />
    <polygon points="-52,-38 52,-38 38,-10 38,28 12,54 -12,54 -38,28 -38,-10" fill="none" stroke="#151515" stroke-width="3" />
    <rect x="-18" y="-56" width="36" height="112" rx="16" ry="16" fill="#ffffff" stroke="#151515" stroke-width="2.4" />
    <polygon points="0,-12 18,0 0,14 -18,0" fill="#ffffff" stroke="#151515" stroke-width="2" />
    <line x1="-40" y1="-22" x2="-56" y2="-42" stroke="#151515" stroke-width="2.4" />
    <line x1="40" y1="-22" x2="56" y2="-42" stroke="#151515" stroke-width="2.4" />
    <line x1="-32" y1="32" x2="-48" y2="52" stroke="#151515" stroke-width="2.4" />
    <line x1="32" y1="32" x2="48" y2="52" stroke="#151515" stroke-width="2.4" />
  </g>
"""

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="860" height="540" viewBox="0 0 860 540">
  <rect width="100%" height="100%" fill="#ffffff" />
  <rect x="24" y="24" width="812" height="492" rx="22" ry="22" fill="#ffffff" stroke="#151515" stroke-width="3" />
  <text x="54" y="84" fill="#111111" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700">Crystal Receipt</text>
  <text x="54" y="118" fill="#404040" font-family="Segoe UI, Arial, sans-serif" font-size="20">Visual artifact for execution receipt</text>
  <line x1="54" y1="142" x2="806" y2="142" stroke="#151515" stroke-width="2" />

  <text x="54" y="190" fill="#111111" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">Receipt ID</text>
  <text x="54" y="218" fill="#202020" font-family="Consolas, monospace" font-size="21">{session_label}</text>

  <text x="54" y="274" fill="#111111" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">Verifier Result</text>
  <text x="54" y="302" fill="#202020" font-family="Consolas, monospace" font-size="22">{status}</text>

  <text x="54" y="358" fill="#111111" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">Canonical Receipt Hash</text>
  <text x="54" y="386" fill="#202020" font-family="Consolas, monospace" font-size="20">{canonical_short}…</text>

  <text x="54" y="442" fill="#111111" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">Artifact Hash</text>
  <text x="54" y="470" fill="#202020" font-family="Consolas, monospace" font-size="20">{artifact_short}…</text>

  <text x="470" y="358" fill="#111111" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">Ruleset / Generator</text>
  <text x="470" y="386" fill="#202020" font-family="Consolas, monospace" font-size="18">{ruleset_label}</text>

  <rect x="470" y="420" width="290" height="38" rx="10" ry="10" fill="#ffffff" stroke="#151515" stroke-width="2" />
  <text x="488" y="445" fill="#111111" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">Visual artifact, not verifier</text>
{crystal_mark}
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
            "purpose": "shareable visual receipt card",
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
