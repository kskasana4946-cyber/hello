// src/ui/RaceHUD.ts
// In-Race 2D Telemetry Cockpit HUD Overlay (M5: F31/F36/LiveCockpitTelemetry)
// Digital Speedometer (KPH), Gear, 0–15k RPM Tachometer Arc, Lap Delta, Leaderboard,
// Nitro Meter, DRS Active Status, 1,000°C Carbon-Ceramic Brake Glow, Sector Splits & Minimap.

import { LiveCockpitTelemetry } from '../core/types';

export class RaceHUD {
  private container: HTMLElement | null = null;
  private rootElement: HTMLElement | null = null;
  private speedElement: HTMLElement | null = null;
  private gearElement: HTMLElement | null = null;
  private rpmTextElement: HTMLElement | null = null;
  private tachArcElement: SVGPathElement | null = null;
  private lapDeltaElement: HTMLElement | null = null;
  private lapCounterElement: HTMLElement | null = null;
  private positionElement: HTMLElement | null = null;
  private nitroBarElement: HTMLElement | null = null;
  private drsBadgeElement: HTMLElement | null = null;
  private brakeTempElement: HTMLElement | null = null;
  private sectorSplitsContainer: HTMLElement | null = null;
  private minimapCanvas: HTMLCanvasElement | null = null;
  private minimapCtx: CanvasRenderingContext2D | null = null;

  public currentTelemetry: LiveCockpitTelemetry | null = null;
  public onReturnToPaddockCallback?: () => void;
  public onCycleCameraCallback?: () => void;
  private playerTrackFraction = 0.0;
  private rivalTrackFractions: number[] = [];

  constructor(container?: HTMLElement | null) {
    if (container) {
      this.initialize(container);
    }
  }

  public setVisible(visible: boolean): void {
    if (this.rootElement) {
      this.rootElement.style.display = visible ? 'flex' : 'none';
    }
  }

  public setMinimapPositions(playerFraction: number, rivalFractions: number[]): void {
    this.playerTrackFraction = ((Number(playerFraction) || 0) % 1 + 1) % 1;
    this.rivalTrackFractions = rivalFractions.map((f) => (((Number(f) || 0) % 1) + 1) % 1);
  }

  /**
   * Initializes the HUD DOM overlay and canvas elements.
   * Safe to invoke in headless Node/JSDOM environments.
   */
  public initialize(container?: HTMLElement | null): void {
    if (typeof document === 'undefined') {
      return;
    }

    this.container = container || document.body;

    const existing = document.getElementById('apex-race-hud');
    if (existing) {
      existing.remove();
    }

    this.rootElement = document.createElement('div');
    this.rootElement.id = 'apex-race-hud';
    this.rootElement.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 500;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 20px 28px;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
    `;

    // 1. TOP BAR: Position Leaderboard, Broadcast Controls & Lap Counter
    const topBar = document.createElement('div');
    topBar.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-start;';

    // Position & Leaderboard
    const posWrap = document.createElement('div');
    posWrap.innerHTML = `
      <div style="background: rgba(2,6,23,0.85); border-left: 4px solid #00f0ff; border-radius: 6px; padding: 8px 18px; backdrop-filter: blur(10px); box-shadow: 0 8px 24px rgba(0,0,0,0.4);">
        <div style="font-size: 10px; letter-spacing: 2px; color: #94a3b8; font-weight: 800;">RACE POSITION</div>
        <div id="hud-position" style="font-size: 32px; font-weight: 900; line-height: 1.1; color: #fff;">P1 <span style="font-size: 16px; color: #64748b;">/ 8</span></div>
      </div>
    `;
    topBar.appendChild(posWrap);

    // Center Top Broadcast Bar: Controls & Quick Buttons
    const centerControls = document.createElement('div');
    centerControls.style.cssText = `
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(2,6,23,0.82);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 8px;
      padding: 6px 14px;
      backdrop-filter: blur(10px);
    `;
    centerControls.innerHTML = `
      <button id="hud-btn-paddock" style="background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.45); border-radius: 4px; padding: 5px 10px; font-size: 11px; font-weight: 800; cursor: pointer;">
        [ESC] PADDOCK GARAGE
      </button>
      <button id="hud-btn-camera" style="background: rgba(0,240,255,0.16); color: #00f0ff; border: 1px solid rgba(0,240,255,0.4); border-radius: 4px; padding: 5px 10px; font-size: 11px; font-weight: 800; cursor: pointer;">
        [C] CAMERA VIEW
      </button>
      <span style="font-size: 11px; color: #94a3b8; font-weight: 600; padding-left: 4px;">
        WASD / Arrows: Drive &bull; Space: Drift &bull; Shift: ERS Boost
      </span>
    `;
    topBar.appendChild(centerControls);

    // Lap Timer, Lap Delta & Sector Splits
    const lapWrap = document.createElement('div');
    lapWrap.style.cssText = 'text-align: right; background: rgba(2,6,23,0.85); border-right: 4px solid #a855f7; border-radius: 6px; padding: 8px 18px; backdrop-filter: blur(10px); box-shadow: 0 8px 24px rgba(0,0,0,0.4);';
    lapWrap.innerHTML = `
      <div id="hud-lap-counter" style="font-size: 12px; letter-spacing: 2px; color: #a855f7; font-weight: 800;">LAP 1 / 3</div>
      <div id="hud-lap-delta" style="font-size: 24px; font-weight: 900; font-family: monospace; color: #22c55e;">-0.00s</div>
      <div id="hud-sector-splits" style="display: flex; gap: 8px; justify-content: flex-end; font-size: 11px; font-family: monospace; margin-top: 4px; color: #94a3b8;">
        <span>S1: --</span> <span>S2: --</span> <span>S3: --</span>
      </div>
    `;
    topBar.appendChild(lapWrap);

    this.rootElement.appendChild(topBar);

    // 2. BOTTOM BAR: Minimap (Left) & Instrument Cluster (Right)
    const bottomBar = document.createElement('div');
    bottomBar.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-end;';

    // Left: 2D GPS Circuit Spline Minimap
    const mapWrap = document.createElement('div');
    mapWrap.style.cssText = 'background: rgba(2,6,23,0.85); border: 1px solid rgba(0,240,255,0.22); border-radius: 10px; padding: 10px; backdrop-filter: blur(10px); box-shadow: 0 8px 24px rgba(0,0,0,0.45);';
    const mapLabel = document.createElement('div');
    mapLabel.style.cssText = 'font-size: 9px; font-weight: 800; letter-spacing: 1.5px; color: #00f0ff; margin-bottom: 4px; display: flex; justify-content: space-between;';
    mapLabel.innerHTML = '<span>CIRCUIT GPS</span><span style="color:#ef4444;">● AI</span>';
    mapWrap.appendChild(mapLabel);

    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.width = 160;
    this.minimapCanvas.height = 160;
    this.minimapCanvas.style.cssText = 'display: block; width: 145px; height: 145px; border-radius: 6px;';
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    mapWrap.appendChild(this.minimapCanvas);
    bottomBar.appendChild(mapWrap);

    // Right: Instrument Cluster (Speed, Gear, Tachometer Arc, Nitro, DRS, Brake Temp)
    const cluster = document.createElement('div');
    cluster.style.cssText = `
      position: relative;
      width: 290px;
      height: 205px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      background: radial-gradient(circle at 50% 65%, rgba(2,6,23,0.82) 0%, rgba(2,6,23,0) 78%);
      padding: 8px 14px;
      border-radius: 16px;
    `;

    // SVG Tachometer Arc
    const tachSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tachSvg.setAttribute('viewBox', '0 0 240 160');
    tachSvg.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: visible;';
    tachSvg.innerHTML = `
      <defs>
        <linearGradient id="tachGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#00f0ff" />
          <stop offset="65%" stop-color="#3b82f6" />
          <stop offset="85%" stop-color="#f59e0b" />
          <stop offset="100%" stop-color="#ef4444" />
        </linearGradient>
      </defs>
      <!-- Base Gray Track (180 to 0 deg) -->
      <path d="M 20 140 A 100 100 0 0 1 220 140" fill="none" stroke="#1e293b" stroke-width="12" stroke-linecap="round" />
      <!-- Active RPM Sweep -->
      <path id="hud-tach-arc" d="M 20 140 A 100 100 0 0 1 220 140" fill="none" stroke="url(#tachGrad)" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="314" stroke-dashoffset="314" style="transition: stroke-dashoffset 0.05s linear;" />
    `;
    cluster.appendChild(tachSvg);

    // Center Gear & Speed Readout
    const speedCenter = document.createElement('div');
    speedCenter.style.cssText = 'position: relative; z-index: 2; text-align: center; margin-bottom: 12px;';
    speedCenter.innerHTML = `
      <div id="hud-gear" style="font-size: 36px; font-weight: 900; color: #00f0ff; line-height: 1;">N</div>
      <div id="hud-speed" style="font-size: 52px; font-weight: 900; line-height: 0.95; font-variant-numeric: tabular-nums; color: #fff;">0</div>
      <div style="font-size: 11px; letter-spacing: 2px; color: #94a3b8; font-weight: 700;">KPH</div>
      <div id="hud-rpm-text" style="font-size: 11px; font-family: monospace; color: #cbd5e1; margin-top: 2px;">0 / 8,500 RPM</div>
    `;
    cluster.appendChild(speedCenter);

    // Nitro / ERS Meter & DRS & Brake Glow Status Row
    const statusRow = document.createElement('div');
    statusRow.style.cssText = 'position: relative; z-index: 2; width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;';
    statusRow.innerHTML = `
      <!-- ERS / Nitro Meter -->
      <div style="flex: 1;">
        <div style="display: flex; justify-content: space-between; font-size: 9px; font-weight: 800; color: #00f0ff; letter-spacing: 1px; margin-bottom: 2px;">
          <span>ERS BOOST</span> <span id="hud-nitro-val">100%</span>
        </div>
        <div style="width: 100%; height: 6px; background: #0f172a; border-radius: 3px; overflow: hidden; border: 1px solid rgba(0,240,255,0.3);">
          <div id="hud-nitro-bar" style="width: 100%; height: 100%; background: linear-gradient(90deg, #00f0ff, #3b82f6); border-radius: 3px;"></div>
        </div>
      </div>
      <!-- DRS Indicator -->
      <div id="hud-drs-badge" style="font-size: 10px; font-weight: 900; letter-spacing: 1px; padding: 4px 8px; border-radius: 3px; background: #1e293b; color: #64748b; border: 1px solid rgba(255,255,255,0.1);">
        DRS
      </div>
      <!-- Brake Temp Indicator -->
      <div id="hud-brake-temp" style="font-size: 10px; font-weight: 800; font-family: monospace; padding: 4px 6px; border-radius: 3px; background: #0f172a; color: #94a3b8; border: 1px solid rgba(255,255,255,0.1);">
        25°C
      </div>
    `;
    cluster.appendChild(statusRow);

    bottomBar.appendChild(cluster);
    this.rootElement.appendChild(bottomBar);

    this.container.appendChild(this.rootElement);

    // Bind button listeners
    this.rootElement.querySelector('#hud-btn-paddock')?.addEventListener('click', () => {
      if (this.onReturnToPaddockCallback) this.onReturnToPaddockCallback();
    });
    this.rootElement.querySelector('#hud-btn-camera')?.addEventListener('click', () => {
      if (this.onCycleCameraCallback) this.onCycleCameraCallback();
    });

    // Element caching
    this.positionElement = this.rootElement.querySelector('#hud-position');
    this.lapCounterElement = this.rootElement.querySelector('#hud-lap-counter');
    this.lapDeltaElement = this.rootElement.querySelector('#hud-lap-delta');
    this.sectorSplitsContainer = this.rootElement.querySelector('#hud-sector-splits');
    this.speedElement = this.rootElement.querySelector('#hud-speed');
    this.gearElement = this.rootElement.querySelector('#hud-gear');
    this.rpmTextElement = this.rootElement.querySelector('#hud-rpm-text');
    this.tachArcElement = this.rootElement.querySelector('#hud-tach-arc');
    this.nitroBarElement = this.rootElement.querySelector('#hud-nitro-bar');
    this.drsBadgeElement = this.rootElement.querySelector('#hud-drs-badge');
    this.brakeTempElement = this.rootElement.querySelector('#hud-brake-temp');
  }

  /**
   * Updates HUD gauges, text fields, and minimap with live telemetry.
   */
  public update(telemetry: LiveCockpitTelemetry): void {
    this.currentTelemetry = { ...telemetry };

    if (!this.rootElement) {
      return;
    }

    // 1. Speed & Gear
    if (this.speedElement) {
      this.speedElement.textContent = Math.round(telemetry.speedKph).toString();
    }
    if (this.gearElement) {
      this.gearElement.textContent = telemetry.gear.toString();
    }

    // 2. Tachometer Arc
    if (this.rpmTextElement) {
      this.rpmTextElement.textContent = `${Math.round(telemetry.rpm).toLocaleString()} / ${Math.round(telemetry.maxRpm).toLocaleString()} RPM`;
    }
    if (this.tachArcElement) {
      const frac = Math.max(0.0, Math.min(1.0, telemetry.rpm / (telemetry.maxRpm || 10000)));
      // Arc length is 314 (pi * r where r=100)
      const offset = 314 * (1.0 - frac);
      this.tachArcElement.setAttribute('stroke-dashoffset', offset.toFixed(1));
    }

    // 3. Position & Laps
    if (this.positionElement) {
      this.positionElement.innerHTML = `P${telemetry.position} <span style="font-size: 16px; color: #64748b;">/ ${telemetry.totalRacers}</span>`;
    }
    if (this.lapCounterElement) {
      this.lapCounterElement.textContent = `LAP ${telemetry.currentLap} / ${telemetry.totalLaps}`;
    }

    // 4. Lap Delta
    if (this.lapDeltaElement) {
      const delta = telemetry.lapDeltaSec;
      const sign = delta > 0 ? '+' : '';
      this.lapDeltaElement.textContent = `${sign}${delta.toFixed(2)}s`;
      this.lapDeltaElement.style.color = delta <= 0 ? '#22c55e' : '#ef4444';
    }

    // 5. Sector Splits
    if (this.sectorSplitsContainer) {
      const [s1, s2, s3] = telemetry.sectorSplits;
      this.sectorSplitsContainer.innerHTML = `
        <span>S1: ${s1 !== null ? s1.toFixed(2) + 's' : '--'}</span>
        <span>S2: ${s2 !== null ? s2.toFixed(2) + 's' : '--'}</span>
        <span>S3: ${s3 !== null ? s3.toFixed(2) + 's' : '--'}</span>
      `;
    }

    // 6. Nitro
    if (this.nitroBarElement) {
      const p = Math.max(0, Math.min(100, Math.round(telemetry.nitroPercent)));
      this.nitroBarElement.style.width = `${p}%`;
      const valEl = this.rootElement.querySelector('#hud-nitro-val');
      if (valEl) valEl.textContent = `${p}%`;
    }

    // 7. DRS
    if (this.drsBadgeElement) {
      if (telemetry.drsActive) {
        this.drsBadgeElement.style.background = '#22c55e';
        this.drsBadgeElement.style.color = '#020617';
        this.drsBadgeElement.style.boxShadow = '0 0 10px rgba(34,197,94,0.6)';
      } else {
        this.drsBadgeElement.style.background = '#1e293b';
        this.drsBadgeElement.style.color = '#64748b';
        this.drsBadgeElement.style.boxShadow = 'none';
      }
    }

    // 8. Brake Temperature Glow (> 800°C turns glowing bright orange)
    if (this.brakeTempElement) {
      const temp = Math.round(telemetry.brakeTempCelsius);
      this.brakeTempElement.textContent = `${temp}°C`;
      if (temp > 800) {
        this.brakeTempElement.style.color = '#ff6600';
        this.brakeTempElement.style.boxShadow = '0 0 12px rgba(255,102,0,0.8)';
        this.brakeTempElement.style.borderColor = '#ff6600';
      } else {
        this.brakeTempElement.style.color = '#94a3b8';
        this.brakeTempElement.style.boxShadow = 'none';
        this.brakeTempElement.style.borderColor = 'rgba(255,255,255,0.1)';
      }
    }

    // 9. Minimap Draw
    this.drawMinimap(telemetry);
  }

  private drawMinimap(_telemetry: LiveCockpitTelemetry): void {
    if (!this.minimapCtx || !this.minimapCanvas) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Dark circuit backdrop
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const rx = w * 0.37;
    const ry = h * 0.35;

    // Draw outer track border
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Draw inner asphalt ribbon
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Start/Finish marker at theta = 0 (bottom-top reference)
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + rx - 6, cy);
    ctx.lineTo(cx + rx + 6, cy);
    ctx.stroke();

    // Draw AI rival positions
    ctx.fillStyle = '#ef4444';
    for (const rFrac of this.rivalTrackFractions) {
      const rAngle = rFrac * Math.PI * 2;
      const rpx = cx + Math.cos(rAngle) * rx;
      const rpy = cy + Math.sin(rAngle) * ry;
      ctx.beginPath();
      ctx.arc(rpx, rpy, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw player position marker
    const pAngle = this.playerTrackFraction * Math.PI * 2;
    const px = cx + Math.cos(pAngle) * rx;
    const py = cy + Math.sin(pAngle) * ry;

    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(px, py, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /**
   * Disposes the HUD overlay and cleans up DOM.
   */
  public dispose(): void {
    if (this.rootElement && this.rootElement.parentNode) {
      this.rootElement.remove();
    }
    this.rootElement = null;
    this.speedElement = null;
    this.gearElement = null;
    this.rpmTextElement = null;
    this.tachArcElement = null;
    this.lapDeltaElement = null;
    this.lapCounterElement = null;
    this.positionElement = null;
    this.nitroBarElement = null;
    this.drsBadgeElement = null;
    this.brakeTempElement = null;
    this.sectorSplitsContainer = null;
    this.minimapCanvas = null;
    this.minimapCtx = null;
  }
}
