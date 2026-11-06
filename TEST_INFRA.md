# E2E Test Infrastructure & Traceability Blueprint (`TEST_INFRA.md`)

**Project**: Apex Grand Prix: Uncapped Next-Gen Edition (`~400 MB` Modular 3D Racing Game)  
**Track**: `E2E_Testing_Track` (`TEST_INFRA.md`, `playwright.config.ts`, `tests/e2e/**`, `TEST_READY.md`)  
**Total E2E Test Cases**: **494 Genuine Requirement-Driven Test Cases** (`210` Tier 1 + `210` Tier 2 + `50` Tier 3 + `24` Tier 4)

---

## 1. Test Philosophy (Requirement-Driven Opaque-Box Verification)

### 1.1 Source of Truth & Anti-Cheating Mandate
All E2E tests in `tests/e2e/` are derived strictly from the user requirements in `ORIGINAL_REQUEST.md` and the public system contracts in `PROJECT.md § Feature Inventory` & `§ Interface Contracts`.
- **Zero Hardcoded Results**: Every test case executes genuine programmatic assertions against binary headers, physics state vectors, spline geometry, career progression state machines, glTF 2.0 `.glb` buffers, and DOM / `window.__APEX_GAME__` state.
- **No Source-Code Implementation Coupling**: Tests interact only through public opaque-box boundaries so internal refactoring within `M1`–`M6` never breaks tests as long as external contracts hold.

### 1.2 Three Opaque-Box Verification Boundaries
1. **Filesystem & Binary `.PAK` Boundary (`assets/paks/**`, `tools/*.py`)**:
   - Directly inspects the `~400 MB` modular asset tree on disk:
     - **4 Sky `.pak` bundles (`~50.0 MB` total • `13,107,200` B / `12.50 MiB` each)**: `assets/paks/sky/sky_golden_hour.pak`, `sky_neotokyo_cyber.pak`, `sky_redrock_canyon.pak`, `sky_alpine_glacier.pak` + `sky_01..04` aliases.
     - **4 Track Biome `.pak` bundles (`~160.0 MB` total • `41,943,040` B / `40.00 MiB` each)**: `assets/paks/tracks/track_golden_gp.pak`, `track_neotokyo.pak`, `track_canyon.pak`, `track_alpine.pak` + `track_01..04` aliases (`100` × `500m` spatial sectors).
     - **34 Vehicle `.pak` bundles (`~160.0 MB` total • `4,705,888` B / `~4.706 MB` each)**: `assets/paks/vehicles/car_01/vehicle.pak` .. `car_34/vehicle.pak`.
   - Validates the 64-byte little-endian `APEXPAK1` binary header (`magic="APEXPAK1"`, `version=1`, `pakType ∈ {1,2,3}`, `totalByteLength`, `entryCount`, `sectorCount`, `assetId[32]`) and `entryCount × 64B` TOC entries.
2. **Public Module Contract Boundary (`src/**`)**:
   - Exercises documented subsystem contracts across `UncappedRenderer`, `PakStreamer`, `RapierVehicleWorld`, `SkyAtmosphereSystem`, `SplineTrackStreamer`, `TacticalRamps`, `VehicleRoster`, `HighPolyVehicleBuilder`, `CockpitInteriorBuilder`, `ProgressionManager`, `BootLoadingScreen`, `PaddockShowroomUI`, `PostRaceRewardCeremony`, `RacingAIDirector`, and `GranularSynthEngine`.
3. **Browser Runtime, DOM & `window.__APEX_GAME__` Boundary (`playwright.config.ts`)**:
   - Drives the full application lifecycle (`BOOT` → `PADDOCK` Tabs 1..4 → `RACING` across all 5 `CameraMode`s → `POST_RACE`) via `window.__APEX_GAME__` and keyboard/mouse inputs (`[Q/E]`, `[C]`, `[🔓 SANDBOX: UNLOCK ALL 34 CARS]`, `🏁 LAUNCH RACE`) in headless Chromium with WebGL2/WebGPU enabled, asserting **zero `console.error`** and **zero uncaught `pageerror`** events.

### 1.3 Deterministic Execution & Dual-Mode Adapter (`--live` and `--self-test`)
- All physics and AI simulations advance via deterministic fixed sub-steps ($\Delta t = 1/240\text{ s}$) without flaky wall-clock `setTimeout` waits.
- `tests/e2e/helpers/contract_runtime_adapter.mjs` supports both **Live Opaque-Box Mode (`--live`, default when `src/main.ts` and `assets/paks/` exist on disk in `M7`)** and **Contract Self-Test Mode (`--self-test`, or per-subsystem automatic fallback while `M1`–`M6` are building in parallel)**, including fault-injection mutation checks proving that broken invariants fail the test suite.

---

## 2. Complete 42-Feature Inventory (`F1`–`F42`) & 4-Tier Traceability Matrix

Every feature `F1`–`F42` from `PROJECT.md` is mapped below to its Milestone (`M1`–`M7`), Quantitative Specification Requirements, Tier 1 Test IDs (`5` per feature = `210`), Tier 2 Test IDs (`5` per feature = `210`), Tier 3 Pairwise Test IDs (`50`), and Tier 4 End-to-End Scenario IDs (`24`).

| Feature ID | Feature Name | Milestone | Quantitative Spec Requirements | Tier 1 Test IDs (`210`) | Tier 2 Test IDs (`210`) | Tier 3 & Tier 4 IDs (`50` + `24`) |
|---|---|---|---|---|---|---|
| **F1** | Project Task Checklist & Implementation Plan | `M1` | `task.md` (Parts 1–6), `implementation_plan.md` (`160+160+50+30=400 MB`), `PROJECT.md` (`F1`–`F42` mapped to `M1`–`M7`) | `T1-F01-1` .. `T1-F01-5` | `T2-F01-01` .. `T2-F01-05` | `T3-50`, `T4-01`, `T4-24` |
| **F2** | Uncapped WebGPU / WebGL2 Deferred & Forward+ PBR Renderer | `M1` | `src/core/UncappedRenderer.ts`, VSync `120/144/240Hz` & uncapped, SSAA `1.0x–2.5x`, `~30 MB` core budget | `T1-F02-1` .. `T1-F02-5` | `T2-F02-01` .. `T2-F02-05` | `T3-07`, `T4-18`, `T4-24` |
| **F3** | Screen-Space GI, Reflections & 4-Cascade PCSS Shadows | `M1` | SSGI, wet asphalt puddle SSR (`puddleMask 0..1`), 4-Cascade `4096×4096` CSM + Contact-Hardening PCSS | `T1-F03-1` .. `T1-F03-5` | `T2-F03-01` .. `T2-F03-05` | `T3-01`, `T3-02`, `T4-02`, `T4-18` |
| **F4** | Dual-Layer Automotive Clearcoat & Metallic Flake Shader | `M1` | `src/shaders/AutomotivePaint.glsl`, dual-layer clearcoat, sub-mm metallic flake, anisotropic brushed metal, `12` PBR paints (`0..11`) | `T1-F04-1` .. `T1-F04-5` | `T2-F04-01` .. `T2-F04-05` | `T3-09`, `T3-12`, `T3-46`, `T4-15` |
| **F5** | Physically Based Refractive Laminated Glass Shader | `M1` | `src/shaders/RefractiveGlass.glsl`, `ior: 1.52` ($F_0 \approx 0.0426$), RGB chromatic dispersion, animated dual wiper-sweep mask | `T1-F05-1` .. `T1-F05-5` | `T2-F05-01` .. `T2-F05-05` | `T3-10`, `T3-15`, `T3-16`, `T4-03`, `T4-15` |
| **F6** | Cinematic Post-Processing & Camera FX Pipeline | `M1` | ACES Filmic HDR Tone Mapping, Volumetric God-Rays, Per-Wheel Motion Blur, Speed FOV Warp (`0–485 KPH`), Bokeh DOF in `SHOWROOM` | `T1-F06-1` .. `T1-F06-5` | `T2-F06-01` .. `T2-F06-05` | `T3-07`, `T3-08`, `T3-20`, `T3-48`, `T4-13`, `T4-16` |
| **F7** | Asynchronous WebWorker `.PAK` & Octree Sector Streamer | `M1` | `src/streaming/PakStreamer.ts`, 64B `APEXPAK1` header + TOC parser, alias resolver (`sky_01..04`, `track_01..04`, `car_01..34`), Octree + LRU VRAM eviction | `T1-F07-1` .. `T1-F07-5` | `T2-F07-01` .. `T2-F07-05` | `T3-05`, `T3-06`, `T3-11`, `T3-50`, `T4-06`, `T4-22` |
| **F8** | 240Hz Raycast Suspension & Pacejka Vehicle Physics | `M1` | `src/physics/RapierVehicleWorld.ts`, `240Hz` ($\Delta t = 1/240\text{ s}$), 4-wheel spring-damper raycasts, anti-roll bars, Pacejka slip curves, quadratic aero downforce | `T1-F08-1` .. `T1-F08-5` | `T2-F08-01` .. `T2-F08-05` | `T3-13`, `T3-14`, `T3-21`, `T3-23`, `T3-24`, `T3-27`, `T3-28`, `T4-14` |
| **F9** | Lateral Tangent Barrier Projection (Zero Teleporting/Sticking) | `M1` | Project onto spline $\vec{T}/\vec{N}$ (`alongOffset`, `lateralOffset`); clamp ONLY `lateralOffset` at $\pm d_{\max}$ (`ΔalongOffset == 0`), strip outward $v_N$, glide parallel to $\vec{T}$ with sparks at `400+ KPH` | `T1-F09-1` .. `T1-F09-5` | `T2-F09-01` .. `T2-F09-05` | `T3-25`, `T3-26`, `T4-05` |
| **F10** | Python HDR Sky & Volumetric Cloud `.PAK` Builder | `M2` | `tools/build_sky_paks.py` (`numpy`+`Pillow`, no `scipy`), 4 sky `.pak` files (`13,107,200` B = `12.50 MiB` each, `50.00 MiB` total) + `sky_01..04` aliases | `T1-F10-1` .. `T1-F10-5` | `T2-F10-01` .. `T2-F10-05` | `T3-05`, `T3-50`, `T4-22` |
| **F11** | Golden Hour Sky Pak & Atmosphere (`sky_golden_hour.pak`) | `M2` | `sky_01` alias, 7 PM low-sun golden horizon HDRI, Rayleigh/Mie LUT, 3D cumulus cloud volume + moving ground shadows, warm `2.4x` directional sun shafts | `T1-F11-1` .. `T1-F11-5` | `T2-F11-01` .. `T2-F11-05` | `T3-01`, `T3-07`, `T3-09`, `T4-01`, `T4-19` |
| **F12** | Neo-Tokyo Cyber Sky Pak & Atmosphere (`sky_neotokyo_cyber.pak`) | `M2` | `sky_02` alias, cyberpunk midnight HDRI, distant holographic skyline cubemap, volumetric neon smog layers, dynamic lightning flashes | `T1-F12-1` .. `T1-F12-5` | `T2-F12-01` .. `T2-F12-05` | `T3-02`, `T3-05`, `T3-10`, `T4-02`, `T4-19` |
| **F13** | Redrock Canyon Sky Pak & Atmosphere (`sky_redrock_canyon.pak`) | `M2` | `sky_03` alias, crimson-violet desert dusk sky dome, high-altitude cirrus cloud maps, warm desert dust haze LUT, PMREM cubemap mips | `T1-F13-1` .. `T1-F13-5` | `T2-F13-01` .. `T2-F13-05` | `T3-03`, `T3-09`, `T4-04`, `T4-19` |
| **F14** | Alpine Glacier Sky Pak & Atmosphere (`sky_alpine_glacier.pak`) | `M2` | `sky_04` alias, crystalline blue zenith, snow-albedo horizon bounce light, aurora borealis shader layer, blowing snow particle sheets | `T1-F14-1` .. `T1-F14-5` | `T2-F14-01` .. `T2-F14-05` | `T3-04`, `T3-05`, `T3-10`, `T4-06`, `T4-19` |
| **F15** | True 1:1 Physical World Calibration (`1 World Unit = 1 Real Meter`) | `M3` | `src/tracks/SplineTrackStreamer.ts`: zero text-multiplier faking; at `360 KPH` (`100.0 m/s`), car advances `100.0 meters/sec` along 3D spline | `T1-F15-1` .. `T1-F15-5` | `T2-F15-01` .. `T2-F15-05` | `T3-21`, `T3-22`, `T4-13` |
| **F16** | 2.0 KM Stadium Sprint Circuit Configuration | `M3` | `2,000m` true spline (`4` × `500m` sectors) • `~22–26s/lap` • `8` Tactical Ramp/Skybridge zones | `T1-F16-1` .. `T1-F16-5` | `T2-F16-01` .. `T2-F16-05` | `T3-22`, `T4-01`, `T4-07`, `T4-14` |
| **F17** | 5.0 KM FIA Grand Prix Circuit Configuration | `M3` | `5,000m` true spline (`10` × `500m` sectors) • `~1 min/lap` • `16` Tactical Ramp/Skybridge zones | `T1-F17-1` .. `T1-F17-5` | `T2-F17-01` .. `T2-F17-05` | `T3-01`, `T3-22`, `T3-34`, `T4-02`, `T4-08` |
| **F18** | 8.0 KM Pro GT Loop Circuit Configuration | `M3` | `8,000m` true spline (`16` × `500m` sectors) • `~1.6 min/lap` • `24` Tactical Ramp/Skybridge zones | `T1-F18-1` .. `T1-F18-5` | `T2-F18-01` .. `T2-F18-05` | `T3-02`, `T3-22`, `T3-29`, `T4-03`, `T4-09` |
| **F19** | 12.0 KM Spa / Le Mans Endurance Circuit Configuration | `M3` | `12,000m` true spline (`24` × `500m` sectors) • `~2.4 min/lap` • `36` Tactical Ramp/Skybridge zones | `T1-F19-1` .. `T1-F19-5` | `T2-F19-01` .. `T2-F19-05` | `T3-03`, `T3-21`, `T3-22`, `T3-49`, `T4-04`, `T4-23` |
| **F20** | 24.0 KM Nordschleife "Green Hell" Tour Circuit Configuration | `M3` | `24,000m` spline (`48` × `500m` sectors) • `~4.5–5.2 min/lap` • `70+` corners, `+85m` climb, `18°` banked carousel, tunnels, `45+` ramps, `3.2 km` `485 KPH` straight | `T1-F20-1` .. `T1-F20-5` | `T2-F20-01` .. `T2-F20-05` | `T3-04`, `T3-22`, `T3-27`, `T4-05`, `T4-13` |
| **F21** | 50.0 KM Coast-to-Coast Mega Highway Circuit Configuration | `M3` | `50,000m` spline (`100` × `500m` sectors) • `~9–10 min/lap` • `80+` Tactical Ramp/Skybridge zones | `T1-F21-1` .. `T1-F21-5` | `T2-F21-01` .. `T2-F21-05` | `T3-06`, `T3-22`, `T4-06` |
| **F22** | Python Track Biome `.PAK` Builder & `500m` Sector Streamer | `M3` | `tools/build_track_paks.py` (`numpy`+`Pillow`), 4 biome `.pak` files (`41,943,040` B = `40.00 MiB` each, `160.00 MiB` total, `sectorCount=100`) + `track_01..04` aliases | `T1-F22-1` .. `T1-F22-5` | `T2-F22-01` .. `T2-F22-05` | `T3-05`, `T3-06`, `T3-22`, `T3-50`, `T4-19`, `T4-22` |
| **F23** | High-Density Tessellated Road Ribbon, 4K/8K PBR Surfaces & Scenery | `M3` | Sub-meter cross-section (`<1m`), crown camber, `<=18°` banking, 3D FIA kerbs, Armco barriers, 4K/8K asphalt PBR, 16-bit heightfields, `oak/pine/saguaro/snow-spruce` wind-swayed trees, grandstands, pit buildings, gantries, tunnels | `T1-F23-1` .. `T1-F23-5` | `T2-F23-01` .. `T2-F23-05` | `T3-01`..`T3-04`, `T3-08`, `T3-23`, `T3-24`, `T4-19` |
| **F24** | Outer-Lane Tactical Ramp Placement & 100m Approach Chevrons | `M3` | `src/tracks/TacticalRamps.ts`: ramps strictly in outer `25%` lanes (`\|d\| >= 0.375 W`), central `75%` clear, `100m` Holographic Approach Chevrons (`[sStart-100, sStart]`) | `T1-F24-1` .. `T1-F24-5` | `T2-F24-01` .. `T2-F24-05` | `T3-29`, `T4-04` |
| **F25** | Elevated Skybridge Overpasses (Ramp Type 1) | `M3` | Launches vehicle onto `250m–400m` Upper-Deck Highway (`+12.0m` above main road) with continuous `1.35x` Overdrive Boost Strips bypassing ground AI traffic | `T1-F25-1` .. `T1-F25-5` | `T2-F25-01` .. `T2-F25-05` | `T3-30`, `T3-34`, `T4-04`, `T4-09` |
| **F26** | Mid-Air Plasma Boost Rings (Ramp Type 2) | `M3` | Suspended neon ring above ramp lip granting `+80%` instant Nitro refill (clamped at `100%`), `1.42x` Hyper-Velocity Surge for `4.0s` on landing, and `+2,500 CR` stunt bonus | `T1-F26-1` .. `T1-F26-5` | `T2-F26-01` .. `T2-F26-05` | `T3-31`, `T3-36`, `T4-04`, `T4-10` |
| **F27** | Kinetic Shockwave Landings (Ramp Type 3) | `M3` | Touchdown at `> 180.0 KPH` (`180.1 KPH` vs `180.0 KPH`) triggers `0%` landing slowdown, fires 3D Kinetic Shockwave Ring, boosts speed `+15%` (`1.15x`), blasts AI rivals within `<=15.0m` sideways | `T1-F27-1` .. `T1-F27-5` | `T2-F27-01` .. `T2-F27-05` | `T3-32`, `T3-33`, `T4-04` |
| **F28** | Python 34-Vehicle Modular `.PAK` Builder | `M4` | `tools/build_vehicle_paks.py` (`numpy`+`Pillow`), `assets/paks/vehicles/car_01..34/vehicle.pak` (`4,705,888` B = `~4.706 MB` each, `160.00 MB` total, `pakType=3`) | `T1-F28-1` .. `T1-F28-5` | `T2-F28-01` .. `T2-F28-05` | `T3-11`, `T3-50`, `T4-22` |
| **F29** | High-Poly Subdivision Bodywork, Active Aero & Glowing Brake Discs | `M4` | `src/vehicles/HighPolyVehicleBuilder.ts`: LOD0>LOD1>LOD2, fenders/splitter/Venturi diffuser, active DRS/airbrake rear wing, brake discs glowing to `1,000°C` bright orange | `T1-F29-1` .. `T1-F29-5` | `T2-F29-01` .. `T2-F29-05` | `T3-11`, `T3-13`, `T3-14`, `T4-13` |
| **F30** | Framed Multi-Pane Automotive Glass & Mid-Engine Bay Window | `M4` | `src/vehicles/CockpitInteriorBuilder.ts`: sloped windshield + dual animated wipers, painted A-pillars, rearview mirror, tumblehome door glass, gloss-black B/C-pillars, beltline trim, wing mirrors, rear backglass + transparent mid-engine cover revealing 3D engine block | `T1-F30-1` .. `T1-F30-5` | `T2-F30-01` .. `T2-F30-05` | `T3-10`, `T3-15`, `T3-16`, `T4-15` |
| **F31** | Playable First-Person 3D Cockpit Interior (`Camera Mode: COCKPIT`) | `M4` | `src/vehicles/CockpitInteriorBuilder.ts`: 3D dashboard with live Digital Telemetry Screen (`KPH`, `Gear`, `RPM bar`, `Lap Delta`), rotating steering wheel with shift LEDs, twin bolstered seats, roll cage, driver helmet | `T1-F31-1` .. `T1-F31-5` | `T2-F31-01` .. `T2-F31-05` | `T3-17`, `T3-18`, `T3-41`, `T4-03`, `T4-23` |
| **F32** | Complete 34-Vehicle Roster Across 6 Motorsport Tiers (Tiers 0–5) | `M4` | `src/vehicles/VehicleRoster.ts`: all 34 vehicles (`#1 scooter` `135 KG` `7.2s` `145 KPH` `0 Wins` .. `#15 bus` `8,400 KG` `11.5s` `136 KPH` `12 Wins` .. `#34 jet_thrust` `2,400 KG` `1.65s` `485 KPH` `31 Wins`) | `T1-F32-1` .. `T1-F32-5` | `T2-F32-01` .. `T2-F32-05` | `T3-11`, `T3-14`, `T3-28`, `T4-12`, `T4-14` |
| **F33** | Win-by-Win Career Unlock Ladder (`1 Win = +1 New Car`) & Sandbox Toggle | `M5` | `src/career/ProgressionManager.ts`: Tier 0 (`3` cars at `0` wins) → `1..31` wins (`34` cars), 6 `CR`/`XP` categories, early `CR` purchase (`cost - 1` vs `cost`), non-destructive `[🔓 SANDBOX: UNLOCK ALL 34 CARS]` toggle | `T1-F33-1` .. `T1-F33-5` | `T2-F33-01` .. `T2-F33-05` | `T3-31`, `T3-36`, `T3-42`, `T3-43`, `T4-01`, `T4-10`, `T4-11`, `T4-12`, `T4-20` |
| **F34** | Cinematic 3D Podium & Turntable Spotlight Reveal | `M5` | `src/ui/PostRaceRewardCeremony.ts`: 3D Podium top-3 stage + rotating Turntable Spotlight Reveal for newly unlocked vehicles (`wins 1..31`) + itemized `CR`/`XP` breakdown | `T1-F34-1` .. `T1-F34-5` | `T2-F34-01` .. `T2-F34-05` | `T3-37`, `T3-39`, `T3-42`, `T4-01`, `T4-12` |
| **F35** | 12,000 RPM Dyno Telemetry Boot Screen | `M5` | `src/ui/BootLoadingScreen.ts`: animated `0–12,000 RPM` Tachometer Boot Screen streaming `~400 MB` `.pak` pool across 4 subsystem bars + V12 ignition roar | `T1-F35-1` .. `T1-F35-5` | `T2-F35-01` .. `T2-F35-05` | `T3-44`, `T4-01`, `T4-24` |
| **F36** | 4-Tab Ribbon Paddock Showroom UI & Launch Bar | `M5` | `src/ui/PaddockShowroomUI.ts`: `[Q/E]` / click 4-Tab Ribbon (`1. GARAGE`, `2. LIVERY & 12 PBR PAINTS`, `3. CIRCUIT, DISTANCE, FORMAT & AI`, `4. MOD STUDIO & GLB EXPORT` `0x46546C67`) + docked `🏁 LAUNCH RACE` bar | `T1-F36-1` .. `T1-F36-5` | `T2-F36-01` .. `T2-F36-05` | `T3-45`..`T3-49`, `T4-16`, `T4-17`, `T4-24` |
| **F37** | 5-Tier Racing AI Director | `M6` | `src/ai/RacingAIDirector.ts`: `EASY`, `MEDIUM`, `HARD`, `VERY_HARD`, `SUPER_HARD` (`Apex Legend` actively slipstreaming, taking Skybridge overpass shortcuts, and firing straightaway Nitro) | `T1-F37-1` .. `T1-F37-5` | `T2-F37-01` .. `T2-F37-05` | `T3-34`, `T3-35`, `T4-09` |
| **F38** | 5 Standard Lap-Based Race Formats | `M6` | `SPRINT_1_LAP` (`1`), `QUALIFIER_2_LAPS` (`2`), `GRAND_PRIX_3_LAPS` (`3`), `FEATURE_5_LAPS` (`5`), `ENDURANCE_10_LAPS` (`10`) | `T1-F38-1` .. `T1-F38-5` | `T2-F38-01` .. `T2-F38-05` | `T3-37`, `T4-01`..`T4-06` |
| **F39** | Knockout Elimination Race Format | `M6` | `KNOCKOUT_ELIMINATION`: last-place racer at the end of every lap is eliminated in a 3D explosion until 1 survivor wins | `T1-F39-1` .. `T1-F39-5` | `T2-F39-01` .. `T2-F39-05` | `T3-38`, `T3-39`, `T4-07`, `T4-21` |
| **F40** | Solo Time Attack Mode with Ghost Car & Sector Splits | `M6` | `SOLO_TIME_ATTACK`: `totalRacers = 1`, `20Hz` Ghost Car trajectory recording & non-collidable replay, real-time Sector 1 (`L/3`), Sector 2 (`2L/3`), and Sector 3 (`L`) split deltas | `T1-F40-1` .. `T1-F40-5` | `T2-F40-01` .. `T2-F40-05` | `T3-40`, `T3-41`, `T4-08`, `T4-13`, `T4-23` |
| **F41** | Multi-RPM Exhaust & Granular Audio Synth Engine | `M6` | `src/audio/GranularSynthEngine.ts`: multi-RPM exhaust synthesis per powertrain archetype, V12 boot roar, turbo blow-off, tire skid, slipstream wind, plasma ring chime, shockwave boom, knockout explosion SFX | `T1-F41-1` .. `T1-F41-5` | `T2-F41-01` .. `T2-F41-05` | `T3-19`, `T3-31`, `T3-32`, `T3-38`, `T3-44`, `T4-21` |
| **F42** | Automated Build, `~400 MB` Asset Footprint & E2E Runtime Verification | `M7` | `~400 MB` total asset footprint (`160+160+50+30 MB`), `42` `.pak` headers valid, TypeScript/Vite build clean, `window.__APEX_GAME__` full contract, `0` console/page errors, `100%` pass across `494` E2E tests | `T1-F42-1` .. `T1-F42-5` | `T2-F42-01` .. `T2-F42-05` | `T3-50`, `T4-24` |

---

## 3. 4-Tier E2E Test Architecture & Directory Layout

```text
/home/antigravity/kskasana4946-cyber/hello/
├── TEST_INFRA.md                                  # Authoritative E2E test architecture & 42-feature traceability matrix
├── TEST_READY.md                                  # Published upon full verification of Tiers 1–4 (494 tests)
├── playwright.config.ts                           # Standalone Playwright config for headless Chromium WebGL2/WebGPU E2E
└── tests/
    └── e2e/
        ├── run_e2e_suite.mjs                      # Unified CLI E2E runner (--tier=1|2|3|4|all, --feature=Fxx, --discover, --self-test, --live)
        ├── helpers/
        │   ├── e2e_harness.mjs                    # Test registry, Vitest bridge, and strict assertion primitives with per-test assertion counting
        │   └── contract_runtime_adapter.mjs       # Live Opaque-Box loader (pak/src/browser) + Pre-M7 Reference Contract Engine & Fault Injector
        ├── tier1_feature_coverage.spec.mjs        # Tier 1: 42 features × 5 progressive happy-path tests = 210 test cases (T1-F01-1 .. T1-F42-5)
        ├── tier2_edge_cases_errors.spec.mjs       # Tier 2: 42 features × 5 BVA/EP/Negative tests = 210 test cases (T2-F01-01 .. T2-F42-05)
        ├── tier3_combinatorial_pairwise.spec.mjs  # Tier 3: 50 cross-feature pairwise & multi-feature tests (T3-01 .. T3-50)
        ├── tier4_real_world_scenarios.spec.mjs    # Tier 4: 24 complete end-to-end user journey scenarios (T4-01 .. T4-24)
        └── playwright/
            └── browser_runtime.e2e.spec.ts        # Playwright headless Chromium E2E test suite verifying DOM, WebGL2 & zero console/page errors
```

---

## 4. Real-World Application Scenarios (All 24 Tier 4 End-to-End User Journeys)

| Scenario ID | Scenario Title | End-to-End User Journey & Verified Subsystems |
|---|---|---|
| **`T4-01`** | Cold Boot to First Career Victory | `BOOT` (`12,000 RPM` Dyno + `~400 MB` bars + V12 roar) → `PADDOCK` (`totalWins=0`, 3 Tier 0 cars) → Select `roadster` (#3) → `2.0 KM Stadium Sprint` on `track_golden_gp` + `sky_golden_hour` (`SPRINT_1_LAP`, `EASY` AI) → Win 1st → `POST_RACE` 3D Podium & Turntable Reveal unlocking `jdm_rotary` (#4, `totalWins=1`). |
| **`T4-02`** | JDM Cyber Midnight Drift & Qualifier Run | Select newly unlocked `jdm_rotary` (#4) → Apply Livery #3 in Tab 2 → `5.0 KM FIA Grand Prix` on `track_neotokyo` + `sky_neotokyo_cyber` (`QUALIFIER_2_LAPS`, `MEDIUM` AI) with SSR wet puddles & lightning flashes → Execute Pacejka drift combos → Win #2 unlocking `car` (#5 Widebody Drift GT). |
| **`T4-03`** | First-Person 3D Cockpit Grand Prix | Select `skyline_gtr` (#6) → Launch `8.0 KM Pro GT Loop` (`GRAND_PRIX_3_LAPS`, `HARD` AI) → Switch to `Camera Mode: COCKPIT` → Verify framed `ior: 1.52` glass, dual wipers, rotating steering wheel + shift LEDs, and live 3D Digital Telemetry Screen (`KPH`, `Gear`, `RPM bar`, `Lap Delta`). |
| **`T4-04`** | Redrock Canyon Tactical Ramp & Stunt Mastery | Launch `rally` (#7) / `truck` (#9) on `12.0 KM` `track_canyon` + `sky_redrock_canyon` (`FEATURE_5_LAPS`, `HARD` AI) → Hit outer-lane `100m` chevrons for Type 1 Skybridge (`+12m`, `250m–400m`, `1.35x` boost), Type 2 Plasma Ring (`+80%` Nitro, `1.42x` surge for `4.0s`, `+2,500 CR`), and Type 3 Kinetic Shockwave (`>180 KPH`, `0%` slowdown, `+15%` boost, `15m` AI blast). |
| **`T4-05`** | Nordschleife `24.0 KM` "Green Hell" Tour & `400+ KPH` Wall Glide | Drive `koenigsegg` (#26, `445 KPH`) on `24.0 KM Nordschleife` (`48` sectors, `70+` corners, `+85m` mountain climb, `18°` banked carousel, tunnels, `45+` ramps) → Hit `445 KPH` on `3.2 KM` straightaway → Scrape guardrail verifying $\vec{T}/\vec{N}$ Lateral Tangent Barrier Projection (`ΔalongOffset > 0`, sparks, zero sticking). |
| **`T4-06`** | Coast-to-Coast `50.0 KM` Mega Highway Endurance & LRU Streaming | Drive `hyper` (#27 Bugatti W16, `420 KPH`) on `50.0 KM` `track_alpine` + `sky_alpine_glacier` (`100` × `500m` sectors, `ENDURANCE_10_LAPS`) with aurora borealis & blowing snow → Verify `PakStreamer` LRU cache evicts trailing sectors keeping resident GPU sectors bounded (`<= 16`). |
| **`T4-07`** | Knockout Elimination Last-Man-Standing Survival | Drive `police` (#12 Interceptor) in `KNOCKOUT_ELIMINATION` on `2.0 KM` `track_neotokyo` → Verify at the end of every lap the last-place racer is eliminated in a 3D explosion with `GranularSynthEngine` boom SFX until 1 survivor wins. |
| **`T4-08`** | Solo Time Attack Ghost Car & Sector 1/2/3 Split Challenge | Drive `porsche_gt3` (#18) in `SOLO_TIME_ATTACK` (`totalRacers = 1`) on `5.0 KM` `track_golden_gp` → Record `20Hz` Ghost Car on Lap 1 (`62.0s`) with S1/S2/S3 splits → Replay holographic Ghost Car on Lap 2 (`59.5s`) verifying negative green split deltas (`-2.50s`). |
| **`T4-09`** | Apex Legend `Super Hard` AI Tactical Showdown | Race `f1` (#32) against `SUPER_HARD` (`Apex Legend`) AI on `8.0 KM` `track_canyon` (`GRAND_PRIX_3_LAPS`) → Verify `SUPER_HARD` AI actively enters slipstream cones, takes `+12m` Skybridge Overpass shortcuts, and fires straightaway Nitro. |
| **`T4-10`** | Career `CR` Stunt Grinding & Early Dealership Purchase | With `totalWins = 1`, grind stunt/podium `CR` in `hot_hatch` (#2) → Purchase Tier 3 `corvette_gt` (#19, normally `16 Wins`) early using `CR` in Tab 1 Garage → Immediately launch a race in `corvette_gt`. |
| **`T4-11`** | Sandbox Unlock-All Toggle & Non-Destructive Career Restore | With `totalWins = 2` (`5` cars unlocked), click `[🔓 SANDBOX: UNLOCK ALL 34 CARS]` (`34` cars unlocked) → Race Tier 5 `fan_car` (#33) & `jet_thrust` (#34) → Toggle Sandbox OFF → Verify career cleanly restores `totalWins = 2` (`5` cars). |
| **`T4-12`** | Complete 31-Win Career Unlock Ladder Marathon | Start at `totalWins = 0` (`3` Tier 0 cars) → Execute 31 sequential 1st-place race wins (`w = 1..31`) → Verify every single win unlocks its exact vehicle (`#4 jdm_rotary` through `#34 jet_thrust`) with a 3D Podium & Turntable Reveal until all 34 cars are permanently unlocked. |
| **`T4-13`** | Supersonic Afterburner Land-Speed Record Run (`485 KPH`) | Drive `jet_thrust` (#34, `0–100: 1.65s`, `485 KPH`, `2,400 KG`) on the `3.2 KM` straightaway of `24.0 KM` `track_canyon` → Verify `134.72 m/s` `1:1` physical spline advancement, active DRS, max FOV warp, and `1,000°C` bright orange brake disc glow under heavy airbraking. |
| **`T4-14`** | Heavy Iron vs Featherweight Physics Contrast Journey | Contrast `scooter` (#1, `135 KG`, `0–100: 7.2s`, `145 KPH`) against `bus` (#15, `8,400 KG`, `0–100: 11.5s`, `136 KPH`) on `2.0 KM Stadium Sprint`, verifying `240Hz` spring-damper scaling, roll inertia, and acceleration across a `62.2x` mass ratio. |
| **`T4-15`** | Showroom 12 PBR Liveries, Framed Glass & 3D Engine Bay Tour | Inspect `lambo` (#23) and `pagani_v12` (#25) in `SHOWROOM` camera → Cycle all 12 PBR paints (`0..11`) in Tab 2 → Verify framed `ior: 1.52` glass, A/B/C pillars, tumblehome door glass, dual wipers, and transparent mid-engine bay window revealing the 3D V12 engine block. |
| **`T4-16`** | Mod Studio Tuning, Photo Mode Bokeh DOF & `.glb` Export Journey | Select `mclaren_lt` (#24) with Livery #7 → Tune suspension/aero in Tab 4 (`MOD STUDIO & GLB EXPORT`) → Enable Photo Mode Bokeh DOF → Export binary `.glb` (`exportCurrentVehicleGlb()`) and verify `0x46546C67` (`"glTF"`) v2 header, JSON chunk, and BIN vertex buffers. |
| **`T4-17`** | Keyboard-First Console Paddock & In-Race Camera Cycling Journey | Navigate Paddock Tabs `1 ↔ 2 ↔ 3 ↔ 4` via `[Q / E]` keys → Launch `muscle` (#11) on `5.0 KM` `track_neotokyo` → Cycle in-race cameras via `[C]` key (`CHASE → COCKPIT → HOOD → ORBIT → CHASE`). |
| **`T4-18`** | Uncapped Renderer Display & Post-FX Live Reconfiguration | Drive `ev_proto` (#28 Rimac Nevera, `412 KPH`) on `8.0 KM` `track_neotokyo` while dynamically toggling VSync (`120/144/240Hz`), SSAA (`1.0x–2.5x`), SSGI, SSR, and 4-cascade `4096×4096` CSM PCSS with zero framebuffer errors. |
| **`T4-19`** | 4-Biome × 4-Sky World Championship Tour | Complete 4 consecutive races across all 4 Track Biomes × all 4 Sky Biomes (`track_golden_gp`/`sky_golden_hour` `2 KM`, `track_neotokyo`/`sky_neotokyo_cyber` `5 KM`, `track_canyon`/`sky_redrock_canyon` `8 KM`, `track_alpine`/`sky_alpine_glacier` `12 KM`) verifying clean `.pak` streaming & cumulative career rewards. |
| **`T4-20`** | Persistent Career Save/Load Across Browser Reload | Win 2 races (`totalWins = 2`, unlocking `jdm_rotary` & `car`), earn `CR`/`XP`, and select Livery #4 → Persist to `localStorage` (`apex_gp_progression_v1`) → Reload/re-instantiate application → Verify exact restoration of `totalWins`, `credits`, `driverXp`, and `unlockedVehicleIds`. |
| **`T4-21`** | Granular Audio Synth Full Acoustic Journey | Exercise `GranularSynthEngine` from `BootLoadingScreen` V12 ignition roar through multi-RPM sweeps (`scooter`, `jdm_rotary`, `lambo`, `jet_thrust`), turbo blow-off, tire skid, slipstream wind, plasma ring chime, shockwave boom, and knockout explosion SFX. |
| **`T4-22`** | Canonical vs Indexed Asset Alias Stress Journey | Drive `PakStreamer` and `setCircuitConfig` across all indexed aliases (`sky_01..04`, `track_01..04`, `car_01..34`) and canonical IDs (`sky_golden_hour`.., `track_golden_gp`.., `scooter`..`jet_thrust`) verifying identical resolved `.pak` bundles and zero cache duplication. |
| **`T4-23`** | High-Speed Cockpit Telemetry & HUD 1:1 Synchronization Journey | Drive `indy_open` (#30, `380 KPH`) in `COCKPIT` mode on `12.0 KM` `track_alpine` (`SOLO_TIME_ATTACK`) → Verify 1:1 synchronization between 2D `RaceHUD` and 3D Cockpit Digital Telemetry Screen across `KPH`, `RPM`, `Gear`, `DRS`, `Nitro %`, `Brake Temp °C`, and `Sector Splits`. |
| **`T4-24`** | Full Production Smoke & Zero-Console-Error Playwright Certification | Full lifecycle execution (`BOOT` → `PADDOCK` Tabs 1..4 → `.glb` export → `RACING` in `COCKPIT` & `CHASE` → `POST_RACE` Podium & Turntable Reveal) verifying `0` `console.error` and `0` `pageerror` events. |

---

## 5. Coverage Thresholds & Gate Criteria

| Tier | Focus | Minimum Per-Feature / Matrix Requirement | Minimum Required Tests | Implemented E2E Tests | Status |
|---|---|---|---:|---:|---|
| **Tier 1** | Feature Coverage (Progressive Happy Paths) | `>= 5` tests × `42` features (`F1`–`F42`) | `>= 210` | **`210`** (`T1-F01-1` .. `T1-F42-5`) | READY |
| **Tier 2** | Boundary Value Analysis, Equivalence Partitioning & Negative Cases | `>= 5` tests × `42` features (`F1`–`F42`) | `>= 210` | **`210`** (`T2-F01-01` .. `T2-F42-05`) | READY |
| **Tier 3** | Cross-Feature Combinatorial & Pairwise Interactions | 6 pairwise interaction matrices (Groups A–F) | `>= 45` | **`50`** (`T3-01` .. `T3-50`) | READY |
| **Tier 4** | Real-World End-to-End Application Scenarios | Complete player, telemetry & browser journeys | `>= 21` | **`24`** (`T4-01` .. `T4-24`) | READY |
| **TOTAL (Tiers 1–4)** | **Complete Opaque-Box E2E Verification Suite** | **100% of `F1`–`F42` verified across all 4 tiers** | **`>= 486`** | **`494`** | **100% PASS** |
