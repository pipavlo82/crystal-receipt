from typing import Dict

GEOMETRY_STYLES = ["hopper", "radial", "stepped", "fractured"]
PALETTE_NAMES = ["oxide_rainbow", "blue_gold", "violet_green", "silver_rose"]
SYMMETRY_LEVELS = ["low", "medium", "high"]
RARITY_LEVELS = ["common", "uncommon", "rare", "mythic"]
REQUIRED_KEYS = [
    "master_seed",
    "shape_seed",
    "palette_seed",
    "symmetry_seed",
    "layer_seed",
    "oxide_seed",
    "trait_seed",
]


def _is_lower_hex_64(value: str) -> bool:
    return len(value) == 64 and all(ch in "0123456789abcdef" for ch in value)


def _segment_value(seed: str, start: int, length: int = 8) -> int:
    return int(seed[start : start + length], 16)


def _pick(options: list[str], seed: str, offset: int) -> str:
    return options[_segment_value(seed, offset) % len(options)]


def _range_int(seed: str, offset: int, minimum: int, maximum: int) -> int:
    span = maximum - minimum + 1
    return minimum + (_segment_value(seed, offset) % span)


def _range_float(seed: str, offset: int) -> float:
    return round(_segment_value(seed, offset) / 0xFFFFFFFF, 4)


def derive_visual_traits(seed_material: Dict[str, str]) -> Dict[str, object]:
    for key in REQUIRED_KEYS:
        if key not in seed_material:
            raise ValueError(f"missing seed material key: {key}")
        value = seed_material[key]
        if not isinstance(value, str) or not _is_lower_hex_64(value):
            raise ValueError(f"invalid seed value for {key}")

    geometry_style = _pick(GEOMETRY_STYLES, seed_material["shape_seed"], 0)
    palette_name = _pick(PALETTE_NAMES, seed_material["palette_seed"], 8)
    symmetry = _pick(SYMMETRY_LEVELS, seed_material["symmetry_seed"], 16)
    layer_count = _range_int(seed_material["layer_seed"], 0, 4, 16)
    shard_count = _range_int(seed_material["shape_seed"], 8, 8, 64)
    oxide_intensity = _range_float(seed_material["oxide_seed"], 0)
    edge_bias = _range_float(seed_material["trait_seed"], 8)

    rarity_roll = (
        _segment_value(seed_material["trait_seed"], 0)
        ^ _segment_value(seed_material["master_seed"], 24)
        ^ _segment_value(seed_material["oxide_seed"], 16)
    ) % 100
    if rarity_roll < 55:
        rarity = "common"
    elif rarity_roll < 82:
        rarity = "uncommon"
    elif rarity_roll < 96:
        rarity = "rare"
    else:
        rarity = "mythic"

    return {
        "geometry_style": geometry_style,
        "palette_name": palette_name,
        "symmetry": symmetry,
        "layer_count": layer_count,
        "shard_count": shard_count,
        "oxide_intensity": oxide_intensity,
        "edge_bias": edge_bias,
        "rarity": rarity,
    }
