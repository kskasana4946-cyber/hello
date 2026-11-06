// ============================================================================
// src/core/UncappedRenderer.ts
// Uncapped WebGPU / WebGL2 Deferred & Forward+ PBR Renderer (F2, F3, F6)
// + Material Factories for AutomotivePaint.glsl (F4) & RefractiveGlass.glsl (F5)
// ============================================================================

import * as THREE from 'three';
import automotivePaintGlslSource from '../shaders/AutomotivePaint.glsl';
import refractiveGlassGlslSource from '../shaders/RefractiveGlass.glsl';
import type { CameraMode } from './types';

export type VSyncHzMode = 0 | 120 | 144 | 240 | 'UNCAPPED' | 'OFF';
export type RenderBackendType = 'WEBGPU' | 'WEBGL2' | 'HEADLESS_MOCK';

export interface AutomotiveLiveryPreset {
  index: number;
  id: string;
  name: string;
  baseColor: number;
  secondaryColor: number;
  flipColor: number;
  flipExponent: number;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  flakeScale: number;
  flakeIntensity: number;
  flakeColor: number;
  anisotropy: number;
  anisotropyRotation: number;
  carbonWeaveScale: number;
}

export const AUTOMOTIVE_PAINT_LIVERIES: readonly AutomotiveLiveryPreset[] = [
  {
    index: 0,
    id: 'liquid_rosso_corsa',
    name: 'Liquid Rosso Corsa',
    baseColor: 0xd4001a,
    secondaryColor: 0x1a1a1a,
    flipColor: 0xff3b1f,
    flipExponent: 3.2,
    metalness: 0.35,
    roughness: 0.14,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    flakeScale: 650.0,
    flakeIntensity: 0.18,
    flakeColor: 0xffb3a7,
    anisotropy: 0.05,
    anisotropyRotation: 0.0,
    carbonWeaveScale: 0.0,
  },
  {
    index: 1,
    id: 'championship_white_pearl',
    name: 'Championship White Pearl',
    baseColor: 0xf4f3ee,
    secondaryColor: 0xd4001a,
    flipColor: 0xdce8ff,
    flipExponent: 2.8,
    metalness: 0.25,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    flakeScale: 950.0,
    flakeIntensity: 0.22,
    flakeColor: 0xffffff,
    anisotropy: 0.0,
    anisotropyRotation: 0.0,
    carbonWeaveScale: 0.0,
  },
  {
    index: 2,
    id: 'bayside_metallic_blue',
    name: 'Bayside Metallic Flake Blue',
    baseColor: 0x0047cc,
    secondaryColor: 0xe8edf5,
    flipColor: 0x00c8ff,
    flipExponent: 3.0,
    metalness: 0.88,
    roughness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.035,
    flakeScale: 1200.0,
    flakeIntensity: 0.45,
    flakeColor: 0x80e5ff,
    anisotropy: 0.15,
    anisotropyRotation: 0.0,
    carbonWeaveScale: 0.0,
  },
  {
    index: 3,
    id: 'papaya_mclaren_sparkle',
    name: 'Papaya McLaren Sparkle',
    baseColor: 0xff7300,
    secondaryColor: 0x111622,
    flipColor: 0xffcc00,
    flipExponent: 2.6,
    metalness: 0.82,
    roughness: 0.19,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    flakeScale: 1100.0,
    flakeIntensity: 0.42,
    flakeColor: 0xffe066,
    anisotropy: 0.1,
    anisotropyRotation: 0.0,
    carbonWeaveScale: 0.0,
  },
  {
    index: 4,
    id: 'british_racing_emerald',
    name: 'British Racing Emerald',
    baseColor: 0x004225,
    secondaryColor: 0xd4af37,
    flipColor: 0x008f5a,
    flipExponent: 3.1,
    metalness: 0.78,
    roughness: 0.21,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    flakeScale: 900.0,
    flakeIntensity: 0.35,
    flakeColor: 0x66ffcc,
    anisotropy: 0.08,
    anisotropyRotation: 0.0,
    carbonWeaveScale: 0.0,
  },
  {
    index: 5,
    id: 'exposed_twill_carbon',
    name: 'Exposed Twill Carbon Fiber',
    baseColor: 0x16181d,
    secondaryColor: 0xff2a00,
    flipColor: 0x2b303a,
    flipExponent: 2.5,
    metalness: 0.45,
    roughness: 0.22,
    clearcoat: 0.95,
    clearcoatRoughness: 0.05,
    flakeScale: 400.0,
    flakeIntensity: 0.08,
    flakeColor: 0x99a3b3,
    anisotropy: 0.65,
    anisotropyRotation: 0.785398,
    carbonWeaveScale: 64.0,
  },
  {
    index: 6,
    id: 'brushed_titanium_aniso',
    name: 'Brushed Titanium Anisotropic',
    baseColor: 0x8c939e,
    secondaryColor: 0x00e5ff,
    flipColor: 0xc4cbd6,
    flipExponent: 2.2,
    metalness: 0.96,
    roughness: 0.26,
    clearcoat: 0.85,
    clearcoatRoughness: 0.06,
    flakeScale: 500.0,
    flakeIntensity: 0.14,
    flakeColor: 0xe6edf5,
    anisotropy: 0.88,
    anisotropyRotation: 0.0,
    carbonWeaveScale: 0.0,
  },
  {
    index: 7,
    id: 'cyberpunk_neon_magenta',
    name: 'Cyberpunk Neon Magenta Flip',
    baseColor: 0xd900ff,
    secondaryColor: 0x00f0ff,
    flipColor: 0x00ffe1,
    flipExponent: 2.4,
    metalness: 0.86,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.025,
    flakeScale: 1350.0,
    flakeIntensity: 0.5,
    flakeColor: 0x00ffff,
    anisotropy: 0.25,
    anisotropyRotation: 0.35,
    carbonWeaveScale: 0.0,
  },
  {
    index: 8,
    id: 'nardo_matte_stealth',
    name: 'Nardo Matte Stealth Grey',
    baseColor: 0x686c73,
    secondaryColor: 0xff1e00,
    flipColor: 0x7c828a,
    flipExponent: 2.0,
    metalness: 0.2,
    roughness: 0.52,
    clearcoat: 0.22,
    clearcoatRoughness: 0.38,
    flakeScale: 450.0,
    flakeIntensity: 0.06,
    flakeColor: 0xa0a6b0,
    anisotropy: 0.05,
    anisotropyRotation: 0.0,
    carbonWeaveScale: 0.0,
  },
  {
    index: 9,
    id: 'midnight_purple_chameleon',
    name: 'Midnight Purple III Chameleon',
    baseColor: 0x26084d,
    secondaryColor: 0xb8860b,
    flipColor: 0x00a86b,
    flipExponent: 2.3,
    metalness: 0.9,
    roughness: 0.17,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    flakeScale: 1280.0,
    flakeIntensity: 0.48,
    flakeColor: 0xff80df,
    anisotropy: 0.2,
    anisotropyRotation: 0.2,
    carbonWeaveScale: 0.0,
  },
  {
    index: 10,
    id: 'gulf_heritage_sky',
    name: 'Gulf Heritage Sky',
    baseColor: 0x6ca6cd,
    secondaryColor: 0xff6600,
    flipColor: 0x92c5e8,
    flipExponent: 2.9,
    metalness: 0.3,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.035,
    flakeScale: 600.0,
    flakeIntensity: 0.15,
    flakeColor: 0xd9f0ff,
    anisotropy: 0.0,
    anisotropyRotation: 0.0,
    carbonWeaveScale: 0.0,
  },
  {
    index: 11,
    id: 'lemans_24k_gold_leaf',
    name: 'Le Mans 24K Gold Leaf',
    baseColor: 0xffbf00,
    secondaryColor: 0x111111,
    flipColor: 0xfff099,
    flipExponent: 2.7,
    metalness: 0.98,
    roughness: 0.14,
    clearcoat: 1.0,
    clearcoatRoughness: 0.025,
    flakeScale: 1400.0,
    flakeIntensity: 0.52,
    flakeColor: 0xffee88,
    anisotropy: 0.45,
    anisotropyRotation: 0.0,
    carbonWeaveScale: 0.0,
  },
];

export const LIVERY_PBR_PRESETS = AUTOMOTIVE_PAINT_LIVERIES;

export interface CSMCascadeDescriptor {
  cascadeIndex: number;
  nearDistance: number;
  farDistance: number;
  resolution: [number, number];
  lightViewProjMatrix: THREE.Matrix4;
  pcssBlockerSamples: number;
  pcssPenumbraFilterSamples: number;
  lightWorldSize: number;
}

export interface ScreenSpacePipelineConfig {
  ssgiEnabled: boolean;
  ssgiRaySteps: number;
  ssgiRadiusMeters: number;
  ssgiIntensity: number;
  ssrEnabled: boolean;
  ssrMaxSteps: number;
  ssrWetAsphaltIntensity: number;
  ssrPuddleRoughnessThreshold: number;
  csmCascadeCount: 4;
  csmResolution: [4096, 4096];
  pcssContactHardening: boolean;
}

export interface PostProcessingConfig {
  toneMapping: 'ACES_FILMIC';
  exposure: number;
  godRaysEnabled: boolean;
  godRaysIntensity: number;
  godRaysSamples: number;
  perWheelMotionBlurEnabled: boolean;
  wheelAngularVelocityRadSec: [number, number, number, number];
  speedFovWarpEnabled: boolean;
  baseFovDeg: number;
  currentFovDeg: number;
  bokehDofEnabled: boolean;
  bokehFocusDistanceMeters: number;
  bokehApertureFStop: number;
  bokehMaxBlurRadiusPx: number;
}

export interface UncappedRendererOptions {
  canvas?: HTMLCanvasElement;
  width?: number;
  height?: number;
  vsyncHz?: VSyncHzMode;
  ssaaScale?: number;
  preferWebGPU?: boolean;
  headless?: boolean;
}

export function splitShaderStages(rawGlsl: string): { vertexShader: string; fragmentShader: string } {
  const vertMarker = '#pragma VERTEX_SHADER';
  const fragMarker = '#pragma FRAGMENT_SHADER';
  const vertIdx = rawGlsl.indexOf(vertMarker);
  const fragIdx = rawGlsl.indexOf(fragMarker);

  if (vertIdx !== -1 && fragIdx !== -1) {
    return {
      vertexShader: rawGlsl.slice(vertIdx + vertMarker.length, fragIdx).trim(),
      fragmentShader: rawGlsl.slice(fragIdx + fragMarker.length).trim(),
    };
  }
  return {
    vertexShader: rawGlsl,
    fragmentShader: rawGlsl,
  };
}

export function getAutomotivePaintLivery(indexOrId: number | string): AutomotiveLiveryPreset {
  if (typeof indexOrId === 'number') {
    const normalized =
      ((Math.floor(indexOrId) % AUTOMOTIVE_PAINT_LIVERIES.length) + AUTOMOTIVE_PAINT_LIVERIES.length) %
      AUTOMOTIVE_PAINT_LIVERIES.length;
    return AUTOMOTIVE_PAINT_LIVERIES[normalized];
  }
  const found = AUTOMOTIVE_PAINT_LIVERIES.find((l) => l.id === indexOrId || l.name === indexOrId);
  return found ?? AUTOMOTIVE_PAINT_LIVERIES[0];
}

export function createAutomotivePaintMaterial(
  liveryIndexOrId: number | string = 0,
  overrides: Partial<{
    baseColor: number;
    secondaryColor: number;
    brakeTempCelsius: number;
    isBrakeRotor: boolean;
  }> = {}
): THREE.ShaderMaterial {
  const preset = getAutomotivePaintLivery(liveryIndexOrId);
  const { vertexShader, fragmentShader } = splitShaderStages(automotivePaintGlslSource);

  const baseHex = overrides.baseColor ?? preset.baseColor;
  const secHex = overrides.secondaryColor ?? preset.secondaryColor;

  const material = new THREE.ShaderMaterial({
    name: `AutomotivePaint_${preset.id}`,
    vertexShader,
    fragmentShader,
    uniforms: {
      uBaseColor: { value: new THREE.Color(baseHex) },
      uSecondaryColor: { value: new THREE.Color(secHex) },
      uFlipColor: { value: new THREE.Color(preset.flipColor) },
      uFlipExponent: { value: preset.flipExponent },
      uMetalness: { value: preset.metalness },
      uRoughness: { value: preset.roughness },
      uClearcoat: { value: preset.clearcoat },
      uClearcoatRoughness: { value: preset.clearcoatRoughness },
      uFlakeScale: { value: preset.flakeScale },
      uFlakeIntensity: { value: preset.flakeIntensity },
      uFlakeColor: { value: new THREE.Color(preset.flakeColor) },
      uAnisotropy: { value: preset.anisotropy },
      uAnisotropyRotation: { value: preset.anisotropyRotation },
      uCarbonWeaveScale: { value: preset.carbonWeaveScale },
      uBrakeTempCelsius: { value: overrides.brakeTempCelsius ?? 25.0 },
      uIsBrakeRotor: { value: overrides.isBrakeRotor ? 1.0 : 0.0 },
      uCameraPosition: { value: new THREE.Vector3(0, 2, 6) },
      uSunDirection: { value: new THREE.Vector3(0.45, 0.78, 0.42).normalize() },
      uSunColor: { value: new THREE.Color(0xfff4e0) },
      uSunIntensity: { value: 2.4 },
      uAmbientSkyColor: { value: new THREE.Color(0x6ca6cd) },
      uAmbientGroundColor: { value: new THREE.Color(0x222428) },
      uEnvMapIntensity: { value: 1.35 },
      uLiveryIndex: { value: preset.index },
    },
  });

  material.userData = {
    shaderType: 'AUTOMOTIVE_PAINT',
    liveryPreset: preset,
    clearcoatF0: 0.04,
  };

  return material;
}

export function createRefractiveGlassMaterial(
  options: Partial<{
    ior: number;
    chromaticDispersion: number;
    glassRoughness: number;
    tintColor: number;
    transmission: number;
    wetness: number;
    wiperAngleRad: number;
  }> = {}
): THREE.ShaderMaterial {
  const { vertexShader, fragmentShader } = splitShaderStages(refractiveGlassGlslSource);
  const ior = options.ior ?? 1.52;
  const f0 = Math.pow((1.0 - ior) / (1.0 + ior), 2);

  const material = new THREE.ShaderMaterial({
    name: 'RefractiveLaminatedGlass',
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uIor: { value: ior },
      uChromaticDispersion: { value: options.chromaticDispersion ?? 0.02 },
      uGlassRoughness: { value: options.glassRoughness ?? 0.03 },
      uTintColor: { value: new THREE.Color(options.tintColor ?? 0xdbf0f8) },
      uTransmission: { value: options.transmission ?? 0.92 },
      uWetness: { value: options.wetness ?? 0.35 },
      uWiperAngleRad: { value: options.wiperAngleRad ?? 0.25 },
      uTime: { value: 0.0 },
      uCameraPosition: { value: new THREE.Vector3(0, 1.6, 4.5) },
      uSunDirection: { value: new THREE.Vector3(0.45, 0.78, 0.42).normalize() },
      uSunColor: { value: new THREE.Color(0xfff4e0) },
      uAmbientSkyColor: { value: new THREE.Color(0x7cb8e8) },
      uAmbientGroundColor: { value: new THREE.Color(0x1f232a) },
    },
  });

  material.userData = {
    shaderType: 'REFRACTIVE_GLASS',
    ior,
    fresnelF0: f0,
  };

  return material;
}

export class UncappedRenderer {
  public readonly backend: RenderBackendType;
  public readonly webglRenderer: THREE.WebGLRenderer | null = null;
  private width: number;
  private height: number;
  private vsyncHz: VSyncHzMode;
  private ssaaScale: number;
  private cameraMode: CameraMode = 'CHASE';
  private photoModeActive = false;

  private readonly frameDeltasMs: number[] = [];
  private lastFrameTimestampMs = 0;
  private currentFps = 144;
  private renderedFrameCount = 0;

  private readonly screenSpaceConfig: ScreenSpacePipelineConfig = {
    ssgiEnabled: true,
    ssgiRaySteps: 16,
    ssgiRadiusMeters: 4.5,
    ssgiIntensity: 1.15,
    ssrEnabled: true,
    ssrMaxSteps: 32,
    ssrWetAsphaltIntensity: 1.35,
    ssrPuddleRoughnessThreshold: 0.38,
    csmCascadeCount: 4,
    csmResolution: [4096, 4096],
    pcssContactHardening: true,
  };

  private readonly postProcessConfig: PostProcessingConfig = {
    toneMapping: 'ACES_FILMIC',
    exposure: 1.15,
    godRaysEnabled: true,
    godRaysIntensity: 2.4,
    godRaysSamples: 48,
    perWheelMotionBlurEnabled: true,
    wheelAngularVelocityRadSec: [0, 0, 0, 0],
    speedFovWarpEnabled: true,
    baseFovDeg: 62.0,
    currentFovDeg: 62.0,
    bokehDofEnabled: false,
    bokehFocusDistanceMeters: 4.2,
    bokehApertureFStop: 1.8,
    bokehMaxBlurRadiusPx: 14.0,
  };

  private readonly cascades: CSMCascadeDescriptor[] = [];

  constructor(options: UncappedRendererOptions = {}) {
    this.width = Math.max(1, options.width ?? 1920);
    this.height = Math.max(1, options.height ?? 1080);
    this.vsyncHz = options.vsyncHz ?? 144;
    this.ssaaScale = this.clampSSAAScale(options.ssaaScale ?? 1.5);

    this.backend = options.headless
      ? 'HEADLESS_MOCK'
      : this.initializeBackend(options.canvas, options.preferWebGPU ?? true);
    this.rebuildCSMCascades(0.5, 1200.0, new THREE.Vector3(0.45, 0.78, 0.42).normalize());
  }

  private clampSSAAScale(scale: number): number {
    if (!Number.isFinite(scale)) return 1.0;
    return Math.min(2.5, Math.max(1.0, Number(scale.toFixed(3))));
  }

  private initializeBackend(canvas?: HTMLCanvasElement, preferWebGPU = true): RenderBackendType {
    try {
      if (typeof window !== 'undefined' && canvas) {
        const gl = canvas.getContext('webgl2', {
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
        });
        if (gl) {
          const renderer = new THREE.WebGLRenderer({
            canvas,
            context: gl as WebGLRenderingContext,
            antialias: true,
            powerPreference: 'high-performance',
          });
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = this.postProcessConfig.exposure;
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = THREE.PCFSoftShadowMap;
          renderer.setPixelRatio(this.ssaaScale);
          renderer.setSize(this.width, this.height, false);
          (this as { webglRenderer: THREE.WebGLRenderer | null }).webglRenderer = renderer;

          const hasWebGPU = preferWebGPU && typeof navigator !== 'undefined' && 'gpu' in navigator;
          return hasWebGPU ? 'WEBGPU' : 'WEBGL2';
        }
      }
    } catch {
      // Fallback cleanly in Vitest / headless environments without GL context
    }
    return 'HEADLESS_MOCK';
  }

  public setVSyncHz(mode: VSyncHzMode): void {
    this.vsyncHz = mode;
  }

  public setVSyncMode(mode: VSyncHzMode): void {
    this.setVSyncHz(mode);
  }

  public getVSyncHz(): VSyncHzMode {
    return this.vsyncHz;
  }

  public getTargetFrameIntervalMs(): number {
    if (this.vsyncHz === 'UNCAPPED' || this.vsyncHz === 'OFF' || this.vsyncHz === 0) return 0;
    return 1000.0 / this.vsyncHz;
  }

  public setSSAAScale(scale: number): number {
    this.ssaaScale = this.clampSSAAScale(scale);
    if (this.webglRenderer) {
      this.webglRenderer.setPixelRatio(this.ssaaScale);
      this.webglRenderer.setSize(this.width, this.height, false);
    }
    return this.ssaaScale;
  }

  public getSSAAScale(): number {
    return this.ssaaScale;
  }

  public getConfig(): {
    vsyncHz: VSyncHzMode;
    ssaaScale: number;
    width: number;
    height: number;
    backend: RenderBackendType;
  } {
    return {
      vsyncHz: this.vsyncHz,
      ssaaScale: this.ssaaScale,
      width: this.width,
      height: this.height,
      backend: this.backend,
    };
  }

  public getCSMConfig(): {
    cascades: 4;
    shadowMapSize: 4096;
    pcssContactHardening: boolean;
  } {
    return {
      cascades: this.screenSpaceConfig.csmCascadeCount,
      shadowMapSize: this.screenSpaceConfig.csmResolution[0],
      pcssContactHardening: this.screenSpaceConfig.pcssContactHardening,
    };
  }

  public getInternalRenderResolution(): { width: number; height: number; ssaaScale: number } {
    return {
      width: Math.round(this.width * this.ssaaScale),
      height: Math.round(this.height * this.ssaaScale),
      ssaaScale: this.ssaaScale,
    };
  }

  public resize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    if (this.webglRenderer) {
      this.webglRenderer.setPixelRatio(this.ssaaScale);
      this.webglRenderer.setSize(this.width, this.height, false);
    }
  }

  public rebuildCSMCascades(
    nearPlane = 0.5,
    farPlane = 1200.0,
    sunDirection = new THREE.Vector3(0.45, 0.78, 0.42).normalize(),
    lambda = 0.65
  ): readonly CSMCascadeDescriptor[] {
    this.cascades.length = 0;
    const count = 4;
    let prevSplit = nearPlane;

    for (let i = 1; i <= count; i++) {
      const f = i / count;
      const logSplit = nearPlane * Math.pow(farPlane / nearPlane, f);
      const uniSplit = nearPlane + (farPlane - nearPlane) * f;
      const farDist = lambda * logSplit + (1.0 - lambda) * uniSplit;

      const lightView = new THREE.Matrix4().lookAt(
        sunDirection.clone().multiplyScalar(farDist * 0.5),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 1, 0)
      );
      const orthoRadius = farDist * 0.6;
      const lightProj = new THREE.Matrix4().makeOrthographic(
        -orthoRadius,
        orthoRadius,
        orthoRadius,
        -orthoRadius,
        0.1,
        farDist * 2.5
      );
      const lightViewProj = new THREE.Matrix4().multiplyMatrices(lightProj, lightView);

      this.cascades.push({
        cascadeIndex: i - 1,
        nearDistance: Number(prevSplit.toFixed(3)),
        farDistance: Number(farDist.toFixed(3)),
        resolution: [4096, 4096],
        lightViewProjMatrix: lightViewProj,
        pcssBlockerSamples: 16,
        pcssPenumbraFilterSamples: 16,
        lightWorldSize: 0.045 * i,
      });

      prevSplit = farDist;
    }

    return this.cascades;
  }

  public getCSMCascades(): readonly CSMCascadeDescriptor[] {
    return this.cascades;
  }

  public computePCSSPenumbraWidth(receiverDepth: number, avgBlockerDepth: number, lightSize = 0.06): number {
    if (avgBlockerDepth <= 0 || receiverDepth <= avgBlockerDepth) return 0.0;
    return ((receiverDepth - avgBlockerDepth) / avgBlockerDepth) * lightSize;
  }

  public applyACESToneMapping(
    hdrLinearRgb: [number, number, number],
    exposure = this.postProcessConfig.exposure
  ): [number, number, number] {
    const a = 2.51;
    const b = 0.03;
    const c = 2.43;
    const d = 0.59;
    const e = 0.14;

    return hdrLinearRgb.map((channel) => {
      const x = Math.max(0, channel * exposure);
      const mapped = (x * (a * x + b)) / (x * (c * x + d) + e);
      return Math.min(1.0, Math.max(0.0, mapped));
    }) as [number, number, number];
  }

  public updateSpeedFovWarp(speedKph: number, boostMultiplier = 1.0, camera?: THREE.PerspectiveCamera): number {
    if (this.cameraMode === 'SHOWROOM' || this.photoModeActive) {
      this.postProcessConfig.currentFovDeg = 42.0;
      if (camera) {
        camera.fov = 42.0;
        camera.updateProjectionMatrix();
      }
      return 42.0;
    }

    const baseFov = this.cameraMode === 'COCKPIT' ? 68.0 : this.postProcessConfig.baseFovDeg;
    const speedRatio = Math.min(1.15, Math.max(0.0, speedKph / 485.0));
    const speedDeltaFov = Math.pow(speedRatio, 1.25) * 24.0;
    const boostBonusFov = boostMultiplier > 1.05 ? Math.min(6.0, (boostMultiplier - 1.0) * 14.0) : 0.0;
    const targetFov = Math.min(94.0, Math.max(55.0, baseFov + speedDeltaFov + boostBonusFov));

    this.postProcessConfig.currentFovDeg = Number(targetFov.toFixed(2));
    if (camera) {
      camera.fov = this.postProcessConfig.currentFovDeg;
      camera.updateProjectionMatrix();
    }
    return this.postProcessConfig.currentFovDeg;
  }

  public computeSpeedDrivenFov(speedKph: number, boostMultiplier = 1.0): number {
    return this.updateSpeedFovWarp(speedKph, boostMultiplier);
  }

  public updateWheelMotionBlur(speedKph: number, wheelRadiusMeters = 0.34): [number, number, number, number] {
    const linearSpeedMs = Math.max(0, speedKph / 3.6);
    const omega = linearSpeedMs / Math.max(0.1, wheelRadiusMeters);
    this.postProcessConfig.wheelAngularVelocityRadSec = [omega, omega, omega, omega];
    return this.postProcessConfig.wheelAngularVelocityRadSec;
  }

  public setCameraMode(mode: CameraMode, photoMode = false): void {
    this.cameraMode = mode;
    this.photoModeActive = photoMode || mode === 'SHOWROOM';
    this.postProcessConfig.bokehDofEnabled = this.photoModeActive;
  }

  public computeBokehCircleOfConfusionPx(depthMeters: number): number {
    if (!this.postProcessConfig.bokehDofEnabled) return 0.0;
    const focus = Math.max(0.5, this.postProcessConfig.bokehFocusDistanceMeters);
    const z = Math.max(0.2, depthMeters);
    const cocNorm = Math.abs(z - focus) / z;
    const fStopScale = 2.8 / Math.max(0.7, this.postProcessConfig.bokehApertureFStop);
    return Math.min(
      this.postProcessConfig.bokehMaxBlurRadiusPx,
      cocNorm * fStopScale * this.postProcessConfig.bokehMaxBlurRadiusPx
    );
  }

  public getScreenSpaceConfig(): Readonly<ScreenSpacePipelineConfig> {
    return this.screenSpaceConfig;
  }

  public getPostProcessingConfig(): Readonly<PostProcessingConfig> {
    return this.postProcessConfig;
  }

  public getFps(): number {
    return this.currentFps;
  }

  public renderFrame(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    timestampMs = performance.now()
  ): {
    rendered: boolean;
    fps: number;
    frameDeltaMs: number;
    currentFovDeg: number;
    bokehActive: boolean;
  } {
    const deltaMs =
      this.lastFrameTimestampMs > 0 ? Math.max(0.1, timestampMs - this.lastFrameTimestampMs) : 1000 / 144;
    const minInterval = this.getTargetFrameIntervalMs();

    if (minInterval > 0 && this.lastFrameTimestampMs > 0 && deltaMs < minInterval * 0.92) {
      return {
        rendered: false,
        fps: this.currentFps,
        frameDeltaMs: deltaMs,
        currentFovDeg: this.postProcessConfig.currentFovDeg,
        bokehActive: this.postProcessConfig.bokehDofEnabled,
      };
    }

    this.lastFrameTimestampMs = timestampMs;
    this.frameDeltasMs.push(deltaMs);
    if (this.frameDeltasMs.length > 120) {
      this.frameDeltasMs.shift();
    }
    const avgDelta = this.frameDeltasMs.reduce((a, b) => a + b, 0) / this.frameDeltasMs.length;
    this.currentFps = Math.round(1000.0 / Math.max(0.5, avgDelta));
    this.renderedFrameCount++;

    if (this.webglRenderer) {
      this.webglRenderer.render(scene, camera);
    }

    return {
      rendered: true,
      fps: this.currentFps,
      frameDeltaMs: deltaMs,
      currentFovDeg: this.postProcessConfig.currentFovDeg,
      bokehActive: this.postProcessConfig.bokehDofEnabled,
    };
  }
}
