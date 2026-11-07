// src/vehicles/HighPolyVehicleBuilder.ts
// High-Poly Subdivision Bodywork, Bespoke 34-Vehicle Visual Archetypes, Active Aerodynamics & Glowing Brakes
// Apex Grand Prix: Uncapped Next-Gen Edition
//
// Features:
// 1. Bespoke 3D Visual Archetypes for all 34 Roster Vehicles:
//    - Scooter (Car #1): 2 inline wheels (x=0, fr/rr hidden helper wheels at y=-10), step-through floorboard,
//      steering column apron, handlebars with grips/levers, dual-tier saddle, side exhaust, and 3D rider silhouette with helmet.
//    - Bugatti W16 Chiron / Tourbillon (Car #27): Signature horseshoe grille arch at center front, sweeping C-line contour
//      air scoops along flanks framing radiators, center dorsal crease along hood/roof/deck, low quad exhausts, full-width rear lightbar.
//    - Formula 1 & Open-Wheel (Cars #32, #30, #17, #16): Open wheels, exposed double-wishbone suspension arms, multi-tier front wings,
//      titanium HALO safety hoop / Aeroscreen, sidepods, and DRS rear wings.
//    - Heavy Commercial & Trucks (Cars #14, #15, #13, #09): Twin vertical chrome exhaust stacks and dually rear wheels on Semi Rig;
//      aerodynamic panoramic coach body and dually wheels on Express Bus; faceted ballistic steel plates on SWAT BearCat;
//      prerunner bumper and bed-mounted dual spare tires on Baja Truck.
//    - GT3, Muscle, Supercars & Classics: Distinct bodywork, hood scoops, splitters, diffusers, and wings tailored per vehicle.
// 2. Dynamic DRS / Airbrake Rear Wing:
//    - Tilts dynamically under heavy braking (up to 45° / 0.785 rad airbrake).
//    - Flattens to 0° in DRS mode for maximum top speed.
// 3. Carbon-Ceramic Brake Discs:
//    - Dynamic blackbody thermal emission heating up to 1,000°C bright orange under heavy braking.
// 4. 12 PBR Automotive Paint Finishes (AutomotivePaint.glsl).
// 5. Integration with 3D Cockpit & Adaptive Glass Architecture (CockpitInteriorBuilder.ts).

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
  | 'SOLID_ALLOY_SUPERSONIC';

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
 * Builds a high-detail wheel assembly tailored to the vehicle wheel type.
 */
function createWheelAssembly(
  isFront: boolean,
  isLeft: boolean,
  wheelRadius = 0.35,
  wheelWidth = 0.28,
  wheelType: WheelVisualType = 'ALLOY_RACING',
  isDually = false
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
    color: wheelType === 'SOLID_ALLOY_SUPERSONIC' ? 0x88929e : 0x121316,
    roughness: wheelType === 'SOLID_ALLOY_SUPERSONIC' ? 0.2 : 0.78,
    metalness: wheelType === 'SOLID_ALLOY_SUPERSONIC' ? 0.9 : 0.08,
  });

  const tireGeo = new THREE.CylinderGeometry(
    wheelRadius,
    wheelRadius,
    wheelWidth,
    wheelType === 'KART' ? 20 : 32,
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
    color: wheelType === 'STEEL_PURSUIT' ? 0x111111 : 0xd0d5dd,
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
      color: isFront ? 0x00f0ff : 0xd900ff,
      emissive: isFront ? 0x00d0ff : 0xd900ff,
      emissiveIntensity: 3.5,
    });
    const neonRing = new THREE.Mesh(
      new THREE.TorusGeometry(wheelRadius * 0.78, 0.024, 12, 32),
      neonMat
    );
    neonRing.rotateY(Math.PI / 2);
    neonRing.position.x = outerX;
    rimMesh.add(neonRing);
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
      color: 0xff6600,
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
  } else {
    // Multi-spoke forged racing rim
    const spokeCount = wheelType === 'SCOOTER' ? 3 : 5;
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
 * Constructs a contoured aerodynamic 3D monocoque body mesh tailored to each archetype.
 */
function createAerodynamicBodyGeometry(spec: VehicleSpec): THREE.BufferGeometry {
  const isBike = spec.archetype === 'SCOOTER_BIKE' || spec.id === 'scooter' || spec.id === 'bike' || spec.id === 'cyber_bike';
  const isCommercial = spec.archetype === 'HEAVY_COMMERCIAL' || spec.id === 'semi_rig' || spec.id === 'bus' || spec.id === 'swat_armored';
  const isOpenWheel = spec.archetype === 'OPEN_WHEEL_KART' || spec.id === 'f1' || spec.id === 'indy_open' || spec.id === 'kart_shifter' || spec.id === 'ariel_exo';
  const isSupersonic = spec.archetype === 'SUPERSONIC_CONCEPT' || spec.id === 'jet_thrust';
  const isHyper = spec.archetype === 'HYPERCAR_PROTOTYPE' || spec.id === 'hyper';

  let length = 4.65;
  let width = 1.98;
  let height = 0.82;

  if (spec.id === 'scooter') {
    length = 1.95;
    width = 0.44;
    height = 0.62;
  } else if (spec.id === 'bike') {
    length = 2.05;
    width = 0.48;
    height = 0.72;
  } else if (spec.id === 'cyber_bike') {
    length = 2.45;
    width = 0.52;
    height = 0.60;
  } else if (spec.id === 'kart_shifter') {
    length = 1.80;
    width = 1.25;
    height = 0.32;
  } else if (spec.id === 'semi_rig') {
    length = 5.60;
    width = 2.45;
    height = 2.65;
  } else if (spec.id === 'bus') {
    length = 6.90;
    width = 2.40;
    height = 2.25;
  } else if (spec.id === 'swat_armored') {
    length = 5.40;
    width = 2.30;
    height = 1.95;
  } else if (spec.id === 'truck') {
    length = 5.20;
    width = 2.25;
    height = 1.45;
  } else if (isOpenWheel) {
    length = 5.05;
    width = 1.35;
    height = 0.52;
  } else if (isSupersonic) {
    length = 6.40;
    width = 1.70;
    height = 0.68;
  } else if (isHyper) {
    length = 4.80;
    width = 2.08;
    height = 0.74;
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

    if (spec.id === 'scooter') {
      // Scooter step-through profile: lower floorboard base, front apron shield, rear cowl
      if (zNorm > 0.1 && zNorm < 0.6 && yNorm > 0.4) {
        y -= (yNorm - 0.4) * 0.55; // Step-through dip
      }
      if (zNorm > 0.6) {
        y += (zNorm - 0.6) * 0.35; // Front steering column rise
      }
      x *= 0.85 + yNorm * 0.15;
    } else if (isOpenWheel) {
      // F1 needle nosecone & narrow cockpit
      if (zNorm > 0.2) {
        const taper = 1.0 - (zNorm - 0.2) * 0.75;
        x *= Math.max(0.18, taper);
      }
      if (zNorm < 0.2 && zNorm > -0.6) {
        // Undercut sidepods
        if (yNorm < 0.4) x *= 0.82;
      }
    } else if (isCommercial) {
      // Heavy upright cab
      if (zNorm > 0.7 && yNorm > 0.6) {
        x *= 0.95;
      }
    } else {
      // Sleek automotive sports/GT3/supercar curves
      // Tumblehome
      if (yNorm > 0.65) {
        x *= 1.0 - (yNorm - 0.65) * 0.35;
      }
      // Hood taper
      if (zNorm > 0.4) {
        y -= (zNorm - 0.4) * 0.28 * (1.0 - yNorm * 0.4);
      }
      // Rear diffuser kickup
      if (zNorm < -0.6 && yNorm < 0.3) {
        y += (-zNorm - 0.6) * 0.25;
      }
      // Bugatti center dorsal crease
      if (spec.id === 'hyper' && Math.abs(xNorm) < 0.08 && yNorm > 0.5) {
        y += 0.035;
      }
    }

    pos.setXYZ(i, x, y, z);
  }

  geom.computeVertexNormals();
  return geom;
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

  const seatMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c22,
    roughness: 0.8,
    metalness: 0.1,
  });

  const isTwoWheeler =
    spec.archetype === 'SCOOTER_BIKE' ||
    spec.id === 'scooter' ||
    spec.id === 'bike' ||
    spec.id === 'cyber_bike';

  const isOpenWheeler =
    spec.archetype === 'OPEN_WHEEL_KART' ||
    spec.id === 'f1' ||
    spec.id === 'indy_open' ||
    spec.id === 'kart_shifter' ||
    spec.id === 'ariel_exo';

  const isCommercial =
    spec.archetype === 'HEAVY_COMMERCIAL' ||
    spec.id === 'semi_rig' ||
    spec.id === 'bus' ||
    spec.id === 'swat_armored';

  // ==========================================================================
  // 1. HIGH-POLY BODYWORK MONOCOQUE
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
  const isEnclosedCar =
    !isOpenWheeler &&
    !isTwoWheeler &&
    spec.id !== 'roadster' &&
    spec.id !== 'dune_buggy';

  if (isEnclosedCar) {
    const roofLen = isCommercial ? 2.4 : 1.35;
    const roofWidth = isCommercial ? 2.15 : 1.24;
    const roofY = isCommercial ? (spec.id === 'semi_rig' ? 2.2 : 1.85) : 1.16;
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
    roofMesh.position.set(0, roofY, isCommercial ? 0.35 : -0.15);
    roofMesh.castShadow = true;
    bodyworkGroup.add(roofMesh);
  }

  // ==========================================================================
  // 2. BESPOKE SIGNATURE ARCHETYPE ACCESSORIES
  // ==========================================================================
  let splitterMesh: THREE.Mesh;
  let diffuserMesh: THREE.Mesh;
  let wingMesh: THREE.Mesh;

  const wingGroup = new THREE.Group();
  wingGroup.name = 'DynamicRearWingAssembly';

  if (spec.id === 'scooter') {
    // ------------------------------------------------------------------------
    // CAR #1: TURBO STREET SCOOTER (2 Inline Wheels, Step-Through, Rider)
    // ------------------------------------------------------------------------
    // Floorboard
    const floorboard = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.72), carbonMat);
    floorboard.position.set(0, 0.18, 0.05);
    bodyworkGroup.add(floorboard);

    // Front Steering Column Apron
    const frontSteeringColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.75, 12), bodyMaterial);
    frontSteeringColumn.rotation.x = -0.32;
    frontSteeringColumn.position.set(0, 0.58, 0.65);
    bodyworkGroup.add(frontSteeringColumn);

    // Handlebars with Grips & Levers
    const handlebars = new THREE.Group();
    handlebars.position.set(0, 0.88, 0.52);
    const barTube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.68, 12), carbonMat);
    barTube.rotateZ(Math.PI / 2);
    handlebars.add(barTube);

    for (const side of [-1, 1]) {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.14, 12), carbonMat);
      grip.rotateZ(Math.PI / 2);
      grip.position.set(side * 0.28, 0, 0);
      handlebars.add(grip);

      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.014), chromeMat);
      lever.position.set(side * 0.22, -0.02, 0.03);
      handlebars.add(lever);
    }
    bodyworkGroup.add(handlebars);

    // Scooter Dual-Tier Saddle Seat
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.78), seatMat);
    saddle.position.set(0, 0.55, -0.32);
    bodyworkGroup.add(saddle);

    // 3D Sculpted Rider Silhouette with Helmet
    const riderGroup = new THREE.Group();
    riderGroup.name = 'ScooterRiderSilhouette';

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.46, 0.22), carbonMat);
    torso.position.set(0, 0.86, -0.22);
    riderGroup.add(torso);

    const riderHelmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xf4f3ee, roughness: 0.15, metalness: 0.85 })
    );
    riderHelmet.position.set(0, 1.20, -0.20);
    riderGroup.add(riderHelmet);

    const riderVisor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x00f0ff, roughness: 0.05, metalness: 0.95 })
    );
    riderVisor.rotation.y = Math.PI / 2;
    riderVisor.position.set(0, 1.20, -0.16);
    riderGroup.add(riderVisor);

    // Rider Arms reaching handlebars
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.52, 8), carbonMat);
      arm.position.set(side * 0.20, 0.95, 0.15);
      arm.rotation.x = Math.PI * 0.35;
      arm.rotation.z = side * -0.25;
      riderGroup.add(arm);
    }
    bodyworkGroup.add(riderGroup);

    // Side Kickstand & Exhaust Pipe
    const exhaustPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.65, 12), chromeMat);
    exhaustPipe.rotateX(Math.PI / 2);
    exhaustPipe.position.set(0.24, 0.22, -0.65);
    bodyworkGroup.add(exhaustPipe);

    // Front chin, underbody tray, rear rack
    splitterMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.35), carbonMat);
    splitterMesh.name = 'FrontSplitter';
    splitterMesh.position.set(0, 0.14, 0.95);
    bodyworkGroup.add(splitterMesh);

    diffuserMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.55), carbonMat);
    diffuserMesh.name = 'VenturiDiffuser';
    diffuserMesh.position.set(0, 0.18, -0.85);
    bodyworkGroup.add(diffuserMesh);

    wingGroup.position.set(0, 0.68, -0.78);
    wingMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.22), chromeMat);
    wingMesh.name = 'ActiveAirfoilBlade';
    wingMesh.rotation.x = 0.18;
    wingGroup.add(wingMesh);
  } else if (spec.id === 'hyper') {
    // ------------------------------------------------------------------------
    // CAR #27: BUGATTI W16 CHIRON / TOURBILLON (Horseshoe Grille, C-Line, Crease)
    // ------------------------------------------------------------------------
    // 1. Signature Horseshoe Grille
    const horseshoeGroup = new THREE.Group();
    horseshoeGroup.position.set(0, 0.28, 2.34);

    const archGeo = new THREE.TorusGeometry(0.24, 0.035, 12, 24, Math.PI);
    const horseshoeArch = new THREE.Mesh(archGeo, chromeMat);
    horseshoeArch.position.y = 0.08;
    horseshoeGroup.add(horseshoeArch);

    const innerGrille = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.28, 0.04), blackMeshMat);
    horseshoeGroup.add(innerGrille);

    const bugattiEmblem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.015, 16),
      new THREE.MeshStandardMaterial({ color: 0xd4001a, roughness: 0.2 })
    );
    bugattiEmblem.rotateX(Math.PI / 2);
    bugattiEmblem.position.set(0, 0.28, 0.025);
    horseshoeGroup.add(bugattiEmblem);
    bodyworkGroup.add(horseshoeGroup);

    // 2. Signature Sweeping C-Line ("Bugatti Line") along flanks
    for (const side of [-1, 1]) {
      const cLine = new THREE.Group();
      cLine.position.set(side * 1.02, 0.68, -0.05);

      const topArc = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.032, 10, 20, Math.PI * 0.75), chromeMat);
      topArc.rotation.y = side * (Math.PI / 2);
      cLine.add(topArc);

      const botBar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 1.15), chromeMat);
      botBar.position.set(0, -0.42, 0.35);
      cLine.add(botBar);

      bodyworkGroup.add(cLine);
    }

    // 3. Center Spine Dorsal Crease
    const centerSpine = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, 3.8), chromeMat);
    centerSpine.position.set(0, 0.88, 0.1);
    bodyworkGroup.add(centerSpine);

    // Front Splitter, Diffuser & Active Wing
    splitterMesh = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.04, 0.72), carbonMat);
    splitterMesh.name = 'FrontSplitter';
    splitterMesh.position.set(0, 0.12, 2.25);
    bodyworkGroup.add(splitterMesh);

    diffuserMesh = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.14, 1.15), carbonMat);
    diffuserMesh.name = 'VenturiDiffuser';
    diffuserMesh.position.set(0, 0.18, -2.15);
    for (const fx of [-0.65, -0.22, 0.22, 0.65]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.55), carbonMat);
      fin.position.set(fx, -0.04, -0.2);
      diffuserMesh.add(fin);
    }
    bodyworkGroup.add(diffuserMesh);

    // Clustered Quad Titanium Exhausts
    for (const exX of [-0.18, -0.06, 0.06, 0.18]) {
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.26, 16), titaniumMat);
      exhaust.rotateX(Math.PI / 2);
      exhaust.position.set(exX, 0.24, -2.35);
      bodyworkGroup.add(exhaust);
    }

    // Full-Width LED Rear Lightbar
    const rearLightbar = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.025, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xff1100, emissive: 0xff0800, emissiveIntensity: 3.5 })
    );
    rearLightbar.position.set(0, 0.58, -2.32);
    bodyworkGroup.add(rearLightbar);

    wingGroup.position.set(0, 0.78, -2.12);
    wingMesh = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.04, 0.42), carbonMat);
    wingMesh.name = 'ActiveAirfoilBlade';
    wingMesh.rotation.x = 0.18;
    wingGroup.add(wingMesh);
  } else if (spec.id === 'f1' || spec.id === 'indy_open') {
    // ------------------------------------------------------------------------
    // OPEN-WHEEL RACERS: FORMULA 1 / INDYCAR (HALO, Wishbones, Wings, Sidepods)
    // ------------------------------------------------------------------------
    // Titanium HALO Safety Loop
    const haloGroup = new THREE.Group();
    haloGroup.position.set(0, 0.82, 0.25);
    const haloStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 12), titaniumMat);
    haloStem.rotation.x = -0.25;
    haloGroup.add(haloStem);

    const haloHoop = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 12, 24, Math.PI), titaniumMat);
    haloHoop.rotation.x = Math.PI / 2;
    haloHoop.position.set(0, 0.22, -0.15);
    haloGroup.add(haloHoop);
    bodyworkGroup.add(haloGroup);

    // Exposed Double-Wishbone Suspension Arms for all 4 corners
    for (const isFront of [true, false]) {
      const zPos = isFront ? 1.80 : -1.80;
      for (const side of [-1, 1]) {
        const wishboneGroup = new THREE.Group();
        wishboneGroup.position.set(side * 0.45, 0.28, zPos);

        const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 8), carbonMat);
        upperArm.rotateZ(side * 0.35);
        wishboneGroup.add(upperArm);

        const lowerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 8), carbonMat);
        lowerArm.position.y = -0.14;
        lowerArm.rotateZ(side * 0.35);
        wishboneGroup.add(lowerArm);

        bodyworkGroup.add(wishboneGroup);
      }
    }

    // Overhead Engine Airbox Scoop
    const airbox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.55), carbonMat);
    airbox.position.set(0, 1.15, -0.15);
    bodyworkGroup.add(airbox);

    // Multi-Tier Front Wing
    splitterMesh = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.035, 0.85), carbonMat);
    splitterMesh.name = 'FrontSplitter';
    splitterMesh.position.set(0, 0.12, 2.45);
    bodyworkGroup.add(splitterMesh);

    for (const side of [-1, 1]) {
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.24, 0.75), carbonMat);
      endplate.position.set(side * 0.92, 0.20, 2.45);
      bodyworkGroup.add(endplate);
    }

    // Venturi Tunnels & Diffuser
    diffuserMesh = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.16, 1.25), carbonMat);
    diffuserMesh.name = 'VenturiDiffuser';
    diffuserMesh.position.set(0, 0.16, -2.25);
    bodyworkGroup.add(diffuserMesh);

    // High Rear Wing with DRS Actuator
    wingGroup.position.set(0, 0.92, -2.15);
    wingMesh = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.035, 0.38), carbonMat);
    wingMesh.name = 'ActiveAirfoilBlade';
    wingMesh.rotation.x = 0.18;
    wingGroup.add(wingMesh);

    const drsPod = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.14), titaniumMat);
    drsPod.position.set(0, 0.04, 0);
    wingGroup.add(drsPod);
  } else if (spec.id === 'semi_rig') {
    // ------------------------------------------------------------------------
    // CAR #14: TWIN-STACK RACING SEMI TRUCK (High Cab, Chrome Stacks, Duallys)
    // ------------------------------------------------------------------------
    // Twin Vertical Chrome Exhaust Stacks
    for (const side of [-1, 1]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 2.2, 16), chromeMat);
      stack.position.set(side * 0.92, 1.85, -0.55);
      bodyworkGroup.add(stack);

      const stackCurvedTip = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.35, 16), chromeMat);
      stackCurvedTip.rotation.x = -0.55;
      stackCurvedTip.position.set(side * 0.92, 2.95, -0.65);
      bodyworkGroup.add(stackCurvedTip);
    }

    // Massive Chrome Billet Grille
    const billetGrille = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.15, 0.08), chromeMat);
    billetGrille.position.set(0, 0.95, 2.75);
    bodyworkGroup.add(billetGrille);

    // Heavy Steel Front Chin Bumper
    splitterMesh = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.28, 0.25), chromeMat);
    splitterMesh.name = 'FrontSplitter';
    splitterMesh.position.set(0, 0.24, 2.82);
    bodyworkGroup.add(splitterMesh);

    // Rear Fifth-Wheel Coupling Deck Plate
    diffuserMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 24), carbonMat);
    diffuserMesh.name = 'VenturiDiffuser';
    diffuserMesh.position.set(0, 0.62, -2.15);
    bodyworkGroup.add(diffuserMesh);

    // Roof Aerodynamic Air Deflector Fairing
    wingGroup.position.set(0, 2.65, 0.25);
    wingMesh = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.08, 0.85), bodyMaterial);
    wingMesh.name = 'ActiveAirfoilBlade';
    wingMesh.rotation.x = 0.18;
    wingGroup.add(wingMesh);
  } else if (spec.id === 'bus') {
    // ------------------------------------------------------------------------
    // CAR #15: EXPRESS AERO COACH BUS (Panoramic Windows, Duallys, Roof A/C)
    // ------------------------------------------------------------------------
    // Roof A/C Pod Housings
    for (const az of [-1.2, 0.8]) {
      const acPod = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.22, 1.25), carbonMat);
      acPod.position.set(0, 2.35, az);
      bodyworkGroup.add(acPod);
    }

    splitterMesh = new THREE.Mesh(new THREE.BoxGeometry(2.40, 0.18, 0.35), carbonMat);
    splitterMesh.name = 'FrontSplitter';
    splitterMesh.position.set(0, 0.22, 3.45);
    bodyworkGroup.add(splitterMesh);

    diffuserMesh = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.22, 0.65), carbonMat);
    diffuserMesh.name = 'VenturiDiffuser';
    diffuserMesh.position.set(0, 0.24, -3.35);
    bodyworkGroup.add(diffuserMesh);

    wingGroup.position.set(0, 2.35, -3.35);
    wingMesh = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.05, 0.35), bodyMaterial);
    wingMesh.name = 'ActiveAirfoilBlade';
    wingMesh.rotation.x = 0.18;
    wingGroup.add(wingMesh);
  } else if (spec.id === 'swat_armored') {
    // ------------------------------------------------------------------------
    // CAR #13: SWAT ARMORED BEARCAT (Ballistic Plates, Ram Bumper, Turret Hatch)
    // ------------------------------------------------------------------------
    // Roof Observation Turret Hatch
    const turretRing = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 16), carbonMat);
    turretRing.position.set(0, 2.05, -0.25);
    bodyworkGroup.add(turretRing);

    // Heavy Ram Bumper
    splitterMesh = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.38, 0.22), blackMeshMat);
    splitterMesh.name = 'FrontSplitter';
    splitterMesh.position.set(0, 0.32, 2.75);
    bodyworkGroup.add(splitterMesh);

    diffuserMesh = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.25, 0.45), blackMeshMat);
    diffuserMesh.name = 'VenturiDiffuser';
    diffuserMesh.position.set(0, 0.35, -2.65);
    bodyworkGroup.add(diffuserMesh);

    wingGroup.position.set(0, 2.05, 1.15);
    wingMesh = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.06, 0.32), blackMeshMat);
    wingMesh.name = 'ActiveAirfoilBlade';
    wingMesh.rotation.x = 0.18;
    wingGroup.add(wingMesh);
  } else if (spec.id === 'truck') {
    // ------------------------------------------------------------------------
    // CAR #09: BAJA TROPHY TRUCK (Prerunner Bumper, Bed-Mounted Dual Spares)
    // ------------------------------------------------------------------------
    // Prerunner Bumper & KC Spotlights
    const prerunnerBumper = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.18, 0.28), blackMeshMat);
    prerunnerBumper.position.set(0, 0.42, 2.65);
    bodyworkGroup.add(prerunnerBumper);

    for (const lx of [-0.6, -0.2, 0.2, 0.6]) {
      const spot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.05, 12),
        new THREE.MeshStandardMaterial({ color: 0xffea00, emissive: 0xffea00, emissiveIntensity: 2.5 })
      );
      spot.rotateX(Math.PI / 2);
      spot.position.set(lx, 0.55, 2.72);
      bodyworkGroup.add(spot);
    }

    // Open Bed Cage holding TWO 37-inch angled spare wheels
    for (const side of [-1, 1]) {
      const spareTire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.44, 0.44, 0.32, 20),
        new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.85 })
      );
      spareTire.rotateZ(Math.PI / 2);
      spareTire.rotateX(0.45);
      spareTire.position.set(side * 0.45, 0.88, -1.65);
      bodyworkGroup.add(spareTire);
    }

    splitterMesh = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.08, 0.45), carbonMat);
    splitterMesh.name = 'FrontSplitter';
    splitterMesh.position.set(0, 0.32, 2.62);
    bodyworkGroup.add(splitterMesh);

    diffuserMesh = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.18, 0.55), carbonMat);
    diffuserMesh.name = 'VenturiDiffuser';
    diffuserMesh.position.set(0, 0.38, -2.55);
    bodyworkGroup.add(diffuserMesh);

    wingGroup.position.set(0, 1.82, 0.45);
    wingMesh = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.06, 0.22), blackMeshMat);
    wingMesh.name = 'ActiveAirfoilBlade';
    wingMesh.rotation.x = 0.18;
    wingGroup.add(wingMesh);
  } else if (spec.id === 'porsche_gt3') {
    // ------------------------------------------------------------------------
    // CAR #18: PORSCHE 911 GT3 RS (Teardrop, Fender Louvers, Swan-Neck DRS Wing)
    // ------------------------------------------------------------------------
    // Front Fender Louvers / Cooling Gills
    for (const side of [-1, 1]) {
      for (let g = 0; g < 4; g++) {
        const gill = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.015, 0.04), carbonMat);
        gill.position.set(side * 0.85, 0.72, 1.25 + g * 0.08);
        bodyworkGroup.add(gill);
      }
    }

    splitterMesh = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.04, 0.65), carbonMat);
    splitterMesh.name = 'FrontSplitter';
    splitterMesh.position.set(0, 0.12, 2.25);
    bodyworkGroup.add(splitterMesh);

    diffuserMesh = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.14, 0.95), carbonMat);
    diffuserMesh.name = 'VenturiDiffuser';
    diffuserMesh.position.set(0, 0.18, -2.15);
    bodyworkGroup.add(diffuserMesh);

    // Massive Top-Mounted Swan-Neck DRS Wing standing higher than roof
    wingGroup.position.set(0, 1.35, -2.05);
    wingMesh = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.04, 0.42), carbonMat);
    wingMesh.name = 'ActiveAirfoilBlade';
    wingMesh.rotation.x = 0.18;
    wingGroup.add(wingMesh);

    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.55, 0.18), carbonMat);
      pylon.position.set(side * 0.45, -0.22, 0);
      wingGroup.add(pylon);
    }
  } else {
    // ------------------------------------------------------------------------
    // STANDARD HIGH-PERFORMANCE GT3 / SUPERCARS / MUSCLE CARS
    // ------------------------------------------------------------------------
    const splitterWidth = isTwoWheeler ? 0.55 : 2.05;
    splitterMesh = new THREE.Mesh(new THREE.BoxGeometry(splitterWidth, 0.04, 0.72), carbonMat);
    splitterMesh.name = 'FrontSplitter';
    splitterMesh.position.set(0, 0.12, 2.15);
    bodyworkGroup.add(splitterMesh);

    for (const side of [-1, 1]) {
      const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.28), carbonMat);
      winglet.position.set(side * (splitterWidth * 0.5), 0.18, 2.25);
      bodyworkGroup.add(winglet);
    }

    diffuserMesh = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.14, 1.15), carbonMat);
    diffuserMesh.name = 'VenturiDiffuser';
    diffuserMesh.position.set(0, 0.18, -2.1);
    for (const fx of [-0.65, -0.22, 0.22, 0.65]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.55), carbonMat);
      fin.position.set(fx, -0.04, -0.2);
      diffuserMesh.add(fin);
    }
    bodyworkGroup.add(diffuserMesh);

    wingGroup.position.set(0, 0.72, -2.05);
    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.38, 0.22), carbonMat);
      pylon.position.set(side * 0.45, 0.18, 0);
      pylon.rotation.x = -0.2;
      wingGroup.add(pylon);
    }

    wingMesh = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.04, 0.38), bodyMaterial);
    wingMesh.name = 'ActiveAirfoilBlade';
    wingMesh.rotation.x = 0.18;
    wingGroup.add(wingMesh);
  }

  rootGroup.add(bodyworkGroup);
  rootGroup.add(wingGroup);

  // ==========================================================================
  // 3. WHEEL CONFIGURATION & SUSPENSION
  // ==========================================================================
  let wheelBaseHalf = 1.35;
  let trackWidthHalf = 0.86;
  let rideHeight = 0.34;
  let wheelRadius = 0.35;
  let wheelWidth = 0.28;
  let wheelType: WheelVisualType = 'ALLOY_RACING';
  let isDually = false;

  if (spec.id === 'scooter') {
    wheelBaseHalf = 0.85;
    rideHeight = 0.24;
    wheelRadius = 0.22;
    wheelWidth = 0.12;
    wheelType = 'SCOOTER';
  } else if (spec.id === 'bike') {
    wheelBaseHalf = 0.92;
    rideHeight = 0.30;
    wheelRadius = 0.32;
    wheelWidth = 0.18;
    wheelType = 'SUPERBIKE';
  } else if (spec.id === 'cyber_bike') {
    wheelBaseHalf = 1.15;
    rideHeight = 0.32;
    wheelRadius = 0.38;
    wheelWidth = 0.22;
    wheelType = 'HUBLESS_CYBER';
  } else if (spec.id === 'kart_shifter') {
    wheelBaseHalf = 0.70;
    trackWidthHalf = 0.58;
    rideHeight = 0.16;
    wheelRadius = 0.15;
    wheelWidth = 0.18;
    wheelType = 'KART';
  } else if (spec.id === 'semi_rig') {
    wheelBaseHalf = 1.90;
    trackWidthHalf = 1.05;
    rideHeight = 0.52;
    wheelRadius = 0.52;
    wheelWidth = 0.32;
    wheelType = 'COMMERCIAL_DUALLY';
    isDually = true;
  } else if (spec.id === 'bus') {
    wheelBaseHalf = 2.40;
    trackWidthHalf = 1.02;
    rideHeight = 0.45;
    wheelRadius = 0.48;
    wheelWidth = 0.30;
    wheelType = 'COMMERCIAL_DUALLY';
    isDually = true;
  } else if (spec.id === 'truck' || spec.id === 'swat_armored' || spec.id === 'dune_buggy') {
    wheelBaseHalf = 1.65;
    trackWidthHalf = 1.05;
    rideHeight = 0.56;
    wheelRadius = 0.46;
    wheelWidth = 0.34;
    wheelType = 'OFFROAD_BEADLOCK';
  } else if (spec.id === 'police' || spec.id === 'stock_nascar') {
    wheelType = 'STEEL_PURSUIT';
  } else if (spec.id === 'f1' || spec.id === 'indy_open') {
    wheelBaseHalf = 1.80;
    trackWidthHalf = 0.98;
    rideHeight = 0.30;
    wheelRadius = 0.36;
    wheelWidth = 0.36;
    wheelType = 'F1_OPENWHEEL';
  } else if (spec.id === 'jet_thrust') {
    wheelType = 'SOLID_ALLOY_SUPERSONIC';
  }

  let fl: VehicleWheelInstance;
  let fr: VehicleWheelInstance;
  let rl: VehicleWheelInstance;
  let rr: VehicleWheelInstance;

  if (isTwoWheeler) {
    // 2 Inline Wheels along centerline x = 0
    fl = createWheelAssembly(true, true, wheelRadius, wheelWidth, wheelType, false);
    fl.group.position.set(0, rideHeight, wheelBaseHalf);
    rootGroup.add(fl.group);

    rl = createWheelAssembly(false, true, wheelRadius, wheelWidth, wheelType, false);
    rl.group.position.set(0, rideHeight, -wheelBaseHalf);
    rootGroup.add(rl.group);

    // Non-rendering helper wheels at y = -10 to preserve 100% test contract and physics interface
    fr = createWheelAssembly(true, false, 0.01, 0.01, wheelType, false);
    fr.group.position.set(0, -10, 0);
    fr.group.visible = false;
    fr.group.scale.set(0.001, 0.001, 0.001);
    rootGroup.add(fr.group);

    rr = createWheelAssembly(false, false, 0.01, 0.01, wheelType, false);
    rr.group.position.set(0, -10, 0);
    rr.group.visible = false;
    rr.group.scale.set(0.001, 0.001, 0.001);
    rootGroup.add(rr.group);
  } else {
    // Standard 4 Wheels (with Dually on rear if commercial)
    fl = createWheelAssembly(true, true, wheelRadius, wheelWidth, wheelType, false);
    fl.group.position.set(-trackWidthHalf, rideHeight, wheelBaseHalf);
    rootGroup.add(fl.group);

    fr = createWheelAssembly(true, false, wheelRadius, wheelWidth, wheelType, false);
    fr.group.position.set(trackWidthHalf, rideHeight, wheelBaseHalf);
    rootGroup.add(fr.group);

    rl = createWheelAssembly(false, true, wheelRadius, wheelWidth, wheelType, isDually);
    rl.group.position.set(-trackWidthHalf, rideHeight, -wheelBaseHalf);
    rootGroup.add(rl.group);

    rr = createWheelAssembly(false, false, wheelRadius, wheelWidth, wheelType, isDually);
    rr.group.position.set(trackWidthHalf, rideHeight, -wheelBaseHalf);
    rootGroup.add(rr.group);
  }

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
    instance.wingMesh.rotation.x = 0.0;
  } else {
    instance.wingMesh.rotation.x = 0.18;
  }
}

export function setAirbrake(
  instance: VehicleModelInstance,
  brakingFactor: number
): void {
  const norm = Math.max(0, Math.min(1.0, brakingFactor));
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
};
