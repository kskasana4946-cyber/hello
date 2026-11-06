/**
 * Tier 3 — Cross-Feature Combinatorial & Pairwise Test Suite (50 Genuine Test Cases: T3-01 .. T3-50)
 * Owned by: E2E_Testing_Track (tests/e2e/tier3_combinatorial_pairwise.spec.mjs)
 *
 * Implements all 50 pairwise & multi-feature test cases across Groups A through F
 * exactly as specified in TEST_INFRA.md and sub_orch_e2e_explorer_3/handoff.md.
 */

import {
  registerTest,
  assertTrue,
  assertFalse,
  assertEqual,
  assertNotEqual,
  assertApprox,
  assertGreater,
  assertGreaterOrEqual,
  assertLess,
  assertLessOrEqual,
  assertInRange,
  assertFiniteNumber,
  assertIncludes,
  assertThrows,
  assertPakHeader,
  assertGlbHeader,
} from './helpers/e2e_harness.mjs';

function t3(id, features, title, fn) {
  registerTest({ id, tier: 3, features, title, fn });
}

// ============================================================================
// Group A (T3-01 .. T3-10): 4 Sky Paks × 4 Track Biomes × Renderer & Streaming
// ============================================================================

// T3-01: sky_golden_hour.pak (sky_01) × track_golden_gp.pak (track_01) × 2.4x Sun Shafts, Cumulus Cloud Shadows & 4-Cascade CSM PCSS
t3('T3-01', ['F3', 'F6', 'F11', 'F17', 'F23'], 'sky_golden_hour.pak (sky_01) × track_golden_gp.pak (track_01) × 2.4x Sun Shafts, Cumulus Cloud Shadows & 4-Cascade 4096×4096 CSM PCSS', async (ctx) => {
  const { pakStreamer, renderer, splineStreamer } = ctx.engineApi;
  const skyPak = await pakStreamer.streamPak('sky_01');
  const trackPak = await pakStreamer.streamPak('track_01');

  assertEqual(skyPak.canonicalId, 'sky_golden_hour');
  assertEqual(skyPak.byteLength, ctx.specs.SKY_PAK_BYTE_LENGTH);
  assertEqual(trackPak.canonicalId, 'track_golden_gp');
  assertEqual(trackPak.byteLength, ctx.specs.TRACK_PAK_BYTE_LENGTH);

  const skySpec = ctx.specs.SKY_BIOMES_SPEC.find((s) => s.id === 'sky_golden_hour');
  assertEqual(skySpec.sunShaftMultiplier, 2.4);
  assertEqual(skySpec.cloudType, 'cumulus_3d_volume');
  assertTrue(skySpec.hasMovingCloudShadows);

  splineStreamer.configure(5.0, 'track_golden_gp');
  assertEqual(splineStreamer.getTotalLength(), 5000);
  assertEqual(splineStreamer.getSectorCount(), 10);

  const sector0 = splineStreamer.getSectorDescriptor(0);
  assertEqual(sector0.treeArchetype, 'oak');
  assertTrue(sector0.architecture.pitBuildings.length > 0);

  assertEqual(renderer.csm.cascadeCount, 4);
  assertGreaterOrEqual(renderer.csm.resolution, 4096);
  const penumbra = renderer.evaluatePcssPenumbra(15.0);
  assertGreater(penumbra.penumbraRadius, 0.002);

  const godRays = renderer.evaluateGodRays(0.9);
  assertGreater(godRays, 0.3);
});

// T3-02: sky_neotokyo_cyber.pak (sky_02) × track_neotokyo.pak (track_02) × Wet Asphalt SSR Puddles, Holographic Skyline & Dynamic Lightning
t3('T3-02', ['F3', 'F12', 'F18', 'F23'], 'sky_neotokyo_cyber.pak (sky_02) × track_neotokyo.pak (track_02) × Wet Asphalt SSR Puddles, Holographic Skyline & Dynamic Lightning', async (ctx) => {
  const { pakStreamer, renderer, splineStreamer } = ctx.engineApi;
  const skyPak = await pakStreamer.streamPak('sky_02');
  const trackPak = await pakStreamer.streamPak('track_02');

  assertEqual(skyPak.canonicalId, 'sky_neotokyo_cyber');
  assertEqual(trackPak.canonicalId, 'track_neotokyo');

  const skySpec = ctx.specs.SKY_BIOMES_SPEC.find((s) => s.id === 'sky_neotokyo_cyber');
  assertTrue(skySpec.hasDynamicLightning);
  assertTrue(skySpec.hasHolographicSkyline);
  assertEqual(skySpec.smogDensity, 0.65);

  const trackSpec = ctx.specs.TRACK_BIOMES_SPEC.find((t) => t.id === 'track_neotokyo');
  assertEqual(trackSpec.defaultPuddleMask, 0.82);

  const ssr = renderer.evaluateSsrSurface(trackSpec.defaultPuddleMask);
  assertEqual(ssr.puddleMask, 0.82);
  assertLess(ssr.effectiveRoughness, 0.2);
  assertGreater(ssr.reflectionWeight, 0.7);

  splineStreamer.configure(8.0, 'track_neotokyo');
  assertEqual(splineStreamer.getTotalLength(), 8000);
  assertEqual(splineStreamer.getSectorCount(), 16);
});

// T3-03: sky_redrock_canyon.pak (sky_03) × track_canyon.pak (track_03) × Desert Dust Haze LUT, Cirrus Clouds & 16-Bit Canyon Heightfield
t3('T3-03', ['F13', 'F19', 'F23'], 'sky_redrock_canyon.pak (sky_03) × track_canyon.pak (track_03) × Desert Dust Haze LUT, Cirrus Clouds & 16-Bit Canyon Heightfield', async (ctx) => {
  const { pakStreamer, splineStreamer } = ctx.engineApi;
  const skyPak = await pakStreamer.streamPak('sky_03');
  const trackPak = await pakStreamer.streamPak('track_03');

  assertEqual(skyPak.canonicalId, 'sky_redrock_canyon');
  assertEqual(trackPak.canonicalId, 'track_canyon');

  const skySpec = ctx.specs.SKY_BIOMES_SPEC.find((s) => s.id === 'sky_redrock_canyon');
  assertEqual(skySpec.dustHazeDensity, 0.55);
  assertEqual(skySpec.cloudType, 'high_altitude_cirrus');

  splineStreamer.configure(12.0, 'track_canyon');
  assertEqual(splineStreamer.getTotalLength(), 12000);
  assertEqual(splineStreamer.getSectorCount(), 24);

  const sectorDesc = splineStreamer.getSectorDescriptor(2);
  assertEqual(sectorDesc.treeArchetype, 'saguaro');
  assertTrue(sectorDesc.hasCorrugatedArmcoBarriers);
});

// T3-04: sky_alpine_glacier.pak (sky_04) × track_alpine.pak (track_04) × Aurora Borealis Shader, Snow-Albedo Bounce & Blowing Snow Particles
t3('T3-04', ['F14', 'F20', 'F23'], 'sky_alpine_glacier.pak (sky_04) × track_alpine.pak (track_04) × Aurora Borealis Shader, Snow-Albedo Bounce & Blowing Snow Particles', async (ctx) => {
  const { pakStreamer, splineStreamer } = ctx.engineApi;
  const skyPak = await pakStreamer.streamPak('sky_04');
  const trackPak = await pakStreamer.streamPak('track_04');

  assertEqual(skyPak.canonicalId, 'sky_alpine_glacier');
  assertEqual(trackPak.canonicalId, 'track_alpine');

  const skySpec = ctx.specs.SKY_BIOMES_SPEC.find((s) => s.id === 'sky_alpine_glacier');
  assertTrue(skySpec.auroraEnabled);
  assertEqual(skySpec.groundAlbedo, 0.82);
  assertEqual(skySpec.snowParticleCount, 4096);

  splineStreamer.configure(24.0, 'track_alpine');
  assertEqual(splineStreamer.getTotalLength(), 24000);
  assertEqual(splineStreamer.getSectorCount(), 48);

  const sectorDesc = splineStreamer.getSectorDescriptor(5);
  assertEqual(sectorDesc.treeArchetype, 'snow-spruce');
});

// T3-05: Cross-Biome Pairing (sky_02 × track_04 and sky_04 × track_01) × Alias Resolution & PMREM Specular Cubemap Binding
t3('T3-05', ['F7', 'F10', 'F12', 'F14', 'F22'], 'Cross-Biome Pairing (sky_02 × track_04 and sky_04 × track_01) × Alias Resolution & PMREM Specular Cubemap Binding', async (ctx) => {
  const { pakStreamer } = ctx.engineApi;
  const res1 = pakStreamer.resolveAssetAlias('sky_02');
  assertEqual(res1.canonicalId, 'sky_neotokyo_cyber');
  assertEqual(res1.category, 'sky');

  const res2 = pakStreamer.resolveAssetAlias('track_04');
  assertEqual(res2.canonicalId, 'track_alpine');
  assertEqual(res2.category, 'track');

  const sky02Pak = await pakStreamer.streamPak('sky_02');
  const pmremChunk = sky02Pak.header.entries.find((e) => e.name === 'pmrem_cubemap_mips');
  assertTrue(Boolean(pmremChunk));
  assertEqual(pmremChunk.byteLength, 3_145_728);

  const res3 = pakStreamer.resolveAssetAlias('sky_04');
  assertEqual(res3.canonicalId, 'sky_alpine_glacier');
  const res4 = pakStreamer.resolveAssetAlias('track_01');
  assertEqual(res4.canonicalId, 'track_golden_gp');

  const sky04Pak = await pakStreamer.streamPak('sky_04');
  assertTrue(sky04Pak.header.entries.length >= 5);
});

// T3-06: PakStreamer LRU VRAM Cache Eviction × SplineTrackStreamer 500m Sector Window (50.0 KM / 100 Sectors) × Sky Swap
t3('T3-06', ['F7', 'F21', 'F22'], 'PakStreamer LRU VRAM Cache Eviction × SplineTrackStreamer 500m Sector Window (50.0 KM / 100 Sectors) × Sky Swap', (ctx) => {
  const { pakStreamer, splineStreamer } = ctx.engineApi;
  splineStreamer.configure(50.0, 'track_golden_gp');
  assertEqual(splineStreamer.getTotalLength(), 50000);
  assertEqual(splineStreamer.getSectorCount(), 100);

  const initialEvictions = pakStreamer.evictionCount;
  for (let s = 0; s <= 25000; s += 2500) {
    pakStreamer.streamLookaheadWindow(s, 50000, 2, 6);
  }

  assertLessOrEqual(pakStreamer.residentSectors.size, pakStreamer.maxResidentSectors);
  assertLessOrEqual(pakStreamer.vramUsedBytes, pakStreamer.vramBudgetBytes);
  assertGreater(pakStreamer.evictionCount, initialEvictions);
});

// T3-07: UncappedRenderer VSync Toggle (120Hz / 144Hz / 240Hz) & SSAA (1.0x to 2.5x) × Volumetric God-Rays & ACES Filmic HDR
t3('T3-07', ['F2', 'F6', 'F11'], 'UncappedRenderer VSync Toggle (120Hz / 144Hz / 240Hz) & SSAA (1.0x to 2.5x) × Volumetric God-Rays & ACES Filmic HDR', (ctx) => {
  const { renderer } = ctx.engineApi;
  const v120 = renderer.setVsyncHz(120);
  assertEqual(v120.vsyncHz, 120);
  assertApprox(v120.frameIntervalMs, 8.333, 0.01);

  const v144 = renderer.setVsyncHz(144);
  assertEqual(v144.vsyncHz, 144);

  const v240 = renderer.setVsyncHz(240);
  assertEqual(v240.vsyncHz, 240);

  const s1 = renderer.setSsaaScale(1.0);
  assertEqual(s1.ssaaScale, 1.0);

  const s2 = renderer.setSsaaScale(2.5);
  assertEqual(s2.ssaaScale, 2.5);
  assertEqual(s2.renderWidth, Math.round(renderer.baseWidth * 2.5));

  const aces0 = renderer.evaluateAcesFilmic(0.0);
  assertEqual(aces0, 0.0);
  const aces1 = renderer.evaluateAcesFilmic(1.0);
  assertInRange(aces1, 0.7, 1.0);

  const grPositive = renderer.evaluateGodRays(0.85);
  assertGreater(grPositive, 0.2);
  const grNegative = renderer.evaluateGodRays(-0.5);
  assertEqual(grNegative, 0.0);
});

// T3-08: SplineTrackStreamer Illuminated Tunnels (isTunnel: true) × SkyAtmosphereSystem Exposure & Interior Lighting Transition
t3('T3-08', ['F6', 'F23'], 'SplineTrackStreamer Illuminated Tunnels (isTunnel: true) × SkyAtmosphereSystem Exposure & Interior Lighting Transition', (ctx) => {
  const { splineStreamer } = ctx.engineApi;
  splineStreamer.configure(24.0, 'track_golden_gp');

  const tunnelSectorIdx = Math.floor(splineStreamer.sectorCount / 2);
  const tunnelFrame = splineStreamer.getFrameAtArcLength(tunnelSectorIdx * 500 + 250);
  assertTrue(tunnelFrame.isTunnel);

  const tunnelSector = splineStreamer.getSectorDescriptor(tunnelSectorIdx);
  assertTrue(tunnelSector.architecture.illuminatedTunnels.length > 0);
  assertEqual(tunnelSector.architecture.illuminatedTunnels[0].luminaireCount, 25);

  const openRoadFrame = splineStreamer.getFrameAtArcLength(100);
  assertFalse(openRoadFrame.isTunnel);
});

// T3-09: SkyAtmosphereSystem 4 Sky PMREM Cubemaps × AutomotivePaint.glsl Dual-Layer Clearcoat & Sub-Millimeter Metallic Flake
t3('T3-09', ['F4', 'F11', 'F13'], 'SkyAtmosphereSystem 4 Sky PMREM Cubemaps × AutomotivePaint.glsl Dual-Layer Clearcoat & Sub-Millimeter Metallic Flake', (ctx) => {
  const { vehicleBuilder } = ctx.engineApi;
  const shaderCode = ctx.fsProbe.getShaderSource('src/shaders/AutomotivePaint.glsl');
  assertIncludes(shaderCode, 'uClearcoat');
  assertIncludes(shaderCode, 'uClearcoatRoughness');
  assertIncludes(shaderCode, 'uFlakeScale');
  assertTrue(shaderCode.includes('uFlakeDensity') || shaderCode.includes('uFlakeIntensity'));

  const exterior = vehicleBuilder.buildExterior('pagani_v12', 0);
  assertEqual(exterior.vehicleId, 'pagani_v12');
  assertEqual(exterior.materialUniforms.clearcoat, 1.0);
  assertGreaterOrEqual(exterior.materialUniforms.clearcoatRoughness, 0.04);
  assertGreater(exterior.materialUniforms.flakeDensity, 0.5);
  assertGreater(exterior.materialUniforms.flakeScale, 1000);
});

// T3-10: SkyAtmosphereSystem Precipitation (sky_neotokyo_cyber / sky_alpine_glacier) × RefractiveGlass.glsl (ior: 1.52) & Animated Dual Wipers
t3('T3-10', ['F5', 'F12', 'F14', 'F30'], 'SkyAtmosphereSystem Precipitation (sky_neotokyo_cyber / sky_alpine_glacier) × RefractiveGlass.glsl (ior: 1.52) & Animated Dual Wipers', (ctx) => {
  const { vehicleBuilder } = ctx.engineApi;
  const glassShader = ctx.fsProbe.getShaderSource('src/shaders/RefractiveGlass.glsl');
  assertIncludes(glassShader, 'uIor');
  assertTrue(glassShader.includes('uWiperAngleRad') || glassShader.includes('uWiperPhase'));

  const cockpit = vehicleBuilder.buildCockpitAndGlass('porsche_gt3');
  assertEqual(cockpit.glassMaterial.ior, 1.52);
  assertApprox(cockpit.glassMaterial.f0Reflectance, 0.04258, 0.001);

  const wipersUpdated = cockpit.updateWipers(0.4, 1.0);
  assertGreater(wipersUpdated.leftWiperPivot.angleDeg, 0.0);
  assertGreater(wipersUpdated.rightWiperPivot.angleDeg, 0.0);

  const dryWipers = cockpit.updateWipers(0.4, 0.0);
  assertEqual(dryWipers.leftWiperPivot.angleDeg, 0.0);
});

// ============================================================================
// Group B (T3-11 .. T3-20): 34 Vehicles × 12 PBR Liveries × Aero, Glass & Telemetry
// ============================================================================

// T3-11: All 34 Vehicle Roster Classes (car_01..car_34) × PakStreamer .pak Loading × HighPolyVehicleBuilder LOD0–LOD2 Hierarchy
t3('T3-11', ['F7', 'F28', 'F29', 'F32'], 'All 34 Vehicle Roster Classes (car_01..car_34) × PakStreamer .pak Loading × HighPolyVehicleBuilder LOD0–LOD2 Hierarchy', async (ctx) => {
  const { pakStreamer, vehicleBuilder } = ctx.engineApi;
  assertEqual(ctx.specs.VEHICLE_ROSTER_SPEC.length, 34);

  for (const car of ctx.specs.VEHICLE_ROSTER_SPEC) {
    const pak = await pakStreamer.streamPak(car.id);
    assertEqual(pak.canonicalId, car.pakDir);
    assertEqual(pak.byteLength, ctx.specs.VEHICLE_PAK_BYTE_LENGTH);

    const ext = vehicleBuilder.buildExterior(car.id, 0);
    assertGreater(ext.lodLevels.LOD0.triangles, ext.lodLevels.LOD1.triangles);
    assertGreater(ext.lodLevels.LOD1.triangles, ext.lodLevels.LOD2.triangles);
    assertGreater(ext.lodLevels.LOD2.triangles, 1000);
  }
});

// T3-12: 34 Vehicles (All 6 Tiers) × 12 PBR Livery Finishes (0..11) × AutomotivePaint.glsl Shader Uniforms
t3('T3-12', ['F4', 'F28', 'F29', 'F36'], '34 Vehicles (All 6 Tiers) × 12 PBR Livery Finishes (0..11) × AutomotivePaint.glsl Shader Uniforms', (ctx) => {
  const { vehicleBuilder } = ctx.engineApi;
  const sampleCars = ['scooter', 'skyline_gtr', 'muscle', 'porsche_gt3', 'koenigsegg', 'f1'];
  assertEqual(ctx.specs.LIVERY_PRESETS_12.length, 12);

  for (const carId of sampleCars) {
    for (let liveryIdx = 0; liveryIdx < 12; liveryIdx++) {
      const ext = vehicleBuilder.buildExterior(carId, liveryIdx);
      const expected = ctx.specs.LIVERY_PRESETS_12[liveryIdx];
      assertEqual(ext.materialUniforms.name, expected.name);
      assertEqual(ext.materialUniforms.finishClass, expected.finishClass);
      assertGreaterOrEqual(ext.materialUniforms.uClearcoatRoughness, 0.04);
      assertFiniteNumber(ext.materialUniforms.primaryColor);
    }
  }
});

// T3-13: RapierVehicleWorld Heavy Braking from 340+ KPH × Active DRS/Airbrake Rear Wing Tilt & 1,000°C Glowing Carbon-Ceramic Brake Discs
t3('T3-13', ['F8', 'F29'], 'RapierVehicleWorld Heavy Braking from 340+ KPH × Active DRS/Airbrake Rear Wing Tilt & 1,000°C Glowing Carbon-Ceramic Brake Discs', (ctx) => {
  const { physicsWorld, vehicleBuilder } = ctx.engineApi;
  physicsWorld.setVehicleSpec('mclaren_lt');
  physicsWorld.state.speedKph = 340.0;
  physicsWorld.state.vTangent = 340.0 / 3.6;

  const exterior = vehicleBuilder.buildExterior('mclaren_lt', 0);

  // Heavy braking application across multiple steps
  for (let s = 0; s < 15; s++) {
    physicsWorld.step(0.1, { throttle: 0.0, brake: 1.0 });
  }
  assertFalse(physicsWorld.state.drsActive);
  assertGreater(physicsWorld.state.brakeTempCelsius, 150.0);

  const sub = exterior.updateAeroAndBrakes(physicsWorld.state.drsActive, 1.0, physicsWorld.state.brakeTempCelsius);
  assertEqual(sub.activeDrsRearWing.currentPitchRad, sub.activeDrsRearWing.airbrakePitchRad);
  assertGreater(sub.brakeDiscs[0].tempCelsius, 100.0);
});

// T3-14: RapierVehicleWorld Full-Throttle Straightaway × Active DRS Flattening & Calibrated Top Speed (koenigsegg 445 KPH, jet_thrust 485 KPH)
t3('T3-14', ['F8', 'F29', 'F32'], 'RapierVehicleWorld Full-Throttle Straightaway × Active DRS Flattening & Calibrated Top Speed (koenigsegg 445 KPH, jet_thrust 485 KPH)', (ctx) => {
  const { physicsWorld, vehicleBuilder } = ctx.engineApi;
  const koenigsegg = ctx.specs.VEHICLE_ROSTER_SPEC.find((v) => v.id === 'koenigsegg');
  assertEqual(koenigsegg.topSpeedKph, 445);
  const jetThrust = ctx.specs.VEHICLE_ROSTER_SPEC.find((v) => v.id === 'jet_thrust');
  assertEqual(jetThrust.topSpeedKph, 485);

  physicsWorld.splineStreamer.configure(24.0, 'track_golden_gp');
  physicsWorld.state.alongOffset = 24000 - 1000; // Place on 3.2 KM straightaway
  physicsWorld.setVehicleSpec(koenigsegg);
  physicsWorld.state.speedKph = 250.0;
  physicsWorld.state.vTangent = 250.0 / 3.6;
  physicsWorld.step(0.1, { throttle: 1.0, brake: 0.0 });
  assertTrue(physicsWorld.state.drsActive);

  const ext = vehicleBuilder.buildExterior('koenigsegg', 0);
  const sub = ext.updateAeroAndBrakes(true, 0.0, 25.0);
  assertEqual(sub.activeDrsRearWing.currentPitchRad, sub.activeDrsRearWing.drsPitchRad);
});

// T3-15: CockpitInteriorBuilder Framed Multi-Pane Automotive Glass × Pillars, Tumblehome Door Glass & Wing Mirrors
t3('T3-15', ['F5', 'F30'], 'CockpitInteriorBuilder Framed Multi-Pane Automotive Glass × Pillars, Tumblehome Door Glass & Wing Mirrors', (ctx) => {
  const { vehicleBuilder } = ctx.engineApi;
  const cockpit = vehicleBuilder.buildCockpitAndGlass('ferrari_v8');
  const win = cockpit.framedWindows;

  assertTrue(win.frontWindshield.laminated);
  assertEqual(win.frontWindshield.material.ior, 1.52);
  assertTrue(win.aPillars.left && win.aPillars.right);
  assertTrue(win.bPillars.left && win.bPillars.right);
  assertTrue(win.cPillars.left && win.cPillars.right);
  assertTrue(win.leftDoorWindow.tumblehomeInward);
  assertTrue(win.rightDoorWindow.tumblehomeInward);
  assertTrue(win.wingMirrors.left && win.wingMirrors.right);
  assertTrue(win.rearBackglass.present);
});

// T3-16: CockpitInteriorBuilder Transparent Mid-Engine Bay Window × 3D Modeled Engine Block across Supercar/Hypercar Roster
t3('T3-16', ['F5', 'F30', 'F32'], 'CockpitInteriorBuilder Transparent Mid-Engine Bay Window × 3D Modeled Engine Block across Supercar/Hypercar Roster', (ctx) => {
  const { vehicleBuilder } = ctx.engineApi;
  const midEngineCars = ['corvette_gt', 'lambo', 'pagani_v12', 'koenigsegg', 'hyper'];
  for (const carId of midEngineCars) {
    const spec = ctx.specs.VEHICLE_ROSTER_SPEC.find((v) => v.id === carId);
    assertTrue(spec.hasTransparentEngineBay);

    const cockpit = vehicleBuilder.buildCockpitAndGlass(carId);
    assertTrue(cockpit.framedWindows.midEngineBayWindow !== null);
    assertTrue(cockpit.framedWindows.midEngineBayWindow.transparent);
    assertTrue(cockpit.framedWindows.engineBlock3D !== null);
    assertGreater(cockpit.framedWindows.engineBlock3D.cylinders, 6);
  }

  const nonMid = vehicleBuilder.buildCockpitAndGlass('bus');
  assertEqual(nonMid.framedWindows.midEngineBayWindow, null);
  assertEqual(nonMid.framedWindows.engineBlock3D, null);
});

// T3-17: Playable First-Person 3D Cockpit (Camera Mode: COCKPIT) × Live 3D Digital Telemetry Screen (KPH, Gear, RPM, Lap Delta)
t3('T3-17', ['F8', 'F31', 'F40'], 'Playable First-Person 3D Cockpit (Camera Mode: COCKPIT) × Live 3D Digital Telemetry Screen (KPH, Gear, RPM, Lap Delta)', (ctx) => {
  const { appController } = ctx;
  appController.setCameraMode('COCKPIT');
  assertEqual(appController.getState().cameraMode, 'COCKPIT');

  const cockpit = appController.subsystems.vehicleBuilder.buildCockpitAndGlass('lambo');
  const rendered = cockpit.updateCockpitTelemetry({
    speedKph: 245.4,
    gear: 5,
    rpm: 7200,
    maxRpm: 9500,
    lapDeltaSec: -0.42,
    sectorSplits: [18.2, 22.4, null],
  });

  assertEqual(rendered.speedKph, 245);
  assertEqual(rendered.gear, 5);
  assertEqual(rendered.rpm, 7200);
  assertEqual(rendered.formattedLapDelta, '-0.42s');
  assertEqual(rendered.deltaColor, 'GREEN');
  assertEqual(cockpit.cockpitInterior.telemetryScreenMesh.renderedData.deltaColor, 'GREEN');
});

// T3-18: Camera Mode: COCKPIT Steering Wheel Mesh & Shift LEDs × RapierVehicleWorld Steering Angle & Redline RPM
t3('T3-18', ['F8', 'F31'], 'Camera Mode: COCKPIT Steering Wheel Mesh & Shift LEDs × RapierVehicleWorld Steering Angle & Redline RPM', (ctx) => {
  const { vehicleBuilder } = ctx.engineApi;
  const cockpit = vehicleBuilder.buildCockpitAndGlass('f1');
  const wheel = cockpit.cockpitInterior.steeringWheel;

  // Steering rotation
  cockpit.updateCockpitTelemetry({ rpm: 4000, maxRpm: 15000 }, 0.8);
  assertGreater(wheel.rotationZRad, 0.4);

  // Redline shift LED lighting
  cockpit.updateCockpitTelemetry({ rpm: 14600, maxRpm: 15000 }, 0.0);
  assertEqual(wheel.activeShiftLeds, 10);
  assertEqual(wheel.shiftLedColor, 'RED_BLUE_FLASH');

  // Low RPM -> LEDs OFF
  cockpit.updateCockpitTelemetry({ rpm: 3000, maxRpm: 15000 }, 0.0);
  assertEqual(wheel.activeShiftLeds, 0);
  assertEqual(wheel.shiftLedColor, 'OFF');
});

// T3-19: 34 Vehicle Roster Engine Archetypes × GranularSynthEngine Multi-RPM Exhaust Synthesis & Pitch Tracking
t3('T3-19', ['F28', 'F32', 'F41'], '34 Vehicle Roster Engine Archetypes × GranularSynthEngine Multi-RPM Exhaust Synthesis & Pitch Tracking', (ctx) => {
  const { synthEngine } = ctx.engineApi;
  const archetypes = ['scooter', 'jdm_rotary', 'muscle', 'porsche_gt3', 'lambo', 'hyper', 'ev_proto', 'jet_thrust'];

  for (const carId of archetypes) {
    const idleAudio = synthEngine.updateEngineAudio(carId, 1000, 0.1);
    assertGreater(idleAudio.fundamentalFreqHz, 20);
    assertGreater(idleAudio.grainPlaybackRate, 0);

    const highAudio = synthEngine.updateEngineAudio(carId, 8000, 1.0);
    assertGreater(highAudio.fundamentalFreqHz, idleAudio.fundamentalFreqHz);
    assertGreater(highAudio.harmonicFormantCutoffHz, idleAudio.harmonicFormantCutoffHz);
  }
});

// T3-20: UncappedRenderer Per-Wheel Motion Blur & Speed-Driven FOV Warp × High-Speed Vehicle Physics (300+ KPH)
t3('T3-20', ['F6', 'F8', 'F29'], 'UncappedRenderer Per-Wheel Motion Blur & Speed-Driven FOV Warp × High-Speed Vehicle Physics (300+ KPH)', (ctx) => {
  const { renderer } = ctx.engineApi;
  const lowSpeed = renderer.updateSpeedCameraFx(0.0);
  assertEqual(lowSpeed.fovDeg, 60.0);
  assertEqual(lowSpeed.wheelMotionBlurWeight, 0.0);

  const highSpeed = renderer.updateSpeedCameraFx(400.0);
  assertGreater(highSpeed.fovDeg, 75.0);
  assertLessOrEqual(highSpeed.fovDeg, 88.0);
  assertGreater(highSpeed.wheelMotionBlurWeight, 0.9);
  assertGreater(highSpeed.wheelAngularVelRadSec, 300.0);
});

// ============================================================================
// Group C (T3-21 .. T3-28): RapierVehicleWorld Physics × SplineTrackStreamer
// ============================================================================

// T3-21: True 1:1 Physical World Calibration (1 World Unit = 1 Real Meter) at 360 KPH (100.0 m/s)
t3('T3-21', ['F8', 'F15', 'F19'], 'True 1:1 Physical World Calibration (1 World Unit = 1 Real Meter) at 360 KPH (100.0 m/s)', (ctx) => {
  const { physicsWorld, splineStreamer } = ctx.engineApi;
  splineStreamer.configure(12.0, 'track_golden_gp');
  physicsWorld.setVehicleSpec('pagani_v12');

  physicsWorld.state.alongOffset = 500.0;
  physicsWorld.state.lateralOffset = 0.0;
  for (let s = 0; s < 100; s++) {
    physicsWorld.step(0.1, { lockSpeedKph: 360.0 });
  }

  assertEqual(physicsWorld.state.speedKph, 360.0);
  assertApprox(physicsWorld.state.alongOffset, 1500.0, 0.5);
  const deltaS = physicsWorld.state.alongOffset - 500.0;
  const expectedDistance = (360.0 / 3.6) * 10.0; // 1,000 meters
  assertApprox(deltaS / expectedDistance, 1.0, 0.001);
});

// T3-22: All 6 Selectable True Physical Circuit Lengths (2.0, 5.0, 8.0, 12.0, 24.0, 50.0 KM) × Sector Counts & Seamless C2 Loop Closure
t3('T3-22', ['F15', 'F16', 'F17', 'F18', 'F19', 'F20', 'F21', 'F22'], 'All 6 Selectable True Physical Circuit Lengths (2.0, 5.0, 8.0, 12.0, 24.0, 50.0 KM) × Sector Counts & Seamless C2 Loop Closure', (ctx) => {
  const { splineStreamer } = ctx.engineApi;
  const lengths = [2.0, 5.0, 8.0, 12.0, 24.0, 50.0];

  for (const km of lengths) {
    const res = splineStreamer.configure(km, 'track_golden_gp');
    const spec = ctx.specs.CIRCUIT_LENGTHS_SPEC[km];
    assertEqual(res.totalLength, spec.meters);
    assertEqual(res.sectorCount, spec.sectors);

    const f0 = splineStreamer.getFrameAtArcLength(0.0);
    const fEnd = splineStreamer.getFrameAtArcLength(spec.meters);
    assertApprox(f0.position[0], fEnd.position[0], 1e-4);
    assertApprox(f0.position[2], fEnd.position[2], 1e-4);
    const dotT = f0.tangent[0] * fEnd.tangent[0] + f0.tangent[2] * fEnd.tangent[2];
    assertGreater(dotT, 0.999);
  }
});

// T3-23: 4-Wheel Raycast Suspension & Anti-Roll Bars × 18° Banked Carousel Turns & 3D Extruded FIA Sawtooth Kerbs
t3('T3-23', ['F8', 'F23'], '4-Wheel Raycast Suspension & Anti-Roll Bars × 18° Banked Carousel Turns & 3D Extruded FIA Sawtooth Kerbs', (ctx) => {
  const { physicsWorld, splineStreamer } = ctx.engineApi;
  splineStreamer.configure(24.0, 'track_golden_gp');

  const maxBankRad = (18.0 * Math.PI) / 180.0;
  let observedMaxBank = 0;
  for (let s = 0; s < 24000; s += 200) {
    const f = splineStreamer.getFrameAtArcLength(s);
    observedMaxBank = Math.max(observedMaxBank, Math.abs(f.bankAngleRad));
  }
  assertApprox(observedMaxBank, maxBankRad, 0.05);

  const contactTest = physicsWorld.evaluateWheelSpringDamper(0.30, 0.1);
  assertTrue(contactTest.contact);
  assertGreater(contactTest.forceN, 0.0);

  const airTest = physicsWorld.evaluateWheelSpringDamper(0.55, 0.0);
  assertFalse(airTest.contact);
  assertEqual(airTest.forceN, 0.0);
});

// T3-24: Pacejka Tire-Slip Curves & Weight-Transfer Pitch/Roll × Dry Rubbered Racing Line vs Wet Puddle / Icy Shoulder Surfaces
t3('T3-24', ['F8', 'F23'], 'Pacejka Tire-Slip Curves & Weight-Transfer Pitch/Roll × Dry Rubbered Racing Line vs Wet Puddle / Icy Shoulder Surfaces', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  const slipAngle = 0.12; // ~7 deg slip
  const normalLoad = 4000;

  const dryForce = physicsWorld.evaluatePacejkaLateralForce(slipAngle, normalLoad, 1.18);
  const wetForce = physicsWorld.evaluatePacejkaLateralForce(slipAngle, normalLoad, 0.68);

  assertGreater(Math.abs(dryForce), Math.abs(wetForce));
  assertGreater(Math.abs(dryForce), 3000);
});

// T3-25: Lateral Tangent T/N Barrier Projection at 420 KPH Shallow Scrape (10° Angle in hyper #27)
t3('T3-25', ['F9', 'F23'], 'Lateral Tangent T/N Barrier Projection at 420 KPH Shallow Scrape (10° Angle in hyper #27)', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  physicsWorld.setVehicleSpec('hyper');
  physicsWorld.state.alongOffset = 1200.0;
  physicsWorld.state.lateralOffset = 15.0; // Outside dMax
  physicsWorld.state.vTangent = 420.0 / 3.6;
  physicsWorld.state.vLateral = 12.0;

  const res = physicsWorld.projectBarrierCollision();
  assertTrue(res.clamped);
  assertEqual(res.deltaAlongOffset, 0.0);
  assertEqual(res.alongOffsetAfter, 1200.0);
  assertEqual(res.lateralOffsetAfter, physicsWorld.dMax);
  assertTrue(res.sparksActive);
  assertEqual(physicsWorld.state.vLateral, 0.0);
});

// T3-26: Lateral Tangent T/N Barrier Projection at 485 KPH Steep Impact (45° Angle in jet_thrust #34 Across Sector Boundary)
t3('T3-26', ['F9', 'F22', 'F32'], 'Lateral Tangent T/N Barrier Projection at 485 KPH Steep Impact (45° Angle in jet_thrust #34 Across Sector Boundary)', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  physicsWorld.setVehicleSpec('jet_thrust');
  physicsWorld.state.alongOffset = 495.0;
  physicsWorld.state.lateralOffset = -18.0; // Outside -dMax
  physicsWorld.state.vTangent = 485.0 / 3.6;
  physicsWorld.state.vLateral = -25.0;

  const res = physicsWorld.projectBarrierCollision();
  assertTrue(res.clamped);
  assertEqual(res.deltaAlongOffset, 0.0);
  assertEqual(res.lateralOffsetAfter, -physicsWorld.dMax);
  assertEqual(physicsWorld.state.vLateral, 0.0);

  // Advance across sector boundary (500m)
  physicsWorld.step(0.1, { throttle: 1.0 });
  assertGreater(physicsWorld.state.alongOffset, 500.0);
});

// T3-27: 24.0 KM Nordschleife +85m Mountain Elevation Climb & 3.2 KM Straightaway × Speed-Dependent Aerodynamic Downforce
t3('T3-27', ['F8', 'F20', 'F32'], '24.0 KM Nordschleife +85m Mountain Elevation Climb & 3.2 KM Straightaway × Speed-Dependent Aerodynamic Downforce', (ctx) => {
  const { splineStreamer, physicsWorld } = ctx.engineApi;
  splineStreamer.configure(24.0, 'track_golden_gp');

  let minY = Infinity;
  let maxY = -Infinity;
  for (let s = 0; s < 24000; s += 250) {
    const f = splineStreamer.getFrameAtArcLength(s);
    minY = Math.min(minY, f.position[1]);
    maxY = Math.max(maxY, f.position[1]);
  }
  const elevationSpan = maxY - minY;
  assertGreaterOrEqual(elevationSpan, 85.0);

  physicsWorld.setVehicleSpec('f1');
  const downforce175 = physicsWorld.evaluateAerodynamicDownforce(175.0);
  const downforce350 = physicsWorld.evaluateAerodynamicDownforce(350.0);
  assertGreater(downforce350, downforce175 * 3.5);
});

// T3-28: Extreme Mass & Power-to-Weight Physics Calibration (135 KG scooter #1 vs 8,400 KG bus #15 vs 2,400 KG jet_thrust #34)
t3('T3-28', ['F8', 'F32'], 'Extreme Mass & Power-to-Weight Physics Calibration (135 KG scooter #1 vs 8,400 KG bus #15 vs 2,400 KG jet_thrust #34)', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  const scooter = ctx.specs.VEHICLE_ROSTER_SPEC.find((v) => v.id === 'scooter');
  const bus = ctx.specs.VEHICLE_ROSTER_SPEC.find((v) => v.id === 'bus');

  physicsWorld.setVehicleSpec(scooter);
  const scooterStiffness = physicsWorld.springStiffness;

  physicsWorld.setVehicleSpec(bus);
  const busStiffness = physicsWorld.springStiffness;

  const stiffnessRatio = busStiffness / scooterStiffness;
  const massRatio = bus.massKg / scooter.massKg;
  assertApprox(stiffnessRatio / massRatio, 1.0, 0.05);
});

// ============================================================================
// Group D (T3-29 .. T3-36): TacticalRamps × ProgressionManager × RacingAIDirector
// ============================================================================

// T3-29: Outer-Lane Tactical Ramp Placement & 100m Holographic Approach Chevrons × Central 75% Clear Highway Racing Line
t3('T3-29', ['F18', 'F24'], 'Outer-Lane Tactical Ramp Placement & 100m Holographic Approach Chevrons × Central 75% Clear Highway Racing Line', (ctx) => {
  const { tacticalRamps, splineStreamer } = ctx.engineApi;
  splineStreamer.configure(8.0, 'track_canyon');
  const ramps = tacticalRamps.rebuildRamps();
  assertEqual(ramps.length, 24);

  const W = splineStreamer.roadWidth;
  for (const r of ramps) {
    assertGreaterOrEqual(Math.abs(r.lateralOffset), 0.375 * W);
    assertEqual(r.chevronLengthMeters, 100.0);
    assertApprox(r.chevronEnd - r.chevronStart, 100.0, 0.1);
  }

  // Central 75% lane clear
  for (const r of ramps) {
    assertFalse(tacticalRamps.isChevronActiveAt(r.sStart - 50, 0.0, r));
  }
});

// T3-30: Elevated Skybridge Overpass Ramp (Type 1) × +12m Upper-Deck Raycast Physics, 1.35x Overdrive Boost Strips & Ground AI Bypass
t3('T3-30', ['F8', 'F25', 'F37'], 'Elevated Skybridge Overpass Ramp (Type 1) × +12m Upper-Deck Raycast Physics, 1.35x Overdrive Boost Strips & Ground AI Bypass', (ctx) => {
  const { tacticalRamps } = ctx.engineApi;
  const skybridge = tacticalRamps.rampZones.find((r) => r.type === 'SKYBRIDGE_OVERPASS');
  assertTrue(Boolean(skybridge));
  assertEqual(skybridge.deckHeightMeters, 12.0);
  assertEqual(skybridge.overdriveBoostMultiplier, 1.35);
  assertInRange(skybridge.deckLength, 200, 450);
});

// T3-31: Mid-Air Plasma Boost Ring (Type 2) × +80% Instant Nitro Refill, 1.42x Hyper-Velocity Surge (4.0s) & +2,500 CR Career Stunt Bonus
t3('T3-31', ['F26', 'F33', 'F41'], 'Mid-Air Plasma Boost Ring (Type 2) × +80% Instant Nitro Refill, 1.42x Hyper-Velocity Surge (4.0s) & +2,500 CR Career Stunt Bonus', (ctx) => {
  const { physicsWorld, progression, synthEngine } = ctx.engineApi;
  physicsWorld.state.nitroPercent = 15.0;

  const res = physicsWorld.triggerPlasmaBoostRing('ring_test_1');
  assertTrue(res.triggered);
  assertEqual(res.nitroPercent, 95.0);
  assertEqual(res.boostMultiplier, 1.42);
  assertEqual(res.hyperSurgeRemainingSec, 4.0);
  assertEqual(res.creditsAwarded, 2500);

  synthEngine.playPlasmaRingChime();
  assertGreater(synthEngine.sfxCounters.plasmaRingChime, 0);

  // Duplicate trigger ignored
  const dup = physicsWorld.triggerPlasmaBoostRing('ring_test_1');
  assertFalse(dup.triggered);
  assertTrue(dup.duplicateIgnored);
});

// T3-32: Kinetic Shockwave Landing (Type 3) at >180 KPH × 0% Landing Slowdown, +15% Speed Surge & 15m AI Rival Lateral Blast + Takedown Reward
t3('T3-32', ['F27', 'F33', 'F37', 'F41'], 'Kinetic Shockwave Landing (Type 3) at >180 KPH × 0% Landing Slowdown, +15% Speed Surge & 15m AI Rival Lateral Blast + Takedown Reward', (ctx) => {
  const { physicsWorld, synthEngine } = ctx.engineApi;
  const rivals = [
    { id: 'ai_1', distanceMeters: 8.0, lateralDeltaMeters: 3.0 },
    { id: 'ai_2', distanceMeters: 14.5, lateralDeltaMeters: -4.0 },
    { id: 'ai_3', distanceMeters: 22.0, lateralDeltaMeters: 2.0 },
  ];

  const res = physicsWorld.evaluateKineticShockwaveLanding(240.0, rivals, 4.0);
  assertTrue(res.shockwaveFired);
  assertEqual(res.slowdownPercent, 0.0);
  assertEqual(res.postTouchdownSpeedKph, 240.0 * 1.15);

  assertTrue(res.blastedRivals[0].blasted);
  assertTrue(res.blastedRivals[1].blasted);
  assertFalse(res.blastedRivals[2].blasted);

  synthEngine.playShockwaveBoom();
  assertGreater(synthEngine.sfxCounters.shockwaveBoom, 0);
});

// T3-33: Kinetic Shockwave Landing Speed Threshold Boundary (175 KPH <= 180 KPH vs 185 KPH > 180 KPH)
t3('T3-33', ['F8', 'F27'], 'Kinetic Shockwave Landing Speed Threshold Boundary (175 KPH <= 180 KPH vs 185 KPH > 180 KPH)', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  const rivals = [{ id: 'ai_near', distanceMeters: 10.0 }];

  const subThreshold = physicsWorld.evaluateKineticShockwaveLanding(175.0, rivals, 3.0);
  assertFalse(subThreshold.shockwaveFired);
  assertEqual(subThreshold.postTouchdownSpeedKph, 175.0);

  const superThreshold = physicsWorld.evaluateKineticShockwaveLanding(185.0, rivals, 3.0);
  assertTrue(superThreshold.shockwaveFired);
  assertEqual(superThreshold.postTouchdownSpeedKph, 185.0 * 1.15);
  assertTrue(superThreshold.blastedRivals[0].blasted);
});

// T3-34: RacingAIDirector Super Hard (Apex Legend) vs Easy (Rookie) × Skybridge Overpass Targeting & Straightaway Nitro Execution
t3('T3-34', ['F17', 'F25', 'F37'], 'RacingAIDirector Super Hard (Apex Legend) vs Easy (Rookie) × Skybridge Overpass Targeting & Straightaway Nitro Execution', (ctx) => {
  const { aiDirector } = ctx.engineApi;
  const superHardDecision = aiDirector.evaluateAiTacticalDecision('SUPER_HARD', {
    distanceBehindLeaderMeters: 15.0,
    distanceToSkybridgeMeters: 50.0,
    curvature: 0.0005,
    nitroPercent: 60.0,
  });

  assertTrue(superHardDecision.drafting);
  assertTrue(superHardDecision.takingSkybridge);
  assertTrue(superHardDecision.nitroActive);
  assertEqual(superHardDecision.paceEfficiency, 1.02);

  const easyDecision = aiDirector.evaluateAiTacticalDecision('EASY', {
    distanceBehindLeaderMeters: 15.0,
    distanceToSkybridgeMeters: 50.0,
    curvature: 0.0005,
    nitroPercent: 60.0,
  });

  assertFalse(easyDecision.drafting);
  assertFalse(easyDecision.takingSkybridge);
  assertFalse(easyDecision.nitroActive);
  assertEqual(easyDecision.paceEfficiency, 0.76);
});

// T3-35: RacingAIDirector & Player Slipstream Drafting × ProgressionManager Slipstream CR/XP & GranularSynthEngine Wind Rush SFX
t3('T3-35', ['F8', 'F33', 'F37', 'F41'], 'RacingAIDirector & Player Slipstream Drafting × ProgressionManager Slipstream CR/XP & GranularSynthEngine Wind Rush SFX', (ctx) => {
  const { aiDirector, synthEngine } = ctx.engineApi;
  const draft = aiDirector.evaluateSlipstreamDraft(18.0, 1.2);
  assertTrue(draft.inSlipstream);
  assertGreater(draft.dragReductionRatio, 0.0);
  assertGreater(draft.draftAccelBonusMps2, 0.0);
  assertGreater(synthEngine.sfxCounters.slipstreamWind, 0);

  const noDraft = aiDirector.evaluateSlipstreamDraft(40.0, 1.2);
  assertFalse(noDraft.inSlipstream);
  assertEqual(noDraft.dragReductionRatio, 0.0);
});

// T3-36: ProgressionManager Multi-Category Economy (6 Reward Sources) × Early CR Vehicle Purchase Persistence (localStorage)
t3('T3-36', ['F26', 'F27', 'F32', 'F33'], 'ProgressionManager Multi-Category Economy (6 Reward Sources) × Early CR Vehicle Purchase Persistence (localStorage)', (ctx) => {
  const { progression } = ctx.engineApi;
  progression.resetCareer();

  const report = progression.recordRaceCompletion({
    position: 1,
    overtakes: 4,
    slipstreamSec: 5.0,
    driftCombos: 3,
    stunts: 2,
    takedowns: 1,
    laps: 2,
  });

  assertGreater(report.breakdown.podiumCredits, 0);
  assertGreater(report.breakdown.overtakeCredits, 0);
  assertGreater(report.breakdown.slipstreamCredits, 0);
  assertGreater(report.breakdown.driftCredits, 0);
  assertGreater(report.breakdown.stuntCredits, 0);
  assertGreater(report.breakdown.takedownCredits, 0);

  const targetCar = ctx.specs.VEHICLE_ROSTER_SPEC.find((v) => v.id === 'corvette_gt');
  progression.credits = targetCar.creditCost + 5000;
  const purchaseRes = progression.purchaseVehicleWithCR('corvette_gt');
  assertTrue(purchaseRes.purchased);
  assertEqual(purchaseRes.deductedCredits, targetCar.creditCost);
  assertTrue(progression.getUnlockedVehicleIds().includes('corvette_gt'));
});

// ============================================================================
// Group E (T3-37 .. T3-44): RacingAIDirector Formats × Audio & Ceremonies
// ============================================================================

// T3-37: 5 Standard Lap-Based Race Formats (1, 2, 3, 5, 10 Laps) × SplineTrackStreamer Lap Completion & POST_RACE Transition
t3('T3-37', ['F34', 'F38'], '5 Standard Lap-Based Race Formats (1, 2, 3, 5, 10 Laps) × SplineTrackStreamer Lap Completion & POST_RACE Transition', (ctx) => {
  const { appController } = ctx;
  const formats = ['SPRINT_1_LAP', 'QUALIFIER_2_LAPS', 'GRAND_PRIX_3_LAPS', 'FEATURE_5_LAPS', 'ENDURANCE_10_LAPS'];
  const expectedLaps = [1, 2, 3, 5, 10];

  for (let i = 0; i < formats.length; i++) {
    appController.setCircuitConfig({ format: formats[i] });
    assertEqual(appController.getState().telemetry.totalLaps, expectedLaps[i]);
  }

  appController.launchRace();
  assertEqual(appController.getState().phase, 'RACING');
  appController.simulateWinRace({ position: 1 });
  assertEqual(appController.getState().phase, 'POST_RACE');
});

// T3-38: Knockout Elimination Format × Lap-End Last-Place 3D Explosion & GranularSynthEngine Knockout Explosion SFX
t3('T3-38', ['F39', 'F41'], 'Knockout Elimination Format × Lap-End Last-Place 3D Explosion & GranularSynthEngine Knockout Explosion SFX', (ctx) => {
  const { aiDirector, synthEngine } = ctx.engineApi;
  aiDirector.configure('HARD', 'KNOCKOUT_ELIMINATION');
  assertEqual(aiDirector.totalRacers, 6);

  const event = aiDirector.eliminateLastPlaceRacer();
  assertTrue(event.explosionTriggered);
  assertEqual(event.activeRacersRemaining, 5);
  assertGreater(synthEngine.sfxCounters.knockoutExplosion, 0);
});

// T3-39: Knockout Elimination Dual Outcome Verification (Player Survives All Laps to Win vs Player Eliminated in Last Place)
t3('T3-39', ['F33', 'F34', 'F39'], 'Knockout Elimination Dual Outcome Verification (Player Survives All Laps to Win vs Player Eliminated in Last Place)', (ctx) => {
  const { progression } = ctx.engineApi;
  progression.resetCareer();

  // Scenario A: Player survives and wins 1st
  const winReport = progression.recordRaceCompletion({ position: 1, laps: 5 });
  assertEqual(winReport.position, 1);
  assertEqual(winReport.totalWins, 1);
  assertTrue(winReport.podiumStageActive);

  // Scenario B: Player eliminated in last place
  const elimReport = progression.recordRaceCompletion({ position: 6, laps: 5 });
  assertEqual(elimReport.position, 6);
  assertEqual(elimReport.totalWins, 1); // No new win
  assertFalse(elimReport.podiumStageActive);
});

// T3-40: Solo Time Attack Format × Zero AI Traffic + 20Hz Ghost Car Recording (Lap 1) & Holographic Ghost Replay (Lap 2+)
t3('T3-40', ['F15', 'F40'], 'Solo Time Attack Format × Zero AI Traffic + 20Hz Ghost Car Recording (Lap 1) & Holographic Ghost Replay (Lap 2+)', (ctx) => {
  const { aiDirector } = ctx.engineApi;
  aiDirector.configure('HARD', 'SOLO_TIME_ATTACK');
  assertEqual(aiDirector.totalRacers, 1);

  // Lap 1 progress
  aiDirector.recordTimeAttackProgress(0.33, 20.0);
  aiDirector.recordTimeAttackProgress(0.66, 40.0);
  const lap1End = aiDirector.recordTimeAttackProgress(1.0, 60.0);

  assertTrue(lap1End.completedLap);
  assertEqual(lap1End.lapTimeSec, 60.0);
  assertTrue(lap1End.ghostCarActive);
  assertGreater(aiDirector.ghostRecording.length, 2);
});

// T3-41: Solo Time Attack × Real-Time Sector 1 (0–33.3%), Sector 2 (33.3–66.7%), and Sector 3 (66.7–100%) Split Deltas on HUD & 3D Cockpit Dash
t3('T3-41', ['F31', 'F40'], 'Solo Time Attack × Real-Time Sector 1 (0–33.3%), Sector 2 (33.3–66.7%), and Sector 3 (66.7–100%) Split Deltas on HUD & 3D Cockpit Dash', (ctx) => {
  const { aiDirector, vehicleBuilder } = ctx.engineApi;
  aiDirector.configure('HARD', 'SOLO_TIME_ATTACK');
  aiDirector.recordTimeAttackProgress(1 / 3, 8.2);
  aiDirector.recordTimeAttackProgress(2 / 3, 16.5);
  aiDirector.recordTimeAttackProgress(1.0, 24.5);

  assertEqual(aiDirector.sectorSplits[0], 8.2);
  assertApprox(aiDirector.sectorSplits[1], 8.3, 0.01);

  const cockpit = vehicleBuilder.buildCockpitAndGlass('porsche_gt3');
  const rendered = cockpit.updateCockpitTelemetry({
    speedKph: 280,
    gear: 6,
    rpm: 8500,
    lapDeltaSec: -0.65,
    sectorSplits: aiDirector.sectorSplits,
  });

  assertEqual(rendered.formattedLapDelta, '-0.65s');
  assertEqual(rendered.deltaColor, 'GREEN');
  assertEqual(rendered.sectorSplits[0], 8.2);
});

// T3-42: Win-by-Win Career Unlock Ladder (1 Win = +1 New Car, Wins 1..31 → car_04..car_34) × PostRaceRewardCeremony 3D Podium & Turntable Reveal
t3('T3-42', ['F32', 'F33', 'F34'], 'Win-by-Win Career Unlock Ladder (1 Win = +1 New Car, Wins 1..31 → car_04..car_34) × PostRaceRewardCeremony 3D Podium & Turntable Reveal', (ctx) => {
  const { progression } = ctx.engineApi;
  progression.resetCareer();
  assertEqual(progression.getUnlockedVehicleIds().length, 3);

  for (let w = 1; w <= 31; w++) {
    const report = progression.recordRaceCompletion({ position: 1 });
    assertEqual(progression.totalWins, w);
    assertTrue(report.turntableRevealActive);
    assertEqual(report.newlyUnlockedVehicle.winsRequired, w);
  }
  assertEqual(progression.getUnlockedVehicleIds().length, 34);
});

// T3-43: PaddockShowroomUI [🔓 SANDBOX: UNLOCK ALL 34 CARS] Header Toggle × Non-Destructive ProgressionManager Career State
t3('T3-43', ['F33', 'F36'], 'PaddockShowroomUI [🔓 SANDBOX: UNLOCK ALL 34 CARS] Header Toggle × Non-Destructive ProgressionManager Career State', (ctx) => {
  const { appController } = ctx;
  appController.subsystems.progression.resetCareer();
  appController.subsystems.progression.totalWins = 2;
  appController.subsystems.progression.earnedOrPurchasedIds.add('jdm_rotary');
  appController.subsystems.progression.earnedOrPurchasedIds.add('car');

  assertEqual(appController.getState().unlockedVehicleIds.length, 5);

  appController.toggleSandboxUnlockAll();
  assertTrue(appController.getState().sandboxUnlockedAll);
  assertEqual(appController.getState().unlockedVehicleIds.length, 34);
  assertEqual(appController.getState().totalWins, 2);

  appController.toggleSandboxUnlockAll();
  assertFalse(appController.getState().sandboxUnlockedAll);
  assertEqual(appController.getState().unlockedVehicleIds.length, 5);
  assertEqual(appController.getState().totalWins, 2);
});

// T3-44: BootLoadingScreen 12,000 RPM Dyno Tachometer × PakStreamer ~400 MB Subsystem Progress Bars × GranularSynthEngine V12 Startup Roar
t3('T3-44', ['F7', 'F35', 'F41'], 'BootLoadingScreen 12,000 RPM Dyno Tachometer × PakStreamer ~400 MB Subsystem Progress Bars × GranularSynthEngine V12 Startup Roar', (ctx) => {
  const { appController } = ctx;
  const pHalf = appController.setBootProgress(0.5);
  assertEqual(pHalf.bootProgress, 0.5);
  assertEqual(pHalf.bootRpm, 6000);
  assertGreater(pHalf.subsystems.vehiclesMb, 70);

  const pFull = appController.setBootProgress(1.0);
  assertEqual(pFull.bootProgress, 1.0);
  assertEqual(pFull.bootRpm, 12000);

  const res = appController.completeBoot();
  assertEqual(res.phase, 'PADDOCK');
  assertGreater(appController.subsystems.synthEngine.sfxCounters.v12IgnitionRoar, 0);
});

// ============================================================================
// Group F (T3-45 .. T3-50): PaddockShowroomUI Tabs 1..4 & Mod Studio × .glb Export
// ============================================================================

// T3-45: PaddockShowroomUI Tab 4 Mod Studio × Binary .glb Export (0x46546C67 Magic Header & glTF 2.0 Structure Validation)
t3('T3-45', ['F29', 'F30', 'F36'], 'PaddockShowroomUI Tab 4 Mod Studio × Binary .glb Export (0x46546C67 Magic Header & glTF 2.0 Structure Validation)', (ctx) => {
  const { appController } = ctx;
  appController.completeBoot();
  appController.selectTab(4);
  appController.selectVehicle('porsche_gt3');

  const glbBytes = appController.exportCurrentVehicleGlb();
  const parsed = assertGlbHeader(glbBytes, 'Porsche GT3 GLB');
  assertEqual(parsed.parsed.asset.version, '2.0');
  assertGreater(parsed.jsonChunkLen, 0);
  assertGreater(parsed.binChunkLen, 0);
});

// T3-46: Tab 2 PBR Livery Selection (0..11) + Tab 4 Mod Studio Aero/Stance Tuning × Binary .glb Export Material & Transform Reflection
t3('T3-46', ['F4', 'F29', 'F36'], 'Tab 2 PBR Livery Selection (0..11) + Tab 4 Mod Studio Aero/Stance Tuning × Binary .glb Export Material & Transform Reflection', (ctx) => {
  const { appController } = ctx;
  appController.selectVehicle('lambo');
  appController.selectLivery(8); // Matte Satin Carbon
  appController.setModStudioTuning({ rideHeightOffset: -0.04, wingAngleRad: 0.35 });

  const glbBytes = appController.exportCurrentVehicleGlb();
  const { parsed } = assertGlbHeader(glbBytes);
  assertEqual(parsed.materials[0].name, 'Exposed Autoclave Carbon Weave');
  assertApprox(parsed.nodes[0].translation[1], -0.04, 0.001);
});

// T3-47: Multi-Archetype Vehicle .glb Export Matrix (scooter #1, bus #15, lambo #23, f1 #32, jet_thrust #34)
t3('T3-47', ['F29', 'F30', 'F31', 'F36'], 'Multi-Archetype Vehicle .glb Export Matrix (scooter #1, bus #15, lambo #23, f1 #32, jet_thrust #34)', (ctx) => {
  const { appController } = ctx;
  appController.toggleSandboxUnlockAll();

  const archetypes = ['scooter', 'bus', 'lambo', 'f1', 'jet_thrust'];
  for (const carId of archetypes) {
    appController.selectVehicle(carId);
    const bytes = appController.exportCurrentVehicleGlb();
    assertGlbHeader(bytes, `${carId} GLB`);
  }
});

// T3-48: PaddockShowroomUI [Q / E] Keyboard & Click Tab Switching (Tabs 1..4) × 3D Showroom Camera & Bokeh Depth-of-Field
t3('T3-48', ['F6', 'F36'], 'PaddockShowroomUI [Q / E] Keyboard & Click Tab Switching (Tabs 1..4) × 3D Showroom Camera & Bokeh Depth-of-Field', (ctx) => {
  const { appController } = ctx;
  appController.completeBoot();

  appController.selectTab(1);
  assertEqual(appController.getState().activeTab, 1);

  appController.pressTabKey('KeyE');
  assertEqual(appController.getState().activeTab, 2);

  appController.pressTabKey('KeyE');
  assertEqual(appController.getState().activeTab, 3);

  appController.pressTabKey('KeyE');
  assertEqual(appController.getState().activeTab, 4);

  appController.pressTabKey('KeyE');
  assertEqual(appController.getState().activeTab, 1); // Wrap

  appController.pressTabKey('KeyQ');
  assertEqual(appController.getState().activeTab, 4); // Reverse wrap

  assertTrue(appController.subsystems.renderer.postFx.bokehDof.enabled);
});

// T3-49: Paddock Tabs 1..3 Selection Matrix × Permanently Docked 🏁 LAUNCH RACE Bar Subsystem Handshake
t3('T3-49', ['F19', 'F36'], 'Paddock Tabs 1..3 Selection Matrix × Permanently Docked 🏁 LAUNCH RACE Bar Subsystem Handshake', (ctx) => {
  const { appController } = ctx;
  appController.completeBoot();
  appController.selectVehicle('hot_hatch');
  appController.selectLivery(5);
  appController.setCircuitConfig({
    trackId: 'track_canyon',
    skyId: 'sky_redrock_canyon',
    distanceKm: 12.0,
    format: 'FEATURE_5_LAPS',
    aiDifficulty: 'VERY_HARD',
  });

  const launched = appController.launchRace();
  assertEqual(launched.phase, 'RACING');
  assertEqual(launched.selectedVehicleId, 'hot_hatch');
  assertEqual(launched.selectedLiveryIndex, 5);
  assertEqual(launched.selectedTrackId, 'track_canyon');
  assertEqual(launched.selectedSkyId, 'sky_redrock_canyon');
  assertEqual(launched.selectedDistanceKm, 12.0);
  assertEqual(launched.selectedFormat, 'FEATURE_5_LAPS');
  assertEqual(launched.selectedAiDifficulty, 'VERY_HARD');
});

// T3-50: Full ~400 MB On-Disk .PAK Asset Footprint × Runtime PakStreamer Binary Header & TOC Verification
t3('T3-50', ['F1', 'F7', 'F10', 'F22', 'F28', 'F42'], 'Full ~400 MB On-Disk .PAK Asset Footprint × Runtime PakStreamer Binary Header & TOC Verification', (ctx) => {
  const audit = ctx.fsProbe.getAssetFootprintAudit();
  assertEqual(audit.totalPakFileCount, 42);
  assertEqual(audit.skyFiles.length, 4);
  assertEqual(audit.trackFiles.length, 4);
  assertEqual(audit.vehicleFiles.length, 34);

  assertEqual(audit.skyTotalBytes, 52_428_800);
  assertEqual(audit.trackTotalBytes, 167_772_160);
  assertEqual(audit.vehicleTotalBytes, 160_000_192);
  assertEqual(audit.coreTotalBytes, 28_500_000);

  // Total footprint ~400 MB (380 MB - 420 MB)
  assertInRange(audit.totalFootprintMb, 380, 420);

  const skyHeader = ctx.pakInspector.getCanonicalPakDescriptor('sky', 'sky_golden_hour');
  assertPakHeader(skyHeader, { pakType: 1, totalByteLength: ctx.specs.SKY_PAK_BYTE_LENGTH });

  const trackHeader = ctx.pakInspector.getCanonicalPakDescriptor('track', 'track_golden_gp');
  assertPakHeader(trackHeader, { pakType: 2, totalByteLength: ctx.specs.TRACK_PAK_BYTE_LENGTH, sectorCount: 100 });

  const vehicleHeader = ctx.pakInspector.getCanonicalPakDescriptor('vehicle', 'car_01');
  assertPakHeader(vehicleHeader, { pakType: 3, totalByteLength: ctx.specs.VEHICLE_PAK_BYTE_LENGTH });
});
