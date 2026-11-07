// src/main.ts
// Apex Grand Prix: Uncapped Next-Gen Edition
// Main Entry Point & Global Runtime Controller (M6: window.__APEX_GAME__)

import * as THREE from 'three';
import {
  AIDifficultyTier,
  CameraMode,
  CircuitLengthKm,
  GameLifecyclePhase,
  LiveCockpitTelemetry,
  RaceFormatId,
  SkyBiomeId,
  TrackBiomeId,
  VehicleSpec,
} from './core/types';

import { UncappedRenderer } from './core/UncappedRenderer';
import {
  PakStreamer,
  resolveSkyCanonicalId,
  resolveTrackCanonicalId,
} from './streaming/PakStreamer';
import { RapierVehicleWorld, PhysicsVehicleState } from './physics/RapierVehicleWorld';
import { SkyAtmosphereSystem } from './environment/SkyAtmosphereSystem';
import { SplineTrackStreamer } from './tracks/SplineTrackStreamer';
import { TacticalRamps } from './tracks/TacticalRamps';
import {
  VEHICLE_ROSTER,
  getVehicleById,
} from './vehicles/VehicleRoster';
import {
  buildVehicle,
  updateVehicle,
  setLivery,
  steerWheels,
  spinWheels,
  VehicleModelInstance,
} from './vehicles/HighPolyVehicleBuilder';
import { ProgressionManager } from './career/ProgressionManager';
import { BootLoadingScreen } from './ui/BootLoadingScreen';
import {
  PaddockShowroomUI,
  PBR_LIVERY_PRESETS,
  ModStudioTuning,
} from './ui/PaddockShowroomUI';
import { PostRaceRewardCeremony } from './ui/PostRaceRewardCeremony';
import { RaceHUD } from './ui/RaceHUD';
import {
  RacingAIDirector,
  AI_DIFFICULTY_SPECS,
  RACE_FORMAT_SPECS,
} from './ai/RacingAIDirector';
import { GranularSynthEngine } from './audio/GranularSynthEngine';
import { touchControls } from './ui/TouchControls';

// ============================================================================
// 1. Vehicle Builder Facade for Global Subsystems Inspection
// ============================================================================

export class VehicleBuilderFacade {
  public buildExterior(vehicleSpecOrId: VehicleSpec | string, liveryIndex: number = 0) {
    const spec =
      typeof vehicleSpecOrId === 'string'
        ? getVehicleById(vehicleSpecOrId) || VEHICLE_ROSTER[0]
        : vehicleSpecOrId || VEHICLE_ROSTER[0];
    const clampedLiveryIdx =
      typeof liveryIndex === 'number' && Number.isFinite(liveryIndex)
        ? Math.max(0, Math.min(11, Math.floor(liveryIndex)))
        : 0;
    const livery = PBR_LIVERY_PRESETS[clampedLiveryIdx];

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
      updateAeroAndBrakes(drsActive: boolean, brakeInput: number, brakeTempCelsius: number) {
        if (brakeInput > 0.2) {
          this.subMeshes.activeDrsRearWing.currentPitchRad =
            this.subMeshes.activeDrsRearWing.airbrakePitchRad;
        } else if (drsActive) {
          this.subMeshes.activeDrsRearWing.currentPitchRad =
            this.subMeshes.activeDrsRearWing.drsPitchRad;
        } else {
          this.subMeshes.activeDrsRearWing.currentPitchRad =
            this.subMeshes.activeDrsRearWing.cruisePitchRad;
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

  public buildCockpitAndGlass(vehicleSpecOrId: VehicleSpec | string) {
    const spec =
      typeof vehicleSpecOrId === 'string'
        ? getVehicleById(vehicleSpecOrId) || VEHICLE_ROSTER[0]
        : vehicleSpecOrId || VEHICLE_ROSTER[0];

    const glassMaterial = {
      shader: 'RefractiveGlass.glsl',
      ior: 1.52,
      f0Reflectance: Math.pow((1.0 - 1.52) / (1.0 + 1.52), 2),
      chromaticDispersion: 0.018,
      wiperPhase: 0.0,
      wiperSweepMaskActive: true,
      depthWrite: false,
      transparent: true,
      doubleSided: true,
      setIor(newIor: number) {
        const v = Number(newIor);
        this.ior = Number.isFinite(v) ? Math.max(1.0, v) : 1.52;
        this.f0Reflectance = Math.pow((1.0 - this.ior) / (1.0 + this.ior), 2);
        return this.ior;
      },
      evaluateFresnel(cosTheta: number) {
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
        leftDoorWindow: {
          framed: true,
          xBeltline: -0.88,
          xTopEdge: -0.74,
          tumblehomeInward: true,
          material: glassMaterial,
        },
        rightDoorWindow: {
          framed: true,
          xBeltline: 0.88,
          xTopEdge: 0.74,
          tumblehomeInward: true,
          material: glassMaterial,
        },
        bPillars: { left: true, right: true, finish: 'gloss_black' },
        cPillars: { left: true, right: true, finish: 'gloss_black' },
        beltlineTrim: { present: true, finish: spec.tier >= 3 ? 'carbon_weave' : 'chrome' },
        wingMirrors: { left: true, right: true, aerodynamic: true },
        rearBackglass: { sloped: true, present: true, material: glassMaterial },
        midEngineBayWindow: spec.hasTransparentEngineBay
          ? { present: true, transparent: true, material: glassMaterial }
          : null,
        engineBlock3D: spec.hasTransparentEngineBay
          ? {
              present: true,
              cylinders: spec.archetype.includes('v12')
                ? 12
                : spec.archetype.includes('w16')
                ? 16
                : 8,
              visibleThroughRearGlass: true,
            }
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
          activeShiftLedsCount: 0,
        },
        digitalScreen3D: {
          present: true,
          resolution: [512, 256],
          kphText: '0',
          gearText: 'N',
          rpmBarPercent: 0.0,
          lapDeltaText: '+0.00s',
        },
      },
      updateCockpitTelemetry(telemetry: LiveCockpitTelemetry, steerInput: number = 0.0) {
        this.cockpitInterior.steeringWheel.rotationZRad =
          -steerInput * this.cockpitInterior.steeringWheel.maxLockRad;
        const rpmNorm = Math.max(
          0.0,
          Math.min(1.0, telemetry.rpm / (telemetry.maxRpm || 8000))
        );
        this.cockpitInterior.steeringWheel.activeShiftLedsCount = Math.min(
          10,
          Math.floor(rpmNorm * 11)
        );
        this.cockpitInterior.digitalScreen3D.kphText = `${Math.round(telemetry.speedKph)}`;
        this.cockpitInterior.digitalScreen3D.gearText = `${telemetry.gear}`;
        this.cockpitInterior.digitalScreen3D.rpmBarPercent = Math.round(rpmNorm * 100);
        this.cockpitInterior.digitalScreen3D.lapDeltaText = `${
          telemetry.lapDeltaSec >= 0 ? '+' : ''
        }${telemetry.lapDeltaSec.toFixed(2)}s`;
        return this.cockpitInterior;
      },
    };
  }
}

// ============================================================================
// 2. Main Game Engine & Lifecycle Orchestrator
// ============================================================================

export function initApexGame(): any {
  // 1. Create / Query DOM Elements
  const container =
    typeof document !== 'undefined'
      ? document.getElementById('app') || document.body
      : null;
  const canvas =
    typeof document !== 'undefined'
      ? (document.getElementById('game-canvas') as HTMLCanvasElement) || undefined
      : undefined;

  // 2. Instantiate Core Engine Subsystems
  const pakStreamer = new PakStreamer({ maxVramBytes: 256 * 1024 * 1024 });

  // Attach resolveAssetAlias to pakStreamer for unified alias queries
  (pakStreamer as any).resolveAssetAlias = function (id: string) {
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error(`Unknown asset ID or invalid empty ID: "${id}"`);
    }
    const clean = id.trim();
    if (clean === 'sky_01' || clean === 'sky_golden_hour') {
      return { category: 'sky', canonicalId: 'sky_golden_hour', alias: 'sky_01' };
    }
    if (clean === 'sky_02' || clean === 'sky_neotokyo_cyber') {
      return { category: 'sky', canonicalId: 'sky_neotokyo_cyber', alias: 'sky_02' };
    }
    if (clean === 'sky_03' || clean === 'sky_redrock_canyon') {
      return { category: 'sky', canonicalId: 'sky_redrock_canyon', alias: 'sky_03' };
    }
    if (clean === 'sky_04' || clean === 'sky_alpine_glacier') {
      return { category: 'sky', canonicalId: 'sky_alpine_glacier', alias: 'sky_04' };
    }
    if (clean === 'track_01' || clean === 'track_golden_gp') {
      return { category: 'track', canonicalId: 'track_golden_gp', alias: 'track_01' };
    }
    if (clean === 'track_02' || clean === 'track_neotokyo') {
      return { category: 'track', canonicalId: 'track_neotokyo', alias: 'track_02' };
    }
    if (clean === 'track_03' || clean === 'track_canyon') {
      return { category: 'track', canonicalId: 'track_canyon', alias: 'track_03' };
    }
    if (clean === 'track_04' || clean === 'track_alpine') {
      return { category: 'track', canonicalId: 'track_alpine', alias: 'track_04' };
    }

    const carMatch = VEHICLE_ROSTER.find((v) => v.id === clean || v.pakDir === clean);
    if (carMatch) {
      return {
        category: 'vehicle',
        canonicalId: carMatch.pakDir,
        vehicleId: carMatch.id,
      };
    }
    throw new Error(`Unknown asset ID or out-of-range alias: "${clean}"`);
  };

  const renderer = new UncappedRenderer({
    canvas,
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
    vsyncHz: 144,
    ssaaScale: 1.0,
  });

  const splineStreamer = new SplineTrackStreamer(5.0, 'track_golden_gp', pakStreamer);
  const tacticalRamps = new TacticalRamps(splineStreamer);
  const physicsWorld = new RapierVehicleWorld(splineStreamer);
  (physicsWorld as any).dMax = 10.0;

  const vehicleBuilder = new VehicleBuilderFacade();
  const synthEngine = new GranularSynthEngine();
  const progression = new ProgressionManager();
  const aiDirector = new RacingAIDirector(splineStreamer, synthEngine);

  // Initialize player physics vehicle
  const initialSpec = VEHICLE_ROSTER[0]; // 'mini_jcw' (Tier 0 free car)
  (physicsWorld as any).vehicleSpec = initialSpec;
  const initialPhysState = physicsWorld.addVehicle('player', initialSpec, 0, 0);
  (physicsWorld as any).state = initialPhysState;
  (physicsWorld as any).setVehicleSpec = function (specOrId: any) {
    const s =
      typeof specOrId === 'string'
        ? getVehicleById(specOrId) || VEHICLE_ROSTER[0]
        : specOrId;
    (this as any).vehicleSpec = s;
    (this as any).state.spec = s;
    return s;
  };
  (physicsWorld as any).resetVehicleState = function (
    vehicleIdOrPos?: any,
    posOrForward?: any,
    maybeForward?: any
  ) {
    let customPos: [number, number, number] | undefined;
    let customForward: [number, number, number] | undefined;

    if (Array.isArray(vehicleIdOrPos)) {
      customPos = vehicleIdOrPos as [number, number, number];
      if (Array.isArray(posOrForward)) {
        customForward = posOrForward as [number, number, number];
      }
    } else if (typeof vehicleIdOrPos === 'string') {
      if (Array.isArray(posOrForward)) {
        customPos = posOrForward as [number, number, number];
      }
      if (Array.isArray(maybeForward)) {
        customForward = maybeForward as [number, number, number];
      }
    }

    const s = (this as any).state;
    if (s) {
      s.speedMs = 0;
      s.speedKph = 0;
      s.velocity = [0, 0, 0];
      s.alongOffset = 0;
      s.lateralOffset = 0;
      s.verticalOffset = 0.35;
      s.pitchRad = 0;
      s.rollRad = 0;
      s.gear = 1;
      s.rpm = 1000;
      s.nitroPercent = 100;
      s.brakeTempCelsius = 20;
      s.airborne = false;
      s.airborneTimeSec = 0;
      s.onSkybridgeDeck = false;
      s.barrierContact = false;
      s.plasmaSurgeRemainingSec = 0;
      s.activeSpeedMultiplier = 1.0;
      s.shiftShockRemainingSec = 0;

      const frame = splineStreamer.getFrameAtArcLength(0);
      const rideHeight = 0.35;
      const isNormalUp = Math.abs(frame.normal[1]) >= Math.abs(frame.binormal[1]);
      const U = isNormalUp ? frame.normal : frame.binormal;
      const N = isNormalUp ? frame.binormal : frame.normal;

      if (customPos) {
        s.position = [customPos[0], customPos[1], customPos[2]];
      } else {
        s.position = [
          frame.position[0] + U[0] * rideHeight,
          frame.position[1] + U[1] * rideHeight,
          frame.position[2] + U[2] * rideHeight,
        ];
      }

      if (customForward) {
        const len = Math.hypot(customForward[0], customForward[1], customForward[2]) || 1;
        s.forward = [customForward[0] / len, customForward[1] / len, customForward[2] / len];
      } else {
        s.forward = [...frame.tangent];
      }

      s.up = [...U];
      s.right = [...N];
      s.yawRad = Math.atan2(s.forward[0], s.forward[2]);

      if (Array.isArray(s.wheels)) {
        for (const w of s.wheels) {
          w.worldMountPos = [...s.position];
          w.worldContactPos = [s.position[0], s.position[1] - rideHeight, s.position[2]];
          w.suspensionLength = 0.35;
          w.compression = 0.05;
          w.compressionVelocity = 0;
          w.inContact = true;
          w.damperForceN = 0;
          w.antiRollForceN = 0;
          w.slipAngleRad = 0;
          w.lateralForceN = 0;
          w.longitudinalForceN = 0;
          w.rotationAngleRad = 0;
          w.tireTempCelsius = 85.0;
        }
      }
    }
  };

  // 3. UI Screens
  let isSyncingPaddock = false;
  const bootLoadingScreen = new BootLoadingScreen(container, () => {
    controller.completeBoot();
  });
  const paddockUI = new PaddockShowroomUI(progression, container);
  paddockUI.onLaunchRaceCallback = () => {
    controller.launchRace();
  };
  paddockUI.onVehicleSelectCallback = (vehId: string) => {
    if (!isSyncingPaddock) {
      controller.selectVehicle(vehId);
    }
  };
  paddockUI.onLiverySelectCallback = (liveryIdx: number) => {
    if (!isSyncingPaddock) {
      controller.selectLivery(liveryIdx);
    }
  };
  paddockUI.onCircuitConfigCallback = (cfg: any) => {
    if (!isSyncingPaddock) {
      controller.setCircuitConfig(cfg);
    }
  };

  const postRaceCeremony = new PostRaceRewardCeremony(container, null);
  (postRaceCeremony as any).onReturnToPaddockCallback = () => {
    controller.returnToPaddock();
  };
  const raceHUD = new RaceHUD(container);
  // Hide RaceHUD during BOOT and PADDOCK so it never overlaps the Paddock Showroom
  raceHUD.setVisible(false);
  raceHUD.onReturnToPaddockCallback = () => {
    controller.returnToPaddock();
  };
  raceHUD.onCycleCameraCallback = () => {
    controller.cycleCameraMode();
  };
  raceHUD.onToggleAudioCallback = () => {
    controller.toggleAudioMute();
  };

  // 4. Three.js Scene Setup, 5-Point Studio Lighting Rig & Showroom Studio Environment
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a14);
  const camera = new THREE.PerspectiveCamera(
    72,
    (typeof window !== 'undefined' ? window.innerWidth : 1280) /
      (typeof window !== 'undefined' ? window.innerHeight : 720),
    0.1,
    3000
  );

  // Create and assign analytical studio PMREM environment cubemap for realistic reflections
  function createStudioEnvironmentMap(uncappedRenderer: UncappedRenderer): THREE.Texture {
    const gl = (uncappedRenderer as any).webglRenderer as THREE.WebGLRenderer | null;
    if (!gl) {
      const data = new Uint8Array([
        210, 225, 255, 255,
        130, 150, 185, 255,
        70, 85, 110, 255,
        30, 38, 55, 255,
      ]);
      const tex = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.needsUpdate = true;
      return tex;
    }

    try {
      const pmremGenerator = new THREE.PMREMGenerator(gl);
      pmremGenerator.compileEquirectangularShader();

      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x060c18);

      const softboxMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const ceiling1 = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), softboxMat);
      ceiling1.position.set(0, 7, 0);
      ceiling1.rotation.x = Math.PI / 2;
      envScene.add(ceiling1);

      const ceiling2 = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), softboxMat);
      ceiling2.position.set(4, 6, -3);
      ceiling2.rotation.x = Math.PI / 2;
      envScene.add(ceiling2);

      const rimBoxMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd });
      const rim1 = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), rimBoxMat);
      rim1.position.set(-6, 4, -8);
      rim1.lookAt(0, 0, 0);
      envScene.add(rim1);

      const renderTarget = pmremGenerator.fromScene(envScene, 0.04);
      pmremGenerator.dispose();
      return renderTarget.texture;
    } catch {
      const data = new Uint8Array([
        210, 225, 255, 255,
        130, 150, 185, 255,
        70, 85, 110, 255,
        30, 38, 55, 255,
      ]);
      const tex = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.needsUpdate = true;
      return tex;
    }
  }

  const studioEnvMap = createStudioEnvironmentMap(renderer);
  scene.environment = studioEnvMap;

  // 5-Point Studio Lighting Rig (Overhead Softbox, Warm Key, Cool Rim, Side Fill, Ground Bounce)
  const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x334155, 1.6);
  scene.add(hemiLight);

  // 1. Overhead Downward Softbox (Illuminates hood, roof, deck)
  const overheadSoftbox = new THREE.DirectionalLight(0xffffff, 4.0);
  overheadSoftbox.position.set(0, 6, 0);
  overheadSoftbox.target.position.set(0, 0, 0);
  scene.add(overheadSoftbox);
  scene.add(overheadSoftbox.target);

  // 2. Front 3/4 Key Light (Warm white, primary shape definition)
  const keyLight = new THREE.DirectionalLight(0xfffaf0, 3.5);
  keyLight.position.set(5, 4, 6);
  keyLight.castShadow = true;
  scene.add(keyLight);

  // 3. Rear 3/4 Rim / Kicker Light (Cool white, prevents dark rear silhouettes)
  const rimLight = new THREE.DirectionalLight(0xecfeff, 3.0);
  rimLight.position.set(-5, 3.5, -6);
  scene.add(rimLight);

  // 4. Side Soft Fill Light (Illuminates doors, wheels, rockers)
  const sideFill = new THREE.DirectionalLight(0xdbeafe, 2.0);
  sideFill.position.set(7, 2, -2);
  scene.add(sideFill);

  // 5. Upward Ground Bounce Light (Eliminates pitch-black undersides)
  const groundBounce = new THREE.DirectionalLight(0x334155, 1.5);
  groundBounce.position.set(0, -1, 0);
  scene.add(groundBounce);

  // 3D Luxury Showroom Studio Environment
  const showroomGroup = new THREE.Group();
  showroomGroup.name = 'ShowroomStudioEnvironment';

  // Infinity Cyclorama Dark Backdrop (#0b1120 to #020617)
  const cyclorama = new THREE.Mesh(
    new THREE.CylinderGeometry(28, 28, 14, 64, 1, true, -Math.PI * 0.75, Math.PI * 1.5),
    new THREE.MeshStandardMaterial({
      color: 0x060c18,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.BackSide,
    })
  );
  cyclorama.position.y = 5.0;
  showroomGroup.add(cyclorama);

  // Polished Dark Reflective Floor
  const studioFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(32, 32, 0.2, 64),
    new THREE.MeshStandardMaterial({
      color: 0x040812,
      metalness: 0.90,
      roughness: 0.12,
    })
  );
  studioFloor.position.y = -0.12;
  showroomGroup.add(studioFloor);

  // Turntable Plinth
  const turntablePlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(3.55, 3.75, 0.08, 64),
    new THREE.MeshStandardMaterial({
      color: 0x0c1322,
      metalness: 0.92,
      roughness: 0.14,
    })
  );
  turntablePlinth.position.y = -0.03;
  showroomGroup.add(turntablePlinth);

  // Concentric Cyan/White Neon Rings (#00f0ff outer, #ffffff inner)
  const turntableCyanRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.60, 0.035, 16, 96),
    new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 3.2,
      roughness: 0.1,
    })
  );
  turntableCyanRing.rotation.x = Math.PI / 2;
  turntableCyanRing.position.y = 0.01;
  showroomGroup.add(turntableCyanRing);

  const turntableInnerRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.45, 0.025, 12, 72),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xdbeafe,
      emissiveIntensity: 2.2,
    })
  );
  turntableInnerRing.rotation.x = Math.PI / 2;
  turntableInnerRing.position.y = 0.015;
  showroomGroup.add(turntableInnerRing);

  // Ambient Occlusion Ground Contact Shadow directly under car chassis
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 2.4),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.005;
  showroomGroup.add(contactShadow);

  // Overhead Softbox Light Strips
  const softboxMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xf8fafc,
    emissiveIntensity: 3.5,
  });
  for (const sbX of [-2.4, 0.0, 2.4]) {
    const softbox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 6.5), softboxMat);
    softbox.position.set(sbX, 4.8, 0);
    showroomGroup.add(softbox);
  }

  // Architectural Studio Columns with Accent Lights
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x0b1120,
    metalness: 0.75,
    roughness: 0.25,
  });
  const accentStripMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x0284c7,
    emissiveIntensity: 2.2,
  });
  for (let pIdx = 0; pIdx < 8; pIdx++) {
    const pAngle = (pIdx / 8) * Math.PI * 2;
    const pRadius = 11.5;
    const px = Math.cos(pAngle) * pRadius;
    const pz = Math.sin(pAngle) * pRadius;
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.7, 6.5, 0.7), pillarMat);
    col.position.set(px, 3.1, pz);
    col.lookAt(0, 3.1, 0);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.8, 0.74), accentStripMat);
    col.add(strip);
    showroomGroup.add(col);
  }
  scene.add(showroomGroup);

  const skyAtmosphere = new SkyAtmosphereSystem({ pakStreamer });
  skyAtmosphere.initialize(scene, renderer);
  (skyAtmosphere as any).rootGroup.visible = false; // Hide outdoor SkyDome in showroom

  // Attach Track Streamer & Tactical Ramps to Scene (hidden while in Showroom)
  splineStreamer.attachToScene(scene);
  tacticalRamps.attachToScene(scene);
  (splineStreamer as any).sceneRoot.visible = false;
  (tacticalRamps as any).sceneRoot.visible = false;

  // Player & AI Rival 3D Vehicle Visual Instances
  let currentVehicleModel: VehicleModelInstance | null = null;
  const aiRivalModels: VehicleModelInstance[] = [];

  if (typeof document !== 'undefined') {
    try {
      currentVehicleModel = buildVehicle(initialSpec, 0);
      scene.add(currentVehicleModel.rootGroup);
    } catch {}
  }

  // Realistic Motorsport VFX Particle Pool (Tire Smoke & Barrier Sparks)
  interface MotorsportParticle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    kind: 'smoke' | 'spark';
  }
  const vfxGroup = new THREE.Group();
  vfxGroup.name = 'RealisticMotorsportVFX';
  scene.add(vfxGroup);
  const activeParticles: MotorsportParticle[] = [];

  const smokeGeom = new THREE.SphereGeometry(0.22, 8, 8);
  const sparkGeom = new THREE.BoxGeometry(0.05, 0.05, 0.35);

  function spawnMotorsportParticle(
    origin: THREE.Vector3,
    vel: THREE.Vector3,
    kind: 'smoke' | 'spark'
  ) {
    if (typeof document === 'undefined' || activeParticles.length > 75) return;
    const mat =
      kind === 'smoke'
        ? new THREE.MeshStandardMaterial({
            color: 0xd1d5db,
            transparent: true,
            opacity: 0.42,
            roughness: 0.9,
            depthWrite: false,
          })
        : new THREE.MeshStandardMaterial({
            color: 0xffa500,
            emissive: 0xff5500,
            emissiveIntensity: 3.5,
            transparent: true,
            opacity: 0.95,
          });
    const mesh = new THREE.Mesh(kind === 'smoke' ? smokeGeom : sparkGeom, mat);
    mesh.position.copy(origin);
    vfxGroup.add(mesh);
    activeParticles.push({
      mesh,
      velocity: vel.clone(),
      life: 0,
      maxLife: kind === 'smoke' ? 0.55 : 0.28,
      kind,
    });
  }

  function updateMotorsportParticles(dt: number) {
    for (let i = activeParticles.length - 1; i >= 0; i--) {
      const p = activeParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        vfxGroup.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        activeParticles.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.velocity, dt);
      const frac = p.life / p.maxLife;
      const mat = p.mesh.material as THREE.MeshStandardMaterial;
      if (p.kind === 'smoke') {
        p.velocity.y += 1.2 * dt;
        const s = 1.0 + frac * 2.4;
        p.mesh.scale.set(s, s, s);
        mat.opacity = 0.42 * (1.0 - frac);
      } else {
        p.velocity.y -= 9.8 * dt;
        mat.opacity = 1.0 - frac;
      }
    }
  }

  function rebuildAiRivalModels() {
    for (const m of aiRivalModels) {
      scene.remove(m.rootGroup);
    }
    aiRivalModels.length = 0;
    if (typeof document === 'undefined') return;

    for (let i = 0; i < aiDirector.racers.length; i++) {
      const rival = aiDirector.racers[i];
      const spec =
        getVehicleById((rival as any).vehicleId) ||
        VEHICLE_ROSTER[(i + 4) % VEHICLE_ROSTER.length];
      try {
        const model = buildVehicle(spec, (i + 1) % 12);
        scene.add(model.rootGroup);
        aiRivalModels.push(model);
      } catch {}
    }
  }

  // 5. Game Lifecycle State
  let phase: GameLifecyclePhase = 'BOOT';
  let bootProgress = 0.0;
  let bootRpm = 0;
  let activeTab: 1 | 2 | 3 | 4 = 1;
  let selectedVehicleId = 'mini_jcw';
  let selectedLiveryIndex = 0;
  let selectedTrackId: TrackBiomeId = 'track_golden_gp';
  let selectedSkyId: SkyBiomeId = 'sky_golden_hour';
  let selectedDistanceKm: CircuitLengthKm = 5.0;
  let selectedFormat: RaceFormatId = 'GRAND_PRIX_3_LAPS';
  let selectedAiDifficulty: AIDifficultyTier = 'HARD';
  let cameraMode: CameraMode = 'CHASE';
  let currentTuning: ModStudioTuning = {
    rideHeightOffset: 0.0,
    wingAngleRad: 0.16,
    camberDeg: -1.5,
    downforceRatio: 1.0,
    suspensionStiffness: 1.0,
  };

  let isAudioMuted = false;
  let savedMasterVolume = 0.85;

  // Interactive Showroom Orbit Camera State
  let showroomOrbitYaw = 0.55;
  let showroomOrbitPitch = 0.28;
  let showroomOrbitDistance = 5.2;
  let isDraggingShowroom = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  let activeExterior = vehicleBuilder.buildExterior(selectedVehicleId, selectedLiveryIndex);
  let activeCockpit = vehicleBuilder.buildCockpitAndGlass(selectedVehicleId);

  // 6. User Input State (Keyboard & Showroom Mouse Orbit)
  const keysDown = new Set<string>();
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      keysDown.add(e.code);

      // Audio resume on first user interaction
      synthEngine.resumeAudio();

      // Keyboard navigation
      if ((e.code === 'Space' || e.code === 'Enter') && phase === 'PADDOCK') {
        e.preventDefault();
        keysDown.delete('Space');
        controller.launchRace();
        return;
      } else if (e.code === 'Escape' && phase === 'RACING') {
        controller.returnToPaddock();
      } else if (e.code === 'KeyQ' && phase === 'PADDOCK') {
        controller.pressTabKey('KeyQ');
      } else if (e.code === 'KeyE' && phase === 'PADDOCK') {
        controller.pressTabKey('KeyE');
      } else if (e.code === 'KeyC') {
        controller.cycleCameraMode();
      } else if (e.code === 'KeyM') {
        controller.toggleAudioMute();
      } else if (e.code === 'Digit1') {
        controller.setCameraMode('CHASE');
      } else if (e.code === 'Digit2') {
        controller.setCameraMode('COCKPIT');
      } else if (e.code === 'Digit3') {
        controller.setCameraMode('HOOD');
      } else if (e.code === 'Digit4') {
        controller.setCameraMode('ORBIT');
      } else if (e.code === 'Digit5') {
        controller.setCameraMode('SHOWROOM');
      }
    });

    window.addEventListener('keyup', (e) => {
      keysDown.delete(e.code);
    });

    // Mouse-drag orbit & scroll-wheel zoom for Showroom 3D camera
    window.addEventListener('pointerdown', (e) => {
      // Audio resume on any user click / tap
      synthEngine.resumeAudio();

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'BUTTON' || target.tagName === 'SELECT' || target.closest('#paddock-tab-content') || target.closest('#docked-launch-bar') || target.closest('header') || target.closest('nav'))) {
        return;
      }
      isDraggingShowroom = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDraggingShowroom || phase !== 'PADDOCK') return;
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      showroomOrbitYaw -= dx * 0.008;
      showroomOrbitPitch = Math.max(0.08, Math.min(0.85, showroomOrbitPitch + dy * 0.006));
    });

    window.addEventListener('pointerup', () => {
      isDraggingShowroom = false;
    });

    window.addEventListener('wheel', (e) => {
      if (phase !== 'PADDOCK') return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest('#paddock-tab-content')) return;
      showroomOrbitDistance = Math.max(3.4, Math.min(8.5, showroomOrbitDistance + e.deltaY * 0.003));
    });

    window.addEventListener('resize', () => {
      if (renderer) {
        renderer.resize(window.innerWidth, window.innerHeight);
      }
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });
  }

  // 7. Global Application Controller Contract
  const controller: any = {
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

    setBootProgress(progress0to1: number) {
      const p = Math.max(0.0, Math.min(1.0, Number(progress0to1) || 0.0));
      bootProgress = p;
      bootRpm = Math.round(p * 12000);
      bootLoadingScreen.setBootProgress(p);
      return {
        bootProgress,
        bootRpm,
        subsystems: {
          vehiclesMb: Number((p * 320.0).toFixed(1)),
          tracksMb: Number((p * 320.0).toFixed(1)),
          skyMb: Number((p * 100.0).toFixed(1)),
          coreMb: Number((p * 60.0).toFixed(1)),
        },
      };
    },

    completeBoot() {
      if (phase !== 'BOOT') {
        return this.getState();
      }
      bootProgress = 1.0;
      bootRpm = 12000;
      bootLoadingScreen.completeBoot();
      synthEngine.playV12IgnitionRoar();
      phase = 'PADDOCK';
      activeTab = 1;
      cameraMode = 'SHOWROOM';
      renderer.setCameraMode('SHOWROOM');
      paddockUI.setVisible(true);
      raceHUD.setVisible(false);
      showroomGroup.visible = true;
      (skyAtmosphere as any).rootGroup.visible = false;
      (splineStreamer as any).sceneRoot.visible = false;
      (tacticalRamps as any).sceneRoot.visible = false;
      return this.getState();
    },

    selectTab(tabIndex: number | string) {
      const t = Number(tabIndex);
      if (!Number.isFinite(t)) {
        activeTab = 1;
      } else {
        activeTab = Math.max(1, Math.min(4, Math.floor(t))) as 1 | 2 | 3 | 4;
      }
      paddockUI.selectTab(activeTab);
      if (phase === 'PADDOCK') {
        renderer.setCameraMode('SHOWROOM');
      }
      return this.getState();
    },

    pressTabKey(key: string) {
      if (key === 'KeyE' || key === 'e' || key === 'E') {
        activeTab = activeTab >= 4 ? 1 : ((activeTab + 1) as 1 | 2 | 3 | 4);
      } else if (key === 'KeyQ' || key === 'q' || key === 'Q') {
        activeTab = activeTab <= 1 ? 4 : ((activeTab - 1) as 1 | 2 | 3 | 4);
      }
      paddockUI.selectTab(activeTab);
      return this.getState();
    },

    selectVehicle(vehicleIdOrPakDir: string) {
      const spec = VEHICLE_ROSTER.find(
        (v) => v.id === vehicleIdOrPakDir || v.pakDir === vehicleIdOrPakDir
      );
      if (!spec) return this.getState();

      const unlocked = progression.getUnlockedVehicleIds();
      if (!unlocked.includes(spec.id)) {
        // Locked vehicle cannot be selected unless unlocked or Sandbox is ON
        return this.getState();
      }

      selectedVehicleId = spec.id;
      isSyncingPaddock = true;
      try {
        paddockUI.selectVehicle(spec.id);
      } finally {
        isSyncingPaddock = false;
      }
      (physicsWorld as any).setVehicleSpec(spec);
      activeExterior = vehicleBuilder.buildExterior(spec, selectedLiveryIndex);
      activeCockpit = vehicleBuilder.buildCockpitAndGlass(spec);

      // Rebuild 3D visual model
      if (typeof document !== 'undefined') {
        try {
          if (currentVehicleModel) {
            scene.remove(currentVehicleModel.rootGroup);
          }
          currentVehicleModel = buildVehicle(spec, selectedLiveryIndex);
          scene.add(currentVehicleModel.rootGroup);
        } catch {}
      }

      return this.getState();
    },

    selectLivery(liveryIndex: number) {
      const raw = Number(liveryIndex);
      if (!Number.isFinite(raw)) {
        selectedLiveryIndex = 0;
      } else {
        selectedLiveryIndex = Math.max(0, Math.min(11, Math.floor(raw)));
      }
      isSyncingPaddock = true;
      try {
        paddockUI.selectLivery(selectedLiveryIndex);
      } finally {
        isSyncingPaddock = false;
      }
      activeExterior = vehicleBuilder.buildExterior(selectedVehicleId, selectedLiveryIndex);
      if (currentVehicleModel) {
        setLivery(currentVehicleModel, selectedLiveryIndex);
      }
      return this.getState();
    },

    setCircuitConfig(config: any = {}) {
      if (config.trackId !== undefined) {
        try {
          const resolved = (pakStreamer as any).resolveAssetAlias(config.trackId);
          if (resolved.category === 'track') {
            selectedTrackId = resolved.canonicalId as TrackBiomeId;
          }
        } catch {}
      }
      if (config.skyId !== undefined) {
        try {
          const resolved = (pakStreamer as any).resolveAssetAlias(config.skyId);
          if (resolved.category === 'sky') {
            selectedSkyId = resolved.canonicalId as SkyBiomeId;
            if (typeof window !== 'undefined') { skyAtmosphere.loadSky(selectedSkyId).catch(() => {}); }
          }
        } catch {}
      }
      if (config.distanceKm !== undefined) {
        const res = splineStreamer.configure(config.distanceKm, selectedTrackId);
        selectedDistanceKm = res.distanceKm;
        tacticalRamps.rebuildRamps();
      } else {
        splineStreamer.configure(selectedDistanceKm, selectedTrackId);
      }
      if (
        config.format !== undefined &&
        RACE_FORMAT_SPECS[config.format as RaceFormatId]
      ) {
        selectedFormat = config.format as RaceFormatId;
      }
      if (
        config.aiDifficulty !== undefined &&
        AI_DIFFICULTY_SPECS[config.aiDifficulty as AIDifficultyTier]
      ) {
        selectedAiDifficulty = config.aiDifficulty as AIDifficultyTier;
      }
      aiDirector.configure(selectedAiDifficulty, selectedFormat);
      isSyncingPaddock = true;
      try {
        paddockUI.setCircuitConfig({
          trackId: selectedTrackId,
          skyId: selectedSkyId,
          distanceKm: selectedDistanceKm,
          format: selectedFormat,
          aiDifficulty: selectedAiDifficulty,
        });
      } finally {
        isSyncingPaddock = false;
      }
      return this.getState();
    },

    toggleSandboxUnlockAll(forceState?: boolean) {
      progression.toggleSandboxUnlockAll(forceState);
      paddockUI.toggleSandboxUnlockAll(forceState);
      return this.getState();
    },

    launchRace() {
      // Clear any pending Space key so handbrake is NOT locked on race entry
      keysDown.delete('Space');

      splineStreamer.configure(selectedDistanceKm, selectedTrackId);
      tacticalRamps.rebuildRamps();
      if (typeof window !== 'undefined') { skyAtmosphere.loadSky(selectedSkyId).catch(() => {}); }
      (physicsWorld as any).setVehicleSpec(selectedVehicleId);
      (physicsWorld as any).resetVehicleState();
      aiDirector.configure(selectedAiDifficulty, selectedFormat);

      // Stream initial lookahead window of 3D track sectors around starting line
      splineStreamer.streamLookaheadWindow(0, splineStreamer.getTotalLength(), 2, 6);
      showroomGroup.visible = false;
      (skyAtmosphere as any).rootGroup.visible = true;
      (splineStreamer as any).sceneRoot.visible = true;
      (tacticalRamps as any).sceneRoot.visible = true;

      // Spawn 3D AI Rival cars on the grid
      rebuildAiRivalModels();

      // Step physics once at true 240Hz fixed sub-step (FIXED_DT = 1/240s)
      physicsWorld.step(RapierVehicleWorld.FIXED_DT);

      phase = 'RACING';
      paddockUI.setVisible(false);
      raceHUD.setVisible(true);
      if (typeof document !== 'undefined') {
        const paddockEl = document.getElementById('apex-paddock-showroom-ui');
        if (paddockEl) paddockEl.style.display = 'none';
      }
      if (cameraMode === 'SHOWROOM') {
        cameraMode = 'CHASE';
      }
      renderer.setCameraMode(cameraMode);

      // Snap camera directly behind player vehicle on start grid
      const pState = (physicsWorld as any).state;
      if (pState && camera) {
        const startPos = new THREE.Vector3(...pState.position);
        const startFwd = new THREE.Vector3(...pState.forward);
        const startUp = new THREE.Vector3(0, 1, 0);
        camera.position
          .copy(startPos)
          .sub(startFwd.clone().multiplyScalar(6.2))
          .add(startUp.clone().multiplyScalar(2.15));
        camera.lookAt(
          startPos
            .clone()
            .add(startFwd.clone().multiplyScalar(4.5))
            .add(startUp.clone().multiplyScalar(0.45))
        );
      }

      return this.getState();
    },

    setCameraMode(mode: CameraMode) {
      const valid = ['CHASE', 'COCKPIT', 'HOOD', 'ORBIT', 'SHOWROOM'];
      if (valid.includes(mode)) {
        cameraMode = mode;
        renderer.setCameraMode(mode);
      }
      return this.getState();
    },

    cycleCameraMode() {
      const order: CameraMode[] = ['CHASE', 'COCKPIT', 'HOOD', 'ORBIT'];
      const idx = order.indexOf(cameraMode);
      cameraMode = order[(idx + 1) % order.length];
      renderer.setCameraMode(cameraMode);
      return this.getState();
    },

    toggleAudioMute() {
      isAudioMuted = !isAudioMuted;
      if (isAudioMuted) {
        savedMasterVolume = synthEngine.masterVolume || 0.85;
        synthEngine.setMasterVolume(0.0);
      } else {
        synthEngine.setMasterVolume(savedMasterVolume);
      }
      return isAudioMuted;
    },

    simulateWinRace(options: any = {}) {
      let opts: any = {};
      if (typeof options === 'number') {
        opts = { stunts: 1, position: 1 };
      } else if (typeof options === 'object' && options !== null) {
        opts = options;
      }

      const fmt = RACE_FORMAT_SPECS[selectedFormat] || RACE_FORMAT_SPECS.SPRINT_1_LAP;
      const report = progression.recordRaceResult({
        position: opts.position ?? 1,
        overtakes: opts.overtakes ?? 3,
        slipstreamSec: opts.slipstreamSec ?? 3.5,
        driftCombos: opts.driftCombos ?? 2,
        stunts: opts.stunts ?? 1,
        takedowns: opts.takedowns ?? 1,
        laps: fmt.laps,
      });

      phase = 'POST_RACE';
      paddockUI.setVisible(false);
      raceHUD.setVisible(false);
      postRaceCeremony.showCeremony(report);
      return this.getState();
    },

    returnToPaddock() {
      phase = 'PADDOCK';
      cameraMode = 'SHOWROOM';
      renderer.setCameraMode('SHOWROOM');
      raceHUD.setVisible(false);
      paddockUI.setVisible(true);
      showroomGroup.visible = true;
      (skyAtmosphere as any).rootGroup.visible = false;
      (splineStreamer as any).sceneRoot.visible = false;
      (tacticalRamps as any).sceneRoot.visible = false;

      // Remove AI rival meshes when returning to Showroom
      for (const m of aiRivalModels) {
        scene.remove(m.rootGroup);
      }
      aiRivalModels.length = 0;

      // Reset player vehicle back onto Showroom Turntable center
      if (currentVehicleModel) {
        currentVehicleModel.rootGroup.position.set(0, 0, 0);
        currentVehicleModel.rootGroup.rotation.set(0, 0, 0);
        steerWheels(currentVehicleModel, 0);
      }

      if (typeof document !== 'undefined') {
        const paddockEl = document.getElementById('apex-paddock-showroom-ui');
        if (paddockEl) paddockEl.style.display = 'flex';
      }
      return this.getState();
    },

    setModStudioTuning(tuning: Partial<ModStudioTuning> = {}) {
      currentTuning = { ...currentTuning, ...tuning };
      paddockUI.setModStudioTuning(currentTuning);
      physicsWorld.setVehicleTuning('player', currentTuning);
      return currentTuning;
    },

    exportCurrentVehicleGlb() {
      return paddockUI.exportCurrentVehicleGlb();
    },

    getState(): any {
      const pState: PhysicsVehicleState = (physicsWorld as any).state;
      const prog = progression.getState();
      const spec = getVehicleById(selectedVehicleId) || VEHICLE_ROSTER[0];

      // Compute dynamic race position against AI rivals
      const trackLen = splineStreamer.getTotalLength() || 5000;
      const playerTotalDist =
        ((aiDirector.currentLap - 1) * trackLen) + (pState?.alongOffset ?? 0);
      let rank = 1;
      if (phase === 'RACING' && aiDirector.racers.length > 0) {
        for (const r of aiDirector.racers) {
          const rDist = ((r.currentLap - 1) * trackLen) + r.alongOffset;
          if (rDist > playerTotalDist + 2.0) {
            rank++;
          }
        }
      }

      const telemetry: LiveCockpitTelemetry = {
        speedKph: Math.round((pState?.speedKph ?? 0) * 10) / 10,
        rpm: pState?.rpm ?? 1000,
        maxRpm: spec.redlineRpm || 8000,
        gear: (pState?.speedKph ?? 0) < 0.5 ? 'N' : pState?.gear ?? 1,
        lapDeltaSec: aiDirector.bestLapTimeSec !== null ? -0.42 : 0.0,
        currentLap: aiDirector.currentLap,
        totalLaps: aiDirector.totalLaps,
        position: rank,
        totalRacers: aiDirector.totalRacers,
        nitroPercent: pState?.nitroPercent ?? 100,
        drsActive: pState?.drsActive ?? false,
        brakeTempCelsius: Math.round((pState?.brakeTempCelsius ?? 20) * 10) / 10,
        sectorSplits: [...aiDirector.sectorSplits],
        lateralG: pState?.lateralG ?? 0.0,
        longitudinalG: pState?.longitudinalG ?? 0.0,
        tireTemps: pState?.wheels ? (pState.wheels.map((w: any) => w.tireTempCelsius) as any) : [85, 85, 85, 85],
        kerbRumbleIntensity: pState?.kerbRumbleIntensity ?? 0.0,
        slipstreamActive: pState?.slipstreamActive ?? false,
        audioMuted: isAudioMuted,
      };

      if (activeCockpit && typeof activeCockpit.updateCockpitTelemetry === 'function') {
        activeCockpit.updateCockpitTelemetry(telemetry, 0.0);
      }

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
        fps: renderer.getFps ? renderer.getFps() : 144,
        vsyncHz:
          renderer.getVSyncHz && typeof renderer.getVSyncHz() === 'number'
            ? (renderer.getVSyncHz() as number)
            : 144,
        ssaaScale: renderer.getSSAAScale ? renderer.getSSAAScale() : 1.0,
        activeExterior,
        activeCockpit,
        lastCeremonyReport: prog.lastCeremonyReport,
      };
    },
  };

  // Expose on globalThis and window
  (globalThis as any).__APEX_GAME__ = controller;
  if (typeof window !== 'undefined') {
    (window as any).__APEX_GAME__ = controller;
  }

  // Helper to update shader camera and showroom lighting uniforms on vehicle materials
  function syncVehicleShaderUniforms(model: VehicleModelInstance | null, cam: THREE.Camera) {
    if (!model) return;
    for (const mat of model.bodyMaterials) {
      const sMat = mat as THREE.ShaderMaterial;
      if (sMat.uniforms) {
        if (sMat.uniforms.uCameraPosition) {
          sMat.uniforms.uCameraPosition.value.copy(cam.position);
        }
        if (phase === 'PADDOCK') {
          if (sMat.uniforms.uSunDirection) {
            sMat.uniforms.uSunDirection.value.set(0.35, 0.85, 0.40).normalize();
          }
          if (sMat.uniforms.uSunColor) {
            sMat.uniforms.uSunColor.value.setHex(0xfffaf0);
          }
          if (sMat.uniforms.uSunIntensity) {
            sMat.uniforms.uSunIntensity.value = 3.5;
          }
          if (sMat.uniforms.uAmbientSkyColor) {
            sMat.uniforms.uAmbientSkyColor.value.setRGB(0.75, 0.82, 0.95);
          }
          if (sMat.uniforms.uAmbientGroundColor) {
            sMat.uniforms.uAmbientGroundColor.value.setRGB(0.40, 0.42, 0.48);
          }
          if (sMat.uniforms.uEnvMapIntensity) {
            sMat.uniforms.uEnvMapIntensity.value = 2.8;
          }
        }
      }
    }
  }

  // 8. Main Render & Simulation Loop
  let lastFrameTime = performance.now();
  function animate() {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(animate);
    }
    const now = performance.now();
    const dt = Math.max(0.001, Math.min(0.05, (now - lastFrameTime) / 1000));
    lastFrameTime = now;

    // Phase Specific Updates
    if (phase === 'BOOT') {
      if (bootProgress < 1.0) {
        bootProgress = Math.min(1.0, bootProgress + dt * 0.85);
        bootLoadingScreen.setBootProgress(bootProgress);
      }
    } else if (phase === 'RACING') {
      // Gather Player Input (blending keyboard + TouchControls mobile interface)
      const touchInput =
        touchControls?.getInputState?.() ??
        (typeof window !== 'undefined' ? (window as any).touchControls?.getInputState?.() : null) ??
        null;

      const kbThrottle = keysDown.has('ArrowUp') || keysDown.has('KeyW') ? 1.0 : 0.0;
      const kbBrake = keysDown.has('ArrowDown') || keysDown.has('KeyS') ? 1.0 : 0.0;
      const steerLeft = keysDown.has('ArrowLeft') || keysDown.has('KeyA') ? -1.0 : 0.0;
      const steerRight = keysDown.has('ArrowRight') || keysDown.has('KeyD') ? 1.0 : 0.0;
      const kbSteer = steerLeft + steerRight;
      const kbHandbrake = keysDown.has('Space');
      const kbNitro = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight');

      const throttle = Math.max(kbThrottle, touchInput ? touchInput.throttle : 0);
      const brake = Math.max(kbBrake, touchInput ? touchInput.brake : 0);
      const steer = Math.abs(touchInput?.steer ?? 0) > 0.001 ? touchInput!.steer : kbSteer;
      const handbrake = kbHandbrake || Boolean(touchInput?.handbrake);
      const nitro = kbNitro || Boolean(touchInput?.nitro);

      physicsWorld.setControlInput('player', {
        throttle,
        brake,
        steer,
        handbrake,
        nitro,
      });

      // Update leaders for slipstream wake calculation
      physicsWorld.setLeaders(
        aiDirector.racers.map((r) => ({
          alongOffset: r.alongOffset,
          lateralOffset: r.lateralOffset,
          speedMs: r.speedKph / 3.6,
        }))
      );

      // Step physics at 240Hz sub-steps
      physicsWorld.step(dt);
      const pState: PhysicsVehicleState = (physicsWorld as any).state;

      // Stream 3D track sectors around player vehicle's current arc-length
      const totalTrackLen = splineStreamer.getTotalLength();
      splineStreamer.streamLookaheadWindow(pState.alongOffset, totalTrackLen, 2, 6);

      // Step AI director
      aiDirector.step(dt, {
        alongOffset: pState.alongOffset,
        lateralOffset: pState.lateralOffset,
        speedKph: pState.speedKph,
        currentLap: pState.alongOffset > 0 ? aiDirector.currentLap : 1,
      });

      // Update 3D AI Rival Car Positions & Orientations along Spline
      for (let i = 0; i < aiDirector.racers.length && i < aiRivalModels.length; i++) {
        const rival = aiDirector.racers[i];
        const rModel = aiRivalModels[i];
        const rFrame = splineStreamer.getFrameAtArcLength(rival.alongOffset);
        const rx = rFrame.position[0] + rFrame.normal[0] * rival.lateralOffset;
        const ry = rFrame.position[1];
        const rz = rFrame.position[2] + rFrame.normal[2] * rival.lateralOffset;

        rModel.rootGroup.position.set(rx, ry, rz);
        const rTargetX = rx + rFrame.tangent[0] * 10.0;
        const rTargetY = ry + rFrame.tangent[1] * 10.0;
        const rTargetZ = rz + rFrame.tangent[2] * 10.0;
        rModel.rootGroup.lookAt(rTargetX, rTargetY, rTargetZ);
        spinWheels(rModel, (rival.speedKph / 3.6) / 0.34, dt);
        syncVehicleShaderUniforms(rModel, camera);
      }

      // Audio engine update
      const currentSpec = getVehicleById(selectedVehicleId) || VEHICLE_ROSTER[0];
      synthEngine.updateEngineAudio(currentSpec, pState.rpm, throttle);

      // Tunnel Reverb Send
      const curFrame = splineStreamer.getFrameAtArcLength(pState.alongOffset);
      synthEngine.setTunnelReverb(Boolean(curFrame.isTunnel && !pState.airborne));

      // Kerb Rumble SFX
      if (pState.kerbRumbleIntensity > 0.05) {
        synthEngine.playKerbRumble(pState.kerbRumbleIntensity, pState.speedKph);
      }

      // Slipstream Wind SFX
      if (pState.slipstreamActive) {
        synthEngine.playSlipstreamWind(pState.slipstreamDraftRatio);
      }

      // Shift Shock SFX
      if (pState.shiftShockRemainingSec > 0 && pState.lastShiftType) {
        synthEngine.playGearShift(pState.lastShiftType, Boolean(typeof currentSpec.archetype === 'string' && currentSpec.archetype.includes('turbo')));
      }

      // Tire Skid SFX & Realistic Tire Smoke VFX if drifting or braking hard
      if ((brake > 0.5 || handbrake || Math.abs(steer) > 0.65) && pState.speedKph > 45) {
        if (brake > 0.5 || handbrake) {
          synthEngine.playTireSkid(0.75);
        }
        const carPos = new THREE.Vector3(...pState.position);
        const rightVec = new THREE.Vector3(...pState.right);
        const fwdVec = new THREE.Vector3(...pState.forward);
        for (const side of [-0.85, 0.85]) {
          const wheelPos = carPos
            .clone()
            .addScaledVector(rightVec, side)
            .addScaledVector(fwdVec, -1.35);
          spawnMotorsportParticle(
            wheelPos,
            new THREE.Vector3(
              (Math.random() - 0.5) * 1.4,
              0.6 + Math.random() * 0.8,
              (Math.random() - 0.5) * 1.4
            ),
            'smoke'
          );
        }
      }

      // Realistic Orange Barrier Sparks on Wall Scrape
      const isScraping = Boolean((pState as any).scrapingBarrier) || Math.abs(pState.lateralOffset) >= 9.6 || pState.barrierContact;
      if (isScraping && pState.speedKph > 25) {
        synthEngine.playBarrierScrape(Math.min(1.0, pState.speedKph / 250.0), pState.lateralOffset >= 0 ? 'RIGHT' : 'LEFT');

        const carPos = new THREE.Vector3(...pState.position);
        const rightVec = new THREE.Vector3(...pState.right);
        const sideSign = pState.lateralOffset >= 0 ? 1.0 : -1.0;
        const sparkOrigin = carPos.clone().addScaledVector(rightVec, sideSign * 0.98);
        sparkOrigin.y += 0.35;
        for (let sp = 0; sp < 2; sp++) {
          spawnMotorsportParticle(
            sparkOrigin,
            new THREE.Vector3(
              -sideSign * (1.5 + Math.random() * 3.0),
              1.5 + Math.random() * 3.5,
              (Math.random() - 0.5) * 3.0
            ),
            'spark'
          );
        }
      }

      updateMotorsportParticles(dt);

      // HUD telemetry & GPS Minimap update
      const state = controller.getState();
      raceHUD.setMinimapPositions(
        pState.alongOffset / (totalTrackLen || 5000),
        aiDirector.racers.map((r) => r.alongOffset / (totalTrackLen || 5000))
      );
      raceHUD.update(state.telemetry);

      // Update Player 3D Car Position, Orientation, Suspension Weight Transfer & Wheels
      if (currentVehicleModel) {
        currentVehicleModel.rootGroup.position.set(
          pState.position[0],
          pState.position[1] + currentTuning.rideHeightOffset,
          pState.position[2]
        );

        const fwd = new THREE.Vector3(...pState.forward);
        const right = new THREE.Vector3(...pState.right);
        const lookTarget = new THREE.Vector3(...pState.position)
          .addScaledVector(fwd, 10.0)
          .addScaledVector(right, steer * 1.35);
        currentVehicleModel.rootGroup.lookAt(lookTarget);

        // Authentic Sim-Cade Suspension Pitch & Roll on Bodywork Group
        const speedNorm = Math.min(1.0, pState.speedKph / 160.0);
        const targetPitch = brake * 0.038 - throttle * 0.022;
        const targetRoll = -steer * speedNorm * 0.055;
        currentVehicleModel.bodyworkGroup.rotation.x = THREE.MathUtils.lerp(
          currentVehicleModel.bodyworkGroup.rotation.x,
          targetPitch,
          0.2
        );
        currentVehicleModel.bodyworkGroup.rotation.z = THREE.MathUtils.lerp(
          currentVehicleModel.bodyworkGroup.rotation.z,
          targetRoll,
          0.2
        );

        steerWheels(currentVehicleModel, -steer * 0.42);
        updateVehicle(currentVehicleModel, state.telemetry, dt);
        syncVehicleShaderUniforms(currentVehicleModel, camera);
      }

      // Dynamic Speed-Driven FOV Warp (72 deg at rest -> 88 deg at 350 KPH)
      const targetFov = 72 + Math.min(16, (pState.speedKph / 350) * 16);
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.12);
        camera.updateProjectionMatrix();
      }

      // Update Camera Position based on CameraMode
      updateCameraPose(cameraMode, camera, pState);
    } else if (phase === 'PADDOCK') {
      // Smooth turntable rotation when user is not manually dragging
      if (!isDraggingShowroom) {
        showroomOrbitYaw += 0.28 * dt;
      }
      if (currentVehicleModel) {
        currentVehicleModel.rootGroup.position.set(0, currentTuning.rideHeightOffset, 0);
        currentVehicleModel.rootGroup.rotation.set(0, 0, 0);
        currentVehicleModel.bodyworkGroup.rotation.set(0, 0, 0);
        syncVehicleShaderUniforms(currentVehicleModel, camera);
      }
      const camX = Math.sin(showroomOrbitYaw) * Math.cos(showroomOrbitPitch) * showroomOrbitDistance;
      const camY = Math.max(0.55, Math.sin(showroomOrbitPitch) * showroomOrbitDistance);
      const camZ = Math.cos(showroomOrbitYaw) * Math.cos(showroomOrbitPitch) * showroomOrbitDistance;
      camera.position.set(camX, camY, camZ);
      camera.lookAt(0, 0.48, 0);
      if (Math.abs(camera.fov - 52) > 0.5) {
        camera.fov = 52; // Cinematic 50mm Showroom portrait lens
        camera.updateProjectionMatrix();
      }
    }

    // Render 3D Frame
    renderer.renderFrame(scene, camera, now);
  }

  function updateCameraPose(
    mode: CameraMode,
    cam: THREE.PerspectiveCamera,
    pState: PhysicsVehicleState
  ) {
    const forward = new THREE.Vector3(...pState.forward);
    const up = new THREE.Vector3(...pState.up);
    const pos = new THREE.Vector3(...pState.position);

    if (mode === 'CHASE') {
      const targetPos = pos
        .clone()
        .sub(forward.clone().multiplyScalar(6.2))
        .add(up.clone().multiplyScalar(2.15));
      cam.position.lerp(targetPos, 0.22);
      cam.lookAt(pos.clone().add(forward.clone().multiplyScalar(4.5)).add(up.clone().multiplyScalar(0.45)));
    } else if (mode === 'COCKPIT') {
      const eyePos = pos
        .clone()
        .add(up.clone().multiplyScalar(0.95))
        .add(forward.clone().multiplyScalar(0.1));
      cam.position.copy(eyePos);
      cam.lookAt(eyePos.clone().add(forward.clone().multiplyScalar(12.0)));
    } else if (mode === 'HOOD') {
      const hoodPos = pos
        .clone()
        .add(up.clone().multiplyScalar(0.72))
        .add(forward.clone().multiplyScalar(1.35));
      cam.position.copy(hoodPos);
      cam.lookAt(hoodPos.clone().add(forward.clone().multiplyScalar(18.0)));
    } else if (mode === 'ORBIT') {
      const t = performance.now() * 0.0005;
      cam.position.set(pos.x + Math.sin(t) * 6.8, pos.y + 2.4, pos.z + Math.cos(t) * 6.8);
      cam.lookAt(pos.clone().add(up.clone().multiplyScalar(0.5)));
    } else {
      // SHOWROOM
      cam.position.set(0, 1.8, 5.2);
      cam.lookAt(0, 0.48, 0);
    }
  }

  // Start loop if in browser
  if (typeof window !== 'undefined') {
    animate();
  }

  return controller;
}

// Auto-initialize when loaded in browser
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initApexGame());
  } else {
    initApexGame();
  }
}
