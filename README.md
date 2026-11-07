# 🏎️ Apex Grand Prix: Uncapped Next-Gen Edition

> **Standalone 3D AAA-Grade Motorsport Racing Game with Uncapped Visual Fidelity, 30 Sculpted Vehicles, 4 Biomes (2.0 KM to 50.0 KM True 1:1 Physical Splines), Real Rapier3D Physics, and Full PWA Mobile & PC Offline Play.**

---

## 🚀 1-Click Play & Direct Download Matrix (No Terminal Required!)

| Platform | ⚡ Quick Play in Browser | 📦 1-Click Direct Download / Offline Install |
| :--- | :--- | :--- |
| **📱 Mobile Phone (Android)** | **[▶ Play in Mobile Browser](https://kskasana4946-cyber.github.io/hello/)** | **Install PWA App** (Open link in Chrome → Tap `⋮` → **Install App** / **Add to Home screen**) |
| **🍏 Mobile Phone (iPhone / iPad)** | **[▶ Play in Safari](https://kskasana4946-cyber.github.io/hello/)** | **Install PWA App** (Open link in Safari → Tap Share `⎙` → **Add to Home Screen**) |
| **💻 Windows PC** | **[▶ Play in Browser](https://kskasana4946-cyber.github.io/hello/)** | **[⬇ Download Windows Offline Bundle (.zip)](https://github.com/kskasana4946-cyber/hello/releases/latest/download/apex-grand-prix-offline.zip)** (Extract & double-click `play-windows.bat`) |
| **🍎 Mac (macOS)** | **[▶ Play in Browser](https://kskasana4946-cyber.github.io/hello/)** | **[⬇ Download Mac Offline Bundle (.zip)](https://github.com/kskasana4946-cyber/hello/releases/latest/download/apex-grand-prix-offline.zip)** (Extract & double-click `play-mac.command`) |
| **🐧 Linux** | **[▶ Play in Browser](https://kskasana4946-cyber.github.io/hello/)** | **[⬇ Download Linux Offline Bundle (.zip)](https://github.com/kskasana4946-cyber/hello/releases/latest/download/apex-grand-prix-offline.zip)** (Extract & double-click `./play-linux.sh`) |

---

## 📱 Mobile Phone & Tablet Quick Start (1-Tap Install)

Play directly on your phone with dedicated on-screen steering and gas/brake/nitro touch pedals:

1. **Open the Game**: Navigate to **`https://kskasana4946-cyber.github.io/hello/`** on your smartphone.
2. **Install Offline (PWA)**:
   - **Android (Chrome / Edge)**: Tap the prompt banner **"Add Apex GP to Home screen"** or tap `⋮` → **"Install App"**.
   - **iOS / iPhone / iPad (Safari)**: Tap the **Share** button (`⎙`), scroll down, and tap **"Add to Home Screen"** (`+`).
3. **Launch & Race**:
   - Tap the **Apex GP** icon on your home screen.
   - The game launches in fullscreen landscape without address bars.
   - Hold your phone horizontally: use your **left thumb to steer** (`◀` `▶` buttons or analog thumbstick) and your **right thumb for pedals** (`▲ GAS`, `▼ BRAKE`, `⚡ NITRO`, `🛞 DRIFT`).

---

## 💻 PC & Mac Offline Direct Play (Zero Installation)

1. Download **`apex-grand-prix-offline.zip`** from the release matrix above or GitHub Releases.
2. Unzip / Extract the downloaded folder on your computer.
3. Launch with **1 double-click**:
   - **Windows**: Double-click **`play-windows.bat`**. (Uses Windows built-in PowerShell micro-server; no Node.js or Python required!)
   - **macOS**: Double-click **`play-mac.command`**. (Opens Safari/Chrome instantly).
   - **Linux**: Double-click or run **`./play-linux.sh`**.
4. Your default browser opens automatically to **`http://localhost:8080`** and the race begins!

---

## 🎮 Driving & Menu Controls

### On Mobile Phones & Tablets
- **Steer Left / Right**: `◀` `▶` on-screen buttons or virtual 360° analog joystick (tap `🕹️ STICK / ◀▶ KEYS` to switch modes).
- **Throttle (Gas)**: `▲ GAS` green pedal.
- **Brake / Reverse**: `▼ BRAKE` red pedal.
- **Nitro Boost**: `⚡ NITRO` cyan button.
- **Drift / Handbrake**: `🛞 DRIFT` amber button.
- **Camera Views**: `🎥 CAM` button (cycles Chase, 3D Cockpit with Live Digital Telemetry Dash, and Bumper cams).
- **Race Start**: `🏁 RACE` button in top bar or `[Spacebar]`.

### On PC & Mac (Keyboard & Gamepad)
- **Steer**: `[A]` / `[D]` or `[Left]` / `[Right]` Arrow keys
- **Throttle / Gas**: `[W]` or `[Up]` Arrow key
- **Brake / Reverse**: `[S]` or `[Down]` Arrow key
- **Handbrake / Drift**: `[Spacebar]`
- **Nitro Boost**: `[Shift]`
- **Camera Views**: `[C]` (Chase, 3D Cockpit, Bumper)
- **Paddock Ribbon Navigation**: `[Q]` / `[E]` or mouse click
- **Start Race**: Press `[Spacebar]`, `[Enter]`, or click **`🏁 LAUNCH RACE`**

---

## 🏎️ Vehicle Roster & Motorsport Tiers

Featuring **exactly 30 sculpted 3D vehicle models** across 7 motorsport categories:
- **Hatchbacks**: Mini Cooper JCW, Type-R Turbo Hot Hatch, Club Spec Hatch, RS Cup Hot Hatch *(2 FREE at start!)*
- **Sedans**: Bentley Flying Spur Luxury Sedan, M3 Twin-Turbo Sedan, AMG V8 Performance Sedan, RS6 Avant Sport Sedan, Giulia Quadrifoglio
- **Convertibles**: Porsche 911 Cabriolet, Porsche 911 Targa, MX-5 Roadster, Maranello Spider
- **Trucks & Pickups**: Lifted 4x4 Off-Road Crew-Cab, Modern Double-Cab Pickup, Trophy Baja Desert Truck, Twin-Stack Racing Semi Cab
- **SUVs**: Urus Performante Super SUV, G-Wagon BiTurbo 4x4, Tactical Armored SUV, Cayenne Turbo GT
- **MPVs**: VIP High-Roof Luxury Van, Express Aero Coach MPV, JDM Custom Turbo Van
- **Supercars & Hypercars**: Ferrari LaFerrari, Bugatti Bolide Hypercar, Pagani Utopia, Terzo EV Hypercar, McLaren Senna GTR, Jesko Absolut

---

## 🛠️ Developer Setup & Local Build

If you wish to modify the code or contribute:

```bash
# Clone the repository
git clone https://github.com/kskasana4946-cyber/hello.git
cd hello

# Install dependencies
npm install

# Start development server
npm run dev
# -> http://localhost:5173

# Compile production bundle
npm run build

# Package standalone offline distribution zip archives
node tools/package_release.mjs

# Run test suites
npm test
npm run test:e2e
```
