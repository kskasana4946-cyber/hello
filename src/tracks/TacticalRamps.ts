// src/tracks/TacticalRamps.ts
import * as THREE from 'three';
import {
  TacticalRampType,
  Vec3Tuple,
} from '../core/types';
import {
  CIRCUIT_SPECS,
  SplineTrackStreamer,
} from './SplineTrackStreamer';

export interface TacticalRampZone {
  id: string;
  index: number;
  type: TacticalRampType;
  laneSide: 'RIGHT_OUTER' | 'LEFT_OUTER';
  lateralOffset: number;
  rampWidth: number;
  sStart: number;
  sEnd: number;
  deckLength: number;
  deckHeightMeters: number;
  overdriveBoostMultiplier: number;
  chevronStart: number;
  chevronEnd: number;
  chevronLengthMeters: number;
  ringCenterHeightMeters: number;
  ringRadiusMeters: number;
  nitroRefillPercent: number;
  hyperVelocityMultiplier: number;
  hyperVelocityDurationSec: number;
  stuntBonusCredits: number;
  shockwaveThresholdKph: number;
  shockwaveSpeedBoostMultiplier: number;
  shockwaveBlastRadiusMeters: number;
  meshGroup?: THREE.Group;
}

export interface PlasmaBoostTriggerResult {
  jumpId: string;
  nitroPercent: number;
  boostMultiplier: number;
  hyperSurgeRemainingSec: number;
  creditsAwarded: number;
  alreadyTriggered?: boolean;
}

export interface ShockwaveRivalTarget {
  id: string;
  distanceMeters: number;
  lateralDeltaMeters: number;
}

export interface BlastedRivalResult {
  id: string;
  blasted: boolean;
  deltaLateralVel: number;
  distanceMeters: number;
}

export interface ShockwaveLandingResult {
  shockwaveFired: boolean;
  slowdownPercent: number;
  postTouchdownSpeedKph: number;
  maxRingRadiusMeters: number;
  blastedRivals: BlastedRivalResult[];
}

/**
 * TacticalRamps
 * High-Reward Tactical Ramps, Skybridges & Shockwave Landings.
 * Ramps placed strictly in outer 25% lanes (|d| in [0.375*W, 0.48*W]), leaving the central 75%
 * highway completely clear with 100m holographic approach chevrons preceding each launch zone.
 */
export class TacticalRamps {
  public splineStreamer: SplineTrackStreamer;
  public rampZones: TacticalRampZone[] = [];
  private triggeredPlasmaJumps: Set<string> = new Set();
  private sceneRoot: THREE.Group;
  private attachedScene: THREE.Scene | null = null;

  constructor(splineStreamer?: SplineTrackStreamer) {
    this.splineStreamer = splineStreamer ?? new SplineTrackStreamer();
    this.sceneRoot = new THREE.Group();
    this.sceneRoot.name = 'TacticalRampsRoot';
    this.rebuildRamps();
  }

  public rebuildRamps(): TacticalRampZone[] {
    const L = this.splineStreamer.getTotalLength();
    const distKm = this.splineStreamer.distanceKm;
    const count = CIRCUIT_SPECS[distKm]?.rampCount || 16;
    const W = this.splineStreamer.roadWidth;
    const spacing = L / count;
    const types: TacticalRampType[] = [
      'SKYBRIDGE_OVERPASS',
      'PLASMA_BOOST_RING',
      'KINETIC_SHOCKWAVE',
    ];

    this.rampZones = [];
    this.triggeredPlasmaJumps.clear();

    for (let i = 0; i < count; i++) {
      const type = types[i % 3];
      const side = i % 2 === 0 ? 1 : -1;
      // Strictly in outer 25% lanes: |lateralOffset| = 0.42 * W in [0.375*W, 0.48*W]
      const lateralOffset = side * 0.42 * W;

      // Spacing schedule guaranteed to have zero overlap (sStart[i+1] > sEnd[i])
      const sStart = type === 'SKYBRIDGE_OVERPASS'
        ? Math.round((i * spacing + 10.0) * 10) / 10
        : Math.round(((i + 0.1) * spacing + 15.0) * 10) / 10;

      // 250m - 400m deck length for Skybridge Overpasses, 45m for standard ramps
      const deckLen = type === 'SKYBRIDGE_OVERPASS'
        ? Math.min(400.0, Math.max(250.0, Math.min(320.0, spacing * 0.62)))
        : 45.0;

      const sEnd = Math.min(L - 5.0, sStart + deckLen);
      const chevronStart = (((sStart - 100.0) % L) + L) % L;

      const ramp: TacticalRampZone = {
        id: `ramp_${i + 1}`,
        index: i,
        type,
        laneSide: side > 0 ? 'RIGHT_OUTER' : 'LEFT_OUTER',
        lateralOffset,
        rampWidth: 0.1 * W, // 2.0m width
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
      };

      this.rampZones.push(ramp);
    }

    if (this.attachedScene) {
      this.rebuild3DMeshes();
    }

    return this.rampZones;
  }

  public getRamps(): TacticalRampZone[] {
    return this.rampZones;
  }

  public registerCustomRamp(rampDef: Partial<TacticalRampZone>): TacticalRampZone & { snappedToOuterLane: boolean } {
    const W = this.splineStreamer.roadWidth;
    const minOuterOffset = 0.375 * W;
    let lat = Number(rampDef?.lateralOffset) || 0;
    const snapped = Math.abs(lat) < minOuterOffset;

    if (snapped) {
      const sign = lat < 0 ? -1 : 1;
      lat = sign * 0.42 * W;
    }

    const sStart = rampDef.sStart ?? 100.0;
    const L = this.splineStreamer.getTotalLength();
    const type = rampDef.type ?? 'SKYBRIDGE_OVERPASS';
    const deckLen = type === 'SKYBRIDGE_OVERPASS' ? (rampDef.deckLength ?? 300.0) : 45.0;
    const sEnd = rampDef.sEnd ?? Math.min(L - 5.0, sStart + deckLen);
    const chevronStart = (((sStart - 100.0) % L) + L) % L;

    const fullRamp: TacticalRampZone = {
      id: `custom_ramp_${this.rampZones.length + 1}`,
      index: this.rampZones.length,
      type,
      laneSide: lat > 0 ? 'RIGHT_OUTER' : 'LEFT_OUTER',
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
      ...rampDef,
      lateralOffset: lat,
    };

    this.rampZones.push(fullRamp);
    return { ...fullRamp, snappedToOuterLane: snapped };
  }

  /**
   * Evaluates approach chevron activation.
   * Chevrons only pulse when vehicle is approaching in the outer ramp lane (|lateralOffset| >= 0.375 * roadWidth)
   * within [sStart - 100.0m, sStart]. Central 75% traffic never triggers chevrons.
   */
  public isChevronActiveAt(sMeters: number, lateralOffset: number, ramp: TacticalRampZone): boolean {
    const W = this.splineStreamer.roadWidth;
    if (Math.abs(lateralOffset) < 0.375 * W) return false;
    return sMeters >= ramp.sStart - 100.0 && sMeters <= ramp.sStart;
  }

  public getRampAt(sMeters: number, lateralOffset: number): TacticalRampZone | undefined {
    const W = this.splineStreamer.roadWidth;
    if (Math.abs(lateralOffset) < 0.375 * W) return undefined;
    for (const ramp of this.rampZones) {
      if (sMeters >= ramp.sStart && sMeters <= ramp.sEnd) {
        if (Math.sign(lateralOffset) === Math.sign(ramp.lateralOffset)) {
          return ramp;
        }
      }
    }
    return undefined;
  }

  /**
   * Tactical Ramp Type 2 Hook: Flying through Mid-Air Plasma Boost Ring.
   * Grants +80% instant Nitro refill, 1.42x Hyper-Velocity Surge for 4.0s, and +2,500 CR.
   * Features per-jump deduplication so holding inside the ring fires at most once per jump.
   */
  public triggerPlasmaBoostRing(
    jumpId: string,
    currentNitroPercent = 0.0
  ): PlasmaBoostTriggerResult {
    if (this.triggeredPlasmaJumps.has(jumpId)) {
      return {
        jumpId,
        nitroPercent: Math.min(100.0, currentNitroPercent),
        boostMultiplier: 1.42,
        hyperSurgeRemainingSec: 4.0,
        creditsAwarded: 0,
        alreadyTriggered: true,
      };
    }

    this.triggeredPlasmaJumps.add(jumpId);
    const newNitro = Math.min(100.0, currentNitroPercent + 80.0);

    return {
      jumpId,
      nitroPercent: newNitro,
      boostMultiplier: 1.42,
      hyperSurgeRemainingSec: 4.0,
      creditsAwarded: 2500,
      alreadyTriggered: false,
    };
  }

  /**
   * Tactical Ramp Type 3 Hook: Kinetic Shockwave Landing.
   * Touching down at >180 KPH triggers ZERO (0%) landing slowdown, boosts forward speed by +15% (1.15x),
   * fires a 3D Kinetic Shockwave Ring (radius 15m), and blasts AI rivals within 15m sideways.
   */
  public evaluateKineticShockwaveLanding(
    landingSpeedKph: number,
    rivals: ShockwaveRivalTarget[] = [],
    jumpHeightMeters = 2.0
  ): ShockwaveLandingResult {
    // Micro suspension bumps on flat road (jumpHeight < 0.5m) do NOT trigger shockwave
    if (jumpHeightMeters < 0.5 || landingSpeedKph <= 180.0) {
      return {
        shockwaveFired: false,
        slowdownPercent: landingSpeedKph <= 180.0 ? 5.0 : 0.0,
        postTouchdownSpeedKph: landingSpeedKph,
        maxRingRadiusMeters: 0.0,
        blastedRivals: rivals.map((r) => ({
          id: r.id,
          blasted: false,
          deltaLateralVel: 0.0,
          distanceMeters: r.distanceMeters,
        })),
      };
    }

    // Zero landing slowdown + 15% forward speed boost
    const postSpeed = landingSpeedKph * 1.15;
    const blastedRivals: BlastedRivalResult[] = rivals.map((rival) => {
      if (rival.distanceMeters <= 15.0) {
        // Lateral blast directed away from player's centerline
        const dirSign = rival.lateralDeltaMeters >= 0 ? 1 : -1;
        const blastVelocity = dirSign * (18.0 * (1.0 - rival.distanceMeters / 18.0) + 4.0);
        return {
          id: rival.id,
          blasted: true,
          deltaLateralVel: blastVelocity,
          distanceMeters: rival.distanceMeters,
        };
      }
      return {
        id: rival.id,
        blasted: false,
        deltaLateralVel: 0.0,
        distanceMeters: rival.distanceMeters,
      };
    });

    return {
      shockwaveFired: true,
      slowdownPercent: 0.0,
      postTouchdownSpeedKph: postSpeed,
      maxRingRadiusMeters: 15.0,
      blastedRivals,
    };
  }

  public attachToScene(scene: THREE.Scene): void {
    if (this.attachedScene && this.attachedScene !== scene) {
      this.attachedScene.remove(this.sceneRoot);
    }
    this.attachedScene = scene;
    scene.add(this.sceneRoot);
    this.rebuild3DMeshes();
  }

  public rebuild3DMeshes(): THREE.Group {
    this.clear3DMeshes();

    for (const ramp of this.rampZones) {
      const group = new THREE.Group();
      group.name = `Ramp_${ramp.id}_${ramp.type}`;

      const fStart = this.splineStreamer.getFrameAtArcLength(ramp.sStart);
      const fEnd = this.splineStreamer.getFrameAtArcLength(ramp.sEnd);

      // 1. Ramp Launch Wedge
      const wedgeGeom = new THREE.BoxGeometry(ramp.rampWidth, 0.4, 25.0);
      const wedgeMat = new THREE.MeshStandardMaterial({
        color: ramp.type === 'SKYBRIDGE_OVERPASS' ? 0xffb703 : ramp.type === 'PLASMA_BOOST_RING' ? 0x00f0ff : 0xff0055,
        metalness: 0.6,
        roughness: 0.2,
      });
      const wedge = new THREE.Mesh(wedgeGeom, wedgeMat);
      wedge.position.set(
        fStart.position[0] + fStart.normal[0] * ramp.lateralOffset,
        fStart.position[1] + 1.2,
        fStart.position[2] + fStart.normal[2] * ramp.lateralOffset
      );
      wedge.rotation.x = -0.12;
      wedge.name = 'RampWedge';
      group.add(wedge);

      // 2. 100m Holographic Approach Chevrons preceding ramp
      const chevronGroup = new THREE.Group();
      chevronGroup.name = 'ApproachChevrons';
      const chevronMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.85 });

      for (let c = 0; c < 5; c++) {
        const sChevron = ramp.sStart - 20.0 * (c + 1);
        const fChevron = this.splineStreamer.getFrameAtArcLength(sChevron);
        const chevronGeom = new THREE.PlaneGeometry(ramp.rampWidth * 0.9, 3.0);
        const chevronMesh = new THREE.Mesh(chevronGeom, chevronMat);
        chevronMesh.rotation.x = -Math.PI / 2;
        chevronMesh.position.set(
          fChevron.position[0] + fChevron.normal[0] * ramp.lateralOffset,
          fChevron.position[1] + 0.05,
          fChevron.position[2] + fChevron.normal[2] * ramp.lateralOffset
        );
        chevronGroup.add(chevronMesh);
      }
      group.add(chevronGroup);

      // 3. Elevated Skybridge Overpass Upper-Deck Highway
      if (ramp.type === 'SKYBRIDGE_OVERPASS') {
        const deckGeom = new THREE.BoxGeometry(ramp.rampWidth * 1.2, 0.6, ramp.deckLength);
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.4, metalness: 0.3 });
        const deckMesh = new THREE.Mesh(deckGeom, deckMat);
        deckMesh.position.set(
          fStart.position[0] + fStart.normal[0] * ramp.lateralOffset,
          fStart.position[1] + 12.0,
          fStart.position[2] + fStart.normal[2] * ramp.lateralOffset
        );
        deckMesh.name = 'SkybridgeUpperDeck';
        group.add(deckMesh);

        // Continuous 1.35x Overdrive Boost Strips along Skybridge
        const stripGeom = new THREE.PlaneGeometry(ramp.rampWidth * 0.5, ramp.deckLength * 0.95);
        const stripMat = new THREE.MeshBasicMaterial({ color: 0xffd166, side: THREE.DoubleSide });
        const stripMesh = new THREE.Mesh(stripGeom, stripMat);
        stripMesh.rotation.x = -Math.PI / 2;
        stripMesh.position.set(
          fStart.position[0] + fStart.normal[0] * ramp.lateralOffset,
          fStart.position[1] + 12.35,
          fStart.position[2] + fStart.normal[2] * ramp.lateralOffset
        );
        stripMesh.name = 'OverdriveBoostStrip';
        group.add(stripMesh);

        // Support Pylons down to ground
        const pylonCount = Math.max(2, Math.floor(ramp.deckLength / 80));
        for (let p = 0; p < pylonCount; p++) {
          const sPylon = ramp.sStart + (p / (pylonCount - 1)) * ramp.deckLength;
          const fP = this.splineStreamer.getFrameAtArcLength(sPylon);
          const pylonGeom = new THREE.CylinderGeometry(0.8, 1.2, 12.0, 8);
          const pylonMat = new THREE.MeshStandardMaterial({ color: 0x6c757d });
          const pylon = new THREE.Mesh(pylonGeom, pylonMat);
          pylon.position.set(
            fP.position[0] + fP.normal[0] * ramp.lateralOffset,
            fP.position[1] + 6.0,
            fP.position[2] + fP.normal[2] * ramp.lateralOffset
          );
          group.add(pylon);
        }
      }

      // 4. Mid-Air Plasma Boost Ring
      if (ramp.type === 'PLASMA_BOOST_RING') {
        const ringGeom = new THREE.TorusGeometry(ramp.ringRadiusMeters, 0.25, 16, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.position.set(
          fStart.position[0] + fStart.normal[0] * ramp.lateralOffset,
          fStart.position[1] + ramp.ringCenterHeightMeters,
          fStart.position[2] + fStart.normal[2] * ramp.lateralOffset
        );
        ringMesh.name = 'PlasmaBoostRing';
        group.add(ringMesh);
      }

      ramp.meshGroup = group;
      this.sceneRoot.add(group);
    }

    return this.sceneRoot;
  }

  private clear3DMeshes(): void {
    for (const ramp of this.rampZones) {
      if (ramp.meshGroup) {
        this.sceneRoot.remove(ramp.meshGroup);
        ramp.meshGroup.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.geometry) {
            obj.geometry.dispose();
          }
        });
        ramp.meshGroup = undefined;
      }
    }
  }

  public dispose(): void {
    this.clear3DMeshes();
    if (this.attachedScene) {
      this.attachedScene.remove(this.sceneRoot);
      this.attachedScene = null;
    }
  }
}
