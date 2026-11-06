// src/vehicles/HighPolyVehicleBuilder.ts
// High-Poly Subdivision Bodywork, Active Aerodynamics & Glowing Brake Discs Builder
// Apex Grand Prix: Uncapped Next-Gen Edition
//
// Features:
// 1. High-Poly Subdivision Bodywork:
//    - Contoured aerodynamic fenders, front splitters with winglets, Venturi underbody diffusers
//    - Side skirts with carbon aerodynamic fins, rear diffuser tunnels
//    - Mid-engine transparent bay cover revealing 3D engine block on supercars/hypercars
// 2. Dynamic DRS / Airbrake Rear Wing:
//    - Tilts dynamically under heavy braking (up to 45° / 0.785 rad airbrake)
//    - Flattens to 0° in DRS mode for maximum top speed
// 3. Carbon-Ceramic Brake Discs:
//    - Heats up to 1,000°C bright orange with dynamic emissive blackbody glow under heavy braking
// 4. 12 PBR Paint Finishes:
//    - Full support for all 12 automotive liveries using AutomotivePaint.glsl
// 5. Integration with 3D Cockpit & Framed Multi-Pane Glass (CockpitInteriorBuilder.ts)

import * as THREE from 'three';
import { LiveCockpitTelemetry, VehicleSpec } from '../core/types';
import {
  AUTOMOTIVE_PAINT_LIVERIES,
  AutomotiveLiveryPreset,
  createAutomotivePaintMaterial,
  getAutomotivePaintLivery,
} from '../core/UncappedRenderer';
import {
  CockpitInteriorInstance,
  buildCockpitInterior,
  updateCockpitTelemetry,
} from './CockpitInteriorBuilder';

export interface VehicleWheelInstance {
  group: THREE.Group;
  rimMesh: THREE.Mesh;
  tireMesh: THREE.Mesh;
  brakeDiscMesh: THREE.Mesh;
  brakeDiscMaterial: THREE.Material;
  brakeCaliperMesh: THREE.Mesh;
  steerPivot?: THREE.Group;
}

export interface VehicleModelInstance {
  spec: VehicleSpec;
  rootGroup: THREE.Group;
  bodyworkGroup: THREE.Group;
  bodyMesh: THREE.Mesh;
  bodyMaterials: THREE.Material[];
  wingGroup: THREE.Group;
  wingMesh: THREE.Mesh;
  splitterMesh: THREE.Mesh;
  diffuserMesh: THREE.Mesh;
  engineBlockMesh?: THREE.Mesh;
  wheels: {
    fl: VehicleWheelInstance;
    fr: VehicleWheelInstance;
    rl: VehicleWheelInstance;
    rr: VehicleWheelInstance;
  };
  brakeDiscs: THREE.Mesh[];
  brakeDiscMaterials: THREE.Material[];
  cockpitInterior: CockpitInteriorInstance;
  // State
  currentLiveryIndex: number;
  currentBrakeTempCelsius: number;
  isDrsActive: boolean;
  airbrakeAngleRad: number;
  steerAngleRad: number;
  wheelSpinRad: number;
}

/**
 * Computes physically inspired blackbody thermal emission color for carbon-ceramic discs (20C .. 1000C).
 */
export function computeBrakeBlackbodyColor(tempCelsius: number): {
  color: THREE.Color;
  intensity: number;
} {
  const norm = Math.max(0, Math.min(1.0, (tempCelsius - 250) / 750));
  if (norm <= 0.01) {
    return { color: new THREE.Color(0x000000), intensity: 0.0 };
  }

  // 300C dull red -> 650C crimson orange -> 1000C bright orange-yellow
  const cLow = new THREE.Color(0x8c0800);
  const cMid = new THREE.Color(0xff4500);
  const cHigh = new THREE.Color(0xffd050);

  const outColor = new THREE.Color();
  if (norm < 0.5) {
    outColor.lerpColors(cLow, cMid, norm * 2.0);
  } else {
    outColor.lerpColors(cMid, cHigh, (norm - 0.5) * 2.0);
  }

  const intensity = Math.pow(norm, 1.85) * 3.5;
  return { color: outColor, intensity };
}

/**
 * Constructs a contoured aerodynamic high-poly subdivision body mesh.
 */
function createAerodynamicBodyGeometry(spec: VehicleSpec): THREE.BufferGeometry {
  const isBike = spec.archetype === 'SCOOTER_BIKE';
  const isCommercial = spec.archetype === 'HEAVY_COMMERCIAL';
  const isOpenWheel = spec.archetype === 'OPEN_WHEEL_KART';
  const isSupersonic = spec.archetype === 'SUPERSONIC_CONCEPT';

  let length = 4.6;
  let width = 1.95;
  let height = 0.95;

  if (isBike) {
    length = 2.2;
    width = 0.65;
    height = 1.1;
  } else if (isCommercial) {
    length = 7.5;
    width = 2.45;
    height = 2.8;
  } else if (isOpenWheel) {
    length = 4.8;
    width = 1.6;
    height = 0.75;
  } else if (isSupersonic) {
    length = 8.5;
    width = 1.8;
    height = 0.85;
  }

  // Generate contoured body shell with curved fenders
  const nx = 18;
  const nz = 28;
  const geom = new THREE.PlaneGeometry(width, length, nx, nz);
  geom.rotateX(-Math.PI / 2); // Lay flat on XZ plane

  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    // Profile curve along car length Z (-length/2 to +length/2)
    const zNorm = z / (length * 0.5); // -1 (rear) to +1 (front)
    const xNorm = x / (width * 0.5); // -1 (left) to +1 (right)

    // Nose taper in front, aerodynamic diffuser kickup in rear
    let y = 0.35;
    // Hood slope
    if (zNorm > 0.2) {
      y = 0.35 - (zNorm - 0.2) * 0.18;
    } else if (zNorm < -0.3) {
      // Rear deck & fastback slope
      y = 0.42 - (Math.abs(zNorm) - 0.3) * 0.12;
    } else {
      // Cockpit / roof bubble
      y = 0.48 + (1.0 - zNorm * zNorm) * 0.15;
    }

    // Contoured Fenders (bulge outward and upward over wheels)
    const isFrontWheelZone = Math.abs(z - length * 0.32) < 0.65;
    const isRearWheelZone = Math.abs(z + length * 0.32) < 0.65;
    if ((isFrontWheelZone || isRearWheelZone) && Math.abs(xNorm) > 0.72) {
      y += 0.12 * Math.sin((Math.abs(xNorm) - 0.72) * Math.PI * 3.5);
    }

    // Side tumblehome curvature
    y -= (xNorm * xNorm) * 0.1;

    pos.setY(i, y * (height / 0.95));
  }

  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds a wheel assembly with brake disc and caliper.
 */
function createWheelAssembly(
  isFront: boolean,
  isLeft: boolean,
  wheelRadius = 0.34,
  wheelWidth = 0.26
): VehicleWheelInstance {
  const group = new THREE.Group();
  group.name = `${isFront ? 'Front' : 'Rear'}_${isLeft ? 'Left' : 'Right'}_Wheel`;

  const steerPivot = isFront ? new THREE.Group() : undefined;
  if (steerPivot) {
    steerPivot.name = `${group.name}_SteerPivot`;
    group.add(steerPivot);
  }
  const parentContainer = steerPivot || group;

  // 1. Tire Mesh (Rubber PBR)
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x141416,
    roughness: 0.85,
    metalness: 0.05,
  });
  const tireGeo = new THREE.CylinderGeometry(
    wheelRadius,
    wheelRadius,
    wheelWidth,
    24,
    1,
    false
  );
  tireGeo.rotateZ(Math.PI / 2);
  const tireMesh = new THREE.Mesh(tireGeo, tireMat);
  tireMesh.name = 'Tire';
  parentContainer.add(tireMesh);

  // 2. Alloy / Carbon Rim Mesh
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x242830,
    roughness: 0.18,
    metalness: 0.92,
  });
  const rimGeo = new THREE.CylinderGeometry(
    wheelRadius * 0.68,
    wheelRadius * 0.68,
    wheelWidth * 0.95,
    20
  );
  rimGeo.rotateZ(Math.PI / 2);
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  rimMesh.name = 'Rim';
  parentContainer.add(rimMesh);

  // 3. Carbon-Ceramic Brake Disc with Blackbody Thermal Glow
  const brakeDiscMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2e,
    roughness: 0.45,
    metalness: 0.85,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0.0,
  });

  const discRadius = wheelRadius * 0.62;
  const discGeo = new THREE.CylinderGeometry(discRadius, discRadius, 0.035, 24);
  discGeo.rotateZ(Math.PI / 2);
  const brakeDiscMesh = new THREE.Mesh(discGeo, brakeDiscMat);
  brakeDiscMesh.name = 'CarbonCeramicBrakeDisc';
  brakeDiscMesh.position.x = isLeft ? 0.02 : -0.02;
  parentContainer.add(brakeDiscMesh);

  // 4. Multi-Piston Racing Brake Caliper (Brembo Red / Yellow)
  const caliperMat = new THREE.MeshStandardMaterial({
    color: isFront ? 0xd4001a : 0xffbf00,
    roughness: 0.2,
    metalness: 0.7,
  });
  const caliperGeo = new THREE.BoxGeometry(0.065, discRadius * 0.65, 0.12);
  const brakeCaliperMesh = new THREE.Mesh(caliperGeo, caliperMat);
  brakeCaliperMesh.name = 'BrakeCaliper';
  brakeCaliperMesh.position.set(isLeft ? 0.04 : -0.04, discRadius * 0.65, 0);
  parentContainer.add(brakeCaliperMesh);

  return {
    group,
    rimMesh,
    tireMesh,
    brakeDiscMesh,
    brakeDiscMaterial: brakeDiscMat,
    brakeCaliperMesh,
    steerPivot,
  };
}

/**
 * Builds the complete High-Poly Three.js vehicle model.
 */
export function buildVehicle(
  spec: VehicleSpec,
  liveryIndex = 0
): VehicleModelInstance {
  const rootGroup = new THREE.Group();
  rootGroup.name = `Vehicle_${spec.id}_${spec.pakDir}`;

  const preset = getAutomotivePaintLivery(liveryIndex);
  const bodyMaterial = createAutomotivePaintMaterial(preset.index, {
    baseColor: spec.defaultPrimaryColor,
    secondaryColor: spec.defaultAccentColor,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x16181d,
    roughness: 0.25,
    metalness: 0.5,
  });

  // ==========================================================================
  // 1. HIGH-POLY BODYWORK CHASSIS & AERODYNAMIC FENDERS
  // ==========================================================================
  const bodyworkGroup = new THREE.Group();
  bodyworkGroup.name = 'BodyworkGroup';

  const bodyGeo = createAerodynamicBodyGeometry(spec);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMaterial);
  bodyMesh.name = 'HighPolySubdivisionBody';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyworkGroup.add(bodyMesh);

  // Front Splitter with Downforce Winglets
  const splitterGeo = new THREE.BoxGeometry(2.05, 0.04, 0.72);
  const splitterMesh = new THREE.Mesh(splitterGeo, carbonMat);
  splitterMesh.name = 'FrontSplitter';
  splitterMesh.position.set(0, 0.12, 2.15);
  bodyworkGroup.add(splitterMesh);

  // Left & Right Splitter Winglets
  const wingletGeo = new THREE.BoxGeometry(0.03, 0.18, 0.25);
  const leftWinglet = new THREE.Mesh(wingletGeo, carbonMat);
  leftWinglet.position.set(-1.02, 0.18, 2.25);
  bodyworkGroup.add(leftWinglet);

  const rightWinglet = new THREE.Mesh(wingletGeo, carbonMat);
  rightWinglet.position.set(1.02, 0.18, 2.25);
  bodyworkGroup.add(rightWinglet);

  // Venturi Underbody Diffuser Tunnels
  const diffuserGeo = new THREE.BoxGeometry(1.85, 0.12, 1.15);
  diffuserGeo.rotateX(-0.14); // Kick up toward rear
  const diffuserMesh = new THREE.Mesh(diffuserGeo, carbonMat);
  diffuserMesh.name = 'VenturiDiffuser';
  diffuserMesh.position.set(0, 0.18, -2.1);
  bodyworkGroup.add(diffuserMesh);

  // Side Skirts
  const skirtGeo = new THREE.BoxGeometry(0.12, 0.04, 2.8);
  const leftSkirt = new THREE.Mesh(skirtGeo, carbonMat);
  leftSkirt.position.set(-0.98, 0.14, 0);
  bodyworkGroup.add(leftSkirt);

  const rightSkirt = new THREE.Mesh(skirtGeo, carbonMat);
  rightSkirt.position.set(0.98, 0.14, 0);
  bodyworkGroup.add(rightSkirt);

  // Headlights & Taillights
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xeeffff,
    emissiveIntensity: 2.2,
  });
  const headlightGeo = new THREE.BoxGeometry(0.32, 0.08, 0.12);
  const leftHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
  leftHeadlight.position.set(-0.68, 0.45, 2.15);
  bodyworkGroup.add(leftHeadlight);

  const rightHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
  rightHeadlight.position.set(0.68, 0.45, 2.15);
  bodyworkGroup.add(rightHeadlight);

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xff1100,
    emissive: 0xff0000,
    emissiveIntensity: 1.8,
  });
  const taillightGeo = new THREE.BoxGeometry(0.42, 0.06, 0.08);
  const leftTaillight = new THREE.Mesh(taillightGeo, taillightMat);
  leftTaillight.position.set(-0.62, 0.52, -2.25);
  bodyworkGroup.add(leftTaillight);

  const rightTaillight = new THREE.Mesh(taillightGeo, taillightMat);
  rightTaillight.position.set(0.62, 0.52, -2.25);
  bodyworkGroup.add(rightTaillight);

  // Twin Exhaust Tips
  const exhaustMat = new THREE.MeshStandardMaterial({
    color: 0x444850,
    metalness: 0.95,
    roughness: 0.15,
  });
  const exhaustGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.22, 16);
  exhaustGeo.rotateX(Math.PI / 2);

  const leftExhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
  leftExhaust.position.set(-0.25, 0.26, -2.32);
  bodyworkGroup.add(leftExhaust);

  const rightExhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
  rightExhaust.position.set(0.25, 0.26, -2.32);
  bodyworkGroup.add(rightExhaust);

  rootGroup.add(bodyworkGroup);

  // ==========================================================================
  // 2. DYNAMIC DRS / AIRBRAKE REAR WING
  // ==========================================================================
  const wingGroup = new THREE.Group();
  wingGroup.name = 'DynamicRearWingAssembly';
  wingGroup.position.set(0, 0.88, -2.05);

  // Aerodynamic Pylons
  const pylonGeo = new THREE.BoxGeometry(0.025, 0.38, 0.16);
  const leftPylon = new THREE.Mesh(pylonGeo, carbonMat);
  leftPylon.position.set(-0.45, 0.18, 0);
  wingGroup.add(leftPylon);

  const rightPylon = new THREE.Mesh(pylonGeo, carbonMat);
  rightPylon.position.set(0.45, 0.18, 0);
  wingGroup.add(rightPylon);

  // Active Airfoil Blade (tilts around local X axis)
  const airfoilGeo = new THREE.BoxGeometry(1.85, 0.035, 0.38);
  const wingMesh = new THREE.Mesh(airfoilGeo, carbonMat);
  wingMesh.name = 'ActiveAirfoilBlade';
  wingMesh.position.set(0, 0.36, 0);
  wingMesh.rotation.x = 0.18; // Default downforce trim angle (approx 10 degrees)
  wingGroup.add(wingMesh);

  // Endplates
  const endplateGeo = new THREE.BoxGeometry(0.02, 0.24, 0.42);
  const leftEndplate = new THREE.Mesh(endplateGeo, carbonMat);
  leftEndplate.position.set(-0.93, 0.36, 0);
  wingGroup.add(leftEndplate);

  const rightEndplate = new THREE.Mesh(endplateGeo, carbonMat);
  rightEndplate.position.set(0.93, 0.36, 0);
  wingGroup.add(rightEndplate);

  rootGroup.add(wingGroup);

  // ==========================================================================
  // 3. 4-WHEEL SUSPENSION & BRAKE ASSEMBLIES
  // ==========================================================================
  const wheelBaseHalf = 1.35;
  const trackWidthHalf = 0.86;
  const rideHeight = 0.34;

  const fl = createWheelAssembly(true, true);
  fl.group.position.set(-trackWidthHalf, rideHeight, wheelBaseHalf);
  rootGroup.add(fl.group);

  const fr = createWheelAssembly(true, false);
  fr.group.position.set(trackWidthHalf, rideHeight, wheelBaseHalf);
  rootGroup.add(fr.group);

  const rl = createWheelAssembly(false, true);
  rl.group.position.set(-trackWidthHalf, rideHeight, -wheelBaseHalf);
  rootGroup.add(rl.group);

  const rr = createWheelAssembly(false, false);
  rr.group.position.set(trackWidthHalf, rideHeight, -wheelBaseHalf);
  rootGroup.add(rr.group);

  const brakeDiscs = [
    fl.brakeDiscMesh,
    fr.brakeDiscMesh,
    rl.brakeDiscMesh,
    rr.brakeDiscMesh,
  ];
  const brakeDiscMaterials = [
    fl.brakeDiscMaterial,
    fr.brakeDiscMaterial,
    rl.brakeDiscMaterial,
    rr.brakeDiscMaterial,
  ];

  // ==========================================================================
  // 4. PLAYABLE 3D COCKPIT INTERIOR & FRAMED GLASS
  // ==========================================================================
  const cockpitInterior = buildCockpitInterior(spec);
  rootGroup.add(cockpitInterior.rootGroup);

  return {
    spec,
    rootGroup,
    bodyworkGroup,
    bodyMesh,
    bodyMaterials: [bodyMaterial],
    wingGroup,
    wingMesh,
    splitterMesh,
    diffuserMesh,
    engineBlockMesh: cockpitInterior.engineBlockGroup?.children[0] as THREE.Mesh | undefined,
    wheels: { fl, fr, rl, rr },
    brakeDiscs,
    brakeDiscMaterials,
    cockpitInterior,
    currentLiveryIndex: liveryIndex,
    currentBrakeTempCelsius: 25.0,
    isDrsActive: false,
    airbrakeAngleRad: 0.18,
    steerAngleRad: 0.0,
    wheelSpinRad: 0.0,
  };
}

/**
 * Applies one of the 12 PBR automotive paint finishes onto the vehicle bodywork.
 */
export function setLivery(
  instance: VehicleModelInstance,
  liveryIndexOrId: number | string
): void {
  const preset = getAutomotivePaintLivery(liveryIndexOrId);
  instance.currentLiveryIndex = preset.index;

  for (const mat of instance.bodyMaterials) {
    if ('uniforms' in mat) {
      const sMat = mat as THREE.ShaderMaterial;
      if (sMat.uniforms.uBaseColor) sMat.uniforms.uBaseColor.value.setHex(preset.baseColor);
      if (sMat.uniforms.uSecondaryColor) sMat.uniforms.uSecondaryColor.value.setHex(preset.secondaryColor);
      if (sMat.uniforms.uFlipColor) sMat.uniforms.uFlipColor.value.setHex(preset.flipColor);
      if (sMat.uniforms.uFlipExponent) sMat.uniforms.uFlipExponent.value = preset.flipExponent;
      if (sMat.uniforms.uMetalness) sMat.uniforms.uMetalness.value = preset.metalness;
      if (sMat.uniforms.uRoughness) sMat.uniforms.uRoughness.value = preset.roughness;
      if (sMat.uniforms.uClearcoat) sMat.uniforms.uClearcoat.value = preset.clearcoat;
      if (sMat.uniforms.uClearcoatRoughness) sMat.uniforms.uClearcoatRoughness.value = preset.clearcoatRoughness;
      if (sMat.uniforms.uFlakeScale) sMat.uniforms.uFlakeScale.value = preset.flakeScale;
      if (sMat.uniforms.uFlakeIntensity) sMat.uniforms.uFlakeIntensity.value = preset.flakeIntensity;
      if (sMat.uniforms.uFlakeColor) sMat.uniforms.uFlakeColor.value.setHex(preset.flakeColor);
      if (sMat.uniforms.uAnisotropy) sMat.uniforms.uAnisotropy.value = preset.anisotropy;
      if (sMat.uniforms.uAnisotropyRotation) sMat.uniforms.uAnisotropyRotation.value = preset.anisotropyRotation;
      if (sMat.uniforms.uCarbonWeaveScale) sMat.uniforms.uCarbonWeaveScale.value = preset.carbonWeaveScale;
      if (sMat.uniforms.uLiveryIndex) sMat.uniforms.uLiveryIndex.value = preset.index;
      sMat.needsUpdate = true;
    } else if ('color' in mat) {
      const stdMat = mat as THREE.MeshStandardMaterial;
      stdMat.color.setHex(preset.baseColor);
      stdMat.metalness = preset.metalness;
      stdMat.roughness = preset.roughness;
      stdMat.needsUpdate = true;
    }
  }
}

/**
 * Updates the carbon-ceramic brake disc temperature and dynamic emissive thermal glow (20C .. 1000C).
 */
export function setBrakeTemperature(
  instance: VehicleModelInstance,
  tempCelsius: number
): void {
  const clampedTemp = Math.max(20, Math.min(1000, tempCelsius));
  instance.currentBrakeTempCelsius = clampedTemp;
  const { color, intensity } = computeBrakeBlackbodyColor(clampedTemp);

  for (const mat of instance.brakeDiscMaterials) {
    if ('emissive' in mat) {
      const stdMat = mat as THREE.MeshStandardMaterial;
      stdMat.emissive.copy(color);
      stdMat.emissiveIntensity = intensity;
    }
    if ('uniforms' in mat) {
      const sMat = mat as THREE.ShaderMaterial;
      if (sMat.uniforms.uBrakeTempCelsius) {
        sMat.uniforms.uBrakeTempCelsius.value = clampedTemp;
      }
    }
  }
}

/**
 * Controls the active DRS / airbrake rear wing angle.
 * - Flat (0.0 rad) in DRS mode for minimal drag.
 * - Tilted (up to 0.785 rad = 45°) under heavy braking.
 */
export function setDrsActive(
  instance: VehicleModelInstance,
  active: boolean
): void {
  instance.isDrsActive = active;
  if (active) {
    instance.wingMesh.rotation.x = 0.0; // Flat DRS position
  } else {
    instance.wingMesh.rotation.x = 0.18; // Standard downforce trim
  }
}

export function setAirbrake(
  instance: VehicleModelInstance,
  brakingFactor: number
): void {
  const norm = Math.max(0, Math.min(1.0, brakingFactor));
  // 0.18 rad (standard downforce) -> 0.785 rad (45 deg vertical airbrake)
  const angle = THREE.MathUtils.lerp(0.18, 0.785, norm);
  instance.airbrakeAngleRad = angle;
  if (!instance.isDrsActive) {
    instance.wingMesh.rotation.x = angle;
  }
}

/**
 * Steers front wheels.
 */
export function steerWheels(
  instance: VehicleModelInstance,
  steerAngleRad: number
): void {
  instance.steerAngleRad = steerAngleRad;
  if (instance.wheels.fl.steerPivot) {
    instance.wheels.fl.steerPivot.rotation.y = steerAngleRad;
  }
  if (instance.wheels.fr.steerPivot) {
    instance.wheels.fr.steerPivot.rotation.y = steerAngleRad;
  }
}

/**
 * Spins wheels according to vehicle forward velocity.
 */
export function spinWheels(
  instance: VehicleModelInstance,
  angularVelocityRadSec: number,
  deltaSec: number
): void {
  instance.wheelSpinRad += angularVelocityRadSec * deltaSec;
  const rotX = instance.wheelSpinRad;

  instance.wheels.fl.rimMesh.rotation.x = rotX;
  instance.wheels.fr.rimMesh.rotation.x = rotX;
  instance.wheels.rl.rimMesh.rotation.x = rotX;
  instance.wheels.rr.rimMesh.rotation.x = rotX;
}

/**
 * High-level tick update for live telemetry:
 * Updates cockpit dashboard screen, shift LEDs, DRS, airbrake, and brake temperature.
 */
export function updateVehicle(
  instance: VehicleModelInstance,
  telemetry: LiveCockpitTelemetry,
  deltaSec: number
): void {
  // 1. Update Cockpit Digital Dashboard & Shift LEDs
  updateCockpitTelemetry(instance.cockpitInterior, telemetry, deltaSec);

  // 2. Active DRS / Airbrake Rear Wing
  if (telemetry.drsActive) {
    setDrsActive(instance, true);
  } else {
    setDrsActive(instance, false);
    // If heavy braking, tilt rear airbrake
    const isBraking = telemetry.brakeTempCelsius > 350;
    const brakeFactor = isBraking ? Math.min(1.0, (telemetry.brakeTempCelsius - 300) / 400) : 0;
    setAirbrake(instance, brakeFactor);
  }

  // 3. Carbon-Ceramic Brake Disc Heat & Thermal Glow
  setBrakeTemperature(instance, telemetry.brakeTempCelsius);

  // 4. Spin wheels based on Speed KPH (convert KPH -> rad/sec: v_ms = kph / 3.6, omega = v_ms / R)
  const wheelRadius = 0.34;
  const vMs = (telemetry.speedKph * 1000) / 3600;
  const omega = vMs / wheelRadius;
  spinWheels(instance, omega, deltaSec);
}

export const HighPolyVehicleBuilder = {
  buildVehicle,
  setLivery,
  setBrakeTemperature,
  setDrsActive,
  setAirbrake,
  steerWheels,
  spinWheels,
  updateVehicle,
  computeBrakeBlackbodyColor,
};
