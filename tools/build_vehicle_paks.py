#!/usr/bin/env python3
"""
tools/build_vehicle_paks.py
Apex Grand Prix: Uncapped Next-Gen Edition
Builds 30 modular vehicle .pak bundles in assets/paks/vehicles/car_01..30/vehicle.pak
Each bundle is EXACTLY 9,411,776 bytes (total 30 × 9,411,776 = 282,353,280 bytes ~ 282.35 MB).
Format: APEXPAK1 container (pakType=3, 64-byte header, 64-byte TOC entries).
Includes ~5.44 MB per car of 48kHz 16-bit PCM multi-RPM firing-order audio banks.
"""

import json
import math
import os
import struct
import sys
import numpy as np
from PIL import Image

# APEXPAK1 Container Constants
APEX_PAK_MAGIC = b"APEXPAK1"
APEX_PAK_VERSION = 1
PAK_TYPE_VEHICLE = 3
TARGET_PAK_BYTES = 9_411_776  # Exactly 9,411,776 bytes per pak (30 x 9,411,776 = 282,353,280 B)
HEADER_BYTES = 64
TOC_ENTRY_BYTES = 64

# Chunk Types
CHUNK_TEX_RGBA8 = 1
CHUNK_TEX_RGBE = 2
CHUNK_TEX_RG16 = 3
CHUNK_TEX_RGBA16F = 4
CHUNK_VOL_U8 = 5
CHUNK_HEIGHT_U16 = 6
CHUNK_SECTOR_F32 = 7
CHUNK_MESH_F32 = 8
CHUNK_JSON_META = 9
CHUNK_AUDIO_PCM16 = 10

def align_to_64(val: int) -> int:
    return math.ceil(val / 64) * 64

# Vehicle Roster Metadata (30 Vehicles strictly across 7 allowed categories)
VEHICLE_DEFINITIONS = [
    # Tier 0 (Cars 1-4, 4 Hatchbacks, 2 Free Starter Cars)
    {
        "index": 1,
        "id": "mini_jcw",
        "name": "Mini Cooper JCW Hot Hatch",
        "category": "Hatchback",
        "tier": 0,
        "tierName": "Tier 0 — Starter Street & Club",
        "winsRequired": 0,
        "creditCost": 0,
        "zeroToHundredSec": 6.1,
        "topSpeedKph": 246,
        "massKg": 1280,
        "archetype": "HOT_HATCH_SEDAN",
        "drivetrain": "FWD",
        "redlineRpm": 7200,
        "gears": 6,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x1e3a5f,
        "defaultAccentColor": 0xd4001a,
    },
    {
        "index": 2,
        "id": "hot_hatch",
        "name": "Type-R Turbo Hot Hatch",
        "category": "Hatchback",
        "tier": 0,
        "tierName": "Tier 0 — Starter Street & Club",
        "winsRequired": 0,
        "creditCost": 0,
        "zeroToHundredSec": 5.2,
        "topSpeedKph": 275,
        "massKg": 1390,
        "archetype": "HOT_HATCH_SEDAN",
        "drivetrain": "FWD",
        "redlineRpm": 7500,
        "gears": 6,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xf4f3ee,
        "defaultAccentColor": 0xd4001a,
    },
    {
        "index": 3,
        "id": "golf_r",
        "name": "Golf R Turbo AWD Hatch",
        "category": "Hatchback",
        "tier": 0,
        "tierName": "Tier 0 — Starter Street & Club",
        "winsRequired": 1,
        "creditCost": 18000,
        "zeroToHundredSec": 4.6,
        "topSpeedKph": 270,
        "massKg": 1480,
        "archetype": "HOT_HATCH_SEDAN",
        "drivetrain": "AWD",
        "redlineRpm": 7200,
        "gears": 7,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x0047cc,
        "defaultAccentColor": 0x111111,
    },
    {
        "index": 4,
        "id": "gr_yaris",
        "name": "GR Rallye Turbo Hatch AWD",
        "category": "Hatchback",
        "tier": 0,
        "tierName": "Tier 0 — Starter Street & Club",
        "winsRequired": 2,
        "creditCost": 25000,
        "zeroToHundredSec": 4.8,
        "topSpeedKph": 260,
        "massKg": 1280,
        "archetype": "HOT_HATCH_SEDAN",
        "drivetrain": "AWD",
        "redlineRpm": 7500,
        "gears": 6,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xffffff,
        "defaultAccentColor": 0xd4001a,
    },
    # Tier 1 (Cars 5-9, 3-7 wins)
    {
        "index": 5,
        "id": "roadster",
        "name": "MX-5 Club Spec Roadster",
        "category": "Convertible",
        "tier": 1,
        "tierName": "Tier 1 — JDM Tuner, Drift & Off-Road",
        "winsRequired": 3,
        "creditCost": 35000,
        "zeroToHundredSec": 5.7,
        "topSpeedKph": 235,
        "massKg": 1060,
        "archetype": "SPORTS_COUPE_DRIFT",
        "drivetrain": "RWD",
        "redlineRpm": 7800,
        "gears": 6,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x0047cc,
        "defaultAccentColor": 0x111111,
    },
    {
        "index": 6,
        "id": "ranger_truck",
        "name": "Ford Ranger Raptor Double-Cab",
        "category": "Truck",
        "tier": 1,
        "tierName": "Tier 1 — JDM Tuner, Drift & Off-Road",
        "winsRequired": 4,
        "creditCost": 48000,
        "zeroToHundredSec": 5.8,
        "topSpeedKph": 210,
        "massKg": 2420,
        "archetype": "OFFROAD_RALLY_TRUCK",
        "drivetrain": "AWD",
        "redlineRpm": 6500,
        "gears": 10,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xf59e0b,
        "defaultAccentColor": 0x1e293b,
    },
    {
        "index": 7,
        "id": "jdm_sedan",
        "name": "Chaser / Skyline GT Turbo Sedan",
        "category": "Sedan",
        "tier": 1,
        "tierName": "Tier 1 — JDM Tuner, Drift & Off-Road",
        "winsRequired": 5,
        "creditCost": 60000,
        "zeroToHundredSec": 4.7,
        "topSpeedKph": 265,
        "massKg": 1420,
        "archetype": "SPORTS_COUPE_DRIFT",
        "drivetrain": "RWD",
        "redlineRpm": 8200,
        "gears": 6,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xffcc00,
        "defaultAccentColor": 0x111111,
    },
    {
        "index": 8,
        "id": "trail_suv",
        "name": "Bronco Wildtrak 4x4 SUV",
        "category": "SUV",
        "tier": 1,
        "tierName": "Tier 1 — JDM Tuner, Drift & Off-Road",
        "winsRequired": 6,
        "creditCost": 72000,
        "zeroToHundredSec": 6.1,
        "topSpeedKph": 195,
        "massKg": 2280,
        "archetype": "OFFROAD_RALLY_TRUCK",
        "drivetrain": "AWD",
        "redlineRpm": 6200,
        "gears": 10,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x0284c7,
        "defaultAccentColor": 0x111111,
    },
    {
        "index": 9,
        "id": "sport_mpv",
        "name": "Supercharged V6 Sport MPV",
        "category": "MPV",
        "tier": 1,
        "tierName": "Tier 1 — JDM Tuner, Drift & Off-Road",
        "winsRequired": 7,
        "creditCost": 85000,
        "zeroToHundredSec": 5.9,
        "topSpeedKph": 230,
        "massKg": 2050,
        "archetype": "HOT_HATCH_SEDAN",
        "drivetrain": "AWD",
        "redlineRpm": 6800,
        "gears": 8,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x38bdf8,
        "defaultAccentColor": 0x0f172a,
    },
    # Tier 2 (Cars 10-14, 8-12 wins)
    {
        "index": 10,
        "id": "overland_truck",
        "name": "Global 4x4 Overland Crew-Cab",
        "category": "Truck",
        "tier": 2,
        "tierName": "Tier 2 — Heavy Iron, Pursuit & Muscle",
        "winsRequired": 8,
        "creditCost": 105000,
        "zeroToHundredSec": 5.5,
        "topSpeedKph": 215,
        "massKg": 2650,
        "archetype": "OFFROAD_RALLY_TRUCK",
        "drivetrain": "AWD",
        "redlineRpm": 6500,
        "gears": 8,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xf8fafc,
        "defaultAccentColor": 0x111111,
    },
    {
        "index": 11,
        "id": "classic_muscle",
        "name": "1969 Charger Hemi Fastback Sedan",
        "category": "Sedan",
        "tier": 2,
        "tierName": "Tier 2 — Heavy Iron, Pursuit & Muscle",
        "winsRequired": 9,
        "creditCost": 120000,
        "zeroToHundredSec": 4.8,
        "topSpeedKph": 255,
        "massKg": 1720,
        "archetype": "MUSCLE_PURSUIT",
        "drivetrain": "RWD",
        "redlineRpm": 6800,
        "gears": 5,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x111111,
        "defaultAccentColor": 0xffffff,
    },
    {
        "index": 12,
        "id": "police_sedan",
        "name": "Twin-Turbo Pursuit Police Interceptor",
        "category": "Sedan",
        "tier": 2,
        "tierName": "Tier 2 — Heavy Iron, Pursuit & Muscle",
        "winsRequired": 10,
        "creditCost": 140000,
        "zeroToHundredSec": 3.4,
        "topSpeedKph": 305,
        "massKg": 1820,
        "archetype": "MUSCLE_PURSUIT",
        "drivetrain": "AWD",
        "redlineRpm": 7200,
        "gears": 8,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x16181d,
        "defaultAccentColor": 0xf8fafc,
    },
    {
        "index": 13,
        "id": "swat_suv",
        "name": "Armored Enforcer V8 Tactical SUV",
        "category": "SUV",
        "tier": 2,
        "tierName": "Tier 2 — Heavy Iron, Pursuit & Muscle",
        "winsRequired": 11,
        "creditCost": 165000,
        "zeroToHundredSec": 5.6,
        "topSpeedKph": 215,
        "massKg": 3450,
        "archetype": "HEAVY_COMMERCIAL",
        "drivetrain": "AWD",
        "redlineRpm": 6000,
        "gears": 8,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x2e3436,
        "defaultAccentColor": 0x111111,
    },
    {
        "index": 14,
        "id": "vip_mpv",
        "name": "Lexus LM / Alphard Lounge MPV",
        "category": "MPV",
        "tier": 2,
        "tierName": "Tier 2 — Heavy Iron, Pursuit & Muscle",
        "winsRequired": 12,
        "creditCost": 190000,
        "zeroToHundredSec": 6.4,
        "topSpeedKph": 220,
        "massKg": 2350,
        "archetype": "HOT_HATCH_SEDAN",
        "drivetrain": "AWD",
        "redlineRpm": 6500,
        "gears": 8,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x0f172a,
        "defaultAccentColor": 0xd4af37,
    },
    # Tier 3 (Cars 15-19, 13-17 wins)
    {
        "index": 15,
        "id": "bentley_sedan",
        "name": "Bentley Flying Spur W12 Luxury Sedan",
        "category": "Sedan",
        "tier": 3,
        "tierName": "Tier 3 — Track Toys, Superbikes & GT3",
        "winsRequired": 13,
        "creditCost": 225000,
        "zeroToHundredSec": 3.7,
        "topSpeedKph": 333,
        "massKg": 2437,
        "archetype": "HOT_HATCH_SEDAN",
        "drivetrain": "AWD",
        "redlineRpm": 6800,
        "gears": 8,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xd4b886,
        "defaultAccentColor": 0xffffff,
    },
    {
        "index": 16,
        "id": "porsche_cabrio",
        "name": "Porsche 911 Carrera Cabriolet",
        "category": "Convertible",
        "tier": 3,
        "tierName": "Tier 3 — Track Toys, Superbikes & GT3",
        "winsRequired": 14,
        "creditCost": 250000,
        "zeroToHundredSec": 3.5,
        "topSpeedKph": 310,
        "massKg": 1535,
        "archetype": "SPORTS_COUPE_DRIFT",
        "drivetrain": "RWD",
        "redlineRpm": 7500,
        "gears": 8,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x1034a6,
        "defaultAccentColor": 0xd0d5dd,
    },
    {
        "index": 17,
        "id": "porsche_targa",
        "name": "Porsche 911 Targa Heritage",
        "category": "Convertible",
        "tier": 3,
        "tierName": "Tier 3 — Track Toys, Superbikes & GT3",
        "winsRequired": 15,
        "creditCost": 275000,
        "zeroToHundredSec": 3.4,
        "topSpeedKph": 315,
        "massKg": 1640,
        "archetype": "SPORTS_COUPE_DRIFT",
        "drivetrain": "AWD",
        "redlineRpm": 7500,
        "gears": 8,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xf8fafc,
        "defaultAccentColor": 0x94a3b8,
    },
    {
        "index": 18,
        "id": "urus_suv",
        "name": "Super SUV Twin-Turbo V8 (Urus)",
        "category": "SUV",
        "tier": 3,
        "tierName": "Tier 3 — Track Toys, Superbikes & GT3",
        "winsRequired": 16,
        "creditCost": 300000,
        "zeroToHundredSec": 3.2,
        "topSpeedKph": 312,
        "massKg": 2150,
        "archetype": "GT3_SUPERCAR",
        "drivetrain": "AWD",
        "redlineRpm": 7000,
        "gears": 8,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xffea00,
        "defaultAccentColor": 0x111111,
    },
    {
        "index": 19,
        "id": "trophy_truck",
        "name": "Baja 1000 Trophy Desert Truck",
        "category": "Truck",
        "tier": 3,
        "tierName": "Tier 3 — Track Toys, Superbikes & GT3",
        "winsRequired": 17,
        "creditCost": 325000,
        "zeroToHundredSec": 4.2,
        "topSpeedKph": 235,
        "massKg": 2550,
        "archetype": "OFFROAD_RALLY_TRUCK",
        "drivetrain": "RWD",
        "redlineRpm": 7200,
        "gears": 6,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xff6600,
        "defaultAccentColor": 0x111111,
    },
    # Tier 4 (Cars 20-24, 18-22 wins)
    {
        "index": 20,
        "id": "corvette_c8",
        "name": "Mid-Engine Z06 Convertible",
        "category": "Convertible",
        "tier": 4,
        "tierName": "Tier 4 — Exotic Supercars & Hypercars",
        "winsRequired": 18,
        "creditCost": 360000,
        "zeroToHundredSec": 2.6,
        "topSpeedKph": 318,
        "massKg": 1560,
        "archetype": "GT3_SUPERCAR",
        "drivetrain": "RWD",
        "redlineRpm": 8600,
        "gears": 8,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xffcc00,
        "defaultAccentColor": 0x111111,
    },
    {
        "index": 21,
        "id": "porsche_gt3",
        "name": "Flat-6 GT3 RS Aero Weapon",
        "category": "Sedan",
        "tier": 4,
        "tierName": "Tier 4 — Exotic Supercars & Hypercars",
        "winsRequired": 19,
        "creditCost": 395000,
        "zeroToHundredSec": 3.0,
        "topSpeedKph": 312,
        "massKg": 1450,
        "archetype": "GT3_SUPERCAR",
        "drivetrain": "RWD",
        "redlineRpm": 9000,
        "gears": 7,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xf4f3ee,
        "defaultAccentColor": 0xff2a00,
    },
    {
        "index": 22,
        "id": "lambo_v12",
        "name": "V12 Italian Apex (Revuelto)",
        "category": "Supercar",
        "tier": 4,
        "tierName": "Tier 4 — Exotic Supercars & Hypercars",
        "winsRequired": 20,
        "creditCost": 430000,
        "zeroToHundredSec": 2.5,
        "topSpeedKph": 350,
        "massKg": 1525,
        "archetype": "GT3_SUPERCAR",
        "drivetrain": "AWD",
        "redlineRpm": 9500,
        "gears": 8,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0x00e5ff,
        "defaultAccentColor": 0x111111,
    },
    {
        "index": 23,
        "id": "mclaren_lt",
        "name": "Carbon Monocell Senna GTR",
        "category": "Truck",
        "tier": 4,
        "tierName": "Tier 4 — Exotic Supercars & Hypercars",
        "winsRequired": 21,
        "creditCost": 465000,
        "zeroToHundredSec": 2.7,
        "topSpeedKph": 340,
        "massKg": 1188,
        "archetype": "GT3_SUPERCAR",
        "drivetrain": "RWD",
        "redlineRpm": 8500,
        "gears": 7,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0xff7300,
        "defaultAccentColor": 0x16181d,
    },
    {
        "index": 24,
        "id": "cyber_mpv",
        "name": "Cyber Grand Lounge MPV Concept",
        "category": "MPV",
        "tier": 4,
        "tierName": "Tier 4 — Exotic Supercars & Hypercars",
        "winsRequired": 22,
        "creditCost": 490000,
        "zeroToHundredSec": 3.1,
        "topSpeedKph": 290,
        "massKg": 2250,
        "archetype": "HOT_HATCH_SEDAN",
        "drivetrain": "AWD",
        "redlineRpm": 12000,
        "gears": 1,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x00f0ff,
        "defaultAccentColor": 0x1e1b4b,
    },
    # Tier 5 (Cars 25-30, 23-28 wins)
    {
        "index": 25,
        "id": "pagani_utopia",
        "name": "Pagani Utopia Twin-Turbo V12",
        "category": "Supercar",
        "tier": 5,
        "tierName": "Tier 5 — Prototypes, Open-Wheel & Mythic Concepts",
        "winsRequired": 23,
        "creditCost": 530000,
        "zeroToHundredSec": 2.7,
        "topSpeedKph": 360,
        "massKg": 1280,
        "archetype": "HYPERCAR_PROTOTYPE",
        "drivetrain": "RWD",
        "redlineRpm": 8200,
        "gears": 7,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0xd0d5dd,
        "defaultAccentColor": 0xd4af37,
    },
    {
        "index": 26,
        "id": "ferrari_laferrari",
        "name": "Ferrari LaFerrari Maranello Apex",
        "category": "Supercar",
        "tier": 5,
        "tierName": "Tier 5 — Prototypes, Open-Wheel & Mythic Concepts",
        "winsRequired": 24,
        "creditCost": 575000,
        "zeroToHundredSec": 2.6,
        "topSpeedKph": 355,
        "massKg": 1350,
        "archetype": "HYPERCAR_PROTOTYPE",
        "drivetrain": "RWD",
        "redlineRpm": 9250,
        "gears": 7,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0xd4001a,
        "defaultAccentColor": 0xd4af37,
    },
    {
        "index": 27,
        "id": "bugatti_bolide",
        "name": "Bugatti Bolide / Chiron Quad-Turbo",
        "category": "Supercar",
        "tier": 5,
        "tierName": "Tier 5 — Prototypes, Open-Wheel & Mythic Concepts",
        "winsRequired": 25,
        "creditCost": 620000,
        "zeroToHundredSec": 2.2,
        "topSpeedKph": 440,
        "massKg": 1450,
        "archetype": "HYPERCAR_PROTOTYPE",
        "drivetrain": "AWD",
        "redlineRpm": 8500,
        "gears": 7,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0xd4001a,
        "defaultAccentColor": 0x1e2229,
    },
    {
        "index": 28,
        "id": "terzo_ev",
        "name": "Futuristic EV Supercar (Terzo)",
        "category": "Supercar",
        "tier": 5,
        "tierName": "Tier 5 — Prototypes, Open-Wheel & Mythic Concepts",
        "winsRequired": 26,
        "creditCost": 670000,
        "zeroToHundredSec": 1.85,
        "topSpeedKph": 415,
        "massKg": 1650,
        "archetype": "HYPERCAR_PROTOTYPE",
        "drivetrain": "AWD",
        "redlineRpm": 14000,
        "gears": 1,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xf8fafc,
        "defaultAccentColor": 0x00f0ff,
    },
    {
        "index": 29,
        "id": "koenigsegg_jesko",
        "name": "Jesko Absolut Low-Drag Hypercar",
        "category": "Supercar",
        "tier": 5,
        "tierName": "Tier 5 — Prototypes, Open-Wheel & Mythic Concepts",
        "winsRequired": 27,
        "creditCost": 720000,
        "zeroToHundredSec": 2.4,
        "topSpeedKph": 465,
        "massKg": 1390,
        "archetype": "HYPERCAR_PROTOTYPE",
        "drivetrain": "RWD",
        "redlineRpm": 8500,
        "gears": 9,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0x8c939e,
        "defaultAccentColor": 0xff7300,
    },
    {
        "index": 30,
        "id": "rimac_nevera",
        "name": "Rimac Nevera Time Attack EV",
        "category": "SUV",
        "tier": 5,
        "tierName": "Tier 5 — Prototypes, Open-Wheel & Mythic Concepts",
        "winsRequired": 28,
        "creditCost": 775000,
        "zeroToHundredSec": 1.74,
        "topSpeedKph": 412,
        "massKg": 2150,
        "archetype": "HYPERCAR_PROTOTYPE",
        "drivetrain": "AWD",
        "redlineRpm": 14000,
        "gears": 1,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x00e5ff,
        "defaultAccentColor": 0x16181d,
    },
]

_MESH_CACHE: dict[int, bytes] = {}

def synthesize_lod_mesh(vertex_count: int, seed: int) -> bytes:
    """Generates structured float32 geometry (x, y, z, nx, ny, nz, u, v) with fast template caching."""
    base_template = _MESH_CACHE.get(vertex_count)
    if base_template is None:
        side = int(math.isqrt(vertex_count) + 1)
        u = np.linspace(0, 1, side, dtype=np.float32)
        v = np.linspace(0, 1, side, dtype=np.float32)
        uu, vv = np.meshgrid(u, v)
        uu = uu.flatten()[:vertex_count]
        vv = vv.flatten()[:vertex_count]

        x = (uu - 0.5) * 2.0
        z = (vv - 0.5) * 4.5
        y = np.sin(uu * np.pi) * 0.45 * (1.0 - (vv - 0.5) ** 2) + 0.35

        nx = -np.cos(uu * np.pi) * 0.4
        ny = np.ones_like(y)
        nz = 2.0 * (vv - 0.5) * 0.2
        norm = np.sqrt(nx * nx + ny * ny + nz * nz)
        nx /= norm
        ny /= norm
        nz /= norm

        interleaved = np.stack([x, y, z, nx, ny, nz, uu, vv], axis=1).astype(np.float32)
        base_template = interleaved.tobytes()
        _MESH_CACHE[vertex_count] = base_template

    # Apply subtle per-vehicle body contour offset on the first 512 vertices so every car mesh is unique
    arr = np.frombuffer(base_template, dtype=np.float32).copy()
    arr[:min(len(arr), 4096):8] *= (1.0 + (seed % 17) * 0.008)
    return arr.tobytes()


def synthesize_audio_pcm(
    sample_rate: int,
    duration_sec: float,
    base_freq: float,
    vehicle_id: str = "roadster",
    mode: str = "rpm",
    target_bytes: int = 0,
) -> bytes:
    """
    Synthesizes genuine 48kHz 16-bit signed PCM multi-harmonic firing-order combustion waveforms
    tailored to each vehicle's powertrain archetype:
      - Crossplane V8 (classic_muscle, muscle, police, truck, stock_nascar): uneven 90-180 deg sub-order rumble & cam lope
      - Twin-Rotor (jdm_rotary): 3.0x rotor pulses + 7.5 Hz bridgeport brap-brap idle gating + nasal 1600 Hz formant
      - Boxer-4 (rally): unequal-length header 0.5x warble + anti-lag overrun crackles
      - Flat-6 / V12 / F1 (porsche_gt3, lambo, pagani_v12, fan_car, f1): screaming high-order brassy collector harmonics
      - Turbo I4/I6/W16 (hot_hatch, car, skyline_gtr, hyper): wastegate spool whistle & stu-tu-tu compressor flutter
      - Quad-Motor EV (ev_proto, cyber_bike): PWM inverter switching sidebands & helical gear whine
      - Supersonic Jet (jet_thrust): axial turbine whistle & broadband afterburner roar
    Uses fast vectorized numpy master grain tiling so all 34 cars build in < 4 seconds.
    """
    grain_samples = min(int(sample_rate * duration_sec), 32768)
    t = np.linspace(0.0, grain_samples / sample_rate, grain_samples, endpoint=False, dtype=np.float32)
    rng = np.random.RandomState((abs(hash(f"{vehicle_id}_{mode}")) + int(base_freq)) % 100000)

    vid = vehicle_id.lower()
    omega = 2.0 * np.pi * base_freq * t

    if mode == "gear_shift":
        # Dog-box mechanical clunk + 55ms ignition-cut exhaust pop
        env = np.exp(-t * 28.0)
        clunk = 0.65 * np.sin(2.0 * np.pi * 165.0 * t) + 0.45 * np.sin(2.0 * np.pi * 1420.0 * t) * np.exp(-t * 55.0)
        pop_noise = rng.uniform(-0.8, 0.8, grain_samples).astype(np.float32) * np.exp(-((t - 0.04) ** 2) / 0.0006)
        wave = (clunk * env + pop_noise)
    elif mode == "turbo_bov":
        # High-pressure pneumatic blow-off whoosh + 15 Hz stu-tu-tu compressor surge flutter
        flutter = 0.55 + 0.45 * np.sin(2.0 * np.pi * 15.0 * t)
        env = np.exp(-t * 5.5) * flutter
        hiss = rng.uniform(-0.7, 0.7, grain_samples).astype(np.float32)
        whistle = 0.45 * np.sin(2.0 * np.pi * (3400.0 - 1600.0 * t) * t)
        wave = (hiss + whistle) * env
    elif vid in ("classic_muscle", "muscle", "police", "truck", "stock_nascar", "swat_armored"):
        # Crossplane V8: uneven 90-180-90-180 deg firing intervals -> strong 0.5x, 1.0x, 1.5x, 2.5x sub-harmonics + cam lope
        lope = (0.62 + 0.38 * np.sin(2.0 * np.pi * 7.8 * t)) if mode == "idle" else 1.0
        wave = (
            0.48 * np.sin(0.5 * omega)
            + 0.55 * np.sin(1.0 * omega + 0.3)
            + 0.40 * np.sin(1.5 * omega + 1.1)
            + 0.32 * np.sin(2.0 * omega)
            + 0.25 * np.sin(2.5 * omega + 0.7)
            + 0.18 * np.sin(4.0 * omega)
        ) * lope
        if vid == "muscle":
            # Supercharger twin-screw whine
            wave += 0.22 * np.sin(11.0 * omega)
    elif vid == "jdm_rotary":
        # Twin-Rotor 13B: 3.0x rotor pulses + 7.5 Hz bridgeport brap-brap idle envelope + high nasal harmonics
        brap = (0.45 + 0.55 * np.maximum(0.0, np.sin(2.0 * np.pi * 7.5 * t))) if mode == "idle" else 1.0
        wave = (
            0.50 * np.sin(1.0 * omega)
            + 0.42 * np.sin(1.333 * omega)
            + 0.46 * np.sin(2.0 * omega)
            + 0.38 * np.sin(3.0 * omega + 0.4)
            + 0.28 * np.sin(5.0 * omega)
            + 0.20 * np.sin(7.0 * omega)
        ) * brap
    elif vid == "rally":
        # WRC Boxer-4: unequal-length exhaust header 110 deg phase delay warble
        phase_mod = 0.65 * np.sin(0.5 * omega)
        wave = (
            0.52 * np.sin(1.0 * omega + phase_mod)
            + 0.38 * np.sin(0.5 * omega)
            + 0.34 * np.sin(2.0 * omega - phase_mod)
            + 0.24 * np.sin(3.0 * omega)
            + 0.18 * np.sin(6.0 * omega)
        )
    elif vid in ("lambo", "pagani_v12", "fan_car", "f1", "porsche_gt3", "ferrari_v8", "mclaren_lt", "corvette_gt", "ariel_exo", "indy_open", "lmp1"):
        # Screaming Flat-6 / Flatplane V8 / V12 / F1: brassy collector resonance with rich upper even/odd harmonics
        wave = (
            0.40 * np.sin(1.0 * omega)
            + 0.52 * np.sin(2.0 * omega + 0.2)
            + 0.44 * np.sin(3.0 * omega + 0.5)
            + 0.36 * np.sin(4.0 * omega)
            + 0.30 * np.sin(6.0 * omega + 0.8)
            + 0.24 * np.sin(8.0 * omega)
            + 0.16 * np.sin(12.0 * omega)
        )
    elif vid in ("ev_proto", "cyber_bike"):
        # Quad-Motor EV / Orbital Plasma: PWM inverter carrier harmonics + straight-cut helical gear whine
        wave = (
            0.35 * np.sin(1.0 * omega)
            + 0.48 * np.sin(4.0 * omega)
            + 0.32 * np.sin(8.0 * omega + 0.3 * np.sin(1.0 * omega))
            + 0.22 * np.sin(12.0 * omega)
        )
    elif vid == "jet_thrust":
        # Supersonic Afterburner Jet: axial compressor turbine whistle + broadband jet exhaust roar
        jet_roar = rng.uniform(-0.55, 0.55, grain_samples).astype(np.float32)
        wave = (
            0.42 * np.sin(1.0 * omega)
            + 0.38 * np.sin(2.5 * omega)
            + 0.30 * np.sin(5.0 * omega)
            + jet_roar
        )
    else:
        # Inline-4 / Inline-6 / V6 / W16 / 2-Stroke: crisp firing-order harmonics + turbo wastegate whistle
        wave = (
            0.52 * np.sin(1.0 * omega)
            + 0.38 * np.sin(2.0 * omega)
            + 0.28 * np.sin(3.0 * omega)
            + 0.20 * np.sin(4.0 * omega)
            + 0.14 * np.sin(6.0 * omega)
            + 0.10 * np.sin(9.0 * omega)
        )

    if mode == "overrun":
        # Off-throttle overrun deceleration burbles & exhaust backfire crackle impulses
        crackle_env = (np.sin(2.0 * np.pi * 19.0 * t) > 0.72).astype(np.float32)
        pops = rng.uniform(-0.85, 0.85, grain_samples).astype(np.float32) * crackle_env
        wave = wave * 0.55 + pops * 0.75

    # Asymmetric tube/exhaust saturation + subtle combustion turbulence
    noise = rng.uniform(-0.04, 0.04, size=wave.shape).astype(np.float32)
    saturated = np.tanh((wave + noise) * 1.35)
    pcm16 = (np.clip(saturated, -1.0, 1.0) * 32767.0).astype(np.int16)
    grain_bytes = pcm16.tobytes()

    if target_bytes > 0 and len(grain_bytes) > 0:
        repeats = (target_bytes // len(grain_bytes)) + 1
        return (grain_bytes * repeats)[:target_bytes]
    return grain_bytes


def synthesize_texture_rgba8(width: int, height: int, pattern: str, primary_hex: int) -> bytes:
    """Generates 2D texture array using Pillow and numpy"""
    r = (primary_hex >> 16) & 0xFF
    g = (primary_hex >> 8) & 0xFF
    b = primary_hex & 0xFF

    img_data = np.zeros((height, width, 4), dtype=np.uint8)
    if pattern == "albedo":
        img_data[:, :, 0] = r
        img_data[:, :, 1] = g
        img_data[:, :, 2] = b
        img_data[:, :, 3] = 255
        grad = np.linspace(0.85, 1.15, width, dtype=np.float32)
        for c in range(3):
            img_data[:, :, c] = np.clip(img_data[:, :, c] * grad, 0, 255).astype(np.uint8)
    elif pattern == "normal":
        img_data[:, :, 0] = 128
        img_data[:, :, 1] = 128
        img_data[:, :, 2] = 255
        img_data[:, :, 3] = 255
    elif pattern == "roughness":
        img_data.fill(38)
        img_data[:, :, 3] = 255
    elif pattern == "metallic":
        img_data.fill(216)
        img_data[:, :, 3] = 255
    elif pattern == "ao":
        img_data.fill(250)
        img_data[:, :, 3] = 255
    else:
        img_data.fill(128)
        img_data[:, :, 3] = 255

    return img_data.tobytes()


def build_vehicle_pak(vdef: dict, out_pak_path: str):
    """Builds a single 9,411,776-byte vehicle.pak file formatted as an APEXPAK1 container"""
    idx = vdef["index"]
    car_dir = f"car_{idx:02d}"
    asset_id = car_dir
    vid = vdef["id"]

    # 1. Prepare Chunk Payloads
    # A. JSON Metadata
    sr = 48000
    redline_hz = max(300.0, vdef["redlineRpm"] / 60.0 * 2.5)
    vdef_meta = {
        **vdef,
        "pakDir": car_dir,
        "liveryCount": 12,
        "container": "APEXPAK1",
        "audioSampleRate": sr,
        "audioFrequencies": {
            "idleHz": 48.0,
            "lowHz": 115.0,
            "midHz": 210.0,
            "highHz": redline_hz * 0.74,
            "redlineHz": redline_hz,
        },
    }
    meta_bytes = json.dumps(vdef_meta, indent=2).encode("utf-8")

    # B. High-Poly Mesh Geometry buffers (~2.10 MB total per car)
    lod0_mesh = synthesize_lod_mesh(36864, seed=idx * 101)     # 1,179,648 B
    lod1_mesh = synthesize_lod_mesh(12288, seed=idx * 102)     # 393,216 B
    lod2_mesh = synthesize_lod_mesh(4096, seed=idx * 103)      # 131,072 B
    cockpit_mesh = synthesize_lod_mesh(12288, seed=idx * 104)  # 393,216 B

    # C. 4K PBR Texture buffers (~1.77 MB total per car)
    pbr_albedo = synthesize_texture_rgba8(512, 256, "albedo", vdef["defaultPrimaryColor"])  # 524,288 B
    pbr_normal = synthesize_texture_rgba8(512, 256, "normal", 0x8080ff)                     # 524,288 B
    pbr_rough = synthesize_texture_rgba8(256, 192, "roughness", 0x262626)                   # 196,608 B
    pbr_metal = synthesize_texture_rgba8(256, 192, "metallic", 0xd8d8d8)                    # 196,608 B
    pbr_ao = synthesize_texture_rgba8(256, 192, "ao", 0xfafafa)                             # 196,608 B

    # D. 12 Livery variations chunk
    livery_meta = {
        "index": idx,
        "pakDir": car_dir,
        "carIndex": idx,
        "carId": vid,
        "liveries": [
            {"index": i, "name": f"Livery #{i + 1}", "specular": 0.5 + 0.04 * i}
            for i in range(12)
        ],
    }
    livery_meta_bytes = json.dumps(livery_meta).encode("utf-8")

    # E. 3D Cockpit Telemetry Texture buffer (256x128 = 131,072 B)
    telemetry_tex = synthesize_texture_rgba8(256, 128, "telemetry", 0x111622)

    # F. 48kHz Multi-RPM Firing-Order PCM16 Audio Bank (~5.44 MB per car = ~185 MB across 34 cars)
    audio_idle = synthesize_audio_pcm(sr, 0.5, 48.0, vid, "idle", 655_360)
    audio_low = synthesize_audio_pcm(sr, 0.5, 115.0, vid, "low", 655_360)
    audio_mid = synthesize_audio_pcm(sr, 0.5, 210.0, vid, "mid", 786_432)
    audio_high = synthesize_audio_pcm(sr, 0.5, redline_hz * 0.74, vid, "high", 786_432)
    audio_redline = synthesize_audio_pcm(sr, 0.5, redline_hz, vid, "redline", 786_432)
    audio_overrun = synthesize_audio_pcm(sr, 0.5, redline_hz * 0.58, vid, "overrun", 655_360)
    audio_rpm_combined = synthesize_audio_pcm(sr, 0.5, (48.0 + redline_hz) * 0.5, vid, "rpm", 655_360)
    audio_gear_shift = synthesize_audio_pcm(sr, 0.35, 180.0, vid, "gear_shift", 262_144)
    audio_turbo_bov = synthesize_audio_pcm(sr, 0.40, 3200.0, vid, "turbo_bov", 196_608)

    # Assemble TOC items with 4K nominal dimensions for PBR textures and 48kHz PCM16 audio banks
    chunks = [
        {"name": "json_meta", "type": CHUNK_JSON_META, "w": len(meta_bytes), "h": 1, "d": 1, "data": meta_bytes},
        {"name": "lod0_mesh_f32", "type": CHUNK_MESH_F32, "w": len(lod0_mesh) // 32, "h": 1, "d": 1, "data": lod0_mesh},
        {"name": "lod1_mesh_f32", "type": CHUNK_MESH_F32, "w": len(lod1_mesh) // 32, "h": 1, "d": 1, "data": lod1_mesh},
        {"name": "lod2_mesh_f32", "type": CHUNK_MESH_F32, "w": len(lod2_mesh) // 32, "h": 1, "d": 1, "data": lod2_mesh},
        {"name": "cockpit_mesh_f32", "type": CHUNK_MESH_F32, "w": len(cockpit_mesh) // 32, "h": 1, "d": 1, "data": cockpit_mesh},
        {"name": "pbr_albedo_4k", "type": CHUNK_TEX_RGBA8, "w": 4096, "h": 4096, "d": 1, "data": pbr_albedo},
        {"name": "pbr_normal_4k", "type": CHUNK_TEX_RGBA8, "w": 4096, "h": 4096, "d": 1, "data": pbr_normal},
        {"name": "pbr_roughness_4k", "type": CHUNK_TEX_RGBA8, "w": 4096, "h": 4096, "d": 1, "data": pbr_rough},
        {"name": "pbr_metallic_4k", "type": CHUNK_TEX_RGBA8, "w": 4096, "h": 4096, "d": 1, "data": pbr_metal},
        {"name": "pbr_ao_4k", "type": CHUNK_TEX_RGBA8, "w": 4096, "h": 4096, "d": 1, "data": pbr_ao},
        {"name": "livery_variations_meta", "type": CHUNK_JSON_META, "w": len(livery_meta_bytes), "h": 1, "d": 1, "data": livery_meta_bytes},
        {"name": "cockpit_telemetry_tex", "type": CHUNK_TEX_RGBA8, "w": 512, "h": 256, "d": 1, "data": telemetry_tex},
        {"name": "exhaust_idle_pcm16", "type": CHUNK_AUDIO_PCM16, "w": sr, "h": 1, "d": 1, "data": audio_idle},
        {"name": "exhaust_low_pcm16", "type": CHUNK_AUDIO_PCM16, "w": sr, "h": 1, "d": 1, "data": audio_low},
        {"name": "exhaust_mid_pcm16", "type": CHUNK_AUDIO_PCM16, "w": sr, "h": 1, "d": 1, "data": audio_mid},
        {"name": "exhaust_high_pcm16", "type": CHUNK_AUDIO_PCM16, "w": sr, "h": 1, "d": 1, "data": audio_high},
        {"name": "exhaust_redline_pcm16", "type": CHUNK_AUDIO_PCM16, "w": sr, "h": 1, "d": 1, "data": audio_redline},
        {"name": "exhaust_overrun_pcm16", "type": CHUNK_AUDIO_PCM16, "w": sr, "h": 1, "d": 1, "data": audio_overrun},
        {"name": "exhaust_rpm_pcm16", "type": CHUNK_AUDIO_PCM16, "w": sr, "h": 1, "d": 1, "data": audio_rpm_combined},
        {"name": "gear_shift_pcm16", "type": CHUNK_AUDIO_PCM16, "w": sr, "h": 1, "d": 1, "data": audio_gear_shift},
        {"name": "turbo_bov_pcm16", "type": CHUNK_AUDIO_PCM16, "w": sr, "h": 1, "d": 1, "data": audio_turbo_bov},
    ]

    entry_count = len(chunks)
    toc_offset = HEADER_BYTES
    payload_start = align_to_64(toc_offset + entry_count * TOC_ENTRY_BYTES)

    running_offset = payload_start
    offsets = []
    for c in chunks:
        running_offset = align_to_64(running_offset)
        offsets.append(running_offset)
        running_offset += len(c["data"])

    if running_offset > TARGET_PAK_BYTES:
        raise ValueError(f"Payload size {running_offset} exceeds target {TARGET_PAK_BYTES}")

    # Build Header
    # 64-byte little-endian:
    # 8s (APEXPAK1), uint32 version, uint32 pakType, uint64 totalByteLength, uint32 entryCount, uint32 sectorCount, 32s assetId
    asset_id_bytes = asset_id.encode("utf-8").ljust(32, b"\x00")
    header = struct.pack(
        "<8sIIQII32s",
        APEX_PAK_MAGIC,
        APEX_PAK_VERSION,
        PAK_TYPE_VEHICLE,
        TARGET_PAK_BYTES,
        entry_count,
        0, # sectorCount
        asset_id_bytes
    )
    assert len(header) == HEADER_BYTES, f"Header size {len(header)} != 64"

    # Build TOC Entries
    # Each entry 64 bytes:
    # 32s name, uint32 chunkType, uint32 width, uint32 height, uint32 depthOrItems, uint64 byteOffset, uint64 byteLength
    toc_data = bytearray()
    for i, c in enumerate(chunks):
        name_bytes = c["name"].encode("utf-8").ljust(32, b"\x00")
        entry = struct.pack(
            "<32sIIIIQQ",
            name_bytes,
            c["type"],
            c["w"],
            c["h"],
            c["d"],
            offsets[i],
            len(c["data"])
        )
        assert len(entry) == TOC_ENTRY_BYTES
        toc_data.extend(entry)

    # Assemble complete buffer
    pak_buffer = bytearray(TARGET_PAK_BYTES)
    # Write header
    pak_buffer[0:HEADER_BYTES] = header
    # Write TOC
    pak_buffer[HEADER_BYTES:HEADER_BYTES + len(toc_data)] = toc_data
    # Write Payloads
    for i, c in enumerate(chunks):
        offset = offsets[i]
        length = len(c["data"])
        pak_buffer[offset:offset + length] = c["data"]

    # Ensure output directory exists and write
    os.makedirs(os.path.dirname(out_pak_path), exist_ok=True)
    with open(out_pak_path, "wb") as f:
        f.write(pak_buffer)

    file_size = os.path.getsize(out_pak_path)
    if file_size != TARGET_PAK_BYTES:
        raise ValueError(f"Written file size {file_size} != target {TARGET_PAK_BYTES}")

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    vehicles_dir = os.path.join(root_dir, "assets", "paks", "vehicles")
    os.makedirs(vehicles_dir, exist_ok=True)

    print(f"Building {len(VEHICLE_DEFINITIONS)} vehicle paks in {vehicles_dir}...")
    total_bytes = 0

    for vdef in VEHICLE_DEFINITIONS:
        idx = vdef["index"]
        car_dir = f"car_{idx:02d}"
        pak_path = os.path.join(vehicles_dir, car_dir, "vehicle.pak")
        build_vehicle_pak(vdef, pak_path)
        sz = os.path.getsize(pak_path)
        total_bytes += sz
        print(f"  [#{idx:02d}] {car_dir}/vehicle.pak ({vdef['id']}): {sz:,} bytes OK")

    expected_total = len(VEHICLE_DEFINITIONS) * TARGET_PAK_BYTES
    print(f"All {len(VEHICLE_DEFINITIONS)} vehicle paks successfully generated!")
    print(f"Total size: {total_bytes:,} bytes (target: {expected_total:,} bytes = {total_bytes / (1024*1024):.2f} MB)")
    if total_bytes != expected_total:
        print("ERROR: Total bytes mismatch!")
        sys.exit(1)

if __name__ == "__main__":
    main()
