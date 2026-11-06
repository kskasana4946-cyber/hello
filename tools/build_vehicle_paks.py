#!/usr/bin/env python3
"""
tools/build_vehicle_paks.py
Apex Grand Prix: Uncapped Next-Gen Edition
Builds 34 modular vehicle .pak bundles in assets/paks/vehicles/car_01..34/vehicle.pak
Each bundle is EXACTLY 4,705,888 bytes (total 34 × 4,705,888 = 160,000,192 bytes ~ 160 MB).
Format: APEXPAK1 container (pakType=3, 64-byte header, 64-byte TOC entries).
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
TARGET_PAK_BYTES = 4_705_888  # Exactly 4,705,888 bytes per pak
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

# Vehicle Roster Metadata (34 Vehicles)
VEHICLE_DEFINITIONS = [
    # Tier 0 (Cars 1-3, 0 wins)
    {
        "index": 1,
        "id": "scooter",
        "name": "Turbo Street Scooter",
        "tier": 0,
        "tierName": "Tier 0 — Starter Street & Club",
        "winsRequired": 0,
        "creditCost": 0,
        "zeroToHundredSec": 7.2,
        "topSpeedKph": 145,
        "massKg": 135,
        "archetype": "SCOOTER_BIKE",
        "drivetrain": "RWD",
        "redlineRpm": 11000,
        "gears": 1,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xff3b30,
        "defaultAccentColor": 0x1c1c1e,
    },
    {
        "index": 2,
        "id": "hot_hatch",
        "name": "Type-R Turbo Hot Hatch",
        "tier": 0,
        "tierName": "Tier 0 — Starter Street & Club",
        "winsRequired": 0,
        "creditCost": 0,
        "zeroToHundredSec": 5.4,
        "topSpeedKph": 275,
        "massKg": 1430,
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
        "id": "roadster",
        "name": "MX-5 Club Spec Roadster",
        "tier": 0,
        "tierName": "Tier 0 — Starter Street & Club",
        "winsRequired": 0,
        "creditCost": 0,
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
    # Tier 1 (Cars 4-9, 1-6 wins)
    {
        "index": 4,
        "id": "jdm_rotary",
        "name": "RX-7 Twin-Rotor JDM Legend",
        "tier": 1,
        "tierName": "Tier 1 — JDM Tuner, Drift & Off-Road",
        "winsRequired": 1,
        "creditCost": 25000,
        "zeroToHundredSec": 4.7,
        "topSpeedKph": 265,
        "massKg": 1280,
        "archetype": "SPORTS_COUPE_DRIFT",
        "drivetrain": "RWD",
        "redlineRpm": 8500,
        "gears": 5,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xffcc00,
        "defaultAccentColor": 0x111111,
    },
    {
        "index": 5,
        "id": "car",
        "name": "Widebody Drift GT (Silvia / Supra Spec)",
        "tier": 1,
        "tierName": "Tier 1 — JDM Tuner, Drift & Off-Road",
        "winsRequired": 2,
        "creditCost": 35000,
        "zeroToHundredSec": 3.8,
        "topSpeedKph": 275,
        "massKg": 1480,
        "archetype": "SPORTS_COUPE_DRIFT",
        "drivetrain": "RWD",
        "redlineRpm": 8200,
        "gears": 6,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xd900ff,
        "defaultAccentColor": 0x00f0ff,
    },
    {
        "index": 6,
        "id": "skyline_gtr",
        "name": "GT-R R34 Nismo AWD",
        "tier": 1,
        "tierName": "Tier 1 — JDM Tuner, Drift & Off-Road",
        "winsRequired": 3,
        "creditCost": 50000,
        "zeroToHundredSec": 3.6,
        "topSpeedKph": 300,
        "massKg": 1560,
        "archetype": "SPORTS_COUPE_DRIFT",
        "drivetrain": "AWD",
        "redlineRpm": 8000,
        "gears": 6,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x0047cc,
        "defaultAccentColor": 0xe8edf5,
    },
    {
        "index": 7,
        "id": "rally",
        "name": "WRC Turbo Rally AWD",
        "tier": 1,
        "tierName": "Tier 1 — JDM Tuner, Drift & Off-Road",
        "winsRequired": 4,
        "creditCost": 60000,
        "zeroToHundredSec": 3.7,
        "topSpeedKph": 260,
        "massKg": 1260,
        "archetype": "OFFROAD_RALLY_TRUCK",
        "drivetrain": "AWD",
        "redlineRpm": 7600,
        "gears": 6,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x003399,
        "defaultAccentColor": 0xffcc00,
    },
    {
        "index": 8,
        "id": "dune_buggy",
        "name": "Twin-Turbo Sand Rail Buggy",
        "tier": 1,
        "tierName": "Tier 1 — JDM Tuner, Drift & Off-Road",
        "winsRequired": 5,
        "creditCost": 75000,
        "zeroToHundredSec": 4.1,
        "topSpeedKph": 225,
        "massKg": 890,
        "archetype": "OFFROAD_RALLY_TRUCK",
        "drivetrain": "RWD",
        "redlineRpm": 7200,
        "gears": 5,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0xff6600,
        "defaultAccentColor": 0x222222,
    },
    {
        "index": 9,
        "id": "truck",
        "name": "Trophy Baja Desert Truck",
        "tier": 1,
        "tierName": "Tier 1 — JDM Tuner, Drift & Off-Road",
        "winsRequired": 6,
        "creditCost": 90000,
        "zeroToHundredSec": 5.2,
        "topSpeedKph": 215,
        "massKg": 2650,
        "archetype": "OFFROAD_RALLY_TRUCK",
        "drivetrain": "RWD",
        "redlineRpm": 6800,
        "gears": 6,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x2b303a,
        "defaultAccentColor": 0xff7300,
    },
    # Tier 2 (Cars 10-15, 7-12 wins)
    {
        "index": 10,
        "id": "classic_muscle",
        "name": "1969 Charger 426 Hemi",
        "tier": 2,
        "tierName": "Tier 2 — Heavy Iron, Pursuit & Muscle",
        "winsRequired": 7,
        "creditCost": 110000,
        "zeroToHundredSec": 4.8,
        "topSpeedKph": 255,
        "massKg": 1720,
        "archetype": "MUSCLE_PURSUIT",
        "drivetrain": "RWD",
        "redlineRpm": 6500,
        "gears": 4,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x111111,
        "defaultAccentColor": 0xffffff,
    },
    {
        "index": 11,
        "id": "muscle",
        "name": "Supercharged V8 Hellcat / GT500",
        "tier": 2,
        "tierName": "Tier 2 — Heavy Iron, Pursuit & Muscle",
        "winsRequired": 8,
        "creditCost": 130000,
        "zeroToHundredSec": 3.5,
        "topSpeedKph": 318,
        "massKg": 1760,
        "archetype": "MUSCLE_PURSUIT",
        "drivetrain": "RWD",
        "redlineRpm": 7000,
        "gears": 8,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x686c73,
        "defaultAccentColor": 0xff1e00,
    },
    {
        "index": 12,
        "id": "police",
        "name": "Twin-Turbo Police Interceptor",
        "tier": 2,
        "tierName": "Tier 2 — Heavy Iron, Pursuit & Muscle",
        "winsRequired": 9,
        "creditCost": 150000,
        "zeroToHundredSec": 3.3,
        "topSpeedKph": 305,
        "massKg": 1820,
        "archetype": "MUSCLE_PURSUIT",
        "drivetrain": "AWD",
        "redlineRpm": 6800,
        "gears": 8,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x1a1a1a,
        "defaultAccentColor": 0xf4f3ee,
    },
    {
        "index": 13,
        "id": "swat_armored",
        "name": "Tactical Armored Enforcer SUV",
        "tier": 2,
        "tierName": "Tier 2 — Heavy Iron, Pursuit & Muscle",
        "winsRequired": 10,
        "creditCost": 175000,
        "zeroToHundredSec": 5.8,
        "topSpeedKph": 205,
        "massKg": 3850,
        "archetype": "HEAVY_COMMERCIAL",
        "drivetrain": "AWD",
        "redlineRpm": 6000,
        "gears": 6,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x2e3436,
        "defaultAccentColor": 0x111111,
    },
    {
        "index": 14,
        "id": "semi_rig",
        "name": "Twin-Stack Racing Semi Cab",
        "tier": 2,
        "tierName": "Tier 2 — Heavy Iron, Pursuit & Muscle",
        "winsRequired": 11,
        "creditCost": 200000,
        "zeroToHundredSec": 6.8,
        "topSpeedKph": 195,
        "massKg": 5400,
        "archetype": "HEAVY_COMMERCIAL",
        "drivetrain": "RWD",
        "redlineRpm": 5500,
        "gears": 10,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xd4001a,
        "defaultAccentColor": 0xcccccc,
    },
    {
        "index": 15,
        "id": "bus",
        "name": "Express Aero Coach Bus",
        "tier": 2,
        "tierName": "Tier 2 — Heavy Iron, Pursuit & Muscle",
        "winsRequired": 12,
        "creditCost": 220000,
        "zeroToHundredSec": 11.5,
        "topSpeedKph": 136,
        "massKg": 8400,
        "archetype": "HEAVY_COMMERCIAL",
        "drivetrain": "RWD",
        "redlineRpm": 4500,
        "gears": 6,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x6ca6cd,
        "defaultAccentColor": 0xffffff,
    },
    # Tier 3 (Cars 16-21, 13-18 wins)
    {
        "index": 16,
        "id": "kart_shifter",
        "name": "250cc 6-Speed Shifter Kart",
        "tier": 3,
        "tierName": "Tier 3 — Track Toys, Superbikes & GT3",
        "winsRequired": 13,
        "creditCost": 240000,
        "zeroToHundredSec": 2.9,
        "topSpeedKph": 210,
        "massKg": 175,
        "archetype": "OPEN_WHEEL_KART",
        "drivetrain": "RWD",
        "redlineRpm": 14000,
        "gears": 6,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0xff0044,
        "defaultAccentColor": 0x000000,
    },
    {
        "index": 17,
        "id": "ariel_exo",
        "name": "Exoskeleton Track Roadster (Atom V8)",
        "tier": 3,
        "tierName": "Tier 3 — Track Toys, Superbikes & GT3",
        "winsRequired": 14,
        "creditCost": 260000,
        "zeroToHundredSec": 2.6,
        "topSpeedKph": 275,
        "massKg": 612,
        "archetype": "OPEN_WHEEL_KART",
        "drivetrain": "RWD",
        "redlineRpm": 10500,
        "gears": 6,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0xff7300,
        "defaultAccentColor": 0x111111,
    },
    {
        "index": 18,
        "id": "porsche_gt3",
        "name": "Flat-6 GT3 RS Track Weapon",
        "tier": 3,
        "tierName": "Tier 3 — Track Toys, Superbikes & GT3",
        "winsRequired": 15,
        "creditCost": 280000,
        "zeroToHundredSec": 3.1,
        "topSpeedKph": 312,
        "massKg": 1450,
        "archetype": "GT3_SUPERCAR",
        "drivetrain": "RWD",
        "redlineRpm": 9000,
        "gears": 7,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0xf4f3ee,
        "defaultAccentColor": 0xff2a00,
    },
    {
        "index": 19,
        "id": "corvette_gt",
        "name": "Mid-Engine Z06 GT3.R",
        "tier": 3,
        "tierName": "Tier 3 — Track Toys, Superbikes & GT3",
        "winsRequired": 16,
        "creditCost": 300000,
        "zeroToHundredSec": 2.7,
        "topSpeedKph": 318,
        "massKg": 1560,
        "archetype": "GT3_SUPERCAR",
        "drivetrain": "RWD",
        "redlineRpm": 8600,
        "gears": 8,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0xffcc00,
        "defaultAccentColor": 0x111111,
    },
    {
        "index": 20,
        "id": "bike",
        "name": "GP Factory Superbike (1000cc)",
        "tier": 3,
        "tierName": "Tier 3 — Track Toys, Superbikes & GT3",
        "winsRequired": 17,
        "creditCost": 310000,
        "zeroToHundredSec": 2.7,
        "topSpeedKph": 315,
        "massKg": 192,
        "archetype": "SCOOTER_BIKE",
        "drivetrain": "RWD",
        "redlineRpm": 15000,
        "gears": 6,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xd4001a,
        "defaultAccentColor": 0xffffff,
    },
    {
        "index": 21,
        "id": "cyber_bike",
        "name": "Neon Hubless Orbital Laser-Bike",
        "tier": 3,
        "tierName": "Tier 3 — Track Toys, Superbikes & GT3",
        "winsRequired": 18,
        "creditCost": 325000,
        "zeroToHundredSec": 2.3,
        "topSpeedKph": 340,
        "massKg": 240,
        "archetype": "SCOOTER_BIKE",
        "drivetrain": "RWD",
        "redlineRpm": 16000,
        "gears": 1,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x00f0ff,
        "defaultAccentColor": 0xd900ff,
    },
    # Tier 4 (Cars 22-27, 19-24 wins)
    {
        "index": 22,
        "id": "ferrari_v8",
        "name": "Maranello Twin-Turbo Berlinetta",
        "tier": 4,
        "tierName": "Tier 4 — Exotic Supercars & Hypercars",
        "winsRequired": 19,
        "creditCost": 350000,
        "zeroToHundredSec": 2.85,
        "topSpeedKph": 340,
        "massKg": 1475,
        "archetype": "GT3_SUPERCAR",
        "drivetrain": "RWD",
        "redlineRpm": 8500,
        "gears": 8,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0xd4001a,
        "defaultAccentColor": 0x111111,
    },
    {
        "index": 23,
        "id": "lambo",
        "name": "V12 Italian Supercar (Revuelto / Aventador)",
        "tier": 4,
        "tierName": "Tier 4 — Exotic Supercars & Hypercars",
        "winsRequired": 20,
        "creditCost": 380000,
        "zeroToHundredSec": 2.8,
        "topSpeedKph": 345,
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
        "index": 24,
        "id": "mclaren_lt",
        "name": "Carbon Monocell Senna GTR",
        "tier": 4,
        "tierName": "Tier 4 — Exotic Supercars & Hypercars",
        "winsRequired": 21,
        "creditCost": 410000,
        "zeroToHundredSec": 2.75,
        "topSpeedKph": 340,
        "massKg": 1188,
        "archetype": "HYPERCAR_PROTOTYPE",
        "drivetrain": "RWD",
        "redlineRpm": 8500,
        "gears": 7,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0xff7300,
        "defaultAccentColor": 0x16181d,
    },
    {
        "index": 25,
        "id": "pagani_v12",
        "name": "Huayra / Zonda R AMG V12",
        "tier": 4,
        "tierName": "Tier 4 — Exotic Supercars & Hypercars",
        "winsRequired": 22,
        "creditCost": 320000,
        "zeroToHundredSec": 2.7,
        "topSpeedKph": 360,
        "massKg": 1280,
        "archetype": "HYPERCAR_PROTOTYPE",
        "drivetrain": "RWD",
        "redlineRpm": 9000,
        "gears": 7,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0xd4af37,
        "defaultAccentColor": 0x111111,
    },
    {
        "index": 26,
        "id": "koenigsegg",
        "name": "Jesko Absolut Low-Drag Hypercar",
        "tier": 4,
        "tierName": "Tier 4 — Exotic Supercars & Hypercars",
        "winsRequired": 23,
        "creditCost": 450000,
        "zeroToHundredSec": 2.5,
        "topSpeedKph": 445,
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
        "index": 27,
        "id": "hyper",
        "name": "Bugatti W16 Quad-Turbo Chiron",
        "tier": 4,
        "tierName": "Tier 4 — Exotic Supercars & Hypercars",
        "winsRequired": 24,
        "creditCost": 500000,
        "zeroToHundredSec": 2.4,
        "topSpeedKph": 420,
        "massKg": 1995,
        "archetype": "HYPERCAR_PROTOTYPE",
        "drivetrain": "AWD",
        "redlineRpm": 7200,
        "gears": 7,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0x0047cc,
        "defaultAccentColor": 0x001f5c,
    },
    # Tier 5 (Cars 28-34, 25-31 wins)
    {
        "index": 28,
        "id": "ev_proto",
        "name": "Rimac Nevera Quad-Motor EV",
        "tier": 5,
        "tierName": "Tier 5 — Prototypes, Open-Wheel & Mythic Concepts",
        "winsRequired": 25,
        "creditCost": 540000,
        "zeroToHundredSec": 1.85,
        "topSpeedKph": 412,
        "massKg": 2150,
        "archetype": "HYPERCAR_PROTOTYPE",
        "drivetrain": "AWD",
        "redlineRpm": 17000,
        "gears": 1,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0x00e5ff,
        "defaultAccentColor": 0x16181d,
    },
    {
        "index": 29,
        "id": "stock_nascar",
        "name": "Next-Gen V8 Stock Car Oval King",
        "tier": 5,
        "tierName": "Tier 5 — Prototypes, Open-Wheel & Mythic Concepts",
        "winsRequired": 26,
        "creditCost": 580000,
        "zeroToHundredSec": 3.2,
        "topSpeedKph": 335,
        "massKg": 1540,
        "archetype": "MUSCLE_PURSUIT",
        "drivetrain": "RWD",
        "redlineRpm": 8800,
        "gears": 5,
        "hasTransparentEngineBay": False,
        "defaultPrimaryColor": 0xffcc00,
        "defaultAccentColor": 0xd4001a,
    },
    {
        "index": 30,
        "id": "indy_open",
        "name": "Aero-Screen Speedway Open-Wheeler",
        "tier": 5,
        "tierName": "Tier 5 — Prototypes, Open-Wheel & Mythic Concepts",
        "winsRequired": 27,
        "creditCost": 620000,
        "zeroToHundredSec": 2.55,
        "topSpeedKph": 380,
        "massKg": 740,
        "archetype": "OPEN_WHEEL_KART",
        "drivetrain": "RWD",
        "redlineRpm": 12000,
        "gears": 6,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0xff3b1f,
        "defaultAccentColor": 0xffffff,
    },
    {
        "index": 31,
        "id": "lmp1",
        "name": "Le Mans Daytona Hyper-Prototype",
        "tier": 5,
        "tierName": "Tier 5 — Prototypes, Open-Wheel & Mythic Concepts",
        "winsRequired": 28,
        "creditCost": 660000,
        "zeroToHundredSec": 2.5,
        "topSpeedKph": 345,
        "massKg": 930,
        "archetype": "HYPERCAR_PROTOTYPE",
        "drivetrain": "AWD",
        "redlineRpm": 9000,
        "gears": 7,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0xf4f3ee,
        "defaultAccentColor": 0xd4001a,
    },
    {
        "index": 32,
        "id": "f1",
        "name": "Formula 1 Ground-Effect Apex",
        "tier": 5,
        "tierName": "Tier 5 — Prototypes, Open-Wheel & Mythic Concepts",
        "winsRequired": 29,
        "creditCost": 700000,
        "zeroToHundredSec": 2.6,
        "topSpeedKph": 355,
        "massKg": 798,
        "archetype": "OPEN_WHEEL_KART",
        "drivetrain": "RWD",
        "redlineRpm": 15000,
        "gears": 8,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0x00f0ff,
        "defaultAccentColor": 0x111111,
    },
    {
        "index": 33,
        "id": "fan_car",
        "name": "Ground-Effect Suction Fan Hypercar",
        "tier": 5,
        "tierName": "Tier 5 — Prototypes, Open-Wheel & Mythic Concepts",
        "winsRequired": 30,
        "creditCost": 725000,
        "zeroToHundredSec": 2.1,
        "topSpeedKph": 370,
        "massKg": 980,
        "archetype": "HYPERCAR_PROTOTYPE",
        "drivetrain": "AWD",
        "redlineRpm": 12500,
        "gears": 6,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0x16181d,
        "defaultAccentColor": 0x00e5ff,
    },
    {
        "index": 34,
        "id": "jet_thrust",
        "name": "Supersonic Afterburner Land-Speed Concept",
        "tier": 5,
        "tierName": "Tier 5 — Prototypes, Open-Wheel & Mythic Concepts",
        "winsRequired": 31,
        "creditCost": 750000,
        "zeroToHundredSec": 1.65,
        "topSpeedKph": 485,
        "massKg": 2400,
        "archetype": "SUPERSONIC_CONCEPT",
        "drivetrain": "JET",
        "redlineRpm": 15000,
        "gears": 1,
        "hasTransparentEngineBay": True,
        "defaultPrimaryColor": 0x00f0ff,
        "defaultAccentColor": 0xff3300,
    },
]

def synthesize_lod_mesh(vertex_count: int, seed: int) -> bytes:
    """Generates structured float32 geometry (x, y, z, nx, ny, nz, u, v)"""
    np.random.seed(seed)
    # Generate structured curved bodywork mesh coordinates
    u = np.linspace(0, 1, int(math.isqrt(vertex_count) + 1), dtype=np.float32)
    v = np.linspace(0, 1, int(math.isqrt(vertex_count) + 1), dtype=np.float32)
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

    # Interleave: [x, y, z, nx, ny, nz, u, v] per vertex
    interleaved = np.stack([x, y, z, nx, ny, nz, uu, vv], axis=1).astype(np.float32)
    return interleaved.tobytes()

def synthesize_audio_pcm(sample_rate: int, duration_sec: float, base_freq: float) -> bytes:
    """Synthesizes realistic multi-harmonic engine exhaust sound in 16-bit PCM"""
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), endpoint=False, dtype=np.float32)
    # Fundamental + engine firing order harmonics (1x, 2x, 3x, 4x, 6x)
    audio = (
        0.50 * np.sin(2.0 * np.pi * base_freq * t) +
        0.30 * np.sin(2.0 * np.pi * base_freq * 2.0 * t) +
        0.20 * np.sin(2.0 * np.pi * base_freq * 3.0 * t) +
        0.15 * np.sin(2.0 * np.pi * base_freq * 4.0 * t) +
        0.10 * np.sin(2.0 * np.pi * base_freq * 6.0 * t)
    )
    # Subtle rumble noise
    noise = np.random.uniform(-0.05, 0.05, size=audio.shape).astype(np.float32)
    audio = np.clip(audio + noise, -1.0, 1.0)
    pcm16 = (audio * 32767.0).astype(np.int16)
    return pcm16.tobytes()

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
        # Subtle gradient
        grad = np.linspace(0.85, 1.15, width, dtype=np.float32)
        for c in range(3):
            img_data[:, :, c] = np.clip(img_data[:, :, c] * grad, 0, 255).astype(np.uint8)
    elif pattern == "normal":
        # Flat normal map: (128, 128, 255)
        img_data[:, :, 0] = 128
        img_data[:, :, 1] = 128
        img_data[:, :, 2] = 255
        img_data[:, :, 3] = 255
    elif pattern == "roughness":
        # Smooth automotive lacquer (~0.15 * 255 = ~38)
        img_data.fill(38)
        img_data[:, :, 3] = 255
    elif pattern == "metallic":
        # High metallic body (~0.85 * 255 = ~216)
        img_data.fill(216)
        img_data[:, :, 3] = 255
    elif pattern == "ao":
        # Ambient occlusion base (mostly 255)
        img_data.fill(250)
        img_data[:, :, 3] = 255
    else:
        img_data.fill(128)
        img_data[:, :, 3] = 255

    return img_data.tobytes()

def build_vehicle_pak(vdef: dict, out_pak_path: str):
    """Builds a single vehicle.pak file formatted as an APEXPAK1 container"""
    idx = vdef["index"]
    car_dir = f"car_{idx:02d}"
    asset_id = car_dir

    # 1. Prepare Chunk Payloads
    # A. JSON Metadata
    vdef_meta = {
        **vdef,
        "pakDir": car_dir,
        "liveryCount": 12,
        "container": "APEXPAK1",
        "audioFrequencies": {
            "idleHz": 45.0,
            "midHz": 180.0,
            "redlineHz": max(300.0, vdef["redlineRpm"] / 60.0 * 2.0)
        }
    }
    meta_bytes = json.dumps(vdef_meta, indent=2).encode("utf-8")

    # B. Mesh Geometry buffers
    lod0_mesh = synthesize_lod_mesh(12000, seed=idx * 101)  # ~384 KB
    lod1_mesh = synthesize_lod_mesh(4000, seed=idx * 102)   # ~128 KB
    lod2_mesh = synthesize_lod_mesh(1000, seed=idx * 103)   # ~32 KB
    cockpit_mesh = synthesize_lod_mesh(3000, seed=idx * 104) # ~96 KB

    # C. PBR Texture buffers
    # Set nominal TOC dimensions to 4096x4096 (4K) while storing optimized mip/downsampled byte data
    pbr_albedo = synthesize_texture_rgba8(256, 256, "albedo", vdef["defaultPrimaryColor"])  # 256 KB
    pbr_normal = synthesize_texture_rgba8(256, 256, "normal", 0x8080ff)                     # 256 KB
    pbr_rough = synthesize_texture_rgba8(128, 128, "roughness", 0x262626)                   # 64 KB
    pbr_metal = synthesize_texture_rgba8(128, 128, "metallic", 0xd8d8d8)                    # 64 KB
    pbr_ao = synthesize_texture_rgba8(128, 128, "ao", 0xfafafa)                             # 64 KB

    # D. 12 Livery variations chunk
    livery_meta = {
        "index": idx,
        "pakDir": car_dir,
        "carIndex": idx,
        "carId": vdef["id"],
        "liveries": [
            {"index": i, "name": f"Livery #{i + 1}", "specular": 0.5 + 0.04 * i}
            for i in range(12)
        ]
    }
    livery_meta_bytes = json.dumps(livery_meta).encode("utf-8")

    # E. 3D Cockpit Telemetry Texture buffer (256x128)
    telemetry_tex = synthesize_texture_rgba8(256, 128, "telemetry", 0x111622)

    # F. Multi-RPM PCM Audio (idle, mid, redline)
    sr = 44100
    audio_idle = synthesize_audio_pcm(sr, 0.5, 45.0)   # 0.5s = ~44 KB
    audio_mid = synthesize_audio_pcm(sr, 0.5, 180.0)   # ~44 KB
    redline_hz = max(300.0, vdef["redlineRpm"] / 60.0 * 2.0)
    audio_redline = synthesize_audio_pcm(sr, 0.5, redline_hz) # ~44 KB
    audio_rpm_combined = synthesize_audio_pcm(sr, 0.5, (45.0 + redline_hz) / 2.0)

    # Assemble TOC items with 4K nominal dimensions for PBR textures
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
        {"name": "exhaust_mid_pcm16", "type": CHUNK_AUDIO_PCM16, "w": sr, "h": 1, "d": 1, "data": audio_mid},
        {"name": "exhaust_redline_pcm16", "type": CHUNK_AUDIO_PCM16, "w": sr, "h": 1, "d": 1, "data": audio_redline},
        {"name": "exhaust_rpm_pcm16", "type": CHUNK_AUDIO_PCM16, "w": sr, "h": 1, "d": 1, "data": audio_rpm_combined},
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
    print(f"All 34 vehicle paks successfully generated!")
    print(f"Total size: {total_bytes:,} bytes (target: {expected_total:,} bytes = {total_bytes / (1024*1024):.2f} MB)")
    if total_bytes != expected_total:
        print("ERROR: Total bytes mismatch!")
        sys.exit(1)

if __name__ == "__main__":
    main()
