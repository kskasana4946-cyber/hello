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
  const initialSpec = VEHICLE_ROSTER[2]; // 'roadster' (Tier 0)
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
  (physicsWorld as any).resetVehicleState = function () {
    const s = (this as any).state;
    if (s) {
      s.speedMs = 0;
      s.speedKph = 0;
      s.alongOffset = 0;
      s.lateralOffset = 0;
      s.rpm = 1000;
      s.gear = 1;
      s.nitroPercent = 100;
      s.brakeTempCelsius = 20;
    }
  };

  // 3. UI Screens
  const bootLoadingScreen = new BootLoadingScreen(container, () => {
    controller.completeBoot();
  });
  const paddockUI = new PaddockShowroomUI(progression, container);
  const postRaceCeremony = new PostRaceRewardCeremony(container, null);
  const raceHUD = new RaceHUD(container);

  // 4. Three.js Scene Setup for 3D Visual Rendering
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020617);
  const camera = new THREE.PerspectiveCamera(
    75,
    (typeof window !== 'undefined' ? window.innerWidth : 1280) /
      (typeof window !== 'undefined' ? window.innerHeight : 720),
    0.1,
    2000
  );

  const skyAtmosphere = new SkyAtmosphereSystem({ pakStreamer });
  skyAtmosphere.initialize(scene, renderer);

  // Vehicle visual instances
  let currentVehicleModel: VehicleModelInstance | null = null;
  if (typeof document !== 'undefined') {
    try {
      currentVehicleModel = buildVehicle(initialSpec, 0);
      scene.add(currentVehicleModel.rootGroup);
    } catch {}
  }

  // 5. Game Lifecycle State
  let phase: GameLifecyclePhase = 'BOOT';
  let bootProgress = 0.0;
  let bootRpm = 0;
  let activeTab: 1 | 2 | 3 | 4 = 1;
  let selectedVehicleId = 'roadster';
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

  let activeExterior = vehicleBuilder.buildExterior(selectedVehicleId, selectedLiveryIndex);
  let activeCockpit = vehicleBuilder.buildCockpitAndGlass(selectedVehicleId);

  // 6. User Input State
  const keysDown = new Set<string>();
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      keysDown.add(e.code);

      // Audio resume on first user interaction
      synthEngine.resumeAudio();

      // Keyboard navigation
      if (e.code === 'KeyQ') {
        controller.pressTabKey('KeyQ');
      } else if (e.code === 'KeyE') {
        controller.pressTabKey('KeyE');
      } else if (e.code === 'KeyC') {
        controller.cycleCameraMode();
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
      bootLoadingScreen.completeBoot();
      synthEngine.playV12IgnitionRoar();
      phase = 'PADDOCK';
      activeTab = 1;
      cameraMode = 'SHOWROOM';
      renderer.setCameraMode('SHOWROOM');
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
      paddockUI.selectVehicle(spec.id);
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
      paddockUI.selectLivery(selectedLiveryIndex);
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
      paddockUI.setCircuitConfig({
        trackId: selectedTrackId,
        skyId: selectedSkyId,
        distanceKm: selectedDistanceKm,
        format: selectedFormat,
        aiDifficulty: selectedAiDifficulty,
      });
      return this.getState();
    },

    toggleSandboxUnlockAll(forceState?: boolean) {
      progression.toggleSandboxUnlockAll(forceState);
      paddockUI.toggleSandboxUnlockAll(forceState);
      return this.getState();
    },

    launchRace() {
      splineStreamer.configure(selectedDistanceKm, selectedTrackId);
      tacticalRamps.rebuildRamps();
      (physicsWorld as any).setVehicleSpec(selectedVehicleId);
      (physicsWorld as any).resetVehicleState();
      aiDirector.configure(selectedAiDifficulty, selectedFormat);
      phase = 'RACING';
      if (cameraMode === 'SHOWROOM') {
        cameraMode = 'CHASE';
      }
      renderer.setCameraMode(cameraMode);
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
      postRaceCeremony.showCeremony(report);
      return this.getState();
    },

    returnToPaddock() {
      phase = 'PADDOCK';
      cameraMode = 'SHOWROOM';
      renderer.setCameraMode('SHOWROOM');
      return this.getState();
    },

    setModStudioTuning(tuning: Partial<ModStudioTuning> = {}) {
      currentTuning = { ...currentTuning, ...tuning };
      paddockUI.setModStudioTuning(currentTuning);
      return currentTuning;
    },

    exportCurrentVehicleGlb() {
      return paddockUI.exportCurrentVehicleGlb();
    },

    getState(): any {
      const pState: PhysicsVehicleState = (physicsWorld as any).state;
      const prog = progression.getState();
      const spec = getVehicleById(selectedVehicleId) || VEHICLE_ROSTER[0];

      const telemetry: LiveCockpitTelemetry = {
        speedKph: Math.round((pState?.speedKph ?? 0) * 10) / 10,
        rpm: pState?.rpm ?? 1000,
        maxRpm: spec.redlineRpm || 8000,
        gear: (pState?.speedKph ?? 0) < 0.5 ? 'N' : pState?.gear ?? 1,
        lapDeltaSec: aiDirector.bestLapTimeSec !== null ? -0.42 : 0.0,
        currentLap: aiDirector.currentLap,
        totalLaps: aiDirector.totalLaps,
        position: 1,
        totalRacers: aiDirector.totalRacers,
        nitroPercent: pState?.nitroPercent ?? 100,
        drsActive: pState?.drsActive ?? false,
        brakeTempCelsius: Math.round((pState?.brakeTempCelsius ?? 20) * 10) / 10,
        sectorSplits: [...aiDirector.sectorSplits],
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
      // Gather Player Input
      const throttle = keysDown.has('ArrowUp') || keysDown.has('KeyW') ? 1.0 : 0.0;
      const brake = keysDown.has('ArrowDown') || keysDown.has('KeyS') ? 1.0 : 0.0;
      const steerLeft = keysDown.has('ArrowLeft') || keysDown.has('KeyA') ? -1.0 : 0.0;
      const steerRight = keysDown.has('ArrowRight') || keysDown.has('KeyD') ? 1.0 : 0.0;
      const steer = steerLeft + steerRight;
      const handbrake = keysDown.has('Space');
      const nitro = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight');

      physicsWorld.setControlInput('player', {
        throttle,
        brake,
        steer,
        handbrake,
        nitro,
      });

      // Step physics at 240Hz sub-steps
      physicsWorld.step(dt);
      const pState: PhysicsVehicleState = (physicsWorld as any).state;

      // Step AI director
      aiDirector.step(dt, {
        alongOffset: pState.alongOffset,
        lateralOffset: pState.lateralOffset,
        speedKph: pState.speedKph,
        currentLap: pState.alongOffset > 0 ? aiDirector.currentLap : 1,
      });

      // Audio engine update
      const currentSpec = getVehicleById(selectedVehicleId) || VEHICLE_ROSTER[0];
      synthEngine.updateEngineAudio(currentSpec, pState.rpm, throttle);

      // Tire Skid SFX if drifting or braking hard
      if (brake > 0.5 && pState.speedKph > 50) {
        synthEngine.playTireSkid(0.8);
      }

      // HUD telemetry update
      const state = controller.getState();
      raceHUD.update(state.telemetry);

      // Update 3D car visual mesh and cockpit
      if (currentVehicleModel) {
        updateVehicle(currentVehicleModel, state.telemetry, dt);
      }

      // Update Camera Position based on CameraMode
      updateCameraPose(cameraMode, camera, pState);
    } else if (phase === 'PADDOCK') {
      // Rotate vehicle turntable slowly in showroom
      if (currentVehicleModel) {
        currentVehicleModel.rootGroup.rotation.y += 0.4 * dt;
      }
      camera.position.set(0, 1.8, 5.5);
      camera.lookAt(0, 0.5, 0);
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
        .sub(forward.clone().multiplyScalar(6.5))
        .add(up.clone().multiplyScalar(2.2));
      cam.position.lerp(targetPos, 0.15);
      cam.lookAt(pos.clone().add(forward.clone().multiplyScalar(4.0)));
    } else if (mode === 'COCKPIT') {
      const eyePos = pos
        .clone()
        .add(up.clone().multiplyScalar(0.95))
        .add(forward.clone().multiplyScalar(0.1));
      cam.position.copy(eyePos);
      cam.lookAt(eyePos.clone().add(forward.clone().multiplyScalar(10.0)));
    } else if (mode === 'HOOD') {
      const hoodPos = pos
        .clone()
        .add(up.clone().multiplyScalar(0.7))
        .add(forward.clone().multiplyScalar(1.4));
      cam.position.copy(hoodPos);
      cam.lookAt(hoodPos.clone().add(forward.clone().multiplyScalar(15.0)));
    } else if (mode === 'ORBIT') {
      const t = performance.now() * 0.0005;
      cam.position.set(pos.x + Math.sin(t) * 7.0, pos.y + 2.5, pos.z + Math.cos(t) * 7.0);
      cam.lookAt(pos);
    } else {
      // SHOWROOM
      cam.position.set(0, 1.8, 5.5);
      cam.lookAt(0, 0.5, 0);
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
