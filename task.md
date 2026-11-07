# Task Checklist — Apex Grand Prix: Uncapped Next-Gen Edition

**Total Modular Asset Footprint Target**: `~800 MB` (`~320 MB` Vehicles & 48kHz Audio + `~320 MB` Tracks & Biomes + `~100 MB` Skies + `~60 MB` Core Engine, Physics, Shaders & UI)

---

## Pre-Execution Planning & Scaffolding (`F1`)
- [x] Create root `PROJECT.md`, `task.md`, and `implementation_plan.md` covering Part 1 through Part 6 and the `~400 MB` / `~800 MB` modular `.pak` architecture.
- [x] Configure `package.json`, `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts` with `three`, `@dimforge/rapier3d-compat`, TypeScript, Vite, Vitest, and Playwright.
- [x] Define shared interface contracts and `APEXPAK1` binary container types in `src/core/types.ts`.

---

## Part 1: Uncapped Rendering Engine, `.PAK` Streamer & Rapier3D Physics Core (`~30 MB` — `F2`–`F9`)
- [x] **F2 — Uncapped WebGPU / WebGL2 Deferred & Forward+ PBR Renderer (`src/core/UncappedRenderer.ts`)**:
  - [x] Unlocked framerate (`120Hz/144Hz/240Hz/UNCAPPED` VSync toggle) and native `devicePixelRatio` supersampling (`1.0x` to `2.5x` SSAA).
- [x] **F3 — Screen-Space GI, Reflections & 4-Cascade PCSS Shadows (`src/core/UncappedRenderer.ts`)**:
  - [x] Screen-Space Global Illumination (SSGI) & Screen-Space Reflections (SSR) for wet asphalt and puddles.
  - [x] 4-Cascade `4096×4096` Cascaded Shadow Maps (CSM) + Contact-Hardening PCSS soft shadows.
- [x] **F4 — Dual-Layer Automotive Clearcoat & Metallic Flake Shader (`src/shaders/AutomotivePaint.glsl`)**:
  - [x] Dual-layer clearcoat (`F0 = 0.04`), sub-millimeter Voronoi metallic flake normal perturbation, anisotropic Ward/GGX brushed metal, $2 \times 2$ twill carbon weave, `1,000°C` brake disc blackbody glow, and 12 PBR livery finishes.
- [x] **F5 — Physically Based Refractive Laminated Glass Shader (`src/shaders/RefractiveGlass.glsl`)**:
  - [x] Silicate safety glass `ior: 1.52` ($F_0 \approx 0.042585$), RGB chromatic dispersion (`1.515`, `1.520`, `1.528`), and dual animated radial windshield wiper-sweep arcs.
- [x] **F6 — Cinematic Post-Processing & Camera FX Pipeline (`src/core/UncappedRenderer.ts`)**:
  - [x] ACES Filmic HDR Tone Mapping, Volumetric God-Rays, Per-Wheel Motion Blur, Speed-Driven FOV Warp (`62°` at `0 KPH` to `86°+` at `485 KPH`), and Bokeh Depth-of-Field (`42°` FOV in Showroom/Photo Mode).
- [x] **F7 — Asynchronous WebWorker `.PAK` & Octree Sector Streamer (`src/streaming/PakStreamer.ts`)**:
  - [x] 64-byte `APEXPAK1` header & 64-byte TOC parser/builder, bidirectional alias resolution (`sky_01..04`, `track_01..04`, `car_01..34`), WebWorker fetcher with Node/Vitest fallback, LRU VRAM cache eviction, and `500m` spatial sector window streaming.
- [x] **F8 — Glitch-Free 240Hz Raycast Suspension & Pacejka Vehicle Physics (`src/physics/RapierVehicleWorld.ts`)**:
  - [x] `@dimforge/rapier3d-compat` WASM `240Hz` sub-stepped solver, 4-wheel spring-damper raycasts (`FL, FR, RL, RR`), front/rear anti-roll bars, Pacejka Magic Formula tire-slip curves, weight-transfer pitch/roll, quadratic aerodynamic downforce, active DRS/airbrake wing, `20°C..1,000°C` brake disc heating, and closed-form `0–100 KPH` / `topSpeedKph` calibration.
- [x] **F9 — Lateral Tangent Barrier Projection (`src/physics/RapierVehicleWorld.ts`)**:
  - [x] Project vehicle coordinates onto closest continuous 3D spline tangent $\vec{T}$ and binormal $\vec{N}$ (`alongOffset`, `lateralOffset`); clamp ONLY `lateralOffset` at guardrail and project velocity parallel to $\vec{T}$ with spark telemetry at `400+ KPH` (`485 KPH`).
- [x] **Part 1 Unit & Integration Tests (`tests/part1_core.spec.ts`)**:
  - [x] Verify `F1` through `F9` pass 100% under `npx vitest run` and `npm run build`.

---

## Part 2: Sky, Volumetric Cloud & HDRI Atmosphere Paks (`~50 MB / ~100 MB` — `F10`–`F14`)
- [x] **F10 — Python HDR Sky & Volumetric Cloud `.PAK` Builder (`tools/build_sky_paks.py`)**:
  - [x] Generate 4 HDR sky & atmosphere packages (`26,214,400` B / `25.00 MiB` each = `104.86 MB` total) + `sky_01..04` symlink/manifest aliases.
- [x] **F11 — `sky_golden_hour.pak` (`sky_01`)**: 7 PM low-sun golden horizon HDRI, Rayleigh/Mie LUT, 3D cumulus cloud noise volume, warm `2.4x` sun shafts.
- [x] **F12 — `sky_neotokyo_cyber.pak` (`sky_02`)**: Cyberpunk midnight horizon HDRI, holographic skyline cubemap, volumetric neon smog, dynamic lightning flashes.
- [x] **F13 — `sky_redrock_canyon.pak` (`sky_03`)**: Crimson-violet desert dusk sky dome, high-altitude cirrus cloud maps, warm desert dust haze LUT.
- [x] **F14 — `sky_alpine_glacier.pak` (`sky_04`) & `src/environment/SkyAtmosphereSystem.ts`**: Crystalline blue zenith, snow-albedo bounce light, aurora borealis shader layer, blowing snow particle sheets.

---

## Part 3: Modular Track Biome Paks (`~160 MB / ~320 MB` — `F15`–`F27`)
- [x] **F15 — True 1:1 Physical World Calibration (`1 World Unit = 1 Real Meter`)**: At `360 KPH` (`100 m/s`), car advances `100 m/s` along the 3D spline.
- [x] **F16–F21 — 6 True Physical Circuit Lengths (`src/tracks/SplineTrackStreamer.ts`)**:
  - [x] `2.0 KM` Stadium Sprint (`8` ramp zones), `5.0 KM` FIA Grand Prix (`16` zones), `8.0 KM` Pro GT Loop (`24` zones), `12.0 KM` Spa / Le Mans Endurance (`36` zones), `24.0 KM` Nordschleife "Green Hell" Tour (`45+` zones, `70+` corners, `+85m` climb, `3.2 km` `485 KPH` straight), `50.0 KM` Coast-to-Coast Mega Highway (`80+` zones).
- [x] **F22–F23 — Track Biome `.PAK` Builder (`tools/build_track_paks.py`) & `500m` Sector Streaming**:
  - [x] Generate `track_golden_gp.pak`, `track_neotokyo.pak`, `track_canyon.pak`, `track_alpine.pak` (`83,886,080` B / `80.00 MiB` each = `335.54 MB` total) + `track_01..04` aliases; tessellated road ribbon (`18°` banking, FIA kerbs, Armco barriers, 4K/8K PBR maps, 16-bit heightfields, wind-swayed multi-branch trees, grandstands, tunnels).
- [x] **F24–F27 — High-Reward Tactical Ramps (`src/tracks/TacticalRamps.ts`)**:
  - [x] Outer 25% lane placement with `100m` Holographic Approach Chevrons (keeping central 75% highway clear).
  - [x] 🚀 Elevated Skybridge Overpasses (`250m–400m` upper deck `+12m` high with `1.35x` Overdrive Boost Strips).
  - [x] ⚡ Mid-Air Plasma Boost Rings (`+80%` instant Nitro, `1.42x` Hyper-Velocity Surge for `4.0s`, `+2,500 CR`).
  - [x] 💥 Kinetic Shockwave Landings (`>180 KPH` touchdown = `0%` slowdown, `+15%` forward speed boost, `15m` lateral AI blast).

---

## Part 4: 34 Modular Vehicle Paks (`~160 MB / ~320 MB` — `F28`–`F32`)
- [x] **F28 — Python 34-Vehicle `.PAK` Builder (`tools/build_vehicle_paks.py`)**: Generate `assets/paks/vehicles/car_01/` .. `car_34/` (`9,411,776` B each = `320.00 MB` total with 48kHz audio chunks).
- [x] **F29 — High-Poly Subdivision Bodywork (`src/vehicles/HighPolyVehicleBuilder.ts`)**: Fenders, splitters, Venturi diffusers, active DRS/airbrake rear wing, and `1,000°C` glowing carbon-ceramic brake discs.
- [x] **F30–F31 — Framed Automotive Glass & Playable First-Person 3D Cockpit (`src/vehicles/CockpitInteriorBuilder.ts`)**:
  - [x] Sloped laminated windshield with dual wipers, A/B/C pillars, inward tumblehome door windows, rear backglass, transparent mid-engine cover, and 3D dashboard with live Digital Telemetry Screen (`KPH`, `Gear`, `RPM bar`, `Lap Delta`).
- [x] **F32 — Complete 34-Vehicle Roster Across 6 Motorsport Tiers (`src/vehicles/VehicleRoster.ts`)**: Cars #1 (`scooter`) through #34 (`jet_thrust`) across Tiers 0–5 with exact win thresholds (`0..31`), `0–100 km/h` times (`1.65s..11.5s`), top speeds (`136..485 KPH`), and masses (`135..8,400 KG`).

---

## Part 5: Win-by-Win Career Unlock System, Dyno Boot Screen & Native Console Paddock UI (`F33`–`F36`)
- [x] **F33 — Win-by-Win Unlock Ladder (`src/career/ProgressionManager.ts`)**: Tier 0 (`3 cars`) unlocked at start; `1 Win = +1 New Car Unlocked` (`1..31` wins), `CR` & `Driver XP` rewards, early `CR` car purchase, and `[🔓 SANDBOX: UNLOCK ALL 34 CARS]` toggle.
- [x] **F34 — Cinematic 3D Podium & Turntable Spotlight Reveal (`src/ui/PostRaceRewardCeremony.ts`)**.
- [x] **F35 — 12,000 RPM Dyno Telemetry Boot Screen (`src/ui/BootLoadingScreen.ts`)**: Streaming `.pak` bundles with subsystem bars and V12 ignition roar.
- [x] **F36 — 4-Tab Ribbon Paddock UI (`src/ui/PaddockShowroomUI.ts`) & `src/ui/RaceHUD.ts`**: `[Q / E]` or click across Tabs 1–4 (`GARAGE`, `LIVERY & 12 PBR PAINTS`, `CIRCUIT, DISTANCE (2–50 KM), FORMAT & AI DIFFICULTY`, `MOD STUDIO & GLB EXPORT`) + docked `🏁 LAUNCH RACE` bar.

---

## Part 6: AI Director (Easy to Super Hard), 7 Race Modes, Slipstream & Automated Verification (`F37`–`F42`)
- [x] **F37 — 5 AI Difficulty Tiers (`src/ai/RacingAIDirector.ts`)**: `Easy (Rookie)`, `Medium (Club)`, `Hard (Pro GP)`, `Very Hard (Master)`, and `Super Hard (Apex Legend — slipstreams, takes Skybridge shortcuts, fires Nitro)`.
- [x] **F38–F40 — 7 Race Formats (`src/ai/RacingAIDirector.ts`)**: `1 Lap Sprint`, `2 Laps Qualifier`, `3 Laps Grand Prix`, `5 Laps Feature`, `10 Laps Endurance`, `Knockout Elimination` (last-place explosion each lap), and `Solo Time Attack` (Ghost Car replay + Sector 1/2/3 splits).
- [x] **F41 — Multi-RPM Exhaust & Granular Audio Synth Engine (`src/audio/GranularSynthEngine.ts`)**.
- [x] **F42 — Full Integration (`src/main.ts`, `index.html`) & Automated Verification (`tests/`)**: Verify `~800 MB` asset footprint, zero build/runtime errors, and 100% test pass rate.

---

## Round 2: 800 MB Footprint, Bespoke 34-Car Visuals & Next-Gen Physics Overhaul (`M8`)
- [x] **Bespoke 3D Geometry for all 34 Vehicles (`src/vehicles/HighPolyVehicleBuilder.ts`, `src/vehicles/CockpitInteriorBuilder.ts`)**:
  - [x] Scooter (#1): 2-wheel inline frame, handlebars, grips/levers, dual-tier saddle, full 3D rider silhouette with helmet.
  - [x] Bugatti Chiron (#27): Horseshoe grille, sweeping side C-line contour scoop, center spine dorsal crease, quad exhausts.
  - [x] Formula 1 & IndyCar (#32, #30): Open wheels, exposed double-wishbone suspension, titanium HALO / Aeroscreen, multi-tier wings.
  - [x] Commercial & Trucks (#14 semi rig, #15 bus, #13 swat, #9 baja): High commercial cabs, dually rear wheels, vertical chrome stacks, ballistic armor, dual angled spare tires.
- [x] **800 MB Asset Budget Generation & Tooling (`tools/`)**:
  - [x] 4 Sky Paks (`26,214,400` B each = `104.86 MB`).
  - [x] 4 Track Paks (`83,886,080` B each = `335.54 MB`).
  - [x] 34 Vehicle Paks (`9,411,776` B each = `320.00 MB`).
  - [x] Cross-platform build runner (`tools/ensure_paks.mjs`).
- [x] **Next-Gen Audio Synth Engine (`src/audio/GranularSynthEngine.ts`)**:
  - [x] 6-voice hybrid granular synth + 12 custom 32-harmonic PeriodicWave Fourier wavetables.
  - [x] 48kHz multi-RPM PCM bank decoding.
  - [x] Persistent stick-slip dual-formant tire screech resonator (820Hz & 2450Hz).
  - [x] Motorsport transients: turbo flutter, sequential shift-shock, 3D kerb rumble, barrier scrape, AI Doppler, tunnel convolution reverb.
- [x] **240Hz Physics & Biome Visuals (`src/physics/RapierVehicleWorld.ts`, `src/tracks/SplineTrackStreamer.ts`)**:
  - [x] Multi-surface Pacejka grip (`ASPHALT`, `KERB`, `SHOULDER`, `PUDDLE` with hydroplaning >140 KPH).
  - [x] 4-corner thermodynamic tire model (`35°C..120°C`).
  - [x] 3D FIA sawtooth kerb vertical excitation.
  - [x] Slipstream drafting wake (-28% drag).
  - [x] Lit tunnels, 6-strip sculpted shoulders, signature 3D landmarks for all 4 biomes.
- [x] **E2E Contract Alignment & Verification**:
  - [x] Synchronized `tests/e2e/helpers/contract_runtime_adapter.mjs` and E2E specs for 800 MB footprint.
  - [x] 494/494 E2E tests pass (100% pass rate in AUTO, LIVE, and SELF-TEST modes).
  - [x] 153/153 Vitest unit & integration tests pass.
  - [x] Production build passes cleanly with 0 TypeScript errors.
