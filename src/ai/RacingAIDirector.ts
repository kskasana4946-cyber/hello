// src/ai/RacingAIDirector.ts
// Milestone M6: 5-Tier Racing AI Director & 7 Race Formats (F37, F38, F39, F40)
// Manages AI racer positions, spline tracking, avoidance, speed profiles,
// slipstream drafting, elevated skybridge targeting, straightaway nitro,
// knockout elimination, and solo time attack ghost car recording & sector splits.

import * as THREE from 'three';
import {
  AIDifficultyTier,
  RaceFormatId,
  Vec3Tuple,
} from '../core/types';
import { GranularSynthEngine } from '../audio/GranularSynthEngine';

// ============================================================================
// 1. Difficulty & Race Format Specification Tables
// ============================================================================

export interface AIDifficultyConfig {
  id: AIDifficultyTier;
  label: string;
  paceEfficiency: number;
  cornerGripFactor: number;
  reactionHz: number;
  takesSkybridges: boolean;
  usesSlipstream: boolean;
  firesStraightawayNitro: boolean;
}

export const AI_DIFFICULTY_SPECS: Record<AIDifficultyTier, AIDifficultyConfig> = {
  EASY: {
    id: 'EASY',
    label: 'Easy (Rookie)',
    paceEfficiency: 0.76,
    cornerGripFactor: 0.75,
    reactionHz: 4,
    takesSkybridges: false,
    usesSlipstream: false,
    firesStraightawayNitro: false,
  },
  MEDIUM: {
    id: 'MEDIUM',
    label: 'Medium (Club)',
    paceEfficiency: 0.84,
    cornerGripFactor: 0.83,
    reactionHz: 8,
    takesSkybridges: false,
    usesSlipstream: false,
    firesStraightawayNitro: false,
  },
  HARD: {
    id: 'HARD',
    label: 'Hard (Pro GP)',
    paceEfficiency: 0.91,
    cornerGripFactor: 0.90,
    reactionHz: 15,
    takesSkybridges: false,
    usesSlipstream: true,
    firesStraightawayNitro: false,
  },
  VERY_HARD: {
    id: 'VERY_HARD',
    label: 'Very Hard (Master)',
    paceEfficiency: 0.96,
    cornerGripFactor: 0.95,
    reactionHz: 30,
    takesSkybridges: false,
    usesSlipstream: true,
    firesStraightawayNitro: true,
  },
  SUPER_HARD: {
    id: 'SUPER_HARD',
    label: 'Super Hard (Apex Legend)',
    paceEfficiency: 1.02,
    cornerGripFactor: 1.00,
    reactionHz: 60,
    takesSkybridges: true,
    usesSlipstream: true,
    firesStraightawayNitro: true,
  },
};

export interface RaceFormatConfig {
  id: RaceFormatId;
  name: string;
  laps: number;
  totalRacers: number;
  isKnockout: boolean;
  isTimeAttack: boolean;
}

export const RACE_FORMAT_SPECS: Record<RaceFormatId, RaceFormatConfig> = {
  SPRINT_1_LAP: {
    id: 'SPRINT_1_LAP',
    name: '1 Lap Sprint',
    laps: 1,
    totalRacers: 8,
    isKnockout: false,
    isTimeAttack: false,
  },
  QUALIFIER_2_LAPS: {
    id: 'QUALIFIER_2_LAPS',
    name: '2 Laps Qualifier',
    laps: 2,
    totalRacers: 8,
    isKnockout: false,
    isTimeAttack: false,
  },
  GRAND_PRIX_3_LAPS: {
    id: 'GRAND_PRIX_3_LAPS',
    name: '3 Laps Grand Prix',
    laps: 3,
    totalRacers: 8,
    isKnockout: false,
    isTimeAttack: false,
  },
  FEATURE_5_LAPS: {
    id: 'FEATURE_5_LAPS',
    name: '5 Laps Feature',
    laps: 5,
    totalRacers: 8,
    isKnockout: false,
    isTimeAttack: false,
  },
  ENDURANCE_10_LAPS: {
    id: 'ENDURANCE_10_LAPS',
    name: '10 Laps Endurance',
    laps: 10,
    totalRacers: 8,
    isKnockout: false,
    isTimeAttack: false,
  },
  KNOCKOUT_ELIMINATION: {
    id: 'KNOCKOUT_ELIMINATION',
    name: 'Knockout Elimination',
    laps: 5,
    totalRacers: 6,
    isKnockout: true,
    isTimeAttack: false,
  },
  SOLO_TIME_ATTACK: {
    id: 'SOLO_TIME_ATTACK',
    name: 'Solo Time Attack',
    laps: 3,
    totalRacers: 1,
    isKnockout: false,
    isTimeAttack: true,
  },
};

// ============================================================================
// 2. State & Event Data Contracts
// ============================================================================

export interface AIRacerState {
  id: string;
  isPlayer: boolean;
  status: 'ACTIVE' | 'ELIMINATED';
  currentLap: number;
  alongOffset: number;       // Distance along current lap (0..lapLength)
  lateralOffset: number;     // Distance from centerline (meters)
  verticalOffset: number;    // Height above road (meters)
  totalDistance: number;     // Cumulative total distance driven (meters)
  speedKph: number;
  drafting: boolean;
  takingSkybridge: boolean;
  nitroActive: boolean;
  skybridgesTakenCount: number;
  nitroActivationsCount: number;
  slipstreamEventsCount: number;
  vehicleMesh?: THREE.Object3D;
}

export interface TacticalDecision {
  difficultyId: AIDifficultyTier;
  paceEfficiency: number;
  cornerGripFactor: number;
  drafting: boolean;
  takingSkybridge: boolean;
  nitroActive: boolean;
}

export interface SlipstreamDraftResult {
  inSlipstream: boolean;
  dragReductionRatio: number;
  draftAccelBonusMps2: number;
}

export interface EliminationEvent {
  eliminatedRacerId: string | null;
  isPlayerEliminated: boolean;
  explosionTriggered: boolean;
  explosionWorldPos: Vec3Tuple;
  activeRacersRemaining: number;
}

export interface GhostFrame {
  t: number;                 // Elapsed time in seconds
  s: number;                 // Arc-length in meters
  position: Vec3Tuple;       // World position [x, y, z]
  speedKph: number;
}

export interface TimeAttackProgressResult {
  completedLap: boolean;
  lapTimeSec?: number;
  lapDeltaSec?: number;
  sectorSplits: (number | null)[];
  ghostCarActive: boolean;
}

// ============================================================================
// 3. RacingAIDirector Implementation
// ============================================================================

export class RacingAIDirector {
  public splineStreamer: any;
  public synthEngine: GranularSynthEngine;

  public aiDifficulty: AIDifficultyTier = 'HARD';
  public raceFormat: RaceFormatId = 'GRAND_PRIX_3_LAPS';
  public totalLaps: number = 3;
  public totalRacers: number = 8;
  public currentLap: number = 1;

  public sectorCheckpointsPassed: [boolean, boolean, boolean] = [false, false, false];
  public sectorSplits: [number | null, number | null, number | null] = [null, null, null];
  public bestSectorSplits: [number | null, number | null, number | null] = [null, null, null];
  public bestLapTimeSec: number | null = null;

  public ghostRecording: GhostFrame[] = [];
  public ghostCarActive: boolean = false;
  public ghostPose: GhostFrame | null = null;
  public ghostCarMesh: THREE.Object3D | null = null;

  public racers: AIRacerState[] = [];
  public eliminatedHistory: EliminationEvent[] = [];

  constructor(splineStreamer?: any, synthEngine?: GranularSynthEngine) {
    this.splineStreamer = splineStreamer ?? null;
    this.synthEngine = synthEngine ?? new GranularSynthEngine();
    this.configure('HARD', 'GRAND_PRIX_3_LAPS');
  }

  /**
   * Configures AI Director difficulty and race format, initializing racers and reset states.
   */
  public configure(
    difficultyId: AIDifficultyTier | string = 'HARD',
    formatId: RaceFormatId | string = 'GRAND_PRIX_3_LAPS'
  ): {
    aiDifficulty: AIDifficultyTier;
    raceFormat: RaceFormatId;
    totalLaps: number;
    totalRacers: number;
  } {
    if (AI_DIFFICULTY_SPECS[difficultyId as AIDifficultyTier]) {
      this.aiDifficulty = difficultyId as AIDifficultyTier;
    } else if (!this.aiDifficulty) {
      this.aiDifficulty = 'HARD';
    }

    if (RACE_FORMAT_SPECS[formatId as RaceFormatId]) {
      this.raceFormat = formatId as RaceFormatId;
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
      const startDist = Math.max(0, (this.totalRacers - 1 - i) * 12);
      this.racers.push({
        id: i === 0 ? 'player' : `ai_${i}`,
        isPlayer: i === 0,
        status: 'ACTIVE',
        currentLap: 1,
        alongOffset: startDist,
        lateralOffset: (i % 2 === 0 ? -1 : 1) * 3.5,
        verticalOffset: 0.0,
        totalDistance: startDist,
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

  /**
   * Evaluates AI tactical decisions (slipstream drafting, skybridge overpass targeting, straightaway nitro)
   * based on the given difficulty tier and local tactical situation.
   */
  public evaluateAiTacticalDecision(
    difficultyId: AIDifficultyTier | string,
    situation: {
      distanceBehindLeaderMeters?: number;
      lateralDeltaMeters?: number;
      distanceToSkybridgeMeters?: number;
      curvature?: number;
      nitroPercent?: number;
    } = {}
  ): TacticalDecision {
    const spec =
      AI_DIFFICULTY_SPECS[difficultyId as AIDifficultyTier] || AI_DIFFICULTY_SPECS.HARD;
    const distAhead = Number(situation.distanceBehindLeaderMeters ?? 100);
    const latDelta = Math.abs(Number(situation.lateralDeltaMeters ?? 0));
    const distToSkybridge = Number(situation.distanceToSkybridgeMeters ?? 999);
    const curvature = Math.abs(Number(situation.curvature ?? 0));
    const nitroPercent = Number(situation.nitroPercent ?? 100);

    const drafting =
      spec.usesSlipstream && distAhead > 0 && distAhead <= 25.0 && latDelta <= 2.5;
    const takingSkybridge =
      spec.takesSkybridges && distToSkybridge >= 0 && distToSkybridge <= 150.0;
    const nitroActive =
      spec.firesStraightawayNitro && curvature < 0.0015 && nitroPercent > 20.0;

    return {
      difficultyId: spec.id,
      paceEfficiency: spec.paceEfficiency,
      cornerGripFactor: spec.cornerGripFactor,
      drafting,
      takingSkybridge,
      nitroActive,
    };
  }

  /**
   * Evaluates slipstream draft dynamics between two vehicles.
   * Active when distance is in (0, 25.0] meters and lateral distance is <= 2.5 meters.
   * Plays slipstream wind SFX scaled by proximity.
   */
  public evaluateSlipstreamDraft(
    distanceMeters: number,
    lateralDeltaMeters: number
  ): SlipstreamDraftResult {
    const d = Number(distanceMeters);
    const lat = Math.abs(Number(lateralDeltaMeters));
    if (d > 0 && d <= 25.0 && lat <= 2.5) {
      const factor = Math.max(0.0, Math.min(1.0, 1.0 - d / 30.0));
      this.synthEngine.playSlipstreamWind(factor);
      return {
        inSlipstream: true,
        dragReductionRatio: 0.22 * factor,
        draftAccelBonusMps2: 3.2 * factor,
      };
    }
    return {
      inSlipstream: false,
      dragReductionRatio: 0.0,
      draftAccelBonusMps2: 0.0,
    };
  }

  /**
   * Eliminates the last-place active racer at the end of a lap in KNOCKOUT_ELIMINATION format.
   * Triggers 3D explosion and boom SFX.
   */
  public eliminateLastPlaceRacer(): EliminationEvent {
    const active = this.racers.filter((r) => r.status === 'ACTIVE');
    if (active.length <= 1) {
      return {
        eliminatedRacerId: null,
        isPlayerEliminated: false,
        explosionTriggered: false,
        explosionWorldPos: [0, 0, 0],
        activeRacersRemaining: active.length,
      };
    }

    // Sort descending by totalDistance so last place is at index length - 1
    active.sort((a, b) => b.totalDistance - a.totalDistance);
    const lastRacer = active[active.length - 1];
    lastRacer.status = 'ELIMINATED';
    lastRacer.speedKph = 0;

    this.synthEngine.playKnockoutExplosion();

    let explosionWorldPos: Vec3Tuple = [0, 0, 0];
    if (this.splineStreamer && typeof this.splineStreamer.worldPosFromSplineOffsets === 'function') {
      try {
        explosionWorldPos = this.splineStreamer.worldPosFromSplineOffsets(
          lastRacer.alongOffset,
          lastRacer.lateralOffset,
          lastRacer.verticalOffset
        );
      } catch {
        explosionWorldPos = [0, 0, 0];
      }
    }

    const event: EliminationEvent = {
      eliminatedRacerId: lastRacer.id,
      isPlayerEliminated: lastRacer.isPlayer,
      explosionTriggered: true,
      explosionWorldPos,
      activeRacersRemaining: active.length - 1,
    };

    this.eliminatedHistory.push(event);
    return event;
  }

  /**
   * Records Solo Time Attack progress along the lap (0.0 to 1.0) and registers
   * Sector 1 (33.3%), Sector 2 (66.7%), and Sector 3 (100%) split times.
   */
  public recordTimeAttackProgress(
    fractionOfLap: number,
    elapsedSec: number
  ): TimeAttackProgressResult {
    const f = Number(fractionOfLap);
    const t = Number(elapsedSec);
    const lapLength = this.splineStreamer?.getTotalLength ? this.splineStreamer.getTotalLength() : 5000;
    const s = f * lapLength;

    let worldPos: Vec3Tuple = [f * 100, 0, 0];
    if (this.splineStreamer && typeof this.splineStreamer.worldPosFromSplineOffsets === 'function') {
      try {
        worldPos = this.splineStreamer.worldPosFromSplineOffsets(s, 0, 0);
      } catch {
        worldPos = [f * 100, 0, 0];
      }
    }

    this.ghostRecording.push({
      t,
      s,
      position: worldPos,
      speedKph: 295,
    });

    // Sector 1: f >= 1/3 (~33.3%)
    if (f >= 1 / 3 && this.sectorSplits[0] === null) {
      this.sectorSplits[0] = Number(t.toFixed(3));
      this.sectorCheckpointsPassed[0] = true;
    }

    // Sector 2: f >= 2/3 (~66.7%)
    if (f >= 2 / 3 && this.sectorSplits[1] === null) {
      const s1 = this.sectorSplits[0] ?? (t * 0.5);
      this.sectorSplits[1] = Number((t - s1).toFixed(3));
      this.sectorCheckpointsPassed[1] = true;
    }

    // Sector 3: f >= 1.0 (100% Finish Line)
    if (f >= 1.0 && this.sectorSplits[2] === null) {
      const s12 = (this.sectorSplits[0] ?? 0) + (this.sectorSplits[1] ?? 0);
      this.sectorSplits[2] = Number((t - s12).toFixed(3));
      this.sectorCheckpointsPassed[2] = true;

      const lapDeltaSec =
        this.bestLapTimeSec !== null ? Number((t - this.bestLapTimeSec).toFixed(3)) : 0.0;

      if (this.bestLapTimeSec === null || t < this.bestLapTimeSec) {
        this.bestLapTimeSec = t;
        this.bestSectorSplits = [...this.sectorSplits];
      }

      this.ghostCarActive = true;
      return {
        completedLap: true,
        lapTimeSec: t,
        lapDeltaSec,
        sectorSplits: [...this.sectorSplits],
        ghostCarActive: this.ghostCarActive,
      };
    }

    return {
      completedLap: false,
      sectorSplits: [...this.sectorSplits],
      ghostCarActive: this.ghostCarActive,
    };
  }

  /**
   * Advances simulation of all AI racers by dt seconds.
   * Updates alongOffset, lateralOffset, speed, lap counting, and tactical decisions.
   */
  public step(
    dt: number,
    playerState?: {
      alongOffset: number;
      lateralOffset: number;
      speedKph: number;
      currentLap?: number;
    }
  ): void {
    const lapLength = this.splineStreamer?.getTotalLength
      ? this.splineStreamer.getTotalLength()
      : 5000;
    const spec = AI_DIFFICULTY_SPECS[this.aiDifficulty] || AI_DIFFICULTY_SPECS.HARD;

    // Update player racer state if provided
    if (playerState) {
      const player = this.racers[0];
      if (player && player.status === 'ACTIVE') {
        player.alongOffset = playerState.alongOffset;
        player.lateralOffset = playerState.lateralOffset;
        player.speedKph = playerState.speedKph;
        player.currentLap = playerState.currentLap ?? player.currentLap;
        player.totalDistance =
          (player.currentLap - 1) * lapLength + player.alongOffset;
      }
    }

    // Update AI racers
    for (let i = 1; i < this.racers.length; i++) {
      const ai = this.racers[i];
      if (ai.status !== 'ACTIVE') continue;

      // Base target speed scaled by paceEfficiency
      const baseTopSpeed = 290.0 * spec.paceEfficiency;
      const targetSpeed = baseTopSpeed + Math.sin(i * 1.5) * 12.0;

      // Smooth acceleration towards target speed
      const accel = 8.5 * spec.paceEfficiency;
      ai.speedKph = Math.min(targetSpeed, ai.speedKph + accel * dt * 3.6);

      // Evaluate tactical decisions relative to leader or nearest forward car
      const forwardCars = this.racers.filter(
        (r) => r.status === 'ACTIVE' && r.totalDistance > ai.totalDistance
      );
      forwardCars.sort((a, b) => a.totalDistance - b.totalDistance);
      const nearestAhead = forwardCars[0];

      let distanceBehindLeader = 999;
      let lateralDelta = 0;
      if (nearestAhead) {
        distanceBehindLeader = nearestAhead.totalDistance - ai.totalDistance;
        lateralDelta = Math.abs(nearestAhead.lateralOffset - ai.lateralOffset);
      }

      const decision = this.evaluateAiTacticalDecision(this.aiDifficulty, {
        distanceBehindLeaderMeters: distanceBehindLeader,
        lateralDeltaMeters: lateralDelta,
        distanceToSkybridgeMeters: 200,
        curvature: 0.0005,
        nitroPercent: 80,
      });

      ai.drafting = decision.drafting;
      ai.takingSkybridge = decision.takingSkybridge;
      ai.nitroActive = decision.nitroActive;

      if (ai.drafting) {
        ai.speedKph += 15.0 * dt;
        ai.slipstreamEventsCount += 1;
      }
      if (ai.nitroActive) {
        ai.speedKph += 25.0 * dt;
        ai.nitroActivationsCount += 1;
      }

      // Advance along spline
      const speedMs = ai.speedKph / 3.6;
      ai.alongOffset += speedMs * dt;
      ai.totalDistance += speedMs * dt;

      // Lap rollover
      if (ai.alongOffset >= lapLength) {
        ai.alongOffset -= lapLength;
        ai.currentLap += 1;
      }
    }

    // Update Ghost Car replay pose if active
    if (this.ghostCarActive && this.ghostRecording.length > 0) {
      const playerDist = this.racers[0]?.alongOffset ?? 0;
      // Find closest recorded frame
      let closest = this.ghostRecording[0];
      let minDiff = Infinity;
      for (const f of this.ghostRecording) {
        const diff = Math.abs(f.s - playerDist);
        if (diff < minDiff) {
          minDiff = diff;
          closest = f;
        }
      }
      this.ghostPose = closest;
    }
  }

  /**
   * Returns racers ranked by leaderboard position (1st to last).
   */
  public getLeaderboard(): AIRacerState[] {
    const list = [...this.racers];
    list.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'ACTIVE' ? -1 : 1;
      }
      return b.totalDistance - a.totalDistance;
    });
    return list;
  }
}
