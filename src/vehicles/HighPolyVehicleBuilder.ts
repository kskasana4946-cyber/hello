// src/vehicles/HighPolyVehicleBuilder.ts
// High-Poly Subdivision Bodywork, Bespoke 30-Vehicle Visual Archetypes, Active Aerodynamics & Glowing Brakes
// Apex Grand Prix: Uncapped Next-Gen Edition
//
// Features:
// 1. Bespoke 3D Visual Archetypes for all 30 Roster Vehicles across 7 Categories:
//    - Hatchback (Mini Cooper JCW, Civic Type-R FL5, Golf R, GR Yaris Rallye)
//    - Convertible (MX-5 Roadster, Porsche 911 Cabriolet, Porsche 911 Targa, Corvette C8 Z06)
//    - MPV (Supercharged Sport MPV, Lexus LM Lounge MPV, Cyber Grand Lounge MPV)
//    - Truck (Ford Ranger Raptor, Global 4x4 Overland, Baja 1000 Trophy Truck)
//    - Sedan (JDM Turbo Sedan, 1969 Charger Hemi, Police Interceptor, Bentley Flying Spur)
//    - SUV (Bronco Wildtrak 4x4, Tactical SWAT SUV, Lamborghini Urus Super SUV)
//    - Supercar (Porsche GT3 RS, Revuelto V12, Senna GTR, Pagani Utopia, Ferrari LaFerrari,
//                 Bugatti Bolide, Terzo EV, Jesko Absolut, Rimac Nevera)
// 2. Bespoke Headlight Assemblies with Projector Lenses + LED DRLs & Rear Taillight Assemblies across all 30 cars.
// 3. Dynamic DRS / Airbrake Rear Wing (tilts up to 45° under braking, flattens to 0° in DRS).
// 4. Carbon-Ceramic Brake Discs with Blackbody Thermal Glow (heating to 1,000°C bright orange).
// 5. 12 PBR Automotive Paint Finishes (AutomotivePaint.glsl).
// 6. Integration with 3D Cockpit & Adaptive Glass Architecture (CockpitInteriorBuilder.ts).

import * as THREE from 'three';
import { LiveCockpitTelemetry, VehicleSpec } from '../core/types';
import {
  AUTOMOTIVE_PAINT_LIVERIES,
  createAutomotivePaintMaterial,
  getAutomotivePaintLivery,
} from '../core/UncappedRenderer';
import {
  CockpitInteriorInstance,
  buildCockpitInterior,
  updateCockpitTelemetry,
} from './CockpitInteriorBuilder';
import { VehicleCategory } from './VehicleRoster';

export type WheelVisualType =
  | 'ALLOY_RACING'
  | 'STEEL_PURSUIT'
  | 'OFFROAD_BEADLOCK'
  | 'COMMERCIAL_DUALLY'
  | 'COMMERCIAL_FRONT'
  | 'KART'
  | 'F1_OPENWHEEL'
  | 'SCOOTER'
  | 'SUPERBIKE'
  | 'HUBLESS_CYBER'
  | 'SOLID_ALLOY_SUPERSONIC'
  | 'GOLD_FORGED_STAR';

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
 * Resolves the 7-category taxonomy for any vehicle specification.
 */
export function getVehicleCategory(spec: VehicleSpec): VehicleCategory {
  if ((spec as any).category) {
    return (spec as any).category as VehicleCategory;
  }
  const id = spec.id.toLowerCase();
  if (['mini_jcw', 'hot_hatch', 'golf_r', 'gr_yaris'].includes(id)) return 'Hatchback';
  if (['roadster', 'porsche_cabrio', 'porsche_targa', 'corvette_c8'].includes(id)) return 'Convertible';
  if (['sport_mpv', 'vip_mpv', 'cyber_mpv'].includes(id)) return 'MPV';
  if (['ranger_truck', 'overland_truck', 'trophy_truck', 'truck', 'mclaren_lt'].includes(id)) return 'Truck';
  if (['jdm_sedan', 'classic_muscle', 'police_sedan', 'bentley_sedan', 'porsche_gt3', 'car', 'jdm_rotary', 'skyline_gtr', 'muscle'].includes(id)) return 'Sedan';
  if (['trail_suv', 'swat_suv', 'urus_suv', 'rimac_nevera', 'dune_buggy', 'swat_armored'].includes(id)) return 'SUV';
  return 'Supercar';
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
 * Builds a high-detail wheel assembly tailored to the vehicle wheel type.
 */
function createWheelAssembly(
  isFront: boolean,
  isLeft: boolean,
  wheelRadius = 0.35,
  wheelWidth = 0.28,
  wheelType: WheelVisualType = 'ALLOY_RACING',
  isDually = false,
  rimColorHex?: number
): VehicleWheelInstance {
  const group = new THREE.Group();
  group.name = `${isFront ? 'Front' : 'Rear'}_${isLeft ? 'Left' : 'Right'}_Wheel`;

  const steerPivot = isFront ? new THREE.Group() : undefined;
  if (steerPivot) {
    steerPivot.name = `${group.name}_SteerPivot`;
    group.add(steerPivot);
  }
  const parentContainer = steerPivot || group;

  // 1. Tire Rubber Mesh
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x161618,
    roughness: wheelType === 'OFFROAD_BEADLOCK' ? 0.95 : 0.82,
    metalness: 0.05,
  });

  const tireGeo = new THREE.CylinderGeometry(
    wheelRadius,
    wheelRadius,
    wheelWidth,
    wheelType === 'OFFROAD_BEADLOCK' ? 32 : 28,
    1,
    false
  );
  tireGeo.rotateZ(Math.PI / 2);
  const tireMesh = new THREE.Mesh(tireGeo, tireMat);
  tireMesh.name = 'Tire';
  tireMesh.castShadow = true;
  parentContainer.add(tireMesh);

  // If Dually: add second outer tire on the same axle
  if (isDually) {
    const duallyTire = new THREE.Mesh(tireGeo.clone(), tireMat);
    duallyTire.position.x = (isLeft ? -1 : 1) * (wheelWidth * 1.15);
    duallyTire.castShadow = true;
    parentContainer.add(duallyTire);
  }

  // 2. Alloy Rim Assembly (rotates on spinWheels)
  const rimMat = new THREE.MeshStandardMaterial({
    color: rimColorHex !== undefined ? rimColorHex : (wheelType === 'STEEL_PURSUIT' ? 0x111111 : 0xd0d5dd),
    roughness: wheelType === 'STEEL_PURSUIT' ? 0.5 : 0.16,
    metalness: 0.9,
  });
  const darkBarrelMat = new THREE.MeshStandardMaterial({
    color: 0x1e2229,
    roughness: 0.25,
    metalness: 0.85,
  });

  const rimRadius = wheelRadius * (wheelType === 'HUBLESS_CYBER' ? 0.86 : 0.71);
  const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, wheelWidth * 0.92, 24);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMesh = new THREE.Mesh(rimGeo, darkBarrelMat);
  rimMesh.name = 'Rim';

  const outerX = (isLeft ? -1 : 1) * (wheelWidth * 0.44);

  if (wheelType === 'HUBLESS_CYBER') {
    // Open hubless hollow center with neon cyan rim glow
    const neonMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00d0ff,
      emissiveIntensity: 3.5,
    });
    const neonRing = new THREE.Mesh(
      new THREE.TorusGeometry(wheelRadius * 0.78, 0.024, 12, 32),
      neonMat
    );
    neonRing.rotateY(Math.PI / 2);
    neonRing.position.x = outerX;
    rimMesh.add(neonRing);

    // Flush aero disc cover
    const discCover = new THREE.Mesh(
      new THREE.CylinderGeometry(rimRadius * 0.92, rimRadius * 0.92, 0.02, 24),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.18, metalness: 0.95 })
    );
    discCover.rotateZ(Math.PI / 2);
    discCover.position.x = outerX * 0.95;
    rimMesh.add(discCover);
  } else if (wheelType === 'STEEL_PURSUIT') {
    // Pursuit steel wheel with chrome center cap
    const chromeCapMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.08,
      metalness: 0.95,
    });
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(wheelRadius * 0.32, wheelRadius * 0.35, 0.04, 16),
      chromeCapMat
    );
    cap.rotateZ(Math.PI / 2);
    cap.position.x = outerX * 1.05;
    rimMesh.add(cap);
  } else if (wheelType === 'OFFROAD_BEADLOCK') {
    // Beadlock ring with accent color
    const beadlockMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.3,
      metalness: 0.8,
    });
    const beadlock = new THREE.Mesh(
      new THREE.TorusGeometry(rimRadius * 0.95, 0.025, 8, 24),
      beadlockMat
    );
    beadlock.rotateY(Math.PI / 2);
    beadlock.position.x = outerX * 1.02;
    rimMesh.add(beadlock);

    // Heavy 6-lug center hub
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(rimRadius * 0.35, rimRadius * 0.35, 0.05, 12),
      rimMat
    );
    hub.rotateZ(Math.PI / 2);
    hub.position.x = outerX * 0.9;
    rimMesh.add(hub);
  } else if (wheelType === 'GOLD_FORGED_STAR') {
    // Ferrari LaFerrari 5-spoke star forged gold wheel
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.22,
      metalness: 0.88,
    });
    const spokeCount = 5;
    const spokeLen = rimRadius * 0.92;
    for (let s = 0; s < spokeCount; s++) {
      const angle = (s / spokeCount) * Math.PI * 2;
      const spokeGeo = new THREE.BoxGeometry(0.035, spokeLen, 0.024);
      const spoke = new THREE.Mesh(spokeGeo, goldMat);
      spoke.position.set(outerX, Math.cos(angle) * (spokeLen * 0.46), Math.sin(angle) * (spokeLen * 0.46));
      spoke.rotation.x = -angle;
      rimMesh.add(spoke);
    }
  } else {
    // Multi-spoke forged racing rim
    const spokeCount = 5;
    const spokeLen = rimRadius * 0.9;
    for (let s = 0; s < spokeCount; s++) {
      const angle = (s / spokeCount) * Math.PI * 2;
      const spokeGeo = new THREE.BoxGeometry(0.028, spokeLen, 0.024);
      const spoke = new THREE.Mesh(spokeGeo, rimMat);
      spoke.position.set(outerX, Math.cos(angle) * (spokeLen * 0.46), Math.sin(angle) * (spokeLen * 0.46));
      spoke.rotation.x = -angle;
      rimMesh.add(spoke);
    }
  }

  parentContainer.add(rimMesh);

  // 3. Carbon-Ceramic Brake Disc with Thermal Glow
  const brakeDiscMat = new THREE.MeshStandardMaterial({
    color: 0x383a40,
    roughness: 0.4,
    metalness: 0.85,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0.0,
  });

  const discRadius = wheelRadius * 0.58;
  const discGeo = new THREE.CylinderGeometry(discRadius, discRadius, 0.04, 24);
  discGeo.rotateZ(Math.PI / 2);
  const brakeDiscMesh = new THREE.Mesh(discGeo, brakeDiscMat);
  brakeDiscMesh.name = 'CarbonCeramicBrakeDisc';
  brakeDiscMesh.position.x = (isLeft ? -1 : 1) * (wheelWidth * 0.28);
  parentContainer.add(brakeDiscMesh);

  // 4. Multi-Piston Racing Brake Caliper
  const caliperMat = new THREE.MeshStandardMaterial({
    color: isFront ? 0xd4001a : 0xf59e0b,
    roughness: 0.22,
    metalness: 0.65,
  });
  const caliperGeo = new THREE.BoxGeometry(0.075, discRadius * 0.68, 0.14);
  const brakeCaliperMesh = new THREE.Mesh(caliperGeo, caliperMat);
  brakeCaliperMesh.name = 'BrakeCaliper';
  brakeCaliperMesh.position.set(
    (isLeft ? -1 : 1) * (wheelWidth * 0.32),
    discRadius * 0.55,
    -discRadius * 0.35
  );
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
 * Constructs a contoured aerodynamic 3D monocoque body mesh tailored to each category and vehicle.
 */
function createAerodynamicBodyGeometry(spec: VehicleSpec): THREE.BufferGeometry {
  const category = getVehicleCategory(spec);

  let length = 4.80;
  let width = 2.05;
  let height = 0.82;

  switch (category) {
    case 'Hatchback':
      length = 4.05;
      width = 1.82;
      height = 0.95;
      break;
    case 'Convertible':
      length = 4.40;
      width = 1.86;
      height = 0.76;
      break;
    case 'MPV':
      length = 5.10;
      width = 1.95;
      height = 1.45;
      break;
    case 'Truck':
      length = 5.45;
      width = 2.18;
      height = 1.35;
      break;
    case 'Sedan':
      length = 5.10;
      width = 1.92;
      height = 0.92;
      break;
    case 'SUV':
      length = 4.98;
      width = 2.06;
      height = 1.25;
      break;
    case 'Supercar':
    default:
      length = 4.75;
      width = 2.12;
      height = 0.72;
      break;
  }

  const geom = new THREE.BoxGeometry(width, height, length, 24, 12, 36);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);

    const xNorm = x / (width * 0.5);
    const yNorm = (y + height * 0.5) / height;
    const zNorm = z / (length * 0.5);

    if (category === 'Hatchback') {
      // 2-box upright hatchback silhouette:
      // Short front hood sloping down (zNorm > 0.4)
      if (zNorm > 0.4) {
        y -= (zNorm - 0.4) * 0.28 * (1.0 - yNorm * 0.35);
        x *= 1.0 - (zNorm - 0.4) * 0.14;
      }
      // Steep near-vertical rear tailgate (zNorm < -0.7)
      if (zNorm < -0.7) {
        x *= 0.92;
      }
      // Compact tumblehome
      if (yNorm > 0.65) {
        x *= 1.0 - (yNorm - 0.65) * 0.22;
      }
      // Mini Cooper JCW clamshell nose roundness & hood scoop dip
      if (spec.id === 'mini_jcw' && zNorm > 0.6) {
        x *= 0.92;
      }
    } else if (category === 'Convertible') {
      // Open sports convertible:
      // Low sloping nose
      if (zNorm > 0.3) {
        y -= (zNorm - 0.3) * 0.24;
        x *= 1.0 - (zNorm - 0.3) * 0.16;
      }
      // Open cockpit dip (where cabin tub is)
      if (zNorm > -0.3 && zNorm < 0.4 && yNorm > 0.45) {
        y -= (yNorm - 0.45) * 0.45;
      }
      // Flared rear fender haunches
      if (zNorm < -0.2 && zNorm > -0.8 && yNorm < 0.7) {
        x *= 1.06;
      }
    } else if (category === 'MPV') {
      // Monospace 1-box aerodynamic van:
      // Continuous sloping windshield from nose to high roof
      if (zNorm > 0.2) {
        y -= (zNorm - 0.2) * 0.55 * (1.0 - yNorm * 0.25);
        x *= 1.0 - (zNorm - 0.2) * 0.15;
      }
      // High straight roofline and flat vertical rear
      if (zNorm < -0.8) {
        x *= 0.95;
      }
    } else if (category === 'Truck') {
      // Crew-cab double-cab pickup:
      // High blunt front grille and hood
      if (zNorm > 0.4) {
        y -= (zNorm - 0.4) * 0.12;
      }
      // Open rear cargo pickup bed: drop top vertices to create cargo tub
      if (zNorm < -0.15 && yNorm > 0.5) {
        y -= (yNorm - 0.5) * 0.62;
      }
    } else if (category === 'Sedan') {
      // Classical 3-box notchback:
      // Long distinct front hood
      if (zNorm > 0.4) {
        y -= (zNorm - 0.4) * 0.26;
        x *= 1.0 - (zNorm - 0.4) * 0.12;
      }
      // Distinct rear trunk deck step down
      if (zNorm < -0.5 && yNorm > 0.55) {
        y -= (yNorm - 0.55) * 0.35;
      }
      // Cabin tumblehome
      if (yNorm > 0.65) {
        x *= 1.0 - (yNorm - 0.65) * 0.26;
      }
      // Bentley Flying Spur majestic front matrix grille brow
      if (spec.id === 'bentley_sedan' && zNorm > 0.8) {
        y += 0.04;
      }
    } else if (category === 'SUV') {
      // Tall 2-box wagon SUV:
      // Bold upright front end
      if (zNorm > 0.45) {
        y -= (zNorm - 0.45) * 0.16;
        x *= 1.0 - (zNorm - 0.45) * 0.12;
      }
      // High horizontal roof and upright tailgate
      if (yNorm > 0.7) {
        x *= 1.0 - (yNorm - 0.7) * 0.18;
      }
    } else {
      // Supercar / Hypercar:
      // Low aerodynamic wedge nose
      if (zNorm > 0.3) {
        y -= (zNorm - 0.3) * 0.32;
        x *= 1.0 - (zNorm - 0.3) * 0.20;
      }
      // Tumblehome on teardrop canopy
      if (yNorm > 0.6) {
        x *= 1.0 - (yNorm - 0.6) * 0.38;
      }
      // Rear diffuser kickup
      if (zNorm < -0.6 && yNorm < 0.3) {
        y += (-zNorm - 0.6) * 0.28;
      }
      // Ferrari LaFerrari F1 pointed arrow nosecone
      if (spec.id === 'ferrari_laferrari' && zNorm > 0.7) {
        x *= 0.75;
      }
      // Bugatti center dorsal crease
      if ((spec.id === 'bugatti_bolide' || spec.id === 'hyper') && Math.abs(xNorm) < 0.08 && yNorm > 0.5) {
        y += 0.038;
      }
      // Pagani Utopia twin fender pontoons
      if (spec.id === 'pagani_utopia' && zNorm > 0.3 && Math.abs(xNorm) > 0.4) {
        y += 0.05;
      }
    }

    pos.setXYZ(i, x, y, z);
  }

  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds bespoke front headlights and rear taillights across all 30 vehicles.
 */
function addLightingAssemblies(
  bodyworkGroup: THREE.Group,
  spec: VehicleSpec,
  category: VehicleCategory,
  frontZ: number,
  rearZ: number,
  halfWidth: number,
  lightY: number
): void {
  // Front Headlight Cluster (Projector Lens + LED DRLs)
  const drlMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xecfeff,
    emissiveIntensity: 3.6,
    roughness: 0.1,
  });

  const headlightGlassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.04,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.08,
    metalness: 0.96,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xff0022,
    emissive: 0xff0022,
    emissiveIntensity: 3.8,
    roughness: 0.1,
  });

  const headLightGroup = new THREE.Group();
  headLightGroup.name = 'FrontHeadlightAssemblies';

  for (const side of [-1, 1]) {
    const lx = side * (halfWidth * 0.78);

    if (spec.id === 'mini_jcw') {
      // Mini Cooper JCW: Iconic Round Halo LED Headlight
      const haloGeo = new THREE.TorusGeometry(0.12, 0.02, 12, 28);
      const halo = new THREE.Mesh(haloGeo, drlMat);
      halo.position.set(lx, lightY, frontZ);
      headLightGroup.add(halo);

      const projector = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 16, 16),
        headlightGlassMat
      );
      projector.position.set(lx, lightY, frontZ + 0.02);
      headLightGroup.add(projector);
    } else if (spec.id === 'bentley_sedan') {
      // Bentley Flying Spur: Quad Round Cut-Crystal Jewel Headlights (inner large, outer smaller)
      const innerLens = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 24), headlightGlassMat);
      innerLens.rotateX(Math.PI / 2);
      innerLens.position.set(side * (halfWidth * 0.58), lightY, frontZ);
      headLightGroup.add(innerLens);

      const outerLens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 20), headlightGlassMat);
      outerLens.rotateX(Math.PI / 2);
      outerLens.position.set(side * (halfWidth * 0.84), lightY + 0.02, frontZ - 0.06);
      headLightGroup.add(outerLens);
    } else if (spec.id === 'ranger_truck') {
      // Ford Ranger Raptor: Signature C-Clamp LED DRL wrapping projector
      const cClamp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.04), drlMat);
      cClamp.position.set(lx, lightY, frontZ);
      headLightGroup.add(cClamp);

      const cTop = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.04), drlMat);
      cTop.position.set(lx - side * 0.06, lightY + 0.13, frontZ);
      headLightGroup.add(cTop);

      const cBot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.04), drlMat);
      cBot.position.set(lx - side * 0.06, lightY - 0.13, frontZ);
      headLightGroup.add(cBot);

      const proj = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 14), headlightGlassMat);
      proj.position.set(lx - side * 0.05, lightY, frontZ + 0.01);
      headLightGroup.add(proj);
    } else if (spec.id === 'ferrari_laferrari') {
      // Ferrari LaFerrari: Swept-back L-shaped LED headlights slicing up fender crown
      const lBlade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.38), drlMat);
      lBlade.rotation.x = -0.35;
      lBlade.rotation.y = side * 0.15;
      lBlade.position.set(lx, lightY + 0.08, frontZ - 0.14);
      headLightGroup.add(lBlade);
    } else if (spec.id === 'pagani_utopia') {
      // Pagani Utopia: Dual stacked circular projector lights on twin fender pontoons
      for (const stackY of [-0.06, 0.06]) {
        const proj = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), drlMat);
        proj.rotateX(Math.PI / 2);
        proj.position.set(lx, lightY + stackY, frontZ);
        headLightGroup.add(proj);
      }
    } else if (spec.id === 'terzo_ev') {
      // Terzo EV: Y-shaped neon cyan LED streaks
      const cyanMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        emissiveIntensity: 3.8,
      });
      const yStreak = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.03), cyanMat);
      yStreak.rotation.z = side * 0.55;
      yStreak.position.set(lx, lightY, frontZ);
      headLightGroup.add(yStreak);
    } else {
      // Universal High-Poly Headlight Assembly (Chrome Reflector + Projector Lens + DRL Strip)
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.10, 0.08), chromeMat);
      housing.position.set(lx, lightY, frontZ);
      headLightGroup.add(housing);

      const proj = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 14), headlightGlassMat);
      proj.position.set(lx + side * 0.04, lightY, frontZ + 0.03);
      headLightGroup.add(proj);

      const drl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.04), drlMat);
      drl.position.set(lx, lightY + 0.045, frontZ + 0.035);
      headLightGroup.add(drl);
    }
  }
  bodyworkGroup.add(headLightGroup);

  // Rear Taillight Assemblies
  const tailLightGroup = new THREE.Group();
  tailLightGroup.name = 'RearTaillightAssemblies';

  if (spec.id === 'bugatti_bolide') {
    // Bugatti Bolide: Dual horizontal full-width neon red LED lightbars
    for (const barY of [-0.05, 0.05]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 1.75, 0.035, 0.04), taillightMat);
      bar.position.set(0, lightY + barY, rearZ);
      tailLightGroup.add(bar);
    }
  } else if (spec.id === 'porsche_cabrio' || spec.id === 'porsche_targa' || spec.id === 'golf_r') {
    // Porsche 911 / Golf R: Full-width continuous slim rear LED lightbar
    const slimBar = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 1.65, 0.035, 0.04), taillightMat);
    slimBar.position.set(0, lightY, rearZ);
    tailLightGroup.add(slimBar);
  } else {
    // Left & Right Tail Clusters
    for (const side of [-1, 1]) {
      const tx = side * (halfWidth * 0.78);
      const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.04), taillightMat);
      tailMesh.position.set(tx, lightY, rearZ);
      tailLightGroup.add(tailMesh);
    }
  }
  bodyworkGroup.add(tailLightGroup);
}

/**
 * Builds the complete High-Poly Three.js vehicle model with bespoke visual architecture.
 */
export function buildVehicle(
  spec: VehicleSpec,
  liveryIndex = 0
): VehicleModelInstance {
  const rootGroup = new THREE.Group();
  rootGroup.name = `Vehicle_${spec.id}_${spec.pakDir}`;

  const category = getVehicleCategory(spec);
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

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.08,
    metalness: 0.96,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x8a929e,
    roughness: 0.2,
    metalness: 0.92,
  });

  const blackMeshMat = new THREE.MeshStandardMaterial({
    color: 0x0a0c10,
    roughness: 0.5,
    metalness: 0.6,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.2,
    metalness: 0.88,
  });

  // ==========================================================================
  // 1. HIGH-POLY SUBDIVISION BODYWORK
  // ==========================================================================
  const bodyworkGroup = new THREE.Group();
  bodyworkGroup.name = 'BodyworkGroup';

  const bodyGeo = createAerodynamicBodyGeometry(spec);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMaterial);
  bodyMesh.name = 'HighPolySubdivisionBody';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyworkGroup.add(bodyMesh);

  // Roof Canopy (for enclosed cars)
  const isConvertible = category === 'Convertible';
  if (!isConvertible) {
    const isTruck = category === 'Truck';
    const isMPV = category === 'MPV';
    const isSUV = category === 'SUV';
    const roofLen = isTruck ? 1.95 : (isMPV ? 3.1 : 1.45);
    const roofWidth = isTruck ? 1.85 : 1.28;
    const roofY = isTruck ? 1.55 : (isMPV ? 1.62 : (isSUV ? 1.48 : 1.15));
    const roofZ = isTruck ? 0.45 : (isMPV ? -0.2 : -0.15);

    const roofGeo = new THREE.BoxGeometry(roofWidth, 0.06, roofLen, 8, 2, 12);
    const rPos = roofGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const rx = rPos.getX(i) / (roofWidth * 0.5);
      const rz = rPos.getZ(i) / (roofLen * 0.5);
      const dome = (1.0 - rx * rx * 0.35) * (1.0 - rz * rz * 0.45) * 0.07;
      rPos.setY(i, rPos.getY(i) + dome - rz * 0.03);
    }
    roofGeo.computeVertexNormals();

    // Two-tone roof: Ferrari LaFerrari has gloss black canopy, Mini JCW has Chili Red roof
    let canopyMat: THREE.Material = bodyMaterial;
    if (spec.id === 'ferrari_laferrari') {
      canopyMat = carbonMat;
    } else if (spec.id === 'mini_jcw') {
      canopyMat = new THREE.MeshStandardMaterial({ color: 0xd4001a, roughness: 0.18, metalness: 0.3 });
    }

    const roofMesh = new THREE.Mesh(roofGeo, canopyMat);
    roofMesh.name = 'PaintedRoofCanopy';
    roofMesh.position.set(0, roofY, roofZ);
    roofMesh.castShadow = true;
    bodyworkGroup.add(roofMesh);
  }

  // ==========================================================================
  // 2. BESPOKE SIGNATURE ARCHETYPE ACCESSORIES & USER REFERENCE FEATURES
  // ==========================================================================
  let splitterMesh: THREE.Mesh;
  let diffuserMesh: THREE.Mesh;
  let wingMesh: THREE.Mesh;

  const wingGroup = new THREE.Group();
  wingGroup.name = 'DynamicRearWingAssembly';

  // Headlight and Taillight Assemblies across all 30 cars
  const halfW = category === 'Truck' ? 1.05 : (category === 'Supercar' ? 1.02 : 0.90);
  const frontZ = category === 'Truck' ? 2.65 : 2.25;
  const rearZ = category === 'Truck' ? -2.65 : -2.25;
  const lightY = category === 'Truck' ? 0.92 : (category === 'SUV' ? 0.85 : 0.48);
  addLightingAssemblies(bodyworkGroup, spec, category, frontZ, rearZ, halfW, lightY);

  // --------------------------------------------------------------------------
  // Bespoke Details for Reference Cars
  // --------------------------------------------------------------------------
  if (spec.id === 'mini_jcw') {
    // 1. Mini Cooper JCW: Hexagonal Grille with Red Center Bar
    const hexGrille = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.32, 0.05), blackMeshMat);
    hexGrille.position.set(0, 0.42, 2.05);
    const redAccentBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.035, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xd4001a, roughness: 0.2 })
    );
    hexGrille.add(redAccentBar);
    bodyworkGroup.add(hexGrille);

    // Clamshell Hood Intake Scoop
    const hoodScoop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.22), blackMeshMat);
    hoodScoop.position.set(0, 0.98, 0.92);
    bodyworkGroup.add(hoodScoop);

    // Black Wheel Arch Flares
    for (const flareZ of [1.22, -1.22]) {
      for (const side of [-1, 1]) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.035, 8, 16, Math.PI), carbonMat);
        arch.position.set(side * 0.92, 0.32, flareZ);
        bodyworkGroup.add(arch);
      }
    }

    // Sporty Roof Spoiler
    const roofSpoiler = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.06, 0.34), carbonMat);
    roofSpoiler.position.set(0, 1.44, -1.65);
    bodyworkGroup.add(roofSpoiler);

    // Central Twin Chrome Exhaust
    const dualExhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.18, 16), chromeMat);
    dualExhaust.rotateX(Math.PI / 2);
    dualExhaust.position.set(0, 0.22, -2.05);
    bodyworkGroup.add(dualExhaust);
  } else if (spec.id === 'bentley_sedan') {
    // 2. Bentley Flying Spur: Grand Upright Chrome Matrix Grille & Flying B
    const matrixGrille = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.58, 0.08), chromeMat);
    matrixGrille.position.set(0, 0.62, 2.52);
    bodyworkGroup.add(matrixGrille);

    const flyingB = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.09, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xecfeff, emissiveIntensity: 1.5, metalness: 0.95 })
    );
    flyingB.rotateX(Math.PI / 4);
    flyingB.position.set(0, 1.05, 2.48);
    bodyworkGroup.add(flyingB);

    // Chrome Flank Beltline Trim Strips
    for (const side of [-1, 1]) {
      const beltline = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 4.6), chromeMat);
      beltline.position.set(side * 0.98, 0.72, 0);
      bodyworkGroup.add(beltline);
    }
  } else if (spec.id === 'ferrari_laferrari') {
    // 3. Ferrari LaFerrari: Pointed F1 Nosecone with Keel & Dual Nostrils
    const f1Keel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.65), carbonMat);
    f1Keel.position.set(0, 0.24, 2.15);
    bodyworkGroup.add(f1Keel);

    // Dual Hood Extraction Nostrils
    for (const side of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.32), blackMeshMat);
      nostril.position.set(side * 0.35, 0.74, 1.25);
      bodyworkGroup.add(nostril);

      // Deep side radiator intake scallops
      const scallop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.85), carbonMat);
      scallop.position.set(side * 0.98, 0.45, -0.45);
      bodyworkGroup.add(scallop);
    }
  } else if (spec.id === 'bugatti_bolide' || spec.id === 'hyper') {
    // 4. Bugatti Bolide: Horseshoe Grille, Sweeping C-Line, Center Spine
    const horseshoe = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 12, 24, Math.PI), chromeMat);
    horseshoe.position.set(0, 0.32, 2.35);
    bodyworkGroup.add(horseshoe);

    const bugattiEmblem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.015, 16),
      new THREE.MeshStandardMaterial({ color: 0xd4001a, roughness: 0.2 })
    );
    bugattiEmblem.rotateX(Math.PI / 2);
    bugattiEmblem.position.set(0, 0.32, 2.37);
    bodyworkGroup.add(bugattiEmblem);

    // C-Line along flanks
    for (const side of [-1, 1]) {
      const cLineGroup = new THREE.Group();
      cLineGroup.position.set(side * 1.05, 0.68, -0.15);
      const cCurve = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.03, 12, 24, Math.PI * 1.2), chromeMat);
      cCurve.rotateY(side * Math.PI / 2);
      cLineGroup.add(cCurve);
      bodyworkGroup.add(cLineGroup);
    }

    // Center Dorsal Spine Crease
    const dorsalSpine = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.08, 3.4), carbonMat);
    dorsalSpine.position.set(0, 1.02, 0.2);
    bodyworkGroup.add(dorsalSpine);

    // 4-Fin Race Diffuser
    for (const finX of [-0.45, -0.15, 0.15, 0.45]) {
      const strake = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.18, 0.65), carbonMat);
      strake.position.set(finX, 0.14, -2.15);
      bodyworkGroup.add(strake);
    }
  } else if (spec.id === 'ranger_truck') {
    // 5. Ford Ranger Raptor: Twin-Bar Grille, Skid Plate, Open Bed with Sailplane
    const twinBarGrille = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.38, 0.06), blackMeshMat);
    twinBarGrille.position.set(0, 0.85, 2.65);
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.04, 0.07), carbonMat);
    bar1.position.set(0, 0.06, 0.02);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.04, 0.07), carbonMat);
    bar2.position.set(0, -0.06, 0.02);
    twinBarGrille.add(bar1);
    twinBarGrille.add(bar2);
    bodyworkGroup.add(twinBarGrille);

    // Stamped Silver Front Skid Plate
    const skidPlate = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.22, 0.14), titaniumMat);
    skidPlate.rotation.x = 0.4;
    skidPlate.position.set(0, 0.35, 2.62);
    bodyworkGroup.add(skidPlate);

    // Aerodynamic Bed Sailplane Bar
    const sailplane = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.52, 0.24), carbonMat);
    sailplane.position.set(0, 1.45, -0.42);
    bodyworkGroup.add(sailplane);
  } else if (spec.id === 'overland_truck') {
    // 6. Global 4x4 Overland: Heavy Winch Bumper, Snorkel, Roof Rack with Gear
    const winchBumper = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.38, 0.35), carbonMat);
    winchBumper.position.set(0, 0.55, 2.70);
    const winchDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.32, 16), titaniumMat);
    winchDrum.rotateZ(Math.PI / 2);
    winchDrum.position.set(0, 0.02, 0.18);
    winchBumper.add(winchDrum);
    bodyworkGroup.add(winchBumper);

    // Passenger A-Pillar Engine Snorkel Tube
    const snorkelTube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.35, 12), carbonMat);
    snorkelTube.rotation.z = -0.15;
    snorkelTube.position.set(0.96, 1.35, 1.15);
    bodyworkGroup.add(snorkelTube);

    // Overland Roof Rack with Gear
    const roofRack = new THREE.Group();
    roofRack.position.set(0, 1.82, 0.45);
    const rackFrame = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.12, 1.85), carbonMat);
    roofRack.add(rackFrame);
    // Red Traction Boards
    const tractionBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.05, 1.1),
      new THREE.MeshStandardMaterial({ color: 0xd4001a, roughness: 0.6 })
    );
    tractionBoard.position.set(-0.45, 0.1, 0);
    roofRack.add(tractionBoard);
    // Jerry Cans
    const jerryCan = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.32, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 })
    );
    jerryCan.position.set(0.45, 0.22, 0);
    roofRack.add(jerryCan);
    bodyworkGroup.add(roofRack);
  } else if (spec.id === 'porsche_cabrio') {
    // 7. Porsche 911 Cabriolet: Exposed Sports Seats, Chrome Roll Hoops
    const seatGeo = new THREE.BoxGeometry(0.42, 0.52, 0.42);
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x1e2229, roughness: 0.35 });
    for (const side of [-1, 1]) {
      const seat = new THREE.Mesh(seatGeo, leatherMat);
      seat.position.set(side * 0.38, 0.68, -0.05);
      bodyworkGroup.add(seat);
    }
  } else if (spec.id === 'porsche_targa') {
    // 8. Porsche 911 Targa: Brushed Silver Targa B-Pillar Roll Hoop & Glass Canopy
    const targaHoop = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.55, 0.18), chromeMat);
    targaHoop.position.set(0, 1.12, -0.22);
    bodyworkGroup.add(targaHoop);

    // Curved Rear Wraparound Glass Clamshell Dome
    const glassDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 16, 16, 0, Math.PI, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.45,
        roughness: 0.05,
        metalness: 0.2,
      })
    );
    glassDome.position.set(0, 0.88, -0.75);
    bodyworkGroup.add(glassDome);
  } else if (spec.id === 'pagani_utopia' || spec.id === 'pagani_v12') {
    // 9. Pagani Utopia: Central Quad Exhaust Cluster & Single Articulated Wiper
    const quadExhaust = new THREE.Group();
    quadExhaust.position.set(0, 0.55, -2.32);
    for (let eIdx = 0; eIdx < 4; eIdx++) {
      const eAngle = (eIdx / 4) * Math.PI * 2;
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 16), titaniumMat);
      tip.rotateX(Math.PI / 2);
      tip.position.set(Math.cos(eAngle) * 0.09, Math.sin(eAngle) * 0.09, 0);
      quadExhaust.add(tip);
    }
    bodyworkGroup.add(quadExhaust);

    // Single Central Wiper
    const centralWiper = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.58, 0.02), carbonMat);
    centralWiper.position.set(0, 0.95, 0.72);
    centralWiper.rotation.z = 0.05;
    bodyworkGroup.add(centralWiper);
  } else if (spec.id === 'terzo_ev') {
    // 10. Terzo EV: Low Geometric Wedge & Glowing Rocker Streaks
    const cyanNeonMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 3.5,
    });
    for (const side of [-1, 1]) {
      const rockerStreak = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 2.2), cyanNeonMat);
      rockerStreak.position.set(side * 1.05, 0.22, 0);
      bodyworkGroup.add(rockerStreak);
    }
  }

  // --------------------------------------------------------------------------
  // Standard Splitter, Diffuser & Active Wing Assemblies
  // --------------------------------------------------------------------------
  splitterMesh = new THREE.Mesh(
    new THREE.BoxGeometry(category === 'Truck' ? 2.15 : 1.95, 0.06, 0.55),
    carbonMat
  );
  splitterMesh.name = 'FrontSplitter';
  splitterMesh.position.set(0, category === 'Truck' ? 0.35 : 0.16, frontZ * 0.95);
  bodyworkGroup.add(splitterMesh);

  diffuserMesh = new THREE.Mesh(
    new THREE.BoxGeometry(category === 'Truck' ? 2.10 : 1.90, 0.14, 0.75),
    carbonMat
  );
  diffuserMesh.name = 'VenturiDiffuser';
  diffuserMesh.position.set(0, category === 'Truck' ? 0.40 : 0.20, rearZ * 0.95);
  bodyworkGroup.add(diffuserMesh);

  // Active Rear Wing Assembly
  const wingY = category === 'Supercar' ? 0.98 : (category === 'Truck' ? 1.55 : 1.15);
  const wingZ = category === 'Truck' ? -2.45 : -2.15;
  wingGroup.position.set(0, wingY, wingZ);

  wingMesh = new THREE.Mesh(
    new THREE.BoxGeometry(category === 'Truck' ? 1.85 : 1.75, 0.045, 0.36),
    carbonMat
  );
  wingMesh.name = 'ActiveAirfoilBlade';
  wingMesh.rotation.x = 0.18; // Default cruise downforce trim
  wingGroup.add(wingMesh);

  // Twin Wing Stanchions / Pedestals
  for (const side of [-1, 1]) {
    const stanchion = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.15), carbonMat);
    stanchion.position.set(side * 0.45, -0.16, 0);
    wingGroup.add(stanchion);
  }
  bodyworkGroup.add(wingGroup);

  rootGroup.add(bodyworkGroup);

  // ==========================================================================
  // 3. WHEELS & BRAKE ASSEMBLIES (4 Corners)
  // ==========================================================================
  let wheelbase = 2.70;
  let trackWidth = 1.62;
  let rideHeight = 0.32;
  let tireRadius = 0.34;
  let tireWidth = 0.28;
  let wheelVisual: WheelVisualType = 'ALLOY_RACING';
  let rimColor: number | undefined;

  switch (category) {
    case 'Hatchback':
      wheelbase = 2.45;
      trackWidth = 1.54;
      rideHeight = 0.30;
      tireRadius = 0.32;
      tireWidth = 0.24;
      wheelVisual = 'ALLOY_RACING';
      break;
    case 'Convertible':
      wheelbase = 2.50;
      trackWidth = 1.58;
      rideHeight = 0.28;
      tireRadius = 0.33;
      tireWidth = 0.26;
      wheelVisual = 'ALLOY_RACING';
      break;
    case 'MPV':
      wheelbase = 3.10;
      trackWidth = 1.72;
      rideHeight = 0.34;
      tireRadius = 0.35;
      tireWidth = 0.26;
      wheelVisual = spec.id === 'cyber_mpv' ? 'HUBLESS_CYBER' : 'ALLOY_RACING';
      break;
    case 'Truck':
      wheelbase = 3.25;
      trackWidth = 1.85;
      rideHeight = spec.id === 'overland_truck' ? 0.56 : 0.46;
      tireRadius = spec.id === 'overland_truck' ? 0.48 : 0.42;
      tireWidth = 0.36;
      wheelVisual = 'OFFROAD_BEADLOCK';
      break;
    case 'Sedan':
      wheelbase = 2.95;
      trackWidth = 1.66;
      rideHeight = 0.32;
      tireRadius = 0.35;
      tireWidth = 0.26;
      wheelVisual = spec.id === 'police_sedan' ? 'STEEL_PURSUIT' : 'ALLOY_RACING';
      break;
    case 'SUV':
      wheelbase = 2.95;
      trackWidth = 1.78;
      rideHeight = 0.42;
      tireRadius = 0.40;
      tireWidth = 0.32;
      wheelVisual = spec.id === 'trail_suv' ? 'OFFROAD_BEADLOCK' : (spec.id === 'swat_suv' ? 'STEEL_PURSUIT' : 'ALLOY_RACING');
      break;
    case 'Supercar':
    default:
      wheelbase = 2.70;
      trackWidth = 1.74;
      rideHeight = 0.25;
      tireRadius = 0.34;
      tireWidth = 0.32;
      if (spec.id === 'ferrari_laferrari') {
        wheelVisual = 'GOLD_FORGED_STAR';
      } else if (spec.id === 'terzo_ev') {
        wheelVisual = 'HUBLESS_CYBER';
      } else {
        wheelVisual = 'ALLOY_RACING';
      }
      break;
  }

  const wheels = {
    fl: createWheelAssembly(true, true, tireRadius, tireWidth, wheelVisual, false, rimColor),
    fr: createWheelAssembly(true, false, tireRadius, tireWidth, wheelVisual, false, rimColor),
    rl: createWheelAssembly(false, true, tireRadius, tireWidth, wheelVisual, false, rimColor),
    rr: createWheelAssembly(false, false, tireRadius, tireWidth, wheelVisual, false, rimColor),
  };

  wheels.fl.group.position.set(-trackWidth * 0.5, rideHeight, wheelbase * 0.5);
  wheels.fr.group.position.set(trackWidth * 0.5, rideHeight, wheelbase * 0.5);
  wheels.rl.group.position.set(-trackWidth * 0.5, rideHeight, -wheelbase * 0.5);
  wheels.rr.group.position.set(trackWidth * 0.5, rideHeight, -wheelbase * 0.5);

  rootGroup.add(wheels.fl.group);
  rootGroup.add(wheels.fr.group);
  rootGroup.add(wheels.rl.group);
  rootGroup.add(wheels.rr.group);

  const brakeDiscs: THREE.Mesh[] = [
    wheels.fl.brakeDiscMesh,
    wheels.fr.brakeDiscMesh,
    wheels.rl.brakeDiscMesh,
    wheels.rr.brakeDiscMesh,
  ];
  const brakeDiscMaterials: THREE.Material[] = [
    wheels.fl.brakeDiscMaterial,
    wheels.fr.brakeDiscMaterial,
    wheels.rl.brakeDiscMaterial,
    wheels.rr.brakeDiscMaterial,
  ];

  // ==========================================================================
  // 4. FIRST-PERSON 3D COCKPIT INTERIOR & FRAMED GLASS
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
    wheels,
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
 * Updates vehicle paint livery from the 12 PBR finishes.
 */
export function setLivery(
  instance: VehicleModelInstance,
  liveryIndex: number
): void {
  const safeIdx = Math.max(0, Math.min(11, Math.floor(liveryIndex)));
  instance.currentLiveryIndex = safeIdx;
  const preset = AUTOMOTIVE_PAINT_LIVERIES[safeIdx];

  for (const mat of instance.bodyMaterials) {
    const sMat = mat as THREE.ShaderMaterial;
    if (sMat.uniforms) {
      if (sMat.uniforms.uLiveryIndex) sMat.uniforms.uLiveryIndex.value = safeIdx;
      if (sMat.uniforms.uClearcoat) sMat.uniforms.uClearcoat.value = preset.clearcoat;
      if (sMat.uniforms.uClearcoatRoughness) sMat.uniforms.uClearcoatRoughness.value = preset.clearcoatRoughness;
      if (sMat.uniforms.uMetalness) sMat.uniforms.uMetalness.value = preset.metalness;
      if (sMat.uniforms.uRoughness) sMat.uniforms.uRoughness.value = preset.roughness;
      if (sMat.uniforms.uFlakeIntensity) sMat.uniforms.uFlakeIntensity.value = preset.flakeIntensity;
      if (sMat.uniforms.uFlakeScale) sMat.uniforms.uFlakeScale.value = preset.flakeScale;
    }
  }
}

/**
 * Controls active DRS flap tilt (flattens to 0 rad for top speed).
 */
export function setDrsActive(
  instance: VehicleModelInstance,
  active: boolean
): void {
  instance.isDrsActive = active;
  if (active) {
    instance.wingMesh.rotation.x = 0.0;
  } else {
    instance.wingMesh.rotation.x = 0.18; // Default cruise downforce angle
  }
}

/**
 * Tilts rear wing dynamically into high-downforce / airbrake position under heavy braking.
 */
export function setAirbrake(
  instance: VehicleModelInstance,
  brakeFactor: number // 0.0 .. 1.0
): void {
  const clamped = Math.max(0, Math.min(1.0, brakeFactor));
  const baseAngle = 0.18;
  const maxAirbrakeAngle = 0.785; // 45 deg
  const targetAngle = baseAngle + (maxAirbrakeAngle - baseAngle) * clamped;
  instance.airbrakeAngleRad = targetAngle;

  if (!instance.isDrsActive) {
    instance.wingMesh.rotation.x = targetAngle;
  }
}

/**
 * Updates dynamic thermal emission on carbon-ceramic brake discs.
 */
export function setBrakeTemperature(
  instance: VehicleModelInstance,
  tempCelsius: number
): void {
  const clamped = Math.max(20.0, Math.min(1000.0, Number(tempCelsius) || 20.0));
  instance.currentBrakeTempCelsius = clamped;
  const thermal = computeBrakeBlackbodyColor(clamped);

  for (const mat of instance.brakeDiscMaterials) {
    const stdMat = mat as THREE.MeshStandardMaterial;
    if (stdMat.emissive) {
      stdMat.emissive.copy(thermal.color);
      stdMat.emissiveIntensity = thermal.intensity;
    }
  }
}

/**
 * Steers front wheels according to player steering angle in radians.
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
 * Updates cockpit digital dashboard screen, shift LEDs, DRS, airbrake, and brake temperature.
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
    const isBraking = telemetry.brakeTempCelsius > 350;
    const brakeFactor = isBraking ? Math.min(1.0, (telemetry.brakeTempCelsius - 300) / 400) : 0;
    setAirbrake(instance, brakeFactor);
  }

  // 3. Carbon-Ceramic Brake Disc Heat & Thermal Glow
  setBrakeTemperature(instance, telemetry.brakeTempCelsius);

  // 4. Spin wheels based on Speed KPH
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
  getVehicleCategory,
};
