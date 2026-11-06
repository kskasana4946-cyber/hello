// src/vehicles/CockpitInteriorBuilder.ts
// Playable First-Person 3D Cockpit Interior & Framed Multi-Pane Glass Builder
// Apex Grand Prix: Uncapped Next-Gen Edition
//
// Features:
// 1. Framed multi-pane automotive glass & mid-engine bay window:
//    - Sloped laminated front windshield with dual animated wipers
//    - Painted A-pillars, interior rearview mirror
//    - Framed left & right door windows with inward tumblehome curvature, gloss-black B/C pillars, beltline trim, wing mirrors
//    - Sloped rear backglass + transparent mid-engine bay cover revealing 3D engine block
// 2. Playable First-Person 3D Cockpit Interior (Camera Mode: COCKPIT):
//    - 3D dashboard with live 3D Digital Telemetry Screen (KPH, Gear, RPM bar, Lap Delta rendered on canvas texture)
//    - Rotating steering wheel with shift LEDs
//    - Twin bolstered racing seats, 5-point harness belts, tubular roll cage, driver helmet
//    - First-person camera anchor placed at driver eye-height

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

  // 2. RPM Tachometer Bar (Top)
  const maxRpm = Math.max(telemetry.maxRpm || 9000, 1000);
  const currentRpm = Math.max(0, Math.min(telemetry.rpm, maxRpm));
  const rpmRatio = currentRpm / maxRpm;

  const barX = 20;
  const barY = 12;
  const barW = width - 40;
  const barH = 20;

  // Tachometer background slot
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  // Segmented RPM fill (Green -> Amber -> Redline)
  const fillW = Math.round(barW * rpmRatio);
  if (fillW > 0) {
    if (typeof ctx.createLinearGradient === 'function') {
      try {
        const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        grad.addColorStop(0.0, '#00ff88');
        grad.addColorStop(0.65, '#00f0ff');
        grad.addColorStop(0.85, '#ffbb00');
        grad.addColorStop(1.0, '#ff0033');
        ctx.fillStyle = grad;
      } catch {
        ctx.fillStyle = rpmRatio > 0.88 ? '#ff0033' : '#00ff88';
      }
    } else {
      ctx.fillStyle = rpmRatio > 0.88 ? '#ff0033' : '#00ff88';
    }
    ctx.fillRect(barX, barY, fillW, barH);
  }

  // 3. Central Speedometer (KPH)
  const speed = Math.max(0, Math.round(telemetry.speedKph));
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(speed), width / 2 - 25, 128);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('KPH', width / 2 + 55, 122);

  // 4. Large Current Gear Indicator
  ctx.fillStyle = '#00f0ff';
  ctx.font = 'bold 54px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(telemetry.gear), 75, 128);

  ctx.fillStyle = '#64748b';
  ctx.font = '14px sans-serif';
  ctx.fillText('GEAR', 75, 155);

  // 5. Lap Delta Display (Right side)
  const delta = telemetry.lapDeltaSec;
  const sign = delta > 0 ? '+' : '';
  const deltaText = `${sign}${delta.toFixed(2)}s`;
  ctx.fillStyle = delta <= 0 ? '#10b981' : '#ef4444'; // Green if ahead, red if behind
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(deltaText, width - 25, 95);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.fillText('LAP DELTA', width - 25, 115);

  // 6. Bottom Information Row: Position, Lap, Nitro, DRS, Brake Temp
  const botY = height - 38;

  // Position
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`POS ${telemetry.position}/${telemetry.totalRacers || 16}`, 20, botY);

  // Lap
  ctx.fillText(`LAP ${telemetry.currentLap}/${telemetry.totalLaps || 3}`, 160, botY);

  // Nitro Bar
  const nitroW = 60;
  const nitroRatio = Math.max(0, Math.min(100, telemetry.nitroPercent)) / 100;
  ctx.fillStyle = '#0284c7';
  ctx.fillText('NOS', 285, botY);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(325, botY - 14, nitroW, 14);
  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(325, botY - 14, nitroW * nitroRatio, 14);

  // DRS Indicator
  if (telemetry.drsActive) {
    ctx.fillStyle = '#22c55e';
    ctx.fillText('DRS OPEN', 400, botY);
  } else {
    ctx.fillStyle = '#475569';
    ctx.fillText('DRS OFF', 400, botY);
  }

  // Brake Temp Indicator (turns orange/red as it approaches 1000C)
  const brakeTemp = Math.round(telemetry.brakeTempCelsius || 25);
  const brakeColor = brakeTemp > 650 ? '#ff3b00' : brakeTemp > 300 ? '#ffaa00' : '#64748b';
  ctx.fillStyle = brakeColor;
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${brakeTemp}°C`, width - 20, botY + 18);
}

/**
 * Builds the complete 3D Cockpit interior, framed automotive glass, and digital telemetry dashboard.
 */
export function buildCockpitInterior(spec: VehicleSpec): CockpitInteriorInstance {
  const rootGroup = new THREE.Group();
  rootGroup.name = `CockpitInterior_${spec.id}`;

  const isCenterCockpit =
    spec.archetype === 'OPEN_WHEEL_KART' ||
    spec.archetype === 'SUPERSONIC_CONCEPT' ||
    spec.archetype === 'SCOOTER_BIKE';

  const driverX = isCenterCockpit ? 0.0 : -0.38;
  const driverY = 0.55;
  const driverZ = 0.15;

  // ==========================================================================
  // 1. FRAMED MULTI-PANE AUTOMOTIVE GLASS & PILLARS
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
    opacity: 0.35,
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.88,
    ior: 1.52,
    depthWrite: false,
  });

  // A. Sloped Laminated Windshield (width 1.4m, height 0.85m, tilted 38 deg)
  const windshieldGeo = new THREE.PlaneGeometry(1.42, 0.85, 8, 6);
  windshieldGeo.rotateX(-Math.PI * 0.32); // Sloped backward
  const windshieldMesh = new THREE.Mesh(windshieldGeo, windshieldMaterial);
  windshieldMesh.name = 'Windshield';
  windshieldMesh.position.set(0, 0.92, 0.65);
  glassGroup.add(windshieldMesh);

  // B. Framed Left & Right Door Windows with Inward Tumblehome Curvature
  const sideWindowGeo = new THREE.PlaneGeometry(1.25, 0.45, 6, 4);
  // Apply tumblehome (inward curve near top)
  const posAttr = sideWindowGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    if (y > 0) {
      posAttr.setZ(i, posAttr.getZ(i) + (y / 0.45) * 0.08); // curve inward
    }
  }
  sideWindowGeo.computeVertexNormals();

  const leftWindowMesh = new THREE.Mesh(sideWindowGeo, sideGlassMaterial);
  leftWindowMesh.name = 'LeftDoorWindow';
  leftWindowMesh.rotation.y = -Math.PI / 2;
  leftWindowMesh.position.set(-0.76, 0.88, 0.1);
  glassGroup.add(leftWindowMesh);

  const rightWindowMesh = new THREE.Mesh(sideWindowGeo.clone(), sideGlassMaterial);
  rightWindowMesh.name = 'RightDoorWindow';
  rightWindowMesh.rotation.y = Math.PI / 2;
  rightWindowMesh.position.set(0.76, 0.88, 0.1);
  glassGroup.add(rightWindowMesh);

  // C. Sloped Rear Backglass
  const rearGlassGeo = new THREE.PlaneGeometry(1.3, 0.72, 6, 4);
  rearGlassGeo.rotateX(Math.PI * 0.28);
  const rearBackglassMesh = new THREE.Mesh(rearGlassGeo, sideGlassMaterial);
  rearBackglassMesh.name = 'RearBackglass';
  rearBackglassMesh.position.set(0, 0.95, -0.68);
  glassGroup.add(rearBackglassMesh);

  // D. Mid-Engine Bay Window (if transparent engine bay specified)
  let engineBayWindowMesh: THREE.Mesh | undefined;
  if (spec.hasTransparentEngineBay) {
    const engineCoverGeo = new THREE.PlaneGeometry(1.05, 0.95, 6, 4);
    engineCoverGeo.rotateX(Math.PI * 0.12);
    engineBayWindowMesh = new THREE.Mesh(engineCoverGeo, sideGlassMaterial);
    engineBayWindowMesh.name = 'MidEngineBayWindow';
    engineBayWindowMesh.position.set(0, 0.78, -1.35);
    glassGroup.add(engineBayWindowMesh);
  }

  // E. Dual Windshield Wipers (Left and Right animated pivots)
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

  // F. Painted A-Pillars, Gloss-Black B/C Pillars & Beltline Trim
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

  // A-Pillars (left and right structural struts framing windshield)
  const aPillarGeo = new THREE.CylinderGeometry(0.025, 0.035, 1.05, 8);
  const aPillarsMesh = new THREE.Mesh(aPillarGeo, pillarMat);
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

  // Gloss-Black B and C Pillars
  const bcPillarGeo = new THREE.BoxGeometry(0.06, 0.48, 0.05);
  const bcPillarsMesh = new THREE.Mesh(bcPillarGeo, blackPillarMat);
  bcPillarsMesh.name = 'BC_Pillars';
  bcPillarsMesh.position.set(-0.77, 0.88, -0.05);
  glassGroup.add(bcPillarsMesh);

  const bcPillarRight = new THREE.Mesh(bcPillarGeo, blackPillarMat);
  bcPillarRight.position.set(0.77, 0.88, -0.05);
  glassGroup.add(bcPillarRight);

  // Beltline Chrome / Carbon Trim
  const beltlineGeo = new THREE.BoxGeometry(0.03, 0.02, 1.35);
  const beltlineTrimMesh = new THREE.Mesh(beltlineGeo, blackPillarMat);
  beltlineTrimMesh.name = 'BeltlineTrim';
  beltlineTrimMesh.position.set(-0.77, 0.66, 0.05);
  glassGroup.add(beltlineTrimMesh);

  const beltlineRight = new THREE.Mesh(beltlineGeo, blackPillarMat);
  beltlineRight.position.set(0.77, 0.66, 0.05);
  glassGroup.add(beltlineRight);

  // Interior Rearview Mirror
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
  const dashCowlGeo = new THREE.BoxGeometry(1.48, 0.28, 0.65);
  const dashMesh = new THREE.Mesh(dashCowlGeo, carbonDashMat);
  dashMesh.name = 'DashboardCowl';
  dashMesh.position.set(0, 0.62, 0.65);
  dashboardGroup.add(dashMesh);

  // Center Console Tunnel
  const centerConsoleGeo = new THREE.BoxGeometry(0.26, 0.24, 0.85);
  const consoleMesh = new THREE.Mesh(centerConsoleGeo, carbonDashMat);
  consoleMesh.position.set(0, 0.35, 0.15);
  dashboardGroup.add(consoleMesh);

  // 3D Digital Telemetry Screen
  const { canvas, ctx } = createTelemetryCanvas(512, 256);
  // Initial draw
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
  screenGeo.rotateX(-0.25); // Angled up toward driver
  const telemetryScreenMesh = new THREE.Mesh(screenGeo, telemetryScreenMat);
  telemetryScreenMesh.name = 'LiveTelemetryScreen';
  telemetryScreenMesh.position.set(driverX, 0.72, 0.52);
  dashboardGroup.add(telemetryScreenMesh);

  // ==========================================================================
  // 3. STEERING WHEEL WITH SHIFT LED ARRAY
  // ==========================================================================
  const steeringColumnGroup = new THREE.Group();
  steeringColumnGroup.name = 'SteeringColumn';
  steeringColumnGroup.position.set(driverX, 0.62, 0.42);

  const columnShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.25, 12),
    carbonDashMat
  );
  columnShaft.rotation.x = Math.PI * 0.38;
  steeringColumnGroup.add(columnShaft);

  const steeringWheelGroup = new THREE.Group();
  steeringWheelGroup.name = 'SteeringWheelGroup';
  steeringWheelGroup.position.set(0, 0.08, -0.06);
  steeringWheelGroup.rotation.x = -Math.PI * 0.12;

  // Wheel Rim & Hub
  const wheelRimMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.65,
    metalness: 0.2,
  });
  const wheelRimGeo = new THREE.TorusGeometry(0.16, 0.016, 12, 32);
  const steeringWheelMesh = new THREE.Mesh(wheelRimGeo, wheelRimMat);
  steeringWheelMesh.name = 'SteeringWheel';
  steeringWheelGroup.add(steeringWheelMesh);

  // Center Wheel Hub with Apex Logo
  const wheelHubGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16);
  wheelHubGeo.rotateX(Math.PI / 2);
  const wheelHub = new THREE.Mesh(wheelHubGeo, carbonDashMat);
  steeringWheelGroup.add(wheelHub);

  // Horizontal Wheel Spokes
  const spokeGeo = new THREE.BoxGeometry(0.28, 0.025, 0.01);
  const spokeMesh = new THREE.Mesh(spokeGeo, carbonDashMat);
  steeringWheelGroup.add(spokeMesh);

  // Shift LEDs (9 LEDs across top rim)
  const shiftLeds: THREE.Mesh[] = [];
  const shiftLedMaterials: THREE.MeshBasicMaterial[] = [];
  const ledCount = 9;

  for (let i = 0; i < ledCount; i++) {
    // 0..2: Green, 3..5: Yellow/Amber, 6..7: Red, 8: Bright Blue
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

  function createBolsteredSeat(xPos: number, isDriver: boolean): THREE.Group {
    const seat = new THREE.Group();
    seat.name = isDriver ? 'DriverSeat' : 'PassengerSeat';
    seat.position.set(xPos, driverY, driverZ);

    // Cushion
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.48), seatMat);
    seat.add(cushion);

    // Bolstered Backrest
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.65, 0.12), seatMat);
    backrest.position.set(0, 0.35, -0.22);
    backrest.rotation.x = -0.15;
    seat.add(backrest);

    // Headrest
    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.1), seatMat);
    headrest.position.set(0, 0.72, -0.27);
    seat.add(headrest);

    return seat;
  }

  const driverSeat = createBolsteredSeat(driverX, true);
  seatGroup.add(driverSeat);

  let passengerSeat: THREE.Group | undefined;
  if (!isCenterCockpit) {
    passengerSeat = createBolsteredSeat(-driverX, false);
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

  const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16, 1, false, 0, Math.PI), helmetVisorMat);
  visor.rotation.y = Math.PI / 2;
  visor.position.set(0, 0, 0.04);
  helmetGroup.add(visor);

  seatGroup.add(helmetGroup);
  rootGroup.add(seatGroup);

  // ==========================================================================
  // 5. TUBULAR STEEL / TITANIUM ROLL CAGE
  // ==========================================================================
  const rollCageGroup = new THREE.Group();
  rollCageGroup.name = 'TubularRollCage';

  const cageMat = new THREE.MeshStandardMaterial({
    color: 0x8892b0,
    roughness: 0.3,
    metalness: 0.9,
  });

  const barRadius = 0.022;
  // Main Roll Hoop (behind driver and passenger seats)
  const mainHoopGeo = new THREE.CylinderGeometry(barRadius, barRadius, 1.45, 8);
  mainHoopGeo.rotateZ(Math.PI / 2);
  const mainHoop = new THREE.Mesh(mainHoopGeo, cageMat);
  mainHoop.position.set(0, 1.15, -0.32);
  rollCageGroup.add(mainHoop);

  // Diagonal cross-brace
  const diagGeo = new THREE.CylinderGeometry(barRadius, barRadius, 1.35, 8);
  diagGeo.rotateZ(0.68);
  const diagBar = new THREE.Mesh(diagGeo, cageMat);
  diagBar.position.set(0, 0.72, -0.32);
  rollCageGroup.add(diagBar);

  // Roof longitudinal bars (left and right)
  const roofBarGeo = new THREE.CylinderGeometry(barRadius, barRadius, 0.85, 8);
  roofBarGeo.rotateX(Math.PI / 2);

  const leftRoofBar = new THREE.Mesh(roofBarGeo, cageMat);
  leftRoofBar.position.set(-0.68, 1.15, 0.1);
  rollCageGroup.add(leftRoofBar);

  const rightRoofBar = new THREE.Mesh(roofBarGeo, cageMat);
  rightRoofBar.position.set(0.68, 1.15, 0.1);
  rollCageGroup.add(rightRoofBar);

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

    // Engine block crankcase
    const crankcase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.75), metalEngineMat);
    engineBlockGroup.add(crankcase);

    // Left and Right cylinder bank valve covers
    const leftValve = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.68), redValveMat);
    leftValve.position.set(-0.22, 0.22, 0);
    leftValve.rotation.z = -0.35;
    engineBlockGroup.add(leftValve);

    const rightValve = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.68), redValveMat);
    rightValve.position.set(0.22, 0.22, 0);
    rightValve.rotation.z = 0.35;
    engineBlockGroup.add(rightValve);

    // Intake runners / plenum
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
  cockpitCameraAnchor.position.set(driverX, driverY + 0.68, driverZ + 0.05);
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
  // When available from controls or physics, steering wheel tilts up to +/- 180 deg
  // In passive/telemetry mode, simulate gentle road vibration / centripetal lean
  if (telemetry.speedKph > 5) {
    const microJitter = Math.sin(Date.now() * 0.02) * 0.015;
    instance.steeringWheelGroup.rotation.z = microJitter;
  }

  // 4. Dual Animated Wiper Sweep
  // Sweep angle between 0.18 and 1.35 rad (approx 75 degrees)
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
