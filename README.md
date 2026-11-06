# Apex Grand Prix: Uncapped Next-Gen Edition

A standalone 3D AAA-grade browser racing game built with Three.js, Rapier3D physics, custom automotive PBR shaders, dynamic track streaming, 34 vehicle roster with 3D cockpits, and multi-RPM granular audio synthesis.

---

## How to Run & Play on Your Local Machine

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18+ or 20+ recommended)
- [Git](https://git-scm.com/)

---

### Step 1: Clone the Repository
Open your computer's terminal (Command Prompt, PowerShell, or Git Bash on Windows; Terminal on macOS/Linux):
```bash
git clone https://github.com/kskasana4946-cyber/hello.git
cd hello
```

---

### Step 2: Install Dependencies
```bash
npm install
```

---

### Step 3: Start the Local Development Server
```bash
npm run dev
```

You will see:
```text
  VITE v6.4.5  ready in 180 ms

  ➜  Local:   http://localhost:5173/
```

Now open your browser (Chrome, Edge, Opera, Brave) and navigate to:
**`http://localhost:5173`**

---

### (Optional) Step 4: Build for Production
To create a standalone production build:
```bash
npm run build
npm run preview
```

---

## In-Game Controls

### In Paddock / Garage
- **`[Q]` / `[E]`** or Click Tabs: Switch between **Garage**, **Livery & PBR Paints**, **Circuits & Format**, and **Mod Studio / GLB Export**.
- **`[🔓 UNLOCK ALL]`**: Unlock all 34 vehicles immediately.
- **`🏁 LAUNCH RACE`**: Start race.

### On the Circuit
- **Steer**: `[A]` / `[D]` or `[Left]` / `[Right]` Arrow
- **Throttle**: `[W]` or `[Up]` Arrow
- **Brake / Reverse**: `[S]` or `[Down]` Arrow
- **Handbrake / Drift**: `[Spacebar]`
- **Nitro Boost**: `[Shift]`
- **Camera Views**: `[C]` (Toggle Chase Cam, Cockpit Cam with Live Telemetry Dash, and Bumper Cam)
- **Tactical Ramps & Skybridges**: Outer lane chevrons launch onto the elevated upper-deck highway.

---

## Verification & Testing
```bash
# Run the 138-test unit & physics test suite:
npm test

# Run the 494-test end-to-end suite:
npm run test:e2e
```
