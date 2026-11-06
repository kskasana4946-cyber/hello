#!/usr/bin/env python3
"""
Apex Grand Prix: Uncapped Next-Gen Edition
tools/build_sky_paks.py

Generates 4 High-Dynamic-Range Sky & Atmosphere .PAK bundles in assets/paks/sky/:
  1. sky_golden_hour.pak    (alias sky_01.pak) - 12.50 MiB (13,107,200 B)
  2. sky_neotokyo_cyber.pak (alias sky_02.pak) - 12.50 MiB (13,107,200 B)
  3. sky_redrock_canyon.pak (alias sky_03.pak) - 12.50 MiB (13,107,200 B)
  4. sky_alpine_glacier.pak (alias sky_04.pak) - 12.50 MiB (13,107,200 B)

Total Footprint: 52,428,800 B (50.00 MiB)
Container Format: APEXPAK1 (64-byte header, 64-byte TOC entries, 64-byte aligned chunks, zero-padded)
Dependencies: Python 3 standard library, numpy, PIL (Pillow).
"""

import os
import sys
import json
import math
import struct
import shutil
import numpy as np
from PIL import Image

TARGET_PAK_BYTES = 13_107_200  # 12.50 MiB exactly
APEX_PAK_MAGIC = b"APEXPAK1"
APEX_PAK_VERSION = 1
PAK_TYPE_SKY = 1

CHUNK_TYPE_TEX_RGBA8 = 1
CHUNK_TYPE_TEX_RGBE = 2
CHUNK_TYPE_TEX_RG16 = 3
CHUNK_TYPE_TEX_RGBA16F = 4
CHUNK_TYPE_VOL_U8 = 5
CHUNK_TYPE_JSON_META = 9

HEADER_BYTES = 64
TOC_ENTRY_BYTES = 64

def align_to_64(val: int) -> int:
    return math.ceil(val / 64) * 64

def encode_rgbe(hdr_rgb: np.ndarray) -> bytes:
    """
    Vectorized conversion from float32 RGB (H, W, 3) to 32-bit Radiance RGBE (H, W, 4).
    Each pixel is [R, G, B, E] where E = exponent + 128.
    """
    h, w, _ = hdr_rgb.shape
    flat_rgb = hdr_rgb.reshape(-1, 3).astype(np.float32)
    flat_rgb = np.maximum(flat_rgb, 0.0)

    max_val = np.max(flat_rgb, axis=1)
    mask = max_val > 1e-32

    rgbe = np.zeros((flat_rgb.shape[0], 4), dtype=np.uint8)

    if np.any(mask):
        valid_max = max_val[mask]
        valid_rgb = flat_rgb[mask]

        # Exponent
        exponent = np.floor(np.log2(valid_max)).astype(np.int32) + 1
        factor = 256.0 / (2.0 ** exponent)

        re = np.clip(valid_rgb[:, 0] * factor, 0, 255).astype(np.uint8)
        ge = np.clip(valid_rgb[:, 1] * factor, 0, 255).astype(np.uint8)
        be = np.clip(valid_rgb[:, 2] * factor, 0, 255).astype(np.uint8)
        ee = np.clip(exponent + 128, 0, 255).astype(np.uint8)

        rgbe[mask, 0] = re
        rgbe[mask, 1] = ge
        rgbe[mask, 2] = be
        rgbe[mask, 3] = ee

    return rgbe.tobytes()

def generate_hdri_equirect(biome_id: str, width: int = 1024, height: int = 512) -> bytes:
    """
    Procedurally synthesizes a 360x180 degree HDR equirectangular panorama.
    Equirectangular coordinates:
      phi in [-pi/2, +pi/2] (zenith +pi/2 to nadir -pi/2)
      theta in [-pi, +pi]   (azimuth)
    """
    theta = np.linspace(-np.pi, np.pi, width, endpoint=False, dtype=np.float32)
    phi = np.linspace(np.pi / 2.0, -np.pi / 2.0, height, endpoint=False, dtype=np.float32)
    theta_grid, phi_grid = np.meshgrid(theta, phi)

    # Unit sphere direction vectors: (X, Y, Z) where Y is up
    cos_phi = np.cos(phi_grid)
    sin_phi = np.sin(phi_grid)
    dir_x = cos_phi * np.sin(theta_grid)
    dir_y = sin_phi
    dir_z = cos_phi * np.cos(theta_grid)

    rgb = np.zeros((height, width, 3), dtype=np.float32)

    if biome_id == "sky_golden_hour":
        # 7 PM low sun at azimuth ~45 deg, elevation ~14 deg
        sun_elev = math.radians(14.0)
        sun_azim = math.radians(45.0)
        sun_dir = np.array([
            math.cos(sun_elev) * math.sin(sun_azim),
            math.sin(sun_elev),
            math.cos(sun_elev) * math.cos(sun_azim)
        ], dtype=np.float32)

        # Cosine angle to sun
        cos_sun = np.clip(dir_x * sun_dir[0] + dir_y * sun_dir[1] + dir_z * sun_dir[2], -1.0, 1.0)

        # Sky gradient: zenith deep blue, horizon warm golden-amber
        elev_norm = np.clip((phi_grid + 0.05) / (np.pi / 2.0 + 0.05), 0.0, 1.0)
        zenith_col = np.array([0.15, 0.35, 0.75], dtype=np.float32)
        horizon_col = np.array([1.95, 1.15, 0.45], dtype=np.float32)
        base_sky = (1.0 - elev_norm[..., None]) * horizon_col + elev_norm[..., None] * zenith_col

        # Sun disk & intense coronal forward scatter
        sun_dist_angle = np.arccos(cos_sun)
        sun_disk = np.exp(-((sun_dist_angle / math.radians(1.2)) ** 4)) * 35.0
        sun_corona = np.exp(-((sun_dist_angle / math.radians(18.0)) ** 1.8)) * 3.8
        sun_glow = np.exp(-((sun_dist_angle / math.radians(55.0)) ** 1.2)) * 1.2

        sun_col = np.array([2.4, 1.6, 0.8], dtype=np.float32)
        total_sun = (sun_disk + sun_corona + sun_glow)[..., None] * sun_col

        # Ground / horizon haze below 0 deg
        ground_mask = (phi_grid < 0.0)[..., None]
        ground_col = np.array([0.08, 0.06, 0.05], dtype=np.float32) * (1.0 + 0.5 * cos_sun[..., None])
        rgb = np.where(ground_mask, ground_col, base_sky + total_sun)

    elif biome_id == "sky_neotokyo_cyber":
        # Cyberpunk midnight horizon: deep indigo zenith, neon smog, distant glowing holographic city
        elev_norm = np.clip((phi_grid + 0.02) / (np.pi / 2.0), 0.0, 1.0)
        zenith_col = np.array([0.015, 0.025, 0.065], dtype=np.float32)
        horizon_neon_cyan = np.array([0.05, 0.35, 0.65], dtype=np.float32)
        horizon_neon_magenta = np.array([0.65, 0.05, 0.45], dtype=np.float32)

        # Azimuthal neon color shift (magenta on one side, cyan on the other)
        azim_blend = (np.sin(theta_grid * 2.0) * 0.5 + 0.5)[..., None]
        horizon_col = azim_blend * horizon_neon_magenta + (1.0 - azim_blend) * horizon_neon_cyan
        base_sky = (1.0 - elev_norm[..., None]) * horizon_col + elev_norm[..., None] * zenith_col

        # Holographic skyscraper beacon spikes along horizon
        city_spikes = (np.sin(theta_grid * 48.0) > 0.85).astype(np.float32)
        city_height_mask = ((phi_grid > 0.0) & (phi_grid < math.radians(7.0))).astype(np.float32)
        neon_windows = (city_spikes * city_height_mask)[..., None] * np.array([0.8, 1.2, 2.2], dtype=np.float32)

        # Distant low moon
        moon_dir = np.array([0.35, 0.65, -0.68], dtype=np.float32)
        moon_dir /= np.linalg.norm(moon_dir)
        cos_moon = np.clip(dir_x * moon_dir[0] + dir_y * moon_dir[1] + dir_z * moon_dir[2], -1.0, 1.0)
        moon_disk = np.exp(-((np.arccos(cos_moon) / math.radians(2.0)) ** 4)) * 8.5
        moon_glow = (moon_disk)[..., None] * np.array([0.7, 0.9, 1.4], dtype=np.float32)

        ground_mask = (phi_grid < 0.0)[..., None]
        ground_col = np.array([0.02, 0.02, 0.03], dtype=np.float32)
        rgb = np.where(ground_mask, ground_col, base_sky + neon_windows + moon_glow)

    elif biome_id == "sky_redrock_canyon":
        # Crimson-violet desert dusk sky dome
        sun_elev = math.radians(4.0)
        sun_azim = math.radians(110.0)
        sun_dir = np.array([
            math.cos(sun_elev) * math.sin(sun_azim),
            math.sin(sun_elev),
            math.cos(sun_elev) * math.cos(sun_azim)
        ], dtype=np.float32)

        cos_sun = np.clip(dir_x * sun_dir[0] + dir_y * sun_dir[1] + dir_z * sun_dir[2], -1.0, 1.0)
        elev_norm = np.clip((phi_grid + 0.05) / (np.pi / 2.0), 0.0, 1.0)
        zenith_col = np.array([0.18, 0.08, 0.32], dtype=np.float32)  # Deep violet
        horizon_col = np.array([1.85, 0.45, 0.22], dtype=np.float32) # Crimson-amber

        base_sky = (1.0 - elev_norm[..., None]) * horizon_col + elev_norm[..., None] * zenith_col

        sun_dist_angle = np.arccos(cos_sun)
        sun_disk = np.exp(-((sun_dist_angle / math.radians(1.6)) ** 4)) * 24.0
        dust_corona = np.exp(-((sun_dist_angle / math.radians(40.0)) ** 1.3)) * 2.2
        sun_col = np.array([2.5, 0.9, 0.35], dtype=np.float32)
        total_sun = (sun_disk + dust_corona)[..., None] * sun_col

        ground_mask = (phi_grid < 0.0)[..., None]
        ground_col = np.array([0.12, 0.04, 0.02], dtype=np.float32)
        rgb = np.where(ground_mask, ground_col, base_sky + total_sun)

    elif biome_id == "sky_alpine_glacier":
        # Crisp crystalline blue zenith, snow albedo bounce, aurora borealis
        sun_elev = math.radians(42.0)
        sun_azim = math.radians(210.0)
        sun_dir = np.array([
            math.cos(sun_elev) * math.sin(sun_azim),
            math.sin(sun_elev),
            math.cos(sun_elev) * math.cos(sun_azim)
        ], dtype=np.float32)

        cos_sun = np.clip(dir_x * sun_dir[0] + dir_y * sun_dir[1] + dir_z * sun_dir[2], -1.0, 1.0)
        elev_norm = np.clip((phi_grid + 0.05) / (np.pi / 2.0), 0.0, 1.0)
        zenith_col = np.array([0.15, 0.45, 0.95], dtype=np.float32)  # High altitude crystalline blue
        horizon_col = np.array([0.75, 0.88, 1.15], dtype=np.float32) # Bright crisp ice haze

        base_sky = (1.0 - elev_norm[..., None]) * horizon_col + elev_norm[..., None] * zenith_col

        # High crisp sun
        sun_dist_angle = np.arccos(cos_sun)
        sun_disk = np.exp(-((sun_dist_angle / math.radians(1.0)) ** 4)) * 40.0
        sun_corona = np.exp(-((sun_dist_angle / math.radians(20.0)) ** 1.8)) * 2.5
        sun_col = np.array([2.0, 2.2, 2.5], dtype=np.float32)
        total_sun = (sun_disk + sun_corona)[..., None] * sun_col

        # Aurora borealis curtain in northern high elevation
        aurora_wave = np.sin(theta_grid * 5.0 + phi_grid * 8.0) * np.cos(theta_grid * 3.0)
        aurora_mask = np.clip(aurora_wave * 0.5 + 0.5, 0.0, 1.0) * np.clip((phi_grid - math.radians(25.0)) / math.radians(45.0), 0.0, 1.0)
        aurora_col = (aurora_mask)[..., None] * np.array([0.2, 1.4, 0.8], dtype=np.float32) * 0.85

        # Snow bounce ground light
        ground_mask = (phi_grid < 0.0)[..., None]
        ground_col = np.array([0.85, 0.92, 1.05], dtype=np.float32) * (0.8 + 0.4 * cos_sun[..., None])
        rgb = np.where(ground_mask, ground_col, base_sky + total_sun + aurora_col)

    return encode_rgbe(rgb)

def generate_cloud_noise_3d(biome_id: str, nx: int = 64, ny: int = 64, nz: int = 32) -> bytes:
    """
    Generates a 3D volumetric density field for procedural cumulus clouds.
    Multi-frequency fractional Brownian motion (fBm) cellular noise grid.
    Returns uint8 byte stream of length nx * ny * nz.
    """
    z, y, x = np.meshgrid(
        np.linspace(0.0, 1.0, nz, endpoint=False),
        np.linspace(0.0, 1.0, ny, endpoint=False),
        np.linspace(0.0, 1.0, nx, endpoint=False),
        indexing='ij'
    )

    # Base low-frequency sinusoidal noise field
    field = (
        np.sin(x * math.pi * 4.0) * np.cos(y * math.pi * 4.0) * np.sin(z * math.pi * 2.0) * 0.5 +
        np.sin(x * math.pi * 8.0 + 1.2) * np.cos(y * math.pi * 8.0 + 0.8) * 0.25 +
        np.sin(x * math.pi * 16.0 + 2.5) * np.sin(y * math.pi * 16.0 + 1.7) * 0.125
    )

    if biome_id == "sky_golden_hour":
        # Billowing cumulus: flat cloud base (z ~ 0.2), billowy top
        height_falloff = np.clip(1.0 - ((z - 0.35) / 0.45) ** 2, 0.0, 1.0)
        density = np.clip((field + 0.25) * height_falloff * 1.5, 0.0, 1.0)
    elif biome_id == "sky_neotokyo_cyber":
        # Low neon smog layer hugging city skyline
        density = np.clip(np.exp(-z * 4.0) * (field * 0.4 + 0.7), 0.0, 1.0)
    elif biome_id == "sky_redrock_canyon":
        # Thin high-altitude cirrus streaks
        cirrus_streaks = np.sin((x * 0.8 + y * 2.5) * math.pi * 6.0) * 0.5 + 0.5
        density = np.clip((field * 0.3 + cirrus_streaks * 0.7) * np.exp(-((z - 0.75) / 0.2) ** 2), 0.0, 1.0)
    elif biome_id == "sky_alpine_glacier":
        # Crystalline billows and blowing snow turbulence
        density = np.clip((field + 0.4) * np.sin(z * math.pi), 0.0, 1.0)

    u8 = (density * 255.0).astype(np.uint8)
    return u8.tobytes()

def generate_scattering_lut(biome_id: str, size: int = 256) -> bytes:
    """
    Computes 2D atmospheric scattering LUT (view zenith cos_theta_v vs sun zenith cos_theta_s).
    Rayleigh + Mie phase functions with single & multiple scattering approximation.
    Returns size * size * 4 (RGBA8) bytes.
    """
    u_v = np.linspace(-1.0, 1.0, size, dtype=np.float32)
    u_s = np.linspace(-1.0, 1.0, size, dtype=np.float32)
    grid_v, grid_s = np.meshgrid(u_v, u_s)

    # Rayleigh scattering phase function: P_R = 3/(16*pi) * (1 + cos^2)
    cos_angle = np.clip(grid_v * grid_s, -1.0, 1.0)
    phase_r = (1.0 + cos_angle ** 2) * (3.0 / (16.0 * math.pi))

    # Mie scattering phase function (Henyey-Greenstein)
    g = 0.76 if biome_id != "sky_redrock_canyon" else 0.82
    phase_m = (1.0 - g ** 2) / ((1.0 + g ** 2 - 2.0 * g * cos_angle) ** 1.5) / (4.0 * math.pi)

    # Biome-specific Rayleigh scattering coefficients (approximate wavelength dependent: blue scatters more)
    if biome_id == "sky_golden_hour":
        scat_r = np.clip(phase_r * 1.8 + phase_m * 0.9, 0.0, 2.0)
        scat_g = np.clip(phase_r * 1.3 + phase_m * 0.7, 0.0, 2.0)
        scat_b = np.clip(phase_r * 0.9 + phase_m * 0.5, 0.0, 2.0)
    elif biome_id == "sky_neotokyo_cyber":
        scat_r = np.clip(phase_r * 0.8 + phase_m * 1.2, 0.0, 2.0)
        scat_g = np.clip(phase_r * 1.1 + phase_m * 1.0, 0.0, 2.0)
        scat_b = np.clip(phase_r * 1.7 + phase_m * 0.8, 0.0, 2.0)
    elif biome_id == "sky_redrock_canyon":
        scat_r = np.clip(phase_r * 2.2 + phase_m * 1.4, 0.0, 2.0)
        scat_g = np.clip(phase_r * 1.1 + phase_m * 0.8, 0.0, 2.0)
        scat_b = np.clip(phase_r * 0.6 + phase_m * 0.4, 0.0, 2.0)
    else:  # alpine_glacier
        scat_r = np.clip(phase_r * 1.0 + phase_m * 0.6, 0.0, 2.0)
        scat_g = np.clip(phase_r * 1.4 + phase_m * 0.7, 0.0, 2.0)
        scat_b = np.clip(phase_r * 2.0 + phase_m * 0.8, 0.0, 2.0)

    rgba = np.zeros((size, size, 4), dtype=np.uint8)
    rgba[..., 0] = np.clip(scat_r * 127.0, 0, 255).astype(np.uint8)
    rgba[..., 1] = np.clip(scat_g * 127.0, 0, 255).astype(np.uint8)
    rgba[..., 2] = np.clip(scat_b * 127.0, 0, 255).astype(np.uint8)
    rgba[..., 3] = 255

    return rgba.tobytes()

def generate_pmrem_cubemap(biome_id: str, face_size: int = 256) -> bytes:
    """
    Generates 6 cubemap faces for PMREM specular environment reflections.
    Faces: [+X, -X, +Y, -Y, +Z, -Z].
    Returns 6 * face_size * face_size * 4 (RGBA8) bytes.
    """
    total_faces = 6
    cube_data = np.zeros((total_faces, face_size, face_size, 4), dtype=np.uint8)

    # Base ambient tone per face
    if biome_id == "sky_golden_hour":
        colors = [
            [220, 140, 60, 255],   # +X (toward sun)
            [80, 110, 180, 255],   # -X (away)
            [60, 100, 200, 255],   # +Y (zenith)
            [40, 30, 25, 255],     # -Y (ground)
            [160, 120, 90, 255],   # +Z
            [120, 100, 140, 255],  # -Z
        ]
    elif biome_id == "sky_neotokyo_cyber":
        colors = [
            [20, 120, 200, 255],   # +X (cyan neon)
            [180, 20, 140, 255],   # -X (magenta neon)
            [10, 15, 40, 255],     # +Y (midnight)
            [10, 10, 15, 255],     # -Y (ground)
            [60, 40, 120, 255],    # +Z
            [30, 80, 160, 255],    # -Z
        ]
    elif biome_id == "sky_redrock_canyon":
        colors = [
            [230, 80, 40, 255],    # +X (canyon dusk)
            [90, 40, 100, 255],    # -X (violet dusk)
            [50, 25, 75, 255],     # +Y (zenith)
            [55, 20, 10, 255],     # -Y (red sandstone)
            [160, 60, 50, 255],    # +Z
            [110, 50, 80, 255],    # -Z
        ]
    else:  # alpine_glacier
        colors = [
            [180, 210, 255, 255],  # +X (sun ice)
            [90, 140, 220, 255],   # -X
            [50, 110, 240, 255],   # +Y (zenith)
            [200, 220, 250, 255],  # -Y (snow ground bounce)
            [110, 170, 240, 255],  # +Z
            [70, 190, 150, 255],   # -Z (aurora green)
        ]

    for f in range(total_faces):
        col = colors[f]
        cube_data[f, :, :, 0] = col[0]
        cube_data[f, :, :, 1] = col[1]
        cube_data[f, :, :, 2] = col[2]
        cube_data[f, :, :, 3] = col[3]

    return cube_data.tobytes()

def generate_biome_metadata(biome_id: str, alias: str) -> dict:
    """
    Returns rich metadata parameters for real-time sky atmosphere and rendering systems.
    """
    if biome_id == "sky_golden_hour":
        return {
            "assetId": biome_id,
            "alias": alias,
            "pakType": 1,
            "displayName": "Golden Hour Horizon",
            "timeOfDay": "19:00",
            "sunIntensity": 2.4,
            "sunDirection": [0.65, 0.25, 0.70],
            "sunColor": [1.0, 0.65, 0.32],
            "ambientSkyColor": [0.35, 0.55, 0.85],
            "ambientGroundColor": [0.15, 0.12, 0.10],
            "fogColor": [0.92, 0.65, 0.38],
            "fogDensity": 0.00045,
            "cloudCover": 0.42,
            "cloudSpeed": [12.0, 6.0],
            "cloudAltitude": 350.0,
            "cloudThickness": 120.0,
            "turbidity": 3.8,
            "rayleigh": [0.25, 0.55, 1.0],
            "mieCoefficient": 0.005,
            "mieDirectionalG": 0.82,
            "specialEffects": {
                "lightning": False,
                "snow": False,
                "aurora": False,
                "dustHaze": False,
                "sunShafts": True
            }
        }
    elif biome_id == "sky_neotokyo_cyber":
        return {
            "assetId": biome_id,
            "alias": alias,
            "pakType": 1,
            "displayName": "Neo-Tokyo Cyber Midnight",
            "timeOfDay": "00:30",
            "sunIntensity": 1.15,
            "sunDirection": [0.35, 0.65, -0.68],
            "sunColor": [0.45, 0.65, 1.0],
            "ambientSkyColor": [0.12, 0.08, 0.25],
            "ambientGroundColor": [0.03, 0.03, 0.05],
            "fogColor": [0.10, 0.12, 0.22],
            "fogDensity": 0.00085,
            "cloudCover": 0.65,
            "cloudSpeed": [8.0, 4.0],
            "cloudAltitude": 220.0,
            "cloudThickness": 90.0,
            "turbidity": 4.5,
            "rayleigh": [0.15, 0.25, 0.65],
            "mieCoefficient": 0.012,
            "mieDirectionalG": 0.78,
            "specialEffects": {
                "lightning": True,
                "lightningFrequencySec": 4.5,
                "snow": False,
                "aurora": False,
                "dustHaze": False,
                "neonHolograms": True
            }
        }
    elif biome_id == "sky_redrock_canyon":
        return {
            "assetId": biome_id,
            "alias": alias,
            "pakType": 1,
            "displayName": "Redrock Canyon Crimson Dusk",
            "timeOfDay": "19:45",
            "sunIntensity": 1.85,
            "sunDirection": [0.85, 0.12, 0.48],
            "sunColor": [1.0, 0.38, 0.15],
            "ambientSkyColor": [0.42, 0.20, 0.55],
            "ambientGroundColor": [0.22, 0.08, 0.04],
            "fogColor": [0.75, 0.32, 0.20],
            "fogDensity": 0.00060,
            "cloudCover": 0.28,
            "cloudSpeed": [16.0, 2.0],
            "cloudAltitude": 480.0,
            "cloudThickness": 60.0,
            "turbidity": 5.2,
            "rayleigh": [0.65, 0.35, 0.50],
            "mieCoefficient": 0.015,
            "mieDirectionalG": 0.85,
            "specialEffects": {
                "lightning": False,
                "snow": False,
                "aurora": False,
                "dustHaze": True,
                "dustParticleDensity": 0.75
            }
        }
    else:  # sky_alpine_glacier
        return {
            "assetId": biome_id,
            "alias": alias,
            "pakType": 1,
            "displayName": "Alpine Glacier Crystalline Apex",
            "timeOfDay": "13:15",
            "sunIntensity": 2.1,
            "sunDirection": [-0.35, 0.82, -0.45],
            "sunColor": [0.95, 0.98, 1.0],
            "ambientSkyColor": [0.35, 0.65, 1.0],
            "ambientGroundColor": [0.75, 0.85, 0.95],
            "fogColor": [0.78, 0.88, 0.98],
            "fogDensity": 0.00040,
            "cloudCover": 0.35,
            "cloudSpeed": [22.0, 14.0],
            "cloudAltitude": 400.0,
            "cloudThickness": 100.0,
            "turbidity": 1.8,
            "rayleigh": [0.15, 0.45, 1.0],
            "mieCoefficient": 0.003,
            "mieDirectionalG": 0.75,
            "specialEffects": {
                "lightning": False,
                "snow": True,
                "snowParticleRate": 1500,
                "aurora": True,
                "dustHaze": False
            }
        }

def build_single_sky_pak(biome_id: str, alias: str, output_path: str):
    print(f"[*] Procedurally synthesizing {biome_id} ({alias}) -> {output_path} ...")

    # 1. Generate procedural chunks
    meta_dict = generate_biome_metadata(biome_id, alias)
    meta_bytes = json.dumps(meta_dict, indent=2).encode('utf-8')

    hdri_bytes = generate_hdri_equirect(biome_id, width=1024, height=512)
    cloud_bytes = generate_cloud_noise_3d(biome_id, nx=64, ny=64, nz=32)
    lut_bytes = generate_scattering_lut(biome_id, size=256)
    pmrem_bytes = generate_pmrem_cubemap(biome_id, face_size=256)

    chunks = [
        {
            "name": "json_meta",
            "chunkType": CHUNK_TYPE_JSON_META,
            "width": len(meta_bytes),
            "height": 1,
            "depthOrItems": 1,
            "payload": meta_bytes,
        },
        {
            "name": "hdri_equirect_rgbe",
            "chunkType": CHUNK_TYPE_TEX_RGBE,
            "width": 1024,
            "height": 512,
            "depthOrItems": 1,
            "payload": hdri_bytes,
        },
        {
            "name": "cloud_noise_3d",
            "chunkType": CHUNK_TYPE_VOL_U8,
            "width": 64,
            "height": 64,
            "depthOrItems": 32,
            "payload": cloud_bytes,
        },
        {
            "name": "scattering_lut",
            "chunkType": CHUNK_TYPE_TEX_RGBA8,
            "width": 256,
            "height": 256,
            "depthOrItems": 1,
            "payload": lut_bytes,
        },
        {
            "name": "pmrem_cubemap_mips",
            "chunkType": CHUNK_TYPE_TEX_RGBA8,
            "width": 256,
            "height": 256,
            "depthOrItems": 6,
            "payload": pmrem_bytes,
        },
    ]

    entry_count = len(chunks)
    toc_offset = HEADER_BYTES
    payload_start_offset = align_to_64(toc_offset + entry_count * TOC_ENTRY_BYTES)

    # Calculate offsets for each chunk
    running_offset = payload_start_offset
    offsets = []
    for chunk in chunks:
        running_offset = align_to_64(running_offset)
        offsets.append(running_offset)
        running_offset += len(chunk["payload"])

    if running_offset > TARGET_PAK_BYTES:
        raise ValueError(
            f"Payload length {running_offset} exceeds TARGET_PAK_BYTES {TARGET_PAK_BYTES}!"
        )

    # Initialize buffer of exact target size filled with zeroes
    buffer = bytearray(TARGET_PAK_BYTES)

    # 2. Write 64-byte Header
    # magic (8s), version (I), pakType (I), totalByteLength (Q), entryCount (I), sectorCount (I), assetId (32s)
    asset_id_bytes = biome_id.encode('utf-8')[:32].ljust(32, b'\x00')
    struct.pack_into(
        "<8sIIQII32s",
        buffer,
        0,
        APEX_PAK_MAGIC,
        APEX_PAK_VERSION,
        PAK_TYPE_SKY,
        TARGET_PAK_BYTES,
        entry_count,
        0,  # sectorCount (0 for SKY)
        asset_id_bytes
    )

    # 3. Write 64-byte TOC Entries & payload chunks
    for i in range(entry_count):
        chunk = chunks[i]
        chunk_offset = offsets[i]
        chunk_len = len(chunk["payload"])

        entry_base = toc_offset + i * TOC_ENTRY_BYTES
        name_bytes = chunk["name"].encode('utf-8')[:32].ljust(32, b'\x00')

        # name (32s), chunkType (I), width (I), height (I), depthOrItems (I), byteOffset (Q), byteLength (Q)
        struct.pack_into(
            "<32sIIIIQQ",
            buffer,
            entry_base,
            name_bytes,
            chunk["chunkType"],
            chunk["width"],
            chunk["height"],
            chunk["depthOrItems"],
            chunk_offset,
            chunk_len
        )

        buffer[chunk_offset:chunk_offset + chunk_len] = chunk["payload"]

    # 4. Write to disk
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(buffer)

    actual_size = os.path.getsize(output_path)
    if actual_size != TARGET_PAK_BYTES:
        raise RuntimeError(
            f"Size mismatch on {output_path}: expected {TARGET_PAK_BYTES}, got {actual_size}"
        )
    print(f"    -> Successfully built {output_path} ({actual_size:,} bytes)")

def create_alias(target_path: str, alias_path: str):
    """
    Creates alias via symlink, or fallback to copy.
    """
    if os.path.exists(alias_path) or os.path.islink(alias_path):
        os.remove(alias_path)
    target_filename = os.path.basename(target_path)
    try:
        os.symlink(target_filename, alias_path)
        print(f"    -> Created alias symlink: {alias_path} -> {target_filename}")
    except OSError:
        shutil.copy2(target_path, alias_path)
        print(f"    -> Created alias duplicate file: {alias_path}")

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    sky_pak_dir = os.path.join(root_dir, "assets", "paks", "sky")
    os.makedirs(sky_pak_dir, exist_ok=True)

    skies = [
        ("sky_golden_hour", "sky_01"),
        ("sky_neotokyo_cyber", "sky_02"),
        ("sky_redrock_canyon", "sky_03"),
        ("sky_alpine_glacier", "sky_04"),
    ]

    total_bytes = 0
    for biome_id, alias in skies:
        canonical_path = os.path.join(sky_pak_dir, f"{biome_id}.pak")
        alias_path = os.path.join(sky_pak_dir, f"{alias}.pak")

        build_single_sky_pak(biome_id, alias, canonical_path)
        create_alias(canonical_path, alias_path)

        total_bytes += os.path.getsize(canonical_path)

    expected_total = TARGET_PAK_BYTES * len(skies)
    print("\n========================================================")
    print(f"All 4 Sky .PAK packages successfully generated!")
    print(f"Canonical distinct bytes: {total_bytes:,} B ({total_bytes / (1024*1024):.2f} MiB)")
    print(f"Expected: {expected_total:,} B ({expected_total / (1024*1024):.2f} MiB)")
    print("========================================================")

if __name__ == "__main__":
    main()
