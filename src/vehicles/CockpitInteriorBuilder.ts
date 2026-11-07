// src/vehicles/CockpitInteriorBuilder.ts
// Playable First-Person 3D Cockpit Interior & Adaptive Glass Architecture
// Apex Grand Prix: Uncapped Next-Gen Edition
//
// Features:
// 1. Adaptive Framed Glass & Structural Pillars:
//    - Tailored per archetype:
//      * Open-Wheel (F1, Indy, Ariel, Kart): Low aerodynamic deflector, titanium HALO / Aeroscreen structure, no obstructive car doors.
//      * Scooter & Superbike: Sculpted handlebar windscreen cowl, compact side aero guards, motorcycle triple-clamp struts.
//      * Commercial & Trucks (Semi Rig, Coach Bus): High panoramic windshield, tall cab side glass, heavy commercial A-pillars.
//      * GT3, Supercars & Muscle: Sloped laminated windshield with dual animated wipers, tumblehome side glass, gloss-black B/C pillars.
// 2. Adaptive Steering Controls:
//    - F1 & Indy: Carbon butterfly yoke steering wheel with telemetry display and shift LEDs.
//    - Scooter & Superbike: Motorcycle handlebars with handgrips, brake/clutch levers, and digital gauge cluster.
//    - Commercial & Trucks: Large-diameter upward-tilted heavy commercial truck steering wheel.
//    - Classic Muscle: Vintage 3-spoke deep-dish steering wheel.
//    - Sports & Supercars: Flat-bottom racing wheel with 12 o'clock center stripe.
// 3. Playable First-Person 3D Cockpit Interior (Camera Mode: COCKPIT):
//    - 3D dashboard with live 3D Digital Telemetry Screen (KPH, Gear, RPM bar, Lap Delta rendered on canvas texture).
//    - 9-segment progressive shift LED array (Green -> Amber -> Red -> Blue redline flash).
//    - Bolstered seats, harness belts, archetype roll cage/HALO, driver helmet, and eye-height camera anchor.

import * as THREE from 'three';
import { LiveCockpitTelemetry, VehicleSpec } from '../core/types';
import { createRefractiveGlassMaterial } from '../core/UncappedRenderer';

export interface CockpitWipers {
  leftWiper: THREE.Group;
  rightWiper: THREE.Group;
  wiperBlades: THREE.Mesh[];
  wiperAngleRad: number;
}

export interface CockpitSeats {
  driverSeat: THREE.Group;
  passengerSeat?: THREE.Group;
  driverHelmet: THREE.Mesh;
  harnessBelts: THREE.Mesh[];
}

export interface CockpitInteriorInstance {
  rootGroup: THREE.Group;
  spec: VehicleSpec;
  // Glass & Frame
  glassGroup: THREE.Group;
  windshieldMesh: THREE.Mesh;
  windshieldMaterial: THREE.Material;
  leftWindowMesh: THREE.Mesh;
  rightWindowMesh: THREE.Mesh;
  rearBackglassMesh: THREE.Mesh;
  engineBayWindowMesh?: THREE.Mesh;
  wipers: CockpitWipers;
  aPillarsMesh: THREE.Mesh;
  bcPillarsMesh: THREE.Mesh;
  beltlineTrimMesh: THREE.Mesh;
  interiorRearviewMirror: THREE.Group;
  leftWingMirror: THREE.Group;
  rightWingMirror: THREE.Group;
  // Playable Cockpit Interior
  dashboardGroup: THREE.Group;
  telemetryScreenMesh: THREE.Mesh;
  telemetryCanvas: any;
  telemetryContext: any;
  telemetryTexture: THREE.CanvasTexture;
  steeringColumnGroup: THREE.Group;
  steeringWheelGroup: THREE.Group;
  steeringWheelMesh: THREE.Mesh;
  shiftLeds: THREE.Mesh[];
  shiftLedMaterials: THREE.MeshBasicMaterial[];
  seats: CockpitSeats;
  rollCageGroup: THREE.Group;
  engineBlockGroup?: THREE.Group;
  // Camera Anchor
  cockpitCameraAnchor: THREE.Object3D;
  // State
  lastTelemetry?: LiveCockpitTelemetry;
}

/**
 * Creates a canvas element or Node-compatible 2D context mock for telemetry rendering.
 */
function createTelemetryCanvas(width = 512, height = 256): { canvas: any; ctx: any } {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    return { canvas, ctx };
  }

  // Headless / Node test fallback
  const mockCtx = {
    fillStyle: '#000000',
    strokeStyle: '#ffffff',
    lineWidth: 1,
    font: '12px sans-serif',
    textAlign: 'left',
    textBaseline: 'top',
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    fillText: () => {},
    strokeText: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    roundRect: () => {},
    measureText: (text: string) => ({ width: text.length * 8 }),
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
    save: () => {},
    restore: () => {},
  };

  const mockCanvas = {
    width,
    height,
    getContext: () => mockCtx,
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  return { canvas: mockCanvas, ctx: mockCtx };
}

/**
 * Draws the high-resolution digital telemetry dashboard screen on a 2D canvas.
 */
export function renderTelemetryCanvas(
  ctx: any,
  width: number,
  height: number,
  telemetry: LiveCockpitTelemetry
): void {
  if (!ctx) return;

  // 1. Clear background with carbon telemetry styling
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, width, height);

  // Outer border & frame
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, width - 8, height - 8);

  // Top status bar line
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(10, 42);
  ctx.lineTo(width - 10, 42);
  ctx.stroke();

  // Top header text
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('APEX TELEMETRY PRO', 16, 16);

  // Position & Lap
  const posStr = `POS ${telemetry.position || 1}/${telemetry.totalRacers || 16}`;
  const lapStr = `LAP ${telemetry.currentLap || 1}/${telemetry.totalLaps || 3}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`${posStr}  |  ${lapStr}`, width - 16, 16);

  // 2. Large Center Digital Speedometer (KPH)
  const speed = Math.round(telemetry.speedKph || 0);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 74px monospace';
  ctx.fillText(`${speed}`, width * 0.5, 62);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('KPH', width * 0.5, 142);

  // 3. Current Gear (Left block)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('GEAR', 24, 60);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 54px monospace';
  const gearText = telemetry.gear === 0 ? 'N' : String(telemetry.gear || 'N');
  ctx.fillText(gearText, 24, 82);

  // 4. Lap Delta Indicator (Right block)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('LAP DELTA', width - 24, 60);

  const delta = telemetry.lapDeltaSec || 0.0;
  const deltaColor = delta <= 0 ? '#10b981' : '#ef4444';
  const deltaSign = delta <= 0 ? '-' : '+';
  const deltaStr = `${deltaSign}${Math.abs(delta).toFixed(2)}s`;
  ctx.fillStyle = deltaColor;
  ctx.font = 'bold 28px monospace';
  ctx.fillText(deltaStr, width - 24, 82);

  // 5. Dynamic RPM Horizontal Bar (100px .. 412px)
  const barY = 168;
  const barHeight = 22;
  const barX = 20;
  const barW = width - 40;

  // Background RPM track
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(barX, barY, barW, barHeight);

  // Active RPM fill
  const maxRpm = Math.max(telemetry.maxRpm || 9000, 1000);
  const currentRpm = Math.max(0, Math.min(maxRpm, telemetry.rpm || 0));
  const rpmRatio = currentRpm / maxRpm;
  const fillWidth = barW * rpmRatio;

  // Gradient fill (Cyan -> Yellow -> Red at 88%+)
  let fillColor = '#00f0ff';
  if (rpmRatio > 0.88) {
    fillColor = '#ff0033';
  } else if (rpmRatio > 0.75) {
    fillColor = '#ffbb00';
  }
  ctx.fillStyle = fillColor;
  ctx.fillRect(barX, barY, fillWidth, barHeight);

  // RPM Tick marks
  ctx.strokeStyle = '#080c14';
  ctx.lineWidth = 2;
  const ticks = 10;
  for (let t = 1; t < ticks; t++) {
    const tx = barX + (barW / ticks) * t;
    ctx.beginPath();
    ctx.moveTo(tx, barY);
    ctx.lineTo(tx, barY + barHeight);
    ctx.stroke();
  }

  // Numerical RPM label
  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px monospace';
  ctx.fillText(`RPM ${Math.round(currentRpm)} / ${maxRpm}`, barX, barY + 28);

  // 6. Bottom Status Badges: Nitro % and DRS Status
  const botY = 222;
  ctx.font = 'bold 14px monospace';

  // Nitro bar
  const nitro = Math.round(telemetry.nitroPercent || 0);
  ctx.fillStyle = nitro > 30 ? '#00f0ff' : '#64748b';
  ctx.fillText(`NITRO ${nitro}%`, 24, botY);

  // DRS Status
  if (telemetry.drsActive) {
    ctx.fillStyle = '#10b981';
    ctx.fillText('DRS ACTIVE', 200, botY);
  } else {
    ctx.fillStyle = '#475569';
    ctx.fillText('DRS OFF', 200, botY);
  }

  // Brake Temp Indicator (turns orange/red as it approaches 1000C)
  const brakeTemp = Math.round(telemetry.brakeTempCelsius || 25);
  const brakeColor = brakeTemp > 650 ? '#ff3b00' : brakeTemp > 300 ? '#ffaa00' : '#64748b';
  ctx.fillStyle = brakeColor;
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${brakeTemp}°C`, width - 20, botY);
}

/**
 * Builds the complete 3D Cockpit interior, framed automotive glass, and digital telemetry dashboard.
 */
export function buildCockpitInterior(spec: VehicleSpec): CockpitInteriorInstance {
  const rootGroup = new THREE.Group();
  rootGroup.name = `CockpitInterior_${spec.id}`;

  const isTwoWheeler =
    spec.archetype === 'SCOOTER_BIKE' ||
    spec.id === 'scooter' ||
    spec.id === 'bike' ||
    spec.id === 'cyber_bike';

  const isOpenWheelRacer =
    spec.archetype === 'OPEN_WHEEL_KART' ||
    spec.id === 'f1' ||
    spec.id === 'indy_open' ||
    spec.id === 'kart_shifter' ||
    spec.id === 'ariel_exo';

  const isTruckOrBus =
    spec.archetype === 'HEAVY_COMMERCIAL' ||
    spec.id === 'semi_rig' ||
    spec.id === 'bus' ||
    spec.id === 'swat_armored';

  const isCenterCockpit =
    isOpenWheelRacer ||
    isTwoWheeler ||
    spec.archetype === 'SUPERSONIC_CONCEPT' ||
    spec.id === 'fan_car' ||
    spec.id === 'jet_thrust';

  let driverX = isCenterCockpit ? 0.0 : -0.38;
  let driverY = 0.55;
  let driverZ = 0.15;

  if (isTruckOrBus) {
    driverY = 1.05;
    driverZ = 0.35;
    driverX = spec.id === 'bus' ? -0.55 : -0.48;
  } else if (isTwoWheeler) {
    driverY = 0.48;
    driverZ = -0.15;
  } else if (spec.id === 'kart_shifter') {
    driverY = 0.22;
    driverZ = 0.05;
  }

  // ==========================================================================
  // 1. FRAMED AUTOMOTIVE GLASS & STRUCTURAL PILLARS
  // ==========================================================================
  const glassGroup = new THREE.Group();
  glassGroup.name = 'FramedAutomotiveGlass';

  const windshieldMaterial = createRefractiveGlassMaterial({
    ior: 1.52,
    chromaticDispersion: 0.02,
    glassRoughness: 0.02,
    tintColor: 0x86f0ff,
    transmission: 0.92,
    wetness: 0.25,
  });

  const sideGlassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x90c0d8,
    transparent: true,
    opacity: isTwoWheeler || isOpenWheelRacer ? 0.15 : 0.35,
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.88,
    ior: 1.52,
    depthWrite: false,
  });

  const pillarMat = new THREE.MeshStandardMaterial({
    color: spec.defaultPrimaryColor,
    roughness: 0.25,
    metalness: 0.8,
  });

  const blackPillarMat = new THREE.MeshStandardMaterial({
    color: 0x080808,
    roughness: 0.1,
    metalness: 0.9,
  });

  let windshieldMesh: THREE.Mesh;
  let leftWindowMesh: THREE.Mesh;
  let rightWindowMesh: THREE.Mesh;
  let rearBackglassMesh: THREE.Mesh;
  let aPillarsMesh: THREE.Mesh;
  let bcPillarsMesh: THREE.Mesh;
  let beltlineTrimMesh: THREE.Mesh;

  if (isTwoWheeler) {
    // 2-Wheel Scooter / Bike Handlebar Windscreen Cowl & Mini Deflectors
    const cowlGeo = new THREE.PlaneGeometry(0.36, 0.28, 6, 4);
    cowlGeo.rotateX(-Math.PI * 0.22);
    windshieldMesh = new THREE.Mesh(cowlGeo, windshieldMaterial);
    windshieldMesh.name = 'Windshield';
    windshieldMesh.position.set(0, 0.92, 0.52);
    glassGroup.add(windshieldMesh);

    // Left & Right Hand Aero Guards
    const guardGeo = new THREE.PlaneGeometry(0.18, 0.12, 4, 2);
    leftWindowMesh = new THREE.Mesh(guardGeo, sideGlassMaterial);
    leftWindowMesh.name = 'LeftDoorWindow';
    leftWindowMesh.position.set(-0.32, 0.86, 0.44);
    glassGroup.add(leftWindowMesh);

    rightWindowMesh = new THREE.Mesh(guardGeo.clone(), sideGlassMaterial);
    rightWindowMesh.name = 'RightDoorWindow';
    rightWindowMesh.position.set(0.32, 0.86, 0.44);
    glassGroup.add(rightWindowMesh);

    // Aerodynamic Tail Cowl Plate
    const tailPlateGeo = new THREE.PlaneGeometry(0.24, 0.22, 4, 4);
    tailPlateGeo.rotateX(Math.PI * 0.35);
    rearBackglassMesh = new THREE.Mesh(tailPlateGeo, sideGlassMaterial);
    rearBackglassMesh.name = 'RearBackglass';
    rearBackglassMesh.position.set(0, 0.68, -0.65);
    glassGroup.add(rearBackglassMesh);

    // Front fork upper stanchion struts
    const forkStrutGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.68, 8);
    aPillarsMesh = new THREE.Mesh(forkStrutGeo, blackPillarMat);
    aPillarsMesh.name = 'A_Pillars';
    aPillarsMesh.rotation.x = -0.32;
    aPillarsMesh.position.set(-0.08, 0.62, 0.48);
    glassGroup.add(aPillarsMesh);

    const rightForkStrut = new THREE.Mesh(forkStrutGeo, blackPillarMat);
    rightForkStrut.rotation.x = -0.32;
    rightForkStrut.position.set(0.08, 0.62, 0.48);
    glassGroup.add(rightForkStrut);

    // Frame trellis strut
    const trellisGeo = new THREE.BoxGeometry(0.04, 0.42, 0.04);
    bcPillarsMesh = new THREE.Mesh(trellisGeo, blackPillarMat);
    bcPillarsMesh.name = 'BC_Pillars';
    bcPillarsMesh.position.set(-0.16, 0.45, -0.15);
    glassGroup.add(bcPillarsMesh);

    // Chassis frame rail
    const railGeo = new THREE.BoxGeometry(0.03, 0.025, 0.85);
    beltlineTrimMesh = new THREE.Mesh(railGeo, blackPillarMat);
    beltlineTrimMesh.name = 'BeltlineTrim';
    beltlineTrimMesh.position.set(-0.18, 0.32, 0.05);
    glassGroup.add(beltlineTrimMesh);
  } else if (isOpenWheelRacer) {
    // Open-Wheel Racers (F1, IndyCar, Ariel Atom, Shifter Kart)
    const deflectorGeo = new THREE.PlaneGeometry(0.62, 0.24, 6, 4);
    deflectorGeo.rotateX(-Math.PI * 0.38);
    windshieldMesh = new THREE.Mesh(deflectorGeo, windshieldMaterial);
    windshieldMesh.name = 'Windshield';
    windshieldMesh.position.set(0, 0.72, 0.58);
    glassGroup.add(windshieldMesh);

    // Cockpit head safety surround pads
    const sidePadGeo = new THREE.PlaneGeometry(0.48, 0.22, 4, 2);
    leftWindowMesh = new THREE.Mesh(sidePadGeo, sideGlassMaterial);
    leftWindowMesh.name = 'LeftDoorWindow';
    leftWindowMesh.rotation.y = -Math.PI / 2;
    leftWindowMesh.position.set(-0.35, 0.72, 0.12);
    glassGroup.add(leftWindowMesh);

    rightWindowMesh = new THREE.Mesh(sidePadGeo.clone(), sideGlassMaterial);
    rightWindowMesh.name = 'RightDoorWindow';
    rightWindowMesh.rotation.y = Math.PI / 2;
    rightWindowMesh.position.set(0.35, 0.72, 0.12);
    glassGroup.add(rightWindowMesh);

    // Cockpit rear engine bulkhead
    const bulkheadGeo = new THREE.PlaneGeometry(0.68, 0.45, 6, 4);
    bulkheadGeo.rotateX(Math.PI * 0.22);
    rearBackglassMesh = new THREE.Mesh(bulkheadGeo, sideGlassMaterial);
    rearBackglassMesh.name = 'RearBackglass';
    rearBackglassMesh.position.set(0, 0.78, -0.42);
    glassGroup.add(rearBackglassMesh);

    // Titanium HALO Central Forward Support Pillar
    const haloStemGeo = new THREE.CylinderGeometry(0.026, 0.032, 0.52, 10);
    aPillarsMesh = new THREE.Mesh(haloStemGeo, blackPillarMat);
    aPillarsMesh.name = 'A_Pillars';
    aPillarsMesh.rotation.x = -0.22;
    aPillarsMesh.position.set(0, 0.78, 0.42);
    glassGroup.add(aPillarsMesh);

    // Rear HALO mount / airbox structure
    const haloRearGeo = new THREE.BoxGeometry(0.06, 0.32, 0.06);
    bcPillarsMesh = new THREE.Mesh(haloRearGeo, blackPillarMat);
    bcPillarsMesh.name = 'BC_Pillars';
    bcPillarsMesh.position.set(-0.32, 0.78, -0.12);
    glassGroup.add(bcPillarsMesh);

    // Carbon cockpit monocoque coaming rim
    const rimCoamingGeo = new THREE.BoxGeometry(0.03, 0.02, 1.15);
    beltlineTrimMesh = new THREE.Mesh(rimCoamingGeo, blackPillarMat);
    beltlineTrimMesh.name = 'BeltlineTrim';
    beltlineTrimMesh.position.set(-0.36, 0.58, 0.08);
    glassGroup.add(beltlineTrimMesh);
  } else if (isTruckOrBus) {
    // Heavy Commercial & Trucks (High Cab, Flat Panoramic Windshield)
    const truckWindshieldGeo = new THREE.PlaneGeometry(2.15, 1.15, 8, 6);
    truckWindshieldGeo.rotateX(-Math.PI * 0.15);
    windshieldMesh = new THREE.Mesh(truckWindshieldGeo, windshieldMaterial);
    windshieldMesh.name = 'Windshield';
    windshieldMesh.position.set(0, 1.62, 1.18);
    glassGroup.add(windshieldMesh);

    // Tall commercial side cab windows
    const truckSideGeo = new THREE.PlaneGeometry(1.35, 0.75, 6, 4);
    leftWindowMesh = new THREE.Mesh(truckSideGeo, sideGlassMaterial);
    leftWindowMesh.name = 'LeftDoorWindow';
    leftWindowMesh.rotation.y = -Math.PI / 2;
    leftWindowMesh.position.set(-1.08, 1.58, 0.35);
    glassGroup.add(leftWindowMesh);

    rightWindowMesh = new THREE.Mesh(truckSideGeo.clone(), sideGlassMaterial);
    rightWindowMesh.name = 'RightDoorWindow';
    rightWindowMesh.rotation.y = Math.PI / 2;
    rightWindowMesh.position.set(1.08, 1.58, 0.35);
    glassGroup.add(rightWindowMesh);

    // Rear cab window
    const truckRearGeo = new THREE.PlaneGeometry(1.65, 0.65, 6, 4);
    rearBackglassMesh = new THREE.Mesh(truckRearGeo, sideGlassMaterial);
    rearBackglassMesh.name = 'RearBackglass';
    rearBackglassMesh.position.set(0, 1.65, -0.85);
    glassGroup.add(rearBackglassMesh);

    // Heavy vertical commercial A-pillars
    const truckPillarGeo = new THREE.CylinderGeometry(0.045, 0.055, 1.35, 8);
    aPillarsMesh = new THREE.Mesh(truckPillarGeo, pillarMat);
    aPillarsMesh.name = 'A_Pillars';
    aPillarsMesh.rotation.z = -0.15;
    aPillarsMesh.position.set(-1.04, 1.62, 1.12);
    glassGroup.add(aPillarsMesh);

    const rightTruckPillar = new THREE.Mesh(truckPillarGeo, pillarMat);
    rightTruckPillar.rotation.z = 0.15;
    rightTruckPillar.position.set(1.04, 1.62, 1.12);
    glassGroup.add(rightTruckPillar);

    const truckBGeo = new THREE.BoxGeometry(0.08, 0.75, 0.08);
    bcPillarsMesh = new THREE.Mesh(truckBGeo, blackPillarMat);
    bcPillarsMesh.name = 'BC_Pillars';
    bcPillarsMesh.position.set(-1.08, 1.58, -0.25);
    glassGroup.add(bcPillarsMesh);

    const truckBeltGeo = new THREE.BoxGeometry(0.04, 0.03, 1.55);
    beltlineTrimMesh = new THREE.Mesh(truckBeltGeo, blackPillarMat);
    beltlineTrimMesh.name = 'BeltlineTrim';
    beltlineTrimMesh.position.set(-1.08, 1.22, 0.35);
    glassGroup.add(beltlineTrimMesh);
  } else {
    // Standard Enclosed Sports, GT3, Supercars & Muscle
    const windshieldGeo = new THREE.PlaneGeometry(1.42, 0.85, 8, 6);
    windshieldGeo.rotateX(-Math.PI * 0.32);
    windshieldMesh = new THREE.Mesh(windshieldGeo, windshieldMaterial);
    windshieldMesh.name = 'Windshield';
    windshieldMesh.position.set(0, 0.92, 0.65);
    glassGroup.add(windshieldMesh);

    const sideWindowGeo = new THREE.PlaneGeometry(1.25, 0.45, 6, 4);
    const posAttr = sideWindowGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      if (y > 0) {
        posAttr.setZ(i, posAttr.getZ(i) + (y / 0.45) * 0.08);
      }
    }
    sideWindowGeo.computeVertexNormals();

    leftWindowMesh = new THREE.Mesh(sideWindowGeo, sideGlassMaterial);
    leftWindowMesh.name = 'LeftDoorWindow';
    leftWindowMesh.rotation.y = -Math.PI / 2;
    leftWindowMesh.position.set(-0.76, 0.88, 0.1);
    glassGroup.add(leftWindowMesh);

    rightWindowMesh = new THREE.Mesh(sideWindowGeo.clone(), sideGlassMaterial);
    rightWindowMesh.name = 'RightDoorWindow';
    rightWindowMesh.rotation.y = Math.PI / 2;
    rightWindowMesh.position.set(0.76, 0.88, 0.1);
    glassGroup.add(rightWindowMesh);

    const rearGlassGeo = new THREE.PlaneGeometry(1.3, 0.72, 6, 4);
    rearGlassGeo.rotateX(Math.PI * 0.28);
    rearBackglassMesh = new THREE.Mesh(rearGlassGeo, sideGlassMaterial);
    rearBackglassMesh.name = 'RearBackglass';
    rearBackglassMesh.position.set(0, 0.95, -0.68);
    glassGroup.add(rearBackglassMesh);

    const aPillarGeo = new THREE.CylinderGeometry(0.025, 0.035, 1.05, 8);
    aPillarsMesh = new THREE.Mesh(aPillarGeo, pillarMat);
    aPillarsMesh.name = 'A_Pillars';
    aPillarsMesh.rotation.z = -0.35;
    aPillarsMesh.rotation.x = 0.55;
    aPillarsMesh.position.set(-0.72, 0.92, 0.62);
    glassGroup.add(aPillarsMesh);

    const aPillarRight = new THREE.Mesh(aPillarGeo, pillarMat);
    aPillarRight.rotation.z = 0.35;
    aPillarRight.rotation.x = 0.55;
    aPillarRight.position.set(0.72, 0.92, 0.62);
    glassGroup.add(aPillarRight);

    const bcPillarGeo = new THREE.BoxGeometry(0.06, 0.48, 0.05);
    bcPillarsMesh = new THREE.Mesh(bcPillarGeo, blackPillarMat);
    bcPillarsMesh.name = 'BC_Pillars';
    bcPillarsMesh.position.set(-0.77, 0.88, -0.05);
    glassGroup.add(bcPillarsMesh);

    const bcPillarRight = new THREE.Mesh(bcPillarGeo, blackPillarMat);
    bcPillarRight.position.set(0.77, 0.88, -0.05);
    glassGroup.add(bcPillarRight);

    const beltlineGeo = new THREE.BoxGeometry(0.03, 0.02, 1.35);
    beltlineTrimMesh = new THREE.Mesh(beltlineGeo, blackPillarMat);
    beltlineTrimMesh.name = 'BeltlineTrim';
    beltlineTrimMesh.position.set(-0.77, 0.66, 0.05);
    glassGroup.add(beltlineTrimMesh);

    const beltlineRight = new THREE.Mesh(beltlineGeo, blackPillarMat);
    beltlineRight.position.set(0.77, 0.66, 0.05);
    glassGroup.add(beltlineRight);
  }

  // Mid-Engine Bay Window (if transparent engine bay specified)
  let engineBayWindowMesh: THREE.Mesh | undefined;
  if (spec.hasTransparentEngineBay) {
    const engineCoverGeo = new THREE.PlaneGeometry(1.05, 0.95, 6, 4);
    engineCoverGeo.rotateX(Math.PI * 0.12);
    engineBayWindowMesh = new THREE.Mesh(engineCoverGeo, sideGlassMaterial);
    engineBayWindowMesh.name = 'MidEngineBayWindow';
    engineBayWindowMesh.position.set(0, 0.78, -1.35);
    glassGroup.add(engineBayWindowMesh);
  }

  // Dual Windshield Wipers (or aerodynamic single blade for open-wheel/bike)
  const wiperMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.4,
    metalness: 0.8,
  });

  const leftWiper = new THREE.Group();
  leftWiper.name = 'LeftWiper';
  leftWiper.position.set(-0.35, 0.65, 0.98);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.48, 0.01), wiperMat);
  leftArm.position.set(0.08, 0.22, 0);
  leftArm.rotation.z = -0.35;
  leftWiper.add(leftArm);

  const leftBlade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.52, 0.008), wiperMat);
  leftBlade.position.set(0.18, 0.26, 0.01);
  leftBlade.rotation.z = -0.32;
  leftWiper.add(leftBlade);

  const rightWiper = new THREE.Group();
  rightWiper.name = 'RightWiper';
  rightWiper.position.set(0.25, 0.65, 0.98);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.48, 0.01), wiperMat);
  rightArm.position.set(0.08, 0.22, 0);
  rightArm.rotation.z = -0.35;
  rightWiper.add(rightArm);

  const rightBlade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.52, 0.008), wiperMat);
  rightBlade.position.set(0.18, 0.26, 0.01);
  rightBlade.rotation.z = -0.32;
  rightWiper.add(rightBlade);

  glassGroup.add(leftWiper);
  glassGroup.add(rightWiper);

  // Interior Rearview Mirror / Cockpit Display Mirror
  const interiorRearviewMirror = new THREE.Group();
  interiorRearviewMirror.name = 'InteriorRearviewMirror';
  interiorRearviewMirror.position.set(0, 1.12, 0.52);
  const mirrorHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.065, 0.03),
    blackPillarMat
  );
  const mirrorGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.055),
    new THREE.MeshStandardMaterial({ color: 0xccddee, metalness: 0.98, roughness: 0.05 })
  );
  mirrorGlass.position.z = -0.016;
  mirrorGlass.rotation.y = Math.PI;
  interiorRearviewMirror.add(mirrorHousing);
  interiorRearviewMirror.add(mirrorGlass);
  glassGroup.add(interiorRearviewMirror);

  // Left & Right Aerodynamic Wing Mirrors
  const leftWingMirror = new THREE.Group();
  leftWingMirror.name = 'LeftWingMirror';
  leftWingMirror.position.set(-0.84, 0.76, 0.42);
  leftWingMirror.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.12), pillarMat));
  glassGroup.add(leftWingMirror);

  const rightWingMirror = new THREE.Group();
  rightWingMirror.name = 'RightWingMirror';
  rightWingMirror.position.set(0.84, 0.76, 0.42);
  rightWingMirror.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.12), pillarMat));
  glassGroup.add(rightWingMirror);

  rootGroup.add(glassGroup);

  // ==========================================================================
  // 2. PLAYABLE 3D COCKPIT INTERIOR (DASHBOARD & TELEMETRY SCREEN)
  // ==========================================================================
  const dashboardGroup = new THREE.Group();
  dashboardGroup.name = 'Dashboard';

  const carbonDashMat = new THREE.MeshStandardMaterial({
    color: 0x16181d,
    roughness: 0.35,
    metalness: 0.45,
  });

  // Main Dashboard Cowl & Console
  const dashWidth = isTwoWheeler ? 0.44 : isOpenWheelRacer ? 0.72 : isTruckOrBus ? 2.15 : 1.48;
  const dashY = isTruckOrBus ? 1.25 : driverY + 0.12;
  const dashZ = isTruckOrBus ? 0.95 : driverZ + 0.48;

  const dashMesh = new THREE.Mesh(
    new THREE.BoxGeometry(dashWidth, 0.28, 0.65),
    carbonDashMat
  );
  dashMesh.name = 'DashboardCowl';
  dashMesh.position.set(0, dashY, dashZ);
  dashboardGroup.add(dashMesh);

  // 3D Digital Telemetry Screen
  const { canvas, ctx } = createTelemetryCanvas(512, 256);
  renderTelemetryCanvas(ctx, 512, 256, {
    speedKph: 0,
    rpm: 850,
    maxRpm: spec.redlineRpm,
    gear: 'N',
    lapDeltaSec: 0.0,
    currentLap: 1,
    totalLaps: 3,
    position: 1,
    totalRacers: 16,
    nitroPercent: 100,
    drsActive: false,
    brakeTempCelsius: 25,
    sectorSplits: [null, null, null],
  });

  const telemetryTexture = new THREE.CanvasTexture(canvas);
  telemetryTexture.name = `TelemetryTex_${spec.id}`;
  telemetryTexture.colorSpace = THREE.SRGBColorSpace;

  const telemetryScreenMat = new THREE.MeshBasicMaterial({
    map: telemetryTexture,
    depthWrite: false,
  });

  const screenGeo = new THREE.PlaneGeometry(0.32, 0.16);
  screenGeo.rotateX(-0.25);
  const telemetryScreenMesh = new THREE.Mesh(screenGeo, telemetryScreenMat);
  telemetryScreenMesh.name = 'LiveTelemetryScreen';
  telemetryScreenMesh.position.set(driverX, dashY + 0.12, dashZ - 0.12);
  dashboardGroup.add(telemetryScreenMesh);

  // ==========================================================================
  // 3. ADAPTIVE STEERING WHEEL WITH SHIFT LED ARRAY
  // ==========================================================================
  const steeringColumnGroup = new THREE.Group();
  steeringColumnGroup.name = 'SteeringColumn';
  steeringColumnGroup.position.set(driverX, dashY + 0.02, dashZ - 0.22);

  const columnShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.25, 12),
    carbonDashMat
  );
  columnShaft.rotation.x = isTruckOrBus ? Math.PI * 0.25 : Math.PI * 0.38;
  steeringColumnGroup.add(columnShaft);

  const steeringWheelGroup = new THREE.Group();
  steeringWheelGroup.name = 'SteeringWheelGroup';
  steeringWheelGroup.position.set(0, 0.08, -0.06);
  steeringWheelGroup.rotation.x = isTruckOrBus ? -Math.PI * 0.28 : -Math.PI * 0.12;

  let steeringWheelMesh: THREE.Mesh;
  const shiftLeds: THREE.Mesh[] = [];
  const shiftLedMaterials: THREE.MeshBasicMaterial[] = [];
  const ledCount = 9;

  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.65,
    metalness: 0.2,
  });

  if (isTwoWheeler) {
    // Motorcycle Handlebars with Grips & Levers
    const barClampGeo = new THREE.TorusGeometry(0.038, 0.016, 12, 16);
    steeringWheelMesh = new THREE.Mesh(barClampGeo, wheelMat);
    steeringWheelMesh.name = 'SteeringWheel';
    steeringWheelGroup.add(steeringWheelMesh);

    // Left and Right Handlebar Tubes
    const barTubeGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.68, 12);
    barTubeGeo.rotateZ(Math.PI / 2);
    const barTube = new THREE.Mesh(barTubeGeo, carbonDashMat);
    steeringWheelGroup.add(barTube);

    // Rubber Handgrips
    for (const side of [-1, 1]) {
      const gripGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.14, 12);
      gripGeo.rotateZ(Math.PI / 2);
      const grip = new THREE.Mesh(gripGeo, wheelMat);
      grip.position.set(side * 0.26, 0, 0);
      steeringWheelGroup.add(grip);

      // Aluminum Brake / Clutch Levers
      const leverGeo = new THREE.BoxGeometry(0.12, 0.012, 0.015);
      const lever = new THREE.Mesh(leverGeo, blackPillarMat);
      lever.position.set(side * 0.22, -0.02, 0.04);
      lever.rotation.z = side * 0.15;
      steeringWheelGroup.add(lever);
    }
  } else if (isOpenWheelRacer) {
    // Formula 1 & IndyCar Carbon Butterfly Yoke
    const yokeGeo = new THREE.BoxGeometry(0.24, 0.16, 0.025);
    steeringWheelMesh = new THREE.Mesh(yokeGeo, carbonDashMat);
    steeringWheelMesh.name = 'SteeringWheel';
    steeringWheelGroup.add(steeringWheelMesh);

    // Contoured Alcantara Handgrips
    for (const side of [-1, 1]) {
      const gripGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.16, 12);
      const grip = new THREE.Mesh(gripGeo, wheelMat);
      grip.position.set(side * 0.12, 0, 0);
      steeringWheelGroup.add(grip);
    }
  } else if (isTruckOrBus) {
    // Large Commercial Truck Steering Wheel (radius 0.24m)
    const truckWheelGeo = new THREE.TorusGeometry(0.24, 0.022, 12, 32);
    steeringWheelMesh = new THREE.Mesh(truckWheelGeo, wheelMat);
    steeringWheelMesh.name = 'SteeringWheel';
    steeringWheelGroup.add(steeringWheelMesh);

    const spokeCrossGeo = new THREE.BoxGeometry(0.44, 0.035, 0.018);
    steeringWheelGroup.add(new THREE.Mesh(spokeCrossGeo, wheelMat));
  } else {
    // Standard Sports / Supercar Racing Wheel
    const wheelRimGeo = new THREE.TorusGeometry(0.16, 0.016, 12, 32);
    steeringWheelMesh = new THREE.Mesh(wheelRimGeo, wheelMat);
    steeringWheelMesh.name = 'SteeringWheel';
    steeringWheelGroup.add(steeringWheelMesh);

    const spokeGeo = new THREE.BoxGeometry(0.28, 0.025, 0.01);
    steeringWheelGroup.add(new THREE.Mesh(spokeGeo, carbonDashMat));
  }

  // Shift LEDs (9 LEDs across top rim)
  for (let i = 0; i < ledCount; i++) {
    let initialColor = 0x004411;
    if (i >= 3 && i <= 5) initialColor = 0x443300;
    else if (i >= 6 && i <= 7) initialColor = 0x440000;
    else if (i === 8) initialColor = 0x001144;

    const ledMat = new THREE.MeshBasicMaterial({ color: initialColor });
    const ledMesh = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 8), ledMat);
    ledMesh.name = `ShiftLED_${i}`;

    const angle = -0.55 + (i / (ledCount - 1)) * 1.1;
    ledMesh.position.set(Math.sin(angle) * 0.13, Math.cos(angle) * 0.13, 0.015);
    steeringWheelGroup.add(ledMesh);

    shiftLeds.push(ledMesh);
    shiftLedMaterials.push(ledMat);
  }

  steeringColumnGroup.add(steeringWheelGroup);
  dashboardGroup.add(steeringColumnGroup);
  rootGroup.add(dashboardGroup);

  // ==========================================================================
  // 4. BOLSTERED RACING SEATS, HARNESS & DRIVER HELMET
  // ==========================================================================
  const seatMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c22,
    roughness: 0.8,
    metalness: 0.1,
  });

  const seatGroup = new THREE.Group();
  seatGroup.name = 'RacingSeats';

  function createSeat(xPos: number, isDriver: boolean): THREE.Group {
    const seat = new THREE.Group();
    seat.name = isDriver ? 'DriverSeat' : 'PassengerSeat';
    seat.position.set(xPos, driverY, driverZ);

    if (isTwoWheeler) {
      // Motorcycle / Scooter Saddle
      const saddleGeo = new THREE.BoxGeometry(0.32, 0.14, 0.72);
      const saddle = new THREE.Mesh(saddleGeo, seatMat);
      seat.add(saddle);
    } else {
      // Cushion
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.48), seatMat);
      seat.add(cushion);

      // Backrest
      const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.65, 0.12), seatMat);
      backrest.position.set(0, 0.35, -0.22);
      backrest.rotation.x = -0.15;
      seat.add(backrest);

      // Headrest
      const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.1), seatMat);
      headrest.position.set(0, 0.72, -0.27);
      seat.add(headrest);
    }

    return seat;
  }

  const driverSeat = createSeat(driverX, true);
  seatGroup.add(driverSeat);

  let passengerSeat: THREE.Group | undefined;
  if (!isCenterCockpit) {
    passengerSeat = createSeat(-driverX, false);
    seatGroup.add(passengerSeat);
  }

  // 5-Point Harness Belts (Red / Racing)
  const harnessMat = new THREE.MeshStandardMaterial({
    color: 0xd4001a,
    roughness: 0.7,
  });
  const harnessBelts: THREE.Mesh[] = [];

  const leftShoulderBelt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.015), harnessMat);
  leftShoulderBelt.position.set(driverX - 0.08, driverY + 0.34, driverZ - 0.12);
  leftShoulderBelt.rotation.x = -0.15;
  seatGroup.add(leftShoulderBelt);
  harnessBelts.push(leftShoulderBelt);

  const rightShoulderBelt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.015), harnessMat);
  rightShoulderBelt.position.set(driverX + 0.08, driverY + 0.34, driverZ - 0.12);
  rightShoulderBelt.rotation.x = -0.15;
  seatGroup.add(rightShoulderBelt);
  harnessBelts.push(rightShoulderBelt);

  // Driver Helmet on Driver Seat
  const helmetMat = new THREE.MeshStandardMaterial({
    color: 0xf4f3ee,
    roughness: 0.15,
    metalness: 0.85,
  });
  const helmetVisorMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    roughness: 0.05,
    metalness: 0.95,
  });

  const helmetGroup = new THREE.Group();
  helmetGroup.name = 'DriverHelmetGroup';
  helmetGroup.position.set(driverX, driverY + 0.65, driverZ - 0.08);

  const helmetSphere = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), helmetMat);
  helmetGroup.add(helmetSphere);

  const visor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16, 1, false, 0, Math.PI),
    helmetVisorMat
  );
  visor.rotation.y = Math.PI / 2;
  visor.position.set(0, 0, 0.04);
  helmetGroup.add(visor);

  seatGroup.add(helmetGroup);
  rootGroup.add(seatGroup);

  // ==========================================================================
  // 5. TUBULAR ROLL CAGE / HALO STRUCTURE
  // ==========================================================================
  const rollCageGroup = new THREE.Group();
  rollCageGroup.name = 'TubularRollCage';

  const cageMat = new THREE.MeshStandardMaterial({
    color: 0x8892b0,
    roughness: 0.3,
    metalness: 0.9,
  });

  const barRadius = 0.022;
  const mainHoopGeo = new THREE.CylinderGeometry(barRadius, barRadius, 1.45, 8);
  mainHoopGeo.rotateZ(Math.PI / 2);
  const mainHoop = new THREE.Mesh(mainHoopGeo, cageMat);
  mainHoop.position.set(0, driverY + 0.60, driverZ - 0.45);
  rollCageGroup.add(mainHoop);

  const diagGeo = new THREE.CylinderGeometry(barRadius, barRadius, 1.35, 8);
  diagGeo.rotateZ(0.68);
  const diagBar = new THREE.Mesh(diagGeo, cageMat);
  diagBar.position.set(0, driverY + 0.20, driverZ - 0.45);
  rollCageGroup.add(diagBar);

  rootGroup.add(rollCageGroup);

  // ==========================================================================
  // 6. 3D MODELED ENGINE BLOCK (IF MID-ENGINE / TRANSPARENT COVER)
  // ==========================================================================
  let engineBlockGroup: THREE.Group | undefined;
  if (spec.hasTransparentEngineBay) {
    engineBlockGroup = new THREE.Group();
    engineBlockGroup.name = '3D_EngineBlock';
    engineBlockGroup.position.set(0, 0.52, -1.35);

    const metalEngineMat = new THREE.MeshStandardMaterial({
      color: 0x333842,
      roughness: 0.4,
      metalness: 0.85,
    });
    const redValveMat = new THREE.MeshStandardMaterial({
      color: 0xd4001a,
      roughness: 0.25,
      metalness: 0.65,
    });

    const crankcase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.75), metalEngineMat);
    engineBlockGroup.add(crankcase);

    const leftValve = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.68), redValveMat);
    leftValve.position.set(-0.22, 0.22, 0);
    leftValve.rotation.z = -0.35;
    engineBlockGroup.add(leftValve);

    const rightValve = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.68), redValveMat);
    rightValve.position.set(0.22, 0.22, 0);
    rightValve.rotation.z = 0.35;
    engineBlockGroup.add(rightValve);

    const intakePlenum = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.52), metalEngineMat);
    intakePlenum.position.set(0, 0.26, 0);
    engineBlockGroup.add(intakePlenum);

    rootGroup.add(engineBlockGroup);
  }

  // ==========================================================================
  // 7. FIRST-PERSON EYEPOINT CAMERA ANCHOR (CAMERA MODE: COCKPIT)
  // ==========================================================================
  const cockpitCameraAnchor = new THREE.Object3D();
  cockpitCameraAnchor.name = 'CockpitCameraAnchor';
  const anchorY = Math.max(1.10, driverY + 0.68);
  cockpitCameraAnchor.position.set(driverX, anchorY, driverZ + 0.05);
  rootGroup.add(cockpitCameraAnchor);

  return {
    rootGroup,
    spec,
    glassGroup,
    windshieldMesh,
    windshieldMaterial,
    leftWindowMesh,
    rightWindowMesh,
    rearBackglassMesh,
    engineBayWindowMesh,
    wipers: {
      leftWiper,
      rightWiper,
      wiperBlades: [leftBlade, rightBlade],
      wiperAngleRad: 0.18,
    },
    aPillarsMesh,
    bcPillarsMesh,
    beltlineTrimMesh,
    interiorRearviewMirror,
    leftWingMirror,
    rightWingMirror,
    dashboardGroup,
    telemetryScreenMesh,
    telemetryCanvas: canvas,
    telemetryContext: ctx,
    telemetryTexture,
    steeringColumnGroup,
    steeringWheelGroup,
    steeringWheelMesh,
    shiftLeds,
    shiftLedMaterials,
    seats: {
      driverSeat,
      passengerSeat,
      driverHelmet: helmetSphere,
      harnessBelts,
    },
    rollCageGroup,
    engineBlockGroup,
    cockpitCameraAnchor,
  };
}

/**
 * Updates the 3D Cockpit with live telemetry:
 * 1. Redraws the 2D canvas telemetry texture (KPH, Gear, RPM bar, Lap Delta).
 * 2. Illuminates progressive shift LEDs on the steering wheel.
 * 3. Rotates steering wheel dynamically.
 * 4. Animates windshield wipers.
 */
export function updateCockpitTelemetry(
  instance: CockpitInteriorInstance,
  telemetry: LiveCockpitTelemetry,
  deltaSec: number
): void {
  instance.lastTelemetry = telemetry;

  // 1. Redraw 2D Canvas & flag texture update
  if (instance.telemetryContext) {
    renderTelemetryCanvas(
      instance.telemetryContext,
      instance.telemetryCanvas.width,
      instance.telemetryCanvas.height,
      telemetry
    );
    instance.telemetryTexture.needsUpdate = true;
  }

  // 2. Update Shift LEDs based on RPM ratio
  const maxRpm = Math.max(telemetry.maxRpm || instance.spec.redlineRpm, 1000);
  const rpmRatio = Math.max(0, Math.min(1.0, telemetry.rpm / maxRpm));

  const ledCount = instance.shiftLeds.length; // 9 LEDs
  for (let i = 0; i < ledCount; i++) {
    const threshold = 0.65 + (i / ledCount) * 0.34;
    const isActive = rpmRatio >= threshold;
    const mat = instance.shiftLedMaterials[i];

    if (isActive) {
      if (i <= 2) {
        mat.color.setHex(0x00ff44); // Bright Green
      } else if (i <= 5) {
        mat.color.setHex(0xffcc00); // Bright Amber
      } else if (i <= 7) {
        mat.color.setHex(0xff0022); // Bright Red
      } else {
        // Redline flashing LED
        const flash = Math.sin(Date.now() * 0.03) > 0;
        mat.color.setHex(flash ? 0x00f0ff : 0x002255);
      }
    } else {
      // Dim inactive state
      if (i <= 2) mat.color.setHex(0x003311);
      else if (i <= 5) mat.color.setHex(0x332200);
      else if (i <= 7) mat.color.setHex(0x330000);
      else mat.color.setHex(0x001133);
    }
  }

  // 3. Dynamic Steering Wheel Rotation
  if (telemetry.speedKph > 5) {
    const microJitter = Math.sin(Date.now() * 0.02) * 0.015;
    instance.steeringWheelGroup.rotation.z = microJitter;
  }

  // 4. Dual Animated Wiper Sweep
  const wiperSpeed = 3.2; // sweeps per second
  const wiperPhase = (Date.now() * 0.001 * wiperSpeed) % (Math.PI * 2);
  const wiperAngle = 0.18 + Math.abs(Math.sin(wiperPhase)) * 1.15;
  instance.wipers.wiperAngleRad = wiperAngle;

  instance.wipers.leftWiper.rotation.z = wiperAngle;
  instance.wipers.rightWiper.rotation.z = wiperAngle;

  // Pass animated wiper angle to windshield refractive glass shader if supported
  if ('uniforms' in instance.windshieldMaterial) {
    const shaderMat = instance.windshieldMaterial as THREE.ShaderMaterial;
    if (shaderMat.uniforms && shaderMat.uniforms.uWiperAngleRad) {
      shaderMat.uniforms.uWiperAngleRad.value = wiperAngle;
    }
  }
}
