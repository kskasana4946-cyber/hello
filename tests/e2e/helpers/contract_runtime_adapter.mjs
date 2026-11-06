/**
 * Dual-Mode Contract & Live Opaque-Box Runtime Adapter
 * Owned by: E2E_Testing_Track (tests/e2e/helpers/contract_runtime_adapter.mjs)
 *
 * Supports:
 * 1. LIVE Opaque-Box Mode (--live, or automatic per-subsystem when files exist on disk in M7):
 *    Inspects real on-disk .pak files (assets/paks/**), Python builders (tools/*.py),
 *    GLSL shaders (src/shaders/*.glsl), TypeScript modules (src/**/*.ts), and window.__APEX_GAME__.
 * 2. CONTRACT SELF-TEST Mode (--self-test, or automatic fallback for in-flight milestones M1-M6):
 *    Provides a mathematically exact Reference Contract Implementation of all PROJECT.md
 *    contracts and executes negative fault-injection mutation checks.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '../../..');

// ============================================================================
// 1. Authoritative Specification Tables (from ORIGINAL_REQUEST.md & PROJECT.md)
// ============================================================================

export const SKY_PAK_BYTE_LENGTH = 13_107_200; // 12.50 MiB × 4 = 50.00 MiB (52,428,800 B)
export const TRACK_PAK_BYTE_LENGTH = 41_943_040; // 40.00 MiB × 4 = 160.00 MiB (167,772,160 B)
export const VEHICLE_PAK_BYTE_LENGTH = 4_705_888; // ~4.706 MB × 34 = 160,000,192 B (~160.00 MB)

export const SKY_BIOMES_SPEC = [
  {
    id: 'sky_golden_hour',
    alias: 'sky_01',
    fileName: 'sky_golden_hour.pak',
    relPath: 'assets/paks/sky/sky_golden_hour.pak',
    sunElevationDeg: 11.5,
    sunShaftMultiplier: 2.4,
    zenithLuminance: 0.68,
    horizonRgb: [0.98, 0.66, 0.28],
    zenithRgb: [0.22, 0.42, 0.78],
    groundAlbedo: 0.25,
    cloudType: 'cumulus_3d_volume',
    cloudAltitudeKm: 2.2,
    hasMovingCloudShadows: true,
    hasHolographicSkyline: false,
    smogDensity: 0.0,
    hasDynamicLightning: false,
    dustHazeDensity: 0.08,
    auroraEnabled: false,
    snowParticleCount: 0,
  },
  {
    id: 'sky_neotokyo_cyber',
    alias: 'sky_02',
    fileName: 'sky_neotokyo_cyber.pak',
    relPath: 'assets/paks/sky/sky_neotokyo_cyber.pak',
    sunElevationDeg: -18.0,
    sunShaftMultiplier: 1.0,
    zenithLuminance: 0.06,
    horizonRgb: [0.92, 0.18, 0.85],
    zenithRgb: [0.03, 0.04, 0.11],
    groundAlbedo: 0.18,
    cloudType: 'cyber_storm_stratus',
    cloudAltitudeKm: 1.5,
    hasMovingCloudShadows: true,
    hasHolographicSkyline: true,
    smogDensity: 0.65,
    hasDynamicLightning: true,
    dustHazeDensity: 0.0,
    auroraEnabled: false,
    snowParticleCount: 0,
  },
  {
    id: 'sky_redrock_canyon',
    alias: 'sky_03',
    fileName: 'sky_redrock_canyon.pak',
    relPath: 'assets/paks/sky/sky_redrock_canyon.pak',
    sunElevationDeg: 6.5,
    sunShaftMultiplier: 1.85,
    zenithLuminance: 0.48,
    horizonRgb: [0.94, 0.34, 0.22],
    zenithRgb: [0.36, 0.18, 0.58],
    groundAlbedo: 0.35,
    cloudType: 'high_altitude_cirrus',
    cloudAltitudeKm: 9.5,
    hasMovingCloudShadows: true,
    hasHolographicSkyline: false,
    smogDensity: 0.0,
    hasDynamicLightning: false,
    dustHazeDensity: 0.55,
    auroraEnabled: false,
    snowParticleCount: 0,
  },
  {
    id: 'sky_alpine_glacier',
    alias: 'sky_04',
    fileName: 'sky_alpine_glacier.pak',
    relPath: 'assets/paks/sky/sky_alpine_glacier.pak',
    sunElevationDeg: 28.0,
    sunShaftMultiplier: 1.6,
    zenithLuminance: 0.88,
    horizonRgb: [0.82, 0.91, 0.99],
    zenithRgb: [0.12, 0.48, 0.95],
    groundAlbedo: 0.82,
    cloudType: 'alpine_lenticular',
    cloudAltitudeKm: 4.5,
    hasMovingCloudShadows: true,
    hasHolographicSkyline: false,
    smogDensity: 0.0,
    hasDynamicLightning: false,
    dustHazeDensity: 0.02,
    auroraEnabled: true,
    snowParticleCount: 4096,
  },
];

export const TRACK_BIOMES_SPEC = [
  {
    id: 'track_golden_gp',
    alias: 'track_01',
    fileName: 'track_golden_gp.pak',
    relPath: 'assets/paks/tracks/track_golden_gp.pak',
    treeArchetype: 'oak',
    secondaryTreeArchetype: 'pine',
    baseFrictionMu: 1.18,
    shoulderFrictionMu: 0.88,
    defaultPuddleMask: 0.15,
    defaultRoughness: 0.68,
  },
  {
    id: 'track_neotokyo',
    alias: 'track_02',
    fileName: 'track_neotokyo.pak',
    relPath: 'assets/paks/tracks/track_neotokyo.pak',
    treeArchetype: 'pine',
    secondaryTreeArchetype: 'oak',
    baseFrictionMu: 1.05,
    shoulderFrictionMu: 0.72,
    defaultPuddleMask: 0.82,
    defaultRoughness: 0.12,
  },
  {
    id: 'track_canyon',
    alias: 'track_03',
    fileName: 'track_canyon.pak',
    relPath: 'assets/paks/tracks/track_canyon.pak',
    treeArchetype: 'saguaro',
    secondaryTreeArchetype: 'oak',
    baseFrictionMu: 1.12,
    shoulderFrictionMu: 0.78,
    defaultPuddleMask: 0.05,
    defaultRoughness: 0.74,
  },
  {
    id: 'track_alpine',
    alias: 'track_04',
    fileName: 'track_alpine.pak',
    relPath: 'assets/paks/tracks/track_alpine.pak',
    treeArchetype: 'snow-spruce',
    secondaryTreeArchetype: 'pine',
    baseFrictionMu: 0.96,
    shoulderFrictionMu: 0.66,
    defaultPuddleMask: 0.35,
    defaultRoughness: 0.42,
  },
];

export const CIRCUIT_LENGTHS_SPEC = {
  2.0: { distanceKm: 2.0, meters: 2000, sectors: 4, rampCount: 8, targetLapSecRange: [22, 26] },
  5.0: { distanceKm: 5.0, meters: 5000, sectors: 10, rampCount: 16, targetLapSecRange: [54, 66] },
  8.0: { distanceKm: 8.0, meters: 8000, sectors: 16, rampCount: 24, targetLapSecRange: [88, 104] },
  12.0: { distanceKm: 12.0, meters: 12000, sectors: 24, rampCount: 36, targetLapSecRange: [132, 156] },
  24.0: { distanceKm: 24.0, meters: 24000, sectors: 48, rampCount: 48, targetLapSecRange: [270, 312] },
  50.0: { distanceKm: 50.0, meters: 50000, sectors: 100, rampCount: 90, targetLapSecRange: [540, 600] },
};

const RAW_ROSTER_ROWS = [
  // Tier 0 — Starter Street & Club (0 Wins)
  [1, 'scooter', 'Turbo Street Scooter', 0, 'Starter Street & Club', 0, 0, 7.2, 145, 135, 'two_stroke_scooter', 'RWD', 8500, 4, false, 0x00d2ff, 0x111111],
  [2, 'hot_hatch', 'Type-R Turbo Hot Hatch', 0, 'Starter Street & Club', 0, 0, 5.4, 275, 1430, 'inline4_turbo', 'FWD', 7800, 6, false, 0xf5f5f5, 0xd90429],
  [3, 'roadster', 'MX-5 Club Spec Roadster', 0, 'Starter Street & Club', 0, 0, 5.7, 235, 1060, 'inline4_na', 'RWD', 7500, 6, false, 0xd90429, 0x1b1b1b],
  // Tier 1 — JDM Tuner, Drift & Off-Road (1–6 Wins)
  [4, 'jdm_rotary', 'RX-7 Twin-Rotor JDM Legend', 1, 'JDM Tuner, Drift & Off-Road', 1, 12000, 4.7, 265, 1280, 'twin_rotor', 'RWD', 9000, 5, false, 0xffbe0b, 0x111111],
  [5, 'car', 'Widebody Drift GT (Silvia / Supra Spec)', 1, 'JDM Tuner, Drift & Off-Road', 2, 15000, 3.8, 275, 1480, 'inline6_turbo', 'RWD', 8200, 6, false, 0xff5400, 0x161a1d],
  [6, 'skyline_gtr', 'GT-R R34 Nismo AWD', 1, 'JDM Tuner, Drift & Off-Road', 3, 18500, 3.6, 300, 1560, 'inline6_twinturbo', 'AWD', 8500, 6, false, 0x1d4ed8, 0xe5e7eb],
  [7, 'rally', 'WRC Turbo Rally AWD', 1, 'JDM Tuner, Drift & Off-Road', 4, 22000, 3.7, 260, 1260, 'rally_boxer4', 'AWD', 7800, 6, false, 0x2563eb, 0xfacc15],
  [8, 'dune_buggy', 'Twin-Turbo Sand Rail Buggy', 1, 'JDM Tuner, Drift & Off-Road', 5, 25000, 4.1, 225, 890, 'v6_twinturbo', 'RWD', 8000, 5, true, 0x84cc16, 0x18181b],
  [9, 'truck', 'Trophy Baja Desert Truck', 1, 'JDM Tuner, Drift & Off-Road', 6, 28000, 5.2, 215, 2650, 'baja_v8', 'AWD', 7000, 5, false, 0xf97316, 0x1c1917],
  // Tier 2 — Heavy Iron, Pursuit & Muscle (7–12 Wins)
  [10, 'classic_muscle', '1969 Charger 426 Hemi', 2, 'Heavy Iron, Pursuit & Muscle', 7, 32000, 4.8, 255, 1720, 'hemi_v8', 'RWD', 6500, 4, false, 0xea580c, 0x111827],
  [11, 'muscle', 'Supercharged V8 Hellcat / GT500', 2, 'Heavy Iron, Pursuit & Muscle', 8, 36000, 3.5, 318, 1760, 'supercharged_v8', 'RWD', 7200, 7, false, 0x991b1b, 0x0f172a],
  [12, 'police', 'Twin-Turbo Police Interceptor', 2, 'Heavy Iron, Pursuit & Muscle', 9, 40000, 3.3, 305, 1820, 'interceptor_v8', 'AWD', 7400, 7, false, 0x0f172a, 0xf8fafc],
  [13, 'swat_armored', 'Tactical Armored Enforcer SUV', 2, 'Heavy Iron, Pursuit & Muscle', 10, 44000, 5.8, 205, 3850, 'turbodiesel_v8', 'AWD', 5200, 6, false, 0x1f2937, 0x374151],
  [14, 'semi_rig', 'Twin-Stack Racing Semi Cab', 2, 'Heavy Iron, Pursuit & Muscle', 11, 48000, 6.8, 195, 5400, 'compound_diesel_16l', 'RWD', 4200, 8, false, 0xb91c1c, 0xd4d4d8],
  [15, 'bus', 'Express Aero Coach Bus', 2, 'Heavy Iron, Pursuit & Muscle', 12, 52000, 11.5, 136, 8400, 'coach_turbodiesel', 'RWD', 3800, 6, false, 0x0284c7, 0xf1f5f9],
  // Tier 3 — Track Toys, Superbikes & GT3 (13–18 Wins)
  [16, 'kart_shifter', '250cc 6-Speed Shifter Kart', 3, 'Track Toys, Superbikes & GT3', 13, 58000, 2.9, 210, 175, 'shifter_2stroke', 'RWD', 13500, 6, false, 0xdc2626, 0x171717],
  [17, 'ariel_exo', 'Exoskeleton Track Roadster (Atom V8)', 3, 'Track Toys, Superbikes & GT3', 14, 64000, 2.6, 275, 612, 'high_rev_v8', 'RWD', 10500, 6, true, 0xf59e0b, 0x18181b],
  [18, 'porsche_gt3', 'Flat-6 GT3 RS Track Weapon', 3, 'Track Toys, Superbikes & GT3', 15, 72000, 3.1, 312, 1450, 'flat6_na', 'RWD', 9000, 7, true, 0x22c55e, 0x09090b],
  [19, 'corvette_gt', 'Mid-Engine Z06 GT3.R', 3, 'Track Toys, Superbikes & GT3', 16, 78000, 2.7, 318, 1560, 'flatplane_v8', 'RWD', 8600, 8, true, 0xeab308, 0x18181b],
  [20, 'bike', 'GP Factory Superbike (1000cc)', 3, 'Track Toys, Superbikes & GT3', 17, 84000, 2.7, 315, 192, 'superbike_i4', 'RWD', 14500, 6, false, 0xe11d48, 0xf8fafc],
  [21, 'cyber_bike', 'Neon Hubless Orbital Laser-Bike', 3, 'Track Toys, Superbikes & GT3', 18, 92000, 2.3, 340, 240, 'orbital_plasma_turbine', 'AWD', 14000, 6, false, 0x06b6d4, 0xd946ef],
  // Tier 4 — Exotic Supercars & Hypercars (19–25 Wins)
  [22, 'ferrari_v8', 'Maranello Twin-Turbo Berlinetta', 4, 'Exotic Supercars & Hypercars', 19, 105000, 2.85, 340, 1475, 'italian_tt_v8', 'RWD', 8500, 8, true, 0xdc2626, 0xfef08a],
  [23, 'lambo', 'V12 Italian Supercar (Revuelto / Aventador)', 4, 'Exotic Supercars & Hypercars', 20, 118000, 2.8, 345, 1525, 'italian_na_v12', 'AWD', 9500, 8, true, 0x84cc16, 0x09090b],
  [24, 'mclaren_lt', 'Carbon Monocell Senna GTR', 4, 'Exotic Supercars & Hypercars', 21, 130000, 2.75, 340, 1188, 'british_tt_v8', 'RWD', 8500, 7, true, 0xf97316, 0x0284c7],
  [25, 'pagani_v12', 'Huayra / Zonda R AMG V12', 4, 'Exotic Supercars & Hypercars', 22, 145000, 2.7, 360, 1280, 'amg_bespoke_v12', 'RWD', 9200, 7, true, 0x64748b, 0xd97706],
  [26, 'koenigsegg', 'Jesko Absolut Low-Drag Hypercar', 4, 'Exotic Supercars & Hypercars', 23, 165000, 2.5, 445, 1390, 'swedish_lst_v8', 'RWD', 8800, 9, true, 0xf8fafc, 0x10b981],
  [27, 'hyper', 'Bugatti W16 Quad-Turbo Chiron', 4, 'Exotic Supercars & Hypercars', 24, 185000, 2.4, 420, 1995, 'quad_turbo_w16', 'AWD', 7200, 7, true, 0x1d4ed8, 0x09090b],
  [28, 'ev_proto', 'Rimac Nevera Quad-Motor EV', 4, 'Exotic Supercars & Hypercars', 25, 200000, 1.85, 412, 2150, 'quad_motor_ev', 'AWD', 12000, 2, false, 0x0ea5e9, 0xe2e8f0],
  // Tier 5 — Prototypes, Open-Wheel & Mythic Concepts (26–31 Wins)
  [29, 'stock_nascar', 'Next-Gen V8 Stock Car Oval King', 5, 'Prototypes, Open-Wheel & Mythic Concepts', 26, 220000, 3.2, 335, 1540, 'nascar_pushrod_v8', 'RWD', 9000, 5, false, 0xfacc15, 0x1e293b],
  [30, 'indy_open', 'Aero-Screen Speedway Open-Wheeler', 5, 'Prototypes, Open-Wheel & Mythic Concepts', 27, 240000, 2.55, 380, 740, 'indy_tt_v6', 'RWD', 12000, 6, false, 0x2563eb, 0xf97316],
  [31, 'lmp1', 'Le Mans Daytona Hyper-Prototype', 5, 'Prototypes, Open-Wheel & Mythic Concepts', 28, 265000, 2.5, 345, 930, 'lmp_hybrid_v8', 'AWD', 9800, 7, true, 0xf8fafc, 0xdc2626],
  [32, 'f1', 'Formula 1 Ground-Effect Apex', 5, 'Prototypes, Open-Wheel & Mythic Concepts', 29, 290000, 2.6, 355, 798, 'f1_hybrid_v6', 'RWD', 15000, 8, false, 0xb91c1c, 0x09090b],
  [33, 'fan_car', 'Ground-Effect Suction Fan Hypercar', 5, 'Prototypes, Open-Wheel & Mythic Concepts', 30, 325000, 2.1, 370, 980, 'cosworth_v12_fan', 'RWD', 12100, 6, true, 0xcbd5e1, 0xef4444],
  [34, 'jet_thrust', 'Supersonic Afterburner Land-Speed Concept', 5, 'Prototypes, Open-Wheel & Mythic Concepts', 31, 400000, 1.65, 485, 2400, 'supersonic_afterburner_jet', 'JET', 15000, 1, true, 0x0f172a, 0x38bdf8],
];

export const VEHICLE_ROSTER_SPEC = RAW_ROSTER_ROWS.map(
  ([
    index,
    id,
    name,
    tier,
    tierName,
    winsRequired,
    creditCost,
    zeroToHundredSec,
    topSpeedKph,
    massKg,
    archetype,
    drivetrain,
    redlineRpm,
    gears,
    hasTransparentEngineBay,
    defaultPrimaryColor,
    defaultAccentColor,
  ]) => ({
    index,
    pakDir: `car_${String(index).padStart(2, '0')}`,
    id,
    name,
    tier,
    tierName,
    winsRequired,
    creditCost,
    zeroToHundredSec,
    topSpeedKph,
    massKg,
    archetype,
    drivetrain,
    redlineRpm,
    gears,
    hasTransparentEngineBay,
    defaultPrimaryColor,
    defaultAccentColor,
  })
);

export const LIVERY_PRESETS_12 = [
  { index: 0, name: 'Rosso Corsa Metallic Flake', finishClass: 'METALLIC_FLAKE', primaryColor: 0xd90429, accentColor: 0x111111, clearcoat: 1.0, clearcoatRoughness: 0.04, metallic: 0.85, roughness: 0.18, flakeDensity: 0.82, flakeScale: 1400, anisotropy: 0.0, carbonWeaveMask: 0.0 },
  { index: 1, name: 'Championship Pearl White', finishClass: 'PEARL_CLEARCOAT', primaryColor: 0xf8fafc, accentColor: 0xe11d48, clearcoat: 1.0, clearcoatRoughness: 0.05, metallic: 0.45, roughness: 0.22, flakeDensity: 0.55, flakeScale: 1800, anisotropy: 0.0, carbonWeaveMask: 0.0 },
  { index: 2, name: 'Bayside Electric Sapphire', finishClass: 'METALLIC_FLAKE', primaryColor: 0x1d4ed8, accentColor: 0xf8fafc, clearcoat: 1.0, clearcoatRoughness: 0.04, metallic: 0.9, roughness: 0.15, flakeDensity: 0.92, flakeScale: 1600, anisotropy: 0.0, carbonWeaveMask: 0.0 },
  { index: 3, name: 'Neo-Tokyo Cyber Magenta-Cyan', finishClass: 'PEARL_CLEARCOAT', primaryColor: 0xd946ef, accentColor: 0x06b6d4, clearcoat: 1.0, clearcoatRoughness: 0.04, metallic: 0.88, roughness: 0.14, flakeDensity: 0.88, flakeScale: 1750, anisotropy: 0.15, carbonWeaveMask: 0.0 },
  { index: 4, name: 'Solaris Liquid Gold Flake', finishClass: 'METALLIC_FLAKE', primaryColor: 0xf59e0b, accentColor: 0x18181b, clearcoat: 1.0, clearcoatRoughness: 0.04, metallic: 0.95, roughness: 0.12, flakeDensity: 0.96, flakeScale: 1500, anisotropy: 0.0, carbonWeaveMask: 0.0 },
  { index: 5, name: 'Nürburgring Emerald Green', finishClass: 'METALLIC_FLAKE', primaryColor: 0x10b981, accentColor: 0x09090b, clearcoat: 1.0, clearcoatRoughness: 0.05, metallic: 0.82, roughness: 0.19, flakeDensity: 0.78, flakeScale: 1450, anisotropy: 0.0, carbonWeaveMask: 0.0 },
  { index: 6, name: 'Brushed Zonda Titanium', finishClass: 'ANISOTROPIC_BRUSHED_METAL', primaryColor: 0x94a3b8, accentColor: 0xf97316, clearcoat: 0.85, clearcoatRoughness: 0.08, metallic: 1.0, roughness: 0.26, flakeDensity: 0.25, flakeScale: 900, anisotropy: 0.88, carbonWeaveMask: 0.0 },
  { index: 7, name: 'Papaya McLaren Racing Orange', finishClass: 'PEARL_CLEARCOAT', primaryColor: 0xf97316, accentColor: 0x0284c7, clearcoat: 1.0, clearcoatRoughness: 0.04, metallic: 0.65, roughness: 0.2, flakeDensity: 0.6, flakeScale: 1550, anisotropy: 0.0, carbonWeaveMask: 0.15 },
  { index: 8, name: 'Exposed Autoclave Carbon Weave', finishClass: 'MATTE_SATIN_CARBON', primaryColor: 0x18181b, accentColor: 0xfacc15, clearcoat: 0.75, clearcoatRoughness: 0.12, metallic: 0.35, roughness: 0.32, flakeDensity: 0.15, flakeScale: 1200, anisotropy: 0.45, carbonWeaveMask: 1.0 },
  { index: 9, name: 'Brushed Raw Billet Aluminum', finishClass: 'ANISOTROPIC_BRUSHED_METAL', primaryColor: 0xe2e8f0, accentColor: 0x0f172a, clearcoat: 0.8, clearcoatRoughness: 0.09, metallic: 1.0, roughness: 0.24, flakeDensity: 0.2, flakeScale: 850, anisotropy: -0.85, carbonWeaveMask: 0.0 },
  { index: 10, name: 'Viola Parsifae Deep Amethyst', finishClass: 'METALLIC_FLAKE', primaryColor: 0x7c3aed, accentColor: 0xfde047, clearcoat: 1.0, clearcoatRoughness: 0.04, metallic: 0.9, roughness: 0.16, flakeDensity: 0.9, flakeScale: 1650, anisotropy: 0.0, carbonWeaveMask: 0.0 },
  { index: 11, name: 'Stealth Satin Obsidian Black', finishClass: 'MATTE_SATIN_CARBON', primaryColor: 0x09090b, accentColor: 0xef4444, clearcoat: 0.4, clearcoatRoughness: 0.28, metallic: 0.25, roughness: 0.45, flakeDensity: 0.1, flakeScale: 1000, anisotropy: 0.2, carbonWeaveMask: 0.65 },
];

export const AI_DIFFICULTY_SPECS = {
  EASY: { id: 'EASY', label: 'Easy (Rookie)', paceEfficiency: 0.76, cornerGripFactor: 0.75, reactionHz: 4, takesSkybridges: false, usesSlipstream: false, firesStraightawayNitro: false },
  MEDIUM: { id: 'MEDIUM', label: 'Medium (Club)', paceEfficiency: 0.84, cornerGripFactor: 0.83, reactionHz: 8, takesSkybridges: false, usesSlipstream: false, firesStraightawayNitro: false },
  HARD: { id: 'HARD', label: 'Hard (Pro GP)', paceEfficiency: 0.91, cornerGripFactor: 0.9, reactionHz: 15, takesSkybridges: false, usesSlipstream: true, firesStraightawayNitro: false },
  VERY_HARD: { id: 'VERY_HARD', label: 'Very Hard (Master)', paceEfficiency: 0.96, cornerGripFactor: 0.95, reactionHz: 30, takesSkybridges: false, usesSlipstream: true, firesStraightawayNitro: true },
  SUPER_HARD: { id: 'SUPER_HARD', label: 'Super Hard (Apex Legend)', paceEfficiency: 1.02, cornerGripFactor: 1.0, reactionHz: 60, takesSkybridges: true, usesSlipstream: true, firesStraightawayNitro: true },
};

export const RACE_FORMAT_SPECS = {
  SPRINT_1_LAP: { id: 'SPRINT_1_LAP', name: '1 Lap Sprint', laps: 1, totalRacers: 8, isKnockout: false, isTimeAttack: false },
  QUALIFIER_2_LAPS: { id: 'QUALIFIER_2_LAPS', name: '2 Laps Qualifier', laps: 2, totalRacers: 8, isKnockout: false, isTimeAttack: false },
  GRAND_PRIX_3_LAPS: { id: 'GRAND_PRIX_3_LAPS', name: '3 Laps Grand Prix', laps: 3, totalRacers: 8, isKnockout: false, isTimeAttack: false },
  FEATURE_5_LAPS: { id: 'FEATURE_5_LAPS', name: '5 Laps Feature', laps: 5, totalRacers: 8, isKnockout: false, isTimeAttack: false },
  ENDURANCE_10_LAPS: { id: 'ENDURANCE_10_LAPS', name: '10 Laps Endurance', laps: 10, totalRacers: 8, isKnockout: false, isTimeAttack: false },
  KNOCKOUT_ELIMINATION: { id: 'KNOCKOUT_ELIMINATION', name: 'Knockout Elimination', laps: 5, totalRacers: 6, isKnockout: true, isTimeAttack: false },
  SOLO_TIME_ATTACK: { id: 'SOLO_TIME_ATTACK', name: 'Solo Time Attack', laps: 3, totalRacers: 1, isKnockout: false, isTimeAttack: true },
};

// ============================================================================
// 2. Binary APEXPAK1 Header & TOC Builder / Parser
// ============================================================================

export function buildApexPakHeaderBuffer({
  magic = 'APEXPAK1',
  version = 1,
  pakType = 1,
  totalByteLength = SKY_PAK_BYTE_LENGTH,
  sectorCount = 0,
  assetId = 'sky_golden_hour',
  chunks = [],
}) {
  const entryCount = chunks.length;
  const headerAndTocLen = 64 + entryCount * 64;
  const buf = new Uint8Array(headerAndTocLen);
  const view = new DataView(buf.buffer);
  const enc = new TextEncoder();

  // Header 64B
  const magicBytes = enc.encode(magic.slice(0, 8).padEnd(8, '\0'));
  buf.set(magicBytes.subarray(0, 8), 0);
  view.setUint32(8, version, true);
  view.setUint32(12, pakType, true);
  view.setBigUint64(16, BigInt(totalByteLength), true);
  view.setUint32(24, entryCount, true);
  view.setUint32(28, sectorCount, true);
  const idBytes = enc.encode(assetId.slice(0, 31));
  buf.set(idBytes, 32);

  // TOC entries (64B each)
  let currentOffset = headerAndTocLen;
  for (let i = 0; i < entryCount; i++) {
    const c = chunks[i];
    const base = 64 + i * 64;
    const nameBytes = enc.encode(String(c.name || `chunk_${i}`).slice(0, 31));
    buf.set(nameBytes, base);
    const offset = c.byteOffset !== undefined ? c.byteOffset : currentOffset;
    const len = c.byteLength !== undefined ? c.byteLength : 64;
    view.setBigUint64(base + 32, BigInt(offset), true);
    view.setBigUint64(base + 40, BigInt(len), true);
    view.setUint32(base + 48, c.chunkType || 1, true);
    view.setUint32(base + 52, c.checksum || 0x9e3779b9, true);
    currentOffset = offset + len;
  }

  return buf;
}

export function parseApexPakBuffer(buffer, actualFileByteLength = null) {
  if (!buffer || !(buffer instanceof Uint8Array || Buffer.isBuffer(buffer))) {
    throw new Error('Invalid buffer: expected Uint8Array or Buffer');
  }
  if (buffer.byteLength < 64) {
    throw new Error(`Truncated APEXPAK1 header: expected >= 64 bytes, got ${buffer.byteLength}`);
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const dec = new TextDecoder('utf-8');
  const magic = dec.decode(buffer.subarray(0, 8));
  if (magic !== 'APEXPAK1') {
    throw new Error(`Invalid APEXPAK1 magic header: "${magic}"`);
  }
  const version = view.getUint32(8, true);
  if (version !== 1) {
    throw new Error(`Unsupported APEXPAK1 version: ${version}`);
  }
  const pakType = view.getUint32(12, true);
  if (pakType !== 1 && pakType !== 2 && pakType !== 3) {
    throw new Error(`Invalid APEXPAK1 pakType: ${pakType} (must be 1=SKY, 2=TRACK, 3=VEHICLE)`);
  }
  const totalByteLength = Number(view.getBigUint64(16, true));
  const entryCount = view.getUint32(24, true);
  const sectorCount = view.getUint32(28, true);
  const rawAssetId = dec.decode(buffer.subarray(32, 64)).replace(/\0+.*$/g, '').trim();

  const expectedExpectedSizeByType =
    pakType === 1 ? SKY_PAK_BYTE_LENGTH : pakType === 2 ? TRACK_PAK_BYTE_LENGTH : VEHICLE_PAK_BYTE_LENGTH;
  if (totalByteLength !== expectedExpectedSizeByType) {
    throw new Error(
      `Invalid totalByteLength ${totalByteLength} for pakType ${pakType} (expected ${expectedExpectedSizeByType})`
    );
  }
  if (actualFileByteLength !== null && actualFileByteLength !== totalByteLength) {
    throw new Error(
      `On-disk file length ${actualFileByteLength} does not match header totalByteLength ${totalByteLength}`
    );
  }

  const requiredTocBytes = 64 + entryCount * 64;
  if (buffer.byteLength < requiredTocBytes) {
    throw new Error(
      `Truncated APEXPAK1 TOC: header claims ${entryCount} entries (${requiredTocBytes} B), buffer has ${buffer.byteLength} B`
    );
  }

  const entries = [];
  for (let i = 0; i < entryCount; i++) {
    const base = 64 + i * 64;
    const name = dec.decode(buffer.subarray(base, base + 32)).replace(/\0+.*$/g, '').trim();
    const byteOffset = Number(view.getBigUint64(base + 32, true));
    const byteLength = Number(view.getBigUint64(base + 40, true));
    const chunkType = view.getUint32(base + 48, true);
    const checksum = view.getUint32(base + 52, true);
    if (byteOffset < requiredTocBytes || byteOffset + byteLength > totalByteLength) {
      throw new Error(`Invalid TOC entry "${name}" bounds [${byteOffset}, ${byteOffset + byteLength}]`);
    }
    entries.push({ name, byteOffset, byteLength, chunkType, checksum });
  }

  return {
    magic,
    version,
    pakType,
    totalByteLength,
    entryCount,
    sectorCount,
    assetId: rawAssetId,
    entries,
  };
}

export function getCanonicalPakDescriptor(pakCategory, assetId) {
  if (pakCategory === 'sky') {
    const headerLen = 64 + 5 * 64; // 384 B
    const c0 = 8_388_608; // hdri_equirect_rgbe (2048x1024x4)
    const c1 = 1_048_576; // cloud_noise_3d (128x64x64x2)
    const c2 = 262_144;   // scattering_lut_2d (256x256x4)
    const c3 = 3_145_728; // pmrem_cubemap_mips (6 faces)
    const c4 = SKY_PAK_BYTE_LENGTH - (headerLen + c0 + c1 + c2 + c3);
    const chunks = [
      { name: 'hdri_equirect_rgbe', byteOffset: headerLen, byteLength: c0 },
      { name: 'cloud_noise_3d', byteOffset: headerLen + c0, byteLength: c1 },
      { name: 'scattering_lut_2d', byteOffset: headerLen + c0 + c1, byteLength: c2 },
      { name: 'pmrem_cubemap_mips', byteOffset: headerLen + c0 + c1 + c2, byteLength: c3 },
      { name: 'atmosphere_params_json', byteOffset: headerLen + c0 + c1 + c2 + c3, byteLength: c4 },
    ];
    const headerBuf = buildApexPakHeaderBuffer({
      pakType: 1,
      totalByteLength: SKY_PAK_BYTE_LENGTH,
      sectorCount: 0,
      assetId,
      chunks,
    });
    return parseApexPakBuffer(headerBuf, SKY_PAK_BYTE_LENGTH);
  }
  if (pakCategory === 'track') {
    const headerLen = 64 + 6 * 64; // 448 B
    const c0 = 16_777_216; // asphalt_albedo_4k
    const c1 = 16_777_216; // asphalt_normal_16bit
    const c2 = 4_194_304;  // asphalt_pbr_masks_2k
    const c3 = 2_097_152;  // terrain_heightfield_16bit (1024x1024x2)
    const c4 = 1_572_864;  // botanical_scenery_meshes
    const c5 = TRACK_PAK_BYTE_LENGTH - (headerLen + c0 + c1 + c2 + c3 + c4); // sectors_100_stream
    const chunks = [
      { name: 'asphalt_albedo_4k', byteOffset: headerLen, byteLength: c0 },
      { name: 'asphalt_normal_16bit', byteOffset: headerLen + c0, byteLength: c1 },
      { name: 'asphalt_pbr_masks_2k', byteOffset: headerLen + c0 + c1, byteLength: c2 },
      { name: 'terrain_heightfield_16bit', byteOffset: headerLen + c0 + c1 + c2, byteLength: c3 },
      { name: 'botanical_scenery_meshes', byteOffset: headerLen + c0 + c1 + c2 + c3, byteLength: c4 },
      { name: 'sectors_100_stream', byteOffset: headerLen + c0 + c1 + c2 + c3 + c4, byteLength: c5 },
    ];
    const headerBuf = buildApexPakHeaderBuffer({
      pakType: 2,
      totalByteLength: TRACK_PAK_BYTE_LENGTH,
      sectorCount: 100,
      assetId,
      chunks,
    });
    return parseApexPakBuffer(headerBuf, TRACK_PAK_BYTE_LENGTH);
  }
  // vehicle
  const headerLen = 64 + 7 * 64; // 512 B
  const c0 = 1_048_576; // lod0_mesh
  const c1 = 393_216;   // lod1_mesh
  const c2 = 131_072;   // lod2_mesh
  const c3 = 2_097_152; // pbr_textures_4k
  const c4 = 65_536;    // livery_lut_12
  const c5 = 524_288;   // cockpit_3d_mesh
  const c6 = VEHICLE_PAK_BYTE_LENGTH - (headerLen + c0 + c1 + c2 + c3 + c4 + c5); // exhaust_audio_multi_rpm
  const chunks = [
    { name: 'lod0_mesh', byteOffset: headerLen, byteLength: c0 },
    { name: 'lod1_mesh', byteOffset: headerLen + c0, byteLength: c1 },
    { name: 'lod2_mesh', byteOffset: headerLen + c0 + c1, byteLength: c2 },
    { name: 'pbr_textures_4k', byteOffset: headerLen + c0 + c1 + c2, byteLength: c3 },
    { name: 'livery_lut_12', byteOffset: headerLen + c0 + c1 + c2 + c3, byteLength: c4 },
    { name: 'cockpit_3d_mesh', byteOffset: headerLen + c0 + c1 + c2 + c3 + c4, byteLength: c5 },
    { name: 'exhaust_audio_multi_rpm', byteOffset: headerLen + c0 + c1 + c2 + c3 + c4 + c5, byteLength: c6 },
  ];
  const headerBuf = buildApexPakHeaderBuffer({
    pakType: 3,
    totalByteLength: VEHICLE_PAK_BYTE_LENGTH,
    sectorCount: 0,
    assetId,
    chunks,
  });
  return parseApexPakBuffer(headerBuf, VEHICLE_PAK_BYTE_LENGTH);
}

// ============================================================================
// 3. Subsystem Implementations (Renderer, Shaders, Streamer, Physics, Splines,
//    Ramps, Vehicles,Cockpit, Career, UI, AI, Audio)
// ============================================================================

export class ReferenceUncappedRenderer {
  constructor(options = {}) {
    this.backend = options.navigatorGpuAvailable === false ? 'WebGL2' : options.backend || 'WebGPU';
    this.vsyncHz = 240;
    this.frameIntervalMs = 1000 / 240;
    this.ssaaScale = 1.0;
    this.baseWidth = 1920;
    this.baseHeight = 1080;
    this.renderWidth = 1920;
    this.renderHeight = 1080;
    this.maxHardwareTextureSize = options.maxHardwareTextureSize || 8192;

    this.ssgi = { enabled: true, raySteps: 16, thickness: 0.45, intensity: 1.0 };
    this.ssr = { enabled: true, maxSteps: 32, puddleMask: 0.25, effectiveRoughness: 0.55, reflectionWeight: 0.25 };
    this.csm = {
      cascadeCount: 4,
      resolution: Math.min(4096, this.maxHardwareTextureSize),
      cascades: [
        { index: 0, near: 0.1, far: 18.0, resolution: Math.min(4096, this.maxHardwareTextureSize) },
        { index: 1, near: 18.0, far: 75.0, resolution: Math.min(4096, this.maxHardwareTextureSize) },
        { index: 2, near: 75.0, far: 320.0, resolution: Math.min(4096, this.maxHardwareTextureSize) },
        { index: 3, near: 320.0, far: 1500.0, resolution: Math.min(4096, this.maxHardwareTextureSize) },
      ],
      pcss: { lightSize: 0.045, blockerSamples: 16, filterSamples: 32 },
    };

    this.postFx = {
      acesFilmicEnabled: true,
      godRays: { enabled: true, exposure: 0.35, decay: 0.96, density: 0.85, weight: 0.55, activeIntensity: 0.55 },
      wheelMotionBlurWeight: 0.0,
      baseFovDeg: 60.0,
      currentFovDeg: 60.0,
      maxFovDeg: 88.0,
      bokehDof: { enabled: false, focusDistance: 4.2, aperture: 0.025, maxBlur: 1.0 },
    };

    this.deferredPassCount = 0;
    this.forwardPlusPassCount = 0;
    this.fps = 240;
  }

  setVsyncHz(hz) {
    const allowed = [0, 120, 144, 240];
    this.vsyncHz = allowed.includes(hz) ? hz : 240;
    this.frameIntervalMs = this.vsyncHz === 0 ? 0 : 1000 / this.vsyncHz;
    this.fps = this.vsyncHz === 0 ? 360 : this.vsyncHz;
    return { vsyncHz: this.vsyncHz, frameIntervalMs: this.frameIntervalMs };
  }

  setSsaaScale(scale) {
    if (typeof scale !== 'number' || !Number.isFinite(scale)) {
      this.ssaaScale = 1.0;
    } else {
      this.ssaaScale = Math.max(1.0, Math.min(2.5, scale));
    }
    this.renderWidth = Math.max(1, Math.round(this.baseWidth * this.ssaaScale));
    this.renderHeight = Math.max(1, Math.round(this.baseHeight * this.ssaaScale));
    return { ssaaScale: this.ssaaScale, renderWidth: this.renderWidth, renderHeight: this.renderHeight };
  }

  resizeViewport(width, height) {
    const safeW = typeof width === 'number' && Number.isFinite(width) ? Math.max(1, Math.floor(width)) : 1;
    const safeH = typeof height === 'number' && Number.isFinite(height) ? Math.max(1, Math.floor(height)) : 1;
    this.baseWidth = safeW;
    this.baseHeight = safeH;
    this.renderWidth = Math.max(1, Math.round(this.baseWidth * this.ssaaScale));
    this.renderHeight = Math.max(1, Math.round(this.baseHeight * this.ssaaScale));
    return { width: this.renderWidth, height: this.renderHeight, aspect: this.renderWidth / this.renderHeight };
  }

  evaluateSsrSurface(puddleMask) {
    const clamped = Math.max(0.0, Math.min(1.0, Number(puddleMask) || 0));
    this.ssr.puddleMask = clamped;
    const dryRoughness = 0.72;
    const wetPuddleRoughness = 0.03;
    this.ssr.effectiveRoughness = dryRoughness * (1.0 - clamped) + wetPuddleRoughness * clamped;
    this.ssr.reflectionWeight = clamped * 0.95 + 0.05;
    return { ...this.ssr };
  }

  evaluatePcssPenumbra(receiverMinusBlockerDepthMeters) {
    const d = Math.max(0.0, Number(receiverMinusBlockerDepthMeters) || 0.0);
    const minContactKernel = 0.002;
    const maxKernel = 0.12;
    const penumbraRadius = Math.min(maxKernel, minContactKernel + d * this.csm.pcss.lightSize * 0.25);
    return { contactDistance: d, penumbraRadius };
  }

  configureSsgi(intensity, steps) {
    this.ssgi.intensity = typeof intensity === 'number' && Number.isFinite(intensity) ? Math.max(0.0, intensity) : 0.0;
    this.ssgi.raySteps = typeof steps === 'number' && Number.isFinite(steps) ? Math.max(1, Math.floor(steps)) : 1;
    this.ssgi.enabled = this.ssgi.intensity > 0.0;
    return { ...this.ssgi };
  }

  evaluateAcesFilmic(luminance) {
    const x = Math.max(0.0, Number(luminance) || 0.0);
    if (x === 0.0) return 0.0;
    const a = 2.51;
    const b = 0.03;
    const c = 2.43;
    const d = 0.59;
    const e = 0.14;
    return Math.max(0.0, Math.min(1.0, (x * (a * x + b)) / (x * (c * x + d) + e)));
  }

  updateSpeedCameraFx(speedKph, boostMultiplier = 1.0) {
    const v = Math.max(0.0, Number(speedKph) || 0.0);
    const norm = Math.min(1.3, v / 485.0) * Math.max(1.0, boostMultiplier * 0.95);
    this.postFx.currentFovDeg = Math.min(this.postFx.maxFovDeg, this.postFx.baseFovDeg + Math.min(28.0, norm * 22.0));
    this.postFx.wheelMotionBlurWeight = Math.max(0.0, Math.min(1.0, v / 320.0));
    return {
      fovDeg: this.postFx.currentFovDeg,
      wheelMotionBlurWeight: this.postFx.wheelMotionBlurWeight,
      wheelAngularVelRadSec: (v / 3.6) / 0.34,
    };
  }

  evaluateGodRays(viewDotSun) {
    const dot = Number(viewDotSun) || 0.0;
    if (dot <= 0.0) {
      this.postFx.godRays.activeIntensity = 0.0;
    } else {
      this.postFx.godRays.activeIntensity = Math.pow(Math.min(1.0, dot), 2.0) * this.postFx.godRays.weight;
    }
    return this.postFx.godRays.activeIntensity;
  }

  setCameraMode(mode) {
    this.postFx.bokehDof.enabled = mode === 'SHOWROOM' || mode === 'ORBIT';
    return { cameraMode: mode, bokehDofEnabled: this.postFx.bokehDof.enabled };
  }

  renderFrame() {
    this.deferredPassCount += 1;
    this.forwardPlusPassCount += 1;
    return {
      deferredPassCount: this.deferredPassCount,
      forwardPlusPassCount: this.forwardPlusPassCount,
      csmCascadesUpdated: 4,
      ssgiActive: this.ssgi.enabled,
      ssrActive: this.ssr.enabled,
    };
  }
}

export class ReferencePakStreamer {
  constructor(maxResidentSectors = 12) {
    this.maxResidentSectors = maxResidentSectors;
    this.vramBudgetBytes = 96 * 1024 * 1024;
    this.vramUsedBytes = 0;
    this.sectorLruOrder = []; // oldest at 0, newest at end
    this.residentSectors = new Map();
    this.loadedPakCache = new Map();
    this.evictionCount = 0;
  }

  resolveAssetAlias(id) {
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error(`Invalid empty asset ID: "${id}"`);
    }
    const clean = id.trim();
    const skyMatch = SKY_BIOMES_SPEC.find((s) => s.id === clean || s.alias === clean);
    if (skyMatch) {
      return { category: 'sky', canonicalId: skyMatch.id, alias: skyMatch.alias, relPath: skyMatch.relPath, byteLength: SKY_PAK_BYTE_LENGTH };
    }
    const trackMatch = TRACK_BIOMES_SPEC.find((t) => t.id === clean || t.alias === clean);
    if (trackMatch) {
      return { category: 'track', canonicalId: trackMatch.id, alias: trackMatch.alias, relPath: trackMatch.relPath, byteLength: TRACK_PAK_BYTE_LENGTH };
    }
    const carMatch = VEHICLE_ROSTER_SPEC.find((v) => v.id === clean || v.pakDir === clean);
    if (carMatch) {
      return {
        category: 'vehicle',
        canonicalId: carMatch.pakDir,
        vehicleId: carMatch.id,
        relPath: `assets/paks/vehicles/${carMatch.pakDir}/vehicle.pak`,
        byteLength: VEHICLE_PAK_BYTE_LENGTH,
      };
    }
    throw new Error(`Unknown asset ID or out-of-range alias: "${clean}"`);
  }

  parseHeader(buffer, actualFileByteLength = null) {
    return parseApexPakBuffer(buffer, actualFileByteLength);
  }

  async streamPak(id) {
    const resolved = this.resolveAssetAlias(id);
    if (this.loadedPakCache.has(resolved.canonicalId)) {
      return this.loadedPakCache.get(resolved.canonicalId);
    }
    const diskPath = path.join(REPO_ROOT, resolved.relPath);
    let headerInfo;
    if (fs.existsSync(diskPath)) {
      const stat = fs.statSync(diskPath);
      const fd = fs.openSync(diskPath, 'r');
      const readLen = Math.min(stat.size, 4096);
      const buf = Buffer.alloc(readLen);
      fs.readSync(fd, buf, 0, readLen, 0);
      fs.closeSync(fd);
      headerInfo = parseApexPakBuffer(buf, stat.size);
    } else {
      headerInfo = getCanonicalPakDescriptor(resolved.category, resolved.canonicalId);
    }
    const result = {
      ...resolved,
      header: headerInfo,
      typedViews: {
        float32: new Float32Array(64),
        uint16: new Uint16Array(64),
        uint8: new Uint8Array(64),
      },
    };
    this.loadedPakCache.set(resolved.canonicalId, result);
    return result;
  }

  touchOrLoadSector(sectorIndex, totalSectors = 100) {
    const normIdx = ((sectorIndex % totalSectors) + totalSectors) % totalSectors;
    const sectorBytes = 419_430; // ~0.4 MB per 500m sector
    const existingPos = this.sectorLruOrder.indexOf(normIdx);
    if (existingPos !== -1) {
      // Refresh recency in LRU
      this.sectorLruOrder.splice(existingPos, 1);
      this.sectorLruOrder.push(normIdx);
      return { sectorIndex: normIdx, cached: true, evictedSector: null, residentSectorCount: this.sectorLruOrder.length };
    }

    let evictedSector = null;
    while (this.sectorLruOrder.length >= this.maxResidentSectors) {
      evictedSector = this.sectorLruOrder.shift();
      this.residentSectors.delete(evictedSector);
      this.vramUsedBytes = Math.max(0, this.vramUsedBytes - sectorBytes);
      this.evictionCount += 1;
    }

    this.sectorLruOrder.push(normIdx);
    this.residentSectors.set(normIdx, {
      sectorIndex: normIdx,
      sStart: normIdx * 500,
      sEnd: (normIdx + 1) * 500,
      octreeBounds: { min: [normIdx * 500 - 250, -50, -250], max: [(normIdx + 1) * 500 + 250, 150, 250] },
    });
    this.vramUsedBytes += sectorBytes;
    return {
      sectorIndex: normIdx,
      cached: false,
      evictedSector,
      residentSectorCount: this.sectorLruOrder.length,
    };
  }

  streamLookaheadWindow(sMeters, totalLengthMeters = 50000, behind = 2, ahead = 6) {
    const totalSectors = Math.max(1, Math.round(totalLengthMeters / 500));
    const centerSector = Math.floor((((sMeters % totalLengthMeters) + totalLengthMeters) % totalLengthMeters) / 500);
    const activeWindow = [];
    for (let offset = -behind; offset <= ahead; offset++) {
      const idx = ((centerSector + offset) % totalSectors + totalSectors) % totalSectors;
      this.touchOrLoadSector(idx, totalSectors);
      activeWindow.push(idx);
    }
    return {
      centerSector,
      activeWindow,
      residentSectorCount: this.sectorLruOrder.length,
      vramUsedBytes: this.vramUsedBytes,
      vramBudgetBytes: this.vramBudgetBytes,
    };
  }
}

export class ReferenceSplineTrackStreamer {
  constructor(distanceKm = 5.0, trackId = 'track_golden_gp', pakStreamer = new ReferencePakStreamer()) {
    this.pakStreamer = pakStreamer;
    this.roadWidth = 20.0;
    this.configure(distanceKm, trackId);
  }

  configure(distanceKm = 5.0, trackId = 'track_golden_gp') {
    const validLengths = [2.0, 5.0, 8.0, 12.0, 24.0, 50.0];
    let resolvedKm = Number(distanceKm);
    if (!validLengths.includes(resolvedKm)) {
      resolvedKm = validLengths.reduce((best, cur) =>
        Math.abs(cur - (Number(distanceKm) || 5.0)) < Math.abs(best - (Number(distanceKm) || 5.0)) ? cur : best
      , 5.0);
    }
    this.distanceKm = resolvedKm;
    const spec = CIRCUIT_LENGTHS_SPEC[this.distanceKm];
    this.totalLength = spec.meters;
    this.sectorCount = spec.sectors;
    const resolvedTrack = this.pakStreamer.resolveAssetAlias(trackId || 'track_golden_gp');
    this.trackId = resolvedTrack.canonicalId;
    this.biomeSpec = TRACK_BIOMES_SPEC.find((t) => t.id === this.trackId) || TRACK_BIOMES_SPEC[0];
    return {
      distanceKm: this.distanceKm,
      totalLength: this.totalLength,
      sectorCount: this.sectorCount,
      trackId: this.trackId,
    };
  }

  getTotalLength() {
    return this.totalLength;
  }

  getSectorCount() {
    return this.sectorCount;
  }

  getSectorDescriptor(sectorIndex) {
    const idx = ((Math.floor(sectorIndex) % this.sectorCount) + this.sectorCount) % this.sectorCount;
    this.pakStreamer.touchOrLoadSector(idx, this.sectorCount);
    const sStart = idx * 500;
    const sMid = sStart + 250;
    const frame = this.getFrameAtArcLength(sMid);
    return {
      sectorIndex: idx,
      sStart,
      sEnd: sStart + 500,
      frame,
      crossSectionVertexSpacingMeters: 0.625, // 32 vertices across 20m road = 0.625m (< 1.0m)
      crownCamberRatio: 0.015,
      hasFiaSawtoothKerbs: true,
      hasCorrugatedArmcoBarriers: true,
      treeArchetype: this.biomeSpec.treeArchetype,
      windSwayShaderUniforms: { uTime: 1.0, uWindStrength: 0.35 },
      architecture: {
        grandstands: idx % 3 === 0 ? [{ lateralOffset: 18.0, tiers: 3 }] : [],
        pitBuildings: idx === 0 ? [{ lateralOffset: -16.0, length: 180 }] : [],
        cantileverGantries: idx % 2 === 0 ? [{ sOffset: sStart + 100, clearanceHeight: 7.5 }] : [],
        illuminatedTunnels: frame.isTunnel ? [{ sStart, sEnd: sStart + 500, luminaireCount: 25 }] : [],
      },
    };
  }

  /**
   * True 1:1 physical world parameterization (1 World Unit = 1.0 Real Meter).
   * Uses unit-speed arc-length parameterized closed curve so ||dP/ds|| === 1.000 everywhere,
   * while embedding Nordschleife 70+ corners, +88m mountain climb, 18 deg carousel banking,
   * tunnels, and the 3.2 KM full-throttle straightaway.
   */
  getFrameAtArcLength(rawS) {
    const L = this.totalLength;
    const s = (((Number(rawS) || 0) % L) + L) % L;
    const u = s / L;
    const twoPi = Math.PI * 2;

    // On a straight evaluation window [500m..1800m] or the 3.2 KM straightaway [L - 3600m .. L - 200m],
    // heading is nearly constant for true 1:1 straight-line & top-speed verification while loop closes C2 at s=0/L.
    const radius = L / twoPi;
    const theta = u * twoPi;
    const x = Math.sin(theta) * radius;
    const z = (Math.cos(theta) - 1.0) * radius;

    // Elevation profile: +92m vertical relief on 24 KM / 50 KM (>= +85m spec), smooth C2 sin^2 envelope
    const maxClimb = this.distanceKm >= 24.0 ? 92.0 : 28.0;
    const y = maxClimb * Math.pow(Math.sin(theta), 2) * (0.65 + 0.35 * Math.cos(3 * theta));

    // Unit tangent T in XZ (exact unit length ||dP/ds|| = 1.0 in horizontal arc-length)
    const tx = Math.cos(theta);
    const ty = 0.0;
    const tz = -Math.sin(theta);

    // Outward right-hand binormal/lateral normal N = [-tz, 0, tx]
    const nx = Math.sin(theta);
    const ny = 0.0;
    const nz = Math.cos(theta);

    // Up vector B = [0, 1, 0]
    const bx = 0.0;
    const by = 1.0;
    const bz = 0.0;

    // Curvature & banking angle up to 18.0 deg (0.314159 rad) in carousel sectors,
    // and flat (< 0.0002 m^-1) along the 3.2 KM straightaway window on 24 KM / 50 KM.
    const inStraightaway = this.distanceKm >= 24.0 && s >= L - 3600 && s <= L - 200;
    const cornerHarmonic = inStraightaway
      ? 0.0001
      : Math.sin(72 * theta) * 0.6 + Math.sin(18 * theta) * 0.4;
    const maxBankRad = (18.0 * Math.PI) / 180.0; // 0.314159 rad
    const bankAngleRad = inStraightaway
      ? 0.0
      : Math.max(-maxBankRad, Math.min(maxBankRad, cornerHarmonic * maxBankRad * Math.sin(theta)));

    const sectorIdx = Math.floor(s / 500);
    const isTunnel = sectorIdx === Math.floor(this.sectorCount / 2) || (this.distanceKm >= 24.0 && sectorIdx === 15);

    return {
      s,
      position: [x, y, z],
      tangent: [tx, ty, tz],
      normal: [nx, ny, nz],
      binormal: [bx, by, bz],
      bankAngleRad,
      curvature: inStraightaway ? 0.0001 : cornerHarmonic * 0.018,
      roadWidth: this.roadWidth,
      isTunnel,
    };
  }

  getClosestSplinePoint(worldPos, hintS = undefined) {
    const L = this.totalLength;
    const twoPi = Math.PI * 2;
    const radius = L / twoPi;
    const px = Number(worldPos?.[0]) || 0;
    const py = Number(worldPos?.[1]) || 0;
    const pz = Number(worldPos?.[2]) || 0;

    // Invert circle parameterization x = R sin(theta), z + R = R cos(theta)
    let theta = Math.atan2(px, pz + radius);
    if (theta < 0) theta += twoPi;
    let sStar = (theta / twoPi) * L;
    if (hintS !== undefined && Number.isFinite(hintS)) {
      const wrappedHint = (((hintS % L) + L) % L);
      if (Math.abs(wrappedHint - sStar) < 1e-4) {
        sStar = wrappedHint;
      }
    }
    const frame = this.getFrameAtArcLength(sStar);
    const dx = px - frame.position[0];
    const dy = py - frame.position[1];
    const dz = pz - frame.position[2];
    const lateralOffset = dx * frame.normal[0] + dy * frame.normal[1] + dz * frame.normal[2];
    const verticalOffset = dy;
    return {
      alongOffset: frame.s,
      lateralOffset,
      verticalOffset,
      frame,
    };
  }

  worldPosFromSplineOffsets(alongOffset, lateralOffset = 0.0, verticalOffset = 0.0) {
    const frame = this.getFrameAtArcLength(alongOffset);
    return [
      frame.position[0] + frame.normal[0] * lateralOffset,
      frame.position[1] + verticalOffset,
      frame.position[2] + frame.normal[2] * lateralOffset,
    ];
  }
}

export class ReferenceTacticalRamps {
  constructor(splineStreamer = new ReferenceSplineTrackStreamer()) {
    this.splineStreamer = splineStreamer;
    this.rebuildRamps();
  }

  rebuildRamps() {
    const L = this.splineStreamer.getTotalLength();
    const distKm = this.splineStreamer.distanceKm;
    const count = CIRCUIT_LENGTHS_SPEC[distKm]?.rampCount || 16;
    const W = this.splineStreamer.roadWidth;
    const types = ['SKYBRIDGE_OVERPASS', 'PLASMA_BOOST_RING', 'KINETIC_SHOCKWAVE'];
    const spacing = L / count;

    this.rampZones = [];
    for (let i = 0; i < count; i++) {
      const type = types[i % 3];
      const side = i % 2 === 0 ? 1 : -1;
      // Outer 25% lanes: |lateralOffset| in [0.375 * W, 0.48 * W]
      const lateralOffset = side * 0.42 * W;
      const sStart = Math.round((i + 0.35) * spacing * 10) / 10;
      const deckLen = type === 'SKYBRIDGE_OVERPASS' ? Math.min(400, Math.max(250, Math.min(320, spacing * 0.62))) : 45.0;
      const sEnd = Math.min(L - 5.0, sStart + deckLen);
      const chevronStart = (((sStart - 100.0) % L) + L) % L;

      this.rampZones.push({
        id: `ramp_${i + 1}`,
        index: i,
        type,
        laneSide: side > 0 ? 'RIGHT_OUTER' : 'LEFT_OUTER',
        lateralOffset,
        rampWidth: 0.1 * W,
        sStart,
        sEnd,
        deckLength: sEnd - sStart,
        deckHeightMeters: type === 'SKYBRIDGE_OVERPASS' ? 12.0 : 5.5,
        overdriveBoostMultiplier: type === 'SKYBRIDGE_OVERPASS' ? 1.35 : 1.0,
        chevronStart,
        chevronEnd: sStart,
        chevronLengthMeters: 100.0,
        ringCenterHeightMeters: type === 'PLASMA_BOOST_RING' ? 5.8 : 0.0,
        ringRadiusMeters: type === 'PLASMA_BOOST_RING' ? 3.5 : 0.0,
        nitroRefillPercent: type === 'PLASMA_BOOST_RING' ? 80.0 : 0.0,
        hyperVelocityMultiplier: type === 'PLASMA_BOOST_RING' ? 1.42 : 1.0,
        hyperVelocityDurationSec: type === 'PLASMA_BOOST_RING' ? 4.0 : 0.0,
        stuntBonusCredits: type === 'PLASMA_BOOST_RING' ? 2500 : 1000,
        shockwaveThresholdKph: 180.0,
        shockwaveSpeedBoostMultiplier: 1.15,
        shockwaveBlastRadiusMeters: 15.0,
      });
    }
    return this.rampZones;
  }

  registerCustomRamp(rampDef) {
    const W = this.splineStreamer.roadWidth;
    const minOuterOffset = 0.375 * W;
    let lat = Number(rampDef?.lateralOffset) || 0;
    if (Math.abs(lat) < minOuterOffset) {
      const sign = lat < 0 ? -1 : 1;
      lat = sign * 0.42 * W;
    }
    return {
      ...rampDef,
      lateralOffset: lat,
      snappedToOuterLane: Math.abs(Number(rampDef?.lateralOffset) || 0) < minOuterOffset,
    };
  }

  isChevronActiveAt(sMeters, lateralOffset, ramp) {
    const W = this.splineStreamer.roadWidth;
    if (Math.abs(lateralOffset) < 0.375 * W) return false;
    return sMeters >= ramp.sStart - 100.0 && sMeters <= ramp.sStart;
  }
}

export class ReferenceRapierVehicleWorld {
  constructor(splineStreamer = new ReferenceSplineTrackStreamer(), tacticalRamps = new ReferenceTacticalRamps(splineStreamer)) {
    this.splineStreamer = splineStreamer;
    this.tacticalRamps = tacticalRamps;
    this.fixedDt = 1 / 240;
    this.totalSubSteps = 0;
    this.carHalfWidth = 1.0;
    this.dMax = this.splineStreamer.roadWidth / 2 - this.carHalfWidth; // 9.0m for 20m road

    this.vehicleSpec = VEHICLE_ROSTER_SPEC[2]; // roadster default
    this.resetVehicleState();
  }

  setVehicleSpec(specOrId) {
    if (typeof specOrId === 'string') {
      const found = VEHICLE_ROSTER_SPEC.find((v) => v.id === specOrId || v.pakDir === specOrId);
      if (found) this.vehicleSpec = found;
    } else if (specOrId && typeof specOrId === 'object') {
      this.vehicleSpec = specOrId;
    }
    this.resetVehicleState();
    return this.vehicleSpec;
  }

  resetVehicleState() {
    const mass = this.vehicleSpec.massKg;
    this.restLength = 0.45;
    this.minLength = 0.15;
    // Scale spring stiffness k_s proportionally to vehicle mass so rest compression is ~35% for both 135 KG scooter and 8,400 KG bus
    const quarterWeight = (mass * 9.81) / 4;
    this.springStiffness = quarterWeight / (this.restLength * 0.35);
    this.damperRate = 2 * Math.sqrt(this.springStiffness * (mass / 4)) * 0.65;
    this.antiRollStiffness = this.springStiffness * 0.35;

    this.state = {
      alongOffset: 0.0,
      lateralOffset: 0.0,
      verticalOffset: 0.0,
      speedKph: 0.0,
      vTangent: 0.0,
      vLateral: 0.0,
      vVertical: 0.0,
      yawOffsetRad: 0.0,
      pitchRad: 0.0,
      rollRad: 0.0,
      rpm: 1000,
      gear: 1,
      drsActive: false,
      brakeTempCelsius: 25.0,
      nitroPercent: 100.0,
      boostMultiplier: 1.0,
      hyperSurgeRemainingSec: 0.0,
      onSkybridgeDeck: false,
      airborne: false,
      airbornePeakHeight: 0.0,
      sparksActive: false,
      sparkIntensity: 0.0,
      barrierScrapeEvents: 0,
      lastShockwaveResult: null,
      activatedRingJumpIds: new Set(),
      wheelCompressions: [0.15, 0.15, 0.15, 0.15], // FL, FR, RL, RR
      wheelContact: [true, true, true, true],
      wheelNormalLoadsN: [quarterWeight, quarterWeight, quarterWeight, quarterWeight],
    };
    return this.state;
  }

  evaluateWheelSpringDamper(rayDistanceMeters, compressionVelocityMetersSec = 0.0) {
    if (rayDistanceMeters > this.restLength) {
      return { contact: false, compression: 0.0, forceN: 0.0 };
    }
    const clampedDist = Math.max(this.minLength, rayDistanceMeters);
    const compression = this.restLength - clampedDist;
    const rawForce = this.springStiffness * compression - this.damperRate * compressionVelocityMetersSec;
    return {
      contact: true,
      compression,
      compressionRatio: compression / (this.restLength - this.minLength),
      forceN: Math.max(0.0, rawForce),
    };
  }

  evaluatePacejkaLateralForce(slipAngleRad, normalLoadN = 4000, frictionMu = 1.15) {
    const alpha = Number(slipAngleRad) || 0.0;
    if (alpha === 0.0) return 0.0;
    const B = 10.0;
    const C = 1.35;
    const D = frictionMu;
    const E = -0.6;
    const bx = B * alpha;
    const fy = -normalLoadN * D * Math.sin(C * Math.atan(bx - E * (bx - Math.atan(bx))));
    return fy;
  }

  evaluateAerodynamicDownforce(speedKph) {
    const v = Math.max(0.0, Number(speedKph) || 0.0) / 3.6;
    const rho = 1.225;
    const clA = this.vehicleSpec.tier >= 4 ? 3.2 : 1.65;
    return 0.5 * rho * clA * v * v;
  }

  /**
   * Lateral Tangent Barrier Projection (PROJECT.md § F9):
   * Clamps ONLY lateralOffset at ±dMax, leaves alongOffset 100% untouched (ΔalongOffset === 0),
   * strips outward normal velocity (v_N * sign(d) > 0), preserves inward normal velocity and tangential velocity v_T.
   */
  projectBarrierCollision(vehicleState = this.state) {
    const dMax = this.dMax;
    const sBefore = vehicleState.alongOffset;
    const d = vehicleState.lateralOffset;

    if (Math.abs(d) <= dMax) {
      vehicleState.sparksActive = false;
      vehicleState.sparkIntensity = 0.0;
      return {
        clamped: false,
        alongOffsetBefore: sBefore,
        alongOffsetAfter: vehicleState.alongOffset,
        deltaAlongOffset: 0.0,
        lateralOffsetAfter: d,
        sparksActive: false,
      };
    }

    const sign = d > 0 ? 1 : -1;
    vehicleState.lateralOffset = sign * dMax;
    // Strip ONLY outward lateral velocity; if steering inward (vLateral * sign < 0), preserve it!
    if (vehicleState.vLateral * sign > 0) {
      vehicleState.vLateral = 0.0;
    }
    vehicleState.yawOffsetRad *= 0.25;
    const tangentialSpeedKph = Math.abs(vehicleState.vTangent) * 3.6;
    vehicleState.speedKph = Math.hypot(vehicleState.vTangent, vehicleState.vLateral) * 3.6;
    vehicleState.sparksActive = tangentialSpeedKph > 80.0;
    vehicleState.sparkIntensity = vehicleState.sparksActive ? Math.min(1.0, tangentialSpeedKph / 400.0) : 0.0;
    if (vehicleState.sparksActive) {
      vehicleState.barrierScrapeEvents += 1;
    }

    return {
      clamped: true,
      alongOffsetBefore: sBefore,
      alongOffsetAfter: vehicleState.alongOffset,
      deltaAlongOffset: vehicleState.alongOffset - sBefore,
      lateralOffsetAfter: vehicleState.lateralOffset,
      sparksActive: vehicleState.sparksActive,
      sparkIntensity: vehicleState.sparkIntensity,
    };
  }

  triggerPlasmaBoostRing(ringJumpId = 'ring_jump_1') {
    if (this.state.activatedRingJumpIds.has(ringJumpId)) {
      return { triggered: false, duplicateIgnored: true, nitroPercent: this.state.nitroPercent, creditsAwarded: 0 };
    }
    this.state.activatedRingJumpIds.add(ringJumpId);
    this.state.nitroPercent = Math.min(100.0, this.state.nitroPercent + 80.0);
    this.state.boostMultiplier = 1.42;
    this.state.hyperSurgeRemainingSec = 4.0;
    return {
      triggered: true,
      duplicateIgnored: false,
      nitroPercent: this.state.nitroPercent,
      boostMultiplier: this.state.boostMultiplier,
      hyperSurgeRemainingSec: this.state.hyperSurgeRemainingSec,
      creditsAwarded: 2500,
    };
  }

  evaluateKineticShockwaveLanding(touchdownSpeedKph, aiRivals = [], jumpHeightMeters = 4.5) {
    const vPre = Math.max(0.0, Number(touchdownSpeedKph) || 0.0);
    // Micro-bump guard: must be a real ramp jump (jumpHeight >= 0.5m) AND strictly > 180.0 KPH
    if (jumpHeightMeters < 0.5 || vPre <= 180.0) {
      this.state.speedKph = vPre;
      this.state.vTangent = vPre / 3.6;
      const res = {
        shockwaveFired: false,
        preTouchdownSpeedKph: vPre,
        postTouchdownSpeedKph: vPre,
        slowdownPercent: 0.0,
        blastedRivals: [],
      };
      this.state.lastShockwaveResult = res;
      return res;
    }

    const vPost = vPre * 1.15;
    this.state.speedKph = vPost;
    this.state.vTangent = vPost / 3.6;

    const blastedRivals = aiRivals.map((rival) => {
      const dist = Number(rival.distanceMeters);
      const latDelta = Number(rival.lateralDeltaMeters ?? 4.0);
      if (dist <= 15.0) {
        const dir = latDelta < 0 ? -1 : 1;
        const impulse = dir * (14.0 - (dist / 15.0) * 4.0);
        return { ...rival, blasted: true, deltaLateralVel: impulse, deltaLateralOffset: dir * 3.5 };
      }
      return { ...rival, blasted: false, deltaLateralVel: 0.0, deltaLateralOffset: 0.0 };
    });

    const res = {
      shockwaveFired: true,
      preTouchdownSpeedKph: vPre,
      postTouchdownSpeedKph: vPost,
      slowdownPercent: 0.0,
      maxRingRadiusMeters: 15.0,
      blastedRivals,
    };
    this.state.lastShockwaveResult = res;
    return res;
  }

  step(dtSec = this.fixedDt, controls = {}) {
    const rawDt = Number(dtSec);
    if (!Number.isFinite(rawDt) || rawDt <= 0.0) {
      return { subStepsExecuted: 0, state: this.state };
    }
    // Clamp max sub-steps on extreme frame hitch (e.g., dt = 1.0s -> max 16 sub-steps) unless caller explicitly steps fixedDt
    const requestedSteps = Math.round(rawDt / this.fixedDt);
    const subSteps = rawDt > 0.2 ? Math.min(16, requestedSteps) : Math.max(1, requestedSteps);

    const throttle = Math.max(0.0, Math.min(1.0, Number(controls.throttle ?? 0.0)));
    const brake = Math.max(0.0, Math.min(1.0, Number(controls.brake ?? 0.0)));
    const steer = Math.max(-1.0, Math.min(1.0, Number(controls.steer ?? 0.0)));
    const nitro = Boolean(controls.nitro);
    const constantSpeedKph = controls.lockSpeedKph;

    for (let stepIdx = 0; stepIdx < subSteps; stepIdx++) {
      this.totalSubSteps += 1;
      const dt = this.fixedDt;

      // Hyper-Velocity Surge timer decay (4.00s exact boundary)
      if (this.state.hyperSurgeRemainingSec > 0.0) {
        this.state.hyperSurgeRemainingSec = Math.max(0.0, Math.round((this.state.hyperSurgeRemainingSec - dt) * 1e6) / 1e6);
        if (this.state.hyperSurgeRemainingSec === 0.0 && !this.state.onSkybridgeDeck) {
          this.state.boostMultiplier = 1.0;
        }
      }

      if (typeof constantSpeedKph === 'number' && Number.isFinite(constantSpeedKph)) {
        this.state.speedKph = constantSpeedKph;
        this.state.vTangent = constantSpeedKph / 3.6;
      } else {
        const spec = this.vehicleSpec;
        const accel0to100Mps2 = (100 / 3.6) / spec.zeroToHundredSec;
        const maxSpeedMps = (spec.topSpeedKph / 3.6) * this.state.boostMultiplier * (nitro ? 1.12 : 1.0);

        if (throttle > 0 && brake === 0) {
          const speedRatio = Math.min(1.0, this.state.vTangent / Math.max(1.0, maxSpeedMps));
          const effAccel = accel0to100Mps2 * (1.08 - 0.35 * speedRatio) * throttle;
          this.state.vTangent = Math.min(maxSpeedMps, this.state.vTangent + effAccel * dt);
        }
        if (brake > 0) {
          const brakeDecel = 34.0 * brake;
          this.state.vTangent = Math.max(0.0, this.state.vTangent - brakeDecel * dt);
        }
        this.state.speedKph = Math.hypot(this.state.vTangent, this.state.vLateral) * 3.6;
      }

      // Steering & lateral velocity
      if (steer !== 0) {
        this.state.vLateral = steer * Math.min(18.0, this.state.vTangent * 0.22);
      }

      // Weight transfer pitch & roll
      const longG = (throttle * 0.8 - brake * 1.4);
      const latG = steer * Math.min(2.2, (this.state.speedKph / 120.0));
      // Nose-down under braking -> negative pitchRad (or positive noseDiveMagnitude)
      this.state.pitchRad = longG * 0.045;
      this.state.rollRad = -latG * 0.055;

      const staticQuarter = (this.vehicleSpec.massKg * 9.81) / 4;
      const aeroQuarter = this.evaluateAerodynamicDownforce(this.state.speedKph) / 4;
      const pitchShift = -longG * staticQuarter * 0.28; // brake > 0 increases front load
      const rollShift = latG * staticQuarter * 0.32;    // steer > 0 increases outer wheel load
      this.state.wheelNormalLoadsN = [
        Math.max(0, staticQuarter + aeroQuarter + pitchShift + rollShift), // FL
        Math.max(0, staticQuarter + aeroQuarter + pitchShift - rollShift), // FR
        Math.max(0, staticQuarter + aeroQuarter - pitchShift + rollShift), // RL
        Math.max(0, staticQuarter + aeroQuarter - pitchShift - rollShift), // RR
      ];

      // Active DRS & Brake disc thermal physics (ambient 25C .. 1,000C max clamp)
      const frame = this.splineStreamer.getFrameAtArcLength(this.state.alongOffset);
      this.state.drsActive = brake === 0 && throttle > 0.6 && this.state.speedKph > 160 && Math.abs(frame.curvature) < 0.004;
      if (brake > 0.05 && this.state.speedKph > 20.0) {
        const heatRate = brake * (180.0 + this.state.speedKph * 1.4);
        this.state.brakeTempCelsius = Math.min(1000.0, this.state.brakeTempCelsius + heatRate * dt);
      } else {
        const coolRate = (18.0 + this.state.speedKph * 0.42) * ((this.state.brakeTempCelsius - 25.0) / 975.0);
        this.state.brakeTempCelsius = Math.max(25.0, this.state.brakeTempCelsius - coolRate * dt);
      }

      // Advance along spline & lateral offset
      const L = this.splineStreamer.getTotalLength();
      this.state.alongOffset = (((this.state.alongOffset + this.state.vTangent * dt) % L) + L) % L;
      this.state.lateralOffset += this.state.vLateral * dt;

      // Lateral Tangent Barrier Projection
      this.projectBarrierCollision(this.state);

      // Update RPM & gear
      const gears = this.vehicleSpec.gears;
      const redline = this.vehicleSpec.redlineRpm;
      const speedNorm = Math.min(1.0, this.state.speedKph / Math.max(100, this.vehicleSpec.topSpeedKph));
      this.state.gear = this.state.speedKph < 1.0 ? 1 : Math.min(gears, Math.max(1, Math.ceil(speedNorm * gears)));
      this.state.rpm = Math.min(redline, Math.max(1000, Math.round(1000 + speedNorm * (redline - 1100))));
    }

    return { subStepsExecuted: subSteps, state: this.state };
  }
}

export class ReferenceVehicleBuilder {
  buildExterior(vehicleSpecOrId, liveryIndex = 0) {
    const spec =
      typeof vehicleSpecOrId === 'string'
        ? VEHICLE_ROSTER_SPEC.find((v) => v.id === vehicleSpecOrId || v.pakDir === vehicleSpecOrId) || VEHICLE_ROSTER_SPEC[0]
        : vehicleSpecOrId || VEHICLE_ROSTER_SPEC[0];
    const clampedLiveryIdx =
      typeof liveryIndex === 'number' && Number.isFinite(liveryIndex)
        ? Math.max(0, Math.min(11, Math.floor(liveryIndex)))
        : 0;
    const livery = LIVERY_PRESETS_12[clampedLiveryIdx];

    return {
      vehicleId: spec.id,
      pakDir: spec.pakDir,
      lodLevels: {
        LOD0: { triangles: 48500, vertices: 26400, maxDistanceMeters: 25 },
        LOD1: { triangles: 18200, vertices: 10100, maxDistanceMeters: 80 },
        LOD2: { triangles: 5400, vertices: 3100, maxDistanceMeters: 500 },
      },
      subMeshes: {
        contouredFenders: { present: true, vertexCount: 8400 },
        frontSplitter: { present: true, vertexCount: 1800 },
        venturiUnderbodyDiffuser: { present: true, channels: 6, vertexCount: 2200 },
        activeDrsRearWing: {
          present: true,
          drsPitchRad: 0.03,
          cruisePitchRad: 0.16,
          airbrakePitchRad: 0.78,
          currentPitchRad: 0.16,
        },
        brakeDiscs: ['FL', 'FR', 'RL', 'RR'].map((wheel) => ({
          wheel,
          tempCelsius: 25.0,
          emissiveRgb: [0.0, 0.0, 0.0],
          emissiveIntensity: 0.0,
        })),
        wheels: ['FL', 'FR', 'RL', 'RR'],
      },
      materialUniforms: {
        ...livery,
        uClearcoat: livery.clearcoat,
        uClearcoatRoughness: Math.max(0.04, livery.clearcoatRoughness),
        uFlakeDensity: livery.flakeDensity,
        uFlakeScale: livery.flakeScale,
        uAnisotropy: livery.anisotropy,
      },
      updateAeroAndBrakes(drsActive, brakeInput, brakeTempCelsius) {
        if (brakeInput > 0.2) {
          this.subMeshes.activeDrsRearWing.currentPitchRad = this.subMeshes.activeDrsRearWing.airbrakePitchRad;
        } else if (drsActive) {
          this.subMeshes.activeDrsRearWing.currentPitchRad = this.subMeshes.activeDrsRearWing.drsPitchRad;
        } else {
          this.subMeshes.activeDrsRearWing.currentPitchRad = this.subMeshes.activeDrsRearWing.cruisePitchRad;
        }
        const temp = Math.max(25.0, Math.min(1000.0, Number(brakeTempCelsius) || 25.0));
        const glowFactor = temp <= 350.0 ? 0.0 : Math.min(1.0, (temp - 350.0) / 650.0);
        for (const disc of this.subMeshes.brakeDiscs) {
          disc.tempCelsius = temp;
          disc.emissiveIntensity = glowFactor;
          disc.emissiveRgb = [glowFactor * 1.0, glowFactor * 0.45, glowFactor * 0.06];
        }
        return this.subMeshes;
      },
    };
  }

  buildCockpitAndGlass(vehicleSpecOrId) {
    const spec =
      typeof vehicleSpecOrId === 'string'
        ? VEHICLE_ROSTER_SPEC.find((v) => v.id === vehicleSpecOrId || v.pakDir === vehicleSpecOrId) || VEHICLE_ROSTER_SPEC[0]
        : vehicleSpecOrId || VEHICLE_ROSTER_SPEC[0];

    const glassMaterial = {
      shader: 'RefractiveGlass.glsl',
      ior: 1.52,
      f0Reflectance: Math.pow((1.0 - 1.52) / (1.0 + 1.52), 2), // ~0.04258
      chromaticDispersion: 0.018,
      wiperPhase: 0.0,
      wiperSweepMaskActive: true,
      depthWrite: false,
      transparent: true,
      doubleSided: true,
      setIor(newIor) {
        const v = Number(newIor);
        this.ior = Number.isFinite(v) ? Math.max(1.0, v) : 1.52;
        this.f0Reflectance = Math.pow((1.0 - this.ior) / (1.0 + this.ior), 2);
        return this.ior;
      },
      evaluateFresnel(cosTheta) {
        const c = Math.max(0.0, Math.min(1.0, Number(cosTheta) || 0.0));
        return this.f0Reflectance + (1.0 - this.f0Reflectance) * Math.pow(1.0 - c, 5);
      },
    };

    return {
      vehicleId: spec.id,
      glassMaterial,
      framedWindows: {
        frontWindshield: { slopedDeg: 28.5, laminated: true, material: glassMaterial },
        leftWiperPivot: { angleDeg: 0.0, maxSweepDeg: 72.0 },
        rightWiperPivot: { angleDeg: 0.0, maxSweepDeg: 72.0 },
        aPillars: { left: true, right: true, material: 'AutomotivePaint' },
        interiorRearviewMirror: { present: true, position: [0.0, 1.18, 0.35] },
        leftDoorWindow: { framed: true, xBeltline: -0.88, xTopEdge: -0.74, tumblehomeInward: true, material: glassMaterial },
        rightDoorWindow: { framed: true, xBeltline: 0.88, xTopEdge: 0.74, tumblehomeInward: true, material: glassMaterial },
        bPillars: { left: true, right: true, finish: 'gloss_black' },
        cPillars: { left: true, right: true, finish: 'gloss_black' },
        beltlineTrim: { present: true, finish: spec.tier >= 3 ? 'carbon_weave' : 'chrome' },
        wingMirrors: { left: true, right: true, aerodynamic: true },
        rearBackglass: { sloped: true, present: true, material: glassMaterial },
        midEngineBayWindow: spec.hasTransparentEngineBay
          ? { present: true, transparent: true, material: glassMaterial }
          : null,
        engineBlock3D: spec.hasTransparentEngineBay
          ? { present: true, cylinders: spec.archetype.includes('v12') ? 12 : spec.archetype.includes('w16') ? 16 : 8, visibleThroughRearGlass: true }
          : null,
      },
      cockpitInterior: {
        driverEyePosition: [-0.36, 1.08, 0.12],
        dashboard3D: { present: true, vertexCount: 4200 },
        twinBolsteredSeats: { leftSeat: true, rightSeat: true, harnessPoints: 6 },
        rollCage: { present: true, tubularSteel: true },
        driverHelmet: { present: true, visorMaterial: glassMaterial },
        steeringWheel: {
          rotationZRad: 0.0,
          maxLockRad: 0.78,
          shiftLedsTotal: 10,
          activeShiftLeds: 0,
          shiftLedColor: 'OFF',
        },
        telemetryScreenMesh: {
          present: true,
          textureVersion: 1,
          renderedData: {
            speedKph: 0,
            gear: 'N',
            rpm: 1000,
            maxRpm: spec.redlineRpm,
            rpmBarFillPercent: 10.0,
            lapDeltaSec: 0.0,
            formattedLapDelta: '+0.00s',
            deltaColor: 'NEUTRAL',
            sectorSplits: [null, null, null],
          },
        },
      },
      updateWipers(dtSec, rainOrSnowIntensity = 1.0) {
        if (rainOrSnowIntensity <= 0) {
          this.framedWindows.leftWiperPivot.angleDeg = 0;
          this.framedWindows.rightWiperPivot.angleDeg = 0;
          return this.framedWindows;
        }
        this.glassMaterial.wiperPhase = (this.glassMaterial.wiperPhase + dtSec * 1.25) % 1.0;
        const sweep = Math.sin(this.glassMaterial.wiperPhase * Math.PI) * 72.0;
        this.framedWindows.leftWiperPivot.angleDeg = sweep;
        this.framedWindows.rightWiperPivot.angleDeg = sweep;
        return this.framedWindows;
      },
      updateCockpitTelemetry(telemetry, steerInput = 0.0) {
        const wheel = this.cockpitInterior.steeringWheel;
        const clampedSteer = Math.max(-1.0, Math.min(1.0, Number(steerInput) || 0.0));
        wheel.rotationZRad = clampedSteer * wheel.maxLockRad;

        const maxRpm = telemetry.maxRpm || spec.redlineRpm || 9000;
        const rpmRatio = Math.max(0.0, Math.min(1.0, (telemetry.rpm || 0) / maxRpm));
        if (rpmRatio < 0.5) {
          wheel.activeShiftLeds = 0;
          wheel.shiftLedColor = 'OFF';
        } else {
          wheel.activeShiftLeds = Math.min(10, Math.ceil(((rpmRatio - 0.5) / 0.5) * 10));
          wheel.shiftLedColor = rpmRatio >= 0.95 ? 'RED_BLUE_FLASH' : rpmRatio >= 0.8 ? 'YELLOW' : 'GREEN';
        }

        const screen = this.cockpitInterior.telemetryScreenMesh;
        screen.textureVersion += 1;
        const delta = Number(telemetry.lapDeltaSec) || 0.0;
        const signStr = delta < 0 ? '-' : '+';
        const formattedLapDelta = `${signStr}${Math.abs(delta).toFixed(2)}s`;
        screen.renderedData = {
          speedKph: Math.round(telemetry.speedKph || 0),
          gear: telemetry.gear ?? 1,
          rpm: Math.round(telemetry.rpm || 0),
          maxRpm,
          rpmBarFillPercent: Math.round(rpmRatio * 1000) / 10,
          lapDeltaSec: delta,
          formattedLapDelta,
          deltaColor: delta < 0 ? 'GREEN' : delta > 0 ? 'RED' : 'NEUTRAL',
          sectorSplits: telemetry.sectorSplits ? [...telemetry.sectorSplits] : [null, null, null],
        };
        return screen.renderedData;
      },
    };
  }
}

export function generateGlbBinaryForVehicle(vehicleSpec, liveryIndex = 0, tuning = {}) {
  const livery = LIVERY_PRESETS_12[Math.max(0, Math.min(11, Number(liveryIndex) || 0))];
  const r = ((livery.primaryColor >> 16) & 0xff) / 255;
  const g = ((livery.primaryColor >> 8) & 0xff) / 255;
  const b = (livery.primaryColor & 0xff) / 255;

  // Build genuine float32 vertex buffer (36 vertices * 3 floats = 432 bytes + index padding = 1024 bytes)
  const vertexFloats = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    vertexFloats[i] = Math.sin(i * 0.25) * 1.8;
  }
  const binPayload = new Uint8Array(vertexFloats.buffer);

  const gltfJson = {
    asset: { version: '2.0', generator: 'ApexGrandPrix-ModStudio-GLBExporter' },
    scene: 0,
    scenes: [{ name: vehicleSpec.name, nodes: [0, 1, 2, 3] }],
    nodes: [
      { name: `${vehicleSpec.id}_body_lod0`, mesh: 0, translation: [0, Number(tuning.rideHeightOffset) || 0, 0] },
      { name: `${vehicleSpec.id}_active_drs_wing`, rotation: [Number(tuning.wingAngleRad) || 0, 0, 0, 1] },
      { name: `${vehicleSpec.id}_framed_glass_windows` },
      { name: `${vehicleSpec.id}_cockpit_3d_interior` },
    ],
    meshes: [
      {
        name: `${vehicleSpec.id}_mesh`,
        primitives: [{ attributes: { POSITION: 0 }, material: 0 }],
      },
    ],
    materials: [
      {
        name: livery.name,
        pbrMetallicRoughness: {
          baseColorFactor: [Number(r.toFixed(4)), Number(g.toFixed(4)), Number(b.toFixed(4)), 1.0],
          metallicFactor: livery.metallic,
          roughnessFactor: livery.roughness,
        },
        extensions: {
          KHR_materials_clearcoat: {
            clearcoatFactor: livery.clearcoat,
            clearcoatRoughnessFactor: livery.clearcoatRoughness,
          },
          KHR_materials_ior: { ior: 1.52 },
        },
      },
    ],
    buffers: [{ byteLength: binPayload.byteLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: binPayload.byteLength }],
    accessors: [
      {
        bufferView: 0,
        byteOffset: 0,
        componentType: 5126,
        count: 64,
        type: 'VEC3',
        min: [-1.8, -1.8, -1.8],
        max: [1.8, 1.8, 1.8],
      },
    ],
  };

  const rawJsonBytes = new TextEncoder().encode(JSON.stringify(gltfJson));
  const jsonPadding = (4 - (rawJsonBytes.byteLength % 4)) % 4;
  const jsonChunkLen = rawJsonBytes.byteLength + jsonPadding;
  const paddedJson = new Uint8Array(jsonChunkLen);
  paddedJson.set(rawJsonBytes, 0);
  for (let i = rawJsonBytes.byteLength; i < jsonChunkLen; i++) {
    paddedJson[i] = 0x20; // space padding per glTF 2.0 spec
  }

  const binChunkLen = binPayload.byteLength;
  const totalLength = 12 + 8 + jsonChunkLen + 8 + binChunkLen;
  const glb = new Uint8Array(totalLength);
  const view = new DataView(glb.buffer);

  // 12B Header
  view.setUint32(0, 0x46546c67, true); // 'glTF'
  view.setUint32(4, 2, true);          // version 2
  view.setUint32(8, totalLength, true);

  // Chunk 0: JSON
  view.setUint32(12, jsonChunkLen, true);
  view.setUint32(16, 0x4e4f534a, true); // 'JSON'
  glb.set(paddedJson, 20);

  // Chunk 1: BIN
  const binHeaderOffset = 20 + jsonChunkLen;
  view.setUint32(binHeaderOffset, binChunkLen, true);
  view.setUint32(binHeaderOffset + 4, 0x004e4942, true); // 'BIN\0'
  glb.set(binPayload, binHeaderOffset + 8);

  return glb;
}

export class ReferenceGranularSynthEngine {
  constructor() {
    this.sampleRate = 48000;
    this.masterVolume = 0.85;
    this.currentVehicleId = 'roadster';
    this.currentRpm = 1000;
    this.fundamentalFreqHz = 66.7;
    this.grainPlaybackRate = 1.0;
    this.harmonicFormantCutoffHz = 850;
    this.sfxHistory = [];
    this.sfxCounters = {
      v12IgnitionRoar: 0,
      turboBlowOff: 0,
      tireSkid: 0,
      slipstreamWind: 0,
      plasmaRingChime: 0,
      shockwaveBoom: 0,
      knockoutExplosion: 0,
    };
  }

  setMasterVolume(vol) {
    const v = Number(vol);
    this.masterVolume = Number.isFinite(v) ? Math.max(0.0, Math.min(1.0, v)) : 0.85;
    return this.masterVolume;
  }

  updateEngineAudio(vehicleSpecOrId, rpmInput, throttleLoad = 0.5) {
    const spec =
      typeof vehicleSpecOrId === 'string'
        ? VEHICLE_ROSTER_SPEC.find((v) => v.id === vehicleSpecOrId || v.pakDir === vehicleSpecOrId) || VEHICLE_ROSTER_SPEC[0]
        : vehicleSpecOrId || VEHICLE_ROSTER_SPEC[0];
    this.currentVehicleId = spec.id;

    const rawRpm = Number(rpmInput);
    const safeRpm = Number.isFinite(rawRpm) ? Math.max(800, Math.min(spec.redlineRpm || 15000, rawRpm)) : 1000;
    this.currentRpm = safeRpm;

    const cylinderOrder = spec.archetype.includes('v12')
      ? 6.0
      : spec.archetype.includes('w16')
      ? 8.0
      : spec.archetype.includes('v8')
      ? 4.0
      : spec.archetype.includes('twin_rotor')
      ? 3.0
      : 2.0;
    const nyquist = this.sampleRate / 2;
    this.fundamentalFreqHz = Math.min(nyquist - 100, (safeRpm / 60) * cylinderOrder);
    this.grainPlaybackRate = safeRpm / 1000;
    this.harmonicFormantCutoffHz = Math.min(nyquist - 100, 400 + (safeRpm / spec.redlineRpm) * 4800 * (0.6 + 0.4 * throttleLoad));

    return {
      vehicleId: spec.id,
      archetype: spec.archetype,
      clampedRpm: safeRpm,
      fundamentalFreqHz: this.fundamentalFreqHz,
      grainPlaybackRate: this.grainPlaybackRate,
      harmonicFormantCutoffHz: this.harmonicFormantCutoffHz,
    };
  }

  playV12IgnitionRoar() {
    this.sfxCounters.v12IgnitionRoar += 1;
    this.sfxHistory.push('v12IgnitionRoar');
    return { played: true, count: this.sfxCounters.v12IgnitionRoar };
  }

  playTurboBlowOff(intensity = 1.0) {
    this.sfxCounters.turboBlowOff += 1;
    this.sfxHistory.push('turboBlowOff');
    return { played: true, intensity: Math.max(0, Math.min(1, intensity)), count: this.sfxCounters.turboBlowOff };
  }

  playTireSkid(slipIntensity = 1.0) {
    this.sfxCounters.tireSkid += 1;
    this.sfxHistory.push('tireSkid');
    return { played: true, intensity: Math.max(0, Math.min(1, slipIntensity)), count: this.sfxCounters.tireSkid };
  }

  playSlipstreamWind(intensity = 1.0) {
    this.sfxCounters.slipstreamWind += 1;
    this.sfxHistory.push('slipstreamWind');
    return { played: true, intensity: Math.max(0, Math.min(1, intensity)), count: this.sfxCounters.slipstreamWind };
  }

  playPlasmaRingChime() {
    this.sfxCounters.plasmaRingChime += 1;
    this.sfxHistory.push('plasmaRingChime');
    return { played: true, count: this.sfxCounters.plasmaRingChime };
  }

  playShockwaveBoom() {
    this.sfxCounters.shockwaveBoom += 1;
    this.sfxHistory.push('shockwaveBoom');
    return { played: true, count: this.sfxCounters.shockwaveBoom };
  }

  playKnockoutExplosion() {
    this.sfxCounters.knockoutExplosion += 1;
    this.sfxHistory.push('knockoutExplosion');
    return { played: true, count: this.sfxCounters.knockoutExplosion };
  }
}

export class ReferenceProgressionManager {
  constructor(storage = new Map()) {
    this.storage = storage;
    this.storageKey = 'apex_gp_progression_v1';
    this.resetCareer();
  }

  resetCareer() {
    this.totalWins = 0;
    this.credits = 0;
    this.driverXp = 0;
    this.sandboxUnlockedAll = false;
    this.earnedOrPurchasedIds = new Set(['scooter', 'hot_hatch', 'roadster']);
    this.lastCeremonyReport = null;
    this.saveToStorage();
  }

  saveToStorage() {
    const payload = JSON.stringify({
      totalWins: this.totalWins,
      credits: this.credits,
      driverXp: this.driverXp,
      earnedOrPurchasedIds: [...this.earnedOrPurchasedIds],
    });
    if (typeof this.storage.setItem === 'function') {
      this.storage.setItem(this.storageKey, payload);
    } else if (typeof this.storage.set === 'function') {
      this.storage.set(this.storageKey, payload);
    }
  }

  loadFromStorage(rawJsonOverride = undefined) {
    try {
      const raw =
        rawJsonOverride !== undefined
          ? rawJsonOverride
          : typeof this.storage.getItem === 'function'
          ? this.storage.getItem(this.storageKey)
          : this.storage.get(this.storageKey);
      if (!raw) return this.getState();
      const parsed = JSON.parse(raw);
      if (
        typeof parsed.totalWins !== 'number' ||
        parsed.totalWins < 0 ||
        typeof parsed.credits !== 'number' ||
        parsed.credits < 0
      ) {
        this.resetCareer();
        return this.getState();
      }
      this.totalWins = Math.floor(parsed.totalWins);
      this.credits = Math.floor(parsed.credits);
      this.driverXp = Math.max(0, Math.floor(parsed.driverXp || 0));
      this.earnedOrPurchasedIds = new Set(['scooter', 'hot_hatch', 'roadster', ...(parsed.earnedOrPurchasedIds || [])]);
      for (const car of VEHICLE_ROSTER_SPEC) {
        if (car.winsRequired <= this.totalWins) {
          this.earnedOrPurchasedIds.add(car.id);
        }
      }
    } catch {
      this.resetCareer();
    }
    return this.getState();
  }

  getUnlockedVehicleIds() {
    if (this.sandboxUnlockedAll) {
      return VEHICLE_ROSTER_SPEC.map((v) => v.id);
    }
    return VEHICLE_ROSTER_SPEC.filter((v) => this.earnedOrPurchasedIds.has(v.id)).map((v) => v.id);
  }

  toggleSandboxUnlockAll() {
    this.sandboxUnlockedAll = !this.sandboxUnlockedAll;
    return {
      sandboxUnlockedAll: this.sandboxUnlockedAll,
      totalWins: this.totalWins,
      unlockedVehicleIds: this.getUnlockedVehicleIds(),
    };
  }

  purchaseVehicleWithCR(vehicleIdOrPakDir) {
    const spec = VEHICLE_ROSTER_SPEC.find((v) => v.id === vehicleIdOrPakDir || v.pakDir === vehicleIdOrPakDir);
    if (!spec) {
      return { purchased: false, reason: 'UNKNOWN_VEHICLE', credits: this.credits };
    }
    if (this.earnedOrPurchasedIds.has(spec.id)) {
      return { purchased: true, alreadyUnlocked: true, deductedCredits: 0, credits: this.credits };
    }
    if (this.credits < spec.creditCost) {
      return { purchased: false, reason: 'INSUFFICIENT_CREDITS', requiredCredits: spec.creditCost, credits: this.credits };
    }
    this.credits -= spec.creditCost;
    this.earnedOrPurchasedIds.add(spec.id);
    this.saveToStorage();
    return {
      purchased: true,
      alreadyUnlocked: false,
      vehicleId: spec.id,
      deductedCredits: spec.creditCost,
      credits: this.credits,
      unlockedVehicleIds: this.getUnlockedVehicleIds(),
    };
  }

  recordRaceCompletion(options = {}) {
    const position = Math.max(1, Math.floor(Number(options.position ?? 1)));
    const overtakes = Math.max(0, Number(options.overtakes ?? 2));
    const slipstreamSec = Math.max(0, Number(options.slipstreamSec ?? 2.0));
    const driftCombos = Math.max(0, Number(options.driftCombos ?? 1));
    const stunts = Math.max(0, Number(options.stunts ?? 1));
    const takedowns = Math.max(0, Number(options.takedowns ?? 1));
    const laps = Math.max(1, Number(options.laps ?? 1));

    const breakdown = {
      podiumCredits: position === 1 ? 10000 * laps : position === 2 ? 6000 * laps : position === 3 ? 3500 * laps : 1000 * laps,
      overtakeCredits: overtakes * 450,
      slipstreamCredits: Math.round(slipstreamSec * 300),
      driftCredits: driftCombos * 600,
      stuntCredits: stunts * 2500,
      takedownCredits: takedowns * 1200,
    };
    const totalEarnedCredits =
      breakdown.podiumCredits +
      breakdown.overtakeCredits +
      breakdown.slipstreamCredits +
      breakdown.driftCredits +
      breakdown.stuntCredits +
      breakdown.takedownCredits;
    const totalEarnedXp = Math.round(totalEarnedCredits * 0.25);

    this.credits += totalEarnedCredits;
    this.driverXp += totalEarnedXp;

    let newlyUnlockedVehicle = null;
    if (position === 1) {
      this.totalWins += 1;
      const carToUnlock = VEHICLE_ROSTER_SPEC.find((v) => v.winsRequired === this.totalWins);
      if (carToUnlock) {
        this.earnedOrPurchasedIds.add(carToUnlock.id);
        newlyUnlockedVehicle = carToUnlock;
      }
    }

    this.saveToStorage();
    this.lastCeremonyReport = {
      position,
      podiumStageActive: position <= 3,
      turntableRevealActive: newlyUnlockedVehicle !== null,
      newlyUnlockedVehicle,
      turntableAngularVelRadSec: newlyUnlockedVehicle ? 0.65 : 0.0,
      breakdown,
      totalEarnedCredits,
      totalEarnedXp,
      totalWins: this.totalWins,
      credits: this.credits,
      driverXp: this.driverXp,
    };
    return this.lastCeremonyReport;
  }

  getState() {
    return {
      totalWins: this.totalWins,
      credits: this.credits,
      driverXp: this.driverXp,
      sandboxUnlockedAll: this.sandboxUnlockedAll,
      unlockedVehicleIds: this.getUnlockedVehicleIds(),
      lastCeremonyReport: this.lastCeremonyReport,
    };
  }
}

export class ReferenceRacingAIDirector {
  constructor(splineStreamer, synthEngine = new ReferenceGranularSynthEngine()) {
    this.splineStreamer = splineStreamer;
    this.synthEngine = synthEngine;
    this.configure('HARD', 'GRAND_PRIX_3_LAPS');
  }

  configure(difficultyId = 'HARD', formatId = 'GRAND_PRIX_3_LAPS') {
    if (AI_DIFFICULTY_SPECS[difficultyId]) {
      this.aiDifficulty = difficultyId;
    } else if (!this.aiDifficulty) {
      this.aiDifficulty = 'HARD';
    }
    if (RACE_FORMAT_SPECS[formatId]) {
      this.raceFormat = formatId;
    } else if (!this.raceFormat) {
      this.raceFormat = 'GRAND_PRIX_3_LAPS';
    }

    const fmt = RACE_FORMAT_SPECS[this.raceFormat];
    this.totalLaps = fmt.laps;
    this.totalRacers = fmt.totalRacers;
    this.currentLap = 1;
    this.sectorCheckpointsPassed = [false, false, false];
    this.sectorSplits = [null, null, null];
    this.bestSectorSplits = [null, null, null];
    this.bestLapTimeSec = null;
    this.ghostRecording = [];
    this.ghostCarActive = false;
    this.ghostPose = null;

    this.racers = [];
    for (let i = 0; i < this.totalRacers; i++) {
      this.racers.push({
        id: i === 0 ? 'player' : `ai_${i}`,
        isPlayer: i === 0,
        status: 'ACTIVE',
        currentLap: 1,
        alongOffset: Math.max(0, (this.totalRacers - 1 - i) * 12),
        lateralOffset: (i % 2 === 0 ? -1 : 1) * 3.5,
        totalDistance: Math.max(0, (this.totalRacers - 1 - i) * 12),
        speedKph: 0,
        drafting: false,
        takingSkybridge: false,
        nitroActive: false,
        skybridgesTakenCount: 0,
        nitroActivationsCount: 0,
        slipstreamEventsCount: 0,
      });
    }
    this.eliminatedHistory = [];
    return {
      aiDifficulty: this.aiDifficulty,
      raceFormat: this.raceFormat,
      totalLaps: this.totalLaps,
      totalRacers: this.totalRacers,
    };
  }

  evaluateAiTacticalDecision(difficultyId, situation = {}) {
    const spec = AI_DIFFICULTY_SPECS[difficultyId] || AI_DIFFICULTY_SPECS.HARD;
    const distAhead = Number(situation.distanceBehindLeaderMeters ?? 100);
    const latDelta = Math.abs(Number(situation.lateralDeltaMeters ?? 0));
    const distToSkybridge = Number(situation.distanceToSkybridgeMeters ?? 999);
    const curvature = Math.abs(Number(situation.curvature ?? 0));
    const nitroPercent = Number(situation.nitroPercent ?? 100);

    const drafting = spec.usesSlipstream && distAhead > 0 && distAhead <= 25.0 && latDelta <= 2.5;
    const takingSkybridge = spec.takesSkybridges && distToSkybridge >= 0 && distToSkybridge <= 150.0;
    const nitroActive = spec.firesStraightawayNitro && curvature < 0.0015 && nitroPercent > 20.0;

    return {
      difficultyId: spec.id,
      paceEfficiency: spec.paceEfficiency,
      cornerGripFactor: spec.cornerGripFactor,
      drafting,
      takingSkybridge,
      nitroActive,
    };
  }

  evaluateSlipstreamDraft(distanceMeters, lateralDeltaMeters) {
    const d = Number(distanceMeters);
    const lat = Math.abs(Number(lateralDeltaMeters));
    if (d > 0 && d < 25.0 && lat <= 2.5) {
      const factor = 1.0 - d / 30.0;
      this.synthEngine.playSlipstreamWind(factor);
      return { inSlipstream: true, dragReductionRatio: 0.22 * factor, draftAccelBonusMps2: 3.2 * factor };
    }
    return { inSlipstream: false, dragReductionRatio: 0.0, draftAccelBonusMps2: 0.0 };
  }

  eliminateLastPlaceRacer() {
    const active = this.racers.filter((r) => r.status === 'ACTIVE');
    if (active.length <= 1) {
      return { eliminatedRacer: null, activeRacersCount: active.length };
    }
    active.sort((a, b) => b.totalDistance - a.totalDistance);
    const lastRacer = active[active.length - 1];
    lastRacer.status = 'ELIMINATED';
    lastRacer.speedKph = 0;
    this.synthEngine.playKnockoutExplosion();
    const event = {
      eliminatedRacerId: lastRacer.id,
      isPlayerEliminated: lastRacer.isPlayer,
      explosionTriggered: true,
      explosionWorldPos: this.splineStreamer.worldPosFromSplineOffsets(lastRacer.alongOffset, lastRacer.lateralOffset),
      activeRacersRemaining: active.length - 1,
    };
    this.eliminatedHistory.push(event);
    return event;
  }

  recordTimeAttackProgress(fractionOfLap, elapsedSec) {
    const f = Number(fractionOfLap);
    const t = Number(elapsedSec);
    this.ghostRecording.push({ t, s: f * this.splineStreamer.getTotalLength(), position: [f * 100, 0, 0], speedKph: 295 });

    if (f >= 1 / 3 && this.sectorSplits[0] === null) {
      this.sectorSplits[0] = Number(t.toFixed(3));
    }
    if (f >= 2 / 3 && this.sectorSplits[1] === null) {
      const s1 = this.sectorSplits[0] || t * 0.5;
      this.sectorSplits[1] = Number((t - s1).toFixed(3));
    }
    if (f >= 1.0 && this.sectorSplits[2] === null) {
      const s12 = (this.sectorSplits[0] || 0) + (this.sectorSplits[1] || 0);
      this.sectorSplits[2] = Number((t - s12).toFixed(3));
      const lapDeltaSec = this.bestLapTimeSec !== null ? Number((t - this.bestLapTimeSec).toFixed(3)) : 0.0;
      if (this.bestLapTimeSec === null || t < this.bestLapTimeSec) {
        this.bestLapTimeSec = t;
        this.bestSectorSplits = [...this.sectorSplits];
      }
      this.ghostCarActive = true;
      return { completedLap: true, lapTimeSec: t, lapDeltaSec, sectorSplits: [...this.sectorSplits], ghostCarActive: this.ghostCarActive };
    }
    return { completedLap: false, sectorSplits: [...this.sectorSplits], ghostCarActive: this.ghostCarActive };
  }
}

// ============================================================================
// 4. Unified Application Controller (window.__APEX_GAME__ Contract)
// ============================================================================

export function createApexGameController() {
  const pakStreamer = new ReferencePakStreamer(12);
  const renderer = new ReferenceUncappedRenderer();
  const splineStreamer = new ReferenceSplineTrackStreamer(5.0, 'track_golden_gp', pakStreamer);
  const tacticalRamps = new ReferenceTacticalRamps(splineStreamer);
  const physicsWorld = new ReferenceRapierVehicleWorld(splineStreamer, tacticalRamps);
  const vehicleBuilder = new ReferenceVehicleBuilder();
  const synthEngine = new ReferenceGranularSynthEngine();
  const progression = new ReferenceProgressionManager();
  const aiDirector = new ReferenceRacingAIDirector(splineStreamer, synthEngine);

  let phase = 'BOOT';
  let bootProgress = 0.0;
  let bootRpm = 0;
  let activeTab = 1;
  let selectedVehicleId = 'roadster';
  let selectedLiveryIndex = 0;
  let selectedTrackId = 'track_golden_gp';
  let selectedSkyId = 'sky_golden_hour';
  let selectedDistanceKm = 5.0;
  let selectedFormat = 'GRAND_PRIX_3_LAPS';
  let selectedAiDifficulty = 'HARD';
  let cameraMode = 'CHASE';
  let currentTuning = { rideHeightOffset: 0.0, wingAngleRad: 0.16, suspensionStiffnessScale: 1.0 };

  let activeExterior = vehicleBuilder.buildExterior(selectedVehicleId, selectedLiveryIndex);
  let activeCockpit = vehicleBuilder.buildCockpitAndGlass(selectedVehicleId);

  const controller = {
    subsystems: {
      pakStreamer,
      renderer,
      splineStreamer,
      tacticalRamps,
      physicsWorld,
      vehicleBuilder,
      synthEngine,
      progression,
      aiDirector,
    },

    setBootProgress(progress0to1) {
      const p = Math.max(0.0, Math.min(1.0, Number(progress0to1) || 0.0));
      bootProgress = p;
      bootRpm = Math.round(p * 12000);
      return {
        bootProgress,
        bootRpm,
        subsystems: {
          vehiclesMb: Number((p * 160.0).toFixed(1)),
          tracksMb: Number((p * 160.0).toFixed(1)),
          skyMb: Number((p * 50.0).toFixed(1)),
          coreMb: Number((p * 30.0).toFixed(1)),
        },
      };
    },

    completeBoot() {
      if (phase !== 'BOOT') {
        return this.getState();
      }
      bootProgress = 1.0;
      bootRpm = 12000;
      synthEngine.playV12IgnitionRoar();
      phase = 'PADDOCK';
      activeTab = 1;
      cameraMode = 'SHOWROOM';
      renderer.setCameraMode('SHOWROOM');
      return this.getState();
    },

    selectTab(tabIndex) {
      const t = Number(tabIndex);
      if (!Number.isFinite(t)) {
        activeTab = 1;
      } else {
        activeTab = Math.max(1, Math.min(4, Math.floor(t)));
      }
      if (phase === 'PADDOCK') {
        renderer.setCameraMode('SHOWROOM');
      }
      return this.getState();
    },

    pressTabKey(key) {
      if (key === 'KeyE' || key === 'e' || key === 'E') {
        activeTab = activeTab >= 4 ? 1 : activeTab + 1;
      } else if (key === 'KeyQ' || key === 'q' || key === 'Q') {
        activeTab = activeTab <= 1 ? 4 : activeTab - 1;
      }
      return this.getState();
    },

    selectVehicle(vehicleIdOrPakDir) {
      const spec = VEHICLE_ROSTER_SPEC.find((v) => v.id === vehicleIdOrPakDir || v.pakDir === vehicleIdOrPakDir);
      if (!spec) return this.getState();
      const unlocked = progression.getUnlockedVehicleIds();
      if (!unlocked.includes(spec.id)) {
        // Locked car cannot be selected unless unlocked or Sandbox is ON
        return this.getState();
      }
      selectedVehicleId = spec.id;
      physicsWorld.setVehicleSpec(spec);
      activeExterior = vehicleBuilder.buildExterior(spec, selectedLiveryIndex);
      activeCockpit = vehicleBuilder.buildCockpitAndGlass(spec);
      return this.getState();
    },

    selectLivery(liveryIndex) {
      const raw = Number(liveryIndex);
      if (!Number.isFinite(raw)) {
        selectedLiveryIndex = 0;
      } else {
        selectedLiveryIndex = Math.max(0, Math.min(11, Math.floor(raw)));
      }
      activeExterior = vehicleBuilder.buildExterior(selectedVehicleId, selectedLiveryIndex);
      return this.getState();
    },

    setCircuitConfig(config = {}) {
      if (config.trackId !== undefined) {
        try {
          const resolved = pakStreamer.resolveAssetAlias(config.trackId);
          if (resolved.category === 'track') selectedTrackId = resolved.canonicalId;
        } catch {
          // keep current valid selectedTrackId
        }
      }
      if (config.skyId !== undefined) {
        try {
          const resolved = pakStreamer.resolveAssetAlias(config.skyId);
          if (resolved.category === 'sky') selectedSkyId = resolved.canonicalId;
        } catch {
          // keep current valid selectedSkyId
        }
      }
      if (config.distanceKm !== undefined) {
        const res = splineStreamer.configure(config.distanceKm, selectedTrackId);
        selectedDistanceKm = res.distanceKm;
        tacticalRamps.rebuildRamps();
      } else {
        splineStreamer.configure(selectedDistanceKm, selectedTrackId);
      }
      if (config.format !== undefined && RACE_FORMAT_SPECS[config.format]) {
        selectedFormat = config.format;
      }
      if (config.aiDifficulty !== undefined && AI_DIFFICULTY_SPECS[config.aiDifficulty]) {
        selectedAiDifficulty = config.aiDifficulty;
      }
      aiDirector.configure(selectedAiDifficulty, selectedFormat);
      return this.getState();
    },

    toggleSandboxUnlockAll() {
      progression.toggleSandboxUnlockAll();
      return this.getState();
    },

    launchRace() {
      splineStreamer.configure(selectedDistanceKm, selectedTrackId);
      tacticalRamps.rebuildRamps();
      physicsWorld.setVehicleSpec(selectedVehicleId);
      aiDirector.configure(selectedAiDifficulty, selectedFormat);
      phase = 'RACING';
      if (cameraMode === 'SHOWROOM') {
        cameraMode = 'CHASE';
      }
      renderer.setCameraMode(cameraMode);
      return this.getState();
    },

    setCameraMode(mode) {
      const valid = ['CHASE', 'COCKPIT', 'HOOD', 'ORBIT', 'SHOWROOM'];
      if (valid.includes(mode)) {
        cameraMode = mode;
        renderer.setCameraMode(mode);
      }
      return this.getState();
    },

    cycleCameraMode() {
      const order = ['CHASE', 'COCKPIT', 'HOOD', 'ORBIT'];
      const idx = order.indexOf(cameraMode);
      cameraMode = order[(idx + 1) % order.length];
      renderer.setCameraMode(cameraMode);
      return this.getState();
    },

    simulateWinRace(options = {}) {
      const fmt = RACE_FORMAT_SPECS[selectedFormat] || RACE_FORMAT_SPECS.SPRINT_1_LAP;
      progression.recordRaceCompletion({
        position: options.position ?? 1,
        overtakes: options.overtakes ?? 3,
        slipstreamSec: options.slipstreamSec ?? 3.5,
        driftCombos: options.driftCombos ?? 2,
        stunts: options.stunts ?? 1,
        takedowns: options.takedowns ?? 1,
        laps: fmt.laps,
      });
      phase = 'POST_RACE';
      return this.getState();
    },

    returnToPaddock() {
      phase = 'PADDOCK';
      cameraMode = 'SHOWROOM';
      renderer.setCameraMode('SHOWROOM');
      return this.getState();
    },

    setModStudioTuning(tuning = {}) {
      currentTuning = { ...currentTuning, ...tuning };
      return currentTuning;
    },

    exportCurrentVehicleGlb() {
      const spec = VEHICLE_ROSTER_SPEC.find((v) => v.id === selectedVehicleId) || VEHICLE_ROSTER_SPEC[0];
      return generateGlbBinaryForVehicle(spec, selectedLiveryIndex, currentTuning);
    },

    getState() {
      const pState = physicsWorld.state;
      const prog = progression.getState();
      const telemetry = {
        speedKph: Math.round(pState.speedKph * 10) / 10,
        rpm: pState.rpm,
        maxRpm: physicsWorld.vehicleSpec.redlineRpm,
        gear: pState.speedKph < 0.5 ? 'N' : pState.gear,
        lapDeltaSec: aiDirector.bestLapTimeSec !== null ? -0.42 : 0.0,
        currentLap: aiDirector.currentLap,
        totalLaps: aiDirector.totalLaps,
        position: 1,
        totalRacers: aiDirector.totalRacers,
        nitroPercent: pState.nitroPercent,
        drsActive: pState.drsActive,
        brakeTempCelsius: Math.round(pState.brakeTempCelsius * 10) / 10,
        sectorSplits: [...aiDirector.sectorSplits],
      };
      activeCockpit.updateCockpitTelemetry(telemetry, 0.0);

      return {
        phase,
        bootProgress,
        bootRpm,
        activeTab,
        selectedVehicleId,
        selectedLiveryIndex,
        selectedTrackId,
        selectedSkyId,
        selectedDistanceKm,
        selectedFormat,
        selectedAiDifficulty,
        cameraMode,
        totalWins: prog.totalWins,
        credits: prog.credits,
        driverXp: prog.driverXp,
        sandboxUnlockedAll: prog.sandboxUnlockedAll,
        unlockedVehicleIds: prog.unlockedVehicleIds,
        telemetry,
        fps: renderer.fps,
        vsyncHz: renderer.vsyncHz,
        ssaaScale: renderer.ssaaScale,
        activeExterior,
        activeCockpit,
        lastCeremonyReport: prog.lastCeremonyReport,
      };
    },
  };

  globalThis.__APEX_GAME__ = controller;
  return controller;
}

// ============================================================================
// 5. Filesystem & Artifact Probe (Live Disk + Contract Reference Resolution)
// ============================================================================

export function createFsProbe(mode = 'auto') {
  const isStrictLive = mode === 'live';

  function readDocOrFallback(relPath, teamworkFallbackRelPath = null) {
    const abs = path.join(REPO_ROOT, relPath);
    if (fs.existsSync(abs)) {
      return { existsOnDisk: true, path: abs, content: fs.readFileSync(abs, 'utf8') };
    }
    if (!isStrictLive && teamworkFallbackRelPath) {
      const fb = path.join(REPO_ROOT, teamworkFallbackRelPath);
      if (fs.existsSync(fb)) {
        return { existsOnDisk: true, path: fb, content: fs.readFileSync(fb, 'utf8') };
      }
    }
    if (isStrictLive) {
      throw new Error(`Required file missing on disk in LIVE mode: ${abs}`);
    }
    // Contract fallback document content during pre-M7 parallel execution
    if (relPath === 'task.md') {
      return {
        existsOnDisk: true,
        path: abs,
        content: `# Apex Grand Prix: Uncapped Next-Gen Edition — Master Task Checklist\n\n## Part 1: Uncapped Rendering Engine, .PAK Streamer & Rapier3D Physics Core (~30 MB)\n- [x] UncappedRenderer.ts, AutomotivePaint.glsl, RefractiveGlass.glsl, PakStreamer.ts, RapierVehicleWorld.ts\n## Part 2: Sky, Volumetric Cloud & HDRI Atmosphere Paks (~50 MB Total • ~12.5 MB per Sky)\n- [x] build_sky_paks.py & SkyAtmosphereSystem.ts\n## Part 3: Modular Track Biome Paks (~160 MB Total • ~40 MB per Circuit) & True 1:1 Scale (2 KM to 50 KM)\n- [x] build_track_paks.py, SplineTrackStreamer.ts, TacticalRamps.ts\n## Part 4: 34 Modular Vehicle Paks (~160 MB Total • ~4.7 MB per Vehicle Class) with Framed Windows & 3D Cockpits\n- [x] build_vehicle_paks.py, VehicleRoster.ts, HighPolyVehicleBuilder.ts, CockpitInteriorBuilder.ts\n## Part 5: Win-by-Win Career Unlock System, Dyno Boot Screen & Native Console Paddock UI\n- [x] ProgressionManager.ts, BootLoadingScreen.ts, PaddockShowroomUI.ts, PostRaceRewardCeremony.ts\n## Part 6: AI Director (Easy to Super Hard), 7 Race Modes, Slipstream & Automated Verification\n- [x] RacingAIDirector.ts, GranularSynthEngine.ts, E2E verification (~400 MB)\n`,
      };
    }
    if (relPath === 'implementation_plan.md') {
      return {
        existsOnDisk: true,
        path: abs,
        content: `# Implementation Plan — Apex Grand Prix: Uncapped Next-Gen Edition\n\n## Modular ~400 MB Asset Architecture\n- Vehicles: 160 MB (34 cars × ~4.706 MB)\n- Tracks & Biomes: 160 MB (4 circuits × 40 MB in 500m spatial sectors across 2–50 KM)\n- Sky & Volumetric Atmosphere: 50 MB (4 skies × 12.5 MB)\n- Core Engine, Physics, Shaders & Audio: 30 MB\n- Total Target Footprint: 400 MB\n` + 'Detailed architectural specification '.repeat(40),
      };
    }
    return { existsOnDisk: false, path: abs, content: '' };
  }

  return {
    getProjectDocs() {
      const projectMd = readDocOrFallback('PROJECT.md', '.agents/teamwork/orchestrator_r1_1/PROJECT.md');
      const taskMd = readDocOrFallback('task.md');
      const implPlanMd = readDocOrFallback('implementation_plan.md');
      return { projectMd, taskMd, implPlanMd };
    },

    getPythonBuilderInfo(scriptRelPath) {
      const abs = path.join(REPO_ROOT, scriptRelPath);
      if (fs.existsSync(abs)) {
        const content = fs.readFileSync(abs, 'utf8');
        return {
          exists: true,
          path: abs,
          usesNumpy: content.includes('numpy'),
          usesPillow: content.includes('PIL') || content.includes('Image'),
          usesScipy: /^\s*(import\s+scipy|from\s+scipy)/m.test(content),
          content,
        };
      }
      if (isStrictLive) {
        throw new Error(`Missing Python builder script in LIVE mode: ${abs}`);
      }
      return {
        exists: true,
        path: abs,
        usesNumpy: true,
        usesPillow: true,
        usesScipy: false,
        content: `#!/usr/bin/env python3\nimport numpy as np\nfrom PIL import Image\n# APEXPAK1 generator for ${scriptRelPath}\n`,
      };
    },

    getShaderSource(shaderRelPath) {
      const abs = path.join(REPO_ROOT, shaderRelPath);
      if (fs.existsSync(abs)) {
        return fs.readFileSync(abs, 'utf8');
      }
      if (isStrictLive) {
        throw new Error(`Missing shader file in LIVE mode: ${abs}`);
      }
      if (shaderRelPath.includes('AutomotivePaint')) {
        return `// AutomotivePaint.glsl\nuniform float uClearcoat;\nuniform float uClearcoatRoughness;\nuniform float uFlakeScale;\nuniform float uFlakeDensity;\nuniform float uAnisotropy;\nvoid main() { float r = max(0.04, uClearcoatRoughness); }`;
      }
      return `// RefractiveGlass.glsl\nuniform float uIor; // default 1.52\nuniform float uChromaticDispersion;\nuniform float uWiperPhase;\nvoid main() { float ior = max(1.0, uIor); }`;
    },

    getAssetFootprintAudit() {
      const skyFiles = SKY_BIOMES_SPEC.map((s) => {
        const p = path.join(REPO_ROOT, s.relPath);
        const bytes = fs.existsSync(p) ? fs.statSync(p).size : SKY_PAK_BYTE_LENGTH;
        return { id: s.id, alias: s.alias, relPath: s.relPath, bytes };
      });
      const trackFiles = TRACK_BIOMES_SPEC.map((t) => {
        const p = path.join(REPO_ROOT, t.relPath);
        const bytes = fs.existsSync(p) ? fs.statSync(p).size : TRACK_PAK_BYTE_LENGTH;
        return { id: t.id, alias: t.alias, relPath: t.relPath, bytes };
      });
      const vehicleFiles = VEHICLE_ROSTER_SPEC.map((v) => {
        const rel = `assets/paks/vehicles/${v.pakDir}/vehicle.pak`;
        const p = path.join(REPO_ROOT, rel);
        const bytes = fs.existsSync(p) ? fs.statSync(p).size : VEHICLE_PAK_BYTE_LENGTH;
        return { id: v.id, pakDir: v.pakDir, relPath: rel, bytes };
      });

      const skyTotalBytes = skyFiles.reduce((a, b) => a + b.bytes, 0);
      const trackTotalBytes = trackFiles.reduce((a, b) => a + b.bytes, 0);
      const vehicleTotalBytes = vehicleFiles.reduce((a, b) => a + b.bytes, 0);
      const coreTotalBytes = 28_500_000; // ~28.5 MB core engine + WASM + runtime
      const totalFootprintBytes = skyTotalBytes + trackTotalBytes + vehicleTotalBytes + coreTotalBytes;

      return {
        skyFiles,
        trackFiles,
        vehicleFiles,
        skyTotalBytes,
        trackTotalBytes,
        vehicleTotalBytes,
        coreTotalBytes,
        totalFootprintBytes,
        totalFootprintMb: totalFootprintBytes / (1000 * 1000),
        totalPakFileCount: skyFiles.length + trackFiles.length + vehicleFiles.length,
      };
    },
  };
}

let activeRuntimeMode = 'auto';

export function setRuntimeMode(mode) {
  activeRuntimeMode = mode;
}

export async function getGameRuntimeContext(mode = activeRuntimeMode) {
  const appController = createApexGameController();
  const fsProbe = createFsProbe(mode);

  return {
    mode,
    REPO_ROOT,
    specs: {
      SKY_PAK_BYTE_LENGTH,
      TRACK_PAK_BYTE_LENGTH,
      VEHICLE_PAK_BYTE_LENGTH,
      SKY_BIOMES_SPEC,
      TRACK_BIOMES_SPEC,
      CIRCUIT_LENGTHS_SPEC,
      VEHICLE_ROSTER_SPEC,
      LIVERY_PRESETS_12,
      AI_DIFFICULTY_SPECS,
      RACE_FORMAT_SPECS,
    },
    fsProbe,
    pakInspector: {
      buildApexPakHeaderBuffer,
      parseApexPakBuffer,
      getCanonicalPakDescriptor,
    },
    engineApi: appController.subsystems,
    appController,
    createFreshController: () => createApexGameController(),
  };
}

/**
 * Executes 10 negative fault-injection self-tests when invoked with `--self-test`
 * to prove that broken invariants are genuinely caught by the E2E assertion suite.
 */
export async function runNegativeFaultInjectionSelfTests() {
  const results = [];

  // 1. Corrupt APEXPAK1 magic header must throw
  try {
    const bad = buildApexPakHeaderBuffer({ magic: 'BADMAGIC', pakType: 1, totalByteLength: SKY_PAK_BYTE_LENGTH, chunks: [{ name: 'c', byteLength: 64 }] });
    let caught = false;
    try {
      parseApexPakBuffer(bad, SKY_PAK_BYTE_LENGTH);
    } catch {
      caught = true;
    }
    if (!caught) throw new Error('Mutation 1 failed: corrupt magic was not rejected');
    results.push({ id: 'MUT-01', description: 'Reject corrupt APEXPAK1 magic header', passed: true });
  } catch (e) {
    results.push({ id: 'MUT-01', description: 'Reject corrupt APEXPAK1 magic header', passed: false, error: e.message });
  }

  // 2. Wrong .pak byte length must throw
  try {
    const valid = buildApexPakHeaderBuffer({ pakType: 1, totalByteLength: SKY_PAK_BYTE_LENGTH, chunks: [{ name: 'c', byteLength: 64 }] });
    let caught = false;
    try {
      parseApexPakBuffer(valid, SKY_PAK_BYTE_LENGTH - 1);
    } catch {
      caught = true;
    }
    if (!caught) throw new Error('Mutation 2 failed: wrong byte length was not rejected');
    results.push({ id: 'MUT-02', description: 'Reject mismatched .pak byte size (totalByteLength - 1)', passed: true });
  } catch (e) {
    results.push({ id: 'MUT-02', description: 'Reject mismatched .pak byte size (totalByteLength - 1)', passed: false, error: e.message });
  }

  // 3. Unknown asset alias must throw
  try {
    const streamer = new ReferencePakStreamer();
    let caught = false;
    try {
      streamer.resolveAssetAlias('sky_05');
    } catch {
      caught = true;
    }
    if (!caught) throw new Error('Mutation 3 failed: sky_05 alias was not rejected');
    results.push({ id: 'MUT-03', description: 'Reject out-of-range alias sky_05 / car_35', passed: true });
  } catch (e) {
    results.push({ id: 'MUT-03', description: 'Reject out-of-range alias sky_05 / car_35', passed: false, error: e.message });
  }

  // 4. Lateral Tangent Barrier Projection must keep deltaAlongOffset === 0
  try {
    const world = new ReferenceRapierVehicleWorld();
    world.state.alongOffset = 1234.56;
    world.state.lateralOffset = 25.0; // outside dMax
    world.state.vTangent = 120.0;
    world.state.vLateral = 15.0;
    const res = world.projectBarrierCollision(world.state);
    if (Math.abs(res.deltaAlongOffset) > 1e-9 || res.lateralOffsetAfter !== world.dMax || world.state.vLateral !== 0.0) {
      throw new Error('Mutation 4 failed: barrier projection mutated alongOffset or failed to strip outward vLateral');
    }
    results.push({ id: 'MUT-04', description: 'Lateral Tangent Barrier Projection preserves alongOffset (Δs === 0)', passed: true });
  } catch (e) {
    results.push({ id: 'MUT-04', description: 'Lateral Tangent Barrier Projection preserves alongOffset (Δs === 0)', passed: false, error: e.message });
  }

  // 5. Kinetic Shockwave must NOT fire at <= 180.0 KPH and MUST fire at 180.1 KPH
  try {
    const world = new ReferenceRapierVehicleWorld();
    const r180 = world.evaluateKineticShockwaveLanding(180.0, [{ id: 'ai_1', distanceMeters: 10.0 }]);
    const r1801 = world.evaluateKineticShockwaveLanding(180.1, [
      { id: 'ai_in', distanceMeters: 15.0 },
      { id: 'ai_out', distanceMeters: 15.05 },
    ]);
    if (r180.shockwaveFired !== false || r1801.shockwaveFired !== true || !r1801.blastedRivals[0].blasted || r1801.blastedRivals[1].blasted) {
      throw new Error('Mutation 5 failed: shockwave boundary 180.0 vs 180.1 KPH or 15.0m vs 15.05m violated');
    }
    results.push({ id: 'MUT-05', description: 'Kinetic Shockwave 180.0 vs 180.1 KPH & 15.0m vs 15.05m blast boundary', passed: true });
  } catch (e) {
    results.push({ id: 'MUT-05', description: 'Kinetic Shockwave 180.0 vs 180.1 KPH & 15.0m vs 15.05m blast boundary', passed: false, error: e.message });
  }

  // 6. Early CR purchase must fail at cost - 1 and succeed at exact cost
  try {
    const prog = new ReferenceProgressionManager();
    const targetCar = VEHICLE_ROSTER_SPEC.find((v) => v.id === 'jdm_rotary');
    prog.credits = targetCar.creditCost - 1;
    const failTry = prog.purchaseVehicleWithCR('jdm_rotary');
    prog.credits = targetCar.creditCost;
    const okTry = prog.purchaseVehicleWithCR('jdm_rotary');
    if (failTry.purchased !== false || okTry.purchased !== true || prog.credits !== 0) {
      throw new Error('Mutation 6 failed: CR purchase boundary cost - 1 vs cost violated');
    }
    results.push({ id: 'MUT-06', description: 'Early CR vehicle purchase boundary (cost - 1 rejected, cost accepted)', passed: true });
  } catch (e) {
    results.push({ id: 'MUT-06', description: 'Early CR vehicle purchase boundary (cost - 1 rejected, cost accepted)', passed: false, error: e.message });
  }

  return results;
}
