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


def draw_hopper_tower(base_x: float, base_y: float, base_z: float, levels: int, base_w: float, base_d: float, level_h: float, recess_step: float, taper_step: float, offsets: List[float], colors: Dict[str, str], depth_x: float, depth_y: float, stroke_width: float) -> str:
    parts: List[str] = ['<g class="hopper-tower">']
    for idx in range(levels):
        w = max(22.0, base_w - idx * taper_step * 2.0)
        d = max(0.9, base_d - idx * 0.055)
        x = base_x + idx * taper_step + offsets[idx] * 0.42
        y = base_y - idx * (level_h * 0.72) + offsets[idx] * 0.18
        z = base_z + idx * 0.16
        recess = min(w * 0.24, recess_step + idx * 1.2)
        parts.append(draw_hollow_terrace(x, y, z, w, d, level_h, recess, colors, depth_x, depth_y, stroke_width))
    parts.append('</g>')
    return "".join(parts)


def draw_recursive_terrace(x: float, y: float, z: float, w: float, d: float, h: float, depth: int, axis: Tuple[float, float], traits: Dict, colors: Dict[str, str], depth_x: float, depth_y: float, stroke_width: float, offsets: List[float], index_offset: int = 0) -> str:
    parts: List[str] = ['<g class="recursive-terrace self-similar">']
    recess = max(4.0, min(w * 0.22, 7.0 + traits["oxide_intensity"] * 6.0 + depth))
    parts.append(draw_hollow_terrace(x, y, z, w, d, h, recess, colors, depth_x, depth_y, stroke_width))
    if depth > 0 and w > 18 and h > 10:
        child_w = max(12.0, w * (0.62 - depth * 0.04))
        child_d = max(0.45, d * 0.82)
        child_h = max(7.0, h * 0.68)
        offset = offsets[index_offset % len(offsets)] if offsets else 0.0
        child_x = x + w * 0.22 + axis[0] * (8.0 + depth * 3.0) + offset * 0.22
        child_y = y - h * 0.28 + axis[1] * (6.0 + depth * 2.0) + offset * 0.10
        child_z = z + 0.12
        child_colors = {
            "top": _mix_hex(colors["top"], colors["accent"], min(0.58, 0.16 + depth * 0.08)),
            "left": _mix_hex(colors["left"], "#08101b", 0.10),
            "right": _mix_hex(colors["right"], "#07111c", 0.14),
            "stroke": colors["stroke"],
            "accent": colors["accent"],
            "accent_opacity": colors.get("accent_opacity", "0.45"),
        }
        parts.append(draw_recursive_terrace(child_x, child_y, child_z, child_w, child_d, child_h, depth - 1, axis, traits, child_colors, depth_x, depth_y, max(1.0, stroke_width - 0.18), offsets, index_offset + 1))
    parts.append('</g>')
    return "".join(parts)


def draw_growth_branch(anchor_x: float, anchor_y: float, anchor_z: float, direction: str, blocks: int, recursion_depth: int, traits: Dict, colors: Dict[str, str], depth_x: float, depth_y: float, stroke_width: float, offsets: List[float]) -> str:
    axis = {
        "east": (0.72, -0.24),
        "west": (-0.72, 0.24),
        "north": (0.22, -0.78),
        "south": (-0.22, 0.78),
    }[direction]
    parts: List[str] = [f'<g class="growth-branch side-growth side-growth-{direction}">']
    for idx in range(blocks):
        w = max(16.0, 38.0 - idx * 3.6 + traits["edge_bias"] * 6.0)
        d = max(0.65, 1.35 - idx * 0.07)
        h = max(10.0, 26.0 - idx * 2.2)
        x = anchor_x + axis[0] * (idx + 1) * (18 + traits["edge_bias"] * 6) + offsets[idx % len(offsets)] * 0.24
        y = anchor_y + axis[1] * (idx + 1) * (14 + traits["oxide_intensity"] * 5) + offsets[(idx + blocks) % len(offsets)] * 0.12
        z = anchor_z + idx * 0.06
        block_colors = {
            "top": _mix_hex(colors["top"], colors["accent"], min(0.55, 0.12 + idx * 0.08)),
            "left": _mix_hex(colors["left"], "#08101b", 0.12),
            "right": _mix_hex(colors["right"], "#08101b", 0.18),
            "stroke": colors["stroke"],
            "accent": colors["accent"],
            "accent_opacity": colors.get("accent_opacity", "0.45"),
        }
        parts.append(draw_recursive_terrace(x, y, z, w, d, h, recursion_depth, axis, traits, block_colors, depth_x, depth_y, max(1.0, stroke_width - 0.2), offsets, idx * 2))
    parts.append('</g>')
    return "".join(parts)


def draw_bismuth_growth(cx: float, base_y: float, traits: Dict, seed_material: Dict, palette: List[str], scale: float = 1.0, include_id: bool = True) -> str:
    layer_count = traits["layer_count"]
    shard_count = traits["shard_count"]
    oxide_intensity = traits["oxide_intensity"]
    edge_bias = traits["edge_bias"]
    symmetry = traits["symmetry"]
    rarity = traits["rarity"]
    geometry_style = traits["geometry_style"]

    depth_x = (20 + edge_bias * 14) * scale
    depth_y = (11 + edge_bias * 7) * scale
    stroke_width = 1.35 + edge_bias * 1.45
    levels = max(6, min(11, layer_count // 2 + 3))
    base_w = (84 + min(shard_count, 14) * 1.4 + (6 if geometry_style == "fractured" else 0)) * scale
    base_d = 2.7 + (0.20 if symmetry == "high" else 0.12 if symmetry == "medium" else 0.04)
    level_h = (25 + oxide_intensity * 10 + layer_count * 0.45) * scale
    taper_step = (5.2 + (0.6 if geometry_style == "stepped" else 0.0)) * scale
    recess_step = (10 + oxide_intensity * 12) * scale

    top_color = _mix_hex(palette[0], "#f4f8ff", 0.40)
    left_color = _mix_hex(palette[1], "#08101c", 0.40)
    right_color = _mix_hex(palette[2], "#060c15", 0.34)
    accent = _mix_hex(palette[3], "#fef08a", 0.34)
    stroke = _mix_hex("#d8e7ff", palette[-1], 0.14)
    colors = {
        "top": top_color,
        "left": left_color,
        "right": right_color,
        "stroke": stroke,
        "accent": accent,
        "accent_opacity": f'{0.32 + oxide_intensity * 0.42:.3f}',
    }

    tower_offsets = deterministic_offsets_from_seed(seed_material["shape_seed"], levels, 8 * scale)
    side_offsets = deterministic_offsets_from_seed(seed_material["layer_seed"], 24, 9 * scale)
    corner_offsets = deterministic_offsets_from_seed(seed_material["symmetry_seed"], 16, 6 * scale)

    base_x = cx - base_w / 2
    base_z = 0.0
    parts: List[str] = []
    parts.append('<g id="bismuth-crystal" class="bismuth-crystal hopper-crystal bismuth-growth fractal-hopper">' if include_id else '<g class="bismuth-crystal hopper-crystal bismuth-growth fractal-hopper">')

    if rarity in {"rare", "mythic"}:
        ring_w = base_w + 180 * scale
        ring_h = level_h * levels + 140 * scale
        parts.append(
            f'<rect x="{cx - ring_w / 2:.2f}" y="{base_y - ring_h - 30 * scale:.2f}" width="{ring_w:.2f}" height="{ring_h:.2f}" '
            f'fill="none" stroke="{accent}" stroke-opacity="0.26" stroke-width="{stroke_width + 0.6:.2f}" rx="18" ry="18" />'
        )

    parts.append(draw_hopper_tower(base_x, base_y, base_z, levels, base_w, base_d, level_h, recess_step, taper_step, tower_offsets, colors, depth_x, depth_y, stroke_width))

    side_blocks = max(2, min(4, shard_count // 6 + 1))
    recursion_depth = max(1, min(3, layer_count // 4 + (1 if shard_count > 12 else 0)))
    core_span = base_w * 0.26
    parts.append(draw_growth_branch(cx + core_span, base_y - level_h * 0.95, base_z + 0.18, "east", side_blocks, recursion_depth, traits, colors, depth_x, depth_y, stroke_width, side_offsets[: max(8, side_blocks * 2)]))
    parts.append(draw_growth_branch(cx - core_span, base_y - level_h * 0.88, base_z + 0.18, "west", side_blocks, recursion_depth, traits, colors, depth_x, depth_y, stroke_width, side_offsets[side_blocks * 2 : side_blocks * 4 + 4]))
    north_blocks = max(2, side_blocks - (0 if symmetry == "high" else 1))
    south_blocks = max(2, side_blocks - (1 if geometry_style == "hopper" else 0))
    parts.append(draw_growth_branch(cx - 8 * scale, base_y - level_h * 1.35, base_z + 0.26, "north", north_blocks, max(1, recursion_depth - 1), traits, colors, depth_x, depth_y, stroke_width, side_offsets[8: 16]))
    parts.append(draw_growth_branch(cx + 6 * scale, base_y - level_h * 0.42, base_z + 0.10, "south", south_blocks, recursion_depth, traits, colors, depth_x, depth_y, stroke_width, side_offsets[12: 20]))

    corner_count = max(4, min(8, round(shard_count * 0.28 + edge_bias * 4)))
    corner_dirs = [(-1, -1), (1, -1), (-1, 1), (1, 1)]
    parts.append('<g class="corner-growth">')
    for idx in range(corner_count):
        dx, dy = corner_dirs[idx % len(corner_dirs)]
        w = max(14 * scale, (30 - (idx % 3) * 3) * scale)
        d = max(0.6, 1.15 - (idx % 2) * 0.08)
        h = max(10 * scale, (22 - (idx % 4) * 2) * scale)
        x = cx + dx * (base_w * 0.30 + 12 * scale + (idx // 4) * 8 * scale) - w / 2 + corner_offsets[idx] * 0.22
        y = base_y + dy * (10 * scale + (idx // 4) * 5 * scale) - (idx % 3) * 4 * scale
        z = 0.12 + (idx % 4) * 0.04
        corner_colors = {
            "top": _mix_hex(colors["top"], colors["accent"], 0.22 + (idx % 3) * 0.08),
            "left": colors["left"],
            "right": colors["right"],
            "stroke": colors["stroke"],
            "accent": colors["accent"],
            "accent_opacity": colors["accent_opacity"],
        }
        parts.append(draw_iso_cuboid(x, y, z, w, d, h, corner_colors, class_name="iso-cuboid edge-growth", depth_x=depth_x, depth_y=depth_y, stroke_width=max(1.0, stroke_width - 0.25), opacity=0.95))
    parts.append('</g>')
    parts.append('</g>')
    return "".join(parts)


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
