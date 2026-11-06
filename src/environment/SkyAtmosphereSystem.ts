// src/environment/SkyAtmosphereSystem.ts
// Apex Grand Prix: Uncapped Next-Gen Edition
// High-Dynamic-Range Sky, Atmosphere & Volumetric Cloud Simulation Subsystem (Part 2 / Milestone M2)

import * as THREE from 'three';
import {
  CanonicalSkyBiomeId,
  PakChunkType,
  PakType,
  ParsedPakBundle,
  SKY_BIOME_ALIASES,
  SkyBiomeId,
  Vec3Tuple,
} from '../core/types';
import {
  PakStreamer,
  parsePakBundle,
  resolveSkyCanonicalId,
  resolveSkyPakPath,
} from '../streaming/PakStreamer';

export interface SkyAtmosphereSpecialEffects {
  lightning?: boolean;
  lightningFrequencySec?: number;
  snow?: boolean;
  snowParticleRate?: number;
  aurora?: boolean;
  dustHaze?: boolean;
  dustParticleDensity?: number;
  sunShafts?: boolean;
  neonHolograms?: boolean;
}

export interface SkyAtmosphereParams {
  assetId: CanonicalSkyBiomeId;
  alias: string;
  displayName: string;
  timeOfDay: string;
  sunIntensity: number;
  sunDirection: [number, number, number];
  sunColor: [number, number, number];
  ambientSkyColor: [number, number, number];
  ambientGroundColor: [number, number, number];
  fogColor: [number, number, number];
  fogDensity: number;
  cloudCover: number;
  cloudSpeed: [number, number];
  cloudAltitude: number;
  cloudThickness: number;
  turbidity: number;
  rayleigh: [number, number, number];
  mieCoefficient: number;
  mieDirectionalG: number;
  specialEffects: SkyAtmosphereSpecialEffects;
}

export interface SkyAtmosphereOptions {
  pakStreamer?: PakStreamer;
  baseUrl?: string;
  autoSunLight?: boolean;
  autoAmbientLight?: boolean;
  autoFog?: boolean;
}

const DEFAULT_SKY_PARAMS: Record<CanonicalSkyBiomeId, SkyAtmosphereParams> = {
  sky_golden_hour: {
    assetId: 'sky_golden_hour',
    alias: 'sky_01',
    displayName: 'Golden Hour Horizon',
    timeOfDay: '19:00',
    sunIntensity: 2.4,
    sunDirection: [0.65, 0.25, 0.70],
    sunColor: [1.0, 0.65, 0.32],
    ambientSkyColor: [0.35, 0.55, 0.85],
    ambientGroundColor: [0.15, 0.12, 0.10],
    fogColor: [0.92, 0.65, 0.38],
    fogDensity: 0.00045,
    cloudCover: 0.42,
    cloudSpeed: [12.0, 6.0],
    cloudAltitude: 350.0,
    cloudThickness: 120.0,
    turbidity: 3.8,
    rayleigh: [0.25, 0.55, 1.0],
    mieCoefficient: 0.005,
    mieDirectionalG: 0.82,
    specialEffects: {
      lightning: false,
      snow: false,
      aurora: false,
      dustHaze: false,
      sunShafts: true,
    },
  },
  sky_neotokyo_cyber: {
    assetId: 'sky_neotokyo_cyber',
    alias: 'sky_02',
    displayName: 'Neo-Tokyo Cyber Midnight',
    timeOfDay: '00:30',
    sunIntensity: 1.15,
    sunDirection: [0.35, 0.65, -0.68],
    sunColor: [0.45, 0.65, 1.0],
    ambientSkyColor: [0.12, 0.08, 0.25],
    ambientGroundColor: [0.03, 0.03, 0.05],
    fogColor: [0.10, 0.12, 0.22],
    fogDensity: 0.00085,
    cloudCover: 0.65,
    cloudSpeed: [8.0, 4.0],
    cloudAltitude: 220.0,
    cloudThickness: 90.0,
    turbidity: 4.5,
    rayleigh: [0.15, 0.25, 0.65],
    mieCoefficient: 0.012,
    mieDirectionalG: 0.78,
    specialEffects: {
      lightning: true,
      lightningFrequencySec: 4.5,
      snow: false,
      aurora: false,
      dustHaze: false,
      neonHolograms: true,
    },
  },
  sky_redrock_canyon: {
    assetId: 'sky_redrock_canyon',
    alias: 'sky_03',
    displayName: 'Redrock Canyon Crimson Dusk',
    timeOfDay: '19:45',
    sunIntensity: 1.85,
    sunDirection: [0.85, 0.12, 0.48],
    sunColor: [1.0, 0.38, 0.15],
    ambientSkyColor: [0.42, 0.20, 0.55],
    ambientGroundColor: [0.22, 0.08, 0.04],
    fogColor: [0.75, 0.32, 0.20],
    fogDensity: 0.00060,
    cloudCover: 0.28,
    cloudSpeed: [16.0, 2.0],
    cloudAltitude: 480.0,
    cloudThickness: 60.0,
    turbidity: 5.2,
    rayleigh: [0.65, 0.35, 0.50],
    mieCoefficient: 0.015,
    mieDirectionalG: 0.85,
    specialEffects: {
      lightning: false,
      snow: false,
      aurora: false,
      dustHaze: true,
      dustParticleDensity: 0.75,
    },
  },
  sky_alpine_glacier: {
    assetId: 'sky_alpine_glacier',
    alias: 'sky_04',
    displayName: 'Alpine Glacier Crystalline Apex',
    timeOfDay: '13:15',
    sunIntensity: 2.1,
    sunDirection: [-0.35, 0.82, -0.45],
    sunColor: [0.95, 0.98, 1.0],
    ambientSkyColor: [0.35, 0.65, 1.0],
    ambientGroundColor: [0.75, 0.85, 0.95],
    fogColor: [0.78, 0.88, 0.98],
    fogDensity: 0.00040,
    cloudCover: 0.35,
    cloudSpeed: [22.0, 14.0],
    cloudAltitude: 400.0,
    cloudThickness: 100.0,
    turbidity: 1.8,
    rayleigh: [0.15, 0.45, 1.0],
    mieCoefficient: 0.003,
    mieDirectionalG: 0.75,
    specialEffects: {
      lightning: false,
      snow: true,
      snowParticleRate: 1500,
      aurora: true,
      dustHaze: false,
    },
  },
};

/**
 * GLSL Shaders for Dynamic Sky Dome with Rayleigh/Mie Scattering, Sun Corona, and Aurora
 */
const SKY_DOME_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vRayDir;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vRayDir = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
    gl_Position.z = gl_Position.w; // Far plane projection
  }
`;

const SKY_DOME_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform vec3 uZenithColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uGroundColor;
  uniform float uTurbidity;
  uniform vec3 uRayleigh;
  uniform float uMieCoefficient;
  uniform float uMieDirectionalG;
  uniform float uTime;
  uniform float uAuroraIntensity;
  uniform float uLightningFlash;

  varying vec3 vWorldPosition;
  varying vec3 vRayDir;

  void main() {
    vec3 dir = normalize(vRayDir);
    float cosTheta = dot(dir, normalize(uSunDirection));

    // Altitude factor: elevation above horizon
    float h = clamp(dir.y, 0.0, 1.0);
    float groundFactor = clamp(-dir.y * 4.0, 0.0, 1.0);

    // Rayleigh scattering gradient
    vec3 skyGrad = mix(uHorizonColor, uZenithColor, pow(h, 0.65));
    skyGrad = mix(skyGrad, uGroundColor, groundFactor);

    // Sun Disc and Coronal Glare
    float sunAngularDist = acos(clamp(cosTheta, -1.0, 1.0));
    float sunDisk = exp(-pow(sunAngularDist / 0.022, 4.0)) * uSunIntensity * 8.0;
    float sunCorona = exp(-pow(sunAngularDist / 0.28, 1.7)) * (uSunIntensity * 1.5);
    float mieHaze = exp(-pow(sunAngularDist / 0.75, 1.2)) * (uSunIntensity * 0.45);

    vec3 sunLight = (sunDisk + sunCorona + mieHaze) * uSunColor;

    // Aurora Borealis undulating curtains (active in Alpine Glacier)
    vec3 aurora = vec3(0.0);
    if (uAuroraIntensity > 0.01 && dir.y > 0.15) {
      float wave1 = sin(dir.x * 5.0 + uTime * 0.7) * cos(dir.z * 4.0 + uTime * 0.4);
      float wave2 = sin(dir.x * 9.0 - uTime * 0.5) * sin(dir.z * 7.0 + uTime * 0.6);
      float curtain = clamp((wave1 * 0.6 + wave2 * 0.4) * 0.5 + 0.5, 0.0, 1.0);
      curtain *= smoothstep(0.15, 0.65, dir.y) * smoothstep(0.95, 0.65, dir.y);
      aurora = vec3(0.15, 0.95, 0.65) * curtain * uAuroraIntensity;
    }

    vec3 finalColor = skyGrad + sunLight + aurora;

    // Dynamic Lightning flash illumination (active in Neo-Tokyo Cyber)
    if (uLightningFlash > 0.001) {
      vec3 flashTint = vec3(0.75, 0.85, 1.35) * uLightningFlash * 3.2;
      finalColor += flashTint;
    }

    // ACES Filmic tonemap approximation
    vec3 x = finalColor * 0.6;
    vec3 tonemapped = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);

    gl_FragColor = vec4(tonemapped, 1.0);
  }
`;

/**
 * GLSL Shaders for Volumetric Clouds & Moving Ground Shadow Projection
 */
const CLOUD_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const CLOUD_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform vec3 uAmbientSkyColor;
  uniform float uTime;
  uniform vec2 uCloudSpeed;
  uniform float uCloudCover;
  uniform float uCloudThickness;
  uniform float uLightningFlash;

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  // Analytical 2D noise for real-time cloud billows
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 4; ++i) {
      v += a * noise(p);
      p = rot * p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uvCoord = (vWorldPosition.xz * 0.00035) + (uTime * uCloudSpeed * 0.0001);
    float n = fbm(uvCoord * 3.5);
    float n2 = fbm(uvCoord * 7.0 + vec2(1.5, -2.1));
    float density = smoothstep(1.0 - uCloudCover, 1.0, n * 0.7 + n2 * 0.3);

    // Radial distance fade
    float dist = length(vWorldPosition.xz);
    float distFade = smoothstep(3500.0, 1200.0, dist);
    density *= distFade;

    if (density < 0.01) discard;

    // Dual-lobe lighting: dark cloud belly + bright silver lining toward sun
    vec3 cloudBase = uAmbientSkyColor * 0.85;
    vec3 cloudSun = uSunColor * (uSunIntensity * 1.25);
    vec3 cloudCol = mix(cloudBase, cloudSun, pow(density, 1.4));

    if (uLightningFlash > 0.01) {
      cloudCol += vec3(0.9, 0.95, 1.4) * uLightningFlash * 4.0;
    }

    gl_FragColor = vec4(cloudCol, density * 0.88);
  }
`;

/**
 * GLSL Shaders for Directional Sun Shafts / God-Rays
 */
const SUN_SHAFTS_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SUN_SHAFTS_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 centerUv = vUv - vec2(0.5);
    float r = length(centerUv);
    float angle = atan(centerUv.y, centerUv.x);

    // Radial ray spires modulated by time
    float rays = sin(angle * 16.0 + uTime * 0.4) * 0.5 + 0.5;
    float rays2 = sin(angle * 28.0 - uTime * 0.25) * 0.5 + 0.5;
    float beam = (rays * 0.65 + rays2 * 0.35);

    float radialFalloff = exp(-r * 3.8);
    float alpha = beam * radialFalloff * clamp(uSunIntensity * 0.35, 0.0, 1.0);

    gl_FragColor = vec4(uSunColor * 1.5, alpha);
  }
`;

/**
 * SkyAtmosphereSystem handles loading, procedural rendering, and dynamic updates of:
 * 1. Dynamic HDR Sky Dome with Rayleigh/Mie atmospheric scattering & Aurora Borealis
 * 2. Primary Directional Sun Light & Ambient Hemisphere Light
 * 3. Volumetric Moving Clouds casting dynamic ground shadows
 * 4. Directional Sun Shafts / God-Rays
 * 5. Biome-Specific Atmosphere Effects (Neo-Tokyo Lightning, Alpine Snow, Redrock Dust)
 */
export class SkyAtmosphereSystem {
  private scene: THREE.Scene | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private pakStreamer: PakStreamer;
  private baseUrl: string;

  private activeSkyId: CanonicalSkyBiomeId = 'sky_golden_hour';
  private activeParams: SkyAtmosphereParams;

  // Scene Objects
  private rootGroup: THREE.Group = new THREE.Group();
  private sunLight: THREE.DirectionalLight | null = null;
  private ambientLight: THREE.HemisphereLight | null = null;
  private skyDomeMesh: THREE.Mesh | null = null;
  private skyDomeMaterial: THREE.ShaderMaterial | null = null;
  private sunShaftsGroup: THREE.Group = new THREE.Group();
  private sunShaftsMesh: THREE.Mesh | null = null;
  private sunShaftsMaterial: THREE.ShaderMaterial | null = null;

  // Volumetric Clouds & Ground Shadow
  private cloudsGroup: THREE.Group = new THREE.Group();
  private cloudMesh: THREE.Mesh | null = null;
  private cloudMaterial: THREE.ShaderMaterial | null = null;
  private cloudGroundShadowMesh: THREE.Mesh | null = null;

  // Particle Effects: Snow (Alpine) & Dust Haze (Redrock)
  private snowParticles: THREE.Points | null = null;
  private snowPositions: Float32Array | null = null;
  private snowVelocities: Float32Array | null = null;
  private dustParticles: THREE.Points | null = null;
  private dustPositions: Float32Array | null = null;

  // Dynamic Lightning System (Neo-Tokyo Cyber)
  private lightningIntensity = 0.0;
  private lightningTimer = 0.0;
  private nextLightningInterval = 4.0;

  // Environment HDR texture
  private hdriTexture: THREE.DataTexture | null = null;

  private elapsedTime = 0.0;
  private initialized = false;

  constructor(options: SkyAtmosphereOptions = {}) {
    this.pakStreamer = options.pakStreamer ?? new PakStreamer({ baseUrl: options.baseUrl });
    this.baseUrl = (options.baseUrl ?? '').replace(/\/$/, '');
    this.activeParams = { ...DEFAULT_SKY_PARAMS['sky_golden_hour'] };
    this.rootGroup.name = 'Apex_SkyAtmosphereRoot';
  }

  // ============================================================================
  // 1. LIFECYCLE: INITIALIZATION, ATTACHMENT & TEARDOWN
  // ============================================================================

  public initialize(
    scene: THREE.Scene,
    renderer?: THREE.WebGLRenderer | { webglRenderer: THREE.WebGLRenderer | null } | null
  ): void {
    if (this.initialized) {
      this.dispose();
    }

    this.scene = scene;
    if (renderer && 'webglRenderer' in renderer) {
      this.renderer = renderer.webglRenderer;
    } else if (renderer instanceof THREE.WebGLRenderer) {
      this.renderer = renderer;
    } else {
      this.renderer = null;
    }

    this.setupLights();
    this.setupSkyDome();
    this.setupSunShafts();
    this.setupVolumetricClouds();
    this.setupParticleSubsystems();

    this.scene.add(this.rootGroup);
    this.initialized = true;
  }

  private setupLights(): void {
    const sunDir = new THREE.Vector3(...this.activeParams.sunDirection).normalize();
    const sunCol = new THREE.Color(...this.activeParams.sunColor);

    this.sunLight = new THREE.DirectionalLight(sunCol, this.activeParams.sunIntensity);
    this.sunLight.name = 'Apex_SunDirectionalLight';
    this.sunLight.position.copy(sunDir.clone().multiplyScalar(1200.0));
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10.0;
    this.sunLight.shadow.camera.far = 2500.0;
    this.sunLight.shadow.camera.left = -300;
    this.sunLight.shadow.camera.right = 300;
    this.sunLight.shadow.camera.top = 300;
    this.sunLight.shadow.camera.bottom = -300;
    this.sunLight.shadow.bias = -0.0002;
    this.rootGroup.add(this.sunLight);

    const skyCol = new THREE.Color(...this.activeParams.ambientSkyColor);
    const gndCol = new THREE.Color(...this.activeParams.ambientGroundColor);
    this.ambientLight = new THREE.HemisphereLight(skyCol, gndCol, 1.0);
    this.ambientLight.name = 'Apex_AtmosphereAmbientLight';
    this.rootGroup.add(this.ambientLight);

    if (this.scene) {
      this.scene.fog = new THREE.FogExp2(
        new THREE.Color(...this.activeParams.fogColor).getHex(),
        this.activeParams.fogDensity
      );
    }
  }

  private setupSkyDome(): void {
    const geo = new THREE.SphereGeometry(3000, 32, 24);
    const sunDir = new THREE.Vector3(...this.activeParams.sunDirection).normalize();

    this.skyDomeMaterial = new THREE.ShaderMaterial({
      name: 'Apex_SkyAtmosphereDomeMaterial',
      vertexShader: SKY_DOME_VERTEX_SHADER,
      fragmentShader: SKY_DOME_FRAGMENT_SHADER,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uSunDirection: { value: sunDir },
        uSunColor: { value: new THREE.Color(...this.activeParams.sunColor) },
        uSunIntensity: { value: this.activeParams.sunIntensity },
        uZenithColor: { value: new THREE.Color(...this.activeParams.ambientSkyColor) },
        uHorizonColor: { value: new THREE.Color(...this.activeParams.fogColor) },
        uGroundColor: { value: new THREE.Color(...this.activeParams.ambientGroundColor) },
        uTurbidity: { value: this.activeParams.turbidity },
        uRayleigh: { value: new THREE.Vector3(...this.activeParams.rayleigh) },
        uMieCoefficient: { value: this.activeParams.mieCoefficient },
        uMieDirectionalG: { value: this.activeParams.mieDirectionalG },
        uTime: { value: 0.0 },
        uAuroraIntensity: { value: this.activeParams.specialEffects.aurora ? 1.0 : 0.0 },
        uLightningFlash: { value: 0.0 },
      },
    });

    this.skyDomeMesh = new THREE.Mesh(geo, this.skyDomeMaterial);
    this.skyDomeMesh.name = 'Apex_SkyDomeMesh';
    this.rootGroup.add(this.skyDomeMesh);
  }

  private setupSunShafts(): void {
    const geo = new THREE.PlaneGeometry(350, 350);
    const sunDir = new THREE.Vector3(...this.activeParams.sunDirection).normalize();

    this.sunShaftsMaterial = new THREE.ShaderMaterial({
      name: 'Apex_SunShaftsMaterial',
      vertexShader: SUN_SHAFTS_VERTEX_SHADER,
      fragmentShader: SUN_SHAFTS_FRAGMENT_SHADER,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uSunColor: { value: new THREE.Color(...this.activeParams.sunColor) },
        uSunIntensity: { value: this.activeParams.sunIntensity },
        uTime: { value: 0.0 },
      },
    });

    this.sunShaftsMesh = new THREE.Mesh(geo, this.sunShaftsMaterial);
    this.sunShaftsMesh.name = 'Apex_SunShaftsBillboard';
    this.sunShaftsMesh.position.copy(sunDir.clone().multiplyScalar(950.0));
    this.sunShaftsMesh.lookAt(0, 0, 0);

    this.sunShaftsGroup.add(this.sunShaftsMesh);
    this.sunShaftsGroup.visible = Boolean(this.activeParams.specialEffects.sunShafts);
    this.rootGroup.add(this.sunShaftsGroup);
  }

  private setupVolumetricClouds(): void {
    // 1. Cloud Layer High Mesh (at cloudAltitude)
    const cloudGeo = new THREE.PlaneGeometry(6000, 6000, 16, 16);
    cloudGeo.rotateX(-Math.PI / 2.0);

    this.cloudMaterial = new THREE.ShaderMaterial({
      name: 'Apex_VolumetricCloudsMaterial',
      vertexShader: CLOUD_VERTEX_SHADER,
      fragmentShader: CLOUD_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(...this.activeParams.sunDirection).normalize() },
        uSunColor: { value: new THREE.Color(...this.activeParams.sunColor) },
        uSunIntensity: { value: this.activeParams.sunIntensity },
        uAmbientSkyColor: { value: new THREE.Color(...this.activeParams.ambientSkyColor) },
        uTime: { value: 0.0 },
        uCloudSpeed: { value: new THREE.Vector2(...this.activeParams.cloudSpeed) },
        uCloudCover: { value: this.activeParams.cloudCover },
        uCloudThickness: { value: this.activeParams.cloudThickness },
        uLightningFlash: { value: 0.0 },
      },
    });

    this.cloudMesh = new THREE.Mesh(cloudGeo, this.cloudMaterial);
    this.cloudMesh.name = 'Apex_VolumetricCloudsMesh';
    this.cloudMesh.position.y = this.activeParams.cloudAltitude;
    this.cloudsGroup.add(this.cloudMesh);

    // 2. Dynamic Cloud Ground Shadow Projector Plane
    const groundShadowGeo = new THREE.PlaneGeometry(6000, 6000);
    groundShadowGeo.rotateX(-Math.PI / 2.0);

    const groundShadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    this.cloudGroundShadowMesh = new THREE.Mesh(groundShadowGeo, groundShadowMat);
    this.cloudGroundShadowMesh.name = 'Apex_CloudGroundShadowMesh';
    this.cloudGroundShadowMesh.position.y = 0.5; // Just above ground
    this.cloudsGroup.add(this.cloudGroundShadowMesh);

    this.rootGroup.add(this.cloudsGroup);
  }

  private setupParticleSubsystems(): void {
    // 1. Alpine Glacier Blowing Snow Particles (1500 particles)
    const snowCount = 1500;
    const snowGeo = new THREE.BufferGeometry();
    this.snowPositions = new Float32Array(snowCount * 3);
    this.snowVelocities = new Float32Array(snowCount * 3);

    for (let i = 0; i < snowCount; i++) {
      const idx = i * 3;
      this.snowPositions[idx + 0] = (Math.random() - 0.5) * 120.0;
      this.snowPositions[idx + 1] = Math.random() * 35.0;
      this.snowPositions[idx + 2] = (Math.random() - 0.5) * 120.0;

      this.snowVelocities[idx + 0] = (Math.random() - 0.3) * 12.0 - 15.0; // Strong lateral wind
      this.snowVelocities[idx + 1] = -Math.random() * 8.0 - 4.0;          // Downward gravity
      this.snowVelocities[idx + 2] = (Math.random() - 0.5) * 8.0;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(this.snowPositions, 3));

    const snowMat = new THREE.PointsMaterial({
      color: 0xe8f6ff,
      size: 0.45,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.snowParticles = new THREE.Points(snowGeo, snowMat);
    this.snowParticles.name = 'Apex_AlpineSnowParticles';
    this.snowParticles.visible = Boolean(this.activeParams.specialEffects.snow);
    this.rootGroup.add(this.snowParticles);

    // 2. Redrock Canyon Warm Dust Haze Particles (600 particles)
    const dustCount = 600;
    const dustGeo = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(dustCount * 3);

    for (let i = 0; i < dustCount; i++) {
      const idx = i * 3;
      this.dustPositions[idx + 0] = (Math.random() - 0.5) * 150.0;
      this.dustPositions[idx + 1] = Math.random() * 14.0 + 0.2;
      this.dustPositions[idx + 2] = (Math.random() - 0.5) * 150.0;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));

    const dustMat = new THREE.PointsMaterial({
      color: 0xdca060,
      size: 0.65,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });

    this.dustParticles = new THREE.Points(dustGeo, dustMat);
    this.dustParticles.name = 'Apex_RedrockDustParticles';
    this.dustParticles.visible = Boolean(this.activeParams.specialEffects.dustHaze);
    this.rootGroup.add(this.dustParticles);
  }

  // ============================================================================
  // 2. ASYNCHRONOUS .PAK LOADING & BIOME SWITCHING
  // ============================================================================

  public async loadSky(skyIdOrAlias: SkyBiomeId | string): Promise<ParsedPakBundle> {
    const canonicalId = resolveSkyCanonicalId(skyIdOrAlias);
    this.activeSkyId = canonicalId;

    let bundle: ParsedPakBundle | undefined;

    // 1. Try reading directly from disk if in Node.js test environment
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const candidates = [
          path.resolve(process.cwd(), `assets/paks/sky/${canonicalId}.pak`),
          path.resolve(process.cwd(), `../assets/paks/sky/${canonicalId}.pak`),
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            const fileBuf = fs.readFileSync(candidate);
            const ab = fileBuf.buffer.slice(
              fileBuf.byteOffset,
              fileBuf.byteOffset + fileBuf.byteLength
            );
            bundle = this.pakStreamer.loadFromBuffer(`sky:${canonicalId}`, ab, true);
            break;
          }
        }
      } catch {
        // Fall back below
      }
    }

    // 2. If not loaded via Node.js fs, load via PakStreamer (WebWorker/fetch/synthetic)
    if (!bundle) {
      bundle = await this.pakStreamer.loadSkyPak(canonicalId, true);
    }

    // 3. Extract metadata from parsed bundle
    if (bundle.metadata && typeof bundle.metadata === 'object') {
      const meta = bundle.metadata as Partial<SkyAtmosphereParams>;
      this.activeParams = {
        ...DEFAULT_SKY_PARAMS[canonicalId],
        ...meta,
        specialEffects: {
          ...DEFAULT_SKY_PARAMS[canonicalId].specialEffects,
          ...(meta.specialEffects ?? {}),
        },
      };
    } else {
      this.activeParams = { ...DEFAULT_SKY_PARAMS[canonicalId] };
    }

    // 4. Extract HDRI equirectangular data texture if present
    const hdriChunk = bundle.chunks.get('hdri_equirect_rgbe');
    if (hdriChunk && hdriChunk.byteLength >= 1024 * 512 * 4) {
      if (this.hdriTexture) {
        this.hdriTexture.dispose();
      }
      this.hdriTexture = new THREE.DataTexture(
        hdriChunk,
        1024,
        512,
        THREE.RGBAFormat,
        THREE.UnsignedByteType
      );
      this.hdriTexture.needsUpdate = true;
      if (this.scene) {
        this.scene.environment = this.hdriTexture;
      }
    }

    // 5. Update scene lighting and materials to match the new biome
    this.applyAtmosphereParams();

    return bundle;
  }

  private applyAtmosphereParams(): void {
    const sunDir = new THREE.Vector3(...this.activeParams.sunDirection).normalize();
    const sunCol = new THREE.Color(...this.activeParams.sunColor);
    const skyCol = new THREE.Color(...this.activeParams.ambientSkyColor);
    const gndCol = new THREE.Color(...this.activeParams.ambientGroundColor);
    const fogCol = new THREE.Color(...this.activeParams.fogColor);

    if (this.sunLight) {
      this.sunLight.color.copy(sunCol);
      this.sunLight.intensity = this.activeParams.sunIntensity;
      this.sunLight.position.copy(sunDir.clone().multiplyScalar(1200.0));
    }

    if (this.ambientLight) {
      this.ambientLight.color.copy(skyCol);
      this.ambientLight.groundColor.copy(gndCol);
    }

    if (this.scene && this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(fogCol);
      this.scene.fog.density = this.activeParams.fogDensity;
    }

    if (this.skyDomeMaterial) {
      this.skyDomeMaterial.uniforms.uSunDirection.value.copy(sunDir);
      this.skyDomeMaterial.uniforms.uSunColor.value.copy(sunCol);
      this.skyDomeMaterial.uniforms.uSunIntensity.value = this.activeParams.sunIntensity;
      this.skyDomeMaterial.uniforms.uZenithColor.value.copy(skyCol);
      this.skyDomeMaterial.uniforms.uHorizonColor.value.copy(fogCol);
      this.skyDomeMaterial.uniforms.uGroundColor.value.copy(gndCol);
      this.skyDomeMaterial.uniforms.uTurbidity.value = this.activeParams.turbidity;
      this.skyDomeMaterial.uniforms.uRayleigh.value.set(...this.activeParams.rayleigh);
      this.skyDomeMaterial.uniforms.uMieCoefficient.value = this.activeParams.mieCoefficient;
      this.skyDomeMaterial.uniforms.uMieDirectionalG.value = this.activeParams.mieDirectionalG;
      this.skyDomeMaterial.uniforms.uAuroraIntensity.value = this.activeParams.specialEffects.aurora
        ? 1.0
        : 0.0;
    }

    if (this.sunShaftsMaterial && this.sunShaftsMesh) {
      this.sunShaftsMaterial.uniforms.uSunColor.value.copy(sunCol);
      this.sunShaftsMaterial.uniforms.uSunIntensity.value = this.activeParams.sunIntensity;
      this.sunShaftsMesh.position.copy(sunDir.clone().multiplyScalar(950.0));
      this.sunShaftsMesh.lookAt(0, 0, 0);
      this.sunShaftsGroup.visible = Boolean(this.activeParams.specialEffects.sunShafts);
    }

    if (this.cloudMaterial && this.cloudMesh) {
      this.cloudMesh.position.y = this.activeParams.cloudAltitude;
      this.cloudMaterial.uniforms.uSunDirection.value.copy(sunDir);
      this.cloudMaterial.uniforms.uSunColor.value.copy(sunCol);
      this.cloudMaterial.uniforms.uSunIntensity.value = this.activeParams.sunIntensity;
      this.cloudMaterial.uniforms.uAmbientSkyColor.value.copy(skyCol);
      this.cloudMaterial.uniforms.uCloudSpeed.value.set(...this.activeParams.cloudSpeed);
      this.cloudMaterial.uniforms.uCloudCover.value = this.activeParams.cloudCover;
      this.cloudMaterial.uniforms.uCloudThickness.value = this.activeParams.cloudThickness;
    }

    // Toggle particle effects
    if (this.snowParticles) {
      this.snowParticles.visible = Boolean(this.activeParams.specialEffects.snow);
    }
    if (this.dustParticles) {
      this.dustParticles.visible = Boolean(this.activeParams.specialEffects.dustHaze);
    }

    // Reset dynamic lightning
    this.lightningIntensity = 0.0;
    this.lightningTimer = 0.0;
    this.nextLightningInterval = this.activeParams.specialEffects.lightningFrequencySec ?? 4.5;
  }

  // ============================================================================
  // 3. FRAME UPDATE & REAL-TIME DYNAMICS (CLOUDS, LIGHTNING, PARTICLES)
  // ============================================================================

  public update(deltaSec: number, carPos: Vec3Tuple = [0, 0, 0]): void {
    const dt = Math.max(0.0001, Math.min(deltaSec, 0.2));
    this.elapsedTime += dt;

    // 1. Update Sky Dome & Cloud Uniforms
    if (this.skyDomeMaterial) {
      this.skyDomeMaterial.uniforms.uTime.value = this.elapsedTime;
      this.skyDomeMaterial.uniforms.uLightningFlash.value = this.lightningIntensity;
    }

    if (this.sunShaftsMaterial) {
      this.sunShaftsMaterial.uniforms.uTime.value = this.elapsedTime;
    }

    if (this.cloudMaterial) {
      this.cloudMaterial.uniforms.uTime.value = this.elapsedTime;
      this.cloudMaterial.uniforms.uLightningFlash.value = this.lightningIntensity;
    }

    // 2. Follow car position with sky dome and cloud shadow projector
    if (this.skyDomeMesh) {
      this.skyDomeMesh.position.set(carPos[0], carPos[1], carPos[2]);
    }

    if (this.cloudMesh) {
      this.cloudMesh.position.x = carPos[0];
      this.cloudMesh.position.z = carPos[2];
    }

    if (this.cloudGroundShadowMesh) {
      // Offset ground shadow projection based on sun direction and cloud altitude
      const sunDir = this.activeParams.sunDirection;
      const shadowOffsetX = (-sunDir[0] / Math.max(0.15, sunDir[1])) * this.activeParams.cloudAltitude;
      const shadowOffsetZ = (-sunDir[2] / Math.max(0.15, sunDir[1])) * this.activeParams.cloudAltitude;
      this.cloudGroundShadowMesh.position.set(
        carPos[0] + shadowOffsetX * 0.4,
        carPos[1] + 0.5,
        carPos[2] + shadowOffsetZ * 0.4
      );
    }

    // 3. Dynamic Lightning Simulation (Neo-Tokyo Cyber)
    this.updateLightning(dt);

    // 4. Blowing Snow Particles (Alpine Glacier)
    this.updateSnowParticles(dt, carPos);

    // 5. Desert Dust Haze Particles (Redrock Canyon)
    this.updateDustParticles(dt, carPos);
  }

  private updateLightning(dt: number): void {
    if (!this.activeParams.specialEffects.lightning) {
      this.lightningIntensity = 0.0;
      return;
    }

    this.lightningTimer += dt;
    if (this.lightningTimer >= this.nextLightningInterval) {
      this.triggerLightning(1.5 + Math.random() * 1.8);
      this.lightningTimer = 0.0;
      this.nextLightningInterval = 3.0 + Math.random() * 4.0;
    }

    // Exponential decay
    if (this.lightningIntensity > 0.001) {
      this.lightningIntensity = Math.max(0.0, this.lightningIntensity - dt * 6.5);

      // Spike light intensities during strike
      if (this.sunLight) {
        this.sunLight.intensity =
          this.activeParams.sunIntensity + this.lightningIntensity * 2.8;
      }
      if (this.ambientLight) {
        this.ambientLight.intensity = 1.0 + this.lightningIntensity * 3.5;
      }
    } else {
      if (this.sunLight) {
        this.sunLight.intensity = this.activeParams.sunIntensity;
      }
      if (this.ambientLight) {
        this.ambientLight.intensity = 1.0;
      }
    }
  }

  public triggerLightning(intensity = 2.5): void {
    this.lightningIntensity = Math.max(this.lightningIntensity, intensity);
  }

  private updateSnowParticles(dt: number, carPos: Vec3Tuple): void {
    if (!this.activeParams.specialEffects.snow || !this.snowParticles || !this.snowPositions || !this.snowVelocities) {
      return;
    }

    const count = this.snowPositions.length / 3;
    const boxRadius = 60.0;
    const boxHeight = 35.0;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;

      this.snowPositions[idx + 0] += this.snowVelocities[idx + 0] * dt;
      this.snowPositions[idx + 1] += this.snowVelocities[idx + 1] * dt;
      this.snowPositions[idx + 2] += this.snowVelocities[idx + 2] * dt;

      // Wrap around carPos bounding volume
      const dx = this.snowPositions[idx + 0] - carPos[0];
      const dy = this.snowPositions[idx + 1] - carPos[1];
      const dz = this.snowPositions[idx + 2] - carPos[2];

      if (dx < -boxRadius) this.snowPositions[idx + 0] = carPos[0] + boxRadius;
      if (dx > boxRadius) this.snowPositions[idx + 0] = carPos[0] - boxRadius;
      if (dy < 0.2) this.snowPositions[idx + 1] = carPos[1] + boxHeight;
      if (dy > boxHeight) this.snowPositions[idx + 1] = carPos[1] + 0.5;
      if (dz < -boxRadius) this.snowPositions[idx + 2] = carPos[2] + boxRadius;
      if (dz > boxRadius) this.snowPositions[idx + 2] = carPos[2] - boxRadius;
    }

    const posAttr = this.snowParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
    if (posAttr) {
      posAttr.needsUpdate = true;
    }
  }

  private updateDustParticles(dt: number, carPos: Vec3Tuple): void {
    if (!this.activeParams.specialEffects.dustHaze || !this.dustParticles || !this.dustPositions) {
      return;
    }

    const count = this.dustPositions.length / 3;
    const boxRadius = 75.0;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;

      // Gentle desert dust drift
      this.dustPositions[idx + 0] += (-8.0 + Math.sin(this.elapsedTime * 0.5 + i) * 2.0) * dt;
      this.dustPositions[idx + 2] += (2.0 + Math.cos(this.elapsedTime * 0.3 + i) * 1.5) * dt;

      const dx = this.dustPositions[idx + 0] - carPos[0];
      const dz = this.dustPositions[idx + 2] - carPos[2];

      if (dx < -boxRadius) this.dustPositions[idx + 0] = carPos[0] + boxRadius;
      if (dx > boxRadius) this.dustPositions[idx + 0] = carPos[0] - boxRadius;
      if (dz < -boxRadius) this.dustPositions[idx + 2] = carPos[2] + boxRadius;
      if (dz > boxRadius) this.dustPositions[idx + 2] = carPos[2] - boxRadius;
    }

    const posAttr = this.dustParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
    if (posAttr) {
      posAttr.needsUpdate = true;
    }
  }

  // ============================================================================
  // 4. ACCESSORS & RUNTIME INSPECTION
  // ============================================================================

  public getActiveSkyId(): CanonicalSkyBiomeId {
    return this.activeSkyId;
  }

  public getAtmosphereParams(): Readonly<SkyAtmosphereParams> {
    return this.activeParams;
  }

  public getSunLight(): THREE.DirectionalLight | null {
    return this.sunLight;
  }

  public getAmbientLight(): THREE.HemisphereLight | null {
    return this.ambientLight;
  }

  public getSkyDomeMesh(): THREE.Mesh | null {
    return this.skyDomeMesh;
  }

  public getCloudMesh(): THREE.Mesh | null {
    return this.cloudMesh;
  }

  public getSunShaftsGroup(): THREE.Group {
    return this.sunShaftsGroup;
  }

  public getSnowParticles(): THREE.Points | null {
    return this.snowParticles;
  }

  public getDustParticles(): THREE.Points | null {
    return this.dustParticles;
  }

  public getLightningIntensity(): number {
    return this.lightningIntensity;
  }

  public setSunDirection(dir: [number, number, number]): void {
    this.activeParams.sunDirection = [...dir];
    const sunDir = new THREE.Vector3(...dir).normalize();
    if (this.sunLight) {
      this.sunLight.position.copy(sunDir.clone().multiplyScalar(1200.0));
    }
    if (this.skyDomeMaterial) {
      this.skyDomeMaterial.uniforms.uSunDirection.value.copy(sunDir);
    }
    if (this.sunShaftsMesh) {
      this.sunShaftsMesh.position.copy(sunDir.clone().multiplyScalar(950.0));
      this.sunShaftsMesh.lookAt(0, 0, 0);
    }
    if (this.cloudMaterial) {
      this.cloudMaterial.uniforms.uSunDirection.value.copy(sunDir);
    }
  }

  // ============================================================================
  // 5. TEARDOWN & RESOURCE CLEANUP
  // ============================================================================

  public dispose(): void {
    if (this.scene) {
      this.scene.remove(this.rootGroup);
    }

    if (this.skyDomeMesh) {
      this.skyDomeMesh.geometry.dispose();
      this.skyDomeMaterial?.dispose();
    }

    if (this.sunShaftsMesh) {
      this.sunShaftsMesh.geometry.dispose();
      this.sunShaftsMaterial?.dispose();
    }

    if (this.cloudMesh) {
      this.cloudMesh.geometry.dispose();
      this.cloudMaterial?.dispose();
    }

    if (this.cloudGroundShadowMesh) {
      this.cloudGroundShadowMesh.geometry.dispose();
      if (Array.isArray(this.cloudGroundShadowMesh.material)) {
        this.cloudGroundShadowMesh.material.forEach((m) => m.dispose());
      } else {
        this.cloudGroundShadowMesh.material.dispose();
      }
    }

    if (this.snowParticles) {
      this.snowParticles.geometry.dispose();
      (this.snowParticles.material as THREE.Material).dispose();
    }

    if (this.dustParticles) {
      this.dustParticles.geometry.dispose();
      (this.dustParticles.material as THREE.Material).dispose();
    }

    if (this.hdriTexture) {
      this.hdriTexture.dispose();
      this.hdriTexture = null;
    }

    this.rootGroup.clear();
    this.sunLight = null;
    this.ambientLight = null;
    this.skyDomeMesh = null;
    this.skyDomeMaterial = null;
    this.cloudMesh = null;
    this.cloudMaterial = null;
    this.cloudGroundShadowMesh = null;
    this.snowParticles = null;
    this.dustParticles = null;
    this.initialized = false;
  }
}
