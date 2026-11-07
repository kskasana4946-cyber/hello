// src/vehicles/VehicleRoster.ts
// Authoritative 30-Vehicle Roster for Apex Grand Prix: Uncapped Next-Gen Edition
// Covers Tiers 0–5 (Cars #1–#30) strictly within the 7 allowed categories:
// Hatchback, Convertible, MPV, Truck, Sedan, SUV, Supercar.
// Tier 0 starts with 4 hatchbacks, exactly 2 FREE (mini_jcw & hot_hatch at 0 wins / 0 CR).

import { MotorsportTier, VehicleSpec } from '../core/types';

export const VEHICLE_COUNT = 30;

export type VehicleCategory =
  | 'Hatchback'
  | 'Convertible'
  | 'MPV'
  | 'Truck'
  | 'Sedan'
  | 'SUV'
  | 'Supercar';

export interface DetailedVehicleSpec extends VehicleSpec {
  category: VehicleCategory;
}

export const MOTORSPORT_TIER_NAMES: Record<MotorsportTier, string> = {
  0: 'Tier 0 — Starter Street & Club',
  1: 'Tier 1 — JDM Tuner, Drift & Off-Road',
  2: 'Tier 2 — Heavy Iron, Pursuit & Muscle',
  3: 'Tier 3 — Track Toys, Superbikes & GT3',
  4: 'Tier 4 — Exotic Supercars & Hypercars',
  5: 'Tier 5 — Prototypes, Open-Wheel & Mythic Concepts',
};

export const VEHICLE_ROSTER: readonly DetailedVehicleSpec[] = [
  // ==========================================================================
  // TIER 0: Starter Street & Club (Cars 1–4, 4 Hatchbacks, exactly 2 FREE)
  // ==========================================================================
  {
    index: 1,
    pakDir: 'car_01',
    id: 'mini_jcw',
    name: 'Mini Cooper JCW Hot Hatch',
    category: 'Hatchback',
    tier: 0,
    tierName: MOTORSPORT_TIER_NAMES[0],
    winsRequired: 0,
    creditCost: 0, // FREE
    zeroToHundredSec: 6.1,
    topSpeedKph: 246,
    massKg: 1280,
    archetype: 'HOT_HATCH_SEDAN',
    drivetrain: 'FWD',
    redlineRpm: 7200,
    gears: 6,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0x1e3a5f, // British Blue
    defaultAccentColor: 0xd4001a,  // Chili Red Roof
  },
  {
    index: 2,
    pakDir: 'car_02',
    id: 'hot_hatch',
    name: 'Type-R Turbo Hot Hatch',
    category: 'Hatchback',
    tier: 0,
    tierName: MOTORSPORT_TIER_NAMES[0],
    winsRequired: 0,
    creditCost: 0, // FREE
    zeroToHundredSec: 5.2,
    topSpeedKph: 275,
    massKg: 1390,
    archetype: 'HOT_HATCH_SEDAN',
    drivetrain: 'FWD',
    redlineRpm: 7500,
    gears: 6,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0xf4f3ee, // Championship White
    defaultAccentColor: 0xd4001a,  // Type-R Red
  },
  {
    index: 3,
    pakDir: 'car_03',
    id: 'golf_r',
    name: 'Golf R Turbo AWD Hatch',
    category: 'Hatchback',
    tier: 0,
    tierName: MOTORSPORT_TIER_NAMES[0],
    winsRequired: 1,
    creditCost: 18000,
    zeroToHundredSec: 4.6,
    topSpeedKph: 270,
    massKg: 1480,
    archetype: 'HOT_HATCH_SEDAN',
    drivetrain: 'AWD',
    redlineRpm: 7200,
    gears: 7,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0x0047cc, // Lapiz Blue
    defaultAccentColor: 0x111111,
  },
  {
    index: 4,
    pakDir: 'car_04',
    id: 'gr_yaris',
    name: 'GR Rallye Turbo Hatch AWD',
    category: 'Hatchback',
    tier: 0,
    tierName: MOTORSPORT_TIER_NAMES[0],
    winsRequired: 2,
    creditCost: 25000,
    zeroToHundredSec: 4.8,
    topSpeedKph: 260,
    massKg: 1280,
    archetype: 'HOT_HATCH_SEDAN',
    drivetrain: 'AWD',
    redlineRpm: 7500,
    gears: 6,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0xffffff,
    defaultAccentColor: 0xd4001a,
  },

  // ==========================================================================
  // TIER 1: JDM Tuner, Drift & Off-Road (Cars 5–9, 3–7 Wins)
  // ==========================================================================
  {
    index: 5,
    pakDir: 'car_05',
    id: 'roadster',
    name: 'MX-5 Club Spec Roadster',
    category: 'Convertible',
    tier: 1,
    tierName: MOTORSPORT_TIER_NAMES[1],
    winsRequired: 3,
    creditCost: 35000,
    zeroToHundredSec: 5.7,
    topSpeedKph: 235,
    massKg: 1060,
    archetype: 'SPORTS_COUPE_DRIFT',
    drivetrain: 'RWD',
    redlineRpm: 7800,
    gears: 6,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0x0047cc,
    defaultAccentColor: 0x111111,
  },
  {
    index: 6,
    pakDir: 'car_06',
    id: 'ranger_truck',
    name: 'Ford Ranger Raptor Double-Cab',
    category: 'Truck',
    tier: 1,
    tierName: MOTORSPORT_TIER_NAMES[1],
    winsRequired: 4,
    creditCost: 48000,
    zeroToHundredSec: 5.8,
    topSpeedKph: 210,
    massKg: 2420,
    archetype: 'OFFROAD_RALLY_TRUCK',
    drivetrain: 'AWD',
    redlineRpm: 6500,
    gears: 10,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0xf59e0b, // Code Orange
    defaultAccentColor: 0x1e293b,
  },
  {
    index: 7,
    pakDir: 'car_07',
    id: 'jdm_sedan',
    name: 'Chaser / Skyline GT Turbo Sedan',
    category: 'Sedan',
    tier: 1,
    tierName: MOTORSPORT_TIER_NAMES[1],
    winsRequired: 5,
    creditCost: 60000,
    zeroToHundredSec: 4.7,
    topSpeedKph: 265,
    massKg: 1420,
    archetype: 'SPORTS_COUPE_DRIFT',
    drivetrain: 'RWD',
    redlineRpm: 8200,
    gears: 6,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0xffcc00,
    defaultAccentColor: 0x111111,
  },
  {
    index: 8,
    pakDir: 'car_08',
    id: 'trail_suv',
    name: 'Bronco Wildtrak 4x4 SUV',
    category: 'SUV',
    tier: 1,
    tierName: MOTORSPORT_TIER_NAMES[1],
    winsRequired: 6,
    creditCost: 72000,
    zeroToHundredSec: 6.1,
    topSpeedKph: 195,
    massKg: 2280,
    archetype: 'OFFROAD_RALLY_TRUCK',
    drivetrain: 'AWD',
    redlineRpm: 6200,
    gears: 10,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0x0284c7, // Velocity Blue
    defaultAccentColor: 0x111111,
  },
  {
    index: 9,
    pakDir: 'car_09',
    id: 'sport_mpv',
    name: 'Supercharged V6 Sport MPV',
    category: 'MPV',
    tier: 1,
    tierName: MOTORSPORT_TIER_NAMES[1],
    winsRequired: 7,
    creditCost: 85000,
    zeroToHundredSec: 5.9,
    topSpeedKph: 230,
    massKg: 2050,
    archetype: 'HOT_HATCH_SEDAN',
    drivetrain: 'AWD',
    redlineRpm: 6800,
    gears: 8,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0x38bdf8,
    defaultAccentColor: 0x0f172a,
  },

  // ==========================================================================
  // TIER 2: Heavy Iron, Pursuit & Muscle (Cars 10–14, 8–12 Wins)
  // ==========================================================================
  {
    index: 10,
    pakDir: 'car_10',
    id: 'overland_truck',
    name: 'Global 4x4 Overland Crew-Cab',
    category: 'Truck',
    tier: 2,
    tierName: MOTORSPORT_TIER_NAMES[2],
    winsRequired: 8,
    creditCost: 105000,
    zeroToHundredSec: 5.5,
    topSpeedKph: 215,
    massKg: 2650,
    archetype: 'OFFROAD_RALLY_TRUCK',
    drivetrain: 'AWD',
    redlineRpm: 6500,
    gears: 8,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0xf8fafc,
    defaultAccentColor: 0x111111,
  },
  {
    index: 11,
    pakDir: 'car_11',
    id: 'classic_muscle',
    name: '1969 Charger Hemi Fastback Sedan',
    category: 'Sedan',
    tier: 2,
    tierName: MOTORSPORT_TIER_NAMES[2],
    winsRequired: 9,
    creditCost: 120000,
    zeroToHundredSec: 4.8,
    topSpeedKph: 255,
    massKg: 1720,
    archetype: 'MUSCLE_PURSUIT',
    drivetrain: 'RWD',
    redlineRpm: 6800,
    gears: 5,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0x111111,
    defaultAccentColor: 0xffffff,
  },
  {
    index: 12,
    pakDir: 'car_12',
    id: 'police_sedan',
    name: 'Twin-Turbo Pursuit Police Interceptor',
    category: 'Sedan',
    tier: 2,
    tierName: MOTORSPORT_TIER_NAMES[2],
    winsRequired: 10,
    creditCost: 140000,
    zeroToHundredSec: 3.4,
    topSpeedKph: 305,
    massKg: 1820,
    archetype: 'MUSCLE_PURSUIT',
    drivetrain: 'AWD',
    redlineRpm: 7200,
    gears: 8,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0x16181d,
    defaultAccentColor: 0xf8fafc,
  },
  {
    index: 13,
    pakDir: 'car_13',
    id: 'swat_suv',
    name: 'Armored Enforcer V8 Tactical SUV',
    category: 'SUV',
    tier: 2,
    tierName: MOTORSPORT_TIER_NAMES[2],
    winsRequired: 11,
    creditCost: 165000,
    zeroToHundredSec: 5.6,
    topSpeedKph: 215,
    massKg: 3450,
    archetype: 'HEAVY_COMMERCIAL',
    drivetrain: 'AWD',
    redlineRpm: 6000,
    gears: 8,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0x2e3436,
    defaultAccentColor: 0x111111,
  },
  {
    index: 14,
    pakDir: 'car_14',
    id: 'vip_mpv',
    name: 'Lexus LM / Alphard Lounge MPV',
    category: 'MPV',
    tier: 2,
    tierName: MOTORSPORT_TIER_NAMES[2],
    winsRequired: 12,
    creditCost: 190000,
    zeroToHundredSec: 6.4,
    topSpeedKph: 220,
    massKg: 2350,
    archetype: 'HOT_HATCH_SEDAN',
    drivetrain: 'AWD',
    redlineRpm: 6500,
    gears: 8,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0x0f172a,
    defaultAccentColor: 0xd4af37,
  },

  // ==========================================================================
  // TIER 3: Track Toys & Grand Touring (Cars 15–19, 13–17 Wins)
  // ==========================================================================
  {
    index: 15,
    pakDir: 'car_15',
    id: 'bentley_sedan',
    name: 'Bentley Flying Spur W12 Luxury Sedan',
    category: 'Sedan',
    tier: 3,
    tierName: MOTORSPORT_TIER_NAMES[3],
    winsRequired: 13,
    creditCost: 225000,
    zeroToHundredSec: 3.7,
    topSpeedKph: 333,
    massKg: 2437,
    archetype: 'HOT_HATCH_SEDAN',
    drivetrain: 'AWD',
    redlineRpm: 6800,
    gears: 8,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0xd4b886, // Pale Gold / Sand
    defaultAccentColor: 0xffffff,
  },
  {
    index: 16,
    pakDir: 'car_16',
    id: 'porsche_cabrio',
    name: 'Porsche 911 Carrera Cabriolet',
    category: 'Convertible',
    tier: 3,
    tierName: MOTORSPORT_TIER_NAMES[3],
    winsRequired: 14,
    creditCost: 250000,
    zeroToHundredSec: 3.5,
    topSpeedKph: 310,
    massKg: 1535,
    archetype: 'SPORTS_COUPE_DRIFT',
    drivetrain: 'RWD',
    redlineRpm: 7500,
    gears: 8,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0x1034a6, // Gentian Blue
    defaultAccentColor: 0xd0d5dd,
  },
  {
    index: 17,
    pakDir: 'car_17',
    id: 'porsche_targa',
    name: 'Porsche 911 Targa Heritage',
    category: 'Convertible',
    tier: 3,
    tierName: MOTORSPORT_TIER_NAMES[3],
    winsRequired: 15,
    creditCost: 275000,
    zeroToHundredSec: 3.4,
    topSpeedKph: 315,
    massKg: 1640,
    archetype: 'SPORTS_COUPE_DRIFT',
    drivetrain: 'AWD',
    redlineRpm: 7500,
    gears: 8,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0xf8fafc, // Pure White
    defaultAccentColor: 0x94a3b8,  // Brushed Silver Targa Hoop
  },
  {
    index: 18,
    pakDir: 'car_18',
    id: 'urus_suv',
    name: 'Super SUV Twin-Turbo V8 (Urus)',
    category: 'SUV',
    tier: 3,
    tierName: MOTORSPORT_TIER_NAMES[3],
    winsRequired: 16,
    creditCost: 300000,
    zeroToHundredSec: 3.2,
    topSpeedKph: 312,
    massKg: 2150,
    archetype: 'GT3_SUPERCAR',
    drivetrain: 'AWD',
    redlineRpm: 7000,
    gears: 8,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0xffea00, // Giallo Auge
    defaultAccentColor: 0x111111,
  },
  {
    index: 19,
    pakDir: 'car_19',
    id: 'trophy_truck',
    name: 'Baja 1000 Trophy Desert Truck',
    category: 'Truck',
    tier: 3,
    tierName: MOTORSPORT_TIER_NAMES[3],
    winsRequired: 17,
    creditCost: 325000,
    zeroToHundredSec: 4.2,
    topSpeedKph: 235,
    massKg: 2550,
    archetype: 'OFFROAD_RALLY_TRUCK',
    drivetrain: 'RWD',
    redlineRpm: 7200,
    gears: 6,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0xff6600,
    defaultAccentColor: 0x111111,
  },

  // ==========================================================================
  // TIER 4: Exotic Supercars & Aero Weapons (Cars 20–24, 18–22 Wins)
  // ==========================================================================
  {
    index: 20,
    pakDir: 'car_20',
    id: 'corvette_c8',
    name: 'Mid-Engine Z06 Convertible',
    category: 'Convertible',
    tier: 4,
    tierName: MOTORSPORT_TIER_NAMES[4],
    winsRequired: 18,
    creditCost: 360000,
    zeroToHundredSec: 2.6,
    topSpeedKph: 318,
    massKg: 1560,
    archetype: 'GT3_SUPERCAR',
    drivetrain: 'RWD',
    redlineRpm: 8600,
    gears: 8,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0xffcc00, // Accelerate Yellow
    defaultAccentColor: 0x111111,
  },
  {
    index: 21,
    pakDir: 'car_21',
    id: 'porsche_gt3',
    name: 'Flat-6 GT3 RS Aero Weapon',
    category: 'Sedan',
    tier: 4,
    tierName: MOTORSPORT_TIER_NAMES[4],
    winsRequired: 19,
    creditCost: 395000,
    zeroToHundredSec: 3.0,
    topSpeedKph: 312,
    massKg: 1450,
    archetype: 'GT3_SUPERCAR',
    drivetrain: 'RWD',
    redlineRpm: 9000,
    gears: 7,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0xf4f3ee,
    defaultAccentColor: 0xff2a00,
  },
  {
    index: 22,
    pakDir: 'car_22',
    id: 'lambo_v12',
    name: 'V12 Italian Apex (Revuelto)',
    category: 'Supercar',
    tier: 4,
    tierName: MOTORSPORT_TIER_NAMES[4],
    winsRequired: 20,
    creditCost: 430000,
    zeroToHundredSec: 2.5,
    topSpeedKph: 350,
    massKg: 1525,
    archetype: 'GT3_SUPERCAR',
    drivetrain: 'AWD',
    redlineRpm: 9500,
    gears: 8,
    hasTransparentEngineBay: true,
    defaultPrimaryColor: 0x00e5ff,
    defaultAccentColor: 0x111111,
  },
  {
    index: 23,
    pakDir: 'car_23',
    id: 'mclaren_lt',
    name: 'Carbon Monocell Senna GTR',
    category: 'Truck',
    tier: 4,
    tierName: MOTORSPORT_TIER_NAMES[4],
    winsRequired: 21,
    creditCost: 465000,
    zeroToHundredSec: 2.7,
    topSpeedKph: 340,
    massKg: 1188,
    archetype: 'GT3_SUPERCAR',
    drivetrain: 'RWD',
    redlineRpm: 8500,
    gears: 7,
    hasTransparentEngineBay: true,
    defaultPrimaryColor: 0xff7300,
    defaultAccentColor: 0x16181d,
  },
  {
    index: 24,
    pakDir: 'car_24',
    id: 'cyber_mpv',
    name: 'Cyber Grand Lounge MPV Concept',
    category: 'MPV',
    tier: 4,
    tierName: MOTORSPORT_TIER_NAMES[4],
    winsRequired: 22,
    creditCost: 490000,
    zeroToHundredSec: 3.1,
    topSpeedKph: 290,
    massKg: 2250,
    archetype: 'HOT_HATCH_SEDAN',
    drivetrain: 'AWD',
    redlineRpm: 12000,
    gears: 1,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0x00f0ff,
    defaultAccentColor: 0x1e1b4b,
  },

  // ==========================================================================
  // TIER 5: Hypercars & Futuristic Prototypes (Cars 25–30, 23–28 Wins)
  // ==========================================================================
  {
    index: 25,
    pakDir: 'car_25',
    id: 'pagani_utopia',
    name: 'Pagani Utopia Twin-Turbo V12',
    category: 'Supercar',
    tier: 5,
    tierName: MOTORSPORT_TIER_NAMES[5],
    winsRequired: 23,
    creditCost: 530000,
    zeroToHundredSec: 2.7,
    topSpeedKph: 360,
    massKg: 1280,
    archetype: 'HYPERCAR_PROTOTYPE',
    drivetrain: 'RWD',
    redlineRpm: 8200,
    gears: 7,
    hasTransparentEngineBay: true,
    defaultPrimaryColor: 0xd0d5dd, // Silver Titanium
    defaultAccentColor: 0xd4af37,  // Gold Inlays
  },
  {
    index: 26,
    pakDir: 'car_26',
    id: 'ferrari_laferrari',
    name: 'Ferrari LaFerrari Maranello Apex',
    category: 'Supercar',
    tier: 5,
    tierName: MOTORSPORT_TIER_NAMES[5],
    winsRequired: 24,
    creditCost: 575000,
    zeroToHundredSec: 2.6,
    topSpeedKph: 355,
    massKg: 1350,
    archetype: 'HYPERCAR_PROTOTYPE',
    drivetrain: 'RWD',
    redlineRpm: 9250,
    gears: 7,
    hasTransparentEngineBay: true,
    defaultPrimaryColor: 0xd4001a, // Rosso Corsa
    defaultAccentColor: 0xd4af37,  // Gold Wheels
  },
  {
    index: 27,
    pakDir: 'car_27',
    id: 'bugatti_bolide',
    name: 'Bugatti Bolide / Chiron Quad-Turbo',
    category: 'Supercar',
    tier: 5,
    tierName: MOTORSPORT_TIER_NAMES[5],
    winsRequired: 25,
    creditCost: 620000,
    zeroToHundredSec: 2.2,
    topSpeedKph: 440,
    massKg: 1450,
    archetype: 'HYPERCAR_PROTOTYPE',
    drivetrain: 'AWD',
    redlineRpm: 8500,
    gears: 7,
    hasTransparentEngineBay: true,
    defaultPrimaryColor: 0xd4001a, // Two-tone Red
    defaultAccentColor: 0x1e2229,  // Carbon
  },
  {
    index: 28,
    pakDir: 'car_28',
    id: 'terzo_ev',
    name: 'Futuristic EV Supercar (Terzo)',
    category: 'Supercar',
    tier: 5,
    tierName: MOTORSPORT_TIER_NAMES[5],
    winsRequired: 26,
    creditCost: 670000,
    zeroToHundredSec: 1.85,
    topSpeedKph: 415,
    massKg: 1650,
    archetype: 'HYPERCAR_PROTOTYPE',
    drivetrain: 'AWD',
    redlineRpm: 14000,
    gears: 1,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0xf8fafc,
    defaultAccentColor: 0x00f0ff, // Cyan Neon Streaks
  },
  {
    index: 29,
    pakDir: 'car_29',
    id: 'koenigsegg_jesko',
    name: 'Jesko Absolut Low-Drag Hypercar',
    category: 'Supercar',
    tier: 5,
    tierName: MOTORSPORT_TIER_NAMES[5],
    winsRequired: 27,
    creditCost: 720000,
    zeroToHundredSec: 2.4,
    topSpeedKph: 465,
    massKg: 1390,
    archetype: 'HYPERCAR_PROTOTYPE',
    drivetrain: 'RWD',
    redlineRpm: 8500,
    gears: 9,
    hasTransparentEngineBay: true,
    defaultPrimaryColor: 0x8c939e,
    defaultAccentColor: 0xff7300,
  },
  {
    index: 30,
    pakDir: 'car_30',
    id: 'rimac_nevera',
    name: 'Rimac Nevera Time Attack EV',
    category: 'SUV',
    tier: 5,
    tierName: MOTORSPORT_TIER_NAMES[5],
    winsRequired: 28,
    creditCost: 775000,
    zeroToHundredSec: 1.74,
    topSpeedKph: 412,
    massKg: 2150,
    archetype: 'HYPERCAR_PROTOTYPE',
    drivetrain: 'AWD',
    redlineRpm: 14000,
    gears: 1,
    hasTransparentEngineBay: false,
    defaultPrimaryColor: 0x00e5ff,
    defaultAccentColor: 0x16181d,
  },
];

// Comprehensive Aliases Map (covers car_01..30, new IDs, and legacy roster slugs)
const VEHICLE_ALIASES: Record<string, string> = {
  // Folder aliases
  car_01: 'mini_jcw',
  car_02: 'hot_hatch',
  car_03: 'golf_r',
  car_04: 'gr_yaris',
  car_05: 'roadster',
  car_06: 'ranger_truck',
  car_07: 'jdm_sedan',
  car_08: 'trail_suv',
  car_09: 'sport_mpv',
  car_10: 'overland_truck',
  car_11: 'classic_muscle',
  car_12: 'police_sedan',
  car_13: 'swat_suv',
  car_14: 'vip_mpv',
  car_15: 'bentley_sedan',
  car_16: 'porsche_cabrio',
  car_17: 'porsche_targa',
  car_18: 'urus_suv',
  car_19: 'trophy_truck',
  car_20: 'corvette_c8',
  car_21: 'porsche_gt3',
  car_22: 'lambo_v12',
  car_23: 'mclaren_lt',
  car_24: 'cyber_mpv',
  car_25: 'pagani_utopia',
  car_26: 'ferrari_laferrari',
  car_27: 'bugatti_bolide',
  car_28: 'terzo_ev',
  car_29: 'koenigsegg_jesko',
  car_30: 'rimac_nevera',

  // Descriptive & model aliases
  mini: 'mini_jcw',
  cooper: 'mini_jcw',
  jcw: 'mini_jcw',
  type_r: 'hot_hatch',
  civic: 'hot_hatch',
  golf: 'golf_r',
  yaris: 'gr_yaris',
  miata: 'roadster',
  mx5: 'roadster',
  ranger: 'ranger_truck',
  raptor: 'ranger_truck',
  chaser: 'jdm_sedan',
  skyline: 'jdm_sedan',
  bronco: 'trail_suv',
  overland: 'overland_truck',
  charger: 'classic_muscle',
  hemi: 'classic_muscle',
  interceptor: 'police_sedan',
  police: 'police_sedan',
  swat: 'swat_suv',
  alphard: 'vip_mpv',
  lexus_lm: 'vip_mpv',
  bentley: 'bentley_sedan',
  flying_spur: 'bentley_sedan',
  cabriolet: 'porsche_cabrio',
  targa: 'porsche_targa',
  urus: 'urus_suv',
  trophy: 'trophy_truck',
  baja: 'trophy_truck',
  c8: 'corvette_c8',
  gt3_rs: 'porsche_gt3',
  revuelto: 'lambo_v12',
  aventador: 'lambo_v12',
  senna: 'mclaren_lt',
  senna_gtr: 'mclaren_lt',
  utopia: 'pagani_utopia',
  huayra: 'pagani_utopia',
  laferrari: 'ferrari_laferrari',
  bolide: 'bugatti_bolide',
  chiron: 'bugatti_bolide',
  terzo: 'terzo_ev',
  jesko: 'koenigsegg_jesko',
  nevera: 'rimac_nevera',
  rimac: 'rimac_nevera',

  // Legacy 34-car IDs compatibility bridge
  scooter: 'mini_jcw',
  jdm_rotary: 'jdm_sedan',
  car: 'jdm_sedan',
  skyline_gtr: 'jdm_sedan',
  rally: 'gr_yaris',
  dune_buggy: 'trail_suv',
  truck: 'trophy_truck',
  muscle: 'classic_muscle',
  swat_armored: 'swat_suv',
  semi_rig: 'overland_truck',
  bus: 'sport_mpv',
  kart_shifter: 'golf_r',
  ariel_exo: 'roadster',
  corvette_gt: 'corvette_c8',
  bike: 'porsche_cabrio',
  cyber_bike: 'cyber_mpv',
  ferrari_v8: 'ferrari_laferrari',
  lambo: 'lambo_v12',
  pagani_v12: 'pagani_utopia',
  koenigsegg: 'koenigsegg_jesko',
  hyper: 'bugatti_bolide',
  ev_proto: 'rimac_nevera',
  stock_nascar: 'classic_muscle',
  indy_open: 'porsche_gt3',
  lmp1: 'mclaren_lt',
  f1: 'terzo_ev',
  fan_car: 'pagani_utopia',
  jet_thrust: 'rimac_nevera',
};

/**
 * Returns all 30 vehicles in canonical order (index 1 to 30).
 */
export function getAllVehicles(): DetailedVehicleSpec[] {
  return [...VEHICLE_ROSTER];
}

/**
 * Looks up a vehicle by index (1 to 30).
 */
export function getVehicleByIndex(index: number): DetailedVehicleSpec | undefined {
  if (index < 1 || index > VEHICLE_COUNT) {
    return undefined;
  }
  return VEHICLE_ROSTER[index - 1];
}

/**
 * Looks up a vehicle by ID, slug, folder name, or alias (case-insensitive).
 */
export function getVehicleById(idOrAlias: string): DetailedVehicleSpec | undefined {
  const clean = idOrAlias.trim().toLowerCase();
  // Direct ID match
  const direct = VEHICLE_ROSTER.find((v) => v.id.toLowerCase() === clean);
  if (direct) return direct;

  // Folder name match (e.g. 'car_01' or 'car_25')
  const dirMatch = VEHICLE_ROSTER.find((v) => v.pakDir.toLowerCase() === clean);
  if (dirMatch) return dirMatch;

  // Numeric index in string form
  const num = parseInt(clean, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= VEHICLE_COUNT) {
    return VEHICLE_ROSTER[num - 1];
  }

  // Alias map resolution
  const resolvedId = VEHICLE_ALIASES[clean];
  if (resolvedId) {
    return VEHICLE_ROSTER.find((v) => v.id.toLowerCase() === resolvedId);
  }

  return undefined;
}

/**
 * Returns all vehicles belonging to a specific Motorsport tier (0 to 5).
 */
export function getVehiclesByTier(tier: MotorsportTier): DetailedVehicleSpec[] {
  return VEHICLE_ROSTER.filter((v) => v.tier === tier);
}

/**
 * Returns all vehicles belonging to a specific category.
 */
export function getVehiclesByCategory(category: VehicleCategory): DetailedVehicleSpec[] {
  return VEHICLE_ROSTER.filter((v) => v.category === category);
}

/**
 * Checks if a vehicle is unlocked for a given career win count.
 */
export function isVehicleUnlocked(vehicleIdOrIndex: string | number, totalWins: number): boolean {
  const spec = typeof vehicleIdOrIndex === 'number'
    ? getVehicleByIndex(vehicleIdOrIndex)
    : getVehicleById(vehicleIdOrIndex);

  if (!spec) return false;
  return totalWins >= spec.winsRequired;
}

/**
 * Returns the highest unlocked vehicle index for a given win count.
 */
export function getUnlockedVehicleCount(totalWins: number): number {
  return VEHICLE_ROSTER.filter((v) => totalWins >= v.winsRequired).length;
}
