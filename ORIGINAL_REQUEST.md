# Original User Request

## Initial Request — 2026-11-06T14:03:54Z

## 2026-11-06T14:03:54Z

# ROLE & AUTONOMOUS EXECUTION DIRECTIVE (ANTIGRAVITY AGENT MODE)

You are operating in **Antigravity Autonomous Principal Game Engine Architect, Technical Artist & Motorsport Physics Director Mode**.

Your mission is to architect and build **"Apex Grand Prix: Uncapped Next-Gen Edition"** as a **multi-part, AAA-grade standalone 3D Racing Game** with **uncapped visual fidelity** and a well-engineered **~400 MB Total Modular Asset Footprint**:
- **Total Game Footprint Target**: **`~400 MB`** across modular `.pak` / `.glb` / PBR asset bundles on disk:
  1. **Vehicles (`~160 MB` total • `~4.7 MB` per car × 34 cars)**: `assets/paks/vehicles/car_01..34/` (High-poly LOD0–LOD2 meshes, 4K PBR texture sets, framed glass windows, 3D cockpit interiors, and multi-RPM exhaust audio).
  2. **Tracks & Biomes (`~160 MB` total • `~40 MB` per circuit × 4 circuits)**: `assets/paks/tracks/track_01..04/` (Streamed in `500m` spatial sectors across `2.0 KM` to `50.0 KM` true 1:1 physical lap lengths with 4K/8K surface normal/roughness maps, 16-bit elevation heightfields, botanical forests, grandstands, and Skybridge overpasses).
  3. **Sky & Volumetric Atmosphere (`~50 MB` total • `~12.5 MB` per sky × 4 skies)**: `assets/paks/sky/sky_01..04/` (High-dynamic-range `.hdr` equirectangular sky domes, 3D volumetric cloud noise grids, and PMREM specular cubemap mip chains).
  4. **Core Engine, Physics, Shaders & Audio Synth (`~30 MB`)**: `src/` + compiled runtime (`Rapier3D` WASM physics, custom GLSL/WGSL clearcoat & refractive glass shaders, and UI assets).

Do NOT build a cramped single-file webpage. You have full access to terminal commands (`bash`), package managers (`npm`, `pip`, `cargo`), Python asset-generation scripts (`numpy`, `Pillow`, `scipy`), and multi-file project scaffolding.

---

## MANDATORY ANTIGRAVITY PART-BY-PART EXECUTION WORKFLOW

Build the game **incrementally in 6 distinct, verifiable Parts (Phases)**.
First create `task.md` and `implementation_plan.md`, then execute **Part 1 through Part 6** sequentially—writing generator/compiler scripts in `tools/` to build the modular `~400 MB` asset tree cleanly.

---

### PART 1: Uncapped Rendering Engine, `.PAK` Streamer & Rapier3D Physics Core (`~30 MB`)
**Target Directories**: `src/core/`, `src/streaming/`, `src/physics/`, `src/shaders/`

1. **Uncapped WebGPU / WebGL2 Deferred & Forward+ PBR Renderer (`src/core/UncappedRenderer.ts`)**:
   - Unlocked framerate (`120Hz/144Hz/240Hz` VSync toggle) and native `devicePixelRatio` supersampling (`1.0x` to `2.5x` SSAA).
   - **Full Post-Processing & Screen-Space Pipeline**:
     - Screen-Space Global Illumination (SSGI) & Screen-Space Reflections (SSR) for wet asphalt and puddles.
     - 4-Cascade `4096×4096` Cascaded Shadow Maps (CSM) + Contact-Hardening PCSS soft shadows.
     - Dual-layer physically based **Automotive Clearcoat + Sub-Millimeter Metallic Flake & Anisotropic Brushed Metal GLSL/WGSL Shaders** (`src/shaders/AutomotivePaint.glsl`).
     - Physically based **Refractive Laminated Glass Shader** (`ior: 1.52`, chromatic dispersion, and wiper-sweep mask).
     - ACES Filmic HDR Tone Mapping, Volumetric God-Rays, Per-Wheel Motion Blur, Speed-Driven FOV Warp, and Bokeh Depth-of-Field in Showroom/Photo Mode.
2. **Asynchronous WebWorker `.PAK` & Octree Sector Streamer (`src/streaming/PakStreamer.ts`)**:
   - Build a multi-threaded **WebWorker Asset Streamer** that streams the modular vehicle (`~4.7 MB` each), sky (`~12.5 MB` each), and track sector (`~40 MB` per circuit) bundles into GPU VRAM on demand with LRU cache eviction so VRAM stays lean and frame pacing stays locked.
3. **Glitch-Free 3D Raycast Suspension & Spline-Tangent Physics (`src/physics/RapierVehicleWorld.ts`)**:
   - Integrate `@dimforge/rapier3d-compat` (or `240Hz` sub-stepped raycast suspension physics) with 4 independent spring-damper wheel raycasts, anti-roll bars, Pacejka tire-slip curves, weight-transfer pitch/roll, and speed-dependent downforce.
   - **Lateral Tangent Barrier Projection (Zero Teleporting or Sticking)**:
     - Project vehicle coordinates onto the closest continuous 3D spline tangent $\vec{T}$ and binormal $\vec{N}$ (`alongOffset`, `lateralOffset`).
     - Clamp ONLY `lateralOffset` at the guardrail and project velocity parallel to $\vec{T}$ so scraping a barrier at `400+ KPH` produces sparks and smooth parallel wall-gliding—never yanking the car backward/forward or getting stuck on a vertex.

---

### PART 2: Sky, Volumetric Cloud & HDRI Atmosphere Paks (`~50 MB Total` • `~12.5 MB` per Sky)
**Target Directories**: `tools/build_sky_paks.py`, `assets/paks/sky/`, `src/environment/SkyAtmosphereSystem.ts`

Write and execute a Python asset-builder script (`tools/build_sky_paks.py`) using `numpy` and `Pillow` to generate 4 high-dynamic-range sky & atmosphere packages (`~12.5 MB` each, `~50 MB` total):
1. **`sky_golden_hour.pak` (`~12.5 MB`)**: 7 PM low-sun golden horizon HDRI, Rayleigh/Mie atmospheric scattering LUT, 3D cumulus cloud noise volume casting moving ground shadows, and warm `2.4x` directional sun shafts.
2. **`sky_neotokyo_cyber.pak` (`~12.5 MB`)**: Cyberpunk midnight horizon HDRI, distant holographic skyline cubemap, volumetric neon smog layers, and dynamic lightning flashes.
3. **`sky_redrock_canyon.pak` (`~12.5 MB`)**: Crimson-violet desert dusk sky dome, high-altitude cirrus cloud maps, and warm desert dust haze LUT.
4. **`sky_alpine_glacier.pak` (`~12.5 MB`)**: Crisp high-altitude crystalline blue zenith, snow-albedo horizon bounce light, aurora borealis upper-atmosphere shader layer, and blowing snow particle sheets.

---

### PART 3: Modular Track Biome Paks (`~160 MB Total` • `~40 MB` per Circuit) & True 1:1 Scale (2 KM to 50 KM)
**Target Directories**: `tools/build_track_paks.py`, `assets/paks/tracks/`, `src/tracks/SplineTrackStreamer.ts`, `src/tracks/TacticalRamps.ts`

1. **True 1:1 Physical World Calibration (`1 World Unit = 1 Real Meter`)**:
   - Do NOT fake lap distances with a text multiplier. At `360 KPH` (`100 m/s`), the car physically advances `100 meters per second` along the 3D spline.
   - Support **6 True Physical Circuit Lengths** selectable before any race:
     - **2.0 KM Stadium Sprint** (`2,000m` true spline • ~22–26s/lap • 8 Tactical Ramp/Skybridge zones)
     - **5.0 KM FIA Grand Prix** (`5,000m` true spline • ~1 min/lap • 16 Ramp/Skybridge zones)
     - **8.0 KM Pro GT Loop** (`8,000m` true spline • ~1.6 min/lap • 24 Ramp/Skybridge zones)
     - **12.0 KM Spa / Le Mans Endurance** (`12,000m` true spline • ~2.4 min/lap • 36 Ramp/Skybridge zones)
     - **24.0 KM Nordschleife "Green Hell" Tour** (`24,000m` true physical spline • ~4.5 to 5.2 minutes per lap at 300+ KPH • 70+ corners, `+85m` mountain elevation climbs, banked carousel turns, tunnels, 45+ tactical ramps/skybridges, and a `3.2 km` full-throttle `485 KPH` straightaway!)
     - **50.0 KM Coast-to-Coast Mega Highway** (`50,000m` true physical spline • ~9–10 minutes per lap!)
2. **~160 MB Track Pak Architecture (`~40 MB` per Biome, Streamed in `500m` Spatial Sectors)**:
   - Build `tools/build_track_paks.py` + `src/tracks/SplineTrackStreamer.ts` to generate 4 circuit biome paks (`track_golden_gp.pak`, `track_neotokyo.pak`, `track_canyon.pak`, `track_alpine.pak` at `~40 MB` each) streamed in **`500m` Spatial Sectors**:
     - **High-Density Tessellated Road Ribbon**: Sub-meter cross-section vertices with crown camber, banked corners (`up to 18° banking`), 3D extruded FIA sawtooth kerbs, and double-wave corrugated Armco barriers.
     - **4K/8K Surface Texture Sets**: Macro hot-mix asphalt aggregate albedo, 16-bit tangent-space normal maps, rubbered-in racing line roughness maps, and dynamic puddle reflection masks.
     - **Multi-Branch 3D Botanical Forests & Trackside Architecture**: High-poly multi-branch oak, pine, saguaro, and snow-spruce trees (with wind-sway vertex shaders), 3D multi-tier grandstands, pit buildings, cantilever telemetry gantries, and illuminated tunnels.
3. **High-Reward Tactical Ramps, Skybridges & Shockwave Landings (Zero Useless Ramps)**:
   - Place ramps in the outer lanes with **100m Holographic Approach Chevrons** (keeping the central 75% highway clear) and implement **3 High-Reward Tactical Ramp Types**:
     - **🚀 Elevated Skybridge Overpasses**: Launching off a Skybridge Ramp puts the car onto a `250m–400m` **Elevated Upper-Deck Highway** (`12m` above the main road) lined with continuous **`1.35x` Overdrive Boost Strips** that bypass ground AI traffic and shortcut chicanes!
     - **⚡ Mid-Air Plasma Boost Rings**: Flying through the suspended neon ring above the ramp lip grants **`+80%` instant Nitro refill**, a **`1.42x` Hyper-Velocity Surge** for `4.0 seconds` upon landing, and **`+2,500 CR`** stunt bonus.
     - **💥 Kinetic Shockwave Landings**: Touching down at `>180 KPH` triggers ZERO landing slowdown—instead, suspension compression fires a **3D Kinetic Shockwave Ring** that boosts forward speed by `+15%` and blasts any AI rivals within `15m` sideways!

---

### PART 4: 34 Modular Vehicle Paks (`~160 MB Total` • `~4.7 MB` per Vehicle Class) with Framed Windows & 3D Cockpits
**Target Directories**: `tools/build_vehicle_paks.py`, `assets/paks/vehicles/`, `src/vehicles/VehicleRoster.ts`, `src/vehicles/HighPolyVehicleBuilder.ts`, `src/vehicles/CockpitInteriorBuilder.ts`

Architect each of the **34 Vehicle Classes** as its own modular package (`assets/paks/vehicles/car_01/` .. `car_34/`, averaging `~4.7 MB` per vehicle class for a `~160 MB` total vehicle library across LOD0–LOD2 meshes, 4K PBR textures, 12 livery finishes, full 3D cockpit interiors, and multi-RPM exhaust audio):

1. **Ultra-Detailed Exterior & Framed Automotive Glass Windows**:
   - **High-Poly Subdivision Bodywork**: Smooth contoured fenders, front splitters, Venturi underbody diffusers, active DRS/airbrake rear wings that tilt dynamically under braking, and glowing carbon-ceramic brake discs that heat to `1,000°C` bright orange under heavy braking.
   - **Framed Multi-Pane Automotive Glass (`CockpitInteriorBuilder.ts`)**:
     - Sloped laminated front windshield with dual animated wipers, painted A-pillars, and interior rearview mirror.
     - Framed left and right door windows with inward tumblehome curvature, gloss-black B-pillars, C-pillars, chrome/carbon beltline trim, and aerodynamic wing mirrors.
     - Sloped rear backglass (plus transparent mid-engine bay cover on supercars revealing the modeled 3D engine block!).
2. **Playable First-Person 3D Cockpit Interior (`Camera Mode: COCKPIT`)**:
   - Full 3D dashboard with a working **Live Digital Telemetry Screen** (displaying real-time KPH, Gear, RPM bar, and Lap Delta directly on the 3D dash mesh!), rotating steering wheel with shift LEDs, twin bolstered racing seats, roll cage, and driver helmet.
3. **Complete 34-Vehicle Roster Across 6 Motorsport Tiers (Real-World 0–100 km/h & Top Speeds)**:
   - **Tier 0 — Starter Street & Club (`0 Wins`)**:
     1. `scooter` — **Turbo Street Scooter** (`0–100: 7.2s` • `145 KPH` • `135 KG`)
     2. `hot_hatch` — **Type-R Turbo Hot Hatch** (`0–100: 5.4s` • `275 KPH` • `1,430 KG`)
     3. `roadster` — **MX-5 Club Spec Roadster** (`0–100: 5.7s` • `235 KPH` • `1,060 KG`)
   - **Tier 1 — JDM Tuner, Drift & Off-Road (`1–6 Wins`)**:
     4. `jdm_rotary` — **RX-7 Twin-Rotor JDM Legend** (`1 Win` • `0–100: 4.7s` • `265 KPH` • `1,280 KG`)
     5. `car` — **Widebody Drift GT (Silvia / Supra Spec)** (`2 Wins` • `0–100: 3.8s` • `275 KPH` • `1,480 KG`)
     6. `skyline_gtr` — **GT-R R34 Nismo AWD** (`3 Wins` • `0–100: 3.6s` • `300 KPH` • `1,560 KG`)
     7. `rally` — **WRC Turbo Rally AWD** (`4 Wins` • `0–100: 3.7s` • `260 KPH` • `1,260 KG`)
     8. `dune_buggy` — **Twin-Turbo Sand Rail Buggy** (`5 Wins` • `0–100: 4.1s` • `225 KPH` • `890 KG`)
     9. `truck` — **Trophy Baja Desert Truck** (`6 Wins` • `0–100: 5.2s` • `215 KPH` • `2,650 KG`)
   - **Tier 2 — Heavy Iron, Pursuit & Muscle (`7–12 Wins`)**:
     10. `classic_muscle` — **1969 Charger 426 Hemi** (`7 Wins` • `0–100: 4.8s` • `255 KPH` • `1,720 KG`)
     11. `muscle` — **Supercharged V8 Hellcat / GT500** (`8 Wins` • `0–100: 3.5s` • `318 KPH` • `1,760 KG`)
     12. `police` — **Twin-Turbo Police Interceptor** (`9 Wins` • `0–100: 3.3s` • `305 KPH` • `1,820 KG`)
     13. `swat_armored` — **Tactical Armored Enforcer SUV** (`10 Wins` • `0–100: 5.8s` • `205 KPH` • `3,850 KG`)
     14. `semi_rig` — **Twin-Stack Racing Semi Cab** (`11 Wins` • `0–100: 6.8s` • `195 KPH` • `5,400 KG`)
     15. `bus` — **Express Aero Coach Bus** (`12 Wins` • `0–100: 11.5s` • `136 KPH` • `8,400 KG`)
   - **Tier 3 — Track Toys, Superbikes & GT3 (`13–18 Wins`)**:
     16. `kart_shifter` — **250cc 6-Speed Shifter Kart** (`13 Wins` • `0–100: 2.9s` • `210 KPH` • `175 KG`)
     17. `ariel_exo` — **Exoskeleton Track Roadster (Atom V8)** (`14 Wins` • `0–100: 2.6s` • `275 KPH` • `612 KG`)
     18. `porsche_gt3` — **Flat-6 GT3 RS Track Weapon** (`15 Wins` • `0–100: 3.1s` • `312 KPH` • `1,450 KG`)
     19. `corvette_gt` — **Mid-Engine Z06 GT3.R** (`16 Wins` • `0–100: 2.7s` • `318 KPH` • `1,560 KG`)
     20. `bike` — **GP Factory Superbike (1000cc)** (`17 Wins` • `0–100: 2.7s` • `315 KPH` • `192 KG`)
     21. `cyber_bike` — **Neon Hubless Orbital Laser-Bike** (`18 Wins` • `0–100: 2.3s` • `340 KPH` • `240 KG`)
   - **Tier 4 — Exotic Supercars & Hypercars (`19–25 Wins`)**:
     22. `ferrari_v8` — **Maranello Twin-Turbo Berlinetta** (`19 Wins` • `0–100: 2.85s` • `340 KPH` • `1,475 KG`)
     23. `lambo` — **V12 Italian Supercar (Revuelto / Aventador)** (`20 Wins` • `0–100: 2.8s` • `345 KPH` • `1,525 KG`)
     24. `mclaren_lt` — **Carbon Monocell Senna GTR** (`21 Wins` • `0–100: 2.75s` • `340 KPH` • `1,188 KG`)
     25. `pagani_v12` — **Huayra / Zonda R AMG V12** (`22 Wins` • `0–100: 2.7s` • `360 KPH` • `1,280 KG`)
     26. `koenigsegg` — **Jesko Absolut Low-Drag Hypercar** (`23 Wins` • `0–100: 2.5s` • `445 KPH` • `1,390 KG`)
     27. `hyper` — **Bugatti W16 Quad-Turbo Chiron** (`24 Wins` • `0–100: 2.4s` • `420 KPH` • `1,995 KG`)
     28. `ev_proto` — **Rimac Nevera Quad-Motor EV** (`25 Wins` • `0–100: 1.85s` • `412 KPH` • `2,150 KG`)
   - **Tier 5 — Prototypes, Open-Wheel & Mythic Concepts (`26–31 Wins`)**:
     29. `stock_nascar` — **Next-Gen V8 Stock Car Oval King** (`26 Wins` • `0–100: 3.2s` • `335 KPH` • `1,540 KG`)
     30. `indy_open` — **Aero-Screen Speedway Open-Wheeler** (`27 Wins` • `0–100: 2.55s` • `380 KPH` • `740 KG`)
     31. `lmp1` — **Le Mans Daytona Hyper-Prototype** (`28 Wins` • `0–100: 2.5s` • `345 KPH` • `930 KG`)
     32. `f1` — **Formula 1 Ground-Effect Apex** (`29 Wins` • `0–100: 2.6s` • `355 KPH` • `798 KG`)
     33. `fan_car` — **Ground-Effect Suction Fan Hypercar** (`30 Wins` • `0–100: 2.1s` • `370 KPH` • `980 KG`)
     34. `jet_thrust` — **Supersonic Afterburner Land-Speed Concept** (`31 Wins` • `0–100: 1.65s` • `485 KPH` • `2,400 KG`)

---

### PART 5: Win-by-Win Career Unlock System, Dyno Boot Screen & Native Console Paddock UI
**Target Directories**: `src/career/ProgressionManager.ts`, `src/ui/BootLoadingScreen.ts`, `src/ui/PaddockShowroomUI.ts`, `src/ui/PostRaceRewardCeremony.ts`

1. **Win-by-Win Vehicle Unlock Ladder (`1 Win = +1 New Car Unlocked`)**:
   - Start with Tier 0 unlocked (`3 cars`). Each 1st-place win increments `totalWins` and triggers a **Cinematic 3D Podium & Turntable Spotlight Reveal** unlocking the next vehicle (`1 Win` = Car #4 ... `31 Wins` = Car #34).
   - Award **Apex Credits (`CR`)** and **Driver XP** for podium finishes, clean overtakes, slipstream drafting, drift combos, skybridge air stunts, and takedowns—allowing players to either unlock cars via Race Wins OR buy them early with `CR`, plus a **`[🔓 SANDBOX: UNLOCK ALL 34 CARS]`** toggle in the top header.
2. **12,000 RPM Dyno Telemetry Boot Screen & Tabbed Console Paddock**:
   - Fullscreen animated **12,000 RPM Tachometer Boot Screen** streaming the `.pak` bundles (`~400 MB` total asset pool) with live subsystem progress bars and a V12 startup roar on ignition.
   - **4-Tab Ribbon Paddock UI** (`[Q / E]` or click): `1. GARAGE (34 Cars by Tier)`, `2. LIVERY & 12 PBR PAINTS`, `3. CIRCUIT, DISTANCE (2–50 KM), FORMAT & AI DIFFICULTY`, `4. MOD STUDIO & GLB EXPORT`, with a permanently docked bottom **`🏁 LAUNCH RACE`** bar.

---

### PART 6: AI Director (Easy to Super Hard), 7 Race Modes, Slipstream & Automated Verification
**Target Directories**: `src/ai/RacingAIDirector.ts`, `src/audio/GranularSynthEngine.ts`, `tests/`

1. **5 AI Difficulty Tiers**: `Easy (Rookie)`, `Medium (Club)`, `Hard (Pro GP)`, `Very Hard (Master)`, and `Super Hard (Apex Legend — actively slipstreams, takes Skybridge overpass shortcuts, and fires Nitro on straights)`.
2. **7 Race Formats**: `1 Lap Sprint`, `2 Laps Qualifier`, `3 Laps Grand Prix`, `5 Laps Feature`, `10 Laps Endurance`, `Knockout Elimination` (last-place racer is eliminated in an explosion at the end of every lap), and `Solo Time Attack` (with Ghost Car replay and Sector 1/2/3 split deltas).
3. **Build & Runtime Verification**: Run the asset-pak generator scripts, verify the total compiled asset footprint is right around `~400 MB`, compile the TypeScript/Vite/Tauri bundle, and verify zero build or runtime console errors.   ts is tha bare minimum improve the things as u seem necessary pls make it the best /grill-me


## Follow-up — 2026-11-07T05:02:20Z

make it the best not good enough yet the sound is kinda ehhhh and now the limit for the app size is 800 mb most of which should go to assets like sounds and biomes rest to physics and code

---
Earlier conversation context (quoted):
> **Repository & Workspace**: `/home/antigravity/kskasana4946-cyber/hello` (GitHub remote: `https://github.com/kskasana4946-cyber/hello.git`, branch `main`). The user runs the game locally on their Windows PC via `git pull` and `npm run dev` (`http://localhost:5173`), so completed changes should also be pushed to `origin/main`.
> **Current State**: "Apex Grand Prix: Uncapped Next-Gen Edition" is a standalone 3D WebGL2/Three.js racing game currently at a ~400 MB `.pak` footprint (`assets/paks/sky/`, `assets/paks/tracks/`, `assets/paks/vehicles/car_01..34/`) with 34 vehicles (`src/vehicles/VehicleRoster.ts`, `src/vehicles/HighPolyVehicleBuilder.ts`), 4 track biomes across 2–50 KM circuit lengths (`src/tracks/SplineTrackStreamer.ts`, `src/tracks/TacticalRamps.ts`), 4 HDR skies (`src/environment/SkyAtmosphereSystem.ts`), custom GLSL automotive paint & refractive glass shaders (`src/shaders/AutomotivePaint.glsl`, `src/shaders/RefractiveGlass.glsl`), 240Hz sub-stepped vehicle physics (`src/physics/RapierVehicleWorld.ts`), career progression (`src/career/ProgressionManager.ts`), 4-tab Paddock Showroom UI & Broadcast Race HUD (`src/ui/PaddockShowroomUI.ts`, `src/ui/RaceHUD.ts`), AI Director (`src/ai/RacingAIDirector.ts`), and Granular Audio Synth Engine (`src/audio/GranularSynthEngine.ts`).
> **Earlier User Design Preferences (from `/grill-me`)**:
> 1. **Vehicles & Showroom**: Full 3D closed-hull sculpted car bodies with distinct silhouettes per class (Supercar/Hypercar, F1/Open-Wheel, GT3, Muscle, Truck/Commercial, Bike/Scooter) + luxury 3D Showroom Studio with reflective floor, illuminated turntable, overhead softboxes, and mouse-drag orbit camera.
> 2. **Circuits, Biomes & AI Grid**: Full 3D spline-hugging circuits with textured asphalt, continuous red/white FIA sawtooth kerbs, continuous Armco guardrails, rich 3D biome scenery, overpass bridges, and visible 3D AI rival cars.
> 3. **VFX & Driving Feel**: Authentic Motorsport Sim-Cade (Forza Motorsport / Gran Turismo aesthetic)—realistic tire smoke, brake disc thermal glow, barrier sparks, weight transfer pitch/roll, and clean Gran Turismo / F1 Broadcast HUD without overlapping screens.


## Follow-up — 2026-11-07T05:50:52Z

the task with argon was cutoff mid work due to daily limit reached continue the work pl read the prmpts the work it did and everything  and there is another problem each car should lool like itself like scooter looks like a car it shouldent be like if the car is buggati it should look like buggati if it is scooter it should look like scooter so start

---
Earlier context quoted from project:
Original prompt:
"make it the best not good enough yet the sound is kinda ehhhh and now the limit for the app size is 800 mb most of which should go to assets like sounds and biomes rest to physics and code"

Current codebase context:
- Working directory: /home/antigravity/kskasana4946-cyber/hello on git branch main.
- Uncommitted work in progress includes M8_R2_800MB_Audio_Biome_Physics_Overhaul (see PROJECT.md, ORIGINAL_REQUEST.md, src/core/types.ts, src/streaming/PakStreamer.ts, tools/build_*_paks.py).
- New requirement: Each of the 34 roster vehicles must visually resemble its real-world counterpart / archetype (e.g., scooter must look like a 2-wheel scooter with handlebars and rider, Bugatti must have horseshoe grille and side C-line contour, F1/Indy must be open-wheel single seaters, trucks/buses/rigs must have distinct commercial bodies, etc.).
- Audio overhaul for 48kHz engine audio banks, physics multi-surface grip and tire thermals, 800 MB footprint across track/vehicle/sky paks. All unit tests (tests/*.spec.ts) and E2E tests (tests/e2e/run_e2e_suite.mjs) must pass, and the project must build cleanly and be pushed to origin main.
