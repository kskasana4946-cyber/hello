// src/physics/RapierVehicleWorld.ts
import RAPIER from '@dimforge/rapier3d-compat';
import {
  ISplineProvider,
  LiveCockpitTelemetry,
  SplineFrame,
  Vec3Tuple,
  VehicleSpec,
} from '../core/types';

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

  public getClosestSplinePoint(
    worldPos: Vec3Tuple,
    _hintS?: number
  ): { alongOffset: number; lateralOffset: number; verticalOffset: number; frame: SplineFrame } {
    const alongOffset = Math.max(0, Math.min(this.totalLengthMeters, worldPos[2]));
    const frame = this.getFrameAtArcLength(alongOffset);
    const dx = worldPos[0] - frame.position[0];
    const dy = worldPos[1] - frame.position[1];
    const dz = worldPos[2] - frame.position[2];
    const lateralOffset =
      dx * frame.binormal[0] + dy * frame.binormal[1] + dz * frame.binormal[2];
    const verticalOffset =
      dx * frame.normal[0] + dy * frame.normal[1] + dz * frame.normal[2];
    return {
      alongOffset,
      lateralOffset,
      verticalOffset,
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
    };

    this.vehicles.set(id, state);
    this.controls.set(id, { throttle: 0, brake: 0, steer: 0 });
    if (this.rapierInitialized) {
      this.createRapierBodyForVehicle(id, state);
    }
    return state;
  }

  private createRapierBodyForVehicle(id: string, state: PhysicsVehicleState): void {
    if (!this.rapierWorld || this.rigidBodies.has(id)) return;
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(state.position[0], state.position[1], state.position[2])
      .setLinearDamping(0.01)
      .setAngularDamping(0.5);
    const body = this.rapierWorld.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(0.95, 0.55, 2.2).setMass(state.spec.massKg);
    this.rapierWorld.createCollider(colliderDesc, body);
    this.rigidBodies.set(id, body);
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

  public getVehicleState(id: string): PhysicsVehicleState | undefined {
    return this.vehicles.get(id);
  }

  /**
   * Explicitly sets a vehicle's velocity in KPH along a heading relative to spline tangent T
   * (e.g. for testing 360 KPH = 100 m/s calibration or 485 KPH barrier collision).
   */
  public setVehicleSpeedAndHeading(
    id: string,
    speedKph: number,
    headingAngleRelativeToTangentRad = 0,
    lateralOffsetMeters?: number
  ): void {
    const state = this.vehicles.get(id);
    if (!state) return;
    const frame = this.splineProvider.getFrameAtArcLength(state.alongOffset);
    const isNormalUp = Math.abs(frame.normal[1]) >= Math.abs(frame.binormal[1]);
    const U = isNormalUp ? frame.normal : frame.binormal;
    const N = isNormalUp ? frame.binormal : frame.normal;
    if (lateralOffsetMeters !== undefined && Number.isFinite(lateralOffsetMeters)) {
      state.lateralOffset = lateralOffsetMeters;
      state.position = [
        frame.position[0] + N[0] * lateralOffsetMeters + U[0] * state.verticalOffset,
        frame.position[1] + N[1] * lateralOffsetMeters + U[1] * state.verticalOffset,
        frame.position[2] + N[2] * lateralOffsetMeters + U[2] * state.verticalOffset,
      ];
    }
    const safeSpeedKph = Number.isFinite(speedKph) ? Math.max(0, speedKph) : 0;
    const safeAngle = Number.isFinite(headingAngleRelativeToTangentRad) ? headingAngleRelativeToTangentRad : 0;
    const speedMs = safeSpeedKph / 3.6;
    const cosA = Math.cos(safeAngle);
    const sinA = Math.sin(safeAngle);
    const dir: Vec3Tuple = [
      frame.tangent[0] * cosA + N[0] * sinA,
      frame.tangent[1] * cosA + N[1] * sinA,
      frame.tangent[2] * cosA + N[2] * sinA,
    ];
    state.forward = dir;
    state.up = [...U];
    state.right = [...N];
    state.velocity = [dir[0] * speedMs, dir[1] * speedMs, dir[2] * speedMs];
    state.speedMs = speedMs;
    state.speedKph = safeSpeedKph;
  }

  /**
   * Tactical Ramp Type 1 Hook (F25): Launches vehicle onto an Elevated Skybridge Overpass
   * (+12m above main road with continuous 1.35x Overdrive Boost Strips).
   */
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

  /**
   * Tactical Ramp Type 2 Hook (F26): Flying through Mid-Air Plasma Boost Ring
   * grants +80% instant Nitro refill, 1.42x Hyper-Velocity Surge for 4.0s, and +2,500 CR.
   */
  public triggerPlasmaBoostRing(id: string): void {
    const state = this.vehicles.get(id);
    if (!state) return;
    state.nitroPercent = Math.min(100, state.nitroPercent + 80);
    state.plasmaSurgeRemainingSec = 4.0;
    state.activeSpeedMultiplier = Math.max(state.activeSpeedMultiplier, 1.42);
    state.stuntCreditsEarned += 2500;
  }

  /**
   * Tactical Ramp Type 3 Hook (F27): Evaluates touchdown from airborne jump.
   * Touching down at >180 KPH triggers ZERO (0%) landing slowdown, boosts forward speed
   * by +15% (1.15x), and blasts any AI rivals within 15m sideways!
   */
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
      // Zero landing slowdown + 15% forward kinetic shockwave boost
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

      const event: KineticShockwaveEvent = {
        triggered: true,
        timestampSec: this.simTimeSec,
        origin: [...state.position],
        landingSpeedKph: landingKph,
        forwardBoostMultiplier: 1.15,
        blastRadiusMeters: 15.0,
        blastedRivalIds,
      };
      state.lastShockwaveEvent = event;
      return event;
    }

    // Touchdown <= 180 KPH: normal suspension absorption (~4% damping loss), no shockwave
    state.velocity[0] *= 0.96;
    state.velocity[1] = 0;
    state.velocity[2] *= 0.96;
    state.speedMs = Math.hypot(state.velocity[0], state.velocity[1], state.velocity[2]);
    state.speedKph = state.speedMs * 3.6;
    state.lastShockwaveEvent = null;
    return null;
  }

  /**
   * Advances the physics simulation by dtSeconds using a fixed 240Hz (1/240s) sub-stepper.
   */
  public step(dtSeconds: number, maxSubSteps = 2400): number {
    const safeDt = Number.isFinite(dtSeconds) ? Math.max(0, dtSeconds) : 0;
    this.accumulatorSec += safeDt;
    let subStepsRun = 0;
    while (this.accumulatorSec + 1e-9 >= RapierVehicleWorld.FIXED_DT && subStepsRun < maxSubSteps) {
      this.stepSingleSubstep();
      this.accumulatorSec -= RapierVehicleWorld.FIXED_DT;
      subStepsRun++;
    }
    if (this.accumulatorSec < 0) this.accumulatorSec = 0;
    return subStepsRun;
  }

  /**
   * Executes an exact number of 240Hz sub-steps without accumulator rounding.
   */
  public stepSubsteps(subStepCount: number): void {
    for (let i = 0; i < subStepCount; i++) {
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

    // 3. 4-Wheel Spring-Damper Raycasts (FL, FR, RL, RR) + Anti-Roll Bars
    const fnHz = 2.6 + spec.tier * 0.18;
    const kSpring = (mass / 4) * Math.pow(2 * Math.PI * fnHz, 2);
    const cDamper = 2 * 0.85 * Math.sqrt(kSpring * (mass / 4));
    const kArbFront = kSpring * 0.35;
    const kArbRear = kSpring * 0.30;

    const mountOffsets: [number, number, number][] = [
      [-trackWidth / 2, restLength + wheelRadius, +wheelbase / 2], // FL
      [+trackWidth / 2, restLength + wheelRadius, +wheelbase / 2], // FR
      [-trackWidth / 2, restLength + wheelRadius, -wheelbase / 2], // RL
      [+trackWidth / 2, restLength + wheelRadius, -wheelbase / 2], // RR
    ];

    for (let i = 0; i < 4; i++) {
      const [lx, ly, lz] = mountOffsets[i];
      const wheel = state.wheels[i];
      const wx = state.position[0] + state.right[0] * lx + state.up[0] * ly + state.forward[0] * lz;
      const wy = state.position[1] + state.right[1] * lx + state.up[1] * ly + state.forward[1] * lz;
      const wz = state.position[2] + state.right[2] * lx + state.up[2] * ly + state.forward[2] * lz;
      wheel.worldMountPos = [wx, wy, wz];

      // Road height beneath wheel mount + optional Rapier raycast confirmation
      const roadY =
        frame.position[1] +
        deckHeight +
        (state.lateralOffset + lx) * Math.sin(frame.bankAngleRad) -
        lz * state.pitchRad +
        lx * state.rollRad;

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
    }

    // Anti-roll bar force transfer between left and right wheels
    const arbFront = kArbFront * (state.wheels[0].compression - state.wheels[1].compression);
    const arbRear = kArbRear * (state.wheels[2].compression - state.wheels[3].compression);
    state.wheels[0].antiRollForceN = -arbFront;
    state.wheels[1].antiRollForceN = +arbFront;
    state.wheels[2].antiRollForceN = -arbRear;
    state.wheels[3].antiRollForceN = +arbRear;

    // 4. Speed-dependent Aerodynamic Downforce & Active DRS / Airbrake Wing
    const downforceN = RapierVehicleWorld.evaluateAerodynamicDownforce(spec, state.speedMs);
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
      state.wingAngleRad = 0.22; // Standard downforce angle
    }

    // 5. Propulsion, Drag & Braking Forces (Exact 0-100 KPH and Top Speed Calibration)
    const aBase = RapierVehicleWorld.computeCalibratedBaseAcceleration(spec);
    const vMaxMs = (spec.topSpeedKph / 3.6) * speedMultiplier;
    const dragFactor = Math.pow(state.speedMs / Math.max(1, vMaxMs), 2);
    const drsDragScale = state.drsActive ? 0.92 : 1.0;

    const driveAccel = input.throttle * aBase * speedMultiplier;
    const aeroDragDecel = aBase * speedMultiplier * dragFactor * drsDragScale;
    const brakeDecel = input.brake * (22.0 + spec.tier * 2.5 + (state.wingAngleRad > 0.5 ? 4.5 : 0));
    const rollingDecel = input.throttle === 0 && input.brake === 0 ? 0.8 : 0;

    const netLongAccel = driveAccel - aeroDragDecel - brakeDecel - rollingDecel;

    // 6. Brake Disc Thermal Model (20°C ambient to 1,000°C glowing orange-white)
    const brakeHeatRate = 18.5 * input.brake * state.speedMs;
    const brakeCoolRate = (0.35 + 0.012 * state.speedMs) * (state.brakeTempCelsius - 20.0);
    state.brakeTempCelsius = Math.max(
      20,
      Math.min(1000, state.brakeTempCelsius + (brakeHeatRate - brakeCoolRate) * dt)
    );

    // 7. Steering & Pacejka Tire Lateral Forces
    const maxSteerRad = Math.max(0.08, 0.42 / (1 + state.speedMs * 0.025));
    const steerAngleRad = input.steer * maxSteerRad;
    const latAccelEstimate = state.speedMs * (steerAngleRad / wheelbase) * state.speedMs * 0.35;

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

    const peakD = 1.32 + spec.tier * 0.07;
    for (let i = 0; i < 4; i++) {
      const wheel = state.wheels[i];
      const isFront = i < 2;
      const wheelSteer = isFront ? steerAngleRad : 0;
      wheel.slipAngleRad = wheelSteer * 0.65;
      wheel.lateralForceN = RapierVehicleWorld.evaluatePacejkaLateralForce(
        wheel.normalLoadN,
        wheel.slipAngleRad,
        { B: 10.0, C: 1.9, D: peakD, E: 0.97 }
      );
      wheel.longitudinalForceN = (mass * netLongAccel) / 4;
    }

    // 8. Integrate Velocity & World Position (True 1:1 Scale: 1 World Unit = 1 Real Meter)
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

    // 9. Lateral Tangent Barrier Projection (F9: Zero Teleporting or Vertex Sticking)
    this.applyLateralTangentBarrierProjection(state, dt);

    // 10. Update RPM & Gear Telemetry
    const gearCount = Math.max(1, spec.gears);
    const speedRatio = Math.min(1, state.speedKph / Math.max(100, spec.topSpeedKph));
    const computedGear = Math.min(gearCount, Math.max(1, Math.ceil(speedRatio * gearCount)));
    state.gear = state.speedKph < 1 && input.throttle === 0 ? 'N' : computedGear;
    const gearBand = (speedRatio * gearCount) % 1;
    const idleRpm = Math.round(spec.redlineRpm * 0.14);
    state.rpm = Math.min(
      spec.redlineRpm,
      Math.round(idleRpm + (spec.redlineRpm - idleRpm) * (0.25 + 0.75 * (gearBand || speedRatio)))
    );

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
   * F9: Lateral Tangent Barrier Projection (Zero Teleporting or Sticking).
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

    // Along-offset is strictly determined by the closest spline projection (never yanked backward)
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
      // 1. Clamp ONLY lateralOffset (alongOffset sStar / monotonicS is NEVER modified)
      const signD = d >= 0 ? 1 : -1;
      const dClamped = signD * dMax;
      state.lateralOffset = dClamped;
      state.verticalOffset = h;

      state.position = [
        S[0] + N[0] * dClamped + U[0] * h,
        S[1] + N[1] * dClamped + U[1] * h,
        S[2] + N[2] * dClamped + U[2] * h,
      ];

      // 2. Project 3D velocity parallel to spline tangent T (strip outward normal velocity along N)
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

      // 3. Emit Barrier Spark Telemetry (especially at 400+ KPH)
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
