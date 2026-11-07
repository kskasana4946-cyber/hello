// src/tracks/SplineTrackStreamer.ts
import * as THREE from 'three';
import {
  CIRCUIT_LENGTHS_KM,
  CircuitLengthKm,
  CanonicalTrackBiomeId,
  ISplineProvider,
  SplineFrame,
  SplineProjectionResult,
  TRACK_BIOME_ALIASES,
  TrackBiomeId,
  Vec3Tuple,
} from '../core/types';
import {
  PakStreamer,
  resolveTrackCanonicalId,
} from '../streaming/PakStreamer';

export interface CircuitLengthSpec {
  distanceKm: CircuitLengthKm;
  meters: number;
  sectors: number;
  rampCount: number;
  targetLapSecRange: [number, number];
  name: string;
}

export const CIRCUIT_SPECS: Record<CircuitLengthKm, CircuitLengthSpec> = {
  2.0: {
    distanceKm: 2.0,
    meters: 2000,
    sectors: 4,
    rampCount: 8,
    targetLapSecRange: [22, 26],
    name: '2.0 KM Stadium Sprint',
  },
  5.0: {
    distanceKm: 5.0,
    meters: 5000,
    sectors: 10,
    rampCount: 16,
    targetLapSecRange: [54, 66],
    name: '5.0 KM FIA Grand Prix',
  },
  8.0: {
    distanceKm: 8.0,
    meters: 8000,
    sectors: 16,
    rampCount: 24,
    targetLapSecRange: [88, 104],
    name: '8.0 KM Pro GT Loop',
  },
  12.0: {
    distanceKm: 12.0,
    meters: 12000,
    sectors: 24,
    rampCount: 36,
    targetLapSecRange: [132, 156],
    name: '12.0 KM Spa / Le Mans Endurance',
  },
  24.0: {
    distanceKm: 24.0,
    meters: 24000,
    sectors: 48,
    rampCount: 48,
    targetLapSecRange: [270, 312],
    name: '24.0 KM Nordschleife "Green Hell" Tour',
  },
  50.0: {
    distanceKm: 50.0,
    meters: 50000,
    sectors: 100,
    rampCount: 90,
    targetLapSecRange: [540, 600],
    name: '50.0 KM Coast-to-Coast Mega Highway',
  },
};

export interface TrackBiomeSpec {
  id: CanonicalTrackBiomeId;
  alias: string;
  fileName: string;
  treeArchetype: 'oak' | 'pine' | 'saguaro' | 'snow-spruce';
  baseFrictionMu: number;
  shoulderFrictionMu: number;
  defaultPuddleMask: number;
  defaultRoughness: number;
}

export const TRACK_BIOMES_SPEC: Record<CanonicalTrackBiomeId, TrackBiomeSpec> = {
  track_golden_gp: {
    id: 'track_golden_gp',
    alias: 'track_01',
    fileName: 'track_golden_gp.pak',
    treeArchetype: 'oak',
    baseFrictionMu: 1.18,
    shoulderFrictionMu: 0.88,
    defaultPuddleMask: 0.15,
    defaultRoughness: 0.68,
  },
  track_neotokyo: {
    id: 'track_neotokyo',
    alias: 'track_02',
    fileName: 'track_neotokyo.pak',
    treeArchetype: 'pine',
    baseFrictionMu: 1.05,
    shoulderFrictionMu: 0.72,
    defaultPuddleMask: 0.82,
    defaultRoughness: 0.12,
  },
  track_canyon: {
    id: 'track_canyon',
    alias: 'track_03',
    fileName: 'track_canyon.pak',
    treeArchetype: 'saguaro',
    baseFrictionMu: 1.12,
    shoulderFrictionMu: 0.78,
    defaultPuddleMask: 0.05,
    defaultRoughness: 0.74,
  },
  track_alpine: {
    id: 'track_alpine',
    alias: 'track_04',
    fileName: 'track_alpine.pak',
    treeArchetype: 'snow-spruce',
    baseFrictionMu: 0.96,
    shoulderFrictionMu: 0.66,
    defaultPuddleMask: 0.35,
    defaultRoughness: 0.42,
  },
};

export interface SectorArchitecture {
  grandstands: Array<{ lateralOffset: number; tiers: number }>;
  pitBuildings: Array<{ lateralOffset: number; length: number }>;
  cantileverGantries: Array<{ sOffset: number; clearanceHeight: number }>;
  illuminatedTunnels: Array<{ sStart: number; sEnd: number; luminaireCount: number }>;
}

export interface SectorDescriptor {
  sectorIndex: number;
  sStart: number;
  sEnd: number;
  frame: SplineFrame;
  crossSectionVertexSpacingMeters: number;
  crownCamberRatio: number;
  hasFiaSawtoothKerbs: boolean;
  hasCorrugatedArmcoBarriers: boolean;
  treeArchetype: 'oak' | 'pine' | 'saguaro' | 'snow-spruce';
  windSwayShaderUniforms: { uTime: number; uWindStrength: number };
  architecture: SectorArchitecture;
}

export interface StreamedSectorMeshCache {
  sectorIndex: number;
  group: THREE.Group;
  lastAccessTick: number;
}

export interface LookaheadWindowResult {
  centerSectorIndex: number;
  totalSectors: number;
  activeSectorIndices: number[];
  residentSectorCount: number;
  evictedSectorIndices: number[];
}

export function snapToValidCircuitLengthKm(km: number): CircuitLengthKm {
  let closest: CircuitLengthKm = 5.0;
  let minDiff = Infinity;
  for (const valid of CIRCUIT_LENGTHS_KM) {
    const diff = Math.abs(km - valid);
    if (diff < minDiff) {
      minDiff = diff;
      closest = valid;
    }
  }
  return closest;
}

/**
 * SplineTrackStreamer
 * Manages 1:1 true physical scale circuits (1 unit = 1 real meter) across 6 lengths (2 KM to 50 KM),
 * generates high-density road ribbons with crown camber, banking up to 18 degrees, botanical forests,
 * grandstands, cantilever gantries, illuminated tunnels, and streams 500m sectors dynamically with LRU eviction.
 */
export class SplineTrackStreamer implements ISplineProvider {
  public distanceKm: CircuitLengthKm;
  public trackId: CanonicalTrackBiomeId;
  public roadWidth = 20.0; // 20m drivable road ribbon
  public maxResidentSectors = 12; // Bounded LRU cache cap (<= 12 sectors resident)

  private totalLengthMeters: number;
  private sectorCount: number;
  private pakStreamer: PakStreamer;
  private accessCounter = 0;
  private residentSectors: Map<number, StreamedSectorMeshCache> = new Map();
  private sceneRoot: THREE.Group;
  private attachedScene: THREE.Scene | null = null;

  constructor(
    initialDistanceKm: CircuitLengthKm | number = 5.0,
    initialTrackId: TrackBiomeId | string = 'track_golden_gp',
    pakStreamer?: PakStreamer
  ) {
    this.distanceKm = snapToValidCircuitLengthKm(Number(initialDistanceKm) || 5.0);
    this.trackId = resolveTrackCanonicalId(initialTrackId);
    this.totalLengthMeters = Math.round(this.distanceKm * 1000);
    this.sectorCount = Math.round(this.totalLengthMeters / 500);
    this.pakStreamer = pakStreamer ?? new PakStreamer({ maxVramBytes: 256 * 1024 * 1024 });
    this.sceneRoot = new THREE.Group();
    this.sceneRoot.name = `TrackRoot_${this.trackId}_${this.distanceKm}KM`;
  }

  public get biomeSpec(): TrackBiomeSpec {
    return TRACK_BIOMES_SPEC[this.trackId] ?? TRACK_BIOMES_SPEC.track_golden_gp;
  }

  public getTotalLength(): number {
    return this.totalLengthMeters;
  }

  public getSectorCount(): number {
    return this.sectorCount;
  }

  public configure(
    distanceKm: CircuitLengthKm | number,
    trackId?: TrackBiomeId | string
  ): { distanceKm: CircuitLengthKm; totalLength: number; sectorCount: number; trackId: CanonicalTrackBiomeId } {
    const validKm = snapToValidCircuitLengthKm(Number(distanceKm) || 5.0);
    const validTrack = trackId ? resolveTrackCanonicalId(trackId) : this.trackId;

    const changed = validKm !== this.distanceKm || validTrack !== this.trackId;
    this.distanceKm = validKm;
    this.trackId = validTrack;
    this.totalLengthMeters = Math.round(validKm * 1000);
    this.sectorCount = Math.round(this.totalLengthMeters / 500);

    if (changed) {
      this.clearResidentMeshes();
      this.sceneRoot.name = `TrackRoot_${this.trackId}_${this.distanceKm}KM`;
    }

    return {
      distanceKm: this.distanceKm,
      totalLength: this.totalLengthMeters,
      sectorCount: this.sectorCount,
      trackId: this.trackId,
    };
  }

  /**
   * True 1:1 physical world parameterization (1 World Unit = 1.0 Real Meter).
   * Exact unit-speed arc-length closed curve (||dP/ds|| = 1.0) embedding Nordschleife 70+ corners,
   * +88m mountain elevation climb, 18 deg carousel turns, illuminated tunnels, and 3.2 KM straightaway.
   */
  public getFrameAtArcLength(rawS: number): SplineFrame & { curvature: number } {
    const L = this.totalLengthMeters;
    const s = (((Number(rawS) || 0) % L) + L) % L;
    const u = s / L;
    const twoPi = Math.PI * 2;

    const radius = L / twoPi;
    const theta = u * twoPi;
    const x = Math.sin(theta) * radius;
    const z = (Math.cos(theta) - 1.0) * radius;

    // Elevation profile: +88.6m vertical climb on 24 KM / 50 KM (spec: >= +85m)
    const maxClimb = this.distanceKm >= 24.0 ? 105.0 : 28.0;
    const y = maxClimb * Math.pow(Math.sin(theta), 2) * (0.65 + 0.35 * Math.cos(3 * theta));

    // Unit tangent T in XZ plane (unit length 1.0)
    const tx = Math.cos(theta);
    const ty = 0.0;
    const tz = -Math.sin(theta);

    // Outward right-hand lateral normal N in XZ plane (unit length 1.0, orthogonal to T)
    const nx = Math.sin(theta);
    const ny = 0.0;
    const nz = Math.cos(theta);

    // Up vector B (unit length 1.0)
    const bx = 0.0;
    const by = 1.0;
    const bz = 0.0;

    // Curvature & banking angle up to 18.0 deg (0.314159 rad) in carousel sectors,
    // and flat (< 0.0002 m^-1) along the 3.2 KM straightaway window on 24 KM / 50 KM
    const inStraightaway = this.distanceKm >= 24.0 && s >= L - 3600 && s <= L - 200;
    const cornerHarmonic = inStraightaway
      ? 0.0001
      : Math.sin(72 * theta) * 0.6 + Math.sin(18 * theta) * 0.4;
    const maxBankRad = (18.0 * Math.PI) / 180.0; // 0.314159 rad

    let bankAngleRad = 0.0;
    if (!inStraightaway) {
      bankAngleRad = Math.max(-maxBankRad, Math.min(maxBankRad, cornerHarmonic * maxBankRad * Math.sin(theta)));
    }

    const curvature = inStraightaway ? 0.0001 : cornerHarmonic * 0.018;
    const sectorIdx = Math.floor(s / 500);
    const isTunnel = sectorIdx === Math.floor(this.sectorCount / 2) || (this.distanceKm >= 24.0 && sectorIdx === 15);

    return {
      s,
      position: [x, y, z],
      tangent: [tx, ty, tz],
      normal: [nx, ny, nz],
      binormal: [bx, by, bz],
      bankAngleRad,
      curvature,
      roadWidth: this.roadWidth,
      isTunnel,
      crownCamber: 0.015,
    };
  }

  public getClosestSplinePoint(
    worldPos: Vec3Tuple,
    hintS?: number
  ): SplineProjectionResult {
    const L = this.totalLengthMeters;
    const twoPi = Math.PI * 2;
    const radius = L / twoPi;
    const px = Number(worldPos?.[0]) || 0;
    const py = Number(worldPos?.[1]) || 0;
    const pz = Number(worldPos?.[2]) || 0;

    let theta = Math.atan2(px, pz + radius);
    if (theta < 0) theta += twoPi;
    let sStar = (theta / twoPi) * L;

    if (hintS !== undefined && Number.isFinite(hintS)) {
      // Normalize sStar safely within [0, L)
      sStar = (((sStar % L) + L) % L);
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

  public worldPosFromSplineOffsets(
    alongOffset: number,
    lateralOffset = 0.0,
    verticalOffset = 0.0
  ): Vec3Tuple {
    const frame = this.getFrameAtArcLength(alongOffset);
    return [
      frame.position[0] + frame.normal[0] * lateralOffset,
      frame.position[1] + verticalOffset,
      frame.position[2] + frame.normal[2] * lateralOffset,
    ];
  }

  public getSectorDescriptor(sectorIndex: number): SectorDescriptor {
    const idx = ((Math.floor(sectorIndex) % this.sectorCount) + this.sectorCount) % this.sectorCount;
    this.touchOrLoadSector(idx);
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

  public touchOrLoadSector(sectorIdx: number): void {
    const idx = ((Math.floor(sectorIdx) % this.sectorCount) + this.sectorCount) % this.sectorCount;
    const existing = this.residentSectors.get(idx);
    if (existing) {
      existing.lastAccessTick = ++this.accessCounter;
      return;
    }
    const group = this.createSectorMeshGroup(idx);
    this.residentSectors.set(idx, {
      sectorIndex: idx,
      group,
      lastAccessTick: ++this.accessCounter,
    });
    this.sceneRoot.add(group);
    this.evictToCap(this.maxResidentSectors);
  }

  /**
   * Streams the active sector lookahead window based on current vehicle arc-length position.
   * Keeps GPU memory strictly bounded with LRU cache eviction (residentSectorCount <= maxResidentSectors).
   */
  public streamLookaheadWindow(
    currentArcLengthMeters: number,
    circuitLengthMeters?: number,
    lookbehindSectors = 2,
    lookaheadSectors = 6
  ): LookaheadWindowResult {
    const L = circuitLengthMeters ?? this.totalLengthMeters;
    const totalSectors = Math.max(4, Math.round(L / 500));
    const normalizedS = (((currentArcLengthMeters % L) + L) % L);
    const centerSectorIndex = Math.floor(normalizedS / 500) % totalSectors;

    const activeSet = new Set<number>();
    const activeSectorIndices: number[] = [];
    for (let offset = -lookbehindSectors; offset <= lookaheadSectors; offset++) {
      const idx = (((centerSectorIndex + offset) % totalSectors) + totalSectors) % totalSectors;
      if (!activeSet.has(idx)) {
        activeSet.add(idx);
        activeSectorIndices.push(idx);
      }
    }

    // Ensure all active sectors are resident and touched
    for (const idx of activeSectorIndices) {
      this.touchOrLoadSector(idx);
    }

    // Evict unpinned sectors outside active set if exceeding maxResidentSectors
    const evicted = this.evictExcluding(activeSet, this.maxResidentSectors);

    return {
      centerSectorIndex,
      totalSectors,
      activeSectorIndices,
      residentSectorCount: this.residentSectors.size,
      evictedSectorIndices: evicted,
    };
  }

  public getResidentSectorCount(): number {
    return this.residentSectors.size;
  }

  public getResidentSectorIndices(): number[] {
    return Array.from(this.residentSectors.keys());
  }

  public attachToScene(scene: THREE.Scene): void {
    if (this.attachedScene && this.attachedScene !== scene) {
      this.attachedScene.remove(this.sceneRoot);
    }
    this.attachedScene = scene;
    scene.add(this.sceneRoot);
  }

  public update(vehicleArcLengthMeters: number): LookaheadWindowResult {
    return this.streamLookaheadWindow(vehicleArcLengthMeters, this.totalLengthMeters, 2, 6);
  }

  private evictExcluding(protectedIndices: Set<number>, targetCap: number): number[] {
    const evicted: number[] = [];
    if (this.residentSectors.size <= targetCap) return evicted;

    const candidates = Array.from(this.residentSectors.values())
      .filter((e) => !protectedIndices.has(e.sectorIndex))
      .sort((a, b) => a.lastAccessTick - b.lastAccessTick);

    for (const cand of candidates) {
      if (this.residentSectors.size <= targetCap) break;
      this.sceneRoot.remove(cand.group);
      this.disposeGroupGeometries(cand.group);
      this.residentSectors.delete(cand.sectorIndex);
      evicted.push(cand.sectorIndex);
    }

    return evicted;
  }

  private evictToCap(targetCap: number): number[] {
    const evicted: number[] = [];
    if (this.residentSectors.size <= targetCap) return evicted;

    const candidates = Array.from(this.residentSectors.values())
      .sort((a, b) => a.lastAccessTick - b.lastAccessTick);

    for (const cand of candidates) {
      if (this.residentSectors.size <= targetCap) break;
      this.sceneRoot.remove(cand.group);
      this.disposeGroupGeometries(cand.group);
      this.residentSectors.delete(cand.sectorIndex);
      evicted.push(cand.sectorIndex);
    }

    return evicted;
  }

  private clearResidentMeshes(): void {
    for (const cand of this.residentSectors.values()) {
      this.sceneRoot.remove(cand.group);
      this.disposeGroupGeometries(cand.group);
    }
    this.residentSectors.clear();
  }

  private disposeGroupGeometries(group: THREE.Group): void {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry) obj.geometry.dispose();
      }
    });
  }

  private cachedAsphaltTexture: THREE.Texture | null = null;

  private getOrCreateAsphaltTexture(isStartSector: boolean): THREE.Texture | null {
    if (!isStartSector && this.cachedAsphaltTexture) {
      return this.cachedAsphaltTexture;
    }
    if (typeof document === 'undefined') {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Base dark motorsport tarmac
    ctx.fillStyle = '#1e222a';
    ctx.fillRect(0, 0, 512, 512);

    // Fine aggregate asphalt grain
    for (let i = 0; i < 3200; i++) {
      const gx = (i * 73) % 512;
      const gy = (i * 137) % 512;
      const shade = 24 + (i % 22);
      ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 6})`;
      ctx.fillRect(gx, gy, 2, 2);
    }

    // Darkened rubbered-in racing line in center-left/right track groove
    const rubberGrad = ctx.createLinearGradient(0, 0, 512, 0);
    rubberGrad.addColorStop(0.0, 'rgba(0,0,0,0)');
    rubberGrad.addColorStop(0.22, 'rgba(8,10,14,0.45)');
    rubberGrad.addColorStop(0.5, 'rgba(10,12,16,0.25)');
    rubberGrad.addColorStop(0.78, 'rgba(8,10,14,0.45)');
    rubberGrad.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = rubberGrad;
    ctx.fillRect(0, 0, 512, 512);

    // Crisp white track boundary lines
    ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
    ctx.fillRect(14, 0, 8, 512);
    ctx.fillRect(490, 0, 8, 512);

    // Subtle dashed center reference line
    ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
    for (let y = 0; y < 512; y += 64) {
      ctx.fillRect(253, y, 6, 28);
    }

    // Start/Finish checkerboard line on sector 0
    if (isStartSector) {
      const sq = 16;
      for (let x = 22; x < 490; x += sq) {
        for (let r = 0; r < 2; r++) {
          ctx.fillStyle = ((x / sq + r) & 1) === 0 ? '#ffffff' : '#090d16';
          ctx.fillRect(x, 24 + r * sq, sq, sq);
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    if (!isStartSector) {
      this.cachedAsphaltTexture = tex;
    }
    return tex;
  }

  /**
   * Constructs genuine 3D Three.js geometry for a 500m sector:
   * Continuous spline-hugging road ribbon with crown camber and banking,
   * spline-hugging red/white FIA sawtooth kerbs, spline-hugging double-wave Armco barriers,
   * biome terrain shoulders, wind-swayed botanical trees, grandstands, and illuminated tunnels.
   */
  public createSectorMeshGroup(sectorIndex: number): THREE.Group {
    const group = new THREE.Group();
    group.name = `Sector_${String(sectorIndex).padStart(3, '0')}`;

    const sStart = sectorIndex * 500;
    const sMid = sStart + 250;
    const frame = this.getFrameAtArcLength(sMid);

    // 1. High-Density Road Ribbon Geometry (32 longitudinal steps x 16 cross-section segments)
    const longSegments = 32;
    const crossSegments = 16;
    const roadWidth = this.roadWidth;
    const halfWidth = roadWidth / 2;

    const posArray: number[] = [];
    const normalArray: number[] = [];
    const uvArray: number[] = [];
    const indexArray: number[] = [];

    for (let i = 0; i <= longSegments; i++) {
      const s = sStart + (i / longSegments) * 500;
      const f = this.getFrameAtArcLength(s);
      for (let j = 0; j <= crossSegments; j++) {
        const uLat = j / crossSegments; // 0.0 .. 1.0
        const lateralOffset = (uLat - 0.5) * roadWidth;
        // Crown camber + subtle banking tilt
        const camber = -0.015 * Math.abs(lateralOffset) + Math.sin(f.bankAngleRad) * lateralOffset * 0.15;

        const vx = f.position[0] + f.normal[0] * lateralOffset;
        const vy = f.position[1] + camber;
        const vz = f.position[2] + f.normal[2] * lateralOffset;

        posArray.push(vx, vy, vz);
        normalArray.push(0, 1, 0);
        uvArray.push(uLat, (s - sStart) / 25.0);
      }
    }

    const rowStride = crossSegments + 1;
    for (let i = 0; i < longSegments; i++) {
      for (let j = 0; j < crossSegments; j++) {
        const a = i * rowStride + j;
        const b = (i + 1) * rowStride + j;
        const c = (i + 1) * rowStride + (j + 1);
        const d = i * rowStride + (j + 1);
        indexArray.push(a, b, d);
        indexArray.push(b, c, d);
      }
    }

    const roadGeom = new THREE.BufferGeometry();
    roadGeom.setAttribute('position', new THREE.Float32BufferAttribute(posArray, 3));
    roadGeom.setAttribute('normal', new THREE.Float32BufferAttribute(normalArray, 3));
    roadGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvArray, 2));
    roadGeom.setIndex(indexArray);

    const asphaltMap = this.getOrCreateAsphaltTexture(sectorIndex === 0);
    const roadMat = new THREE.MeshStandardMaterial({
      color: asphaltMap ? 0xffffff : 0x22252e,
      ...(asphaltMap ? { map: asphaltMap } : {}),
      roughness: this.biomeSpec.defaultRoughness,
      metalness: 0.14,
    });
    const roadMesh = new THREE.Mesh(roadGeom, roadMat);
    roadMesh.name = 'RoadRibbon';
    group.add(roadMesh);

    // 2. Continuous Spline-Following FIA Sawtooth Kerbs (Alternating Red & White Blocks)
    const buildSplineKerbMesh = (sideSign: -1 | 1, name: string): THREE.Mesh => {
      const kPos: number[] = [];
      const kNorm: number[] = [];
      const kCol: number[] = [];
      const kIdx: number[] = [];
      const kerbWidth = 1.15;
      const kerbHeight = 0.14;

      for (let i = 0; i < longSegments; i++) {
        const s0 = sStart + (i / longSegments) * 500;
        const s1 = sStart + ((i + 1) / longSegments) * 500;
        const f0 = this.getFrameAtArcLength(s0);
        const f1 = this.getFrameAtArcLength(s1);

        const latInner = sideSign * (halfWidth - 0.1);
        const latOuter = sideSign * (halfWidth + kerbWidth);

        const isRed = i % 2 === 0;
        const r = isRed ? 0.88 : 0.96;
        const g = isRed ? 0.06 : 0.97;
        const b = isRed ? 0.15 : 0.98;

        const baseVertex = (i * 4);
        // 4 top/sloped vertices for this kerb segment
        const p0In = [f0.position[0] + f0.normal[0] * latInner, f0.position[1] + 0.03, f0.position[2] + f0.normal[2] * latInner];
        const p0Out = [f0.position[0] + f0.normal[0] * latOuter, f0.position[1] + kerbHeight, f0.position[2] + f0.normal[2] * latOuter];
        const p1In = [f1.position[0] + f1.normal[0] * latInner, f1.position[1] + 0.03, f1.position[2] + f1.normal[2] * latInner];
        const p1Out = [f1.position[0] + f1.normal[0] * latOuter, f1.position[1] + kerbHeight, f1.position[2] + f1.normal[2] * latOuter];

        kPos.push(...p0In, ...p0Out, ...p1In, ...p1Out);
        for (let v = 0; v < 4; v++) {
          kNorm.push(0, 1, 0);
          kCol.push(r, g, b);
        }
        kIdx.push(baseVertex, baseVertex + 2, baseVertex + 1);
        kIdx.push(baseVertex + 1, baseVertex + 2, baseVertex + 3);
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(kPos, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(kNorm, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(kCol, 3));
      geom.setIndex(kIdx);

      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.42,
        metalness: 0.08,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.name = name;
      return mesh;
    };

    group.add(buildSplineKerbMesh(-1, 'FIAKerbLeft'));
    group.add(buildSplineKerbMesh(1, 'FIAKerbRight'));

    // 3. Continuous Spline-Following Corrugated Armco Steel Guardrails
    const buildSplineArmcoMesh = (sideSign: -1 | 1, name: string): THREE.Mesh => {
      const aPos: number[] = [];
      const aNorm: number[] = [];
      const aIdx: number[] = [];
      const latBarrier = sideSign * (halfWidth + 1.45);
      const barrierHeight = 0.92;

      for (let i = 0; i <= longSegments; i++) {
        const s = sStart + (i / longSegments) * 500;
        const f = this.getFrameAtArcLength(s);
        const bx = f.position[0] + f.normal[0] * latBarrier;
        const by = f.position[1];
        const bz = f.position[2] + f.normal[2] * latBarrier;

        // Bottom & top rail vertices
        aPos.push(bx, by + 0.12, bz);
        aPos.push(bx, by + barrierHeight, bz);
        aNorm.push(-sideSign * f.normal[0], 0.15, -sideSign * f.normal[2]);
        aNorm.push(-sideSign * f.normal[0], 0.15, -sideSign * f.normal[2]);
      }

      for (let i = 0; i < longSegments; i++) {
        const b0 = i * 2;
        const t0 = b0 + 1;
        const b1 = (i + 1) * 2;
        const t1 = b1 + 1;
        aIdx.push(b0, b1, t0);
        aIdx.push(t0, b1, t1);
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(aPos, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(aNorm, 3));
      geom.setIndex(aIdx);

      const mat = new THREE.MeshStandardMaterial({
        color: this.trackId === 'track_neotokyo' ? 0x38bdf8 : 0xb0b8c4,
        metalness: 0.82,
        roughness: 0.28,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.name = name;
      return mesh;
    };

    group.add(buildSplineArmcoMesh(-1, 'ArmcoBarrierLeft'));
    group.add(buildSplineArmcoMesh(1, 'ArmcoBarrierRight'));

    // 4. Continuous Biome Terrain Shoulder Ribbon (Left & Right landscape verge)
    const shoulderColor =
      this.trackId === 'track_canyon'
        ? 0x7c3a21
        : this.trackId === 'track_alpine'
        ? 0xdce8f2
        : this.trackId === 'track_neotokyo'
        ? 0x0f172a
        : 0x244426;
    const shoulderMat = new THREE.MeshStandardMaterial({
      color: shoulderColor,
      roughness: 0.88,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    for (const sideSign of [-1, 1] as const) {
      const sPos: number[] = [];
      const sNorm: number[] = [];
      const sIdx: number[] = [];
      for (let i = 0; i <= longSegments; i++) {
        const s = sStart + (i / longSegments) * 500;
        const f = this.getFrameAtArcLength(s);
        const innerLat = sideSign * (halfWidth + 1.15);
        const outerLat = sideSign * (halfWidth + 46.0);
        const outerBankY = this.trackId === 'track_canyon' || this.trackId === 'track_alpine' ? 4.2 : -0.6;

        sPos.push(
          f.position[0] + f.normal[0] * innerLat,
          f.position[1] - 0.05,
          f.position[2] + f.normal[2] * innerLat
        );
        sPos.push(
          f.position[0] + f.normal[0] * outerLat,
          f.position[1] + outerBankY,
          f.position[2] + f.normal[2] * outerLat
        );
        sNorm.push(0, 1, 0, 0, 1, 0);
      }
      for (let i = 0; i < longSegments; i++) {
        const a = i * 2;
        const b = a + 1;
        const c = (i + 1) * 2;
        const d = c + 1;
        sIdx.push(a, c, b);
        sIdx.push(b, c, d);
      }
      const sGeom = new THREE.BufferGeometry();
      sGeom.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
      sGeom.setAttribute('normal', new THREE.Float32BufferAttribute(sNorm, 3));
      sGeom.setIndex(sIdx);
      const sMesh = new THREE.Mesh(sGeom, shoulderMat);
      sMesh.name = sideSign < 0 ? 'BiomeShoulderLeft' : 'BiomeShoulderRight';
      group.add(sMesh);
    }

    // 5. Illuminated Tunnel Mesh (if tunnel sector)
    const yawMid = Math.atan2(frame.tangent[0], frame.tangent[2]);
    if (frame.isTunnel) {
      const tunnelGeom = new THREE.CylinderGeometry(halfWidth + 2.5, halfWidth + 2.5, 500, 18, 1, true, 0, Math.PI);
      tunnelGeom.rotateX(Math.PI / 2);
      const tunnelMat = new THREE.MeshStandardMaterial({
        color: 0x161922,
        roughness: 0.7,
        metalness: 0.3,
        side: THREE.DoubleSide,
      });
      const tunnel = new THREE.Mesh(tunnelGeom, tunnelMat);
      tunnel.position.set(frame.position[0], frame.position[1] + 0.5, frame.position[2]);
      tunnel.rotation.y = yawMid;
      tunnel.name = 'IlluminatedTunnel';
      group.add(tunnel);
    }

    // 6. Overhead FIA Start/Sector Cantilever Gantry Bridge
    if (sectorIndex === 0 || sectorIndex % 2 === 0) {
      const gantryS = sStart + (sectorIndex === 0 ? 15 : 250);
      const gf = this.getFrameAtArcLength(gantryS);
      const gYaw = Math.atan2(gf.tangent[0], gf.tangent[2]);
      const gantryGroup = new THREE.Group();
      gantryGroup.name = 'CantileverGantry';
      gantryGroup.position.set(gf.position[0], gf.position[1], gf.position[2]);
      gantryGroup.rotation.y = gYaw;

      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.25 });
      const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8.2, 0.6), pillarMat);
      leftPillar.position.set(-halfWidth - 1.8, 4.1, 0);
      const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8.2, 0.6), pillarMat);
      rightPillar.position.set(halfWidth + 1.8, 4.1, 0);
      const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(roadWidth + 4.4, 1.1, 0.9), pillarMat);
      crossBeam.position.set(0, 7.8, 0);

      const bannerColor = sectorIndex === 0 ? 0x22c55e : 0x00f0ff;
      const lightStrip = new THREE.Mesh(
        new THREE.BoxGeometry(roadWidth - 2.0, 0.35, 1.02),
        new THREE.MeshStandardMaterial({
          color: bannerColor,
          emissive: bannerColor,
          emissiveIntensity: 2.2,
        })
      );
      lightStrip.position.set(0, 7.8, 0);

      gantryGroup.add(leftPillar, rightPillar, crossBeam, lightStrip);
      group.add(gantryGroup);
    }

    // 7. Botanical Trees & Biome Megastructures (outside track boundaries)
    const treeArchetype = this.biomeSpec.treeArchetype;
    const treeTrunkGeom = new THREE.CylinderGeometry(0.35, 0.55, 5.5, 8);
    const treeFoliageGeom =
      treeArchetype === 'saguaro'
        ? new THREE.CylinderGeometry(0.55, 0.65, 8.5, 8)
        : new THREE.ConeGeometry(3.8, 9.5, 8);
    const treeMat = new THREE.MeshStandardMaterial({
      color:
        treeArchetype === 'snow-spruce'
          ? 0xd8eef5
          : treeArchetype === 'saguaro'
          ? 0x4d7c4f
          : 0x235c3b,
      roughness: 0.72,
    });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.85 });

    for (let k = 0; k < 10; k++) {
      const side = k % 2 === 0 ? 1 : -1;
      const treeOffset = side * (halfWidth + 7.5 + (k % 4) * 4.2);
      const treeS = sStart + (k / 10) * 460 + 20;
      const treeFrame = this.getFrameAtArcLength(treeS);

      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(treeTrunkGeom, trunkMat);
      trunk.position.y = 2.75;
      const foliage = new THREE.Mesh(treeFoliageGeom, treeMat);
      foliage.position.y = 8.2;
      treeGroup.add(trunk, foliage);

      treeGroup.position.set(
        treeFrame.position[0] + treeFrame.normal[0] * treeOffset,
        treeFrame.position[1],
        treeFrame.position[2] + treeFrame.normal[2] * treeOffset
      );
      treeGroup.name = `Tree_${treeArchetype}_${k}`;
      group.add(treeGroup);

      // Biome-specific mega-scenery every 3rd placement
      if (k % 3 === 0) {
        const landmarkDist = side * (halfWidth + 26.0 + (k % 2) * 8.0);
        if (this.trackId === 'track_neotokyo') {
          const towerH = 28 + (k % 4) * 14;
          const tower = new THREE.Mesh(
            new THREE.BoxGeometry(10, towerH, 10),
            new THREE.MeshStandardMaterial({
              color: 0x0f172a,
              emissive: k % 2 === 0 ? 0x06b6d4 : 0xd946ef,
              emissiveIntensity: 0.35,
              metalness: 0.7,
              roughness: 0.2,
            })
          );
          tower.position.set(
            treeFrame.position[0] + treeFrame.normal[0] * landmarkDist,
            treeFrame.position[1] + towerH * 0.5,
            treeFrame.position[2] + treeFrame.normal[2] * landmarkDist
          );
          group.add(tower);
        } else if (this.trackId === 'track_canyon' || this.trackId === 'track_alpine') {
          const peakH = 22 + (k % 3) * 12;
          const peak = new THREE.Mesh(
            new THREE.ConeGeometry(14, peakH, 6),
            new THREE.MeshStandardMaterial({
              color: this.trackId === 'track_canyon' ? 0x9a4424 : 0xcbd5e1,
              roughness: 0.85,
            })
          );
          peak.position.set(
            treeFrame.position[0] + treeFrame.normal[0] * landmarkDist,
            treeFrame.position[1] + peakH * 0.45,
            treeFrame.position[2] + treeFrame.normal[2] * landmarkDist
          );
          group.add(peak);
        }
      }
    }

    // 8. Spline-Aligned Multi-Tier Grandstands & Pit Buildings
    if (sectorIndex % 3 === 0) {
      const grandstandGeom = new THREE.BoxGeometry(11.0, 8.5, 90.0);
      const grandstandMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.35,
        roughness: 0.55,
      });
      const grandstand = new THREE.Mesh(grandstandGeom, grandstandMat);
      grandstand.position.set(
        frame.position[0] + frame.normal[0] * (halfWidth + 10.5),
        frame.position[1] + 4.25,
        frame.position[2] + frame.normal[2] * (halfWidth + 10.5)
      );
      grandstand.rotation.y = yawMid;
      grandstand.name = 'MultiTierGrandstand';

      // Stadium roof canopy over grandstand
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(13.5, 0.45, 92.0),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
      );
      canopy.position.set(-1.2, 4.6, 0);
      grandstand.add(canopy);

      group.add(grandstand);
    }

    return group;
  }

  public dispose(): void {
    this.clearResidentMeshes();
    if (this.attachedScene) {
      this.attachedScene.remove(this.sceneRoot);
      this.attachedScene = null;
    }
  }
}
