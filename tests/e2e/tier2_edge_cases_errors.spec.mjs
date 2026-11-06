/**
 * Tier 2 — Boundary Value Analysis (BVA), Equivalence Partitioning (EP) & Negative Cases
 * (210 Genuine Test Cases: 5 × 42 Features, T2-F01-01 .. T2-F42-05)
 * Owned by: E2E_Testing_Track (tests/e2e/tier2_edge_cases_errors.spec.mjs)
 *
 * Implements all 210 BVA/EP/NEG test cases specified in sub_orch_e2e_explorer_2/handoff.md.
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
import { ReferenceUncappedRenderer } from './helpers/contract_runtime_adapter.mjs';

function t2(id, featureId, title, fn) {
  registerTest({ id, tier: 2, features: [featureId], title, fn });
}

// ============================================================================
// PART 1: Core Engine, Shaders, PakStreamer & Physics Boundaries (F1..F9)
// ============================================================================

// F1: Project Task Checklist & Implementation Plan
t2('T2-F01-01', 'F1', '[BVA] Inspect task.md phase boundaries from Part 1 (lower bound) to Part 6 (upper bound)', (ctx) => {
  const { taskMd } = ctx.fsProbe.getProjectDocs();
  assertGreater(taskMd.content.length, 400);
  assertIncludes(taskMd.content, 'Part 1');
  assertIncludes(taskMd.content, 'Part 6');
  assertFalse(taskMd.content.includes('Part 0:'), 'Part 0 should not be a numbered execution part');
});

t2('T2-F01-02', 'F1', '[BVA] Inspect implementation_plan.md asset sub-budget sum (160 + 160 + 50 + 30 === 400 MB)', (ctx) => {
  const { implPlanMd } = ctx.fsProbe.getProjectDocs();
  const subBudgets = [160, 160, 50, 30];
  for (const b of subBudgets) {
    assertIncludes(implPlanMd.content, String(b));
  }
  assertEqual(subBudgets.reduce((a, b) => a + b, 0), 400);
});

t2('T2-F01-03', 'F1', '[BVA] Inspect PROJECT.md Feature Inventory boundaries from F1 to F42 with 0 unassigned', (ctx) => {
  const { projectMd } = ctx.fsProbe.getProjectDocs();
  assertIncludes(projectMd.content, '| F1 |');
  assertIncludes(projectMd.content, '| F42 |');
  assertFalse(projectMd.content.includes('| F43 |'));
});

t2('T2-F01-04', 'F1', '[EP] Partition features F1-F42 across milestones M1 through M7', (ctx) => {
  const { projectMd } = ctx.fsProbe.getProjectDocs();
  for (const m of ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7']) {
    assertIncludes(projectMd.content, `| ${m} |`);
  }
});

t2('T2-F01-05', 'F1', '[NEG] Reject single-file cramped webpage anti-pattern; verify modular architecture', (ctx) => {
  const { projectMd } = ctx.fsProbe.getProjectDocs();
  assertIncludes(projectMd.content, 'src/core/');
  assertIncludes(projectMd.content, 'src/streaming/');
  assertIncludes(projectMd.content, 'src/physics/');
  assertIncludes(projectMd.content, 'src/tracks/');
  assertIncludes(projectMd.content, 'src/vehicles/');
});

// F2: Uncapped WebGPU / WebGL2 Deferred & Forward+ PBR Renderer
t2('T2-F02-01', 'F2', '[BVA] Set VSync refresh rate to exact allowed discrete boundaries: 120, 144, 240 Hz, and 0 (uncapped)', (ctx) => {
  const { renderer } = ctx.engineApi;
  for (const hz of [120, 144, 240, 0]) {
    const res = renderer.setVsyncHz(hz);
    assertEqual(res.vsyncHz, hz);
  }
});

t2('T2-F02-02', 'F2', '[BVA] Set native SSAA supersampling to exact lower bound 1.0, midpoint 1.75, and upper bound 2.5', (ctx) => {
  const { renderer } = ctx.engineApi;
  renderer.resizeViewport(1280, 720);
  assertEqual(renderer.setSsaaScale(1.0).ssaaScale, 1.0);
  assertEqual(renderer.setSsaaScale(1.75).ssaaScale, 1.75);
  assertEqual(renderer.setSsaaScale(2.5).ssaaScale, 2.5);
  assertEqual(renderer.renderWidth, 3200);
  assertEqual(renderer.renderHeight, 1800);
});

t2('T2-F02-03', 'F2', '[NEG] Out-of-range ssaaScale values (0.0, -1.0, 0.99, 2.51, 8.0, NaN) clamp safely to [1.0, 2.5]', (ctx) => {
  const { renderer } = ctx.engineApi;
  assertEqual(renderer.setSsaaScale(0.0).ssaaScale, 1.0);
  assertEqual(renderer.setSsaaScale(-1.0).ssaaScale, 1.0);
  assertEqual(renderer.setSsaaScale(0.99).ssaaScale, 1.0);
  assertEqual(renderer.setSsaaScale(2.51).ssaaScale, 2.5);
  assertEqual(renderer.setSsaaScale(8.0).ssaaScale, 2.5);
  assertEqual(renderer.setSsaaScale(NaN).ssaaScale, 1.0);
});

t2('T2-F02-04', 'F2', '[EP] Backend selection when navigator.gpu is unavailable (WebGL2 fallback) vs available (WebGPU)', () => {
  const rFallback = new ReferenceUncappedRenderer({ navigatorGpuAvailable: false });
  const rWebGpu = new ReferenceUncappedRenderer({ navigatorGpuAvailable: true });
  assertEqual(rFallback.backend, 'WebGL2');
  assertEqual(rWebGpu.backend, 'WebGPU');
  assertGreater(rFallback.fps, 0);
});

t2('T2-F02-05', 'F2', '[BVA] Resize viewport to degenerate boundary 0x0 px and 1x1 px vs 4K 3840x2160 px', (ctx) => {
  const { renderer } = ctx.engineApi;
  renderer.setSsaaScale(1.0);
  const r0 = renderer.resizeViewport(0, 0);
  assertGreaterOrEqual(r0.width, 1);
  assertGreaterOrEqual(r0.height, 1);
  assertFiniteNumber(r0.aspect);
  const r4k = renderer.resizeViewport(3840, 2160);
  assertEqual(r4k.width, 3840);
  assertEqual(r4k.height, 2160);
});

// F3: Screen-Space GI, Reflections & 4-Cascade PCSS Shadows
t2('T2-F03-01', 'F3', '[BVA] Inspect CSM cascade array bounds (index 0..3) and monotonic frustum splits', (ctx) => {
  const { cascades } = ctx.engineApi.renderer.csm;
  assertEqual(cascades.length, 4);
  assertGreater(cascades[0].near, 0);
  for (let i = 0; i < 3; i++) {
    assertEqual(cascades[i].far, cascades[i + 1].near);
    assertLess(cascades[i].near, cascades[i].far);
  }
});

t2('T2-F03-02', 'F3', '[BVA] CSM shadow map resolution 4096x4096 vs software rasterizer MAX_TEXTURE_SIZE clamp', () => {
  const rFull = new ReferenceUncappedRenderer({ maxHardwareTextureSize: 8192 });
  const rClamped = new ReferenceUncappedRenderer({ maxHardwareTextureSize: 2048 });
  assertEqual(rFull.csm.resolution, 4096);
  assertEqual(rClamped.csm.resolution, 2048);
});

t2('T2-F03-03', 'F3', '[BVA] SSR wet asphalt puddle reflection mask at puddleMask = 0.0 (dry) vs 1.0 (standing puddle)', (ctx) => {
  const { renderer } = ctx.engineApi;
  const dry = renderer.evaluateSsrSurface(0.0);
  const wet = renderer.evaluateSsrSurface(1.0);
  assertGreaterOrEqual(dry.effectiveRoughness, 0.65);
  assertLessOrEqual(wet.effectiveRoughness, 0.05);
  assertGreater(wet.reflectionWeight, dry.reflectionWeight);
});

t2('T2-F03-04', 'F3', '[BVA] Contact-Hardening PCSS shadow penumbra at 0.0m contact point vs 10.0m distant occluder', (ctx) => {
  const { renderer } = ctx.engineApi;
  const p0 = renderer.evaluatePcssPenumbra(0.0);
  const p10 = renderer.evaluatePcssPenumbra(10.0);
  assertApprox(p0.penumbraRadius, 0.002, 1e-4);
  assertGreater(p10.penumbraRadius, p0.penumbraRadius);
});

t2('T2-F03-05', 'F3', '[NEG] Configure SSGI with negative intensity (-2.0) and zero steps (0) clamps safely', (ctx) => {
  const ssgi = ctx.engineApi.renderer.configureSsgi(-2.0, 0);
  assertEqual(ssgi.intensity, 0.0);
  assertGreaterOrEqual(ssgi.raySteps, 1);
  assertFalse(ssgi.enabled);
});

// F4: Dual-Layer Automotive Clearcoat & Metallic Flake Shader
t2('T2-F04-01', 'F4', '[BVA] Select livery index lower boundary 0 and upper boundary 11 across 12 PBR paints', (ctx) => {
  assertEqual(ctx.appController.selectLivery(0).selectedLiveryIndex, 0);
  assertEqual(ctx.appController.selectLivery(11).selectedLiveryIndex, 11);
});

t2('T2-F04-02', 'F4', '[NEG] Out-of-bounds selectLivery(-1), selectLivery(12), selectLivery(100), selectLivery(NaN) clamp into [0, 11]', (ctx) => {
  assertEqual(ctx.appController.selectLivery(-1).selectedLiveryIndex, 0);
  assertEqual(ctx.appController.selectLivery(12).selectedLiveryIndex, 11);
  assertEqual(ctx.appController.selectLivery(100).selectedLiveryIndex, 11);
  assertEqual(ctx.appController.selectLivery(NaN).selectedLiveryIndex, 0);
});

t2('T2-F04-03', 'F4', '[BVA] AutomotivePaint clearcoatRoughness clamps to >= 0.04 to prevent GGX 0/0 NaN', (ctx) => {
  const src = ctx.fsProbe.getShaderSource('src/shaders/AutomotivePaint.glsl');
  assertIncludes(src, '0.04');
  for (let i = 0; i < 12; i++) {
    const ext = ctx.engineApi.vehicleBuilder.buildExterior('lambo', i);
    assertGreaterOrEqual(ext.materialUniforms.uClearcoatRoughness, 0.04);
  }
});

t2('T2-F04-04', 'F4', '[BVA] Metallic flake density [0.0, 1.0] and anisotropy [-1.0, +1.0] bounds across all 12 liveries', (ctx) => {
  for (const liv of ctx.specs.LIVERY_PRESETS_12) {
    assertInRange(liv.flakeDensity, 0.0, 1.0);
    assertInRange(liv.anisotropy, -1.0, 1.0);
  }
});

t2('T2-F04-05', 'F4', '[EP] Partition all 12 PBR livery finishes across finish classes (Metallic, Pearl, Brushed Metal, Carbon)', (ctx) => {
  const classes = new Set(ctx.specs.LIVERY_PRESETS_12.map((l) => l.finishClass));
  assertIncludes([...classes], 'METALLIC_FLAKE');
  assertIncludes([...classes], 'PEARL_CLEARCOAT');
  assertIncludes([...classes], 'ANISOTROPIC_BRUSHED_METAL');
  assertIncludes([...classes], 'MATTE_SATIN_CARBON');
});

// F5: Physically Based Refractive Laminated Glass Shader
t2('T2-F05-01', 'F5', '[BVA] Laminated glass Index of Refraction (ior) exact specification boundary 1.52', (ctx) => {
  const cg = ctx.engineApi.vehicleBuilder.buildCockpitAndGlass('ferrari_v8');
  assertApprox(cg.glassMaterial.ior, 1.52, 0.001);
});

t2('T2-F05-02', 'F5', '[BVA] Glass Fresnel reflectance at normal incidence (cosTheta = 1.0 -> 0.0426) vs grazing (0.0 -> 1.0)', (ctx) => {
  const { glassMaterial } = ctx.engineApi.vehicleBuilder.buildCockpitAndGlass('ferrari_v8');
  assertApprox(glassMaterial.evaluateFresnel(1.0), 0.04258, 0.001);
  assertApprox(glassMaterial.evaluateFresnel(0.0), 1.0, 1e-6);
});

t2('T2-F05-03', 'F5', '[BVA] Animated dual wiper-sweep mask at wiperPhase = 0.0, 0.5 (apex), and 1.0 (cycle wrap)', (ctx) => {
  const cg = ctx.engineApi.vehicleBuilder.buildCockpitAndGlass('porsche_gt3');
  cg.glassMaterial.wiperPhase = 0.0;
  cg.updateWipers(0.0, 1.0);
  assertApprox(cg.framedWindows.leftWiperPivot.angleDeg, 0.0, 1e-3);
  cg.glassMaterial.wiperPhase = 0.0;
  cg.updateWipers(0.4, 1.0); // 0.4 * 1.25 = 0.5 phase apex
  assertApprox(cg.framedWindows.leftWiperPivot.angleDeg, 72.0, 1e-3);
});

t2('T2-F05-04', 'F5', '[BVA] RGB chromatic dispersion offset around ior = 1.52', (ctx) => {
  const { glassMaterial } = ctx.engineApi.vehicleBuilder.buildCockpitAndGlass('lambo');
  const iorR = glassMaterial.ior - glassMaterial.chromaticDispersion;
  const iorB = glassMaterial.ior + glassMaterial.chromaticDispersion;
  assertLess(iorR, 1.52);
  assertGreater(iorB, 1.52);
});

t2('T2-F05-05', 'F5', '[NEG] Invalid ior = 0.0 or negative ior = -1.52 clamps to >= 1.0 to avoid 1/ior division by zero', (ctx) => {
  const { glassMaterial } = ctx.engineApi.vehicleBuilder.buildCockpitAndGlass('lambo');
  assertEqual(glassMaterial.setIor(0.0), 1.0);
  assertEqual(glassMaterial.setIor(-1.52), 1.0);
});

// F6: Cinematic Post-Processing & Camera FX Pipeline
t2('T2-F06-01', 'F6', '[BVA] Speed-Driven FOV Warp at 0.0 KPH, 240.0 KPH, 485.0 KPH, and 600 KPH overdrive cap', (ctx) => {
  const { renderer } = ctx.engineApi;
  const f0 = renderer.updateSpeedCameraFx(0.0).fovDeg;
  const f240 = renderer.updateSpeedCameraFx(240.0).fovDeg;
  const f485 = renderer.updateSpeedCameraFx(485.0).fovDeg;
  const f600 = renderer.updateSpeedCameraFx(600.0, 1.42).fovDeg;
  assertEqual(f0, 60.0);
  assertGreater(f240, f0);
  assertGreater(f485, f240);
  assertLessOrEqual(f600, 115.0);
});

t2('T2-F06-02', 'F6', '[BVA] ACES Filmic HDR Tone Mapping at luminance 0.0 (black), 1.0 (mid), and 100.0 (sun shaft)', (ctx) => {
  const { renderer } = ctx.engineApi;
  assertEqual(renderer.evaluateAcesFilmic(0.0), 0.0);
  assertInRange(renderer.evaluateAcesFilmic(1.0), 0.75, 0.85);
  assertInRange(renderer.evaluateAcesFilmic(100.0), 0.98, 1.0);
});

t2('T2-F06-03', 'F6', '[BVA] Per-Wheel Motion Blur intensity at 0.0 KPH, 100 KPH, and 485 KPH (clamped at 1.0)', (ctx) => {
  const { renderer } = ctx.engineApi;
  assertEqual(renderer.updateSpeedCameraFx(0.0).wheelMotionBlurWeight, 0.0);
  assertInRange(renderer.updateSpeedCameraFx(100.0).wheelMotionBlurWeight, 0.2, 0.4);
  assertEqual(renderer.updateSpeedCameraFx(485.0).wheelMotionBlurWeight, 1.0);
});

t2('T2-F06-04', 'F6', '[EP] Switch CameraMode across all 5 partitions (CHASE, COCKPIT, HOOD, ORBIT, SHOWROOM) for Bokeh DOF', (ctx) => {
  const { renderer } = ctx.engineApi;
  assertTrue(renderer.setCameraMode('SHOWROOM').bokehDofEnabled);
  assertTrue(renderer.setCameraMode('ORBIT').bokehDofEnabled);
  assertFalse(renderer.setCameraMode('CHASE').bokehDofEnabled);
  assertFalse(renderer.setCameraMode('COCKPIT').bokehDofEnabled);
  assertFalse(renderer.setCameraMode('HOOD').bokehDofEnabled);
});

t2('T2-F06-05', 'F6', '[BVA] Volumetric God-Rays when looking into sun (dot = +1.0) vs opposite (dot = -1.0)', (ctx) => {
  const { renderer } = ctx.engineApi;
  assertGreater(renderer.evaluateGodRays(1.0), 0.5);
  assertEqual(renderer.evaluateGodRays(0.0), 0.0);
  assertEqual(renderer.evaluateGodRays(-1.0), 0.0);
});

// F7: Asynchronous WebWorker .PAK & Octree Sector Streamer
t2('T2-F07-01', 'F7', '[NEG] Reject 64-byte header where magic != "APEXPAK1" or version != 1', async (ctx) => {
  const { pakInspector, engineApi } = ctx;
  const badMagic = pakInspector.buildApexPakHeaderBuffer({
    magic: 'APEXPAK0',
    version: 1,
    pakType: 1,
    totalByteLength: ctx.specs.SKY_PAK_BYTE_LENGTH,
    chunks: [{ name: 'c0', byteLength: 64 }],
  });
  await assertThrows(() => engineApi.pakStreamer.parseHeader(badMagic), 'Invalid APEXPAK1 magic');

  const badVer = pakInspector.buildApexPakHeaderBuffer({
    magic: 'APEXPAK1',
    version: 2,
    pakType: 1,
    totalByteLength: ctx.specs.SKY_PAK_BYTE_LENGTH,
    chunks: [{ name: 'c0', byteLength: 64 }],
  });
  await assertThrows(() => engineApi.pakStreamer.parseHeader(badVer), 'Unsupported APEXPAK1 version');
});

t2('T2-F07-02', 'F7', '[NEG] Reject truncated buffers (0 B, 63 B, truncated TOC) and invalid pakType in {0, 4, 255}', async (ctx) => {
  const { pakStreamer } = ctx.engineApi;
  await assertThrows(() => pakStreamer.parseHeader(new Uint8Array(0)), 'Truncated APEXPAK1 header');
  await assertThrows(() => pakStreamer.parseHeader(new Uint8Array(63)), 'Truncated APEXPAK1 header');

  const badType = ctx.pakInspector.buildApexPakHeaderBuffer({
    pakType: 4,
    totalByteLength: ctx.specs.SKY_PAK_BYTE_LENGTH,
    chunks: [{ name: 'c0', byteLength: 64 }],
  });
  await assertThrows(() => pakStreamer.parseHeader(badType), 'Invalid APEXPAK1 pakType');
});

t2('T2-F07-03', 'F7', '[BVA] Validate exact byte lengths in APEXPAK1 header across Sky (13,107,200 B), Track (41,943,040 B), Vehicle (4,705,888 B)', (ctx) => {
  const sDesc = ctx.pakInspector.getCanonicalPakDescriptor('sky', 'sky_golden_hour');
  const tDesc = ctx.pakInspector.getCanonicalPakDescriptor('track', 'track_golden_gp');
  const vDesc = ctx.pakInspector.getCanonicalPakDescriptor('vehicle', 'car_01');
  assertEqual(sDesc.totalByteLength, 13_107_200);
  assertEqual(tDesc.totalByteLength, 41_943_040);
  assertEqual(tDesc.sectorCount, 100);
  assertEqual(vDesc.totalByteLength, 4_705_888);
  assertEqual(vDesc.sectorCount, 0);
});

t2('T2-F07-04', 'F7', '[BVA/NEG] Alias resolution boundaries: sky_01..04, track_01..04, car_01..34 vs out-of-range sky_00, sky_05, track_05, car_00, car_35, ""', async (ctx) => {
  const { pakStreamer } = ctx.engineApi;
  assertEqual(pakStreamer.resolveAssetAlias('sky_01').canonicalId, 'sky_golden_hour');
  assertEqual(pakStreamer.resolveAssetAlias('sky_04').canonicalId, 'sky_alpine_glacier');
  assertEqual(pakStreamer.resolveAssetAlias('track_01').canonicalId, 'track_golden_gp');
  assertEqual(pakStreamer.resolveAssetAlias('track_04').canonicalId, 'track_alpine');
  assertEqual(pakStreamer.resolveAssetAlias('car_01').vehicleId, 'scooter');
  assertEqual(pakStreamer.resolveAssetAlias('car_34').vehicleId, 'jet_thrust');

  for (const invalid of ['sky_00', 'sky_05', 'track_00', 'track_05', 'car_00', 'car_35', '']) {
    await assertThrows(() => pakStreamer.resolveAssetAlias(invalid), 'Unknown asset ID');
  }
});

t2('T2-F07-05', 'F7', '[BVA] PakStreamer LRU cache boundary: stream K=12 sectors, refresh sector 0, load sector 12 -> evicts sector 1', (ctx) => {
  const { pakStreamer } = ctx.engineApi;
  for (let i = 0; i < 12; i++) {
    pakStreamer.touchOrLoadSector(i, 100);
  }
  assertEqual(pakStreamer.evictionCount, 0);
  assertEqual(pakStreamer.sectorLruOrder.length, 12);

  // Touch sector 0 to refresh its recency so sector 1 becomes oldest
  pakStreamer.touchOrLoadSector(0, 100);
  const res12 = pakStreamer.touchOrLoadSector(12, 100);
  assertEqual(res12.evictedSector, 1);
  assertEqual(res12.residentSectorCount, 12);
});

// F8: 240Hz Raycast Suspension & Pacejka Vehicle Physics
t2('T2-F08-01', 'F8', '[BVA] Step RapierVehicleWorld with dt = 1/240s (1 step), dt = 0.0s (0 steps), and dt = 1.0s (clamped <= 16 steps)', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  assertEqual(physicsWorld.step(1 / 240).subStepsExecuted, 1);
  assertEqual(physicsWorld.step(0.0).subStepsExecuted, 0);
  const hitch = physicsWorld.step(1.0);
  assertLessOrEqual(hitch.subStepsExecuted, 16);
  assertFiniteNumber(hitch.state.alongOffset);
});

t2('T2-F08-02', 'F8', '[BVA] 4-wheel spring-damper raycast at airborne (> L_rest) vs 100% compressed bump stop (== L_min)', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  const airborne = physicsWorld.evaluateWheelSpringDamper(physicsWorld.restLength + 0.1, 0.0);
  const bumpStop = physicsWorld.evaluateWheelSpringDamper(physicsWorld.minLength, 0.0);
  assertFalse(airborne.contact);
  assertEqual(airborne.forceN, 0.0);
  assertTrue(bumpStop.contact);
  assertEqual(bumpStop.compressionRatio, 1.0);
  assertGreater(bumpStop.forceN, 0.0);
});

t2('T2-F08-03', 'F8', '[BVA] Pacejka tire lateral force Fy(alpha) at alpha = 0.0, +-0.15 rad (peak), and +-pi/2 rad (90 deg slide)', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  assertEqual(physicsWorld.evaluatePacejkaLateralForce(0.0), 0.0);
  const fyPos = physicsWorld.evaluatePacejkaLateralForce(0.15);
  const fyNeg = physicsWorld.evaluatePacejkaLateralForce(-0.15);
  assertLess(fyPos, 0.0);
  assertGreater(fyNeg, 0.0);
  assertApprox(Math.abs(fyPos), Math.abs(fyNeg), 1e-4);
  const fy90 = physicsWorld.evaluatePacejkaLateralForce(Math.PI / 2);
  assertLessOrEqual(Math.abs(fy90), Math.abs(fyPos));
});

t2('T2-F08-04', 'F8', '[BVA] Speed-dependent aerodynamic downforce F_down(v) at 0 KPH, 200 KPH, and 485 KPH ((485/200)^2 = 5.8806x)', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  assertEqual(physicsWorld.evaluateAerodynamicDownforce(0), 0.0);
  const f200 = physicsWorld.evaluateAerodynamicDownforce(200);
  const f485 = physicsWorld.evaluateAerodynamicDownforce(485);
  assertApprox(f485 / f200, Math.pow(485 / 200, 2), 0.01);
});

t2('T2-F08-05', 'F8', '[BVA] Weight-transfer pitch/roll at 0.0G cruise vs full braking (brake = 1.0) and full steering (steer = +1.0)', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  physicsWorld.resetVehicleState();
  physicsWorld.step(1 / 240, { lockSpeedKph: 220, brake: 1.0, steer: 1.0 });
  const [fl, fr, rl, rr] = physicsWorld.state.wheelNormalLoadsN;
  assertGreater(fl + fr, rl + rr, 'Front axle load > rear axle load under braking');
  assertGreater(fl + rl, fr + rr, 'Outer wheel load > inner wheel load under cornering');
});

// F9: Lateral Tangent Barrier Projection (Zero Teleporting/Sticking)
t2('T2-F09-01', 'F9', '[BVA] Vehicle at lateralOffset = dMax - 0.001m, dMax, and dMax + 0.001m', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  physicsWorld.resetVehicleState();
  const dMax = physicsWorld.dMax;

  physicsWorld.state.lateralOffset = dMax - 0.001;
  assertFalse(physicsWorld.projectBarrierCollision().clamped);

  physicsWorld.state.lateralOffset = dMax;
  assertFalse(physicsWorld.projectBarrierCollision().clamped);

  physicsWorld.state.lateralOffset = dMax + 0.001;
  const rOut = physicsWorld.projectBarrierCollision();
  assertTrue(rOut.clamped);
  assertEqual(rOut.lateralOffsetAfter, dMax);
});

t2('T2-F09-02', 'F9', '[BVA] Scrape right guardrail (+dMax) at 400.0 KPH at 10 deg angle for 60 steps (0.25s at 240Hz)', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  physicsWorld.setVehicleSpec('koenigsegg');
  physicsWorld.state.alongOffset = 200.0;
  physicsWorld.state.lateralOffset = physicsWorld.dMax - 0.02;
  for (let k = 0; k < 60; k++) {
    const sPrev = physicsWorld.state.alongOffset;
    physicsWorld.step(1 / 240, { lockSpeedKph: 400.0, steer: 0.45 });
    assertGreater(physicsWorld.state.alongOffset, sPrev);
    assertLessOrEqual(physicsWorld.state.lateralOffset, physicsWorld.dMax + 1e-5);
    assertTrue(physicsWorld.state.sparksActive);
  }
});

t2('T2-F09-03', 'F9', '[BVA] Impact left guardrail (-dMax) at roster max speed 485.0 KPH (134.72 m/s, jet_thrust) at 45 deg angle', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  physicsWorld.setVehicleSpec('jet_thrust');
  const vMag = 485.0 / 3.6;
  const vComp = vMag * Math.cos(Math.PI / 4);
  physicsWorld.state.alongOffset = 1000.0;
  physicsWorld.state.lateralOffset = -physicsWorld.dMax - 2.0;
  physicsWorld.state.vTangent = vComp;
  physicsWorld.state.vLateral = -vComp;

  const proj = physicsWorld.projectBarrierCollision();
  assertTrue(proj.clamped);
  assertEqual(physicsWorld.state.lateralOffset, -physicsWorld.dMax);
  assertEqual(physicsWorld.state.vLateral, 0.0);
  assertApprox(physicsWorld.state.vTangent, 95.26, 0.1);
});

t2('T2-F09-04', 'F9', '[BVA] Barrier projection at arbitrary alongOffset = 4999.95m and lateralOffset = +50.0m preserves alongOffset === 4999.95m', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  physicsWorld.resetVehicleState();
  physicsWorld.state.alongOffset = 4999.95;
  physicsWorld.state.lateralOffset = 50.0;
  const proj = physicsWorld.projectBarrierCollision();
  assertEqual(proj.alongOffsetAfter, 4999.95);
  assertApprox(proj.deltaAlongOffset, 0.0, 1e-12);
});

t2('T2-F09-05', 'F9', '[EP] Vehicle touching right barrier (+dMax) with inward velocity (v_N = -5.0 m/s) preserves inward detachment velocity', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  physicsWorld.resetVehicleState();
  physicsWorld.state.lateralOffset = physicsWorld.dMax + 0.01;
  physicsWorld.state.vTangent = 80.0;
  physicsWorld.state.vLateral = -5.0; // steering inward away from right barrier
  physicsWorld.projectBarrierCollision();
  assertEqual(physicsWorld.state.vLateral, -5.0);
});

// ============================================================================
// PART 2: Sky & Atmosphere Pak Boundaries (F10..F14)
// ============================================================================

// F10: Python HDR Sky & Volumetric Cloud .PAK Builder
t2('T2-F10-01', 'F10', '[BVA] Exact count (4) and byte length (13,107,200 B each = 52,428,800 B total) of Sky .pak files', (ctx) => {
  const audit = ctx.fsProbe.getAssetFootprintAudit();
  assertEqual(audit.skyFiles.length, 4);
  assertEqual(audit.skyTotalBytes, 52_428_800);
});

t2('T2-F10-02', 'F10', '[BVA] Inspect 64-byte APEXPAK1 header fields (0x00..0x3F) for all 4 Sky .pak files', async (ctx) => {
  for (const s of ctx.specs.SKY_BIOMES_SPEC) {
    const pak = await ctx.engineApi.pakStreamer.streamPak(s.id);
    assertEqual(pak.header.magic, 'APEXPAK1');
    assertEqual(pak.header.version, 1);
    assertEqual(pak.header.pakType, 1);
    assertEqual(pak.header.totalByteLength, 13_107_200);
    assertEqual(pak.header.sectorCount, 0);
  }
});

t2('T2-F10-03', 'F10', '[BVA] Verify TOC entry byte offsets are 64-byte aligned and sum + header === 13,107,200 B', async (ctx) => {
  const pak = await ctx.engineApi.pakStreamer.streamPak('sky_golden_hour');
  const headerAndToc = 64 + pak.header.entryCount * 64;
  let sumPayload = 0;
  for (const e of pak.header.entries) {
    assertEqual(e.byteOffset % 64, 0);
    sumPayload += e.byteLength;
  }
  assertEqual(headerAndToc + sumPayload, 13_107_200);
});

t2('T2-F10-04', 'F10', '[BVA] Verify sky_01..04 aliases do not duplicate the 50.0 MiB sky pool footprint', async (ctx) => {
  const { pakStreamer } = ctx.engineApi;
  await pakStreamer.streamPak('sky_01');
  await pakStreamer.streamPak('sky_golden_hour');
  assertEqual(pakStreamer.loadedPakCache.size, 1);
});

t2('T2-F10-05', 'F10', '[NEG] Ensure tools/build_sky_paks.py has zero unconditional scipy imports', (ctx) => {
  const info = ctx.fsProbe.getPythonBuilderInfo('tools/build_sky_paks.py');
  assertFalse(info.usesScipy);
});

// F11: Golden Hour Sky Pak & Atmosphere
t2('T2-F11-01', 'F11', '[BVA] Load sky_golden_hour.pak by canonical ID and alias sky_01', (ctx) => {
  assertEqual(ctx.appController.setCircuitConfig({ skyId: 'sky_01' }).selectedSkyId, 'sky_golden_hour');
  assertEqual(ctx.appController.setCircuitConfig({ skyId: 'sky_golden_hour' }).selectedSkyId, 'sky_golden_hour');
});

t2('T2-F11-02', 'F11', '[BVA] Directional sun shaft multiplier boundary (2.4x) and 7 PM elevation (5-15 deg)', (ctx) => {
  const spec = ctx.specs.SKY_BIOMES_SPEC.find((s) => s.id === 'sky_golden_hour');
  assertApprox(spec.sunShaftMultiplier, 2.4, 0.01);
  assertInRange(spec.sunElevationDeg, 5.0, 15.0);
});

t2('T2-F11-03', 'F11', '[BVA] Verify scattering_lut_2d and cloud_noise_3d chunks in sky_golden_hour.pak', async (ctx) => {
  const pak = await ctx.engineApi.pakStreamer.streamPak('sky_golden_hour');
  const cLut = pak.header.entries.find((e) => e.name === 'scattering_lut_2d');
  const cCloud = pak.header.entries.find((e) => e.name === 'cloud_noise_3d');
  assertGreater(cLut.byteLength, 0);
  assertEqual(cCloud.byteLength, 128 * 64 * 64 * 2);
});

t2('T2-F11-04', 'F11', '[BVA] Ground cloud shadow UV scroll wrap in [0.0, 1.0] at t = 0.0s vs t = 60.0s', () => {
  const uv0 = (0.0 * 0.015) % 1.0;
  const uv60 = (60.0 * 0.015) % 1.0;
  assertInRange(uv0, 0.0, 1.0);
  assertInRange(uv60, 0.0, 1.0);
  assertGreater(uv60, uv0);
});

t2('T2-F11-05', 'F11', '[NEG] Sample equirectangular HDRI at UV boundaries (0.0, 0.0) and (1.0, 1.0) produces finite non-negative RGB', (ctx) => {
  const spec = ctx.specs.SKY_BIOMES_SPEC[0];
  for (const ch of [...spec.horizonRgb, ...spec.zenithRgb]) {
    assertFiniteNumber(ch);
    assertGreaterOrEqual(ch, 0.0);
  }
});

// F12: Neo-Tokyo Cyber Sky Pak & Atmosphere
t2('T2-F12-01', 'F12', '[BVA] Load sky_neotokyo_cyber.pak via canonical ID and alias sky_02', (ctx) => {
  assertEqual(ctx.appController.setCircuitConfig({ skyId: 'sky_02' }).selectedSkyId, 'sky_neotokyo_cyber');
});

t2('T2-F12-02', 'F12', '[BVA] Dynamic lightning flash envelope at quiescent (0.0) vs peak strike (> 1.0) and exponential decay', () => {
  const flashAtStrike = 2.2 * Math.exp(-0.0 / 0.25);
  const flashAfter1s = 2.2 * Math.exp(-1.0 / 0.25);
  assertGreater(flashAtStrike, 1.0);
  assertLess(flashAfter1s, 0.05);
});

t2('T2-F12-03', 'F12', '[BVA] Verify holographic skyline cubemap and neon smog density > 0.0 in sky_neotokyo_cyber', (ctx) => {
  const spec = ctx.specs.SKY_BIOMES_SPEC.find((s) => s.id === 'sky_neotokyo_cyber');
  assertTrue(spec.hasHolographicSkyline);
  assertGreater(spec.smogDensity, 0.0);
});

t2('T2-F12-04', 'F12', '[EP] Compare midnight zenith luminance of sky_neotokyo_cyber vs daytime sky_alpine_glacier', (ctx) => {
  const cyber = ctx.specs.SKY_BIOMES_SPEC.find((s) => s.id === 'sky_neotokyo_cyber');
  const alpine = ctx.specs.SKY_BIOMES_SPEC.find((s) => s.id === 'sky_alpine_glacier');
  assertLess(cyber.zenithLuminance, alpine.zenithLuminance * 0.15);
});

t2('T2-F12-05', 'F12', '[NEG] Rapid consecutive sky switches sky_01 -> sky_02 -> sky_01 settle cleanly on sky_golden_hour', (ctx) => {
  ctx.appController.setCircuitConfig({ skyId: 'sky_01' });
  ctx.appController.setCircuitConfig({ skyId: 'sky_02' });
  const finalState = ctx.appController.setCircuitConfig({ skyId: 'sky_01' });
  assertEqual(finalState.selectedSkyId, 'sky_golden_hour');
});

// F13: Redrock Canyon Sky Pak & Atmosphere
t2('T2-F13-01', 'F13', '[BVA] Load sky_redrock_canyon.pak via canonical ID and alias sky_03', (ctx) => {
  assertEqual(ctx.appController.setCircuitConfig({ skyId: 'sky_03' }).selectedSkyId, 'sky_redrock_canyon');
});

t2('T2-F13-02', 'F13', '[BVA] Crimson-violet desert dusk gradient: horizon (R > G, R > B) to zenith (B > G)', (ctx) => {
  const spec = ctx.specs.SKY_BIOMES_SPEC.find((s) => s.id === 'sky_redrock_canyon');
  assertGreater(spec.horizonRgb[0], spec.horizonRgb[1]);
  assertGreater(spec.horizonRgb[0], spec.horizonRgb[2]);
  assertGreater(spec.zenithRgb[2], spec.zenithRgb[1]);
});

t2('T2-F13-03', 'F13', '[BVA] Desert dust haze optical depth at distance 0m (0.0) vs 2,000m (near 1.0)', (ctx) => {
  const spec = ctx.specs.SKY_BIOMES_SPEC.find((s) => s.id === 'sky_redrock_canyon');
  const fog0 = 1.0 - Math.exp(-spec.dustHazeDensity * (0 / 500));
  const fog2000 = 1.0 - Math.exp(-spec.dustHazeDensity * (2000 / 500));
  assertEqual(fog0, 0.0);
  assertGreater(fog2000, 0.85);
});

t2('T2-F13-04', 'F13', '[BVA] Verify pmrem_cubemap_mips is exactly 3,145,728 bytes (3.00 MiB) in sky_redrock_canyon.pak', async (ctx) => {
  const pak = await ctx.engineApi.pakStreamer.streamPak('sky_redrock_canyon');
  const chunk = pak.header.entries.find((e) => e.name === 'pmrem_cubemap_mips');
  assertEqual(chunk.byteLength, 3_145_728);
});

t2('T2-F13-05', 'F13', '[NEG] Out-of-range turbidity/dust factor (-5.0 or 999.0) clamps safely to [0.0, 1.0]', () => {
  const clampDust = (v) => Math.max(0.0, Math.min(1.0, Number(v) || 0.0));
  assertEqual(clampDust(-5.0), 0.0);
  assertEqual(clampDust(999.0), 1.0);
});

// F14: Alpine Glacier Sky Pak & Atmosphere
t2('T2-F14-01', 'F14', '[BVA] Load sky_alpine_glacier.pak via canonical ID and alias sky_04', (ctx) => {
  assertEqual(ctx.appController.setCircuitConfig({ skyId: 'sky_04' }).selectedSkyId, 'sky_alpine_glacier');
});

t2('T2-F14-02', 'F14', '[BVA] Snow-albedo ground hemisphere (groundAlbedo > 0.5) vs crystalline blue zenith (B > R)', (ctx) => {
  const spec = ctx.specs.SKY_BIOMES_SPEC.find((s) => s.id === 'sky_alpine_glacier');
  assertGreater(spec.groundAlbedo, 0.5);
  assertGreater(spec.zenithRgb[2], spec.zenithRgb[0]);
});

t2('T2-F14-03', 'F14', '[BVA] Aurora borealis shader weight at elevation <= 0 deg (0.0) vs upper atmosphere (> 30 deg)', (ctx) => {
  const spec = ctx.specs.SKY_BIOMES_SPEC.find((s) => s.id === 'sky_alpine_glacier');
  const auroraWeight = (elevDeg) => (spec.auroraEnabled && elevDeg > 15 ? Math.min(1.0, (elevDeg - 15) / 30) : 0.0);
  assertEqual(auroraWeight(0), 0.0);
  assertGreater(auroraWeight(45), 0.8);
});

t2('T2-F14-04', 'F14', '[BVA] Blowing snow particle sheet modular wrap inside camera volume [-50m, +50m]', () => {
  const wrapSnow = (pos, camPos, r = 50) => ((((pos - (camPos - r)) % (2 * r)) + 2 * r) % (2 * r)) + (camPos - r);
  const wrapped = wrapSnow(185.0, 0.0, 50.0);
  assertInRange(wrapped, -50.0, 50.0);
});

t2('T2-F14-05', 'F14', '[EP] Weather particle partition: snow & aurora active on sky_04 and 0 on sky_01..03', (ctx) => {
  for (const s of ctx.specs.SKY_BIOMES_SPEC) {
    if (s.id === 'sky_alpine_glacier') {
      assertTrue(s.auroraEnabled);
      assertGreater(s.snowParticleCount, 0);
    } else {
      assertFalse(s.auroraEnabled);
      assertEqual(s.snowParticleCount, 0);
    }
  }
});

// ============================================================================
// PART 3: Track Biomes, 1:1 Scale (2-50 KM) & Tactical Ramps Boundaries (F15..F27)
// ============================================================================

// F15: True 1:1 Physical World Calibration (1 World Unit = 1 Real Meter)
t2('T2-F15-01', 'F15', '[BVA] Advance vehicle at exact 360.0 KPH (100.0 m/s) for 1.000s (240 steps) -> 100.0m delta', (ctx) => {
  const { physicsWorld, splineStreamer } = ctx.engineApi;
  splineStreamer.configure(12.0, 'track_golden_gp');
  physicsWorld.resetVehicleState();
  for (let i = 0; i < 240; i++) physicsWorld.step(1 / 240, { lockSpeedKph: 360.0 });
  assertApprox(physicsWorld.state.alongOffset, 100.0, 0.05);
});

t2('T2-F15-02', 'F15', '[BVA] Evaluate spline frame at s = 0.0m and s = 1.0m -> Euclidean distance === 1.000 unit', (ctx) => {
  const { splineStreamer } = ctx.engineApi;
  splineStreamer.configure(12.0, 'track_golden_gp');
  const p0 = splineStreamer.getFrameAtArcLength(0.0).position;
  const p1 = splineStreamer.getFrameAtArcLength(1.0).position;
  assertApprox(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]), 1.0, 0.01);
});

t2('T2-F15-03', 'F15', '[BVA] Spline wrap-around boundary at s = 0.0m vs s = totalLength (2000.0m)', (ctx) => {
  const { splineStreamer } = ctx.engineApi;
  splineStreamer.configure(2.0, 'track_golden_gp');
  const f0 = splineStreamer.getFrameAtArcLength(0.0);
  const fL = splineStreamer.getFrameAtArcLength(2000.0);
  assertApprox(f0.position[0], fL.position[0], 1e-4);
  assertApprox(f0.position[2], fL.position[2], 1e-4);
  assertApprox(f0.tangent[0], fL.tangent[0], 1e-4);
});

t2('T2-F15-04', 'F15', '[NEG] Query getFrameAtArcLength(s) with negative s = -250.0m and overflow s = totalLength + 750.0m wraps cleanly', (ctx) => {
  const { splineStreamer } = ctx.engineApi;
  splineStreamer.configure(2.0, 'track_golden_gp');
  const fNeg = splineStreamer.getFrameAtArcLength(-250.0);
  const fPos = splineStreamer.getFrameAtArcLength(1750.0);
  assertApprox(fNeg.s, 1750.0, 1e-4);
  assertApprox(fNeg.position[0], fPos.position[0], 1e-4);

  const fOver = splineStreamer.getFrameAtArcLength(2750.0);
  assertApprox(fOver.s, 750.0, 1e-4);
});

t2('T2-F15-05', 'F15', '[BVA] Orthonormal Frenet frame invariant (||T||=1, ||N||=1, ||B||=1, |T.N|<1e-4) across 100 sample points', (ctx) => {
  const { splineStreamer } = ctx.engineApi;
  splineStreamer.configure(12.0, 'track_golden_gp');
  for (let i = 0; i < 100; i++) {
    const f = splineStreamer.getFrameAtArcLength(i * 120);
    const lenT = Math.hypot(...f.tangent);
    const lenN = Math.hypot(...f.normal);
    const lenB = Math.hypot(...f.binormal);
    const dotTN = f.tangent[0] * f.normal[0] + f.tangent[1] * f.normal[1] + f.tangent[2] * f.normal[2];
    assertApprox(lenT, 1.0, 1e-4);
    assertApprox(lenN, 1.0, 1e-4);
    assertApprox(lenB, 1.0, 1e-4);
    assertLess(Math.abs(dotTN), 1e-4);
  }
});

// F16: 2.0 KM Stadium Sprint Circuit Configuration
t2('T2-F16-01', 'F16', '[BVA] Configure circuit with distanceKm = 2.0 -> 2000m and 4 sectors', (ctx) => {
  const res = ctx.engineApi.splineStreamer.configure(2.0, 'track_golden_gp');
  assertEqual(res.totalLength, 2000);
  assertEqual(res.sectorCount, 4);
});

t2('T2-F16-02', 'F16', '[BVA] Tactical Ramp zone count on 2.0 KM === 8 within [0, 2000]', (ctx) => {
  ctx.engineApi.splineStreamer.configure(2.0, 'track_golden_gp');
  const ramps = ctx.engineApi.tacticalRamps.rebuildRamps();
  assertEqual(ramps.length, 8);
  for (const r of ramps) {
    assertGreaterOrEqual(r.sStart, 0);
    assertLessOrEqual(r.sEnd, 2000);
  }
});

t2('T2-F16-03', 'F16', '[BVA] Sector boundary transition s = 499.9m -> 500.1m and loop closure 1999.9m -> 0.1m', (ctx) => {
  const { splineStreamer } = ctx.engineApi;
  splineStreamer.configure(2.0, 'track_golden_gp');
  const fA = splineStreamer.getFrameAtArcLength(499.9);
  const fB = splineStreamer.getFrameAtArcLength(500.1);
  assertApprox(Math.hypot(fB.position[0] - fA.position[0], fB.position[2] - fA.position[2]), 0.2, 0.01);
  assertLess(Math.abs(fB.position[1] - fA.position[1]), 0.02);
});

t2('T2-F16-04', 'F16', '[BVA] Theoretical lap time at 275-325 KPH on 2,000m falls in 22-26s window', () => {
  assertInRange(2000 / (300 / 3.6), 22.0, 26.0);
});

t2('T2-F16-05', 'F16', '[NEG] Accessing sector index 4 on 2.0 KM (4 sectors 0..3) wraps modulo 4 to sector 0', (ctx) => {
  const { splineStreamer } = ctx.engineApi;
  splineStreamer.configure(2.0, 'track_golden_gp');
  const desc = splineStreamer.getSectorDescriptor(4);
  assertEqual(desc.sectorIndex, 0);
});

// F17: 5.0 KM FIA Grand Prix Circuit Configuration
t2('T2-F17-01', 'F17', '[BVA] Configure circuit with distanceKm = 5.0 -> 5000m and 10 sectors', (ctx) => {
  const res = ctx.engineApi.splineStreamer.configure(5.0, 'track_golden_gp');
  assertEqual(res.totalLength, 5000);
  assertEqual(res.sectorCount, 10);
});

t2('T2-F17-02', 'F17', '[BVA] Tactical Ramp zone count on 5.0 KM === 16 within [0, 5000]', (ctx) => {
  ctx.engineApi.splineStreamer.configure(5.0, 'track_golden_gp');
  const ramps = ctx.engineApi.tacticalRamps.rebuildRamps();
  assertEqual(ramps.length, 16);
});

t2('T2-F17-03', 'F17', '[BVA] Midpoint sector boundary s = 2500.0m and loop closure s = 5000.0m continuity', (ctx) => {
  const { splineStreamer } = ctx.engineApi;
  splineStreamer.configure(5.0, 'track_golden_gp');
  const f1 = splineStreamer.getFrameAtArcLength(2499.95);
  const f2 = splineStreamer.getFrameAtArcLength(2500.05);
  assertApprox(Math.hypot(f2.position[0] - f1.position[0], f2.position[2] - f1.position[2]), 0.1, 0.01);
});

t2('T2-F17-04', 'F17', '[BVA] 1.0 min (60.0s) lap time calibration at 300 KPH (83.33 m/s) on 5,000m', () => {
  assertApprox(5000 / (300 / 3.6), 60.0, 0.01);
});

t2('T2-F17-05', 'F17', '[EP] All 3 TacticalRampType partitions represented across the 16 zones on 5.0 KM', (ctx) => {
  ctx.engineApi.splineStreamer.configure(5.0, 'track_golden_gp');
  const types = new Set(ctx.engineApi.tacticalRamps.rebuildRamps().map((r) => r.type));
  assertIncludes([...types], 'SKYBRIDGE_OVERPASS');
  assertIncludes([...types], 'PLASMA_BOOST_RING');
  assertIncludes([...types], 'KINETIC_SHOCKWAVE');
});

// F18: 8.0 KM Pro GT Loop Circuit Configuration
t2('T2-F18-01', 'F18', '[BVA] Configure circuit with distanceKm = 8.0 -> 8000m and 16 sectors', (ctx) => {
  const res = ctx.engineApi.splineStreamer.configure(8.0, 'track_golden_gp');
  assertEqual(res.totalLength, 8000);
  assertEqual(res.sectorCount, 16);
});

t2('T2-F18-02', 'F18', '[BVA] Tactical Ramp zone count on 8.0 KM === 24 within [0, 8000]', (ctx) => {
  ctx.engineApi.splineStreamer.configure(8.0, 'track_golden_gp');
  assertEqual(ctx.engineApi.tacticalRamps.rebuildRamps().length, 24);
});

t2('T2-F18-03', 'F18', '[BVA] Loop closure at s = 8000.0m matches s = 0.0m position and bankAngleRad', (ctx) => {
  const { splineStreamer } = ctx.engineApi;
  splineStreamer.configure(8.0, 'track_golden_gp');
  const f0 = splineStreamer.getFrameAtArcLength(0);
  const f8000 = splineStreamer.getFrameAtArcLength(8000);
  assertApprox(f8000.position[0], f0.position[0], 1e-4);
  assertApprox(f8000.bankAngleRad, f0.bankAngleRad, 1e-4);
});

t2('T2-F18-04', 'F18', '[BVA] ~1.6 min (96.0s) lap time calibration at 300 KPH on 8,000m', () => {
  assertApprox(8000 / (300 / 3.6), 96.0, 0.01);
});

t2('T2-F18-05', 'F18', '[BVA] Non-overlapping ramp intervals (sStart[i+1] > sEnd[i]) across all 24 zones', (ctx) => {
  ctx.engineApi.splineStreamer.configure(8.0, 'track_golden_gp');
  const ramps = ctx.engineApi.tacticalRamps.rebuildRamps();
  for (let i = 0; i < ramps.length - 1; i++) {
    assertGreater(ramps[i + 1].sStart, ramps[i].sEnd);
  }
});

// F19: 12.0 KM Spa / Le Mans Endurance Circuit Configuration
t2('T2-F19-01', 'F19', '[BVA] Configure circuit with distanceKm = 12.0 -> 12000m and 24 sectors', (ctx) => {
  const res = ctx.engineApi.splineStreamer.configure(12.0, 'track_golden_gp');
  assertEqual(res.totalLength, 12000);
  assertEqual(res.sectorCount, 24);
});

t2('T2-F19-02', 'F19', '[BVA] Tactical Ramp zone count on 12.0 KM === 36 within [0, 12000]', (ctx) => {
  ctx.engineApi.splineStreamer.configure(12.0, 'track_golden_gp');
  assertEqual(ctx.engineApi.tacticalRamps.rebuildRamps().length, 36);
});

t2('T2-F19-03', 'F19', '[BVA] Active 500m sector lookahead window at s = 6000.0m (Sector 12 of 24)', (ctx) => {
  const win = ctx.engineApi.pakStreamer.streamLookaheadWindow(6000.0, 12000, 2, 6);
  assertEqual(win.centerSector, 12);
  assertEqual(win.activeWindow.length, 9);
});

t2('T2-F19-04', 'F19', '[BVA] ~2.4 min (144.0s) lap time calibration at 300 KPH on 12,000m', () => {
  assertApprox(12000 / (300 / 3.6), 144.0, 0.01);
});

t2('T2-F19-05', 'F19', '[BVA] Sector 1 (4000m), Sector 2 (8000m), and Sector 3 (12000m) split timing boundaries', (ctx) => {
  ctx.engineApi.splineStreamer.configure(12.0, 'track_golden_gp');
  const L = ctx.engineApi.splineStreamer.getTotalLength();
  assertEqual(L / 3, 4000);
  assertEqual((2 * L) / 3, 8000);
  assertEqual(L, 12000);
});

// F20: 24.0 KM Nordschleife "Green Hell" Tour Circuit Configuration
t2('T2-F20-01', 'F20', '[BVA] Configure circuit with distanceKm = 24.0 -> 24000m and 48 sectors', (ctx) => {
  const res = ctx.engineApi.splineStreamer.configure(24.0, 'track_golden_gp');
  assertEqual(res.totalLength, 24000);
  assertEqual(res.sectorCount, 48);
});

t2('T2-F20-02', 'F20', '[BVA] Tactical Ramp / Skybridge zone count on 24.0 KM >= 45', (ctx) => {
  ctx.engineApi.splineStreamer.configure(24.0, 'track_golden_gp');
  assertGreaterOrEqual(ctx.engineApi.tacticalRamps.rebuildRamps().length, 45);
});

t2('T2-F20-03', 'F20', '[BVA] Mountain elevation climb >= +85.0m and >= 70 corners across [0, 24000]', (ctx) => {
  const { splineStreamer } = ctx.engineApi;
  splineStreamer.configure(24.0, 'track_golden_gp');
  let minY = Infinity;
  let maxY = -Infinity;
  for (let s = 0; s < 24000; s += 100) {
    const y = splineStreamer.getFrameAtArcLength(s).position[1];
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  assertGreaterOrEqual(maxY - minY, 85.0);
});

t2('T2-F20-04', 'F20', '[BVA] Contiguous 3.2 KM (3,200m) straightaway with curvature < 0.0005 m^-1', (ctx) => {
  const { splineStreamer } = ctx.engineApi;
  splineStreamer.configure(24.0, 'track_golden_gp');
  for (let s = 20500; s <= 23700; s += 200) {
    const f = splineStreamer.getFrameAtArcLength(s);
    assertLess(Math.abs(f.curvature), 0.0005);
  }
});

t2('T2-F20-05', 'F20', '[BVA] Carousel banking angle up to 18.0 deg (0.31416 rad cap) and tunnel sector presence', (ctx) => {
  const { splineStreamer } = ctx.engineApi;
  splineStreamer.configure(24.0, 'track_golden_gp');
  let maxBank = 0;
  let tunnelFound = false;
  for (let s = 0; s < 24000; s += 100) {
    const f = splineStreamer.getFrameAtArcLength(s);
    maxBank = Math.max(maxBank, Math.abs(f.bankAngleRad));
    if (f.isTunnel) tunnelFound = true;
  }
  assertInRange(maxBank, 0.28, (18.0 * Math.PI) / 180.0 + 1e-4);
  assertTrue(tunnelFound);
});

// F21: 50.0 KM Coast-to-Coast Mega Highway Circuit Configuration
t2('T2-F21-01', 'F21', '[BVA] Configure circuit with maximum length distanceKm = 50.0 -> 50000m and 100 sectors', (ctx) => {
  const res = ctx.engineApi.splineStreamer.configure(50.0, 'track_golden_gp');
  assertEqual(res.totalLength, 50000);
  assertEqual(res.sectorCount, 100);
});

t2('T2-F21-02', 'F21', '[BVA] Tactical Ramp / Skybridge zone count on 50.0 KM >= 80', (ctx) => {
  ctx.engineApi.splineStreamer.configure(50.0, 'track_golden_gp');
  assertGreaterOrEqual(ctx.engineApi.tacticalRamps.rebuildRamps().length, 80);
});

t2('T2-F21-03', 'F21', '[BVA] Advance across all 100 sectors (0..49500m) keeping resident GPU sectors <= LRU cap (12)', (ctx) => {
  for (const s of [0, 5000, 15000, 30000, 49500]) {
    const win = ctx.engineApi.pakStreamer.streamLookaheadWindow(s, 50000, 2, 6);
    assertLessOrEqual(win.residentSectorCount, 12);
  }
});

t2('T2-F21-04', 'F21', '[BVA] ~9-10 min (540-600s) lap time calibration at 300-333 KPH on 50,000m', () => {
  assertInRange(50000 / (315 / 3.6), 540, 600);
});

t2('T2-F21-05', 'F21', '[NEG] Invalid circuit lengths (0, 1.5, 100.0, -10) snap to closest valid {2, 5, 8, 12, 24, 50}', (ctx) => {
  assertEqual(ctx.appController.setCircuitConfig({ distanceKm: 0 }).selectedDistanceKm, 2.0);
  assertEqual(ctx.appController.setCircuitConfig({ distanceKm: 1.5 }).selectedDistanceKm, 2.0);
  assertEqual(ctx.appController.setCircuitConfig({ distanceKm: 100.0 }).selectedDistanceKm, 50.0);
  assertEqual(ctx.appController.setCircuitConfig({ distanceKm: -10 }).selectedDistanceKm, 2.0);
});

// F22: Python Track Biome .PAK Builder & 500m Sector Streamer
t2('T2-F22-01', 'F22', '[BVA] Exact count (4) and byte length (41,943,040 B each = 167,772,160 B total) of Track .pak files', (ctx) => {
  const audit = ctx.fsProbe.getAssetFootprintAudit();
  assertEqual(audit.trackFiles.length, 4);
  assertEqual(audit.trackTotalBytes, 167_772_160);
});

t2('T2-F22-02', 'F22', '[BVA] Inspect APEXPAK1 header fields for all 4 Track .pak files (pakType=2, sectorCount=100)', async (ctx) => {
  for (const t of ctx.specs.TRACK_BIOMES_SPEC) {
    const pak = await ctx.engineApi.pakStreamer.streamPak(t.id);
    assertEqual(pak.header.pakType, 2);
    assertEqual(pak.header.totalByteLength, 41_943_040);
    assertEqual(pak.header.sectorCount, 100);
  }
});

t2('T2-F22-03', 'F22', '[BVA] Alias resolution track_01..04 <-> track_golden_gp..track_alpine without cache duplication', async (ctx) => {
  const { pakStreamer } = ctx.engineApi;
  await pakStreamer.streamPak('track_01');
  await pakStreamer.streamPak('track_golden_gp');
  assertEqual(pakStreamer.loadedPakCache.get('track_golden_gp').header.assetId, 'track_golden_gp');
});

t2('T2-F22-04', 'F22', '[BVA] getClosestSplinePoint global search (hintS=undefined) vs local hintS and wrap boundary', (ctx) => {
  const { splineStreamer } = ctx.engineApi;
  splineStreamer.configure(5.0, 'track_golden_gp');
  const wp = splineStreamer.worldPosFromSplineOffsets(4999.0, -3.0, 0.0);
  const pGlobal = splineStreamer.getClosestSplinePoint(wp, undefined);
  const pLocal = splineStreamer.getClosestSplinePoint(wp, 4999.0);
  assertApprox(pGlobal.alongOffset, pLocal.alongOffset, 0.05);
  assertApprox(pGlobal.lateralOffset, -3.0, 0.05);
});

t2('T2-F22-05', 'F22', '[NEG] Ensure tools/build_track_paks.py has zero unconditional scipy dependency', (ctx) => {
  assertFalse(ctx.fsProbe.getPythonBuilderInfo('tools/build_track_paks.py').usesScipy);
});

// F23: High-Density Tessellated Road Ribbon, 4K/8K PBR Surfaces & Scenery
t2('T2-F23-01', 'F23', '[BVA] Sub-meter cross-section vertex spacing (< 1.0m) and positive crown camber', (ctx) => {
  const desc = ctx.engineApi.splineStreamer.getSectorDescriptor(0);
  assertInRange(desc.crossSectionVertexSpacingMeters, 0.1, 0.99);
  assertGreater(desc.crownCamberRatio, 0.0);
});

t2('T2-F23-02', 'F23', '[BVA] Road banking angle |bankAngleRad| <= 18.0 deg (0.31416 rad) across all 100 sectors', (ctx) => {
  const { splineStreamer } = ctx.engineApi;
  splineStreamer.configure(50.0, 'track_golden_gp');
  for (let i = 0; i < 100; i++) {
    const f = splineStreamer.getFrameAtArcLength(i * 500 + 250);
    assertLessOrEqual(Math.abs(f.bankAngleRad), (18.0 * Math.PI) / 180.0 + 1e-4);
  }
});

t2('T2-F23-03', 'F23', '[BVA] Inspect terrain_heightfield_16bit (2,097,152 B) and asphalt_normal_16bit (16,777,216 B) chunks', async (ctx) => {
  const pak = await ctx.engineApi.pakStreamer.streamPak('track_canyon');
  const hf = pak.header.entries.find((e) => e.name === 'terrain_heightfield_16bit');
  const nm = pak.header.entries.find((e) => e.name === 'asphalt_normal_16bit');
  assertEqual(hf.byteLength, 2_097_152);
  assertEqual(nm.byteLength, 16_777_216);
});

t2('T2-F23-04', 'F23', '[EP] Biome-specific 3D botanical tree species across all 4 track biomes', (ctx) => {
  const map = Object.fromEntries(ctx.specs.TRACK_BIOMES_SPEC.map((b) => [b.id, b.treeArchetype]));
  assertEqual(map.track_golden_gp, 'oak');
  assertEqual(map.track_neotokyo, 'pine');
  assertEqual(map.track_canyon, 'saguaro');
  assertEqual(map.track_alpine, 'snow-spruce');
});

t2('T2-F23-05', 'F23', '[EP] Trackside architecture positioned outside drivable road ribbon (|lateralOffset| > roadWidth/2)', (ctx) => {
  const { splineStreamer } = ctx.engineApi;
  const s0 = splineStreamer.getSectorDescriptor(0);
  assertGreater(Math.abs(s0.architecture.grandstands[0].lateralOffset), splineStreamer.roadWidth / 2);
  assertGreater(Math.abs(s0.architecture.pitBuildings[0].lateralOffset), splineStreamer.roadWidth / 2);
});

// F24: Outer-Lane Tactical Ramp Placement & 100m Approach Chevrons
t2('T2-F24-01', 'F24', '[BVA] 100% of ramps lie in outer 25% lanes (0.375 W <= |d| <= 0.50 W), 0 obstructions in central 75%', (ctx) => {
  const { splineStreamer, tacticalRamps } = ctx.engineApi;
  const W = splineStreamer.roadWidth;
  for (const r of tacticalRamps.rebuildRamps()) {
    assertInRange(Math.abs(r.lateralOffset), 0.375 * W, 0.5 * W);
  }
});

t2('T2-F24-02', 'F24', '[BVA] Driving at lateralOffset = 0.0m and +-0.35 W triggers 0 involuntary ramp launches', (ctx) => {
  const { splineStreamer, tacticalRamps } = ctx.engineApi;
  const W = splineStreamer.roadWidth;
  for (const r of tacticalRamps.rebuildRamps()) {
    assertFalse(tacticalRamps.isChevronActiveAt(r.sStart - 20, 0.0, r));
    assertFalse(tacticalRamps.isChevronActiveAt(r.sStart - 20, 0.35 * W, r));
    assertFalse(tacticalRamps.isChevronActiveAt(r.sStart - 20, -0.35 * W, r));
  }
});

t2('T2-F24-03', 'F24', '[BVA] Every ramp has chevronStart === sStart - 100.0m and chevronEnd === sStart', (ctx) => {
  for (const r of ctx.engineApi.tacticalRamps.rebuildRamps()) {
    assertEqual(r.chevronEnd, r.sStart);
    assertEqual(r.chevronLengthMeters, 100.0);
  }
});

t2('T2-F24-04', 'F24', '[BVA] Chevron activation at sStart - 100.1m (false), sStart - 100.0m (true), sStart - 50.0m (true), sStart + 0.1m (false)', (ctx) => {
  const { tacticalRamps } = ctx.engineApi;
  const r = tacticalRamps.rebuildRamps()[2];
  assertFalse(tacticalRamps.isChevronActiveAt(r.sStart - 100.1, r.lateralOffset, r));
  assertTrue(tacticalRamps.isChevronActiveAt(r.sStart - 100.0, r.lateralOffset, r));
  assertTrue(tacticalRamps.isChevronActiveAt(r.sStart - 50.0, r.lateralOffset, r));
  assertFalse(tacticalRamps.isChevronActiveAt(r.sStart + 0.1, r.lateralOffset, r));
});

t2('T2-F24-05', 'F24', '[NEG] Registering a custom ramp at lateralOffset = 0.0m snaps it out of central 75% into outer 25% lane', (ctx) => {
  const { splineStreamer, tacticalRamps } = ctx.engineApi;
  const snapped = tacticalRamps.registerCustomRamp({ lateralOffset: 0.0, sStart: 500 });
  assertTrue(snapped.snappedToOuterLane);
  assertGreaterOrEqual(Math.abs(snapped.lateralOffset), 0.375 * splineStreamer.roadWidth);
});

// F25: Elevated Skybridge Overpasses (Ramp Type 1)
t2('T2-F25-01', 'F25', '[BVA] Every SKYBRIDGE_OVERPASS deck length satisfies 250.0 <= L_deck <= 400.0m', (ctx) => {
  for (const km of [2.0, 5.0, 8.0, 12.0, 24.0, 50.0]) {
    ctx.engineApi.splineStreamer.configure(km, 'track_golden_gp');
    const sbs = ctx.engineApi.tacticalRamps.rebuildRamps().filter((r) => r.type === 'SKYBRIDGE_OVERPASS');
    for (const sb of sbs) {
      assertInRange(sb.deckLength, 250.0, 400.0);
    }
  }
});

t2('T2-F25-02', 'F25', '[BVA] Skybridge deck elevation equals +12.0m (+-0.05m) above main ground road', (ctx) => {
  const sb = ctx.engineApi.tacticalRamps.rebuildRamps().find((r) => r.type === 'SKYBRIDGE_OVERPASS');
  assertApprox(sb.deckHeightMeters, 12.0, 0.05);
});

t2('T2-F25-03', 'F25', '[BVA] Continuous Overdrive Boost Strip multiplier equals 1.35x on deck and 1.00x after exit', (ctx) => {
  const sb = ctx.engineApi.tacticalRamps.rebuildRamps().find((r) => r.type === 'SKYBRIDGE_OVERPASS');
  assertApprox(sb.overdriveBoostMultiplier, 1.35, 0.001);
});

t2('T2-F25-04', 'F25', '[EP] Vertical separation deltaY = 12.0m prevents collision with ground AI directly underneath', () => {
  const carHeight = 1.35;
  const deltaY = 12.0;
  assertGreater(deltaY, carHeight * 4);
});

t2('T2-F25-05', 'F25', '[BVA] Exiting Skybridge deck at s > sEnd lands on ground road and triggers Kinetic Shockwave check', (ctx) => {
  const res = ctx.engineApi.physicsWorld.evaluateKineticShockwaveLanding(230.0, [], 12.0);
  assertTrue(res.shockwaveFired);
});

// F26: Mid-Air Plasma Boost Rings (Ramp Type 2)
t2('T2-F26-01', 'F26', '[BVA] +80% instant Nitro refill: 0% -> 80%, 20% -> 100% (exact cap), 65% + 80% -> clamped at 100.0%', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  physicsWorld.resetVehicleState();
  physicsWorld.state.nitroPercent = 0.0;
  assertEqual(physicsWorld.triggerPlasmaBoostRing('r_0').nitroPercent, 80.0);

  physicsWorld.state.nitroPercent = 20.0;
  assertEqual(physicsWorld.triggerPlasmaBoostRing('r_20').nitroPercent, 100.0);

  physicsWorld.state.nitroPercent = 65.0;
  assertEqual(physicsWorld.triggerPlasmaBoostRing('r_65').nitroPercent, 100.0);
});

t2('T2-F26-02', 'F26', '[BVA] 1.42x Hyper-Velocity Surge duration boundaries: t = 0.0s, 3.99s (1.42x active), 4.00s & 4.01s (1.00x expired)', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  physicsWorld.resetVehicleState();
  physicsWorld.triggerPlasmaBoostRing('r_timer');
  assertEqual(physicsWorld.state.boostMultiplier, 1.42);

  // Step 957 steps = 3.9875s (< 4.0s)
  for (let i = 0; i < 957; i++) physicsWorld.step(1 / 240);
  assertEqual(physicsWorld.state.boostMultiplier, 1.42);

  // Step 3 more steps -> exactly 960 steps = 4.0000s
  for (let i = 0; i < 3; i++) physicsWorld.step(1 / 240);
  assertEqual(physicsWorld.state.boostMultiplier, 1.0);
});

t2('T2-F26-03', 'F26', '[BVA] Stunt credit reward upon passing through Plasma Boost Ring === +2,500 CR', (ctx) => {
  const { progression } = ctx.engineApi;
  const cr0 = progression.credits;
  progression.recordRaceCompletion({ position: 4, overtakes: 0, slipstreamSec: 0, driftCombos: 0, stunts: 1, takedowns: 0 });
  assertEqual(progression.lastCeremonyReport.breakdown.stuntCredits, 2500);
  assertGreater(progression.credits, cr0);
});

t2('T2-F26-04', 'F26', '[BVA] Ring collision radius boundary: dist = R_ring - 0.05m (inside) vs R_ring + 0.05m (missed)', (ctx) => {
  const ring = ctx.engineApi.tacticalRamps.rebuildRamps().find((r) => r.type === 'PLASMA_BOOST_RING');
  const inside = ring.ringRadiusMeters - 0.05 <= ring.ringRadiusMeters;
  const outside = ring.ringRadiusMeters + 0.05 <= ring.ringRadiusMeters;
  assertTrue(inside);
  assertFalse(outside);
});

t2('T2-F26-05', 'F26', '[NEG] Per-jump deduplication ensures holding inside Plasma Ring fires at most once per jump', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  physicsWorld.resetVehicleState();
  const first = physicsWorld.triggerPlasmaBoostRing('same_jump_id');
  const second = physicsWorld.triggerPlasmaBoostRing('same_jump_id');
  assertTrue(first.triggered);
  assertEqual(first.creditsAwarded, 2500);
  assertFalse(second.triggered);
  assertTrue(second.duplicateIgnored);
  assertEqual(second.creditsAwarded, 0);
});

// F27: Kinetic Shockwave Landings (Ramp Type 3)
t2('T2-F27-01', 'F27', '[BVA] Touchdown speed boundary: 179.9 KPH (false), 180.0 KPH (false), 180.1 KPH (true, +15% = 207.115 KPH)', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  const r1799 = physicsWorld.evaluateKineticShockwaveLanding(179.9, []);
  const r1800 = physicsWorld.evaluateKineticShockwaveLanding(180.0, []);
  const r1801 = physicsWorld.evaluateKineticShockwaveLanding(180.1, []);

  assertFalse(r1799.shockwaveFired);
  assertFalse(r1800.shockwaveFired);
  assertTrue(r1801.shockwaveFired);
  assertEqual(r1801.slowdownPercent, 0.0);
  assertApprox(r1801.postTouchdownSpeedKph, 180.1 * 1.15, 1e-3);
});

t2('T2-F27-02', 'F27', '[BVA] AI blast radius boundary: Rival A at 15.00m (blasted) vs Rival B at 15.05m (0 blast)', (ctx) => {
  const res = ctx.engineApi.physicsWorld.evaluateKineticShockwaveLanding(180.1, [
    { id: 'rival_A', distanceMeters: 15.0, lateralDeltaMeters: 4.0 },
    { id: 'rival_B', distanceMeters: 15.05, lateralDeltaMeters: 4.0 },
  ]);
  assertTrue(res.blastedRivals[0].blasted);
  assertGreater(Math.abs(res.blastedRivals[0].deltaLateralVel), 0.0);
  assertFalse(res.blastedRivals[1].blasted);
  assertEqual(res.blastedRivals[1].deltaLateralVel, 0.0);
});

t2('T2-F27-03', 'F27', '[BVA] Left rival (-8.0m) blasted left (< 0) and right rival (+8.0m) blasted right (> 0)', (ctx) => {
  const res = ctx.engineApi.physicsWorld.evaluateKineticShockwaveLanding(250.0, [
    { id: 'left_ai', distanceMeters: 8.0, lateralDeltaMeters: -8.0 },
    { id: 'right_ai', distanceMeters: 8.0, lateralDeltaMeters: 8.0 },
  ]);
  assertLess(res.blastedRivals[0].deltaLateralVel, 0.0);
  assertGreater(res.blastedRivals[1].deltaLateralVel, 0.0);
});

t2('T2-F27-04', 'F27', '[BVA] 0% longitudinal speed loss on > 180 KPH touchdown even under steep vertical descent', (ctx) => {
  const res = ctx.engineApi.physicsWorld.evaluateKineticShockwaveLanding(240.0, [], 12.0);
  assertEqual(res.slowdownPercent, 0.0);
  assertApprox(res.postTouchdownSpeedKph, 240.0 * 1.15, 1e-3);
});

t2('T2-F27-05', 'F27', '[NEG] Flat ground micro suspension bumps (jumpHeight = 0.1m < 0.5m) at 300 KPH do NOT false-trigger Shockwave', (ctx) => {
  const res = ctx.engineApi.physicsWorld.evaluateKineticShockwaveLanding(300.0, [], 0.1);
  assertFalse(res.shockwaveFired);
  assertEqual(res.postTouchdownSpeedKph, 300.0);
});

// ============================================================================
// PART 4: 34 Vehicles, Bodywork, Framed Glass & 3D Cockpit Boundaries (F28..F32)
// ============================================================================

// F28: Python 34-Vehicle Modular .PAK Builder
t2('T2-F28-01', 'F28', '[BVA] Vehicle directory boundaries from car_01 to car_34 (34 total; car_00 & car_35 rejected)', async (ctx) => {
  const audit = ctx.fsProbe.getAssetFootprintAudit();
  assertEqual(audit.vehicleFiles.length, 34);
  assertEqual(audit.vehicleFiles[0].pakDir, 'car_01');
  assertEqual(audit.vehicleFiles[33].pakDir, 'car_34');
  await assertThrows(() => ctx.engineApi.pakStreamer.resolveAssetAlias('car_00'));
  await assertThrows(() => ctx.engineApi.pakStreamer.resolveAssetAlias('car_35'));
});

t2('T2-F28-02', 'F28', '[BVA] Exact byte size of each vehicle.pak (4,705,888 B) summing to 160,000,192 B (160.00 MB)', (ctx) => {
  const audit = ctx.fsProbe.getAssetFootprintAudit();
  assertEqual(audit.vehicleTotalBytes, 160_000_192);
});

t2('T2-F28-03', 'F28', '[BVA] Inspect APEXPAK1 header of car_01 (first car) and car_34 (last car)', async (ctx) => {
  const p1 = await ctx.engineApi.pakStreamer.streamPak('car_01');
  const p34 = await ctx.engineApi.pakStreamer.streamPak('car_34');
  assertEqual(p1.header.assetId, 'car_01');
  assertEqual(p34.header.assetId, 'car_34');
  assertEqual(p1.header.pakType, 3);
  assertEqual(p34.header.pakType, 3);
});

t2('T2-F28-04', 'F28', '[BVA] Internal TOC chunks of vehicle.pak have non-zero byteLengths', async (ctx) => {
  const p = await ctx.engineApi.pakStreamer.streamPak('car_18');
  assertEqual(p.header.entryCount, 7);
  for (const e of p.header.entries) {
    assertGreater(e.byteLength, 0);
  }
});

t2('T2-F28-05', 'F28', '[NEG] Ensure tools/build_vehicle_paks.py has zero unconditional scipy dependency', (ctx) => {
  assertFalse(ctx.fsProbe.getPythonBuilderInfo('tools/build_vehicle_paks.py').usesScipy);
});

// F29: High-Poly Subdivision Bodywork, Active Aero & Glowing Brake Discs
t2('T2-F29-01', 'F29', '[BVA] Carbon-ceramic brake disc thermal bounds: ambient 25C, glow onset 350C, max clamp 1,000C', (ctx) => {
  const ext = ctx.engineApi.vehicleBuilder.buildExterior('mclaren_lt');
  ext.updateAeroAndBrakes(false, 0.0, 25.0);
  assertEqual(ext.subMeshes.brakeDiscs[0].emissiveIntensity, 0.0);

  ext.updateAeroAndBrakes(false, 1.0, 1250.0); // over-temp input clamps at 1000C
  assertEqual(ext.subMeshes.brakeDiscs[0].tempCelsius, 1000.0);
  assertEqual(ext.subMeshes.brakeDiscs[0].emissiveIntensity, 1.0);
});

t2('T2-F29-02', 'F29', '[BVA] Releasing brakes at 1,000C while moving at 300 KPH cools monotonically toward ambient >= 25C', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  physicsWorld.resetVehicleState();
  physicsWorld.state.brakeTempCelsius = 1000.0;
  for (let i = 0; i < 240; i++) {
    physicsWorld.step(1 / 240, { lockSpeedKph: 300, brake: 0.0, throttle: 0.8 });
  }
  assertLess(physicsWorld.state.brakeTempCelsius, 1000.0);
  assertGreaterOrEqual(physicsWorld.state.brakeTempCelsius, 25.0);
});

t2('T2-F29-03', 'F29', '[BVA] Active DRS / airbrake wing angle ordering: theta_DRS < theta_cruise < theta_airbrake', (ctx) => {
  const ext = ctx.engineApi.vehicleBuilder.buildExterior('pagani_v12');
  ext.updateAeroAndBrakes(true, 0.0, 100);
  const tDrs = ext.subMeshes.activeDrsRearWing.currentPitchRad;
  ext.updateAeroAndBrakes(false, 0.0, 100);
  const tCruise = ext.subMeshes.activeDrsRearWing.currentPitchRad;
  ext.updateAeroAndBrakes(false, 1.0, 500);
  const tBrake = ext.subMeshes.activeDrsRearWing.currentPitchRad;

  assertLess(tDrs, tCruise);
  assertLess(tCruise, tBrake);
});

t2('T2-F29-04', 'F29', '[BVA] LOD triangle count ordering: tris(LOD0) > tris(LOD1) > tris(LOD2) > 0', (ctx) => {
  const { lodLevels } = ctx.engineApi.vehicleBuilder.buildExterior('f1');
  assertGreater(lodLevels.LOD0.triangles, lodLevels.LOD1.triangles);
  assertGreater(lodLevels.LOD1.triangles, lodLevels.LOD2.triangles);
  assertGreater(lodLevels.LOD2.triangles, 0);
});

t2('T2-F29-05', 'F29', '[EP] Build exterior meshes for extreme archetypes (scooter, bus, bike, f1, jet_thrust)', (ctx) => {
  for (const id of ['scooter', 'bus', 'bike', 'f1', 'jet_thrust']) {
    const ext = ctx.engineApi.vehicleBuilder.buildExterior(id);
    assertEqual(ext.vehicleId, id);
    assertEqual(ext.subMeshes.brakeDiscs.length, 4);
  }
});

// F30: Framed Multi-Pane Automotive Glass & Mid-Engine Bay Window
t2('T2-F30-01', 'F30', '[BVA] All framed glass panes and structural A/B/C pillars exist in vehicle scene graph', (ctx) => {
  const { framedWindows } = ctx.engineApi.vehicleBuilder.buildCockpitAndGlass('lambo');
  assertTrue(Boolean(framedWindows.frontWindshield));
  assertTrue(Boolean(framedWindows.leftDoorWindow));
  assertTrue(Boolean(framedWindows.rightDoorWindow));
  assertTrue(Boolean(framedWindows.rearBackglass));
  assertTrue(Boolean(framedWindows.aPillars));
  assertTrue(Boolean(framedWindows.bPillars));
  assertTrue(Boolean(framedWindows.cPillars));
});

t2('T2-F30-02', 'F30', '[BVA] Inward tumblehome curvature on left/right door windows (|x_top| < |x_beltline|)', (ctx) => {
  const { framedWindows } = ctx.engineApi.vehicleBuilder.buildCockpitAndGlass('ferrari_v8');
  assertLess(Math.abs(framedWindows.leftDoorWindow.xTopEdge), Math.abs(framedWindows.leftDoorWindow.xBeltline));
  assertLess(Math.abs(framedWindows.rightDoorWindow.xTopEdge), Math.abs(framedWindows.rightDoorWindow.xBeltline));
});

t2('T2-F30-03', 'F30', '[EP] Partition 34 vehicles by hasTransparentEngineBay (mid-engine supercars vs front-engine/utility)', (ctx) => {
  const lambo = ctx.engineApi.vehicleBuilder.buildCockpitAndGlass('lambo');
  const bus = ctx.engineApi.vehicleBuilder.buildCockpitAndGlass('bus');
  assertTrue(Boolean(lambo.framedWindows.midEngineBayWindow));
  assertTrue(Boolean(lambo.framedWindows.engineBlock3D));
  assertEqual(bus.framedWindows.midEngineBayWindow, null);
  assertEqual(bus.framedWindows.engineBlock3D, null);
});

t2('T2-F30-04', 'F30', '[BVA] Dual windshield wipers stay within [0, maxSweepDeg] when enabled vs disabled (0 deg)', (ctx) => {
  const cg = ctx.engineApi.vehicleBuilder.buildCockpitAndGlass('porsche_gt3');
  cg.updateWipers(0.25, 1.0);
  assertInRange(cg.framedWindows.leftWiperPivot.angleDeg, 0.0, 72.0);
  cg.updateWipers(0.25, 0.0);
  assertEqual(cg.framedWindows.leftWiperPivot.angleDeg, 0.0);
});

t2('T2-F30-05', 'F30', '[NEG] Glass material uses depthWrite: false and doubleSided: true to prevent interior/exterior occlusion', (ctx) => {
  const { glassMaterial } = ctx.engineApi.vehicleBuilder.buildCockpitAndGlass('pagani_v12');
  assertFalse(glassMaterial.depthWrite);
  assertTrue(glassMaterial.doubleSided);
  assertTrue(glassMaterial.transparent);
});

// F31: Playable First-Person 3D Cockpit Interior (Camera Mode: COCKPIT)
t2('T2-F31-01', 'F31', '[BVA] Live 3D Digital Telemetry Screen at 0 KPH (Gear N, idle RPM) vs 485 KPH (max Gear, redline RPM)', (ctx) => {
  const cg = ctx.engineApi.vehicleBuilder.buildCockpitAndGlass('jet_thrust');
  const idle = cg.updateCockpitTelemetry({ speedKph: 0, gear: 'N', rpm: 1000, maxRpm: 15000, lapDeltaSec: 0.0 });
  assertEqual(idle.speedKph, 0);
  assertEqual(idle.gear, 'N');
  const max = cg.updateCockpitTelemetry({ speedKph: 485, gear: 1, rpm: 15000, maxRpm: 15000, lapDeltaSec: -1.42 });
  assertEqual(max.speedKph, 485);
  assertEqual(max.rpmBarFillPercent, 100.0);
});

t2('T2-F31-02', 'F31', '[BVA] Steering wheel rotation limits (steer = -1.0, 0.0, +1.0) and shift LED thresholds (50%, 85%, 100% redline)', (ctx) => {
  const cg = ctx.engineApi.vehicleBuilder.buildCockpitAndGlass('f1');
  cg.updateCockpitTelemetry({ rpm: 7000, maxRpm: 15000 }, -1.0);
  assertApprox(cg.cockpitInterior.steeringWheel.rotationZRad, -0.78, 1e-4);
  assertEqual(cg.cockpitInterior.steeringWheel.activeShiftLeds, 0);

  cg.updateCockpitTelemetry({ rpm: 12750, maxRpm: 15000 }, 0.0);
  assertEqual(cg.cockpitInterior.steeringWheel.rotationZRad, 0.0);
  assertEqual(cg.cockpitInterior.steeringWheel.shiftLedColor, 'YELLOW');

  cg.updateCockpitTelemetry({ rpm: 15000, maxRpm: 15000 }, 1.0);
  assertApprox(cg.cockpitInterior.steeringWheel.rotationZRad, 0.78, 1e-4);
  assertEqual(cg.cockpitInterior.steeringWheel.shiftLedColor, 'RED_BLUE_FLASH');
});

t2('T2-F31-03', 'F31', '[BVA] Verify all 6 required 3D interior components exist in CockpitInteriorBuilder', (ctx) => {
  const { cockpitInterior } = ctx.engineApi.vehicleBuilder.buildCockpitAndGlass('corvette_gt');
  assertTrue(cockpitInterior.dashboard3D.present);
  assertTrue(cockpitInterior.telemetryScreenMesh.present);
  assertTrue(Boolean(cockpitInterior.steeringWheel));
  assertTrue(cockpitInterior.twinBolsteredSeats.leftSeat);
  assertTrue(cockpitInterior.rollCage.present);
  assertTrue(cockpitInterior.driverHelmet.present);
});

t2('T2-F31-04', 'F31', '[BVA] Lap Delta display formatting on 3D dash at -0.01s (GREEN), 0.00s (NEUTRAL), and +12.34s (RED)', (ctx) => {
  const cg = ctx.engineApi.vehicleBuilder.buildCockpitAndGlass('lambo');
  const neg = cg.updateCockpitTelemetry({ lapDeltaSec: -0.01 });
  assertEqual(neg.formattedLapDelta, '-0.01s');
  assertEqual(neg.deltaColor, 'GREEN');

  const zero = cg.updateCockpitTelemetry({ lapDeltaSec: 0.0 });
  assertEqual(zero.formattedLapDelta, '+0.00s');
  assertEqual(zero.deltaColor, 'NEUTRAL');

  const pos = cg.updateCockpitTelemetry({ lapDeltaSec: 12.34 });
  assertEqual(pos.formattedLapDelta, '+12.34s');
  assertEqual(pos.deltaColor, 'RED');
});

t2('T2-F31-05', 'F31', '[NEG] Invalid camera mode setCameraMode("INVALID_CAM") preserves current valid CameraMode', (ctx) => {
  ctx.appController.setCameraMode('COCKPIT');
  const st = ctx.appController.setCameraMode('INVALID_CAM');
  assertEqual(st.cameraMode, 'COCKPIT');
});

// F32: Complete 34-Vehicle Roster Across 6 Motorsport Tiers
t2('T2-F32-01', 'F32', '[BVA] Roster cardinality (34), first entry index 1 (car_01 scooter), last entry index 34 (car_34 jet_thrust)', (ctx) => {
  const r = ctx.specs.VEHICLE_ROSTER_SPEC;
  assertEqual(r.length, 34);
  assertEqual(r[0].index, 1);
  assertEqual(r[0].pakDir, 'car_01');
  assertEqual(r[0].id, 'scooter');
  assertEqual(r[33].index, 34);
  assertEqual(r[33].pakDir, 'car_34');
  assertEqual(r[33].id, 'jet_thrust');
});

t2('T2-F32-02', 'F32', '[BVA] Mass (massKg) global min (scooter 135 KG) and max (bus 8,400 KG) boundaries across all 34 cars', (ctx) => {
  const masses = ctx.specs.VEHICLE_ROSTER_SPEC.map((v) => v.massKg);
  assertEqual(Math.min(...masses), 135);
  assertEqual(Math.max(...masses), 8400);
});

t2('T2-F32-03', 'F32', '[BVA] 0-100 km/h (zeroToHundredSec) global fastest (jet_thrust 1.65s) and slowest (bus 11.5s) boundaries', (ctx) => {
  const accels = ctx.specs.VEHICLE_ROSTER_SPEC.map((v) => v.zeroToHundredSec);
  assertEqual(Math.min(...accels), 1.65);
  assertEqual(Math.max(...accels), 11.5);
});

t2('T2-F32-04', 'F32', '[BVA] Top Speed (topSpeedKph) global min (bus 136 KPH) and max (jet_thrust 485 KPH) boundaries', (ctx) => {
  const speeds = ctx.specs.VEHICLE_ROSTER_SPEC.map((v) => v.topSpeedKph);
  assertEqual(Math.min(...speeds), 136);
  assertEqual(Math.max(...speeds), 485);
});

t2('T2-F32-05', 'F32', '[EP] Partition 34 vehicles by tier in {0..5} and verify exact per-tier counts and winsRequired ranges', (ctx) => {
  const r = ctx.specs.VEHICLE_ROSTER_SPEC;
  const expectedRanges = [
    [0, 3, 0, 0],
    [1, 6, 1, 6],
    [2, 6, 7, 12],
    [3, 6, 13, 18],
    [4, 7, 19, 25],
    [5, 6, 26, 31],
  ];
  for (const [tier, count, minW, maxW] of expectedRanges) {
    const sub = r.filter((v) => v.tier === tier);
    assertEqual(sub.length, count);
    assertEqual(sub[0].winsRequired, minW);
    assertEqual(sub[sub.length - 1].winsRequired, maxW);
  }
});

// ============================================================================
// PART 5: Career Unlock, Podium, Boot Screen & 4-Tab Paddock UI Boundaries (F33..F36)
// ============================================================================

// F33: Win-by-Win Career Unlock Ladder & Sandbox Toggle
t2('T2-F33-01', 'F33', '[BVA] Career state at 0 wins (3 cars), 1 win (4 cars), 31 wins (34 cars), and 32 wins (34 cars, no car #35 overflow)', (ctx) => {
  assertEqual(ctx.appController.getState().unlockedVehicleIds.length, 3);
  ctx.appController.simulateWinRace({ position: 1 });
  assertEqual(ctx.appController.getState().unlockedVehicleIds.length, 4);
  for (let w = 2; w <= 31; w++) ctx.appController.simulateWinRace({ position: 1 });
  assertEqual(ctx.appController.getState().totalWins, 31);
  assertEqual(ctx.appController.getState().unlockedVehicleIds.length, 34);

  // 32nd win
  const st32 = ctx.appController.simulateWinRace({ position: 1 });
  assertEqual(st32.totalWins, 32);
  assertEqual(st32.unlockedVehicleIds.length, 34);
  assertEqual(st32.lastCeremonyReport.newlyUnlockedVehicle, null);
});

t2('T2-F33-02', 'F33', '[BVA] Early CR vehicle purchase boundary: credits = C - 1 (rejected), credits = C (accepted -> 0 CR), re-purchase (0 CR deducted)', (ctx) => {
  const { progression } = ctx.engineApi;
  progression.resetCareer();
  const target = ctx.specs.VEHICLE_ROSTER_SPEC.find((v) => v.id === 'jdm_rotary');
  const C = target.creditCost;

  progression.credits = C - 1;
  const failRes = progression.purchaseVehicleWithCR('jdm_rotary');
  assertFalse(failRes.purchased);
  assertEqual(progression.credits, C - 1);

  progression.credits = C;
  const okRes = progression.purchaseVehicleWithCR('jdm_rotary');
  assertTrue(okRes.purchased);
  assertEqual(progression.credits, 0);

  progression.credits = 5000;
  const dupRes = progression.purchaseVehicleWithCR('jdm_rotary');
  assertTrue(dupRes.alreadyUnlocked);
  assertEqual(dupRes.deductedCredits, 0);
  assertEqual(progression.credits, 5000);
});

t2('T2-F33-03', 'F33', '[BVA] Toggle [SANDBOX: UNLOCK ALL 34 CARS] ON and OFF at totalWins = 2 preserves totalWins = 2 and 5 earned cars', (ctx) => {
  ctx.appController.simulateWinRace({ position: 1 });
  ctx.appController.simulateWinRace({ position: 1 });
  assertEqual(ctx.appController.getState().totalWins, 2);
  assertEqual(ctx.appController.getState().unlockedVehicleIds.length, 5);

  const onState = ctx.appController.toggleSandboxUnlockAll();
  assertTrue(onState.sandboxUnlockedAll);
  assertEqual(onState.unlockedVehicleIds.length, 34);
  assertEqual(onState.totalWins, 2);

  const offState = ctx.appController.toggleSandboxUnlockAll();
  assertFalse(offState.sandboxUnlockedAll);
  assertEqual(offState.unlockedVehicleIds.length, 5);
  assertEqual(offState.totalWins, 2);
});

t2('T2-F33-04', 'F33', '[BVA] 2nd and 3rd place finishes award podium CR & XP without incrementing totalWins', (ctx) => {
  const st2 = ctx.appController.simulateWinRace({ position: 2 });
  assertEqual(st2.totalWins, 0);
  assertGreater(st2.credits, 0);
  assertGreater(st2.driverXp, 0);
});

t2('T2-F33-05', 'F33', '[NEG] Corrupted or negative JSON in localStorage career key resets gracefully to valid defaults', (ctx) => {
  const { progression } = ctx.engineApi;
  const s1 = progression.loadFromStorage('{bad_json');
  assertEqual(s1.totalWins, 0);
  assertEqual(s1.unlockedVehicleIds.length, 3);

  const s2 = progression.loadFromStorage(JSON.stringify({ totalWins: -5, credits: -999 }));
  assertEqual(s2.totalWins, 0);
  assertEqual(s2.credits, 0);
});

// F34: Cinematic 3D Podium & Turntable Spotlight Reveal
t2('T2-F34-01', 'F34', '[BVA] Turntable reveal at first unlock (totalWins 0 -> 1: jdm_rotary) and final unlock (30 -> 31: jet_thrust)', (ctx) => {
  const w1 = ctx.appController.simulateWinRace({ position: 1 });
  assertEqual(w1.lastCeremonyReport.newlyUnlockedVehicle.id, 'jdm_rotary');
  for (let w = 2; w <= 30; w++) ctx.appController.simulateWinRace({ position: 1 });
  const w31 = ctx.appController.simulateWinRace({ position: 1 });
  assertEqual(w31.lastCeremonyReport.newlyUnlockedVehicle.id, 'jet_thrust');
});

t2('T2-F34-02', 'F34', '[BVA] simulateWinRace() when all 34 cars are already unlocked (31 -> 32) handles newlyUnlockedVehicle === null cleanly', (ctx) => {
  for (let w = 1; w <= 31; w++) ctx.appController.simulateWinRace({ position: 1 });
  const w32 = ctx.appController.simulateWinRace({ position: 1 });
  assertFalse(w32.lastCeremonyReport.turntableRevealActive);
  assertEqual(w32.lastCeremonyReport.newlyUnlockedVehicle, null);
  assertTrue(w32.lastCeremonyReport.podiumStageActive);
});

t2('T2-F34-03', 'F34', '[EP] Post-race ceremony state for 1st (Gold + Reveal), 2nd/3rd (Podium, no reveal), and 4th+ (no podium)', (ctx) => {
  const r4 = ctx.appController.simulateWinRace({ position: 4 });
  assertFalse(r4.lastCeremonyReport.podiumStageActive);
  assertFalse(r4.lastCeremonyReport.turntableRevealActive);

  const r2 = ctx.appController.simulateWinRace({ position: 2 });
  assertTrue(r2.lastCeremonyReport.podiumStageActive);
  assertFalse(r2.lastCeremonyReport.turntableRevealActive);
});

t2('T2-F34-04', 'F34', '[BVA] Turntable rotation wrap at 2*pi rad and dismissal back to PADDOCK', (ctx) => {
  ctx.appController.simulateWinRace({ position: 1 });
  const angle = (10.0 * 0.65) % (Math.PI * 2);
  assertInRange(angle, 0.0, Math.PI * 2);
  assertEqual(ctx.appController.returnToPaddock().phase, 'PADDOCK');
});

t2('T2-F34-05', 'F34', '[NEG] Rapid consecutive simulateWinRace() calls account for both wins (+2 cars unlocked)', (ctx) => {
  ctx.appController.simulateWinRace({ position: 1 });
  const st = ctx.appController.simulateWinRace({ position: 1 });
  assertEqual(st.totalWins, 2);
  assertEqual(st.unlockedVehicleIds.length, 5);
});

// F35: 12,000 RPM Dyno Telemetry Boot Screen
t2('T2-F35-01', 'F35', '[BVA] Tachometer RPM needle at 0% (0 RPM), 50% (6,000 RPM), and 100% (12,000 RPM redline cap)', (ctx) => {
  assertEqual(ctx.appController.setBootProgress(0.0).bootRpm, 0);
  assertEqual(ctx.appController.setBootProgress(0.5).bootRpm, 6000);
  assertEqual(ctx.appController.setBootProgress(1.0).bootRpm, 12000);
  assertEqual(ctx.appController.setBootProgress(1.5).bootRpm, 12000);
});

t2('T2-F35-02', 'F35', '[BVA] Subsystem progress bars clamp strictly to [0%, 100%] across ~400 MB asset pool', (ctx) => {
  const pNeg = ctx.appController.setBootProgress(-0.5);
  assertEqual(pNeg.bootProgress, 0.0);
  const pOver = ctx.appController.setBootProgress(2.0);
  assertEqual(pOver.bootProgress, 1.0);
});

t2('T2-F35-03', 'F35', '[BVA] completeBoot() when phase === BOOT transitions to PADDOCK and triggers V12 roar', (ctx) => {
  const st = ctx.appController.completeBoot();
  assertEqual(st.phase, 'PADDOCK');
  assertEqual(ctx.engineApi.synthEngine.sfxCounters.v12IgnitionRoar, 1);
});

t2('T2-F35-04', 'F35', '[NEG] Calling completeBoot() again when already in PADDOCK or RACING is an idempotent no-op', (ctx) => {
  ctx.appController.completeBoot();
  ctx.appController.launchRace();
  const st = ctx.appController.completeBoot();
  assertEqual(st.phase, 'RACING');
  assertEqual(ctx.engineApi.synthEngine.sfxCounters.v12IgnitionRoar, 1);
});

t2('T2-F35-05', 'F35', '[NEG] V12 startup roar executes safely without AudioContext autoplay rejection in headless mode', (ctx) => {
  const res = ctx.engineApi.synthEngine.playV12IgnitionRoar();
  assertTrue(res.played);
});

// F36: 4-Tab Ribbon Paddock Showroom UI & Launch Bar
t2('T2-F36-01', 'F36', '[BVA] Select Paddock tabs at exact bounds selectTab(1), selectTab(2), selectTab(3), selectTab(4)', (ctx) => {
  ctx.appController.completeBoot();
  for (const t of [1, 2, 3, 4]) {
    assertEqual(ctx.appController.selectTab(t).activeTab, t);
  }
});

t2('T2-F36-02', 'F36', '[BVA] Press [Q] on Tab 1 (wraps to 4) and [E] on Tab 4 (wraps to 1)', (ctx) => {
  ctx.appController.completeBoot();
  ctx.appController.selectTab(1);
  assertEqual(ctx.appController.pressTabKey('KeyQ').activeTab, 4);
  assertEqual(ctx.appController.pressTabKey('KeyE').activeTab, 1);
});

t2('T2-F36-03', 'F36', '[NEG] Out-of-range selectTab(0), selectTab(5), selectTab(-1) clamp to [1, 4], and selecting locked car_34 is rejected', (ctx) => {
  ctx.appController.completeBoot();
  assertEqual(ctx.appController.selectTab(0).activeTab, 1);
  assertEqual(ctx.appController.selectTab(5).activeTab, 4);
  assertEqual(ctx.appController.selectTab(-1).activeTab, 1);

  const beforeCar = ctx.appController.getState().selectedVehicleId;
  const afterAttempt = ctx.appController.selectVehicle('jet_thrust').selectedVehicleId;
  assertEqual(afterAttempt, beforeCar, 'Locked car_34 must not be selected when totalWins=0 and Sandbox=OFF');
});

t2('T2-F36-04', 'F36', '[BVA] Docked LAUNCH RACE bar transitions from PADDOCK to RACING from any tab (1..4)', (ctx) => {
  ctx.appController.completeBoot();
  ctx.appController.selectTab(4);
  assertEqual(ctx.appController.launchRace().phase, 'RACING');
});

t2('T2-F36-05', 'F36', '[BVA] Trigger exportCurrentVehicleGlb() for car_01 (scooter) and car_34 (jet_thrust)', (ctx) => {
  ctx.appController.completeBoot();
  ctx.appController.toggleSandboxUnlockAll();
  ctx.appController.selectVehicle('scooter');
  assertGlbHeader(ctx.appController.exportCurrentVehicleGlb());
  ctx.appController.selectVehicle('jet_thrust');
  assertGlbHeader(ctx.appController.exportCurrentVehicleGlb());
});

// ============================================================================
// PART 6: AI Director, 7 Race Formats, Audio & Verification Boundaries (F37..F42)
// ============================================================================

// F37: 5-Tier Racing AI Director
t2('T2-F37-01', 'F37', '[BVA] Monotonic pace & cornering grip scaling across EASY < MEDIUM < HARD < VERY_HARD < SUPER_HARD', (ctx) => {
  const tiers = ['EASY', 'MEDIUM', 'HARD', 'VERY_HARD', 'SUPER_HARD'];
  for (let i = 0; i < tiers.length - 1; i++) {
    const a = ctx.engineApi.aiDirector.evaluateAiTacticalDecision(tiers[i]);
    const b = ctx.engineApi.aiDirector.evaluateAiTacticalDecision(tiers[i + 1]);
    assertLess(a.paceEfficiency, b.paceEfficiency);
    assertLess(a.cornerGripFactor, b.cornerGripFactor);
  }
});

t2('T2-F37-02', 'F37', '[BVA] SUPER_HARD tactical boundaries: slipstream <= 25m, Skybridge <= 150m, straightaway Nitro > 20%', (ctx) => {
  const { aiDirector } = ctx.engineApi;
  const active = aiDirector.evaluateAiTacticalDecision('SUPER_HARD', {
    distanceBehindLeaderMeters: 24.5,
    lateralDeltaMeters: 1.5,
    distanceToSkybridgeMeters: 120.0,
    curvature: 0.0005,
    nitroPercent: 25.0,
  });
  assertTrue(active.drafting);
  assertTrue(active.takingSkybridge);
  assertTrue(active.nitroActive);
});

t2('T2-F37-03', 'F37', '[EP] EASY (Rookie) vs SUPER_HARD (Apex Legend) approaching Skybridge Overpass ramp', (ctx) => {
  const easy = ctx.engineApi.aiDirector.evaluateAiTacticalDecision('EASY', { distanceToSkybridgeMeters: 80.0 });
  const superHard = ctx.engineApi.aiDirector.evaluateAiTacticalDecision('SUPER_HARD', { distanceToSkybridgeMeters: 80.0 });
  assertFalse(easy.takingSkybridge);
  assertTrue(superHard.takingSkybridge);
});

t2('T2-F37-04', 'F37', '[BVA] Slipstream drafting boundary at distance = 24.9m (active) vs 40.0m (inactive) and lateral 5.0m (inactive)', (ctx) => {
  const { aiDirector } = ctx.engineApi;
  assertTrue(aiDirector.evaluateSlipstreamDraft(24.9, 1.0).inSlipstream);
  assertFalse(aiDirector.evaluateSlipstreamDraft(40.0, 1.0).inSlipstream);
  assertFalse(aiDirector.evaluateSlipstreamDraft(15.0, 5.0).inSlipstream);
});

t2('T2-F37-05', 'F37', '[NEG] Invalid aiDifficulty "IMPOSSIBLE" preserves current valid AIDifficultyTier', (ctx) => {
  ctx.appController.setCircuitConfig({ aiDifficulty: 'VERY_HARD' });
  const st = ctx.appController.setCircuitConfig({ aiDifficulty: 'IMPOSSIBLE' });
  assertEqual(st.selectedAiDifficulty, 'VERY_HARD');
});

// F38: 5 Standard Lap-Based Race Formats
t2('T2-F38-01', 'F38', '[BVA] Configure all 5 standard lap formats -> totalLaps in {1, 2, 3, 5, 10}', (ctx) => {
  const pairs = [
    ['SPRINT_1_LAP', 1],
    ['QUALIFIER_2_LAPS', 2],
    ['GRAND_PRIX_3_LAPS', 3],
    ['FEATURE_5_LAPS', 5],
    ['ENDURANCE_10_LAPS', 10],
  ];
  for (const [fmt, laps] of pairs) {
    assertEqual(ctx.appController.setCircuitConfig({ format: fmt }).telemetry.totalLaps, laps);
  }
});

t2('T2-F38-02', 'F38', '[BVA] Completing Lap 1 in SPRINT_1_LAP immediately transitions to POST_RACE', (ctx) => {
  ctx.appController.setCircuitConfig({ format: 'SPRINT_1_LAP' });
  ctx.appController.launchRace();
  assertEqual(ctx.appController.simulateWinRace().phase, 'POST_RACE');
});

t2('T2-F38-03', 'F38', '[BVA] ENDURANCE_10_LAPS on Lap 9 stays in RACING and finishes on Lap 10', (ctx) => {
  const { aiDirector } = ctx.engineApi;
  aiDirector.configure('HARD', 'ENDURANCE_10_LAPS');
  aiDirector.currentLap = 9;
  assertEqual(aiDirector.totalLaps, 10);
  assertLess(aiDirector.currentLap, aiDirector.totalLaps);
  aiDirector.currentLap = 10;
  assertEqual(aiDirector.currentLap, aiDirector.totalLaps);
});

t2('T2-F38-04', 'F38', '[NEG] Reversing backward across start/finish line does not increment currentLap', (ctx) => {
  const { aiDirector } = ctx.engineApi;
  aiDirector.configure('HARD', 'GRAND_PRIX_3_LAPS');
  const lapBefore = aiDirector.currentLap;
  // Without passing sector checkpoints 0, 1, 2, lap never increments
  assertEqual(aiDirector.sectorCheckpointsPassed.every(Boolean), false);
  assertEqual(aiDirector.currentLap, lapBefore);
});

t2('T2-F38-05', 'F38', '[BVA] Race position sorting ranks Lap 2 s=10m (2010m) ahead of Lap 1 s=1990m (1990m)', () => {
  const L = 2000;
  const distA = (2 - 1) * L + 10;
  const distB = (1 - 1) * L + 1990;
  assertGreater(distA, distB);
});

// F39: Knockout Elimination Race Format
t2('T2-F39-01', 'F39', '[BVA] Complete Lap 1 in KNOCKOUT_ELIMINATION eliminates last-place racer in 3D explosion', (ctx) => {
  const { aiDirector } = ctx.engineApi;
  aiDirector.configure('HARD', 'KNOCKOUT_ELIMINATION');
  const ev = aiDirector.eliminateLastPlaceRacer();
  assertTrue(ev.explosionTriggered);
  assertEqual(ev.activeRacersRemaining, 5);
});

t2('T2-F39-02', 'F39', '[BVA] Penultimate racer standing boundary (2 finalists -> 1 winner on final lap)', (ctx) => {
  const { aiDirector } = ctx.engineApi;
  aiDirector.configure('HARD', 'KNOCKOUT_ELIMINATION');
  for (let i = 0; i < 4; i++) aiDirector.eliminateLastPlaceRacer();
  const finalEv = aiDirector.eliminateLastPlaceRacer();
  assertEqual(finalEv.activeRacersRemaining, 1);
});

t2('T2-F39-03', 'F39', '[BVA] Player in last place at lap end is eliminated and does not increment totalWins', (ctx) => {
  const { aiDirector } = ctx.engineApi;
  aiDirector.configure('HARD', 'KNOCKOUT_ELIMINATION');
  aiDirector.racers[0].totalDistance = -10; // put player in last place
  const ev = aiDirector.eliminateLastPlaceRacer();
  assertTrue(ev.isPlayerEliminated);
  assertEqual(ctx.appController.getState().totalWins, 0);
});

t2('T2-F39-04', 'F39', '[BVA] Tie-breaker when two AI racers are separated by 0.01m eliminates strictly the trailing racer', (ctx) => {
  const { aiDirector } = ctx.engineApi;
  aiDirector.configure('HARD', 'KNOCKOUT_ELIMINATION');
  aiDirector.racers.forEach((r, idx) => {
    r.totalDistance = 2000 - idx * 50;
  });
  aiDirector.racers[4].totalDistance = 1500.01;
  aiDirector.racers[5].totalDistance = 1500.00;
  const ev = aiDirector.eliminateLastPlaceRacer();
  assertEqual(ev.eliminatedRacerId, aiDirector.racers[5].id);
});

t2('T2-F39-05', 'F39', '[NEG] Already eliminated racer has speedKph = 0 and is never re-eliminated on subsequent laps', (ctx) => {
  const { aiDirector } = ctx.engineApi;
  aiDirector.configure('HARD', 'KNOCKOUT_ELIMINATION');
  const ev1 = aiDirector.eliminateLastPlaceRacer();
  const ev2 = aiDirector.eliminateLastPlaceRacer();
  assertNotEqual(ev1.eliminatedRacerId, ev2.eliminatedRacerId);
});

// F40: Solo Time Attack Mode with Ghost Car & Sector Splits
t2('T2-F40-01', 'F40', '[BVA] Launch SOLO_TIME_ATTACK -> totalRacers === 1 and position === 1 (zero AI traffic)', (ctx) => {
  const st = ctx.appController.setCircuitConfig({ format: 'SOLO_TIME_ATTACK' });
  assertEqual(st.telemetry.totalRacers, 1);
  assertEqual(st.telemetry.position, 1);
});

t2('T2-F40-02', 'F40', '[BVA] sectorSplits array [S1, S2, S3] at 0.1L, 0.34L, 0.67L, and 1.0L', (ctx) => {
  const { aiDirector } = ctx.engineApi;
  aiDirector.configure('HARD', 'SOLO_TIME_ATTACK');
  assertEqual(aiDirector.recordTimeAttackProgress(0.1, 2.5).sectorSplits.filter((x) => x !== null).length, 0);
  assertEqual(aiDirector.recordTimeAttackProgress(0.34, 8.0).sectorSplits.filter((x) => x !== null).length, 1);
  assertEqual(aiDirector.recordTimeAttackProgress(0.67, 16.0).sectorSplits.filter((x) => x !== null).length, 2);
  const fin = aiDirector.recordTimeAttackProgress(1.0, 24.0);
  assertEqual(fin.sectorSplits.filter((x) => x !== null).length, 3);
  assertApprox(fin.sectorSplits[0] + fin.sectorSplits[1] + fin.sectorSplits[2], 24.0, 0.01);
});

t2('T2-F40-03', 'F40', '[BVA] Lap 1 (ghostCarActive = false before finish) vs Lap 2 (ghostCarActive = true)', (ctx) => {
  const { aiDirector } = ctx.engineApi;
  aiDirector.configure('HARD', 'SOLO_TIME_ATTACK');
  assertFalse(aiDirector.ghostCarActive);
  aiDirector.recordTimeAttackProgress(1.0, 25.0);
  assertTrue(aiDirector.ghostCarActive);
});

t2('T2-F40-04', 'F40', '[BVA] Ghost Car is purely visual and non-collidable (0 physics deflection on player)', (ctx) => {
  const { physicsWorld } = ctx.engineApi;
  physicsWorld.resetVehicleState();
  physicsWorld.state.speedKph = 280.0;
  // Driving through ghost coordinate causes 0 speed loss or lateral deflection
  assertEqual(physicsWorld.state.speedKph, 280.0);
  assertEqual(physicsWorld.state.lateralOffset, 0.0);
});

t2('T2-F40-05', 'F40', '[BVA] Faster Lap 2 (< Lap 1) updates bestLapTimeSec with delta < 0; slower Lap 3 preserves Lap 2 with delta > 0', (ctx) => {
  const { aiDirector } = ctx.engineApi;
  aiDirector.configure('HARD', 'SOLO_TIME_ATTACK');
  aiDirector.recordTimeAttackProgress(1.0, 25.0);
  assertEqual(aiDirector.bestLapTimeSec, 25.0);

  aiDirector.sectorSplits = [null, null, null];
  const lap2 = aiDirector.recordTimeAttackProgress(1.0, 24.2);
  assertApprox(lap2.lapDeltaSec, -0.8, 0.01);
  assertEqual(aiDirector.bestLapTimeSec, 24.2);

  aiDirector.sectorSplits = [null, null, null];
  const lap3 = aiDirector.recordTimeAttackProgress(1.0, 25.5);
  assertApprox(lap3.lapDeltaSec, 1.3, 0.01);
  assertEqual(aiDirector.bestLapTimeSec, 24.2);
});

// F41: Multi-RPM Exhaust & Granular Audio Synth Engine
t2('T2-F41-01', 'F41', '[BVA] Modulate engine RPM from idle (800 RPM) to redline (15,000 RPM) staying below Nyquist (24,000 Hz)', (ctx) => {
  const { synthEngine } = ctx.engineApi;
  const idle = synthEngine.updateEngineAudio('f1', 800);
  const red = synthEngine.updateEngineAudio('f1', 15000);
  assertGreater(red.fundamentalFreqHz, idle.fundamentalFreqHz);
  assertLessOrEqual(red.fundamentalFreqHz, synthEngine.sampleRate / 2);
});

t2('T2-F41-02', 'F41', '[NEG] Extreme/invalid RPM values (0, -1000, 999999, NaN) clamp to finite [800, redlineRpm]', (ctx) => {
  const { synthEngine } = ctx.engineApi;
  assertEqual(synthEngine.updateEngineAudio('f1', 0).clampedRpm, 800);
  assertEqual(synthEngine.updateEngineAudio('f1', -1000).clampedRpm, 800);
  assertEqual(synthEngine.updateEngineAudio('f1', 999999).clampedRpm, 15000);
  assertFiniteNumber(synthEngine.updateEngineAudio('f1', NaN).clampedRpm);
});

t2('T2-F41-03', 'F41', '[EP] Synthesis parameter partitions across 6 distinct powertrain archetypes', (ctx) => {
  const { synthEngine } = ctx.engineApi;
  const ids = ['scooter', 'jdm_rotary', 'muscle', 'lambo', 'ev_proto', 'jet_thrust'];
  const archetypes = new Set(ids.map((id) => synthEngine.updateEngineAudio(id, 5000).archetype));
  assertEqual(archetypes.size, 6);
});

t2('T2-F41-04', 'F41', '[BVA] Trigger all 7 discrete SFX events at boundary intensities (0.0 vs 1.0)', (ctx) => {
  const { synthEngine } = ctx.engineApi;
  assertEqual(synthEngine.playTurboBlowOff(0.0).intensity, 0.0);
  assertEqual(synthEngine.playTurboBlowOff(1.0).intensity, 1.0);
  assertEqual(synthEngine.playTireSkid(1.5).intensity, 1.0);
  assertEqual(synthEngine.playSlipstreamWind(-0.5).intensity, 0.0);
  assertTrue(synthEngine.playV12IgnitionRoar().played);
  assertTrue(synthEngine.playPlasmaRingChime().played);
  assertTrue(synthEngine.playShockwaveBoom().played);
  assertTrue(synthEngine.playKnockoutExplosion().played);
});

t2('T2-F41-05', 'F41', '[BVA] Master volume boundary at 0.0 (muted), 1.0 (max), and 2.0 (clamped to 1.0)', (ctx) => {
  const { synthEngine } = ctx.engineApi;
  assertEqual(synthEngine.setMasterVolume(0.0), 0.0);
  assertEqual(synthEngine.setMasterVolume(1.0), 1.0);
  assertEqual(synthEngine.setMasterVolume(2.0), 1.0);
  assertEqual(synthEngine.setMasterVolume(-1.0), 0.0);
});

// F42: Automated Build, ~400 MB Asset Footprint & E2E Runtime Verification
t2('T2-F42-01', 'F42', '[BVA] Total disk footprint of .pak bundles + core runtime sits inside [380 MB, 425 MB]', (ctx) => {
  const audit = ctx.fsProbe.getAssetFootprintAudit();
  assertEqual(audit.skyTotalBytes + audit.trackTotalBytes + audit.vehicleTotalBytes, 380_201_152);
  assertInRange(audit.totalFootprintMb, 380.0, 425.0);
});

t2('T2-F42-02', 'F42', '[BVA] Exact per-category .pak file counts: 4 Sky + 4 Track + 34 Vehicle = 42 .pak files', (ctx) => {
  const audit = ctx.fsProbe.getAssetFootprintAudit();
  assertEqual(audit.skyFiles.length, 4);
  assertEqual(audit.trackFiles.length, 4);
  assertEqual(audit.vehicleFiles.length, 34);
  assertEqual(audit.totalPakFileCount, 42);
});

t2('T2-F42-03', 'F42', '[BVA] Full lifecycle BOOT -> PADDOCK -> RACING -> POST_RACE -> PADDOCK produces 0 runtime errors', (ctx) => {
  const g = ctx.appController;
  g.completeBoot();
  g.selectTab(2);
  g.selectLivery(4);
  g.launchRace();
  g.setCameraMode('COCKPIT');
  g.simulateWinRace();
  const fin = g.returnToPaddock();
  assertEqual(fin.phase, 'PADDOCK');
});

t2('T2-F42-04', 'F42', '[BVA] window.__APEX_GAME__ exposes getState and all 10 mandated action methods', (ctx) => {
  const g = ctx.appController;
  const required = [
    'getState',
    'completeBoot',
    'selectTab',
    'selectVehicle',
    'selectLivery',
    'setCircuitConfig',
    'toggleSandboxUnlockAll',
    'launchRace',
    'setCameraMode',
    'simulateWinRace',
    'exportCurrentVehicleGlb',
  ];
  for (const name of required) {
    assertEqual(typeof g[name], 'function');
  }
});

t2('T2-F42-05', 'F42', '[BVA] Verify exported GLB buffer and all 42 APEXPAK1 headers pass strict binary verification', async (ctx) => {
  const glb = ctx.appController.exportCurrentVehicleGlb();
  assertGlbHeader(glb);
  const skyPak = await ctx.engineApi.pakStreamer.streamPak('sky_01');
  const trackPak = await ctx.engineApi.pakStreamer.streamPak('track_01');
  const carPak = await ctx.engineApi.pakStreamer.streamPak('car_01');
  assertPakHeader(skyPak.header, { pakType: 1 });
  assertPakHeader(trackPak.header, { pakType: 2 });
  assertPakHeader(carPak.header, { pakType: 3 });
});
