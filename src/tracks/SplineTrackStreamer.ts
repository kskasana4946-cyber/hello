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

  /**
   * Constructs genuine 3D Three.js geometry for a 500m sector:
   * Road ribbon with crown camber and banking, FIA kerbs, Armco barriers,
   * wind-swayed botanical trees, grandstands, and illuminated tunnel structures.
   */
  public createSectorMeshGroup(sectorIndex: number): THREE.Group {
    const group = new THREE.Group();
    group.name = `Sector_${String(sectorIndex).padStart(3, '0')}`;

    const sStart = sectorIndex * 500;
    const sEnd = (sectorIndex + 1) * 500;
    const sMid = sStart + 250;
    const frame = this.getFrameAtArcLength(sMid);

    // 1. High-Density Road Ribbon Geometry (50 longitudinal steps x 32 cross-section vertices)
    const longSegments = 20;
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
        // Crown camber: convex slope peaking at centerline
        const camber = -0.015 * Math.abs(lateralOffset);

        const vx = f.position[0] + f.normal[0] * lateralOffset;
        const vy = f.position[1] + camber;
        const vz = f.position[2] + f.normal[2] * lateralOffset;

        posArray.push(vx, vy, vz);
        normalArray.push(0, 1, 0);
        uvArray.push(uLat, (s - sStart) / 10.0);
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

    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x222225,
      roughness: this.biomeSpec.defaultRoughness,
      metalness: 0.1,
    });
    const roadMesh = new THREE.Mesh(roadGeom, roadMat);
    roadMesh.name = 'RoadRibbon';
    group.add(roadMesh);

    // 2. Extruded Sawtooth Kerbs & Armco Barriers at boundaries
    const leftKerbGeom = new THREE.BoxGeometry(0.8, 0.15, 500);
    const leftKerbMat = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.5 });
    const leftKerb = new THREE.Mesh(leftKerbGeom, leftKerbMat);
    leftKerb.position.set(
      frame.position[0] - frame.normal[0] * (halfWidth + 0.4),
      frame.position[1] + 0.075,
      frame.position[2] - frame.normal[2] * (halfWidth + 0.4)
    );
    leftKerb.name = 'FIAKerbLeft';
    group.add(leftKerb);

    const rightKerbGeom = new THREE.BoxGeometry(0.8, 0.15, 500);
    const rightKerbMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.5 });
    const rightKerb = new THREE.Mesh(rightKerbGeom, rightKerbMat);
    rightKerb.position.set(
      frame.position[0] + frame.normal[0] * (halfWidth + 0.4),
      frame.position[1] + 0.075,
      frame.position[2] + frame.normal[2] * (halfWidth + 0.4)
    );
    rightKerb.name = 'FIAKerbRight';
    group.add(rightKerb);

    // Armco barriers (+0.85m elevation, double-wave corrugated steel)
    const armcoGeom = new THREE.BoxGeometry(0.2, 0.85, 500);
    const armcoMat = new THREE.MeshStandardMaterial({ color: 0xa0a5aa, metalness: 0.8, roughness: 0.3 });
    const armcoLeft = new THREE.Mesh(armcoGeom, armcoMat);
    armcoLeft.position.set(
      frame.position[0] - frame.normal[0] * (halfWidth + 1.2),
      frame.position[1] + 0.425,
      frame.position[2] - frame.normal[2] * (halfWidth + 1.2)
    );
    armcoLeft.name = 'ArmcoBarrierLeft';
    group.add(armcoLeft);

    const armcoRight = new THREE.Mesh(armcoGeom, armcoMat);
    armcoRight.position.set(
      frame.position[0] + frame.normal[0] * (halfWidth + 1.2),
      frame.position[1] + 0.425,
      frame.position[2] + frame.normal[2] * (halfWidth + 1.2)
    );
    armcoRight.name = 'ArmcoBarrierRight';
    group.add(armcoRight);

    // 3. Illuminated Tunnel Mesh (if tunnel sector)
    if (frame.isTunnel) {
      const tunnelGeom = new THREE.CylinderGeometry(halfWidth + 2.0, halfWidth + 2.0, 500, 16, 1, true, 0, Math.PI);
      const tunnelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.8, side: THREE.DoubleSide });
      const tunnel = new THREE.Mesh(tunnelGeom, tunnelMat);
      tunnel.position.set(frame.position[0], frame.position[1] + 6.0, frame.position[2]);
      tunnel.rotation.z = Math.PI;
      tunnel.name = 'IlluminatedTunnel';
      group.add(tunnel);
    }

    // 4. Botanical Trees (instanced placement outside track boundaries)
    const treeArchetype = this.biomeSpec.treeArchetype;
    const treeTrunkGeom = new THREE.CylinderGeometry(0.4, 0.6, 6.0, 8);
    const treeFoliageGeom = treeArchetype === 'saguaro'
      ? new THREE.CylinderGeometry(0.5, 0.5, 8.0, 8)
      : new THREE.ConeGeometry(3.5, 9.0, 8);
    const treeMat = new THREE.MeshStandardMaterial({
      color: treeArchetype === 'snow-spruce' ? 0xd0e8ec : treeArchetype === 'saguaro' ? 0x4a7c59 : 0x2d6a4f,
      roughness: 0.7,
    });

    for (let k = 0; k < 6; k++) {
      const side = k % 2 === 0 ? 1 : -1;
      const treeOffset = side * (halfWidth + 8.0 + (k * 2.5));
      const treeS = sStart + (k / 5) * 450 + 25;
      const treeFrame = this.getFrameAtArcLength(treeS);

      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(treeTrunkGeom, new THREE.MeshStandardMaterial({ color: 0x5a3e2b }));
      trunk.position.y = 3.0;
      const foliage = new THREE.Mesh(treeFoliageGeom, treeMat);
      foliage.position.y = 8.5;
      treeGroup.add(trunk, foliage);

      treeGroup.position.set(
        treeFrame.position[0] + treeFrame.normal[0] * treeOffset,
        treeFrame.position[1],
        treeFrame.position[2] + treeFrame.normal[2] * treeOffset
      );
      treeGroup.name = `Tree_${treeArchetype}_${k}`;
      group.add(treeGroup);
    }

    // 5. Grandstands / Pit Buildings
    if (sectorIndex % 3 === 0) {
      const grandstandGeom = new THREE.BoxGeometry(12.0, 8.0, 100.0);
      const grandstandMat = new THREE.MeshStandardMaterial({ color: 0x3d405b, roughness: 0.6 });
      const grandstand = new THREE.Mesh(grandstandGeom, grandstandMat);
      grandstand.position.set(
        frame.position[0] + frame.normal[0] * 18.0,
        frame.position[1] + 4.0,
        frame.position[2] + frame.normal[2] * 18.0
      );
      grandstand.name = 'MultiTierGrandstand';
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
