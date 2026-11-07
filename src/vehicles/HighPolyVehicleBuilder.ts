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
 * Constructs a contoured aerodynamic high-poly 3D closed-hull subdivision body mesh
 * tailored to each vehicle archetype (Supercar, GT3, Muscle, Open-Wheel F1, Truck, Bike).
 */
function createAerodynamicBodyGeometry(spec: VehicleSpec): THREE.BufferGeometry {
  const isBike = spec.archetype === 'SCOOTER_BIKE';
  const isCommercial = spec.archetype === 'HEAVY_COMMERCIAL';
  const isOpenWheel = spec.archetype === 'OPEN_WHEEL_KART';
  const isSupersonic = spec.archetype === 'SUPERSONIC_CONCEPT';
  const isHyper = spec.archetype === 'HYPERCAR_PROTOTYPE';
  const isMuscle = spec.id.includes('muscle') || spec.id === 'police' || spec.id === 'stock_nascar';

  let length = 4.65;
  let width = 1.98;
  let height = 0.82;

  if (isBike) {
    length = 2.15;
    width = 0.56;
    height = 0.78;
  } else if (isCommercial) {
    length = spec.id === 'bus' ? 6.8 : 5.4;
    width = 2.35;
    height = spec.id === 'swat_armored' ? 1.55 : 2.1;
  } else if (isOpenWheel) {
    length = 4.95;
    width = 1.45;
    height = 0.58;
  } else if (isSupersonic) {
    length = 6.2;
    width = 1.85;
    height = 0.68;
  } else if (isHyper) {
    length = 4.78;
    width = 2.06;
    height = 0.74;
  }

  // Full 3D closed-hull subdivided box deformed into an automotive monocoque & fender shell
  const geom = new THREE.BoxGeometry(width, height, length, 24, 12, 36);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i); // -height/2 .. +height/2
    const z = pos.getZ(i); // -length/2 (rear) .. +length/2 (front)

    const xNorm = x / (width * 0.5); // -1 .. +1
    const yNorm = (y + height * 0.5) / height; // 0 (bottom) .. 1 (top)
    const zNorm = z / (length * 0.5); // -1 (rear) .. +1 (front)

    // 1. Longitudinal plan-view tapering (sleek nosecone & boat-tail diffuser)
    if (isOpenWheel) {
      // Formula 1 / Indy needle nosecone + wide sidepods in middle + coke-bottle rear
      if (zNorm > 0.15) {
        const noseFactor = Math.max(0.18, 1.0 - (zNorm - 0.15) * 0.95);
        x *= noseFactor;
      } else if (zNorm < -0.25) {
        // Coke-bottle rear taper
        x *= Math.max(0.42, 1.0 - (Math.abs(zNorm) - 0.25) * 0.65);
      }
    } else if (isSupersonic) {
      // Needle jet nosecone + delta rear stabilizer
      if (zNorm > 0.0) {
        x *= Math.max(0.15, 1.0 - zNorm * 0.82);
      }
    } else if (!isCommercial) {
      // Front bumper corner rounding & aerodynamic nose taper
      if (zNorm > 0.55) {
        const frontCurve = (zNorm - 0.55) / 0.45;
        x *= 1.0 - frontCurve * frontCurve * 0.22;
      }
      // Rear bumper taper
      if (zNorm < -0.65) {
        const rearCurve = (Math.abs(zNorm) - 0.65) / 0.35;
        x *= 1.0 - rearCurve * rearCurve * 0.14;
      }
      // Sculpted mid-body waist pinch (door intake cove between front & rear fenders)
      if (Math.abs(zNorm) < 0.32 && yNorm < 0.75) {
        const waistPinch = Math.cos((zNorm / 0.32) * (Math.PI * 0.5));
        x *= 1.0 - waistPinch * (isHyper ? 0.14 : 0.08);
      }
    }

    // 2. Vertical cross-section tumblehome (upper body narrows toward roofline)
    if (yNorm > 0.45 && !isCommercial) {
      const upperTaper = (yNorm - 0.45) / 0.55;
      x *= 1.0 - upperTaper * (isHyper ? 0.26 : 0.18);
    }

    // 3. Top deck profile (sleek hood slope, cabin beltline, muscular fenders)
    let topHeight = height;
    if (isCommercial) {
      if (spec.id !== 'bus' && zNorm > 0.35) {
        // Truck hood step-down
        topHeight = height * 0.58;
      }
    } else if (isOpenWheel) {
      // Low nosecone, raised cockpit cowling & airbox scoop behind driver
      if (zNorm > 0.2) {
        topHeight = height * (0.62 - (zNorm - 0.2) * 0.42);
      } else if (zNorm < -0.05 && Math.abs(xNorm) < 0.32) {
        // Central engine airbox fin
        topHeight = height * 1.28;
      } else {
        topHeight = height * 0.76;
      }
    } else {
      // Sports / Supercar / GT / Muscle aerodynamic profile
      if (zNorm > 0.22) {
        // Sloping front hood & wedge nose
        const hoodProg = (zNorm - 0.22) / 0.78;
        const noseDrop = isMuscle ? 0.28 : 0.52;
        topHeight = height * (0.78 - Math.pow(hoodProg, 1.35) * noseDrop);
      } else if (zNorm < -0.28) {
        // Fastback rear deck slope
        const rearProg = (Math.abs(zNorm) - 0.28) / 0.72;
        topHeight = height * (0.84 - Math.pow(rearProg, 1.2) * 0.24);
      } else {
        // Central beltline deck (cockpit greenhouse sits on top of this)
        topHeight = height * 0.82;
      }

      // Muscular sculpted wheel-arch fenders bulging upward over front & rear axles
      const frontAxleDist = Math.abs(z - 1.35);
      const rearAxleDist = Math.abs(z + 1.35);
      if ((frontAxleDist < 0.68 || rearAxleDist < 0.72) && Math.abs(xNorm) > 0.62) {
        const archFactor = frontAxleDist < 0.68
          ? Math.cos((frontAxleDist / 0.68) * Math.PI * 0.5)
          : Math.cos((rearAxleDist / 0.72) * Math.PI * 0.5);
        topHeight += archFactor * (isHyper ? 0.16 : 0.11);
        // Flare fenders slightly outward
        x *= 1.0 + archFactor * 0.06;
      }
    }

    // 4. Underbody ground clearance + wheel arch cutouts + rear diffuser kick-up
    let bottomY = 0.14;
    if (zNorm < -0.6) {
      bottomY += ((Math.abs(zNorm) - 0.6) / 0.4) * 0.12;
    } else if (zNorm > 0.7) {
      bottomY += ((zNorm - 0.7) / 0.3) * 0.05;
    }

    // Map y from [0..1] into [bottomY .. bottomY + topHeight]
    y = bottomY + yNorm * Math.max(0.18, topHeight - bottomY * 0.5);

    // Smooth chamfer along top outer edges
    if (yNorm > 0.85 && Math.abs(xNorm) > 0.75) {
      y -= (yNorm - 0.85) * (Math.abs(xNorm) - 0.75) * 0.35;
    }

    pos.setXYZ(i, x, y, z);
  }

  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds a high-detail wheel assembly with treaded tire, 5-spoke 3D alloy rim,
 * cross-drilled carbon-ceramic brake disc, and Brembo racing caliper.
 */
function createWheelAssembly(
  isFront: boolean,
  isLeft: boolean,
  wheelRadius = 0.35,
  wheelWidth = 0.28
): VehicleWheelInstance {
  const group = new THREE.Group();
  group.name = `${isFront ? 'Front' : 'Rear'}_${isLeft ? 'Left' : 'Right'}_Wheel`;

  const steerPivot = isFront ? new THREE.Group() : undefined;
  if (steerPivot) {
    steerPivot.name = `${group.name}_SteerPivot`;
    group.add(steerPivot);
  }
  const parentContainer = steerPivot || group;

  // 1. Tire Mesh (Slick Racing Rubber with shoulder profile)
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x121316,
    roughness: 0.78,
    metalness: 0.08,
  });
  const tireGeo = new THREE.CylinderGeometry(
    wheelRadius,
    wheelRadius,
    wheelWidth,
    32,
    1,
    false
  );
  tireGeo.rotateZ(Math.PI / 2);
  const tireMesh = new THREE.Mesh(tireGeo, tireMat);
  tireMesh.name = 'Tire';
  tireMesh.castShadow = true;
  parentContainer.add(tireMesh);

  // Tire sidewall ring accent (Michelin Pilot Sport style subtle sidewall ring)
  const sidewallMat = new THREE.MeshStandardMaterial({
    color: 0x262930,
    roughness: 0.5,
    metalness: 0.2,
  });
  const sidewallGeo = new THREE.TorusGeometry(wheelRadius * 0.84, 0.018, 12, 32);
  sidewallGeo.rotateY(Math.PI / 2);
  const outerSidewall = new THREE.Mesh(sidewallGeo, sidewallMat);
  outerSidewall.position.x = (isLeft ? -1 : 1) * (wheelWidth * 0.49);
  parentContainer.add(outerSidewall);

  // 2. Multi-Spoke Forged Alloy Rim Assembly (rotates on spinWheels)
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd0d5dd,
    roughness: 0.16,
    metalness: 0.92,
  });
  const darkBarrelMat = new THREE.MeshStandardMaterial({
    color: 0x1e2229,
    roughness: 0.25,
    metalness: 0.85,
  });
  const rimGeo = new THREE.CylinderGeometry(
    wheelRadius * 0.71,
    wheelRadius * 0.71,
    wheelWidth * 0.92,
    24
  );
  rimGeo.rotateZ(Math.PI / 2);
  const rimMesh = new THREE.Mesh(rimGeo, darkBarrelMat);
  rimMesh.name = 'Rim';

  // Outer machined alloy lip + 5 twin-spokes + center-lock nut attached to rimMesh so they spin visibly!
  const outerX = (isLeft ? -1 : 1) * (wheelWidth * 0.44);
  const lipGeo = new THREE.TorusGeometry(wheelRadius * 0.70, 0.022, 12, 28);
  lipGeo.rotateY(Math.PI / 2);
  const lipMesh = new THREE.Mesh(lipGeo, rimMat);
  lipMesh.position.x = outerX;
  rimMesh.add(lipMesh);

  const spokeCount = 5;
  const spokeLen = wheelRadius * 0.66;
  for (let s = 0; s < spokeCount; s++) {
    const angle = (s / spokeCount) * Math.PI * 2;
    // Twin V-spoke pair per spoke index
    for (const offsetAngle of [-0.09, 0.09]) {
      const a = angle + offsetAngle;
      const spokeGeo = new THREE.BoxGeometry(0.028, spokeLen, 0.026);
      const spoke = new THREE.Mesh(spokeGeo, rimMat);
      spoke.position.set(
        outerX,
        Math.cos(a) * (spokeLen * 0.46),
        Math.sin(a) * (spokeLen * 0.46)
      );
      spoke.rotation.x = -a;
      rimMesh.add(spoke);
    }
  }

  // Center-lock racing wheel nut (anodized red/blue)
  const centerNutGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.05, 16);
  centerNutGeo.rotateZ(Math.PI / 2);
  const centerNutMat = new THREE.MeshStandardMaterial({
    color: isFront ? 0xe11d48 : 0x0284c7,
    roughness: 0.2,
    metalness: 0.85,
  });
  const centerNut = new THREE.Mesh(centerNutGeo, centerNutMat);
  centerNut.position.x = outerX * 1.04;
  rimMesh.add(centerNut);

  parentContainer.add(rimMesh);

  // 3. Carbon-Ceramic Brake Disc with Blackbody Thermal Glow
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

  // 4. Multi-Piston Racing Brake Caliper (Brembo Red / Racing Gold)
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

  // Sculpted Painted Roof Canopy / Greenhouse Top Panel (for enclosed cars)
  const isEnclosedCar =
    spec.archetype !== 'OPEN_WHEEL_KART' &&
    spec.archetype !== 'SCOOTER_BIKE' &&
    spec.id !== 'roadster' &&
    spec.id !== 'dune_buggy' &&
    spec.id !== 'ariel_exo';
  if (isEnclosedCar) {
    const roofLen = spec.archetype === 'HEAVY_COMMERCIAL' ? 2.4 : 1.35;
    const roofWidth = spec.archetype === 'HEAVY_COMMERCIAL' ? 2.15 : 1.24;
    const roofY = spec.archetype === 'HEAVY_COMMERCIAL' ? 1.85 : 1.16;
    const roofGeo = new THREE.BoxGeometry(roofWidth, 0.06, roofLen, 8, 2, 12);
    const rPos = roofGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const rx = rPos.getX(i) / (roofWidth * 0.5);
      const rz = rPos.getZ(i) / (roofLen * 0.5);
      const dome = (1.0 - rx * rx * 0.35) * (1.0 - rz * rz * 0.45) * 0.07;
      rPos.setY(i, rPos.getY(i) + dome - rz * 0.03);
    }
    roofGeo.computeVertexNormals();
    const roofMesh = new THREE.Mesh(roofGeo, bodyMaterial);
    roofMesh.name = 'PaintedRoofCanopy';
    roofMesh.position.set(0, roofY, -0.15);
    roofMesh.castShadow = true;
    bodyworkGroup.add(roofMesh);
  }

  // Front Radiator Grille & Side Air Intake Scoops
  const grilleMat = new THREE.MeshStandardMaterial({
    color: 0x0a0c10,
    roughness: 0.45,
    metalness: 0.65,
  });
  const frontGrille = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.22, 0.08), grilleMat);
  frontGrille.position.set(0, 0.28, 2.31);
  bodyworkGroup.add(frontGrille);

  // Side Radiator / Intercooler Intakes behind doors
  if (spec.archetype !== 'SCOOTER_BIKE') {
    for (const side of [-1, 1]) {
      const intakeScoop = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.65), grilleMat);
      intakeScoop.position.set(side * 0.94, 0.46, -0.42);
      bodyworkGroup.add(intakeScoop);
    }
  }

  // Police / SWAT Roof Lightbar if pursuit vehicle
  if (spec.id === 'police' || spec.id === 'swat_armored') {
    const barGroup = new THREE.Group();
    barGroup.position.set(0, spec.id === 'swat_armored' ? 1.65 : 1.24, -0.05);
    const redBeacon = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.07, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xff0022, emissive: 0xff0022, emissiveIntensity: 3.0 })
    );
    redBeacon.position.x = -0.26;
    const blueBeacon = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.07, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x0066ff, emissive: 0x0088ff, emissiveIntensity: 3.0 })
    );
    blueBeacon.position.x = 0.26;
    barGroup.add(redBeacon, blueBeacon);
    bodyworkGroup.add(barGroup);
  }

  // Front Splitter with Downforce Winglets
  const splitterWidth = spec.archetype === 'SCOOTER_BIKE' ? 0.55 : 2.05;
  const splitterGeo = new THREE.BoxGeometry(splitterWidth, 0.04, 0.72);
  const splitterMesh = new THREE.Mesh(splitterGeo, carbonMat);
  splitterMesh.name = 'FrontSplitter';
  splitterMesh.position.set(0, 0.12, 2.15);
  bodyworkGroup.add(splitterMesh);

  // Left & Right Splitter Winglets
  const wingletGeo = new THREE.BoxGeometry(0.03, 0.18, 0.28);
  const leftWinglet = new THREE.Mesh(wingletGeo, carbonMat);
  leftWinglet.position.set(-splitterWidth * 0.5, 0.18, 2.25);
  bodyworkGroup.add(leftWinglet);

  const rightWinglet = new THREE.Mesh(wingletGeo, carbonMat);
  rightWinglet.position.set(splitterWidth * 0.5, 0.18, 2.25);
  bodyworkGroup.add(rightWinglet);

  // Venturi Underbody Diffuser Tunnels + Vertical Diffuser Fins
  const diffuserGeo = new THREE.BoxGeometry(1.85, 0.14, 1.15);
  diffuserGeo.rotateX(-0.14); // Kick up toward rear
  const diffuserMesh = new THREE.Mesh(diffuserGeo, carbonMat);
  diffuserMesh.name = 'VenturiDiffuser';
  diffuserMesh.position.set(0, 0.18, -2.1);
  for (const fx of [-0.65, -0.22, 0.22, 0.65]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.55), carbonMat);
    fin.position.set(fx, -0.04, -0.2);
    diffuserMesh.add(fin);
  }
  bodyworkGroup.add(diffuserMesh);

  // Side Skirts
  const skirtGeo = new THREE.BoxGeometry(0.14, 0.05, 2.8);
  const leftSkirt = new THREE.Mesh(skirtGeo, carbonMat);
  leftSkirt.position.set(-0.98, 0.14, 0);
  bodyworkGroup.add(leftSkirt);

  const rightSkirt = new THREE.Mesh(skirtGeo, carbonMat);
  rightSkirt.position.set(0.98, 0.14, 0);
  bodyworkGroup.add(rightSkirt);

  // Crisp LED Matrix Headlights & Full-Width Rear Lightbar
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xdff8ff,
    emissiveIntensity: 3.2,
  });
  const headlightGeo = new THREE.BoxGeometry(0.38, 0.065, 0.14);
  const leftHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
  leftHeadlight.position.set(-0.68, 0.44, 2.18);
  leftHeadlight.rotation.y = 0.18;
  bodyworkGroup.add(leftHeadlight);

  const rightHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
  rightHeadlight.position.set(0.68, 0.44, 2.18);
  rightHeadlight.rotation.y = -0.18;
  bodyworkGroup.add(rightHeadlight);

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xff1100,
    emissive: 0xff0800,
    emissiveIntensity: 2.8,
  });
  const taillightGeo = new THREE.BoxGeometry(0.46, 0.06, 0.08);
  const leftTaillight = new THREE.Mesh(taillightGeo, taillightMat);
  leftTaillight.position.set(-0.62, 0.56, -2.28);
  bodyworkGroup.add(leftTaillight);

  const rightTaillight = new THREE.Mesh(taillightGeo, taillightMat);
  rightTaillight.position.set(0.62, 0.56, -2.28);
  bodyworkGroup.add(rightTaillight);

  // Center LED rear lightbar strip
  const centerLightbar = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.025, 0.06), taillightMat);
  centerLightbar.position.set(0, 0.57, -2.29);
  bodyworkGroup.add(centerLightbar);

  // Quad Titanium Exhaust Tips
  const exhaustMat = new THREE.MeshStandardMaterial({
    color: 0x8a929e,
    metalness: 0.95,
    roughness: 0.15,
  });
  const exhaustGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.24, 16);
  exhaustGeo.rotateX(Math.PI / 2);

  for (const exX of [-0.36, -0.22, 0.22, 0.36]) {
    const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust.position.set(exX, 0.26, -2.32);
    bodyworkGroup.add(exhaust);
  }

  rootGroup.add(bodyworkGroup);

  // ==========================================================================
  // 2. DYNAMIC DRS / AIRBRAKE REAR WING
  // ==========================================================================
  const wingGroup = new THREE.Group();
  wingGroup.name = 'DynamicRearWingAssembly';
  wingGroup.position.set(0, 0.72, -2.05);

  // Swan-Neck Aerodynamic Pylons
  const pylonGeo = new THREE.BoxGeometry(0.03, 0.38, 0.22);
  const leftPylon = new THREE.Mesh(pylonGeo, carbonMat);
  leftPylon.position.set(-0.45, 0.18, 0);
  leftPylon.rotation.x = -0.2;
  wingGroup.add(leftPylon);

  const rightPylon = new THREE.Mesh(pylonGeo, carbonMat);
  rightPylon.position.set(0.45, 0.18, 0);
  rightPylon.rotation.x = -0.2;
  wingGroup.add(rightPylon);

  // Active Airfoil Blade (tilts around local X axis)
  const airfoilGeo = new THREE.BoxGeometry(1.92, 0.04, 0.38);
  const wingMesh = new THREE.Mesh(airfoilGeo, bodyMaterial);
  wingMesh.name = 'ActiveAirfoilBlade';
  wingMesh.position.set(0, 0.36, 0);
  wingMesh.rotation.x = 0.18; // Default downforce trim angle (approx 10 degrees)
  wingGroup.add(wingMesh);

  // Endplates
  const endplateGeo = new THREE.BoxGeometry(0.025, 0.28, 0.46);
  const leftEndplate = new THREE.Mesh(endplateGeo, carbonMat);
  leftEndplate.position.set(-0.96, 0.34, 0);
  wingGroup.add(leftEndplate);

  const rightEndplate = new THREE.Mesh(endplateGeo, carbonMat);
  rightEndplate.position.set(0.96, 0.34, 0);
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
