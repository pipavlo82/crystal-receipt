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


def deterministic_offsets_from_seed(seed_hex: str, count: int, span: float) -> List[float]:
    offsets: List[float] = []
    for idx in range(count):
        start = (idx * 4) % max(4, len(seed_hex) - 4)
        chunk = seed_hex[start : start + 4]
        if len(chunk) < 4:
            chunk = (chunk + seed_hex)[:4]
        value = int(chunk, 16) / 0xFFFF
        offsets.append((value - 0.5) * 2 * span)
    return offsets


def build_bismuth_growth_plan(traits: Dict, seed_material: Dict, center_x: float, center_y: float, scale: float = 1.0) -> Dict:
    layer_count = traits["layer_count"]
    shard_count = traits["shard_count"]
    symmetry = traits["symmetry"]
    edge_bias = traits["edge_bias"]
    geometry_style = traits["geometry_style"]

    symmetry_factor = {"low": 0.76, "medium": 0.88, "high": 1.0}[symmetry]
    geometry_scale = {"hopper": 1.0, "radial": 0.9, "stepped": 0.97, "fractured": 0.86}[geometry_style]
    levels = max(5, min(11, layer_count // 2 + 3))
    base_w = (420 + shard_count * 5.0) * symmetry_factor * geometry_scale * scale
    base_h = (280 + layer_count * 8.0) * symmetry_factor * geometry_scale * scale
    rise_step = (20 + edge_bias * 10 + (3 if geometry_style == "stepped" else 0)) * scale
    inset_step = (16 + (1 - edge_bias) * 10) * geometry_scale * scale
    hollow_step = (10 + traits["oxide_intensity"] * 12) * scale

    x_offsets = deterministic_offsets_from_seed(seed_material["shape_seed"], levels, 18 * scale)
    y_offsets = deterministic_offsets_from_seed(seed_material["symmetry_seed"], levels, 10 * scale)

    terraces: List[Dict[str, float]] = []
    for idx in range(levels):
        width = max(90 * scale, base_w - idx * inset_step * 2)
        height = max(56 * scale, base_h - idx * inset_step * 1.35)
        x = center_x - width / 2 + x_offsets[idx] * (0.35 if symmetry == "high" else 0.65)
        y = center_y - height / 2 - idx * rise_step + y_offsets[idx]
        hollow = max(12 * scale, min(width * 0.22, hollow_step + idx * 2.5 * scale))
        terraces.append({"x": x, "y": y, "w": width, "h": height, "hollow": hollow})

    branches: List[Dict[str, float]] = []
    branch_count = max(4, min(14, shard_count // 2 + (2 if traits["rarity"] in {"rare", "mythic"} else 0)))
    branch_offsets = deterministic_offsets_from_seed(seed_material["layer_seed"], branch_count * 2, 24 * scale)
    mirror_mode = symmetry != "low"

    for idx in range(branch_count):
        side = -1 if idx % 2 == 0 else 1
        if not mirror_mode and idx % 3 == 0:
            side = -1
        level_index = min(levels - 1, max(0, idx % levels))
        anchor = terraces[level_index]
        branch_w = max(34 * scale, (72 - (idx % 4) * 8) * scale)
        branch_h = max(18 * scale, (40 - (idx % 3) * 5) * scale)
        branch_x = anchor["x"] + (anchor["w"] + 20 * scale) * (1 if side > 0 else -1) - (branch_w if side < 0 else 0)
        branch_x += branch_offsets[idx] * 0.55
        branch_y = anchor["y"] + anchor["h"] * 0.2 + branch_offsets[idx + branch_count] * 0.25
        branches.append({"x": branch_x, "y": branch_y, "w": branch_w, "h": branch_h, "side": side})

    return {"terraces": terraces, "branches": branches, "levels": levels}


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

    growth_svg = draw_bismuth_growth(CENTER_X, 820, traits, metadata["derived_seeds"], palette, scale=1.0, include_id=True)
    body.append(growth_svg)

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


def _hex_to_rgb(color: str) -> Tuple[int, int, int]:
    color = color.lstrip("#")
    return int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16)


def _rgb_to_hex(rgb: Tuple[int, int, int]) -> str:
    return "#%02x%02x%02x" % rgb


def _mix_hex(color_a: str, color_b: str, weight: float) -> str:
    a = _hex_to_rgb(color_a)
    b = _hex_to_rgb(color_b)
    mixed = tuple(max(0, min(255, round(a[i] * (1 - weight) + b[i] * weight))) for i in range(3))
    return _rgb_to_hex(mixed)


def iso_project(x: float, y: float, z: float, depth_x: float, depth_y: float) -> Tuple[float, float]:
    return x + z * depth_x, y - z * depth_y


def _svg_poly(points: List[Tuple[float, float]]) -> str:
    return " ".join(f"{px:.2f},{py:.2f}" for px, py in points)


def draw_iso_cuboid(x: float, y: float, z: float, w: float, d: float, h: float, colors: Dict[str, str], class_name: str = "iso-cuboid", depth_x: float = 18.0, depth_y: float = 10.0, stroke_width: float = 1.6, opacity: float = 1.0) -> str:
    x0, y0 = iso_project(x, y, z, depth_x, depth_y)
    top = [(x0, y0 - h), (x0 + w, y0 - h), (x0 + w + d * depth_x, y0 - h - d * depth_y), (x0 + d * depth_x, y0 - h - d * depth_y)]
    left = [(x0, y0), (x0 + d * depth_x, y0 - d * depth_y), (x0 + d * depth_x, y0 - h - d * depth_y), (x0, y0 - h)]
    right = [(x0 + w, y0), (x0 + w + d * depth_x, y0 - d * depth_y), (x0 + w + d * depth_x, y0 - h - d * depth_y), (x0 + w, y0 - h)]
    inset_margin = max(4.0, min(w, h) * 0.16)
    inset_top = [
        (top[0][0] + inset_margin, top[0][1] + inset_margin * 0.15),
        (top[1][0] - inset_margin, top[1][1] + inset_margin * 0.15),
        (top[2][0] - inset_margin * 0.7, top[2][1] + inset_margin * 0.05),
        (top[3][0] + inset_margin * 0.7, top[3][1] + inset_margin * 0.05),
    ]
    return (
        f'<g class="{class_name}" opacity="{opacity:.3f}">'
        f'<polygon class="left-face" points="{_svg_poly(left)}" fill="{colors["left"]}" stroke="{colors["stroke"]}" stroke-width="{stroke_width:.2f}" />'
        f'<polygon class="right-face" points="{_svg_poly(right)}" fill="{colors["right"]}" stroke="{colors["stroke"]}" stroke-width="{stroke_width:.2f}" />'
        f'<polygon class="top-face" points="{_svg_poly(top)}" fill="{colors["top"]}" stroke="{colors["stroke"]}" stroke-width="{stroke_width:.2f}" />'
        f'<polygon class="oxide-band" points="{_svg_poly(inset_top)}" fill="none" stroke="{colors["accent"]}" stroke-width="{max(1.0, stroke_width - 0.35):.2f}" stroke-opacity="{colors.get("accent_opacity", "0.45")}" />'
        f'</g>'
    )


def draw_hollow_terrace(x: float, y: float, z: float, outer_w: float, outer_d: float, h: float, recess: float, colors: Dict[str, str], depth_x: float, depth_y: float, stroke_width: float) -> str:
    inner_w = max(12.0, outer_w - recess * 2)
    inner_d = max(0.55, outer_d - recess / max(outer_w, 1.0) * 1.8)
    inner_x = x + recess
    inner_y = y - recess * 0.55
    outer = draw_iso_cuboid(x, y, z, outer_w, outer_d, h, colors, class_name="iso-cuboid growth-terrace", depth_x=depth_x, depth_y=depth_y, stroke_width=stroke_width)
    inner_top_color = _mix_hex(colors["top"], "#0b1020", 0.72)
    recess_colors = {
        "top": inner_top_color,
        "left": _mix_hex(colors["left"], "#07101a", 0.28),
        "right": _mix_hex(colors["right"], "#050b12", 0.34),
        "stroke": colors["stroke"],
        "accent": colors["accent"],
        "accent_opacity": colors.get("accent_opacity", "0.45"),
    }
    inner = draw_iso_cuboid(inner_x, inner_y, z + 0.22, inner_w, inner_d, h * 0.48, recess_colors, class_name="iso-cuboid hopper-recess", depth_x=depth_x, depth_y=depth_y, stroke_width=max(1.0, stroke_width - 0.25), opacity=0.98)
    return f'<g class="hopper-step">{outer}{inner}</g>'


def deterministic_float(seed_hex: str, index: int) -> float:
    if not seed_hex:
        return 0.0
    start = (index * 8) % max(8, len(seed_hex) - 8)
    chunk = seed_hex[start : start + 8]
    if len(chunk) < 8:
        chunk = (chunk + seed_hex)[:8]
    return int(chunk, 16) / 0xFFFFFFFF


def deterministic_int(seed_hex: str, index: int, min_value: int, max_value: int) -> int:
    if max_value <= min_value:
        return min_value
    value = deterministic_float(seed_hex, index)
    span = max_value - min_value + 1
    return min_value + int(value * span) % span


def crystal_corners(radius: float, height: float, origin: Tuple[float, float], orientation: float) -> List[Tuple[float, float, float]]:
    ox, oy = origin
    pts: List[Tuple[float, float, float]] = []
    for i in range(4):
        angle = orientation + i * (math.pi / 2)
        dx = math.cos(angle) * radius
        dy = math.sin(angle) * radius * 0.62
        pts.append((ox + dx, oy + dy, height))
    return pts


def add_hopper_ring(origin: Tuple[float, float], radius: float, inner_radius: float, height: float, level_z: float, orientation: float, colors: Dict[str, str], depth_x: float, depth_y: float, stroke_width: float) -> str:
    cx, cy = origin
    outer_w = radius * 2
    outer_d = 1.2 + radius / 110.0
    outer_x = cx - outer_w / 2
    outer_y = cy - radius * 0.38
    recess = max(8.0, radius - inner_radius)
    return draw_hollow_terrace(outer_x, outer_y, level_z, outer_w, outer_d, height, recess, colors, depth_x, depth_y, stroke_width)


def draw_hopper_ledge_face(origin: Tuple[float, float], radius: float, inner_radius: float, height: float, level_z: float, orientation: float, colors: Dict[str, str], depth_x: float, depth_y: float, stroke_width: float) -> str:
    return f'<g class="hopper-ledge">{add_hopper_ring(origin, radius, inner_radius, height, level_z, orientation, colors, depth_x, depth_y, stroke_width)}</g>'


def draw_hopper_wall_face(origin: Tuple[float, float], radius: float, inner_radius: float, height: float, level_z: float, orientation: float, colors: Dict[str, str], depth_x: float, depth_y: float, stroke_width: float) -> str:
    wall_color = {
        "top": _mix_hex(colors["top"], colors["accent"], 0.10),
        "left": _mix_hex(colors["left"], "#060b14", 0.10),
        "right": _mix_hex(colors["right"], "#040811", 0.14),
        "stroke": colors["stroke"],
        "accent": colors["accent"],
        "accent_opacity": colors.get("accent_opacity", "0.45"),
    }
    inset_radius = max(inner_radius * 0.92, inner_radius - 4)
    return f'<g class="hopper-wall">{add_hopper_ring(origin, inner_radius + 8, inset_radius, height * 0.52, level_z + 0.1, orientation, wall_color, depth_x, depth_y, max(1.0, stroke_width - 0.18))}</g>'


def draw_recursive_terrace(origin: Tuple[float, float], radius: float, height: float, level_z: float, orientation: float, recursion_depth: int, axis: Tuple[float, float], traits: Dict, colors: Dict[str, str], depth_x: float, depth_y: float, stroke_width: float, seed_hex: str, seed_index: int) -> str:
    inner_radius = max(radius * 0.42, radius - (8 + traits["oxide_intensity"] * 10 + recursion_depth * 2))
    parts: List[str] = ['<g class="recursive-terrace self-similar">']
    parts.append(draw_hopper_ledge_face(origin, radius, inner_radius, height, level_z, orientation, colors, depth_x, depth_y, stroke_width))
    parts.append(draw_hopper_wall_face(origin, radius, inner_radius, height, level_z, orientation, colors, depth_x, depth_y, stroke_width))
    if recursion_depth > 0 and radius > 14:
        child_radius = max(12.0, radius * (0.48 + deterministic_float(seed_hex, seed_index) * 0.12))
        child_height = max(8.0, height * 0.72)
        step = radius * (0.34 + deterministic_float(seed_hex, seed_index + 1) * 0.10)
        child_origin = (
            origin[0] + axis[0] * step + (deterministic_float(seed_hex, seed_index + 2) - 0.5) * 6,
            origin[1] + axis[1] * step + (deterministic_float(seed_hex, seed_index + 3) - 0.5) * 4,
        )
        child_colors = {
            "top": _mix_hex(colors["top"], colors["accent"], min(0.56, 0.18 + recursion_depth * 0.08)),
            "left": _mix_hex(colors["left"], "#08101b", 0.08),
            "right": _mix_hex(colors["right"], "#07101a", 0.10),
            "stroke": colors["stroke"],
            "accent": colors["accent"],
            "accent_opacity": colors.get("accent_opacity", "0.45"),
        }
        parts.append(draw_recursive_terrace(child_origin, child_radius, child_height, level_z + 0.10, orientation, recursion_depth - 1, axis, traits, child_colors, depth_x, depth_y, max(1.0, stroke_width - 0.14), seed_hex, seed_index + 4))
    parts.append('</g>')
    return "".join(parts)


def build_hopper_crystal(origin: Tuple[float, float], max_radius: float, orientation: float, seed_hex: str, depth: int, traits: Dict) -> Dict:
    ring_count = max(4, min(10, traits["layer_count"] // 2 + 2 - depth))
    height_base = 18 + traits["layer_count"] * 0.7 - depth * 2.5
    taper = max_radius * (0.07 + deterministic_float(seed_hex, depth + 1) * 0.05)
    rings = []
    for idx in range(ring_count):
        radius = max(16.0, max_radius - idx * taper)
        inner_radius = max(radius * 0.38, radius - (8 + traits["oxide_intensity"] * 12 + idx * 1.6))
        height = max(9.0, height_base - idx * (1.2 + deterministic_float(seed_hex, idx + 6) * 1.1))
        level_z = idx * 0.18
        rings.append({
            "radius": radius,
            "inner_radius": inner_radius,
            "height": height,
            "level_z": level_z,
            "color_index": idx,
        })

    child_crystals = []
    max_child_depth = min(2, max(0, traits["layer_count"] // 5 - depth))
    if depth < max_child_depth:
        child_count = min(4, max(1, traits["shard_count"] // 6))
        distribution = 4 if traits["symmetry"] == "high" else 3 if traits["symmetry"] == "medium" else 2
        for idx in range(child_count):
            angle_step = (math.pi * 2) / distribution
            angle = orientation + angle_step * idx + (deterministic_float(seed_hex, idx + 30) - 0.5) * 0.45
            dist = max_radius * (0.38 + deterministic_float(seed_hex, idx + 40) * 0.16)
            child_origin = (
                origin[0] + math.cos(angle) * dist,
                origin[1] + math.sin(angle) * dist * 0.58,
            )
            child_radius = max_radius * (0.18 + deterministic_float(seed_hex, idx + 50) * 0.22)
            child_orientation = orientation + (deterministic_float(seed_hex, idx + 60) - 0.5) * 0.6
            child_seed = seed_hex[idx * 6 :] + seed_hex[: idx * 6] if seed_hex else seed_hex
            child_crystals.append(build_hopper_crystal(child_origin, child_radius, child_orientation, child_seed, depth + 1, traits))

    return {
        "origin": origin,
        "max_radius": max_radius,
        "orientation": orientation,
        "seed": seed_hex,
        "depth": depth,
        "rings": rings,
        "children": child_crystals,
    }


def draw_growth_branch(crystal: Dict, traits: Dict, colors: Dict[str, str], depth_x: float, depth_y: float, stroke_width: float) -> str:
    parts = [f'<g class="growth-branch child-crystal depth-{crystal["depth"]}">']
    for idx, ring in enumerate(crystal["rings"]):
        axis_angle = crystal["orientation"] + (idx % 4) * (math.pi / 2)
        axis = (math.cos(axis_angle), math.sin(axis_angle) * 0.62)
        recursion_depth = max(0, min(2, deterministic_int(crystal["seed"], idx + 80, 0, 2)))
        parts.append(
            draw_recursive_terrace(
                crystal["origin"],
                ring["radius"],
                ring["height"],
                ring["level_z"],
                crystal["orientation"],
                recursion_depth,
                axis,
                traits,
                colors,
                depth_x,
                depth_y,
                stroke_width,
                crystal["seed"],
                idx + crystal["depth"] * 20,
            )
        )
    for child in crystal["children"]:
        parts.append(draw_growth_branch(child, traits, colors, depth_x, depth_y, max(1.0, stroke_width - 0.16)))
    parts.append('</g>')
    return "".join(parts)


def spawn_child_crystals(root_crystal: Dict, traits: Dict, colors: Dict[str, str], depth_x: float, depth_y: float, stroke_width: float) -> str:
    parts = ['<g class="recursive-growth">']
    for child in root_crystal["children"]:
        parts.append(draw_growth_branch(child, traits, colors, depth_x, depth_y, max(1.0, stroke_width - 0.12)))
    parts.append('</g>')
    return "".join(parts)


def draw_bismuth_crystal_svg(root_crystal: Dict, traits: Dict, palette: List[str], scale: float = 1.0, include_id: bool = True) -> str:
    oxide_intensity = traits["oxide_intensity"]
    edge_bias = traits["edge_bias"]
    rarity = traits["rarity"]
    depth_x = (18 + edge_bias * 10) * scale
    depth_y = (10 + edge_bias * 5) * scale
    stroke_width = 1.45 + edge_bias * 1.25

    colors = {
        "top": _mix_hex(palette[0], "#f4f8ff", 0.42),
        "left": _mix_hex(palette[1], "#08101c", 0.42),
        "right": _mix_hex(palette[2], "#050b14", 0.36),
        "stroke": _mix_hex("#d8e7ff", palette[-1], 0.12),
        "accent": _mix_hex(palette[3], "#fef08a", 0.36),
        "accent_opacity": f'{0.36 + oxide_intensity * 0.42:.3f}',
    }

    parts: List[str] = []
    parts.append('<g id="bismuth-crystal" class="bismuth-growth fractal-hopper recursive-growth">' if include_id else '<g class="bismuth-growth fractal-hopper recursive-growth">')

    if rarity in {"rare", "mythic"}:
        ring_size = root_crystal["max_radius"] * 3.0
        parts.append(
            f'<rect x="{root_crystal["origin"][0] - ring_size / 2:.2f}" y="{root_crystal["origin"][1] - ring_size * 1.15:.2f}" width="{ring_size:.2f}" height="{ring_size * 1.32:.2f}" '
            f'fill="none" stroke="{colors["accent"]}" stroke-opacity="0.25" stroke-width="{stroke_width + 0.45:.2f}" rx="18" ry="18" />'
        )

    parts.append('<g class="hopper-tower">')
    for idx, ring in enumerate(root_crystal["rings"]):
        parts.append(draw_hopper_ledge_face(root_crystal["origin"], ring["radius"], ring["inner_radius"], ring["height"], ring["level_z"], root_crystal["orientation"], colors, depth_x, depth_y, stroke_width))
        parts.append(draw_hopper_wall_face(root_crystal["origin"], ring["radius"], ring["inner_radius"], ring["height"], ring["level_z"], root_crystal["orientation"], colors, depth_x, depth_y, stroke_width))
    parts.append('</g>')

    parts.append(spawn_child_crystals(root_crystal, traits, colors, depth_x, depth_y, stroke_width))

    corner_count = max(4, min(8, round(traits["shard_count"] * 0.22 + traits["edge_bias"] * 4)))
    parts.append('<g class="edge-growth self-similar">')
    for idx in range(corner_count):
        ang = root_crystal["orientation"] + (idx % 4) * (math.pi / 2) + math.pi / 4
        dist = root_crystal["max_radius"] * (0.70 + (idx // 4) * 0.08)
        x = root_crystal["origin"][0] + math.cos(ang) * dist - 10 * scale
        y = root_crystal["origin"][1] + math.sin(ang) * dist * 0.60
        w = max(10 * scale, (24 - (idx % 3) * 2) * scale)
        d = max(0.55, 0.95 - (idx % 2) * 0.06)
        h = max(8 * scale, (16 - (idx % 4) * 1.5) * scale)
        parts.append(draw_iso_cuboid(x, y, 0.1 + (idx % 3) * 0.04, w, d, h, colors, class_name="iso-cuboid edge-growth", depth_x=depth_x, depth_y=depth_y, stroke_width=max(1.0, stroke_width - 0.22), opacity=0.95))
    parts.append('</g>')

    parts.append('</g>')
    return "".join(parts)


def draw_bismuth_growth(cx: float, base_y: float, traits: Dict, seed_material: Dict, palette: List[str], scale: float = 1.0, include_id: bool = True) -> str:
    orientation = deterministic_float(seed_material["symmetry_seed"], 1) * (math.pi / 5) - (math.pi / 10)
    max_radius = (62 + traits["layer_count"] * 4.0 + min(traits["shard_count"], 14) * 1.6) * scale
    root_origin = (cx, base_y - max_radius * 0.34)
    root_crystal = build_hopper_crystal(root_origin, max_radius, orientation, seed_material["master_seed"], 0, traits)
    return draw_bismuth_crystal_svg(root_crystal, traits, palette, scale=scale, include_id=include_id)


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
    action_summary = "changed_files->terraces | verifier_result->seal/glow | scope/authority->boundary | diff/eventRoot->growth pattern"
    palette = PALETTES[traits["palette_name"]]
    crystal_mark_small = draw_bismuth_growth(800, 348, traits, metadata["derived_seeds"], palette, scale=0.46, include_id=False)
    crystal_mark_large = draw_bismuth_growth(1210, 790, traits, metadata["derived_seeds"], palette, scale=0.82, include_id=True)

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
  <text x="568" y="428" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">MASTER_SEED | SHAPE_SEED | PALETTE_SEED</text>
  <text x="568" y="454" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">SYMMETRY_SEED | LAYER_SEED | OXIDE_SEED | TRAIT_SEED</text>
  <text x="568" y="500" fill="#f8fbff" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">VISUAL TRAIT DERIVATION</text>
  <text x="568" y="526" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">geometry_style={traits["geometry_style"]}</text>
  <text x="568" y="552" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">palette_name={traits["palette_name"]}</text>
  <text x="568" y="578" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">symmetry={traits["symmetry"]} | layer_count={traits["layer_count"]}</text>
  <text x="568" y="604" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">shard_count={traits["shard_count"]} | rarity={traits["rarity"]}</text>
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
  <text x="1098" y="790" fill="#d7e3f4" font-family="Consolas, monospace" font-size="17">crystal.svg | crystal.metadata.json | receipt-card.svg</text>
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
