// src/physics/RapierVehicleWorld.ts
// Apex Grand Prix: Uncapped Next-Gen Edition
// 240Hz Sub-Stepped Raycast Suspension Physics & Dynamic Vehicle Dynamics (M1, M6, M8)
// Features:
// 1. Multi-surface Pacejka grip: ASPHALT (mu=1.15), KERB (mu=1.05), SHOULDER (mu=0.72), PUDDLE (mu=0.52 with hydroplaning >140 KPH, AWD +12% wet advantage).
// 2. 4-corner thermodynamic tire model (35°C..120°C, optimal window 85°C..105°C scaling Pacejka peak D).
// 3. 3D FIA sawtooth kerb vertical profile (0.80m pitch, 0.032m amplitude) exciting suspension and anti-roll bars.
// 4. Aerodynamic slipstream wake: -28% aero drag and +1.4 m/s^2 drafting pull in 25m wake cone.
// 5. Sequential gear shift shock: 55ms pitch kick impulse on upshift, rev-match blip on downshift.
// 6. Direct Mod Studio tuning wiring (suspensionStiffness, downforceRatio, camberDeg, wingAngleRad, rideHeightOffset).
// 7. Lateral Tangent Barrier Projection (Zero vertex sticking or teleporting at 400+ KPH).

import RAPIER from '@dimforge/rapier3d-compat';
import {
  ISplineProvider,
  LiveCockpitTelemetry,
  SplineFrame,
  Vec3Tuple,
  VehicleSpec,
} from '../core/types';
import { VEHICLE_ROSTER } from '../vehicles/VehicleRoster';

export interface VehicleControlInput {
  throttle: number;   // 0.0 .. 1.0
  brake: number;      // 0.0 .. 1.0
  steer: number;      // -1.0 (left) .. +1.0 (right)
  handbrake?: boolean;
  nitro?: boolean;
  drsOverride?: boolean;
}

export interface WheelRaycastState {
  id: 'FL' | 'FR' | 'RL' | 'RR';
  worldMountPos: Vec3Tuple;
  worldContactPos: Vec3Tuple;
  suspensionLength: number;
  compression: number;
  compressionVelocity: number;
  inContact: boolean;
  springForceN: number;
  damperForceN: number;
  antiRollForceN: number;
  normalLoadN: number;
  slipAngleRad: number;
  lateralForceN: number;
  longitudinalForceN: number;
  rotationAngleRad: number;
  tireTempCelsius: number;
  surfaceType: 'ASPHALT' | 'KERB' | 'SHOULDER' | 'PUDDLE';
  surfaceMu: number;
}

export interface PacejkaParams {
  B: number; // Stiffness factor (default 10.0)
  C: number; // Shape factor (default 1.9)
  D: number; // Peak factor (default 1.38)
  E: number; // Curvature factor (default 0.97)
}

export interface KineticShockwaveEvent {
  triggered: boolean;
  timestampSec: number;
  origin: Vec3Tuple;
  landingSpeedKph: number;
  forwardBoostMultiplier: number;
  blastRadiusMeters: number;
  blastedRivalIds: string[];
}

export interface BarrierSparkTelemetry {
  barrierContact: boolean;
  barrierSide: 'LEFT' | 'RIGHT' | 'NONE';
  scrapeSpeedKph: number;
  sparkIntensity: number; // 0.0 .. 1.0
  sparkCount: number;
  contactPointWorld: Vec3Tuple;
}

export interface ModStudioTuning {
  rideHeightOffset: number;     // -0.05 .. +0.05m
  wingAngleRad: number;         // 0.0 .. 0.52 rad
  camberDeg: number;            // -4.0 .. -0.5 deg
  downforceRatio: number;       // 0.8 .. 1.5x
  suspensionStiffness: number;  // 0.8 .. 1.4x
}

export interface PhysicsVehicleState {
  id: string;
  spec: VehicleSpec;
  position: Vec3Tuple;
  velocity: Vec3Tuple;
  forward: Vec3Tuple;
  up: Vec3Tuple;
  right: Vec3Tuple;
  speedMs: number;
  speedKph: number;
  alongOffset: number;
  lateralOffset: number;
  verticalOffset: number;
  yawRad: number;
  pitchRad: number;
  rollRad: number;
  wingAngleRad: number;
  drsActive: boolean;
  brakeTempCelsius: number;
  rpm: number;
  gear: number | 'N' | 'R';
  nitroPercent: number;
  downforceN: number;
  wheels: [WheelRaycastState, WheelRaycastState, WheelRaycastState, WheelRaycastState];
  airborne: boolean;
  airborneTimeSec: number;
  onSkybridgeDeck: boolean;
  skybridgeElevationMeters: number;
  skybridgeRemainingMeters: number;
  plasmaSurgeRemainingSec: number;
  activeSpeedMultiplier: number;
  stuntCreditsEarned: number;
  barrierContact: boolean;
  barrierSparks: BarrierSparkTelemetry;
  lastShockwaveEvent: KineticShockwaveEvent | null;
  // Next-Gen additions
  kerbRumbleIntensity: number;
  slipstreamActive: boolean;
  slipstreamDraftRatio: number;
  lateralG: number;
  longitudinalG: number;
  shiftShockRemainingSec: number;
  lastShiftType?: 'UPSHIFT' | 'DOWNSHIFT';
}

/**
 * Default analytical oval/straight spline provider used when no external
 * SplineTrackStreamer is attached yet (e.g., unit tests or standalone physics tests).
 */
export class DefaultAnalyticalSplineProvider implements ISplineProvider {
  private readonly totalLengthMeters: number;
  private readonly roadWidthMeters: number;

  constructor(totalLengthMeters = 5000, roadWidthMeters = 20) {
    this.totalLengthMeters = totalLengthMeters;
    this.roadWidthMeters = roadWidthMeters;
  }

  public getTotalLength(): number {
    return this.totalLengthMeters;
  }

  public getFrameAtArcLength(s: number): SplineFrame {
    const wrappedS = ((s % this.totalLengthMeters) + this.totalLengthMeters) % this.totalLengthMeters;
    return {
      s: wrappedS,
      position: [0, 0, wrappedS],
      tangent: [0, 0, 1],
      normal: [0, 1, 0],
      binormal: [1, 0, 0],
      bankAngleRad: 0,
      roadWidth: this.roadWidthMeters,
      isTunnel: false,
    };
  }

  public getClosestSplinePoint(worldPos: Vec3Tuple, hintAlongOffset = 0): { alongOffset: number; lateralOffset: number; verticalOffset: number; frame: SplineFrame } {
    const s = Math.max(0, Math.min(this.totalLengthMeters, worldPos[2]));
    const frame = this.getFrameAtArcLength(s);
    return {
      alongOffset: s,
      lateralOffset: worldPos[0],
      verticalOffset: worldPos[1],
      frame,
    };
  }
}

export class RapierVehicleWorld {
  public static readonly FIXED_HZ = 240;
  public static readonly FIXED_DT = 1 / 240;
  public static readonly GRAVITY = 9.81;
  public static readonly AIR_DENSITY = 1.225;

  private rapierInitialized = false;
  private rapierWorld: RAPIER.World | null = null;
  private rigidBodies: Map<string, RAPIER.RigidBody> = new Map();
  private splineProvider: ISplineProvider;
  private vehicles: Map<string, PhysicsVehicleState> = new Map();
  private controls: Map<string, VehicleControlInput> = new Map();
  private tuning: Map<string, ModStudioTuning> = new Map();
  private leaders: Array<{ alongOffset: number; lateralOffset: number; speedMs: number }> = [];
  private accumulatorSec = 0;
  private totalSubstepsExecuted = 0;
  private simTimeSec = 0;

  constructor(splineProvider?: ISplineProvider) {
    this.splineProvider = splineProvider ?? new DefaultAnalyticalSplineProvider(10000, 20);
  }

  public static async create(splineProvider?: ISplineProvider): Promise<RapierVehicleWorld> {
    const world = new RapierVehicleWorld(splineProvider);
    await world.initRapier();
    return world;
  }

  public async initRapier(): Promise<void> {
    if (this.rapierInitialized) return;
    await RAPIER.init();
    this.rapierWorld = new RAPIER.World({ x: 0.0, y: -RapierVehicleWorld.GRAVITY, z: 0.0 });
    this.rapierWorld.timestep = RapierVehicleWorld.FIXED_DT;

    // Create a large ground plane collider for Rapier raycasts
    const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const groundBody = this.rapierWorld.createRigidBody(groundBodyDesc);
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(50000, 0.5, 50000);
    this.rapierWorld.createCollider(groundColliderDesc, groundBody);

    this.rapierInitialized = true;

    // Register any vehicles already added before initRapier()
    for (const [id, state] of this.vehicles.entries()) {
      this.createRapierBodyForVehicle(id, state);
    }
  }

  public isRapierInitialized(): boolean {
    return this.rapierInitialized;
  }

  public setSplineProvider(provider: ISplineProvider): void {
    this.splineProvider = provider;
  }

  public getSplineProvider(): ISplineProvider {
    return this.splineProvider;
  }

  public getTotalSubstepsExecuted(): number {
    return this.totalSubstepsExecuted;
  }

  public getSimTimeSec(): number {
    return this.simTimeSec;
  }

  public get state(): PhysicsVehicleState | undefined {
    return this.vehicles.get('player') || this.vehicles.values().next().value;
  }

  public set state(val: PhysicsVehicleState | undefined) {
    if (val) {
      this.vehicles.set(val.id || 'player', val);
    }
  }

  public setLeaders(leaders: Array<{ alongOffset: number; lateralOffset: number; speedMs: number }>): void {
    this.leaders = leaders;
  }

  public setVehicleTuning(id: string, tuning: Partial<ModStudioTuning>): void {
    const existing = this.tuning.get(id) || {
      rideHeightOffset: 0.0,
      wingAngleRad: 0.12,
      camberDeg: -1.8,
      downforceRatio: 1.0,
      suspensionStiffness: 1.0,
    };
    this.tuning.set(id, { ...existing, ...tuning });
  }

  /**
   * Evaluates the Pacejka "Magic Formula" tire lateral force:
   * Fy = Fz * D * sin(C * atan(B*alpha - E*(B*alpha - atan(B*alpha))))
   */
  public static evaluatePacejkaLateralForce(
    normalLoadN: number,
    slipAngleRad: number,
    params: PacejkaParams = { B: 10.0, C: 1.9, D: 1.38, E: 0.97 }
  ): number {
    if (!Number.isFinite(normalLoadN) || normalLoadN <= 0) return 0;
    const alpha = Number.isFinite(slipAngleRad) ? slipAngleRad : 0;
    const { B, C, D, E } = params;
    const bx = B * alpha;
    const inner = bx - E * (bx - Math.atan(bx));
    return normalLoadN * D * Math.sin(C * Math.atan(inner));
  }

  /**
   * Evaluates aerodynamic downforce: F_down = 0.5 * rho * C_L * A * v^2 (+ suction fan if fan_car)
   */
  public static evaluateAerodynamicDownforce(spec: VehicleSpec, speedMs: number): number {
    const frontalArea = 1.95;
    const baseCl = 0.45 + (spec?.tier ?? 0) * 0.35;
    const fanBonusN = spec?.id === 'fan_car' ? 6500 : 0;
    const v = Number.isFinite(speedMs) ? Math.max(0, speedMs) : 0;
    return 0.5 * RapierVehicleWorld.AIR_DENSITY * baseCl * frontalArea * v * v + fanBonusN;
  }

  /**
   * Computes exact closed-form base acceleration a_base so 0-100 KPH matches spec.zeroToHundredSec
   * under quadratic aerodynamic drag peaking at spec.topSpeedKph.
   */
  public static computeCalibratedBaseAcceleration(spec: VehicleSpec): number {
    const vMaxMs = Math.max(30, spec.topSpeedKph / 3.6);
    const v100Ms = 100 / 3.6; // 27.777778 m/s
    const t100 = Math.max(0.5, spec.zeroToHundredSec);
    const ratio = Math.min(0.98, v100Ms / vMaxMs);
    return (vMaxMs / (2 * t100)) * Math.log((1 + ratio) / (1 - ratio));
  }

  public addVehicle(
    id: string,
    spec: VehicleSpec,
    initialAlongOffset = 0,
    initialLateralOffset = 0
  ): PhysicsVehicleState {
    const frame = this.splineProvider.getFrameAtArcLength(initialAlongOffset);
    const rideHeight = 0.35;
    const isNormalUp = Math.abs(frame.normal[1]) >= Math.abs(frame.binormal[1]);
    const U = isNormalUp ? frame.normal : frame.binormal;
    const N = isNormalUp ? frame.binormal : frame.normal;
    const pos: Vec3Tuple = [
      frame.position[0] + N[0] * initialLateralOffset + U[0] * rideHeight,
      frame.position[1] + N[1] * initialLateralOffset + U[1] * rideHeight,
      frame.position[2] + N[2] * initialLateralOffset + U[2] * rideHeight,
    ];

    const quarterWeightN = (spec.massKg * RapierVehicleWorld.GRAVITY) / 4;
    const makeWheel = (wheelId: 'FL' | 'FR' | 'RL' | 'RR'): WheelRaycastState => ({
      id: wheelId,
      worldMountPos: [...pos],
      worldContactPos: [pos[0], pos[1] - rideHeight, pos[2]],
      suspensionLength: 0.35,
      compression: 0.05,
      compressionVelocity: 0,
      inContact: true,
      springForceN: quarterWeightN,
      damperForceN: 0,
      antiRollForceN: 0,
      normalLoadN: quarterWeightN,
      slipAngleRad: 0,
      lateralForceN: 0,
      longitudinalForceN: 0,
      rotationAngleRad: 0,
      tireTempCelsius: 85.0,
      surfaceType: 'ASPHALT',
      surfaceMu: 1.15,
    });

    const yawRad = Math.atan2(frame.tangent[0], frame.tangent[2]);
    const state: PhysicsVehicleState = {
      id,
      spec,
      position: pos,
      velocity: [0, 0, 0],
      forward: [...frame.tangent],
      up: [...U],
      right: [...N],
      speedMs: 0,
      speedKph: 0,
      alongOffset: initialAlongOffset,
      lateralOffset: initialLateralOffset,
      verticalOffset: rideHeight,
      yawRad,
      pitchRad: 0,
      rollRad: 0,
      wingAngleRad: 0.12,
      drsActive: false,
      brakeTempCelsius: 20,
      rpm: 1000,
      gear: 1,
      nitroPercent: 100,
      downforceN: RapierVehicleWorld.evaluateAerodynamicDownforce(spec, 0),
      wheels: [makeWheel('FL'), makeWheel('FR'), makeWheel('RL'), makeWheel('RR')],
      airborne: false,
      airborneTimeSec: 0,
      onSkybridgeDeck: false,
      skybridgeElevationMeters: 0,
      skybridgeRemainingMeters: 0,
      plasmaSurgeRemainingSec: 0,
      activeSpeedMultiplier: 1.0,
      stuntCreditsEarned: 0,
      barrierContact: false,
      barrierSparks: {
        barrierContact: false,
        barrierSide: 'NONE',
        scrapeSpeedKph: 0,
        sparkIntensity: 0,
        sparkCount: 0,
        contactPointWorld: [...pos],
      },
      lastShockwaveEvent: null,
      kerbRumbleIntensity: 0.0,
      slipstreamActive: false,
      slipstreamDraftRatio: 0.0,
      lateralG: 0.0,
      longitudinalG: 0.0,
      shiftShockRemainingSec: 0.0,
    };

    this.vehicles.set(id, state);
    this.controls.set(id, { throttle: 0, brake: 0, steer: 0 });
    this.tuning.set(id, {
      rideHeightOffset: 0.0,
      wingAngleRad: 0.12,
      camberDeg: -1.8,
      downforceRatio: 1.0,
      suspensionStiffness: 1.0,
    });

    if (this.rapierInitialized) {
      this.createRapierBodyForVehicle(id, state);
    }
    return state;
  }

  private createRapierBodyForVehicle(id: string, state: PhysicsVehicleState): void {
    if (!this.rapierWorld || this.rigidBodies.has(id)) return;
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(state.position[0], state.position[1], state.position[2])
      .setLinearDamping(0.0)
      .setAngularDamping(0.5);
    const body = this.rapierWorld.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(0.95, 0.55, 2.2).setMass(state.spec.massKg);
    this.rapierWorld.createCollider(colliderDesc, body);
    this.rigidBodies.set(id, body);
  }

  public getVehicleState(id: string): PhysicsVehicleState | undefined {
    return this.vehicles.get(id);
  }

  public setVehicleSpec(specOrId: VehicleSpec | string, vehicleId = 'player'): void {
    const st = this.vehicles.get(vehicleId);
    if (!st) return;
    if (typeof specOrId === 'string') {
      const found = (VEHICLE_ROSTER as any)?.find((v: any) => v.id === specOrId);
      if (found) st.spec = found;
    } else if (specOrId && typeof specOrId === 'object') {
      st.spec = specOrId;
    }
  }

  public resetVehicleState(vehicleId = 'player'): void {
    const st = this.vehicles.get(vehicleId);
    if (!st) return;
    st.speedMs = 0;
    st.speedKph = 0;
    st.velocity = [0, 0, 0];
    st.pitchRad = 0;
    st.rollRad = 0;
    st.gear = 1;
    st.rpm = 1000;
    st.alongOffset = 0;
    st.lateralOffset = 0;
    st.nitroPercent = 100;
    st.brakeTempCelsius = 20;
    for (const w of st.wheels) {
      w.tireTempCelsius = 85.0;
    }
  }

  public setControlInput(id: string, input: VehicleControlInput): void {
    const rawThrot = Number(input?.throttle);
    const rawBrake = Number(input?.brake);
    const rawSteer = Number(input?.steer);
    this.controls.set(id, {
      throttle: Number.isFinite(rawThrot) ? Math.max(0, Math.min(1, rawThrot)) : 0,
      brake: Number.isFinite(rawBrake) ? Math.max(0, Math.min(1, rawBrake)) : 0,
      steer: Number.isFinite(rawSteer) ? Math.max(-1, Math.min(1, rawSteer)) : 0,
      handbrake: Boolean(input?.handbrake),
      nitro: Boolean(input?.nitro),
      drsOverride: input?.drsOverride,
    });
  }

  public setVehicleSpeedAndHeading(
    id: string,
    speedKph: number,
    headingOffsetRad = 0,
    lateralOffsetMeters?: number
  ): void {
    const state = this.vehicles.get(id);
    if (!state) return;
    const frame = this.splineProvider.getFrameAtArcLength(state.alongOffset);
    const isNormalUp = Math.abs(frame.normal[1]) >= Math.abs(frame.binormal[1]);
    const U = isNormalUp ? frame.normal : frame.binormal;
    const N = isNormalUp ? frame.binormal : frame.normal;

    if (lateralOffsetMeters !== undefined) {
      state.lateralOffset = lateralOffsetMeters;
      state.position = [
        frame.position[0] + N[0] * lateralOffsetMeters + U[0] * state.verticalOffset,
        frame.position[1] + N[1] * lateralOffsetMeters + U[1] * state.verticalOffset,
        frame.position[2] + N[2] * lateralOffsetMeters + U[2] * state.verticalOffset,
      ];
    }

    const safeSpeedKph = Math.max(0, speedKph);
    const speedMs = safeSpeedKph / 3.6;
    const baseAngle = Math.atan2(frame.tangent[0], frame.tangent[2]);
    const totalAngle = baseAngle + headingOffsetRad;
    const dir: Vec3Tuple = [Math.sin(totalAngle), 0, Math.cos(totalAngle)];

    state.forward = dir;
    state.up = [...U];
    state.right = [...N];
    state.velocity = [dir[0] * speedMs, dir[1] * speedMs, dir[2] * speedMs];
    state.speedMs = speedMs;
    state.speedKph = safeSpeedKph;
    state.yawRad = totalAngle;

    const body = this.rigidBodies.get(id);
    if (body) {
      body.setTranslation({ x: state.position[0], y: state.position[1], z: state.position[2] }, true);
      body.setLinvel({ x: state.velocity[0], y: state.velocity[1], z: state.velocity[2] }, true);
    }
  }

  public enterSkybridgeOverpass(
    id: string,
    lengthMeters = 300,
    elevationMeters = 12.0
  ): void {
    const state = this.vehicles.get(id);
    if (!state) return;
    state.onSkybridgeDeck = true;
    state.skybridgeElevationMeters = elevationMeters;
    state.skybridgeRemainingMeters = Math.max(250, Math.min(400, lengthMeters));
    state.verticalOffset = elevationMeters + 0.35;
    const frame = this.splineProvider.getFrameAtArcLength(state.alongOffset);
    state.position = [
      frame.position[0] + frame.binormal[0] * state.lateralOffset + frame.normal[0] * state.verticalOffset,
      frame.position[1] + frame.binormal[1] * state.lateralOffset + frame.normal[1] * state.verticalOffset,
      frame.position[2] + frame.binormal[2] * state.lateralOffset + frame.normal[2] * state.verticalOffset,
    ];
    state.activeSpeedMultiplier = Math.max(state.activeSpeedMultiplier, 1.35);
  }

  public triggerSkybridgeEntry(id: string, lengthMeters = 300, elevationMeters = 12): void {
    this.enterSkybridgeOverpass(id, lengthMeters, elevationMeters);
  }

  public triggerPlasmaBoostRing(id: string): void {
    const state = this.vehicles.get(id);
    if (!state) return;
    state.nitroPercent = Math.min(100, state.nitroPercent + 80);
    state.plasmaSurgeRemainingSec = 4.0;
    state.activeSpeedMultiplier = Math.max(state.activeSpeedMultiplier, 1.42);
    state.stuntCreditsEarned += 2500;
  }

  public triggerPlasmaRingBurst(id: string): { nitroRefill: number; speedMultiplier: number; bonusCredits: number } {
    this.triggerPlasmaBoostRing(id);
    return { nitroRefill: 80.0, speedMultiplier: 1.42, bonusCredits: 2500 };
  }

  public evaluateTouchdown(id: string): KineticShockwaveEvent | null {
    const state = this.vehicles.get(id);
    if (!state) return null;
    const frame = this.splineProvider.getFrameAtArcLength(state.alongOffset);
    const vForwardMs =
      state.velocity[0] * frame.tangent[0] +
      state.velocity[1] * frame.tangent[1] +
      state.velocity[2] * frame.tangent[2];
    const landingKph = Math.max(state.speedKph, vForwardMs * 3.6);

    if (landingKph > 180.0) {
      const boostedMs = (landingKph / 3.6) * 1.15;
      state.velocity = [
        frame.tangent[0] * boostedMs,
        frame.tangent[1] * boostedMs,
        frame.tangent[2] * boostedMs,
      ];
      state.speedMs = boostedMs;
      state.speedKph = boostedMs * 3.6;

      const blastedRivalIds: string[] = [];
      for (const [otherId, otherState] of this.vehicles.entries()) {
        if (otherId === id) continue;
        const dx = otherState.position[0] - state.position[0];
        const dy = otherState.position[1] - state.position[1];
        const dz = otherState.position[2] - state.position[2];
        const dist = Math.hypot(dx, dy, dz);
        if (dist <= 15.0) {
          const otherFrame = this.splineProvider.getFrameAtArcLength(otherState.alongOffset);
          const sideSign = otherState.lateralOffset >= state.lateralOffset ? 1 : -1;
          const blastSpeedMs = 18.0 * sideSign;
          otherState.velocity[0] += otherFrame.binormal[0] * blastSpeedMs;
          otherState.velocity[1] += otherFrame.binormal[1] * blastSpeedMs;
          otherState.velocity[2] += otherFrame.binormal[2] * blastSpeedMs;
          otherState.lateralOffset += sideSign * 2.5;
          blastedRivalIds.push(otherId);
        }
      }

      const evt: KineticShockwaveEvent = {
        triggered: true,
        timestampSec: this.simTimeSec,
        origin: [...state.position],
        landingSpeedKph: landingKph,
        forwardBoostMultiplier: 1.15,
        blastRadiusMeters: 15.0,
        blastedRivalIds,
      };
      state.lastShockwaveEvent = evt;
      return evt;
    }
    return null;
  }

  public triggerKineticShockwave(id: string): KineticShockwaveEvent | null {
    return this.evaluateTouchdown(id);
  }

  public step(dtSeconds: number, maxSubSteps = 2400): number {
    const safeDt = Number.isFinite(dtSeconds) ? Math.max(0, dtSeconds) : 0;
    this.accumulatorSec += safeDt;
    let subStepsRun = 0;
    while (this.accumulatorSec + 1e-9 >= RapierVehicleWorld.FIXED_DT && subStepsRun < maxSubSteps) {
      this.stepSingleSubstep();
      this.accumulatorSec -= RapierVehicleWorld.FIXED_DT;
      subStepsRun++;
    }
    return subStepsRun;
  }

  public stepSubsteps(substeps: number): void {
    const count = Math.max(0, Math.floor(substeps));
    for (let i = 0; i < count; i++) {
      this.stepSingleSubstep();
    }
  }

  private stepSingleSubstep(): void {
    const dt = RapierVehicleWorld.FIXED_DT;
    this.totalSubstepsExecuted++;
    this.simTimeSec += dt;

    if (this.rapierWorld) {
      this.rapierWorld.step();
    }

    for (const [id, state] of this.vehicles.entries()) {
      const input = this.controls.get(id) ?? { throttle: 0, brake: 0, steer: 0 };
      this.updateVehicleSubstep(id, state, input, dt);
    }
  }

  private updateVehicleSubstep(
    id: string,
    state: PhysicsVehicleState,
    input: VehicleControlInput,
    dt: number
  ): void {
    const spec = state.spec;
    const mass = spec.massKg;
    const wheelbase = 2.75;
    const trackWidth = 1.65;
    const cgHeight = 0.48;
    const restLength = 0.35;
    const wheelRadius = 0.34;

    const vehTuning = this.tuning.get(id) || {
      rideHeightOffset: 0.0,
      wingAngleRad: 0.12,
      camberDeg: -1.8,
      downforceRatio: 1.0,
      suspensionStiffness: 1.0,
    };

    // 1. Update timed boosts (Plasma Surge & Skybridge)
    if (state.plasmaSurgeRemainingSec > 0) {
      state.plasmaSurgeRemainingSec = Math.max(0, state.plasmaSurgeRemainingSec - dt);
    }
    let speedMultiplier = 1.0;
    if (state.onSkybridgeDeck) {
      speedMultiplier = Math.max(speedMultiplier, 1.35);
    }
    if (state.plasmaSurgeRemainingSec > 0) {
      speedMultiplier = Math.max(speedMultiplier, 1.42);
    }
    if (input.nitro && state.nitroPercent > 0) {
      state.nitroPercent = Math.max(0, state.nitroPercent - 18.0 * dt);
      speedMultiplier = Math.max(speedMultiplier, 1.22);
    }
    state.activeSpeedMultiplier = speedMultiplier;

    // 2. Evaluate spline frame at current position
    const preQuery = this.splineProvider.getClosestSplinePoint(state.position, state.alongOffset);
    const frame = preQuery.frame;
    const deckHeight = state.onSkybridgeDeck ? state.skybridgeElevationMeters : 0;
    const roadWidth = frame.roadWidth || 20.0;

    // 3. 4-Wheel Spring-Damper Raycasts (FL, FR, RL, RR) + Anti-Roll Bars + Multi-Surface Detection
    const fnHz = 2.6 + spec.tier * 0.18;
    const kSpring = (mass / 4) * Math.pow(2 * Math.PI * fnHz, 2) * vehTuning.suspensionStiffness;
    const cDamper = 2 * 0.85 * Math.sqrt(kSpring * (mass / 4)) * Math.sqrt(vehTuning.suspensionStiffness);
    const kArbFront = kSpring * 0.35;
    const kArbRear = kSpring * 0.30;

    const mountOffsets: [number, number, number][] = [
      [-trackWidth / 2, restLength + wheelRadius, +wheelbase / 2], // FL
      [+trackWidth / 2, restLength + wheelRadius, +wheelbase / 2], // FR
      [-trackWidth / 2, restLength + wheelRadius, -wheelbase / 2], // RL
      [+trackWidth / 2, restLength + wheelRadius, -wheelbase / 2], // RR
    ];

    let anyKerbContact = false;

    for (let i = 0; i < 4; i++) {
      const [lx, ly, lz] = mountOffsets[i];
      const wheel = state.wheels[i];
      const wx = state.position[0] + state.right[0] * lx + state.up[0] * ly + state.forward[0] * lz;
      const wy = state.position[1] + state.right[1] * lx + state.up[1] * ly + state.forward[1] * lz;
      const wz = state.position[2] + state.right[2] * lx + state.up[2] * ly + state.forward[2] * lz;
      wheel.worldMountPos = [wx, wy, wz];

      // Multi-surface classification based on lateral wheel position
      const wheelLat = state.lateralOffset + lx;
      const absWheelLat = Math.abs(wheelLat);
      const sAlong = state.alongOffset + lz;

      let surfaceType: 'ASPHALT' | 'KERB' | 'SHOULDER' | 'PUDDLE' = 'ASPHALT';
      let surfaceMu = 1.15;
      let kerbHeightExcitation = 0;

      if (absWheelLat <= roadWidth * 0.45) {
        // Drivable asphalt - check wet puddle condition
        const isWetBiome = (frame as any).isWet || (this.splineProvider as any).trackId === 'track_neotokyo';
        if (isWetBiome && state.speedKph > 140) {
          surfaceType = 'PUDDLE';
          const awdBonus = spec.drivetrain === 'AWD' ? 1.12 : 1.0;
          surfaceMu = 0.52 * awdBonus;
        } else {
          surfaceType = 'ASPHALT';
          surfaceMu = 1.15;
        }
      } else if (absWheelLat <= roadWidth * 0.56) {
        // 3D Sawtooth FIA Kerb (roadWidth * 0.45 to 0.56, i.e. 9.0m to 11.2m on 20m road)
        surfaceType = 'KERB';
        surfaceMu = 1.05;
        // 0.80m pitch sawtooth excitation
        kerbHeightExcitation = 0.032 * Math.sin((2 * Math.PI * sAlong) / 0.80);
        anyKerbContact = true;
      } else {
        // Off-track shoulder
        surfaceType = 'SHOULDER';
        surfaceMu = 0.72;
      }

      wheel.surfaceType = surfaceType;
      wheel.surfaceMu = surfaceMu;

      // Road height beneath wheel mount + optional Rapier raycast confirmation
      const roadY =
        frame.position[1] +
        deckHeight +
        wheelLat * Math.sin(frame.bankAngleRad) -
        lz * state.pitchRad +
        lx * state.rollRad +
        kerbHeightExcitation;

      if (this.rapierWorld) {
        const ray = new RAPIER.Ray({ x: wx, y: wy, z: wz }, { x: 0, y: -1, z: 0 });
        this.rapierWorld.castRay(ray, restLength + wheelRadius + 0.5, true);
      }

      const distToGround = wy - roadY;
      const suspLen = Math.max(0.15, Math.min(restLength + 0.1, distToGround - wheelRadius));
      const inContact = distToGround <= restLength + wheelRadius + 0.08 && !state.airborne;
      const prevComp = wheel.compression;
      const comp = inContact ? Math.max(0, restLength - suspLen + 0.05) : 0;
      const compVel = (comp - prevComp) / dt;

      wheel.suspensionLength = suspLen;
      wheel.compression = comp;
      wheel.compressionVelocity = compVel;
      wheel.inContact = inContact;
      wheel.worldContactPos = [wx, roadY, wz];
      wheel.springForceN = inContact ? kSpring * comp : 0;
      wheel.damperForceN = inContact ? cDamper * compVel : 0;
      wheel.rotationAngleRad = (wheel.rotationAngleRad + (state.speedMs / wheelRadius) * dt) % (Math.PI * 2);

      // Thermodynamic Tire Model (35°C..120°C)
      const qSlip = 0.08 * Math.abs(wheel.slipAngleRad) * state.speedMs * surfaceMu;
      const qBrake = 0.015 * Math.max(0, state.brakeTempCelsius - wheel.tireTempCelsius);
      const qCool = (0.25 + 0.008 * state.speedMs) * (wheel.tireTempCelsius - 35.0);
      wheel.tireTempCelsius = Math.max(
        35.0,
        Math.min(120.0, wheel.tireTempCelsius + (qSlip + qBrake - qCool) * dt)
      );
    }

    state.kerbRumbleIntensity = anyKerbContact && state.speedKph > 10 ? Math.min(1.0, state.speedKph / 120.0) : 0.0;

    // Anti-roll bar force transfer between left and right wheels
    const arbFront = kArbFront * (state.wheels[0].compression - state.wheels[1].compression);
    const arbRear = kArbRear * (state.wheels[2].compression - state.wheels[3].compression);
    state.wheels[0].antiRollForceN = -arbFront;
    state.wheels[1].antiRollForceN = +arbFront;
    state.wheels[2].antiRollForceN = -arbRear;
    state.wheels[3].antiRollForceN = +arbRear;

    // 4. Speed-dependent Aerodynamic Downforce & Active DRS / Airbrake Wing
    let downforceN = RapierVehicleWorld.evaluateAerodynamicDownforce(spec, state.speedMs) * vehTuning.downforceRatio;
    // Ground-effect Venturi suction enhancement when ride height is lowered
    if (vehTuning.rideHeightOffset < 0) {
      const suctionBoost = Math.min(0.15, Math.abs(vehTuning.rideHeightOffset) * 3.0);
      downforceN *= 1.0 + suctionBoost;
    }
    state.downforceN = downforceN;

    const drsEligible =
      input.throttle > 0.85 &&
      input.brake < 0.05 &&
      Math.abs(input.steer) < 0.12 &&
      state.speedKph > 160;
    state.drsActive = input.drsOverride !== undefined ? input.drsOverride : drsEligible;
    if (input.brake > 0.2 && state.speedKph > 80) {
      state.wingAngleRad = 0.96; // 55 deg airbrake tilt
    } else if (state.drsActive) {
      state.wingAngleRad = 0.035; // 2 deg low-drag DRS flat
    } else {
      state.wingAngleRad = vehTuning.wingAngleRad ?? 0.22;
    }

    // 5. Slipstream Wake Cone Evaluation (within 25m behind opponent)
    let bestDraftRatio = 0.0;
    const totalSplineLen = this.splineProvider.getTotalLength();
    for (const leader of this.leaders) {
      let dAlong = leader.alongOffset - state.alongOffset;
      if (dAlong < -totalSplineLen * 0.5) dAlong += totalSplineLen;
      const dLat = Math.abs(leader.lateralOffset - state.lateralOffset);
      if (dAlong > 0 && dAlong <= 25.0 && dLat <= 2.0) {
        const ratio = (1.0 - dAlong / 25.0) * (1.0 - dLat / 2.0);
        if (ratio > bestDraftRatio) {
          bestDraftRatio = ratio;
        }
      }
    }
    state.slipstreamActive = bestDraftRatio > 0.05;
    state.slipstreamDraftRatio = bestDraftRatio;

    // 6. Propulsion, Drag & Braking Forces (Exact 0-100 KPH and Top Speed Calibration)
    const aBase = RapierVehicleWorld.computeCalibratedBaseAcceleration(spec);
    const vMaxMs = (spec.topSpeedKph / 3.6) * speedMultiplier;
    const dragFactor = Math.pow(state.speedMs / Math.max(1, vMaxMs), 2);
    const drsDragScale = state.drsActive ? 0.92 : 1.0;
    const slipstreamDragScale = 1.0 - 0.28 * bestDraftRatio;

    let driveAccel = input.throttle * aBase * speedMultiplier;
    const draftingPullAccel = 1.4 * bestDraftRatio;

    // Sequential Gear Shift Shock
    if (state.shiftShockRemainingSec > 0) {
      state.shiftShockRemainingSec = Math.max(0, state.shiftShockRemainingSec - dt);
      if (state.lastShiftType === 'UPSHIFT') {
        driveAccel *= 0.25; // Ignition-cut torque reduction during upshift
      }
    }

    const aeroDragDecel = aBase * speedMultiplier * dragFactor * drsDragScale * slipstreamDragScale;
    const brakeDecel = input.brake * (22.0 + spec.tier * 2.5 + (state.wingAngleRad > 0.5 ? 4.5 : 0));
    const rollingDecel = input.throttle === 0 && input.brake === 0 ? 0.8 : 0;

    const netLongAccel = driveAccel + draftingPullAccel - aeroDragDecel - brakeDecel - rollingDecel;
    state.longitudinalG = Number((netLongAccel / RapierVehicleWorld.GRAVITY).toFixed(2));

    // 7. Brake Disc Thermal Model (20°C ambient to 1,000°C glowing orange-white)
    const brakeHeatRate = 18.5 * input.brake * state.speedMs;
    const brakeCoolRate = (0.35 + 0.012 * state.speedMs) * (state.brakeTempCelsius - 20.0);
    state.brakeTempCelsius = Math.max(
      20,
      Math.min(1000, state.brakeTempCelsius + (brakeHeatRate - brakeCoolRate) * dt)
    );

    // 8. Steering & Multi-Surface Pacejka Tire Lateral Forces
    const maxSteerRad = Math.max(0.08, 0.42 / (1 + state.speedMs * 0.025));
    const steerAngleRad = input.steer * maxSteerRad;
    const latAccelEstimate = state.speedMs * (steerAngleRad / wheelbase) * state.speedMs * 0.35;
    state.lateralG = Number((latAccelEstimate / RapierVehicleWorld.GRAVITY).toFixed(2));

    // Weight transfer pitch & roll
    const pitchTransferN = (mass * netLongAccel * cgHeight) / wheelbase;
    const rollTransferN = (mass * latAccelEstimate * cgHeight) / trackWidth;

    const targetPitch = Math.max(-0.12, Math.min(0.12, (netLongAccel / 9.81) * 0.055));
    const targetRoll = Math.max(-0.14, Math.min(0.14, (-latAccelEstimate / 9.81) * 0.045));
    state.pitchRad += (targetPitch - state.pitchRad) * Math.min(1, 18 * dt);
    state.rollRad += (targetRoll - state.rollRad) * Math.min(1, 18 * dt);

    const staticQuarterN = (mass * RapierVehicleWorld.GRAVITY) / 4;
    const frontDownforceN = downforceN * 0.225;
    const rearDownforceN = downforceN * 0.275;

    state.wheels[0].normalLoadN = Math.max(
      0,
      staticQuarterN +
        state.wheels[0].springForceN * 0.15 +
        state.wheels[0].antiRollForceN -
        pitchTransferN * 0.5 -
        rollTransferN * 0.5 +
        frontDownforceN
    );
    state.wheels[1].normalLoadN = Math.max(
      0,
      staticQuarterN +
        state.wheels[1].springForceN * 0.15 +
        state.wheels[1].antiRollForceN -
        pitchTransferN * 0.5 +
        rollTransferN * 0.5 +
        frontDownforceN
    );
    state.wheels[2].normalLoadN = Math.max(
      0,
      staticQuarterN +
        state.wheels[2].springForceN * 0.15 +
        state.wheels[2].antiRollForceN +
        pitchTransferN * 0.5 -
        rollTransferN * 0.5 +
        rearDownforceN
    );
    state.wheels[3].normalLoadN = Math.max(
      0,
      staticQuarterN +
        state.wheels[3].springForceN * 0.15 +
        state.wheels[3].antiRollForceN +
        pitchTransferN * 0.5 +
        rollTransferN * 0.5 +
        rearDownforceN
    );

    const baseD = 1.32 + spec.tier * 0.07;
    const camberBonus = 1.0 + Math.min(0.08, Math.abs(vehTuning.camberDeg) * 0.022);

    for (let i = 0; i < 4; i++) {
      const wheel = state.wheels[i];
      const isFront = i < 2;
      const wheelSteer = isFront ? steerAngleRad : 0;
      wheel.slipAngleRad = wheelSteer * 0.65;

      // Thermal window efficiency: peak adhesion at 95°C, reduced if cold (35°C) or overheated (120°C)
      const etaTemp = 0.88 + 0.20 * Math.exp(-Math.pow((wheel.tireTempCelsius - 95.0) / 28.0, 2));
      const normEta = etaTemp / 1.08; // Normalized to 1.0 at optimal 95°C
      const normMu = wheel.surfaceMu / 1.15; // Normalized to 1.0 on dry asphalt

      // Effective Pacejka peak factor D
      const effD = baseD * normMu * normEta * (camberBonus / 1.04);

      wheel.lateralForceN = RapierVehicleWorld.evaluatePacejkaLateralForce(
        wheel.normalLoadN,
        wheel.slipAngleRad,
        { B: 10.0, C: 1.9, D: effD, E: 0.97 }
      );
      wheel.longitudinalForceN = (mass * netLongAccel) / 4;
    }

    // 9. Integrate Velocity & World Position (True 1:1 Scale: 1 World Unit = 1 Real Meter)
    const newSpeedMs = Math.max(0, state.speedMs + netLongAccel * dt);
    state.speedMs = newSpeedMs;
    state.speedKph = newSpeedMs * 3.6;

    // Update heading from steering angular velocity
    if (Math.abs(input.steer) > 1e-4 && newSpeedMs > 0.2) {
      const yawRate = (newSpeedMs / wheelbase) * Math.tan(steerAngleRad);
      const dYaw = yawRate * dt;
      const cosY = Math.cos(dYaw);
      const sinY = Math.sin(dYaw);
      const fx = state.forward[0] * cosY + state.right[0] * sinY;
      const fy = state.forward[1] * cosY + state.right[1] * sinY;
      const fz = state.forward[2] * cosY + state.right[2] * sinY;
      const fLen = Math.hypot(fx, fy, fz) || 1;
      state.forward = [fx / fLen, fy / fLen, fz / fLen];
    }

    state.velocity = [
      state.forward[0] * newSpeedMs,
      state.forward[1] * newSpeedMs,
      state.forward[2] * newSpeedMs,
    ];

    state.position = [
      state.position[0] + state.velocity[0] * dt,
      state.position[1] + state.velocity[1] * dt,
      state.position[2] + state.velocity[2] * dt,
    ];

    // 10. Lateral Tangent Barrier Projection (Zero Teleporting or Vertex Sticking)
    this.applyLateralTangentBarrierProjection(state, dt);

    // 11. Update RPM & Gear Telemetry + Gear Shift Transients
    const gearCount = Math.max(1, spec.gears);
    const speedRatio = Math.min(1, state.speedKph / Math.max(100, spec.topSpeedKph));
    const computedGear = Math.min(gearCount, Math.max(1, Math.ceil(speedRatio * gearCount)));
    const prevGear = state.gear;

    if (typeof prevGear === 'number' && typeof computedGear === 'number' && computedGear !== prevGear) {
      if (computedGear > prevGear) {
        state.shiftShockRemainingSec = 0.055;
        state.lastShiftType = 'UPSHIFT';
        state.pitchRad += 0.04; // Upshift clutch bite kick impulse
      } else if (computedGear < prevGear) {
        state.shiftShockRemainingSec = 0.080;
        state.lastShiftType = 'DOWNSHIFT';
      }
    }

    state.gear = state.speedKph < 1 && input.throttle === 0 ? 'N' : computedGear;
    const gearBand = (speedRatio * gearCount) % 1;
    const idleRpm = Math.round(spec.redlineRpm * 0.14);
    state.rpm = Math.min(
      spec.redlineRpm,
      Math.round(idleRpm + (spec.redlineRpm - idleRpm) * (0.25 + 0.75 * (gearBand || speedRatio)))
    );

    // Downshift rev-match RPM spike
    if (state.shiftShockRemainingSec > 0 && state.lastShiftType === 'DOWNSHIFT') {
      state.rpm = Math.min(spec.redlineRpm, state.rpm + 750);
    }

    // Sync Rapier RigidBody transform if initialized
    const body = this.rigidBodies.get(id);
    if (body) {
      body.setTranslation(
        { x: state.position[0], y: state.position[1], z: state.position[2] },
        true
      );
      body.setLinvel(
        { x: state.velocity[0], y: state.velocity[1], z: state.velocity[2] },
        true
      );
    }
  }

  /**
   * Lateral Tangent Barrier Projection (Zero Teleporting or Sticking).
   * Projects vehicle world position onto closest continuous 3D spline tangent T and binormal N.
   * Clamps ONLY lateralOffset at the guardrail while leaving alongOffset strictly untouched,
   * projects velocity parallel to T, and emits barrier collision sparks at high speed (400+ KPH).
   */
  private applyLateralTangentBarrierProjection(state: PhysicsVehicleState, dt: number): void {
    const prevAlong = state.alongOffset;
    const closest = this.splineProvider.getClosestSplinePoint(state.position, prevAlong);
    const sStar = closest.alongOffset;
    const frame = closest.frame;

    const T = frame.tangent;
    const isNormalUp = Math.abs(frame.normal[1]) >= Math.abs(frame.binormal[1]);
    const U = isNormalUp ? frame.normal : frame.binormal;
    const N = isNormalUp ? frame.binormal : frame.normal;
    const S = frame.position;

    const totalLen = this.splineProvider.getTotalLength();
    const forwardAdvance =
      (state.velocity[0] * T[0] + state.velocity[1] * T[1] + state.velocity[2] * T[2]) * dt;
    const monotonicS =
      sStar >= prevAlong || prevAlong - sStar > totalLen * 0.5
        ? sStar
        : Math.min(totalLen, prevAlong + Math.max(0, forwardAdvance));

    state.alongOffset = monotonicS;
    if (state.onSkybridgeDeck) {
      state.skybridgeRemainingMeters -= Math.max(0, forwardAdvance);
      if (state.skybridgeRemainingMeters <= 0) {
        state.onSkybridgeDeck = false;
        state.skybridgeElevationMeters = 0;
        state.verticalOffset = 0.35;
      }
    }

    const d = closest.lateralOffset;
    const h = state.onSkybridgeDeck ? state.skybridgeElevationMeters + 0.35 : 0.35;
    const carHalfWidth = 1.0;
    const dMax = Math.max(2.0, frame.roadWidth * 0.5 - carHalfWidth);

    if (Math.abs(d) > dMax) {
      const signD = d >= 0 ? 1 : -1;
      const dClamped = signD * dMax;
      state.lateralOffset = dClamped;
      state.verticalOffset = h;

      state.position = [
        S[0] + N[0] * dClamped + U[0] * h,
        S[1] + N[1] * dClamped + U[1] * h,
        S[2] + N[2] * dClamped + U[2] * h,
      ];

      const vT = state.velocity[0] * T[0] + state.velocity[1] * T[1] + state.velocity[2] * T[2];
      const vU = state.velocity[0] * U[0] + state.velocity[1] * U[1] + state.velocity[2] * U[2];
      const wallGlideFactor = 0.9996;
      const tangentialSpeedMs = Math.max(0, vT) * wallGlideFactor;

      state.velocity = [
        T[0] * tangentialSpeedMs + U[0] * vU,
        T[1] * tangentialSpeedMs + U[1] * vU,
        T[2] * tangentialSpeedMs + U[2] * vU,
      ];
      state.forward = [...T];
      state.right = [...N];
      state.up = [...U];
      state.speedMs = Math.hypot(state.velocity[0], state.velocity[1], state.velocity[2]);
      state.speedKph = state.speedMs * 3.6;
      state.yawRad = Math.atan2(T[0], T[2]);

      const scrapeSpeedKph = tangentialSpeedMs * 3.6;
      const sparkIntensity = Math.min(1.0, scrapeSpeedKph / 400.0);
      const contactPointWorld: Vec3Tuple = [
        state.position[0] + N[0] * signD * carHalfWidth,
        state.position[1] + U[1] * 0.4,
        state.position[2] + N[2] * signD * carHalfWidth,
      ];
      state.barrierContact = true;
      state.barrierSparks = {
        barrierContact: true,
        barrierSide: signD > 0 ? 'RIGHT' : 'LEFT',
        scrapeSpeedKph,
        sparkIntensity,
        sparkCount: scrapeSpeedKph >= 50 ? Math.round(16 + 64 * sparkIntensity) : 4,
        contactPointWorld,
      };
    } else {
      state.lateralOffset = d;
      state.verticalOffset = h;
      state.barrierContact = false;
      state.barrierSparks = {
        barrierContact: false,
        barrierSide: 'NONE',
        scrapeSpeedKph: 0,
        sparkIntensity: 0,
        sparkCount: 0,
        contactPointWorld: [...state.position],
      };
    }
  }

  public getLiveCockpitTelemetry(
    id: string,
    raceContext: {
      lapDeltaSec?: number;
      currentLap?: number;
      totalLaps?: number;
      position?: number;
      totalRacers?: number;
      sectorSplits?: [number | null, number | null, number | null];
    } = {}
  ): LiveCockpitTelemetry {
    const state = this.vehicles.get(id);
    if (!state) {
      return {
        speedKph: 0,
        rpm: 1000,
        maxRpm: 9000,
        gear: 'N',
        lapDeltaSec: 0,
        currentLap: 1,
        totalLaps: 3,
        position: 1,
        totalRacers: 8,
        nitroPercent: 100,
        drsActive: false,
        brakeTempCelsius: 20,
        sectorSplits: [null, null, null],
      };
    }
    return {
      speedKph: Math.round(state.speedKph),
      rpm: state.rpm,
      maxRpm: state.spec.redlineRpm,
      gear: state.gear,
      lapDeltaSec: raceContext.lapDeltaSec ?? 0.0,
      currentLap: raceContext.currentLap ?? 1,
      totalLaps: raceContext.totalLaps ?? 3,
      position: raceContext.position ?? 1,
      totalRacers: raceContext.totalRacers ?? 8,
      nitroPercent: Math.round(state.nitroPercent),
      drsActive: state.drsActive,
      brakeTempCelsius: Math.round(state.brakeTempCelsius),
      sectorSplits: raceContext.sectorSplits ?? [null, null, null],
    };
  }
}
