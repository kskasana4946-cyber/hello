// src/core/types.ts
// Authoritative Shared Contracts for Apex Grand Prix: Uncapped Next-Gen Edition

export type Vec3Tuple = [number, number, number];

// ============================================================================
// 1. BINARY .PAK CONTAINER CONTRACT ("APEXPAK1")
// ============================================================================

export const APEX_PAK_MAGIC = 'APEXPAK1';
export const APEX_PAK_VERSION = 1;
export const APEX_PAK_HEADER_BYTES = 64;
export const APEX_PAK_TOC_ENTRY_BYTES = 64;

export const SKY_PAK_TARGET_BYTES = 26_214_400;     // 25.00 MiB × 4 = 100.00 MiB (104,857,600 B)
export const TRACK_PAK_TARGET_BYTES = 83_886_080;   // 80.00 MiB × 4 = 320.00 MiB (335,544,320 B)
export const VEHICLE_PAK_TARGET_BYTES = 9_411_776;  // ~9.412 MB × 34 = 320.00 MB (320,000,384 B)

export const PakType = {
  SKY: 1,
  TRACK: 2,
  VEHICLE: 3,
} as const;
export type PakTypeId = (typeof PakType)[keyof typeof PakType];

export const PakChunkType = {
  TEX_RGBA8: 1,
  TEX_RGBE: 2,
  TEX_RG16: 3,
  TEX_RGBA16F: 4,
  VOL_U8: 5,
  HEIGHT_U16: 6,
  SECTOR_F32: 7,
  MESH_F32: 8,
  JSON_META: 9,
  AUDIO_PCM16: 10,
} as const;
export type PakChunkTypeId = (typeof PakChunkType)[keyof typeof PakChunkType];

export interface PakHeader {
  magic: string;           // "APEXPAK1" (8 bytes ASCII)
  version: number;         // uint32 = 1
  pakType: PakTypeId;      // uint32 (1 = SKY, 2 = TRACK, 3 = VEHICLE)
  totalByteLength: number; // uint64 (safe integer number of bytes)
  entryCount: number;      // uint32
  sectorCount: number;     // uint32 (100 for Track .pak = 100 × 500m = 50.0 KM, 0 otherwise)
  assetId: string;         // char[32] UTF-8 null-stripped identifier
}

export interface PakTocEntry {
  name: string;            // char[32] UTF-8 null-stripped chunk name
  chunkType: PakChunkTypeId;
  width: number;           // uint32
  height: number;          // uint32
  depthOrItems: number;    // uint32
  byteOffset: number;      // uint64 (64-byte aligned)
  byteLength: number;      // uint64
}

export interface ParsedPakBundle {
  header: PakHeader;
  toc: PakTocEntry[];
  buffer: ArrayBuffer;
  chunks: Map<string, Uint8Array>;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// 2. BIOMES, SKIES, CIRCUITS, TIERS & GAME MODES
// ============================================================================

export type MotorsportTier = 0 | 1 | 2 | 3 | 4 | 5;

export type CircuitLengthKm = 2.0 | 5.0 | 8.0 | 12.0 | 24.0 | 50.0;

export const CIRCUIT_LENGTHS_KM: readonly CircuitLengthKm[] = [2.0, 5.0, 8.0, 12.0, 24.0, 50.0] as const;

export type CanonicalTrackBiomeId =
  | 'track_golden_gp'
  | 'track_neotokyo'
  | 'track_canyon'
  | 'track_alpine';

export type TrackBiomeAliasId = 'track_01' | 'track_02' | 'track_03' | 'track_04';

export type TrackBiomeId = CanonicalTrackBiomeId | TrackBiomeAliasId;

export type CanonicalSkyBiomeId =
  | 'sky_golden_hour'
  | 'sky_neotokyo_cyber'
  | 'sky_redrock_canyon'
  | 'sky_alpine_glacier';

export type SkyBiomeAliasId = 'sky_01' | 'sky_02' | 'sky_03' | 'sky_04';

export type SkyBiomeId = CanonicalSkyBiomeId | SkyBiomeAliasId;

export const SKY_BIOME_ALIASES: Readonly<Record<string, CanonicalSkyBiomeId>> = {
  sky_01: 'sky_golden_hour',
  sky_02: 'sky_neotokyo_cyber',
  sky_03: 'sky_redrock_canyon',
  sky_04: 'sky_alpine_glacier',
  sky_golden_hour: 'sky_golden_hour',
  sky_neotokyo_cyber: 'sky_neotokyo_cyber',
  sky_redrock_canyon: 'sky_redrock_canyon',
  sky_alpine_glacier: 'sky_alpine_glacier',
} as const;

export const TRACK_BIOME_ALIASES: Readonly<Record<string, CanonicalTrackBiomeId>> = {
  track_01: 'track_golden_gp',
  track_02: 'track_neotokyo',
  track_03: 'track_canyon',
  track_04: 'track_alpine',
  track_golden_gp: 'track_golden_gp',
  track_neotokyo: 'track_neotokyo',
  track_canyon: 'track_canyon',
  track_alpine: 'track_alpine',
} as const;

export type AIDifficultyTier =
  | 'EASY'
  | 'MEDIUM'
  | 'HARD'
  | 'VERY_HARD'
  | 'SUPER_HARD';

export type RaceFormatId =
  | 'SPRINT_1_LAP'
  | 'QUALIFIER_2_LAPS'
  | 'GRAND_PRIX_3_LAPS'
  | 'FEATURE_5_LAPS'
  | 'ENDURANCE_10_LAPS'
  | 'KNOCKOUT_ELIMINATION'
  | 'SOLO_TIME_ATTACK';

export type CameraMode = 'CHASE' | 'COCKPIT' | 'HOOD' | 'ORBIT' | 'SHOWROOM';

export type TacticalRampType =
  | 'SKYBRIDGE_OVERPASS'
  | 'PLASMA_BOOST_RING'
  | 'KINETIC_SHOCKWAVE';

export type VSyncHzOption = 0 | 120 | 144 | 240; // 0 = Uncapped

// ============================================================================
// 3. 3D SPLINE & TACTICAL RAMP INTERFACES
// ============================================================================

export type AcousticZoneId =
  | 'TUNNEL_VAULT'
  | 'CANYON_GORGE'
  | 'STADIUM_ARENA'
  | 'CYBER_URBAN'
  | 'OPEN_AIR';

export interface SplineFrame {
  s: number;                              // Arc-length in real meters (1 unit = 1m)
  position: Vec3Tuple;                    // World-space centerline position (x, y, z)
  tangent: Vec3Tuple;                     // Unit forward tangent vector T
  normal: Vec3Tuple;                      // Unit surface up normal vector U
  binormal: Vec3Tuple;                    // Unit lateral right binormal vector N = T × U
  bankAngleRad: number;                   // Banking angle in radians (up to 18 deg = 0.314159 rad)
  roadWidth: number;                      // Total drivable road width in meters (e.g., 20m)
  isTunnel: boolean;                      // True if inside an illuminated tunnel section
  crownCamber?: number;                   // Road crown camber slope (default ~0.015)
  acousticZone?: AcousticZoneId;          // Active spatial acoustic reflection zone
  reverbMix?: number;                     // Wet reverb reflection mix (0.08..0.68)
}

export interface SplineProjectionResult {
  alongOffset: number;                    // Closest arc-length s along spline (0 .. totalLength)
  lateralOffset: number;                  // Signed lateral distance along binormal N (meters)
  verticalOffset: number;                 // Signed vertical height above road surface along U (meters)
  frame: SplineFrame;                     // Interpolated Frenet-Serret frame at alongOffset
}

export interface ISplineProvider {
  getTotalLength(): number;
  getFrameAtArcLength(s: number): SplineFrame;
  getClosestSplinePoint(
    worldPos: Vec3Tuple,
    hintS?: number
  ): SplineProjectionResult;
}

export interface TacticalRampDescriptor {
  id: string;
  type: TacticalRampType;
  sectorIndex: number;
  sStart: number;                         // Ramp start arc-length (m)
  sEnd: number;                           // Ramp lip / skybridge end arc-length (m)
  chevronStartS: number;                  // 100m Holographic Approach Chevron start (sStart - 100)
  lateralFraction: number;                // Strictly in outer 25% lanes: |lateralFraction| in [0.75, 0.95]
  lateralOffsetMeters: number;            // Signed lateral offset from centerline (m)
  widthMeters: number;                    // Ramp width (m)
  deckHeightMeters: number;               // +12.0m for SKYBRIDGE_OVERPASS
  skybridgeLengthMeters: number;          // 250m..400m for SKYBRIDGE_OVERPASS
  boostMultiplier: number;                // 1.35x Skybridge, 1.42x Plasma Ring, 1.15x Shockwave
  nitroRefillPercent: number;             // +80% for PLASMA_BOOST_RING
  stuntBonusCredits: number;              // +2,500 CR for PLASMA_BOOST_RING
}

// ============================================================================
// 4. 34-VEHICLE ROSTER & LIVE COCKPIT TELEMETRY CONTRACTS
// ============================================================================

export type VehicleArchetype =
  | 'SCOOTER_BIKE'
  | 'HOT_HATCH_SEDAN'
  | 'SPORTS_COUPE_DRIFT'
  | 'OFFROAD_RALLY_TRUCK'
  | 'MUSCLE_PURSUIT'
  | 'HEAVY_COMMERCIAL'
  | 'OPEN_WHEEL_KART'
  | 'GT3_SUPERCAR'
  | 'HYPERCAR_PROTOTYPE'
  | 'SUPERSONIC_CONCEPT';

export interface VehicleSpec {
  index: number;                          // 1..34
  pakDir: string;                         // 'car_01' .. 'car_34'
  id: string;                             // 'scooter' .. 'jet_thrust'
  name: string;                           // Full display name from spec
  tier: MotorsportTier;                   // 0..5
  tierName: string;                       // e.g., 'Tier 0 — Starter Street & Club'
  winsRequired: number;                   // 0 for Tier 0 (Cars 1-3), 1..31 for Cars 4..34
  creditCost: number;                     // Early unlock CR price
  zeroToHundredSec: number;               // 1.65s .. 11.5s
  topSpeedKph: number;                    // 136 .. 485 KPH
  massKg: number;                         // 135 .. 8,400 KG
  archetype: VehicleArchetype | string;
  drivetrain: 'RWD' | 'FWD' | 'AWD' | 'JET';
  redlineRpm: number;                     // 6,500 .. 15,000 RPM
  gears: number;                          // 1 .. 8
  hasTransparentEngineBay: boolean;       // True on mid-engine supercars/hypercars
  defaultPrimaryColor: number;            // Hex RGB (e.g. 0xd92b2b)
  defaultAccentColor: number;             // Hex RGB (e.g. 0x111111)
}

export interface LiveCockpitTelemetry {
  speedKph: number;
  rpm: number;
  maxRpm: number;
  gear: number | 'N' | 'R';
  lapDeltaSec: number;
  currentLap: number;
  totalLaps: number;
  position: number;
  totalRacers: number;
  nitroPercent: number;
  drsActive: boolean;
  brakeTempCelsius: number;               // Heats up to 1,000°C bright orange under heavy braking
  sectorSplits: [number | null, number | null, number | null];
  lateralG?: number;
  longitudinalG?: number;
  tireTempCelsius?: number;
  tireTemps?: [number, number, number, number]; // FL, FR, RL, RR in °C
  surfaceGripStatus?: string;
  kerbRumbleIntensity?: number;
  slipstreamActive?: boolean;
  audioMuted?: boolean;
}

export interface RaceSessionConfig {
  vehicleId: string;
  liveryIndex: number;                    // 0..11 (12 PBR paint finishes)
  trackId: CanonicalTrackBiomeId;
  skyId: CanonicalSkyBiomeId;
  distanceKm: CircuitLengthKm;
  format: RaceFormatId;
  aiDifficulty: AIDifficultyTier;
}

// ============================================================================
// 5. GLOBAL E2E & RUNTIME INSPECTION CONTRACT (window.__APEX_GAME__)
// ============================================================================

export type GameLifecyclePhase = 'BOOT' | 'PADDOCK' | 'RACING' | 'POST_RACE';

export interface ApexGameStateSnapshot {
  phase: GameLifecyclePhase;
  activeTab: 1 | 2 | 3 | 4;
  selectedVehicleId: string;
  selectedLiveryIndex: number;
  selectedTrackId: string;
  selectedSkyId: string;
  selectedDistanceKm: CircuitLengthKm;
  selectedFormat: RaceFormatId;
  selectedAiDifficulty: AIDifficultyTier;
  cameraMode: CameraMode;
  totalWins: number;
  credits: number;
  driverXp: number;
  sandboxUnlockedAll: boolean;
  unlockedVehicleIds: string[];
  telemetry: LiveCockpitTelemetry;
  fps: number;
  vsyncHz: number;
  ssaaScale: number;
}

export interface ApexGameGlobal {
  getState(): ApexGameStateSnapshot;
  completeBoot(): void;
  selectTab(tab: 1 | 2 | 3 | 4): void;
  selectVehicle(vehicleId: string): boolean;
  selectLivery(liveryIndex: number): void;
  setCircuitConfig(config: Partial<{
    trackId: TrackBiomeId;
    skyId: SkyBiomeId;
    distanceKm: CircuitLengthKm;
    format: RaceFormatId;
    aiDifficulty: AIDifficultyTier;
  }>): void;
  toggleSandboxUnlockAll(forceState?: boolean): boolean;
  launchRace(): void;
  setCameraMode(mode: CameraMode): void;
  simulateWinRace(stuntBonusCr?: number): void;
  exportCurrentVehicleGlb(): Promise<ArrayBuffer>;
}

declare global {
  interface Window {
    __APEX_GAME__?: ApexGameGlobal;
  }
}
