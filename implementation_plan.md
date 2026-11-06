# Implementation Plan — Apex Grand Prix: Uncapped Next-Gen Edition

## 1. Executive Summary & `~400 MB` Modular Asset Footprint Architecture

**"Apex Grand Prix: Uncapped Next-Gen Edition"** is engineered as a standalone, multi-part 3D racing simulation built with **TypeScript, Vite, Three.js (WebGPU / WebGL2 Deferred & Forward+ PBR pipeline), `@dimforge/rapier3d-compat` (`240Hz` sub-stepped raycast vehicle physics), Web Audio API Granular Synthesis, and Python (`numpy` + `Pillow`) binary `.pak` builders**.

### Modular Disk Footprint Breakdown (`~400 MB` Total)

| Asset Pool | Target Path | Count | Unit Size | Pool Footprint | Contents |
|---|---|---:|---:|---:|---|
| **1. Vehicles** | `assets/paks/vehicles/car_01..34/vehicle.pak` | 34 | `~4.706 MB` (`4,705,888 B`) | **`~160.0 MB`** | LOD0–LOD2 high-poly meshes, 4K PBR textures, 12 liveries, framed glass, 3D cockpits, multi-RPM exhaust PCM audio |
| **2. Tracks & Biomes** | `assets/paks/tracks/track_*.pak` (`track_01..04`) | 4 | `40.00 MiB` (`41,943,040 B`) | **`~160.0 MB`** (`167.8 MB`) | `100 × 500m` spatial sectors (`2.0 KM` to `50.0 KM` 1:1 scale), 4K/8K asphalt PBR maps, 16-bit heightfields, forests, grandstands, Skybridges |
| **3. Sky & Volumetric Atmosphere** | `assets/paks/sky/sky_*.pak` (`sky_01..04`) | 4 | `12.50 MiB` (`13,107,200 B`) | **`~50.0 MB`** (`52.4 MB`) | HDR equirectangular sky domes, 3D volumetric cloud noise volumes, Rayleigh/Mie scattering LUTs, PMREM cubemap mip chains |
| **4. Core Engine, Physics, Shaders & UI** | `src/`, `dist/`, `node_modules/` runtime | 1 | `~30.0 MB` | **`~30.0 MB`** | `Rapier3D` WASM physics, `AutomotivePaint.glsl`, `RefractiveGlass.glsl`, `UncappedRenderer`, `PakStreamer`, UI & synth |
| **Total Footprint** | | | | **`~400.0 MB`** | Verified automatically via `tests/` |

---

## 2. Binary `APEXPAK1` Container Specification (`tools/*.py` ↔ `src/streaming/PakStreamer.ts`)

Every `.pak` file starts with a 64-byte little-endian header followed by `entryCount` 64-byte Table-of-Contents (TOC) descriptors and 64-byte-aligned binary payload chunks:

1. **Global Header (`64 bytes`, `0x00..0x3F`)**:
   - `0x00..0x07` (`8 B`): ASCII magic `"APEXPAK1"`
   - `0x08..0x0B` (`4 B`): `uint32` `version = 1`
   - `0x0C..0x0F` (`4 B`): `uint32` `pakType` (`1 = SKY`, `2 = TRACK`, `3 = VEHICLE`)
   - `0x10..0x17` (`8 B`): `uint64` `totalByteLength`
   - `0x18..0x1B` (`4 B`): `uint32` `entryCount`
   - `0x1C..0x1F` (`4 B`): `uint32` `sectorCount` (`100` for Track `.pak` representing `100 × 500m = 50.0 KM`, `0` for Sky/Vehicle)
   - `0x20..0x3F` (`32 B`): UTF-8 null-padded `assetId` (`"sky_golden_hour"`, `"track_golden_gp"`, `"car_01"`, etc.)
2. **TOC Entry (`64 bytes` each)**:
   - `0x00..0x1F` (`32 B`): UTF-8 null-padded chunk `name`
   - `0x20..0x23` (`4 B`): `uint32` `chunkType` (`TEX_RGBA8`, `TEX_RGBE`, `VOL_U8`, `HEIGHT_U16`, `SECTOR_F32`, `MESH_F32`, `JSON_META`, `AUDIO_PCM16`)
   - `0x24..0x27` (`4 B`): `uint32` `width`
   - `0x28..0x2B` (`4 B`): `uint32` `height`
   - `0x2C..0x2F` (`4 B`): `uint32` `depthOrItems`
   - `0x30..0x37` (`8 B`): `uint64` `byteOffset` (64-byte aligned)
   - `0x38..0x3F` (`8 B`): `uint64` `byteLength`

---

## 3. Part-by-Part Execution Architecture

### Part 1: Uncapped Rendering Engine, `.PAK` Streamer & Rapier3D Physics Core (`~30 MB`)
1. **`src/core/UncappedRenderer.ts` (`F2`, `F3`, `F6`)**:
   - Unlocked framerate selector (`120 | 144 | 240 | 'UNCAPPED'`) and native `devicePixelRatio` supersampling (`1.0x` to `2.5x` SSAA).
   - Screen-Space Global Illumination (SSGI), wet asphalt & puddle Screen-Space Reflections (SSR), and 4-Cascade `4096×4096` Cascaded Shadow Maps ($\lambda = 0.65$ logarithmic-uniform split across `[0.5m .. 1200m]`) with 16-tap Vogel-disk Contact-Hardening PCSS.
   - ACES Filmic HDR Tone Mapping, Volumetric God-Rays, Per-Wheel Angular Velocity Motion Blur, Speed-Driven FOV Warp (`62°` at `0 KPH` up to `86°+` at `485 KPH`), and Showroom/Photo Mode Bokeh Depth-of-Field (`42°` FOV).
2. **`src/shaders/AutomotivePaint.glsl` (`F4`) & `src/shaders/RefractiveGlass.glsl` (`F5`)**:
   - Dual-layer clearcoat ($F_0 = 0.04$), 3D Voronoi sub-millimeter metallic flake normal perturbation, anisotropic Ward/GGX brushed metal lobe, $2 \times 2$ twill carbon-fiber weave, and `1,000°C` carbon-ceramic brake rotor blackbody glow across 12 PBR livery presets.
   - Laminated silicate glass (`uIor = 1.52`, $F_0 \approx 0.042585$), RGB chromatic dispersion ($\text{IOR}_R = 1.515, \text{IOR}_G = 1.520, \text{IOR}_B = 1.528$), and dual animated radial windshield wiper-sweep arcs.
3. **`src/streaming/PakStreamer.ts` (`F7`)**:
   - Multi-threaded WebWorker `.pak` streamer with zero-copy `Transferable` `ArrayBuffer` transfers, LRU GPU VRAM cache eviction, bidirectional alias resolution (`sky_01..04`, `track_01..04`, `car_01..34`), and `500m` spatial sector window streaming.
4. **`src/physics/RapierVehicleWorld.ts` (`F8`, `F9`)**:
   - `@dimforge/rapier3d-compat` WASM world stepping at fixed `240Hz` ($\Delta t = 1/240\text{ s}$), 4-wheel spring-damper raycasts (`FL, FR, RL, RR`), front/rear anti-roll bars, Pacejka Magic Formula tire-slip curves, weight-transfer pitch/roll, quadratic downforce, active DRS/airbrake wing, `20°C..1,000°C` brake disc thermal model, and closed-form `0–100 KPH` / `topSpeedKph` calibration.
   - **Lateral Tangent Barrier Projection (`F9`)**: Projects vehicle position onto closest continuous 3D spline tangent $\vec{T}$ and binormal $\vec{N}$; clamps ONLY `lateralOffset` at the guardrail while leaving `alongOffset` strictly untouched, projects velocity parallel to $\vec{T}$, and emits high-speed barrier collision sparks at `400+ KPH`.

### Part 2: Sky, Volumetric Cloud & HDRI Atmosphere Paks (`~50 MB` Total • `~12.5 MB` × 4 Skies)
- `tools/build_sky_paks.py` (`numpy` + `Pillow`) builds `sky_golden_hour.pak`, `sky_neotokyo_cyber.pak`, `sky_redrock_canyon.pak`, and `sky_alpine_glacier.pak` (`13,107,200` bytes each) + `sky_01..04` aliases.
- `src/environment/SkyAtmosphereSystem.ts` drives HDRI sky domes, Rayleigh/Mie/dust scattering LUTs, 3D volumetric cloud shadow projection, Neo-Tokyo lightning, and Alpine aurora borealis + snow particle sheets.

### Part 3: Modular Track Biome Paks (`~160 MB` Total • `~40 MB` × 4 Circuits) & True 1:1 Scale (2–50 KM)
- `tools/build_track_paks.py` generates `track_golden_gp.pak`, `track_neotokyo.pak`, `track_canyon.pak`, and `track_alpine.pak` (`41,943,040` bytes each, `100 × 500m` sectors) + `track_01..04` aliases.
- `src/tracks/SplineTrackStreamer.ts` enforces `1 World Unit = 1 Real Meter` (`360 KPH = 100 m/s`) across 6 selectable physical circuit lengths (`2.0, 5.0, 8.0, 12.0, 24.0, 50.0 KM`) with banked corners up to `18°`, FIA sawtooth kerbs, Armco barriers, 4K/8K PBR maps, 16-bit heightfields, wind-swayed forests, grandstands, and tunnels.
- `src/tracks/TacticalRamps.ts` places outer-lane ramps with `100m` Holographic Approach Chevrons and implements Elevated Skybridge Overpasses (`+12m` high, `250m–400m` long, `1.35x` boost), Mid-Air Plasma Boost Rings (`+80%` Nitro, `1.42x` for `4.0s`, `+2,500 CR`), and Kinetic Shockwave Landings (`>180 KPH` = `0%` slowdown, `+15%` speed boost, `15m` rival blast).

### Part 4: 34 Modular Vehicle Paks (`~160 MB` Total • `~4.7 MB` × 34 Cars) with Framed Glass & 3D Cockpits
- `tools/build_vehicle_paks.py` generates `assets/paks/vehicles/car_01..34/vehicle.pak` (`4,705,888` bytes each).
- `src/vehicles/VehicleRoster.ts`, `src/vehicles/HighPolyVehicleBuilder.ts`, and `src/vehicles/CockpitInteriorBuilder.ts` build all 34 vehicles across Tiers 0–5 (`scooter` through `jet_thrust`), framed multi-pane windows with dual animated wipers, A/B/C pillars, transparent mid-engine bay window, and playable `Camera Mode: COCKPIT` with a live 3D Digital Telemetry Screen (`KPH`, `Gear`, `RPM bar`, `Lap Delta`).

### Part 5: Win-by-Win Career Unlock System, Dyno Boot Screen & 4-Tab Console Paddock UI
- `src/career/ProgressionManager.ts`, `src/ui/BootLoadingScreen.ts`, `src/ui/PaddockShowroomUI.ts`, `src/ui/PostRaceRewardCeremony.ts`, and `src/ui/RaceHUD.ts` implement the `1 Win = +1 New Car` career ladder (`0..31` wins), `CR` & `XP` rewards, `[🔓 SANDBOX: UNLOCK ALL 34 CARS]` toggle, `12,000 RPM` Tachometer Boot Screen, 3D Podium & Turntable Reveal, and 4-Tab Ribbon Paddock UI with docked `🏁 LAUNCH RACE` bar.

### Part 6: 5-Tier AI Director, 7 Race Formats, Granular Synth & Full Verification
- `src/ai/RacingAIDirector.ts` implements 5 AI difficulty tiers (`Easy` to `Super Hard`) and 7 race formats (`1/2/3/5/10 Lap` formats, `Knockout Elimination`, and `Solo Time Attack` with Ghost Car & Sector 1/2/3 splits).
- `src/audio/GranularSynthEngine.ts` synthesizes multi-RPM exhaust audio, V12 boot roar, turbo blow-off, skids, plasma rings, shockwaves, and knockout explosions.
- `src/main.ts` and `index.html` integrate all Parts and expose `window.__APEX_GAME__` for deterministic E2E verification.
