# Project: Apex Grand Prix: Uncapped Next-Gen Edition

## Architecture

**"Apex Grand Prix: Uncapped Next-Gen Edition"** is a standalone, multi-part AAA-grade 3D Racing Game built with **TypeScript, Vite, Three.js (WebGPU / WebGL2 Deferred & Forward+ PBR pipeline), `@dimforge/rapier3d-compat` (`240Hz` sub-stepped raycast vehicle physics), Web Audio API Granular Synthesis, and Python (`numpy` + `Pillow`) `.pak` asset generators** producing an expanded **`~800 MB` Total Modular Asset Footprint** (scaled from the initial `~400 MB` baseline):

1. **Vehicles & 48kHz Audio (`~320.0 MB` total • `9,411,776` B per car × 34 cars)**: `assets/paks/vehicles/car_01/` .. `car_34/` (Bespoke 3D visual geometry for all 34 cars, High-poly LOD0–LOD2 meshes, 4K PBR texture sets, 12 livery finishes, framed automotive glass windows, playable 3D cockpit interiors with live telemetry screens, and `~5.40 MB/car` 48kHz multi-RPM PCM exhaust audio).
2. **Tracks & Biomes (`~320.0 MB` total • `83,886,080` B per circuit × 4 circuits = `335.5 MB`)**: `assets/paks/tracks/track_golden_gp.pak`, `track_neotokyo.pak`, `track_canyon.pak`, `track_alpine.pak` + `track_01..04` symlink/manifest aliases (Streamed in `500m` spatial sectors across `2.0 KM` to `50.0 KM` true 1:1 physical lap lengths with per-biome 8K/4K surface textures, true banked road normals, 6-strip sculpted terrain shoulders, 25-luminaire lit tunnels, botanical forests, signature 3D landmarks for all 4 biomes, grandstands, and 3 Tactical Ramp types including Elevated Skybridge Overpasses, Mid-Air Plasma Boost Rings, and Kinetic Shockwave Landings).
3. **Sky & Volumetric Atmosphere (`~100.0 MB` total • `26,214,400` B per sky × 4 skies = `104.9 MB`)**: `assets/paks/sky/sky_golden_hour.pak`, `sky_neotokyo_cyber.pak`, `sky_redrock_canyon.pak`, `sky_alpine_glacier.pak` + `sky_01..04` symlink/manifest aliases (HDR equirectangular sky domes, 3D volumetric cloud noise grids, Rayleigh/Mie/dust scattering LUTs, and PMREM specular cubemap mip chains).
4. **Core Engine, Physics, Shaders & UI (`~60.0 MB` budget)**: `src/` + compiled runtime (`Rapier3D` WASM physics with multi-surface Pacejka grip and 4-corner tire thermals, custom GLSL/WGSL clearcoat & refractive glass shaders, 6-voice hybrid granular audio synth, UI assets, and dependencies).

### Data Flow & Module Boundaries
```text
[Python Asset Builders (tools/)]
  ├── build_sky_paks.py     ──► assets/paks/sky/*.pak (~100 MB)
  ├── build_track_paks.py   ──► assets/paks/tracks/*.pak (~320 MB)
  └── build_vehicle_paks.py ──► assets/paks/vehicles/car_01..34/ (~320 MB)
                                       │
                                       ▼
                        [src/streaming/PakStreamer.ts] (WebWorker + LRU VRAM Cache)
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
[src/environment/]            [src/tracks/]                  [src/vehicles/]
SkyAtmosphereSystem.ts        SplineTrackStreamer.ts         VehicleRoster.ts
                              TacticalRamps.ts               HighPolyVehicleBuilder.ts
                                       │                     CockpitInteriorBuilder.ts
                                       ▼                              │
                        [src/physics/RapierVehicleWorld.ts] ◄─────────┘
                        (240Hz 4-Wheel Raycast + Pacejka +
                         Lateral Tangent T/N Barrier Projection)
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
[src/core/UncappedRenderer.ts] [src/ai/RacingAIDirector.ts]   [src/career/ & src/ui/]
+ AutomotivePaint.glsl         (5 AI Tiers + 7 Race Formats   ProgressionManager.ts
+ RefractiveGlass.glsl          + Ghost Car + Knockout)       BootLoadingScreen.ts
                                       │                      PaddockShowroomUI.ts
                                       ▼                      PostRaceRewardCeremony.ts
                        [src/audio/GranularSynthEngine.ts]    RaceHUD.ts
                                       │                              │
                                       └──────────────┬───────────────┘
                                                      ▼
                                               [src/main.ts]
                                         (window.__APEX_GAME__)
```

---

## Feature Inventory

Every feature discovered during Phase 0 Survey (`explorer_survey_1`, `explorer_survey_2`, `spec_miner_survey_3`) is cataloged below and assigned to a Milestone (`M1`–`M7`). Zero features are unassigned.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Project Task Checklist & Implementation Plan | Create `task.md`, `implementation_plan.md`, and root `PROJECT.md` covering Parts 1–6 and the `~400 MB` modular asset architecture | M1 | survey (`ORIGINAL_REQUEST.md:22-26`) |
| F2 | Uncapped WebGPU / WebGL2 Deferred & Forward+ PBR Renderer | `src/core/UncappedRenderer.ts` with unlocked framerate (`120Hz/144Hz/240Hz` VSync toggle) and native `devicePixelRatio` supersampling (`1.0x` to `2.5x` SSAA) | M1 | survey (`ORIGINAL_REQUEST.md:32-33`) |
| F3 | Screen-Space GI, Reflections & 4-Cascade PCSS Shadows | SSGI, SSR for wet asphalt and puddles, and 4-Cascade `4096×4096` Cascaded Shadow Maps (CSM) + Contact-Hardening PCSS soft shadows | M1 | survey (`ORIGINAL_REQUEST.md:34-36`) |
| F4 | Dual-Layer Automotive Clearcoat & Metallic Flake Shader | `src/shaders/AutomotivePaint.glsl` with dual-layer clearcoat, sub-millimeter metallic flake normal perturbation, and anisotropic brushed metal supporting 12 PBR paints | M1 | survey (`ORIGINAL_REQUEST.md:37`) |
| F5 | Physically Based Refractive Laminated Glass Shader | `src/shaders/RefractiveGlass.glsl` with `ior: 1.52`, RGB chromatic dispersion, Fresnel reflection, and animated wiper-sweep mask | M1 | survey (`ORIGINAL_REQUEST.md:38`) |
| F6 | Cinematic Post-Processing & Camera FX Pipeline | ACES Filmic HDR Tone Mapping, Volumetric God-Rays, Per-Wheel Motion Blur, Speed-Driven FOV Warp, and Bokeh Depth-of-Field in Showroom/Photo Mode | M1 | survey (`ORIGINAL_REQUEST.md:39`) |
| F7 | Asynchronous WebWorker `.PAK` & Octree Sector Streamer | `src/streaming/PakStreamer.ts` streaming vehicle (`~4.7 MB`), sky (`~12.5 MB`), and track sector (`~40 MB` in `500m` sectors) `.pak` bundles into GPU VRAM on demand with LRU cache eviction and `sky_01..04`/`track_01..04` alias support | M1 | survey (`ORIGINAL_REQUEST.md:40-41`) |
| F8 | 240Hz Raycast Suspension & Pacejka Vehicle Physics | `src/physics/RapierVehicleWorld.ts` integrating `@dimforge/rapier3d-compat` + `240Hz` sub-stepped 4-wheel spring-damper raycasts, anti-roll bars, Pacejka tire-slip curves, weight-transfer pitch/roll, and speed-dependent downforce | M1 | survey (`ORIGINAL_REQUEST.md:42-43`) |
| F9 | Lateral Tangent Barrier Projection (Zero Teleporting/Sticking) | Projects vehicle coordinates onto closest 3D spline tangent $\vec{T}$ and binormal $\vec{N}$ (`alongOffset`, `lateralOffset`); clamps ONLY `lateralOffset` at guardrail and projects velocity parallel to $\vec{T}$ with sparks at `400+ KPH` | M1 | survey (`ORIGINAL_REQUEST.md:44-46`) |
| F10 | Python HDR Sky & Volumetric Cloud `.PAK` Builder | `tools/build_sky_paks.py` (`numpy` + `Pillow`) generating 4 HDR sky & atmosphere `.pak` packages (`~12.5 MB` each, `~50 MB` total) + `sky_01..04` symlink/manifest aliases | M2 | survey (`ORIGINAL_REQUEST.md:50-57`) |
| F11 | Golden Hour Sky Pak & Atmosphere (`sky_golden_hour.pak`) | `~12.5 MB` (`sky_01` alias): 7 PM low-sun golden horizon HDRI, Rayleigh/Mie scattering LUT, 3D cumulus cloud noise volume casting moving ground shadows, warm `2.4x` directional sun shafts | M2 | survey (`ORIGINAL_REQUEST.md:54`) |
| F12 | Neo-Tokyo Cyber Sky Pak & Atmosphere (`sky_neotokyo_cyber.pak`) | `~12.5 MB` (`sky_02` alias): Cyberpunk midnight horizon HDRI, distant holographic skyline cubemap, volumetric neon smog layers, dynamic lightning flashes | M2 | survey (`ORIGINAL_REQUEST.md:55`) |
| F13 | Redrock Canyon Sky Pak & Atmosphere (`sky_redrock_canyon.pak`) | `~12.5 MB` (`sky_03` alias): Crimson-violet desert dusk sky dome, high-altitude cirrus cloud maps, warm desert dust haze LUT | M2 | survey (`ORIGINAL_REQUEST.md:56`) |
| F14 | Alpine Glacier Sky Pak & Atmosphere (`sky_alpine_glacier.pak`) | `~12.5 MB` (`sky_04` alias): Crisp high-altitude crystalline blue zenith, snow-albedo horizon bounce light, aurora borealis upper-atmosphere shader layer, blowing snow particle sheets in `src/environment/SkyAtmosphereSystem.ts` | M2 | survey (`ORIGINAL_REQUEST.md:57`) |
| F15 | True 1:1 Physical World Calibration (`1 World Unit = 1 Real Meter`) | `src/tracks/SplineTrackStreamer.ts`: No text multiplier faking; at `360 KPH` (`100 m/s`), vehicle physically advances `100 meters per second` along the 3D spline | M3 | survey (`ORIGINAL_REQUEST.md:64-65`) |
| F16 | 2.0 KM Stadium Sprint Circuit Configuration | `2,000m` true spline (`4` × `500m` sectors) • `~22–26s/lap` • `8` Tactical Ramp/Skybridge zones | M3 | survey (`ORIGINAL_REQUEST.md:67`) |
| F17 | 5.0 KM FIA Grand Prix Circuit Configuration | `5,000m` true spline (`10` × `500m` sectors) • `~1 min/lap` • `16` Tactical Ramp/Skybridge zones | M3 | survey (`ORIGINAL_REQUEST.md:68`) |
| F18 | 8.0 KM Pro GT Loop Circuit Configuration | `8,000m` true spline (`16` × `500m` sectors) • `~1.6 min/lap` • `24` Tactical Ramp/Skybridge zones | M3 | survey (`ORIGINAL_REQUEST.md:69`) |
| F19 | 12.0 KM Spa / Le Mans Endurance Circuit Configuration | `12,000m` true spline (`24` × `500m` sectors) • `~2.4 min/lap` • `36` Tactical Ramp/Skybridge zones | M3 | survey (`ORIGINAL_REQUEST.md:70`) |
| F20 | 24.0 KM Nordschleife "Green Hell" Tour Circuit Configuration | `24,000m` true physical spline (`48` × `500m` sectors) • `~4.5–5.2 min/lap` at `300+ KPH` • `70+` corners, `+85m` mountain elevation climbs, banked carousel turns, tunnels, `45+` tactical ramps/skybridges, `3.2 km` `485 KPH` straightaway | M3 | survey (`ORIGINAL_REQUEST.md:71`) |
| F21 | 50.0 KM Coast-to-Coast Mega Highway Circuit Configuration | `50,000m` true physical spline (`100` × `500m` sectors) • `~9–10 min/lap` • `80+` tactical ramp/skybridge zones | M3 | survey (`ORIGINAL_REQUEST.md:72`) |
| F22 | Python Track Biome `.PAK` Builder & `500m` Sector Streamer | `tools/build_track_paks.py` generating `track_golden_gp.pak`, `track_neotokyo.pak`, `track_canyon.pak`, `track_alpine.pak` (`~40 MB` each = `~160 MB` total) + `track_01..04` aliases, streamed in `500m` spatial sectors by `src/tracks/SplineTrackStreamer.ts` | M3 | survey (`ORIGINAL_REQUEST.md:73-74`) |
| F23 | High-Density Tessellated Road Ribbon, 4K/8K PBR Surfaces & Scenery | Sub-meter cross-section vertices, crown camber, banked corners up to `18°`, 3D extruded FIA sawtooth kerbs, double-wave Armco barriers; 4K/8K asphalt aggregate albedo, 16-bit normal maps, racing-line roughness, puddle masks, 16-bit heightfields; multi-branch 3D oak, pine, saguaro, snow-spruce trees with wind-sway shaders, grandstands, pit buildings, cantilever gantries, illuminated tunnels | M3 | survey (`ORIGINAL_REQUEST.md:75-77`) |
| F24 | Outer-Lane Tactical Ramp Placement & 100m Approach Chevrons | `src/tracks/TacticalRamps.ts`: Ramps placed strictly in outer 25% lanes with `100m` Holographic Approach Chevrons, keeping central `75%` highway clear | M3 | survey (`ORIGINAL_REQUEST.md:78-79`) |
| F25 | Elevated Skybridge Overpasses (Ramp Type 1) | Launches vehicle onto a `250m–400m` Elevated Upper-Deck Highway (`12m` above main road) lined with continuous `1.35x` Overdrive Boost Strips bypassing ground AI traffic and chicanes | M3 | survey (`ORIGINAL_REQUEST.md:80`) |
| F26 | Mid-Air Plasma Boost Rings (Ramp Type 2) | Suspended neon ring above ramp lip granting `+80%` instant Nitro refill, `1.42x` Hyper-Velocity Surge for `4.0 seconds` upon landing, and `+2,500 CR` stunt bonus | M3 | survey (`ORIGINAL_REQUEST.md:81`) |
| F27 | Kinetic Shockwave Landings (Ramp Type 3) | Touching down at `>180 KPH` triggers ZERO (`0%`) landing slowdown; suspension compression fires a 3D Kinetic Shockwave Ring boosting forward speed by `+15%` (`1.15x`) and blasting AI rivals within `15m` sideways | M3 | survey (`ORIGINAL_REQUEST.md:82`) |
| F28 | Python 34-Vehicle Modular `.PAK` Builder | `tools/build_vehicle_paks.py` generating `assets/paks/vehicles/car_01/` .. `car_34/` averaging `~4.7 MB` per car (`~160 MB` total) with LOD0–LOD2 meshes, 4K PBR textures, 12 liveries, 3D cockpits, and multi-RPM exhaust audio | M4 | survey (`ORIGINAL_REQUEST.md:86-90`) |
| F29 | High-Poly Subdivision Bodywork, Active Aero & Glowing Brake Discs | `src/vehicles/HighPolyVehicleBuilder.ts`: Contoured fenders, front splitters, Venturi underbody diffusers, dynamic DRS/airbrake rear wings tilting under braking, and carbon-ceramic brake discs glowing to `1,000°C` bright orange | M4 | survey (`ORIGINAL_REQUEST.md:91-92`) |
| F30 | Framed Multi-Pane Automotive Glass & Mid-Engine Bay Window | `src/vehicles/CockpitInteriorBuilder.ts`: Sloped laminated windshield with dual animated wipers, painted A-pillars, interior rearview mirror; framed left/right door windows with inward tumblehome curvature, gloss-black B/C-pillars, beltline trim, wing mirrors; sloped rear backglass + transparent mid-engine bay cover revealing 3D engine block | M4 | survey (`ORIGINAL_REQUEST.md:93-96`) |
| F31 | Playable First-Person 3D Cockpit Interior (`Camera Mode: COCKPIT`) | `src/vehicles/CockpitInteriorBuilder.ts`: 3D dashboard with live Digital Telemetry Screen (`KPH`, `Gear`, `RPM bar`, `Lap Delta` rendered on 3D dash mesh), rotating steering wheel with shift LEDs, twin bolstered racing seats, roll cage, driver helmet | M4 | survey (`ORIGINAL_REQUEST.md:97-98`) |
| F32 | Complete 34-Vehicle Roster Across 6 Motorsport Tiers (Tiers 0–5) | `src/vehicles/VehicleRoster.ts`: All 34 vehicles (`scooter` #1 through `jet_thrust` #34) across Tiers 0–5 with exact win thresholds (`0..31`), `0–100 km/h` times (`1.65s..11.5s`), top speeds (`136..485 KPH`), and masses (`135..8,400 KG`) | M4 | survey (`ORIGINAL_REQUEST.md:99-139`) |
| F33 | Win-by-Win Career Unlock Ladder (`1 Win = +1 New Car`) & Sandbox Toggle | `src/career/ProgressionManager.ts`: Starts with Tier 0 unlocked (`3 cars`); each 1st-place win increments `totalWins` (`1..31`); awards `CR` and `Driver XP` for podiums, clean overtakes, slipstream drafting, drift combos, skybridge stunts (`+2,500 CR`), takedowns; early `CR` car purchase; top-header `[🔓 SANDBOX: UNLOCK ALL 34 CARS]` toggle | M5 | survey (`ORIGINAL_REQUEST.md:146-148`) |
| F34 | Cinematic 3D Podium & Turntable Spotlight Reveal | `src/ui/PostRaceRewardCeremony.ts`: Post-race 3D podium ceremony and turntable spotlight reveal for newly unlocked vehicles | M5 | survey (`ORIGINAL_REQUEST.md:147`) |
| F35 | 12,000 RPM Dyno Telemetry Boot Screen | `src/ui/BootLoadingScreen.ts`: Fullscreen animated `12,000 RPM` Tachometer Boot Screen streaming `.pak` bundles (`~400 MB` pool) with live subsystem progress bars and V12 startup roar on ignition | M5 | survey (`ORIGINAL_REQUEST.md:149-150`) |
| F36 | 4-Tab Ribbon Paddock Showroom UI & Launch Bar | `src/ui/PaddockShowroomUI.ts`: 4-Tab Ribbon UI (`[Q / E]` or click): `1. GARAGE (34 Cars by Tier)`, `2. LIVERY & 12 PBR PAINTS`, `3. CIRCUIT, DISTANCE (2–50 KM), FORMAT & AI DIFFICULTY`, `4. MOD STUDIO & GLB EXPORT`, plus permanently docked bottom `🏁 LAUNCH RACE` bar | M5 | survey (`ORIGINAL_REQUEST.md:151`) |
| F37 | 5-Tier Racing AI Director | `src/ai/RacingAIDirector.ts`: `Easy (Rookie)`, `Medium (Club)`, `Hard (Pro GP)`, `Very Hard (Master)`, and `Super Hard (Apex Legend — actively slipstreams, takes Skybridge overpass shortcuts, and fires Nitro on straights)` | M6 | survey (`ORIGINAL_REQUEST.md:158`) |
| F38 | 5 Standard Lap-Based Race Formats | `src/ai/RacingAIDirector.ts`: `1 Lap Sprint`, `2 Laps Qualifier`, `3 Laps Grand Prix`, `5 Laps Feature`, `10 Laps Endurance` | M6 | survey (`ORIGINAL_REQUEST.md:159`) |
| F39 | Knockout Elimination Race Format | `src/ai/RacingAIDirector.ts`: Last-place racer at the end of every lap is eliminated in a 3D explosion until 1 winner remains | M6 | survey (`ORIGINAL_REQUEST.md:159`) |
| F40 | Solo Time Attack Mode with Ghost Car & Sector Splits | `src/ai/RacingAIDirector.ts`: Solo timed run with Ghost Car replay and real-time Sector 1, Sector 2, and Sector 3 split deltas | M6 | survey (`ORIGINAL_REQUEST.md:159`) |
| F41 | Multi-RPM Exhaust & Granular Audio Synth Engine | `src/audio/GranularSynthEngine.ts`: 6-Voice Hybrid `.PAK` PCM Granular + 12 Custom 32-Harmonic `PeriodicWave` powertrain families, dual-formant exhaust & throttle-gated intake induction, idle lope LFO, redline rev-limiter bounce, turbo spool & `stu-tu-tu` compressor surge flutter, straight-cut gear whine, upshift ignition-cut pop & downshift rev-match bark, overrun backfire crackles, continuous non-spamming stick-slip tire screech, broadband slipstream wind, FIA kerb rumble, stereo barrier scrape, AI rival 3D Doppler pass-by, tunnel/canyon acoustic reverb, and 4 biome spatial ambiences | M6, M8 | survey (`ORIGINAL_REQUEST.md:13,16,89,150,156,178`) |
| F42 | Automated Build, `~800 MB` Asset Footprint & E2E Runtime Verification | `tests/`: Execute Python `.pak` builders via cross-platform runner, verify `~800 MB` total asset footprint (`~320 MB` vehicles & sound banks + `~320 MB` tracks & biomes + `~100 MB` sky & atmosphere + `~60 MB` core/physics/code), compile TypeScript/Vite bundle, pass 100% of unit & E2E tests (Tiers 1–4) + Tier 5 adversarial hardening with zero build or runtime console errors | M7 | survey (`ORIGINAL_REQUEST.md:156,160,178`) |

---

## Round 2 Next-Gen Feature Inventory (800 MB Footprint, Bespoke 34-Car Visuals & Next-Gen Physics)

| Upgrade ID | Feature Name & Target | Implementation Details | Milestone | References |
|---|---|---|---|---|
| R2-F43 | 48kHz Multi-RPM Powertrain PCM `.PAK` Sound Banks (`~183.6 MB` Audio in `vehicle.pak`) | `tools/build_vehicle_paks.py`: Synthesize genuine 48kHz 16-bit PCM firing-order waveforms (`exhaust_idle_pcm16`, `exhaust_low_pcm16`, `exhaust_mid_pcm16`, `exhaust_high_pcm16`, `exhaust_redline_pcm16`, `exhaust_overrun_pcm16`, `exhaust_rpm_pcm16`, `gear_shift_pcm16`, `turbo_bov_pcm16`) filling `~5.40 MB` per car (`9,411,776` B per `vehicle.pak` × 34 = `320.0 MB`) | M8 | R2 survey (`ORIGINAL_REQUEST.md:178`) |
| R2-F44 | Rich 3D Track Biome Scenery, Per-Biome 8K/4K Surfaces & Acoustic Zones (`~320 MB` Track Paks) | `tools/build_track_paks.py` & `src/tracks/SplineTrackStreamer.ts`: `83,886,080` B per track `.pak` (`320.0 MiB` total), per-biome procedural asphalt/normal/puddle maps, true banked road normals, 6-strip `80m` sculpted terrain shoulders, multi-branch botanical trees, signature 3D landmarks for all 4 biomes (Golden GP wind turbines/hot-air balloons/VIP bridges, Neo-Tokyo lit skyscrapers/holo-arches/maglev, Canyon redrock arches/mesas, Alpine snow peaks/ice arches/gondolas), 25-luminaire lit tunnels, 3-tier crowd grandstands with floodlights, Sector 0 FIA Pit Building, and `acousticZone`/`reverbMix` metadata | M8 | R2 survey (`ORIGINAL_REQUEST.md:178`) |
| R2-F45 | Multi-Surface Pacejka Grip, Wet Hydroplaning & 4-Corner Tire Thermal Physics | `src/physics/RapierVehicleWorld.ts`: 240Hz per-wheel surface classification (`ASPHALT`, `KERB`, `SHOULDER`, `PUDDLE`), wet puddle hydroplaning (>140 KPH), and dynamic 4-corner tire temperature simulation (`35°C..120°C`, optimal `85°C–105°C` slick grip window) | M8 | R2 survey (`ORIGINAL_REQUEST.md:178`) |
| R2-F46 | 3D FIA Sawtooth Kerb Rumble Physics, Slipstream Wake, Venturi Aero & Gear Shift-Kick | `src/physics/RapierVehicleWorld.ts` & `src/vehicles/CockpitInteriorBuilder.ts`: Physical `0.80m` FIA sawtooth kerb vertical profile exciting 240Hz suspension & steering wheel rumble, live slipstream wake drag reduction (`-28%`), ground-effect Venturi ride-height sensitivity, multi-gear transmission shift-kick & downshift rev-match blip, and live Mod Studio tuning physics coupling | M8 | R2 survey (`ORIGINAL_REQUEST.md:178`) |
| R2-F47 | Live G-Force / Tire Thermal Telemetry HUD & Interactive Audio Controls | `src/ui/RaceHUD.ts`, `src/ui/PaddockShowroomUI.ts`, `src/vehicles/CockpitInteriorBuilder.ts`, `src/main.ts`: Live G-Force & Tire Temp / Surface Status telemetry pill, `[M] AUDIO: ON/MUTE` control, `pointerdown` Web Audio unlock, Showroom engine preview blip, and live V12 dyno boot sweep | M8 | R2 survey (`ORIGINAL_REQUEST.md:178`) |
| R2-F48 | Cross-Platform Windows `.PAK` Builder & `origin/main` Synchronization | `tools/ensure_paks.mjs`, `tools/build_track_paks.py`, `package.json`: Windows symlink fallback (`shutil.copy2`) and cross-platform Python (`python3`/`python`/`py -3`) pre-dev/build runner so `git pull` + `npm run dev` works seamlessly on Windows | M8 | R2 survey (`ORIGINAL_REQUEST.md:182`) |
| R2-F49 | Bespoke 34-Vehicle Roster Visuals & Signatures | `src/vehicles/HighPolyVehicleBuilder.ts`, `src/vehicles/CockpitInteriorBuilder.ts`: Bespoke 3D geometry for all 34 vehicles: Scooter (#1) 2-wheel inline frame, handlebars, rider silhouette; Bugatti (#27) horseshoe grille, C-line contour scoop, center spine; Formula 1 (#32) open-wheel, wishbones, HALO; Heavy Commercial (#14 semi, #15 bus, #13 swat) high cabs, dually rear wheels, vertical stacks, faceted armor | M8 | R2 survey (`ORIGINAL_REQUEST.md:192`) |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | `M1_Core_Engine_Physics_Shaders` | Create root `PROJECT.md`, `task.md`, `implementation_plan.md`; scaffold Vite + TypeScript + Three.js + `@dimforge/rapier3d-compat` + Vitest + Playwright; implement **Part 1**: `src/core/UncappedRenderer.ts`, `src/shaders/AutomotivePaint.glsl`, `src/shaders/RefractiveGlass.glsl`, `src/streaming/PakStreamer.ts`, `src/physics/RapierVehicleWorld.ts` + Part 1 unit tests. | none | DONE |
| 2 | `M2_Sky_Volumetric_Paks` | Implement **Part 2**: `tools/build_sky_paks.py` generating `assets/paks/sky/sky_*.pak` + `sky_01..04` aliases; `src/environment/SkyAtmosphereSystem.ts` + Part 2 tests. | M1 | DONE |
| 3 | `M3_Track_Biome_Paks_Ramps` | Implement **Part 3**: `tools/build_track_paks.py` generating `assets/paks/tracks/track_*.pak` + `track_01..04` aliases; `src/tracks/SplineTrackStreamer.ts` and `src/tracks/TacticalRamps.ts` + Part 3 tests. | M1 | DONE |
| 4 | `M4_Vehicles_34_Paks_Cockpits` | Implement **Part 4**: `tools/build_vehicle_paks.py` generating `assets/paks/vehicles/car_01..34/`; `src/vehicles/VehicleRoster.ts`, `src/vehicles/HighPolyVehicleBuilder.ts`, `src/vehicles/CockpitInteriorBuilder.ts` + Part 4 tests. | M1 | DONE |
| 5 | `M5_Career_Boot_Paddock_UI` | Implement **Part 5**: `src/career/ProgressionManager.ts`, `src/ui/BootLoadingScreen.ts`, `src/ui/PaddockShowroomUI.ts`, `src/ui/PostRaceRewardCeremony.ts`, `src/ui/RaceHUD.ts` + Part 5 tests. | M1, M4 | DONE |
| 6 | `M6_AI_Modes_Audio_Integration` | Implement **Part 6**: `src/ai/RacingAIDirector.ts`, `src/audio/GranularSynthEngine.ts`, and `src/main.ts` + `index.html` full integration exposing `window.__APEX_GAME__` + Part 6 tests. | M1, M2, M3, M4, M5 | DONE |
| 7 | `M7_Final_E2E_And_Tier5_Hardening` | **Final Milestone (Round 1)**: Pass 100% of E2E tests (Tiers 1–4) + Tier 5 adversarial hardening (`tests/tier5_adversarial.spec.ts`). | M6, E2E_Track | DONE |
| E2E | `E2E_Testing_Track` | Requirement-driven opaque-box E2E test suite (`TEST_INFRA.md`, `TEST_READY.md`, `tests/e2e/**`). | M1 | DONE |
| 8 | `M8_R2_800MB_Audio_Biome_Physics_Overhaul` | **Round 2 Upgrade (`~800 MB` Footprint + Next-Gen Audio, Biomes & Physics)**: Expand total footprint to `~800 MB` (`320 MB` Tracks & Biomes + `320 MB` Vehicles & 48kHz Multi-RPM Sound Banks + `100 MB` Sky & Weather + `60 MB` Core Physics/Code); overhaul `GranularSynthEngine.ts` with 12 custom 32-harmonic `PeriodicWave` powertrain families, hybrid `.pak` PCM loops, gearshift transients, overrun crackles, turbo flutter, non-spamming tire screech, kerb rumble, barrier scrape, AI Doppler, and 4 biome ambiences; upgrade `SplineTrackStreamer.ts` with per-biome textures, sculpted shoulders, signature landmarks for all 4 biomes, lit tunnels, stepped grandstands, and acoustic zones; upgrade `RapierVehicleWorld.ts`, `CockpitInteriorBuilder.ts`, `RaceHUD.ts`, and `main.ts` with multi-surface grip, 4-corner tire thermals, 3D kerb rumble physics, slipstream wake, gear shift-kick, Mod Studio physics wiring, and HUD telemetry/audio controls; update all unit & E2E tests for `~800 MB`, pass 100% tests & build, and push to `origin/main`. | M1–M7 | IN_PROGRESS |

---

## Interface Contracts

### 1. Binary `.PAK` Container Contract (`APEXPAK1`) — `tools/*.py` ↔ `src/streaming/PakStreamer.ts`
All `.pak` bundles (`assets/paks/sky/*.pak`, `assets/paks/tracks/*.pak`, `assets/paks/vehicles/car_01..34/vehicle.pak`) use a 64-byte little-endian header followed by `entryCount` 64-byte TOC entries:
- `magic[8]`: ASCII `"APEXPAK1"`
- `version`: `uint32 = 1`
- `pakType`: `uint32` (`1 = SKY`, `2 = TRACK`, `3 = VEHICLE`)
- `totalByteLength`: `uint64`
  - Sky `.pak`: `26,214,400` bytes (`25.00 MiB` × 4 = `100.00 MiB` / `104.86 MB`)
  - Track `.pak`: `83,886,080` bytes (`80.00 MiB` × 4 = `320.00 MiB` / `335.54 MB`)
  - Vehicle `.pak`: `9,411,776` bytes (`~9.412 MB` × 34 = `320.00 MB`, including `~5.40 MB/car` of 48kHz PCM16 multi-RPM audio banks)
- `entryCount`: `uint32`
- `sectorCount`: `uint32` (`100` for Track `.pak` representing `100 × 500m = 50.0 KM`, `0` otherwise)
- `assetId[32]`: UTF-8 null-padded identifier (`"sky_golden_hour"`, `"track_golden_gp"`, `"car_01"`, etc.)

### 2. Core Shared Types (`src/core/types.ts`)
Established in `M1` and imported across `M1`–`M6`:
- `MotorsportTier`: `0 | 1 | 2 | 3 | 4 | 5`
- `CircuitLengthKm`: `2.0 | 5.0 | 8.0 | 12.0 | 24.0 | 50.0`
- `TrackBiomeId`: `'track_golden_gp' | 'track_neotokyo' | 'track_canyon' | 'track_alpine'` (plus aliases `'track_01' | 'track_02' | 'track_03' | 'track_04'`)
- `SkyBiomeId`: `'sky_golden_hour' | 'sky_neotokyo_cyber' | 'sky_redrock_canyon' | 'sky_alpine_glacier'` (plus aliases `'sky_01' | 'sky_02' | 'sky_03' | 'sky_04'`)
- `AIDifficultyTier`: `'EASY' | 'MEDIUM' | 'HARD' | 'VERY_HARD' | 'SUPER_HARD'`
- `RaceFormatId`: `'SPRINT_1_LAP' | 'QUALIFIER_2_LAPS' | 'GRAND_PRIX_3_LAPS' | 'FEATURE_5_LAPS' | 'ENDURANCE_10_LAPS' | 'KNOCKOUT_ELIMINATION' | 'SOLO_TIME_ATTACK'`
- `CameraMode`: `'CHASE' | 'COCKPIT' | 'HOOD' | 'ORBIT' | 'SHOWROOM'`
- `TacticalRampType`: `'SKYBRIDGE_OVERPASS' | 'PLASMA_BOOST_RING' | 'KINETIC_SHOCKWAVE'`
- `SplineFrame`: `{ s: number; position: [number, number, number]; tangent: [number, number, number]; normal: [number, number, number]; binormal: [number, number, number]; bankAngleRad: number; roadWidth: number; isTunnel: boolean }`
- `ISplineProvider`: `{ getTotalLength(): number; getFrameAtArcLength(s: number): SplineFrame; getClosestSplinePoint(worldPos: [number, number, number], hintS?: number): { alongOffset: number; lateralOffset: number; verticalOffset: number; frame: SplineFrame } }`
- `VehicleSpec`: `{ index: number; pakDir: string; id: string; name: string; tier: MotorsportTier; tierName: string; winsRequired: number; creditCost: number; zeroToHundredSec: number; topSpeedKph: number; massKg: number; archetype: string; drivetrain: 'RWD' | 'FWD' | 'AWD' | 'JET'; redlineRpm: number; gears: number; hasTransparentEngineBay: boolean; defaultPrimaryColor: number; defaultAccentColor: number }`
- `LiveCockpitTelemetry`: `{ speedKph: number; rpm: number; maxRpm: number; gear: number | 'N' | 'R'; lapDeltaSec: number; currentLap: number; totalLaps: number; position: number; totalRacers: number; nitroPercent: number; drsActive: boolean; brakeTempCelsius: number; sectorSplits: [number | null, number | null, number | null] }`

### 3. Global E2E & Runtime Inspection Contract (`window.__APEX_GAME__`)
`src/main.ts` exposes `window.__APEX_GAME__` so both user interaction and opaque-box Playwright E2E tests can inspect and drive the application deterministically:
- `getState()`: returns `{ phase: 'BOOT' | 'PADDOCK' | 'RACING' | 'POST_RACE', activeTab: 1 | 2 | 3 | 4, selectedVehicleId: string, selectedLiveryIndex: number, selectedTrackId: string, selectedSkyId: string, selectedDistanceKm: number, selectedFormat: string, selectedAiDifficulty: string, cameraMode: CameraMode, totalWins: number, credits: number, driverXp: number, sandboxUnlockedAll: boolean, unlockedVehicleIds: string[], telemetry: LiveCockpitTelemetry, fps: number, vsyncHz: number, ssaaScale: number }`
- Actions: `completeBoot()`, `selectTab(1|2|3|4)`, `selectVehicle(id)`, `selectLivery(index)`, `setCircuitConfig({ trackId, skyId, distanceKm, format, aiDifficulty })`, `toggleSandboxUnlockAll()`, `launchRace()`, `setCameraMode(mode)`, `simulateWinRace()`, `exportCurrentVehicleGlb()`.

---

## Code Layout

Strict file write ownership per milestone prevents concurrent worker conflicts:

| Milestone | Owned Directories & Files |
|-----------|---------------------------|
| `M1_Core_Engine_Physics_Shaders` | `PROJECT.md`, `task.md`, `implementation_plan.md`, `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `src/core/types.ts`, `src/core/UncappedRenderer.ts`, `src/shaders/AutomotivePaint.glsl`, `src/shaders/RefractiveGlass.glsl`, `src/streaming/PakStreamer.ts`, `src/physics/RapierVehicleWorld.ts`, `tests/part1_core.spec.ts` |
| `M2_Sky_Volumetric_Paks` | `tools/build_sky_paks.py`, `assets/paks/sky/**`, `src/environment/SkyAtmosphereSystem.ts`, `tests/part2_sky.spec.ts` |
| `M3_Track_Biome_Paks_Ramps` | `tools/build_track_paks.py`, `assets/paks/tracks/**`, `src/tracks/SplineTrackStreamer.ts`, `src/tracks/TacticalRamps.ts`, `tests/part3_tracks.spec.ts` |
| `M4_Vehicles_34_Paks_Cockpits` | `tools/build_vehicle_paks.py`, `assets/paks/vehicles/**`, `src/vehicles/VehicleRoster.ts`, `src/vehicles/HighPolyVehicleBuilder.ts`, `src/vehicles/CockpitInteriorBuilder.ts`, `tests/part4_vehicles.spec.ts` |
| `M5_Career_Boot_Paddock_UI` | `src/career/ProgressionManager.ts`, `src/ui/BootLoadingScreen.ts`, `src/ui/PaddockShowroomUI.ts`, `src/ui/PostRaceRewardCeremony.ts`, `src/ui/RaceHUD.ts`, `tests/part5_career_ui.spec.ts` |
| `M6_AI_Modes_Audio_Integration` | `src/ai/RacingAIDirector.ts`, `src/audio/GranularSynthEngine.ts`, `src/main.ts`, `index.html`, `tests/part6_ai_audio_integration.spec.ts` |
| `E2E_Testing_Track` | `TEST_INFRA.md`, `TEST_READY.md`, `playwright.config.ts`, `tests/e2e/**` |
| `M7_Final_E2E_And_Tier5_Hardening` | Full repository read/write for final E2E bugfixes & Tier 5 adversarial test additions (`tests/tier5_adversarial.spec.ts`) |
