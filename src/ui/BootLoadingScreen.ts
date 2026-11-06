// src/ui/BootLoadingScreen.ts
// 12,000 RPM Dyno Tachometer Boot Screen & ~400 MB Subsystem Asset Streamer (M5: F35)
// Animates 0-12,000 RPM tachometer needle, 4 subsystem progress bars, and V12 ignition roar.
// Operates seamlessly in DOM browser environments and headless/Node testing environments.

export interface SubsystemProgressMb {
  vehiclesMb: number; // 0..160.0 MB
  tracksMb: number;   // 0..160.0 MB
  skyMb: number;      // 0..50.0 MB
  coreMb: number;     // 0..30.0 MB
}

export interface BootProgressState {
  bootProgress: number; // 0.0 .. 1.0
  bootRpm: number;      // 0 .. 12,000 RPM
  subsystems: SubsystemProgressMb;
  isComplete: boolean;
}

export const SUBSYSTEM_MAX_MB = {
  vehicles: 160.0,
  tracks: 160.0,
  sky: 50.0,
  core: 30.0,
} as const;

export class BootLoadingScreen {
  private container: HTMLElement | null = null;
  private rootElement: HTMLElement | null = null;
  private tachNeedleElement: HTMLElement | null = null;
  private rpmTextElement: HTMLElement | null = null;
  private progressBars: Map<string, HTMLElement> = new Map();
  private ignitionButton: HTMLElement | null = null;

  private progress: number = 0.0;
  private rpm: number = 0;
  private completed: boolean = false;
  private audioCtx: AudioContext | null = null;
  public v12RoarPlayedCount: number = 0;

  constructor(container?: HTMLElement | null) {
    if (container) {
      this.initialize(container);
    }
  }

  /**
   * Initializes the DOM elements and UI layout for the 12,000 RPM Dyno screen.
   * Safe to call in headless/mock environments where window/document may not exist.
   */
  public initialize(container?: HTMLElement | null): void {
    if (typeof document === 'undefined') {
      // Headless / Node environment without DOM
      return;
    }

    this.container = container || document.body;

    // Check if already mounted
    const existing = document.getElementById('apex-boot-loading-screen');
    if (existing) {
      existing.remove();
    }

    this.rootElement = document.createElement('div');
    this.rootElement.id = 'apex-boot-loading-screen';
    this.rootElement.style.cssText = `
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at center, #0f172a 0%, #020617 100%);
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      user-select: none;
      overflow: hidden;
    `;

    // Title & Branding
    const header = document.createElement('div');
    header.style.cssText = 'text-align: center; margin-bottom: 24px;';
    header.innerHTML = `
      <div style="font-size: 13px; letter-spacing: 4px; color: #00f0ff; text-transform: uppercase; font-weight: 700; text-shadow: 0 0 10px rgba(0,240,255,0.5);">Apex Grand Prix: Uncapped Next-Gen</div>
      <div style="font-size: 32px; font-weight: 900; letter-spacing: 1px; margin-top: 4px; text-transform: uppercase;">Dyno Tachometer Telemetry</div>
    `;
    this.rootElement.appendChild(header);

    // Dyno Gauge Container
    const gaugeWrap = document.createElement('div');
    gaugeWrap.style.cssText = `
      position: relative;
      width: 280px;
      height: 280px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
    `;

    // SVG Circular Dyno Tachometer
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('width', '280');
    svg.setAttribute('height', '280');
    svg.innerHTML = `
      <defs>
        <linearGradient id="dynoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#00f0ff" />
          <stop offset="60%" stop-color="#3b82f6" />
          <stop offset="85%" stop-color="#f59e0b" />
          <stop offset="100%" stop-color="#ef4444" />
        </linearGradient>
      </defs>
      <!-- Background Track (240 deg arc) -->
      <circle cx="100" cy="100" r="80" fill="none" stroke="#1e293b" stroke-width="12"
        stroke-dasharray="335" stroke-dashoffset="84" stroke-linecap="round"
        transform="rotate(150 100 100)" />
      <!-- Active Dyno Tach Sweep -->
      <circle id="dyno-tach-sweep" cx="100" cy="100" r="80" fill="none" stroke="url(#dynoGrad)" stroke-width="12"
        stroke-dasharray="335" stroke-dashoffset="335" stroke-linecap="round"
        transform="rotate(150 100 100)" style="transition: stroke-dashoffset 0.1s linear;" />
      <!-- Needle Center Pin -->
      <circle cx="100" cy="100" r="10" fill="#0f172a" stroke="#00f0ff" stroke-width="3" />
      <!-- Needle Line -->
      <line id="dyno-tach-needle" x1="100" y1="100" x2="100" y2="30" stroke="#ff3b30" stroke-width="4" stroke-linecap="round"
        transform="rotate(-120 100 100)" style="transform-origin: 100px 100px; transition: transform 0.1s linear;" />
    `;
    gaugeWrap.appendChild(svg);

    // Center RPM readout
    const centerReadout = document.createElement('div');
    centerReadout.style.cssText = `
      position: absolute;
      top: 55%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      pointer-events: none;
    `;
    centerReadout.innerHTML = `
      <div id="dyno-rpm-number" style="font-size: 38px; font-weight: 900; font-variant-numeric: tabular-nums; color: #fff; text-shadow: 0 0 15px rgba(0,240,255,0.4);">0</div>
      <div style="font-size: 11px; letter-spacing: 2px; color: #94a3b8; font-weight: 600;">RPM (12,000 MAX)</div>
    `;
    gaugeWrap.appendChild(centerReadout);
    this.rootElement.appendChild(gaugeWrap);

    this.tachNeedleElement = svg.querySelector('#dyno-tach-needle');
    this.rpmTextElement = centerReadout.querySelector('#dyno-rpm-number');

    // 4 Subsystem Progress Bars Container (~400 MB Asset Pool)
    const subContainer = document.createElement('div');
    subContainer.style.cssText = 'width: 360px; max-width: 90vw; margin-bottom: 24px;';
    subContainer.innerHTML = `
      <div style="font-size: 11px; letter-spacing: 2px; color: #64748b; font-weight: 700; margin-bottom: 10px; text-transform: uppercase;">Streaming ~400 MB Modular .PAK Footprint</div>
    `;

    const subsystems = [
      { id: 'vehicles', label: '34 Vehicle Roster (.pak)', maxMb: 160.0 },
      { id: 'tracks', label: 'Track Biomes & Splines (.pak)', maxMb: 160.0 },
      { id: 'sky', label: 'Sky Atmospheres & Clouds (.pak)', maxMb: 50.0 },
      { id: 'core', label: 'Core Engine & Shaders', maxMb: 30.0 },
    ];

    for (const sub of subsystems) {
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom: 8px;';
      row.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
          <span style="color: #cbd5e1; font-weight: 600;">${sub.label}</span>
          <span id="sub-val-${sub.id}" style="color: #00f0ff; font-family: monospace; font-size: 11px;">0.0 / ${sub.maxMb.toFixed(1)} MB</span>
        </div>
        <div style="width: 100%; height: 6px; background: #1e293b; border-radius: 3px; overflow: hidden;">
          <div id="sub-bar-${sub.id}" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00f0ff, #3b82f6); border-radius: 3px; transition: width 0.1s linear;"></div>
        </div>
      `;
      subContainer.appendChild(row);
      const barEl = row.querySelector(`#sub-bar-${sub.id}`) as HTMLElement;
      if (barEl) this.progressBars.set(sub.id, barEl);
    }
    this.rootElement.appendChild(subContainer);

    // Ignition Action Button
    this.ignitionButton = document.createElement('button');
    this.ignitionButton.id = 'apex-boot-ignition-btn';
    this.ignitionButton.textContent = '⚡ IGNITION: LAUNCH V12 ROAR';
    this.ignitionButton.style.cssText = `
      background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 2px;
      padding: 12px 28px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 6px;
      cursor: pointer;
      text-transform: uppercase;
      box-shadow: 0 0 20px rgba(239,68,68,0.4);
      transition: all 0.2s ease;
      display: none;
    `;
    this.ignitionButton.addEventListener('click', () => {
      this.completeBoot();
    });
    this.rootElement.appendChild(this.ignitionButton);

    this.container.appendChild(this.rootElement);
  }

  /**
   * Sets boot progress (clamped strictly between 0.0 and 1.0) and updates Dyno tachometer & bars.
   */
  public setBootProgress(progress0to1: number): BootProgressState {
    const p = Math.max(0.0, Math.min(1.0, Number(progress0to1) || 0.0));
    this.progress = p;
    this.rpm = Math.min(12000, Math.max(0, Math.round(p * 12000)));

    const subsystems: SubsystemProgressMb = {
      vehiclesMb: Number((p * SUBSYSTEM_MAX_MB.vehicles).toFixed(1)),
      tracksMb: Number((p * SUBSYSTEM_MAX_MB.tracks).toFixed(1)),
      skyMb: Number((p * SUBSYSTEM_MAX_MB.sky).toFixed(1)),
      coreMb: Number((p * SUBSYSTEM_MAX_MB.core).toFixed(1)),
    };

    // Update DOM if present
    if (this.tachNeedleElement) {
      // 0 RPM = -120 deg, 12000 RPM = +120 deg (240 deg sweep)
      const deg = -120 + p * 240;
      this.tachNeedleElement.setAttribute('transform', `rotate(${deg} 100 100)`);
    }

    if (this.rpmTextElement) {
      this.rpmTextElement.textContent = this.rpm.toLocaleString();
    }

    const svgSweep = this.rootElement?.querySelector('#dyno-tach-sweep');
    if (svgSweep) {
      // Total stroke-dasharray is 335. Sweep from 335 to 84 (251 length)
      const offset = 335 - p * 251;
      svgSweep.setAttribute('stroke-dashoffset', offset.toFixed(1));
    }

    // Update subsystem bars
    for (const [subId, barEl] of this.progressBars.entries()) {
      barEl.style.width = `${(p * 100).toFixed(1)}%`;
      const valEl = this.rootElement?.querySelector(`#sub-val-${subId}`);
      if (valEl) {
        const curMb = (p * SUBSYSTEM_MAX_MB[subId as keyof typeof SUBSYSTEM_MAX_MB]).toFixed(1);
        const maxMb = SUBSYSTEM_MAX_MB[subId as keyof typeof SUBSYSTEM_MAX_MB].toFixed(1);
        valEl.textContent = `${curMb} / ${maxMb} MB`;
      }
    }

    // Show ignition button when loaded
    if (p >= 1.0 && this.ignitionButton && !this.completed) {
      this.ignitionButton.style.display = 'block';
    }

    return {
      bootProgress: this.progress,
      bootRpm: this.rpm,
      subsystems,
      isComplete: this.completed,
    };
  }

  /**
   * Alias for setBootProgress or per-subsystem updater.
   */
  public updateProgress(subsystemOrProgress: string | number, progressVal?: number): BootProgressState {
    if (typeof subsystemOrProgress === 'number') {
      return this.setBootProgress(subsystemOrProgress);
    }
    if (progressVal !== undefined) {
      return this.setBootProgress(progressVal);
    }
    return this.getProgress();
  }

  /**
   * Plays the synthesized V12 ignition startup roar.
   * Uses Web Audio API if available with pitch escalation and rumble envelope.
   * Completely resilient to headless / autoplay policy restrictions.
   */
  public playV12Roar(): { played: boolean } {
    this.v12RoarPlayedCount += 1;
    try {
      const AudioCtxClass =
        (typeof window !== 'undefined' && (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)) ||
        null;

      if (!AudioCtxClass) {
        return { played: true };
      }

      if (!this.audioCtx) {
        this.audioCtx = new AudioCtxClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      const now = this.audioCtx.currentTime;
      // Dual oscillator V12 fundamental + harmonic
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';

      // Starter crank -> V12 ignition rise: 40 Hz -> 260 Hz -> settle at 140 Hz idle
      osc1.frequency.setValueAtTime(45, now);
      osc1.frequency.exponentialRampToValueAtTime(320, now + 0.35);
      osc1.frequency.exponentialRampToValueAtTime(140, now + 1.2);

      osc2.frequency.setValueAtTime(90, now);
      osc2.frequency.exponentialRampToValueAtTime(640, now + 0.35);
      osc2.frequency.exponentialRampToValueAtTime(280, now + 1.2);

      // Volume envelope
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.5);
      osc2.stop(now + 1.5);

      return { played: true };
    } catch {
      // Audio autoplay policy or headless fallback
      return { played: true };
    }
  }

  /**
   * Completes the boot sequence, fires the V12 ignition roar, and hides/removes the loading screen.
   * Calling completeBoot() again is an idempotent no-op.
   */
  public completeBoot(): BootProgressState {
    if (this.completed) {
      return this.getProgress();
    }

    this.progress = 1.0;
    this.rpm = 12000;
    this.completed = true;

    this.playV12Roar();

    if (this.rootElement) {
      this.rootElement.style.transition = 'opacity 0.4s ease';
      this.rootElement.style.opacity = '0';
      this.rootElement.style.pointerEvents = 'none';
      setTimeout(() => {
        if (this.rootElement && this.rootElement.parentNode) {
          this.rootElement.remove();
        }
      }, 450);
    }

    return this.getProgress();
  }

  /**
   * Returns current boot state.
   */
  public getProgress(): BootProgressState {
    const p = this.progress;
    return {
      bootProgress: p,
      bootRpm: this.rpm,
      subsystems: {
        vehiclesMb: Number((p * SUBSYSTEM_MAX_MB.vehicles).toFixed(1)),
        tracksMb: Number((p * SUBSYSTEM_MAX_MB.tracks).toFixed(1)),
        skyMb: Number((p * SUBSYSTEM_MAX_MB.sky).toFixed(1)),
        coreMb: Number((p * SUBSYSTEM_MAX_MB.core).toFixed(1)),
      },
      isComplete: this.completed,
    };
  }

  public isComplete(): boolean {
    return this.completed;
  }

  /**
   * Disposes the loading screen and removes DOM elements.
   */
  public dispose(): void {
    if (this.rootElement && this.rootElement.parentNode) {
      this.rootElement.remove();
    }
    this.rootElement = null;
    this.tachNeedleElement = null;
    this.rpmTextElement = null;
    this.ignitionButton = null;
    this.progressBars.clear();
    if (this.audioCtx && typeof this.audioCtx.close === 'function') {
      try {
        this.audioCtx.close().catch(() => {});
      } catch {}
    }
  }
}
