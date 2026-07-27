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


def _seed_fraction(hex_value: str, start: int, length: int = 8) -> float:
    segment = hex_value[start : start + length]
    if not segment:
        return 0.0
    return int(segment, 16) / int("f" * len(segment), 16)


def _pick_family(seed: str, options: List[str], start: int) -> str:
    return options[int(seed[start : start + 2], 16) % len(options)]


def _build_visible_morphology(metadata: Dict) -> Dict[str, object]:
    traits = metadata["visual_traits"]
    seeds = metadata["derived_seeds"]
    growth = metadata["action_growth_map"]
    changed_files = growth["changed_files"]["source"] or []
    scope = str(growth["scope"]["source"] or "").lower()
    authority = str(growth["authority"]["source"] or "").lower()
    verifier = growth["verifier_result"]["source"] or {}
    verifier_status = str(verifier.get("status", "unknown")).lower() if isinstance(verifier, dict) else str(verifier).lower()
    trust = growth["signature_trust_block"]["source"] or {}
    trust_state = json.dumps(trust, sort_keys=True) if isinstance(trust, dict) else str(trust)
    trust_score = int(hashlib.sha256(trust_state.encode("utf-8")).hexdigest()[:6], 16) / 0xFFFFFF

    master = seeds["master_seed"]
    shape = seeds["shape_seed"]
    oxide = seeds["oxide_seed"]
    trait = seeds["trait_seed"]

    cavity_bias = _seed_fraction(shape, 0)
    skew_bias = _seed_fraction(shape, 8)
    drift_bias = _seed_fraction(shape, 16)
    shoulder_bias = _seed_fraction(master, 8)
    branch_bias = _seed_fraction(master, 24)
    terrace_bias = _seed_fraction(trait, 0)
    seal_bias = _seed_fraction(oxide, 16)

    changed_count = len(changed_files)
    scope_factor = {
        "session": 0.34,
        "workspace": 0.58,
        "repo": 0.76,
        "global": 1.0,
    }.get(scope, 0.48)
    authority_factor = 0.92 if authority in {"owner", "root", "system"} else 0.66 if authority in {"admin", "maintainer"} else 0.42
    verify_factor = 1.0 if verifier_status in {"verified", "valid", "ok"} else 0.72 if verifier_status in {"pending", "present"} else 0.36

    core_family = _pick_family(master, ["spindle", "vault", "split", "seeded"], 10)
    shell_family = _pick_family(shape, ["buttress", "fan", "terrace", "geode"], 12)

    return {
        "core_family": core_family,
        "shell_family": shell_family,
        "capsule_tilt": round((skew_bias - 0.5) * 26, 2),
        "capsule_slump": round((drift_bias - 0.5) * 52, 2),
        "core_offset_x": round((drift_bias - 0.5) * 54, 2),
        "core_offset_y": round((terrace_bias - 0.5) * 28, 2),
        "core_width_scale": round(0.88 + shoulder_bias * 0.28, 4),
        "core_height_scale": round(0.9 + terrace_bias * 0.2, 4),
        "spine_shift": round((seal_bias - 0.5) * 0.18, 4),
        "mass_bias": round(0.84 + scope_factor * 0.34 + changed_count * 0.028 + branch_bias * 0.12, 4),
        "shoulder_bias": round(0.22 + shoulder_bias * 0.56 + authority_factor * 0.18, 4),
        "cavity_bias": round(0.18 + cavity_bias * 0.62 + (1 - verify_factor) * 0.16, 4),
        "terrace_bias": round(0.18 + terrace_bias * 0.64 + min(0.16, changed_count * 0.015), 4),
        "branch_count": 1 + min(2, changed_count // 2) + int(branch_bias * 1.2),
        "branch_side": -1 if skew_bias < 0.5 else 1,
        "shelf_count": 2 + int(scope_factor * 1.6) + int(cavity_bias * 1.2),
        "lobe_count": 1 + int(scope_factor * 0.8) + int(branch_bias * 0.9),
        "lobe_skew": round((branch_bias - 0.5) * 1.24, 4),
        "cavity_side": -1 if cavity_bias < 0.46 else 1,
        "seal_brightness": round(0.34 + verify_factor * 0.52 + trust_score * 0.08, 4),
        "trust_accent": round(0.2 + trust_score * 0.52, 4),
    }


def _capsule_spec(symmetry: str, edge_bias: float, geometry_style: str, morphology: Dict[str, object]) -> Dict[str, float]:
    symmetry_factor = {"low": 0.92, "medium": 1.0, "high": 1.08}[symmetry]
    style_factor = {
        "hopper": 1.0,
        "radial": 0.94,
        "stepped": 0.98,
        "fractured": 0.9,
    }[geometry_style]
    width_scale = float(morphology["core_width_scale"])
    height_scale = float(morphology["core_height_scale"])
    x_drift = float(morphology["core_offset_x"])
    y_drift = float(morphology["core_offset_y"])
    w = (118 + edge_bias * 34) * symmetry_factor * style_factor * width_scale
    h = (272 + edge_bias * 44) * symmetry_factor * height_scale
    x = CENTER_X - w / 2 + x_drift
    y = (CENTER_Y - 18) - h / 2 + y_drift + 26
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
    morphology: Dict[str, object],
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

    mass_bias = float(morphology["mass_bias"])
    cavity_bias = float(morphology["cavity_bias"])
    terrace_bias = float(morphology["terrace_bias"])
    capsule_slump = float(morphology["capsule_slump"])
    branch_side = int(morphology["branch_side"])
    branch_count = max(1, min(3, int(morphology["branch_count"])))
    shelf_count = max(2, min(4, int(morphology["shelf_count"])))
    shoulder_bias = float(morphology.get("shoulder_bias", 0.5))

    cx = CENTER_X + float(morphology["core_offset_x"]) * 0.42
    cy = CENTER_Y - 8 + float(morphology["core_offset_y"]) * 0.22 + capsule_slump * 0.18
    base_w = 700 * symmetry_factor * geometry_scale * max(0.92, mass_bias * 0.94)
    base_h = 700 * symmetry_factor * geometry_scale * max(0.88, mass_bias - cavity_bias * 0.08)
    capsule = _capsule_spec(symmetry, edge_bias, geometry_style, morphology)

    shell = {
        "x": cx - base_w * (0.245 + shoulder_bias * 0.02) + branch_side * base_w * 0.018,
        "y": cy - base_h * (0.292 + cavity_bias * 0.022),
        "w": base_w * (0.5 + shoulder_bias * 0.03),
        "h": base_h * (0.82 + terrace_bias * 0.045),
        "notch": 42.0,
    }
    pedestal = {
        "x": cx - base_w * 0.11 + branch_side * base_w * 0.065,
        "y": cy + base_h * 0.25,
        "w": base_w * 0.3,
        "h": base_h * 0.16,
        "notch": 28.0,
    }
    shoulder = {
        "x": cx - base_w * 0.13 + branch_side * base_w * 0.06,
        "y": cy - base_h * 0.03,
        "w": base_w * (0.27 + shoulder_bias * 0.025),
        "h": base_h * 0.145,
        "notch": 24.0,
    }
    branch = {
        "x": cx + branch_side * base_w * 0.17 - (base_w * 0.11 if branch_side > 0 else base_w * 0.02),
        "y": cy + base_h * 0.015,
        "w": base_w * 0.19,
        "h": base_h * (0.28 + terrace_bias * 0.07),
        "notch": 22.0,
    }
    crown = {
        "x": cx - base_w * 0.035 + branch_side * base_w * 0.05,
        "y": cy - base_h * 0.2,
        "w": base_w * 0.16,
        "h": base_h * 0.105,
        "notch": 18.0,
    }

    terraces.extend([shell, pedestal, shoulder, branch, crown])

    spur_side = -branch_side
    spur_width = base_w * (0.12 + shelf_count * 0.012 + terrace_bias * 0.02)
    spur_height = base_h * (0.16 + branch_count * 0.018 + cavity_bias * 0.018)
    terraces.append(
        {
            "x": shell["x"] + (shell["w"] - spur_width * 0.38 if spur_side > 0 else -spur_width * 0.62),
            "y": shell["y"] + shell["h"] * (0.11 + cavity_bias * 0.08),
            "w": spur_width,
            "h": spur_height,
            "notch": 18.0,
        }
    )

    lower_shelf_width = base_w * (0.16 + terrace_bias * 0.04)
    lower_shelf_height = base_h * (0.1 + cavity_bias * 0.025)
    terraces.append(
        {
            "x": shell["x"] + shell["w"] * (0.18 + (0.24 if branch_side > 0 else 0.04)) - lower_shelf_width * 0.5,
            "y": shell["y"] + shell["h"] - lower_shelf_height * 0.36,
            "w": lower_shelf_width,
            "h": lower_shelf_height,
            "notch": 16.0,
        }
    )

    upper_fin_width = base_w * (0.1 + shoulder_bias * 0.035)
    upper_fin_height = base_h * (0.11 + terrace_bias * 0.03)
    terraces.append(
        {
            "x": shell["x"] + shell["w"] * (0.34 + branch_side * 0.16) - upper_fin_width * 0.5,
            "y": shell["y"] - upper_fin_height * (0.52 + shoulder_bias * 0.14),
            "w": upper_fin_width,
            "h": upper_fin_height,
            "notch": 15.0,
        }
    )

    if branch_count > 1:
        side_tower_width = base_w * (0.08 + terrace_bias * 0.025)
        side_tower_height = base_h * (0.18 + shoulder_bias * 0.03)
        terraces.append(
            {
                "x": shell["x"] + (shell["w"] - side_tower_width * 0.3 if branch_side > 0 else -side_tower_width * 0.7),
                "y": shell["y"] + shell["h"] * (0.46 - cavity_bias * 0.08),
                "w": side_tower_width,
                "h": side_tower_height,
                "notch": 16.0,
            }
        )

    inner_w = shell["w"] * (0.56 + cavity_bias * 0.04)
    inner_h = shell["h"] * (0.46 + cavity_bias * 0.05)
    cavity_side = int(morphology.get("cavity_side", 1))
    pocket = {
        "x": capsule["x"] - inner_w * (0.21 + cavity_bias * 0.04) + cavity_side * shell["w"] * 0.03,
        "y": capsule["y"] - inner_h * (0.06 + cavity_bias * 0.03),
        "w": inner_w,
        "h": inner_h,
        "notch": 26.0,
    }
    terraces.append(pocket)

    shard_total = min(6, max(3, shard_count // 3))
    cell_w = pocket["w"] / 3.6
    cell_h = pocket["h"] / 3.8
    for idx in range(shard_total):
        col = idx % 2
        row = idx // 2
        side = branch_side if col else -branch_side
        shard = {
            "x": pocket["x"] + 18 + col * cell_w + side * (row * 12 + 6),
            "y": pocket["y"] + 18 + row * cell_h + col * 8,
            "w": max(24.0, cell_w * (0.42 - row * 0.03)),
            "h": max(22.0, cell_h * (0.34 - col * 0.03)),
        }
        if not _rects_overlap(shard, capsule, padding=10):
            shards.append(shard)

    return terraces, shards, capsule



def _cell_seed(morphology: Dict[str, object], gx: int, gy: int) -> str:
    return sha256_hex(
        f"{morphology['core_family']}|{morphology['shell_family']}|{morphology['mass_bias']}|"
        f"{morphology['terrace_bias']}|{morphology['cavity_bias']}|{gx}|{gy}"
    )



def _build_hopper_lattice(
    terraces: List[Dict[str, float]],
    capsule: Dict[str, float],
    traits: Dict[str, object],
    morphology: Dict[str, object],
) -> Tuple[List[Dict[str, float]], Dict[str, float]]:
    if not terraces:
        return [], {"x": CENTER_X - 180, "y": CENTER_Y - 180, "w": 360, "h": 360, "notch": 28.0}

    shell = terraces[0]
    shelf_count = max(2, min(4, int(morphology["shelf_count"])))
    branch_count = max(1, min(3, int(morphology["branch_count"])))
    branch_side = int(morphology["branch_side"])
    cavity_side = int(morphology.get("cavity_side", 1))
    cavity_bias = float(morphology["cavity_bias"])
    terrace_bias = float(morphology["terrace_bias"])
    shoulder_bias = float(morphology["shoulder_bias"])
    mass_bias = float(morphology["mass_bias"])
    trust_accent = float(morphology["trust_accent"])
    oxide = float(traits["oxide_intensity"])

    cols = 10 + int(terrace_bias * 4) + int(mass_bias * 2)
    rows = 8 + shelf_count * 2 + int(terrace_bias * 3)
    cell_w = shell["w"] / cols
    cell_h = shell["h"] / rows
    center_x = capsule["x"] + capsule["w"] * 0.5
    center_y = capsule["y"] + capsule["h"] * 0.52
    edge_extent = max(shell["w"], shell["h"]) * 0.52
    anchor_gate = 0.28 + trust_accent * 0.34
    continuity = 0.62 + shoulder_bias * 0.22 - cavity_bias * 0.12

    cells: List[Dict[str, float]] = []
    for gy in range(rows):
        row_t = gy / max(1, rows - 1)
        for gx in range(cols):
            seed = _cell_seed(morphology, gx, gy)
            jitter_x = (_seed_fraction(seed, 0, 4) - 0.5) * cell_w * 0.28
            jitter_y = (_seed_fraction(seed, 4, 4) - 0.5) * cell_h * 0.22
            x = shell["x"] + gx * cell_w + jitter_x
            y = shell["y"] + gy * cell_h + jitter_y
            w = cell_w * (0.98 + _seed_fraction(seed, 8, 4) * 0.12)
            h = cell_h * (0.98 + _seed_fraction(seed, 12, 4) * 0.1)
            cx = x + w * 0.5
            cy = y + h * 0.5

            dx = (cx - center_x) / max(1.0, shell["w"] * 0.52)
            dy = (cy - center_y) / max(1.0, shell["h"] * 0.56)
            radial = math.sqrt(dx * dx + dy * dy)
            shape_bias = 1.12 - abs(dx) * (0.18 + shoulder_bias * 0.08) - max(0.0, -dy) * 0.08
            inside_shell = radial < shape_bias
            if not inside_shell:
                continue

            pocket_dx = (cx - (center_x + cavity_side * shell["w"] * 0.05)) / max(1.0, capsule["w"] * (0.84 + cavity_bias * 0.24))
            pocket_dy = (cy - (center_y + shell["h"] * 0.02)) / max(1.0, capsule["h"] * (0.9 + cavity_bias * 0.3))
            pocket_metric = pocket_dx * pocket_dx + pocket_dy * pocket_dy
            if pocket_metric < 0.94 - cavity_bias * 0.18:
                continue
            if pocket_metric < 1.18 + cavity_bias * 0.18 and cy > center_y - shell["h"] * 0.08:
                continue

            edge_strength = max(abs(dx), abs(dy))
            terrace_height = max(1, int((edge_strength * (3.2 + terrace_bias * 2.8)) + (1.0 - row_t) * 1.8))
            if pocket_metric < 1.55:
                terrace_height = max(1, terrace_height - 1)
            if cy < center_y - shell["h"] * 0.18:
                terrace_height += 1

            density_gate = continuity + edge_strength * 0.22
            if _seed_fraction(seed, 16, 4) > density_gate:
                if terrace_height <= 2 or pocket_metric < 1.7:
                    continue
                terrace_height -= 1

            if branch_count >= 2 and gx > cols * 0.62 and branch_side > 0:
                terrace_height += 1
            if branch_count >= 2 and gx < cols * 0.38 and branch_side < 0:
                terrace_height += 1
            if branch_count >= 3 and gy > rows * 0.55 and abs(dx) < 0.28:
                terrace_height += 1

            edge_tick = edge_strength > anchor_gate and _seed_fraction(seed, 20, 4) > 0.58
            if edge_tick:
                terrace_height += 1

            height_cap = 5 + shelf_count + int(oxide * 2)
            terrace_height = min(height_cap, terrace_height)
            if terrace_height <= 0:
                continue

            cells.append(
                {
                    "x": x,
                    "y": y,
                    "w": w,
                    "h": h,
                    "notch": max(8.0, min(w, h) * (0.16 + _seed_fraction(seed, 24, 4) * 0.14)),
                    "height": terrace_height,
                    "edge_tick": edge_tick,
                    "seed": seed,
                    "radial": radial,
                    "pocket_metric": pocket_metric,
                }
            )

    return cells, shell



def _stepped_rect_points(rect: Dict[str, float], inset: float = 0.0) -> List[Tuple[float, float]]:
    x = rect["x"] + inset
    y = rect["y"] + inset
    w = max(10.0, rect["w"] - inset * 2)
    h = max(10.0, rect["h"] - inset * 2)
    notch = max(6.0, min(rect["notch"], w * 0.28, h * 0.28))
    mid_w = max(10.0, w * 0.22)
    mid_h = max(10.0, h * 0.22)

    seed = sha256_hex(f"{rect['x']:.2f}|{rect['y']:.2f}|{rect['w']:.2f}|{rect['h']:.2f}|{rect['notch']:.2f}|{inset:.2f}")
    shoulder_drop = h * (0.028 + _seed_fraction(seed, 0, 4) * 0.05)
    right_shear = w * ((_seed_fraction(seed, 4, 4) - 0.5) * 0.06)
    left_shear = w * ((_seed_fraction(seed, 8, 4) - 0.5) * 0.05)
    lower_push = h * (_seed_fraction(seed, 12, 4) * 0.05)
    upper_push = h * (_seed_fraction(seed, 16, 4) * 0.04)

    return [
        (x + left_shear * 0.35, y + shoulder_drop * 0.2),
        (x + w + right_shear * 0.22, y + shoulder_drop * 0.06),
        (x + w + right_shear, y + h * 0.31 + upper_push),
        (x + w - notch * (0.94 + _seed_fraction(seed, 20, 4) * 0.08), y + h * 0.35 + upper_push * 0.65),
        (x + w - notch * (0.98 + _seed_fraction(seed, 24, 4) * 0.05), y + h - notch + lower_push * 0.35),
        (x + w - notch - mid_w * (0.94 + _seed_fraction(seed, 28, 4) * 0.1), y + h - notch * 0.96),
        (x + w - notch - mid_w * (0.98 + _seed_fraction(seed, 32, 4) * 0.05), y + h - lower_push * 0.22),
        (x + notch * (0.9 + _seed_fraction(seed, 36, 4) * 0.1), y + h),
        (x + notch * (0.98 + _seed_fraction(seed, 40, 4) * 0.06), y + h - mid_h * (0.9 + _seed_fraction(seed, 44, 4) * 0.1)),
        (x + left_shear, y + h - mid_h * (0.96 + _seed_fraction(seed, 48, 4) * 0.06) - lower_push * 0.18),
    ]



def _offset_points(points: List[Tuple[float, float]], dx: float, dy: float) -> List[Tuple[float, float]]:
    return [(round(px + dx, 2), round(py + dy, 2)) for px, py in points]



def _polygon_tag(points: List[Tuple[float, float]], **attrs: object) -> str:
    joined = points_to_svg([(round(px, 2), round(py, 2)) for px, py in points])
    attr_text = " ".join(f'{key.replace("_", "-")}="{value}"' for key, value in attrs.items())
    return f'<polygon points="{joined}" {attr_text} />'



def _terrace_surface_polygons(rect: Dict[str, float], lift: float, depth: float) -> Dict[str, List[Tuple[float, float]]]:
    front = _stepped_rect_points(rect)
    seed = sha256_hex(f"surface|{rect['x']:.2f}|{rect['y']:.2f}|{rect['w']:.2f}|{rect['h']:.2f}|{lift:.2f}|{depth:.2f}")
    top_dx = -lift * (0.84 + _seed_fraction(seed, 0, 4) * 0.22)
    top_dy = -lift * (0.66 + _seed_fraction(seed, 4, 4) * 0.24)
    side_dx = depth * (0.9 + _seed_fraction(seed, 8, 4) * 0.24)
    side_dy = depth * (0.42 + _seed_fraction(seed, 12, 4) * 0.22)
    top = _offset_points(front, top_dx, top_dy)
    side = _offset_points(front, side_dx, side_dy)
    return {"front": front, "top": top, "side": side}



def _terrace_connectors(front: List[Tuple[float, float]], shifted: List[Tuple[float, float]], edge_indexes: List[int]) -> List[List[Tuple[float, float]]]:
    quads: List[List[Tuple[float, float]]] = []
    count = len(front)
    for idx in edge_indexes:
        next_idx = (idx + 1) % count
        quads.append([front[idx], front[next_idx], shifted[next_idx], shifted[idx]])
    return quads



def _render_fused_specimen_body(body: List[str], terraces: List[Dict[str, float]], capsule: Dict[str, float], palette: List[str], traits: Dict[str, object], morphology: Dict[str, object]) -> None:
    if not terraces:
        return

    oxide = float(traits["oxide_intensity"])
    trust_accent = float(morphology["trust_accent"])
    cavity_bias = float(morphology["cavity_bias"])
    terrace_bias = float(morphology["terrace_bias"])
    shell_layers = terraces[:-1]

    for idx, rect in enumerate(reversed(shell_layers)):
        layer_idx = len(shell_layers) - 1 - idx
        surf = _terrace_surface_polygons(rect, lift=13.0 + layer_idx * 2.1, depth=17.0 + layer_idx * 2.5)
        front = surf["front"]
        top = surf["top"]
        side = surf["side"]
        color = palette[(layer_idx + 1) % len(palette)]

        shadow_front = _offset_points(front, 10.0 + layer_idx * 1.5, 11.0 + layer_idx * 1.8)
        body.append(_polygon_tag(shadow_front, fill="#000000", fill_opacity=f"{0.07 + layer_idx * 0.026 + cavity_bias * 0.04:.4f}", stroke="none"))

        for quad in _terrace_connectors(front, top, [0, 1, 8, 9]):
            body.append(_polygon_tag(quad, fill="#fbfeff", fill_opacity=f"{0.11 + layer_idx * 0.028 + terrace_bias * 0.042:.4f}", stroke="none"))
        for quad in _terrace_connectors(front, side, [2, 3, 4, 5, 6]):
            body.append(_polygon_tag(quad, fill="#010308", fill_opacity=f"{0.34 + layer_idx * 0.058 + cavity_bias * 0.04:.4f}", stroke="none"))

        body.append(
            _polygon_tag(
                front,
                fill="url(#metalFace)",
                fill_opacity=f"{0.68 + layer_idx * 0.03:.4f}",
                stroke=color,
                stroke_opacity=f"{0.24 + trust_accent * 0.12 - layer_idx * 0.016:.4f}",
                stroke_width=f"{1.8 - layer_idx * 0.16:.2f}",
            )
        )
        body.append(
            _polygon_tag(
                front,
                fill="url(#oxide)",
                fill_opacity=f"{0.13 + layer_idx * 0.04 + oxide * 0.06:.4f}",
                stroke="none",
            )
        )

        inset = min(18.0 + layer_idx * 5.0, rect["w"] * 0.14, rect["h"] * 0.14)
        if inset > 8:
            inner = _stepped_rect_points(rect, inset=inset)
            body.append(
                _polygon_tag(
                    inner,
                    fill="#04070c",
                    fill_opacity=f"{0.26 + layer_idx * 0.055 + cavity_bias * 0.05:.4f}",
                    stroke=palette[(layer_idx + 2) % len(palette)],
                    stroke_opacity=f"{0.1 + layer_idx * 0.022:.4f}",
                    stroke_width="1.0",
                )
            )
            ridge = _stepped_rect_points(rect, inset=max(8.0, inset * 0.42))
            body.append(
                _polygon_tag(
                    ridge,
                    fill="none",
                    stroke="#f9fdff",
                    stroke_opacity=f"{0.08 + terrace_bias * 0.045 - layer_idx * 0.006:.4f}",
                    stroke_width="0.95",
                )
            )

    pocket = terraces[-1] if terraces else None
    if pocket:
        pocket_base = _stepped_rect_points(pocket, inset=min(12.0, pocket["w"] * 0.12, pocket["h"] * 0.12))
        for step in range(5, -1, -1):
            front = _offset_points(pocket_base, step * 11.0, step * 7.8)
            top = _offset_points(front, -(8.6 + step * 1.0), -(6.2 + step * 0.9))
            side = _offset_points(front, 8.8 + step * 1.0, 5.6 + step * 0.8)
            body.append(_polygon_tag(_offset_points(front, 9.0 + step * 0.8, 10.0 + step * 0.9), fill="#000000", fill_opacity=f"{0.05 + step * 0.018:.4f}", stroke="none"))
            for quad in _terrace_connectors(front, top, [0, 1, 8, 9]):
                body.append(_polygon_tag(quad, fill="#fbfdff", fill_opacity=f"{0.07 + step * 0.013:.4f}", stroke="none"))
            for quad in _terrace_connectors(front, side, [2, 3, 4, 5]):
                body.append(_polygon_tag(quad, fill="#010308", fill_opacity=f"{0.3 + step * 0.06 + cavity_bias * 0.07:.4f}", stroke="none"))
            body.append(
                _polygon_tag(
                    front,
                    fill="#03060b",
                    fill_opacity=f"{0.46 + step * 0.05 + cavity_bias * 0.09:.4f}",
                    stroke=palette[(step + 2) % len(palette)],
                    stroke_opacity=f"{0.1 + step * 0.014:.4f}",
                    stroke_width="1.0",
                )
            )


def _render_hopper_lattice(body: List[str], terraces: List[Dict[str, float]], capsule: Dict[str, float], palette: List[str], traits: Dict[str, object], morphology: Dict[str, object]) -> None:
    cells, shell = _build_hopper_lattice(terraces, capsule, traits, morphology)
    if not cells:
        return

    oxide = float(traits["oxide_intensity"])
    terrace_bias = float(morphology["terrace_bias"])
    cavity_bias = float(morphology["cavity_bias"])
    trust_accent = float(morphology["trust_accent"])
    seal_brightness = float(morphology["seal_brightness"])

    def sort_key(cell: Dict[str, float]) -> Tuple[float, float, float]:
        return (cell["y"] + cell["height"] * 8.0, cell["radial"], cell["x"])

    for idx, cell in enumerate(sorted(cells, key=sort_key)):
        base = {"x": cell["x"], "y": cell["y"], "w": cell["w"], "h": cell["h"], "notch": cell["notch"]}
        levels = max(1, min(4, int(cell["height"])))
        for level in range(levels):
            shrink = level * min(base["w"], base["h"]) * 0.14
            if shrink * 2 >= min(base["w"], base["h"]) * 0.76:
                break
            rect = {
                "x": base["x"] + shrink * 0.34,
                "y": base["y"] + shrink * 0.5,
                "w": max(10.0, base["w"] - shrink * 0.7),
                "h": max(10.0, base["h"] - shrink * 0.84),
                "notch": max(6.0, base["notch"] - level * 0.75),
            }
            surf = _terrace_surface_polygons(rect, 5.8 + level * 1.1, 6.7 + level * 1.05)
            front = surf["front"]
            top = surf["top"]
            side = surf["side"]
            front_opacity = 0.065 + oxide * 0.03 + level * 0.02 + (0.016 if cell["pocket_metric"] < 1.8 else 0.0)
            top_opacity = 0.048 + terrace_bias * 0.024 + level * 0.012
            side_opacity = 0.12 + cavity_bias * 0.045 + level * 0.02

            body.append(_polygon_tag(_offset_points(front, 3.0 + level * 1.1, 4.0 + level * 1.0), fill="#000000", fill_opacity=f"{0.03 + level * 0.018:.4f}", stroke="none"))
            for quad in _terrace_connectors(front, top, [0, 1, 8, 9]):
                body.append(_polygon_tag(quad, fill="#fcfeff", fill_opacity=f"{top_opacity:.4f}", stroke="none"))
            for quad in _terrace_connectors(front, side, [2, 3, 4, 5]):
                body.append(_polygon_tag(quad, fill="#02050a", fill_opacity=f"{side_opacity:.4f}", stroke="none"))

            body.append(
                _polygon_tag(
                    front,
                    fill="#0a0f16" if level == 0 else "#05080d",
                    fill_opacity=f"{front_opacity:.4f}",
                    stroke=palette[(idx + level + 1) % len(palette)],
                    stroke_opacity=f"{0.03 + level * 0.01 + trust_accent * 0.01:.4f}",
                    stroke_width="0.55",
                )
            )
            if level == levels - 1 and rect["w"] > 24 and rect["h"] > 24:
                inner = _stepped_rect_points(rect, inset=min(4.4 + level, rect["w"] * 0.12, rect["h"] * 0.12))
                body.append(
                    _polygon_tag(
                        inner,
                        fill="#03060b",
                        fill_opacity=f"{0.14 + cell['radial'] * 0.05:.4f}",
                        stroke="#ffffff",
                        stroke_opacity=f"{0.025 + level * 0.008:.4f}",
                        stroke_width="0.5",
                    )
                )

        if cell["edge_tick"] and cell["radial"] > 0.84:
            tick_x = cell["x"] + cell["w"] * (0.82 if cell["x"] > CENTER_X else 0.18)
            tick_y = cell["y"] + cell["h"] * 0.18
            tick_h = cell["h"] * (0.24 + seal_brightness * 0.05)
            body.append(
                f'<rect x="{tick_x:.2f}" y="{tick_y:.2f}" width="{max(4.0, cell["w"] * 0.05):.2f}" height="{tick_h:.2f}" '
                f'rx="3" ry="3" fill="#ffffff" fill-opacity="{0.07 + trust_accent * 0.035:.4f}" />'
            )

def _render_center_capsule(body: List[str], capsule: Dict[str, float], palette: List[str], traits: Dict[str, object], morphology: Dict[str, object]) -> None:
    x = capsule["x"]
    y = capsule["y"]
    w = capsule["w"]
    h = capsule["h"]
    r = capsule["r"]
    shell_x = x - 10
    shell_y = y - 12
    shell_w = w + 20
    shell_h = h + 24
    shell_r = min(40.0, r + 7)
    oxide = float(traits["oxide_intensity"])
    status_glow = 0.04 + oxide * 0.045 + float(morphology["seal_brightness"]) * 0.04
    core_family = str(morphology["core_family"])
    tilt = float(morphology["capsule_tilt"])
    slump = float(morphology["capsule_slump"])
    spine_shift = float(morphology["spine_shift"])
    trust_accent = float(morphology["trust_accent"])

    body.append(
        f'<ellipse id="capsule-seat-shadow" cx="{x + w * 0.56 + tilt * 0.14:.2f}" cy="{y + h * 0.6 + slump * 0.1:.2f}" rx="{w * 0.88:.2f}" ry="{h * 0.52:.2f}" '
        f'fill="#000000" fill-opacity="{0.22 + oxide * 0.08:.4f}" />'
    )
    body.append(
        f'<rect id="capsule-seat" x="{shell_x - 12:.2f}" y="{shell_y - 10:.2f}" width="{shell_w + 18:.2f}" height="{shell_h + 18:.2f}" '
        f'rx="{shell_r + 8:.2f}" ry="{shell_r + 8:.2f}" fill="#03060b" fill-opacity="0.7" stroke="#f4f9ff" stroke-opacity="0.05" stroke-width="1.1" '
        f'transform="rotate({tilt * 0.92:.2f} {x + w / 2:.2f} {y + h / 2:.2f})" />'
    )
    body.append(
        f'<ellipse id="capsule-aura" cx="{x + w * 0.5 + tilt * 0.18:.2f}" cy="{y + h * 0.46 + slump * 0.13:.2f}" rx="{w * 0.9:.2f}" ry="{h * 0.56:.2f}" '
        f'fill="url(#capsuleAura)" fill-opacity="{status_glow:.4f}" />'
    )
    body.append(
        f'<rect id="capsule-shell" x="{shell_x:.2f}" y="{shell_y:.2f}" width="{shell_w:.2f}" height="{shell_h:.2f}" '
        f'rx="{shell_r:.2f}" ry="{shell_r:.2f}" fill="#05080e" fill-opacity="0.82" stroke="{palette[-1]}" stroke-opacity="{0.12 + trust_accent * 0.12:.4f}" stroke-width="1.25" '
        f'transform="rotate({tilt:.2f} {x + w / 2:.2f} {y + h / 2:.2f})" />'
    )
    body.append(
        f'<rect id="capsule-core" x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" '
        f'rx="{r:.2f}" ry="{r:.2f}" fill="url(#coreFace)" stroke="#f8fbff" stroke-opacity="0.66" stroke-width="1.85" '
        f'transform="rotate({tilt * 0.82:.2f} {x + w / 2:.2f} {y + h / 2:.2f})" />'
    )
    body.append(
        f'<rect id="capsule-core-inner" x="{x + 8:.2f}" y="{y + 10:.2f}" width="{w - 16:.2f}" height="{h - 20:.2f}" '
        f'rx="{max(12.0, r - 7):.2f}" ry="{max(12.0, r - 7):.2f}" fill="#090c13" fill-opacity="0.28" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1.0" '
        f'transform="rotate({tilt * 0.64:.2f} {x + w / 2:.2f} {y + h / 2:.2f})" />'
    )
    spine_x = x + w * (0.46 + spine_shift)
    body.append(
        f'<rect id="capsule-spine" x="{spine_x:.2f}" y="{y + 22:.2f}" width="{w * (0.08 if core_family != "split" else 0.05):.2f}" height="{h - 44:.2f}" '
        f'rx="{max(7.0, w * 0.045):.2f}" ry="{max(7.0, w * 0.045):.2f}" fill="#eef5ff" fill-opacity="{0.14 + trust_accent * 0.14:.4f}" />'
    )
    if core_family == "split":
        split_gap = w * 0.12
        body.append(
            f'<rect x="{x + w * 0.34:.2f}" y="{y + 26:.2f}" width="{w * 0.05:.2f}" height="{h - 52:.2f}" rx="8" ry="8" fill="#eef5ff" fill-opacity="0.12" />'
        )
        body.append(
            f'<rect x="{x + w * 0.61:.2f}" y="{y + 18:.2f}" width="{w * 0.05:.2f}" height="{h - 46:.2f}" rx="8" ry="8" fill="#eef5ff" fill-opacity="0.14" />'
        )
    elif core_family == "seeded":
        for idx in range(3):
            body.append(
                f'<ellipse cx="{x + w * (0.34 + idx * 0.16):.2f}" cy="{y + h * (0.34 + (idx % 2) * 0.16):.2f}" rx="{w * 0.06:.2f}" ry="{h * 0.05:.2f}" fill="#ffffff" fill-opacity="0.08" />'
            )
    elif core_family == "vault":
        body.append(
            f'<rect x="{x + 16:.2f}" y="{y + h * 0.26:.2f}" width="{w - 32:.2f}" height="{h * 0.18:.2f}" rx="{max(10.0, r * 0.36):.2f}" ry="{max(10.0, r * 0.36):.2f}" fill="#ffffff" fill-opacity="0.06" />'
        )

    core_facets = [
        (x + w * 0.52 + tilt * 0.18, y + h * 0.28),
        (x + w * 0.7, y + h * 0.48),
        (x + w * 0.5 - tilt * 0.1, y + h * 0.72),
        (x + w * 0.28, y + h * 0.52),
    ]
    body.append(
        _polygon_tag(
            core_facets,
            id="capsule-seal",
            fill="#ffffff",
            fill_opacity=f"{0.05 + trust_accent * 0.05:.4f}",
            stroke="#f8fbff",
            stroke_opacity=f"{0.12 + trust_accent * 0.14:.4f}",
            stroke_width="1.0",
        )
    )
    body.append(
        f'<line x1="{x + 16:.2f}" y1="{y + h * 0.26:.2f}" x2="{x + w - 14:.2f}" y2="{y + h * 0.22:.2f}" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1.0" />'
    )
    body.append(
        f'<line x1="{x + 20:.2f}" y1="{y + h * 0.74:.2f}" x2="{x + w - 18:.2f}" y2="{y + h * 0.7:.2f}" stroke="#ffffff" stroke-opacity="0.08" stroke-width="0.9" />'
    )
    body.append(
        f'<rect x="{x + 10:.2f}" y="{y + 12 + max(0.0, -slump * 0.06):.2f}" width="{w - 20:.2f}" height="{h * 0.12:.2f}" rx="{max(10.0, r * 0.48):.2f}" '
        f'ry="{max(10.0, r * 0.48):.2f}" fill="#ffffff" fill-opacity="0.08" />'
    )

def render_receipt_mode_svg(metadata: Dict) -> str:
    traits = metadata["visual_traits"]
    palette = PALETTES[traits["palette_name"]]
    rng = random.Random(int(metadata["derived_seeds"]["master_seed"][:16], 16))
    glow_std = 1.2 + traits["oxide_intensity"] * 0.8
    shadow_shift = 18 + traits["edge_bias"] * 18
    defs = f"""
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#07090e" />
      <stop offset="52%" stop-color="#121722" />
      <stop offset="100%" stop-color="#030407" />
    </linearGradient>
    <linearGradient id="metalFace" x1="14%" y1="8%" x2="86%" y2="92%">
      <stop offset="0%" stop-color="#edf3fb" stop-opacity="0.86" />
      <stop offset="18%" stop-color="#95a0b5" stop-opacity="0.48" />
      <stop offset="46%" stop-color="#2b3240" stop-opacity="0.6" />
      <stop offset="76%" stop-color="#141922" stop-opacity="0.88" />
      <stop offset="100%" stop-color="#06080d" stop-opacity="0.96" />
    </linearGradient>
    <linearGradient id="oxide" x1="18%" y1="6%" x2="82%" y2="94%">
      <stop offset="0%" stop-color="{palette[0]}" stop-opacity="{0.22 + traits['oxide_intensity'] * 0.1:.4f}" />
      <stop offset="22%" stop-color="{palette[1]}" stop-opacity="{0.3 + traits['oxide_intensity'] * 0.08:.4f}" />
      <stop offset="48%" stop-color="{palette[2]}" stop-opacity="{0.36 + traits['oxide_intensity'] * 0.08:.4f}" />
      <stop offset="74%" stop-color="{palette[3]}" stop-opacity="{0.44 + traits['oxide_intensity'] * 0.06:.4f}" />
      <stop offset="100%" stop-color="{palette[4]}" stop-opacity="{0.52 + traits['oxide_intensity'] * 0.05:.4f}" />
    </linearGradient>
    <linearGradient id="coreFace" x1="15%" y1="8%" x2="82%" y2="88%">
      <stop offset="0%" stop-color="#f7fbff" stop-opacity="0.94" />
      <stop offset="28%" stop-color="#d6e0ef" stop-opacity="0.46" />
      <stop offset="60%" stop-color="#4a5365" stop-opacity="0.24" />
      <stop offset="100%" stop-color="#0b0e14" stop-opacity="0.3" />
    </linearGradient>
    <radialGradient id="capsuleAura" cx="50%" cy="42%" r="64%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.38" />
      <stop offset="55%" stop-color="{palette[1]}" stop-opacity="0.09" />
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

    morphology = metadata["visible_morphology"]

    terraces, shards, capsule = _hopper_rectangles(
        traits["layer_count"],
        traits["shard_count"],
        traits["symmetry"],
        traits["edge_bias"],
        traits["geometry_style"],
        morphology,
    )

    if terraces:
        outer = terraces[0]
        body.append(
            f'<rect x="{outer["x"] - 18:.2f}" y="{outer["y"] - 22:.2f}" width="{outer["w"] + 36:.2f}" height="{outer["h"] + 44:.2f}" '
            f'fill="url(#oxide)" fill-opacity="{0.08 + traits["oxide_intensity"] * 0.08:.4f}" stroke="none" rx="36" ry="36" />'
        )

    body.append('<g filter="url(#softGlow)">')
    _render_fused_specimen_body(body, terraces, capsule, palette, traits, morphology)
    _render_hopper_lattice(body, terraces, capsule, palette, traits, morphology)
    body.append('</g>')

    body.append('<g>')
    for idx, rect in enumerate(shards[:0]):
        color = palette[(idx + 2) % len(palette)]
        lift = 5.5
        depth = 6.5
        front = [(rect["x"], rect["y"]), (rect["x"] + rect["w"], rect["y"]), (rect["x"] + rect["w"], rect["y"] + rect["h"]), (rect["x"], rect["y"] + rect["h"])]
        top = _offset_points(front, -lift, -lift * 0.72)
        side = _offset_points(front, depth, depth * 0.48)
        body.append(_polygon_tag([front[1], front[2], side[2], side[1]], fill=color, fill_opacity=f"{0.12 + traits['oxide_intensity'] * 0.12:.4f}", stroke="none"))
        body.append(_polygon_tag([front[0], front[1], top[1], top[0]], fill="#ffffff", fill_opacity="0.05", stroke="none"))
        body.append(
            f'<rect x="{rect["x"]:.2f}" y="{rect["y"]:.2f}" width="{rect["w"]:.2f}" height="{rect["h"]:.2f}" fill="{color}" fill-opacity="{0.08 + traits["oxide_intensity"] * 0.12:.4f}" '
            f'stroke="#f8f9fa" stroke-opacity="0.06" stroke-width="0.7" />'
        )

    band_count = 1 + int(traits["oxide_intensity"])
    outer = terraces[0] if terraces else {"x": CENTER_X - 180, "y": CENTER_Y - 180, "w": 360, "h": 360}
    for band_idx in range(band_count):
        y = outer["y"] + outer["h"] * (0.24 + band_idx * 0.17)
        x1 = outer["x"] + outer["w"] * (0.24 + (band_idx % 2) * 0.03)
        x2 = outer["x"] + outer["w"] * (0.72 - (band_idx % 2) * 0.02)
        body.append(
            f'<line x1="{x1:.2f}" y1="{y:.2f}" x2="{x2:.2f}" y2="{y - rng.uniform(3, 7):.2f}" '
            f'stroke="{palette[band_idx % len(palette)]}" stroke-opacity="{0.06 + traits["oxide_intensity"] * 0.05:.4f}" stroke-width="1.8" />'
        )
    _render_center_capsule(body, capsule, palette, traits, morphology)
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
    metadata = {
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
        "visible_morphology": {},
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
    metadata["visible_morphology"] = _build_visible_morphology(metadata)
    return metadata


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
