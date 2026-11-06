// src/ui/PostRaceRewardCeremony.ts
// Post-Race 3D Podium Ceremony, Spotlight Turntable Reveal & Reward Breakdown (M5: F34)
// Top-3 3D Podium Stage + Rotating Turntable Spotlight Reveal for newly unlocked vehicles
// Itemized Apex Credits (CR) & Driver XP telemetry tally receipt.

import * as THREE from 'three';
import { PostRaceCeremonyReport } from '../career/ProgressionManager';
import { VehicleSpec } from '../core/types';

export class PostRaceRewardCeremony {
  private container: HTMLElement | null = null;
  private rootElement: HTMLElement | null = null;
  private scene: THREE.Scene | null = null;
  private turntableGroup: THREE.Group | null = null;
  private podiumGroup: THREE.Group | null = null;
  private spotlight: THREE.SpotLight | null = null;

  public activeReport: PostRaceCeremonyReport | null = null;
  public turntableAngleRad: number = 0.0;
  public turntableAngularVelRadSec: number = 0.0;
  public isDismissed: boolean = false;
  public onDismissCallback?: () => void;

  constructor(container?: HTMLElement | null, scene?: THREE.Scene | null) {
    this.scene = scene || null;
    if (container) {
      this.initialize(container);
    }
  }

  /**
   * Initializes the 3D podium and turntable scene objects if Three.js scene is provided,
   * plus the 2D overlay breakdown card.
   */
  public initialize(container?: HTMLElement | null): void {
    if (this.scene) {
      this.build3dPodiumAndTurntable();
    }

    if (typeof document === 'undefined') {
      return;
    }

    this.container = container || document.body;

    const existing = document.getElementById('apex-post-race-ceremony');
    if (existing) {
      existing.remove();
    }

    this.rootElement = document.createElement('div');
    this.rootElement.id = 'apex-post-race-ceremony';
    this.rootElement.style.cssText = `
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at center, rgba(15,23,42,0.85) 0%, rgba(2,6,23,0.95) 100%);
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      user-select: none;
    `;

    this.container.appendChild(this.rootElement);
  }

  /**
   * Activates the ceremony with a completed race ceremony report.
   */
  public showCeremony(report: PostRaceCeremonyReport): void {
    this.activeReport = report;
    this.isDismissed = false;
    this.turntableAngleRad = 0.0;
    this.turntableAngularVelRadSec = report.turntableAngularVelRadSec;

    // Update 3D visibility
    if (this.podiumGroup) {
      this.podiumGroup.visible = report.podiumStageActive;
    }
    if (this.turntableGroup) {
      this.turntableGroup.visible = report.turntableRevealActive;
    }
    if (this.spotlight) {
      this.spotlight.intensity = report.turntableRevealActive ? 120.0 : 40.0;
    }

    // Render 2D UI
    this.renderOverlayCard(report);

    if (this.rootElement) {
      this.rootElement.style.display = 'flex';
      this.rootElement.style.opacity = '1';
    }
  }

  /**
   * Updates turntable angular rotation for newly unlocked vehicle turntable reveal.
   * Angle wraps strictly at 2*pi rad.
   */
  public update(deltaTimeSec: number): void {
    if (this.activeReport?.turntableRevealActive && this.turntableAngularVelRadSec > 0) {
      this.turntableAngleRad = (this.turntableAngleRad + this.turntableAngularVelRadSec * deltaTimeSec) % (Math.PI * 2);
      if (this.turntableGroup) {
        this.turntableGroup.rotation.y = this.turntableAngleRad;
      }
    }
  }

  /**
   * Dismisses ceremony and transitions back to Paddock Showroom.
   */
  public returnToPaddock(): { phase: 'PADDOCK' } {
    this.isDismissed = true;
    if (this.rootElement) {
      this.rootElement.style.display = 'none';
    }
    if (this.podiumGroup) {
      this.podiumGroup.visible = false;
    }
    if (this.turntableGroup) {
      this.turntableGroup.visible = false;
    }
    if (this.onDismissCallback) {
      this.onDismissCallback();
    }
    return { phase: 'PADDOCK' };
  }

  public dismiss(): { phase: 'PADDOCK' } {
    return this.returnToPaddock();
  }

  /**
   * Disposes 3D meshes and DOM elements.
   */
  public dispose(): void {
    if (this.rootElement && this.rootElement.parentNode) {
      this.rootElement.remove();
    }
    this.rootElement = null;

    if (this.podiumGroup && this.scene) {
      this.scene.remove(this.podiumGroup);
      this.podiumGroup = null;
    }
    if (this.turntableGroup && this.scene) {
      this.scene.remove(this.turntableGroup);
      this.turntableGroup = null;
    }
    if (this.spotlight && this.scene) {
      this.scene.remove(this.spotlight);
      this.spotlight = null;
    }
  }

  // ==========================================================================
  // Private 3D & 2D Builders
  // ==========================================================================

  private build3dPodiumAndTurntable(): void {
    if (!this.scene) return;

    // Podium 3-Tier Pedestals
    this.podiumGroup = new THREE.Group();
    this.podiumGroup.name = 'Podium3DStage';

    // 1st place gold pedestal (height 1.6m)
    const p1Geo = new THREE.BoxGeometry(2.0, 1.6, 2.0);
    const p1Mat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
    const p1Mesh = new THREE.Mesh(p1Geo, p1Mat);
    p1Mesh.position.set(0, 0.8, 0);
    this.podiumGroup.add(p1Mesh);

    // 2nd place silver pedestal (height 1.2m)
    const p2Geo = new THREE.BoxGeometry(2.0, 1.2, 2.0);
    const p2Mat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.85, roughness: 0.25 });
    const p2Mesh = new THREE.Mesh(p2Geo, p2Mat);
    p2Mesh.position.set(-2.4, 0.6, 0);
    this.podiumGroup.add(p2Mesh);

    // 3rd place bronze pedestal (height 0.8m)
    const p3Geo = new THREE.BoxGeometry(2.0, 0.8, 2.0);
    const p3Mat = new THREE.MeshStandardMaterial({ color: 0xcd7f32, metalness: 0.8, roughness: 0.3 });
    const p3Mesh = new THREE.Mesh(p3Geo, p3Mat);
    p3Mesh.position.set(2.4, 0.4, 0);
    this.podiumGroup.add(p3Mesh);

    this.podiumGroup.visible = false;
    this.scene.add(this.podiumGroup);

    // Turntable Pedestal
    this.turntableGroup = new THREE.Group();
    this.turntableGroup.name = 'TurntableRevealGroup';
    const ttGeo = new THREE.CylinderGeometry(3.5, 3.8, 0.35, 48);
    const ttMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.6, roughness: 0.25 });
    const ttMesh = new THREE.Mesh(ttGeo, ttMat);
    ttMesh.position.y = 0.175;
    this.turntableGroup.add(ttMesh);

    // Turntable Neon Ring
    const ringGeo = new THREE.TorusGeometry(3.6, 0.04, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.36;
    this.turntableGroup.add(ringMesh);

    this.turntableGroup.position.set(0, 0, -8.0);
    this.turntableGroup.visible = false;
    this.scene.add(this.turntableGroup);

    // Turntable Spotlight
    this.spotlight = new THREE.SpotLight(0x00f0ff, 80.0, 30.0, Math.PI / 4, 0.35, 1.2);
    this.spotlight.position.set(0, 12.0, -8.0);
    this.spotlight.target = this.turntableGroup;
    this.scene.add(this.spotlight);
  }

  private renderOverlayCard(report: PostRaceCeremonyReport): void {
    if (!this.rootElement) return;

    const isPodium = report.position <= 3;
    const posLabel =
      report.position === 1 ? '🥇 1ST PLACE VICTORY' :
      report.position === 2 ? '🥈 2ND PLACE PODIUM' :
      report.position === 3 ? '🥉 3RD PLACE PODIUM' :
      `FINISH: P${report.position}`;

    const b = report.breakdown;

    let unlockHtml = '';
    if (report.turntableRevealActive && report.newlyUnlockedVehicle) {
      const v = report.newlyUnlockedVehicle;
      unlockHtml = `
        <div style="background: rgba(0,240,255,0.1); border: 1px solid #00f0ff; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; text-align: center;">
          <div style="font-size: 11px; letter-spacing: 2px; color: #00f0ff; font-weight: 700; text-transform: uppercase;">✨ NEW VEHICLE UNLOCKED (CAR #${v.index})</div>
          <div style="font-size: 20px; font-weight: 900; color: #fff; margin-top: 4px;">${v.name}</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">${v.archetype} • ${v.topSpeedKph} KPH • 0-100: ${v.zeroToHundredSec}s</div>
        </div>
      `;
    }

    this.rootElement.innerHTML = `
      <div style="background: rgba(15,23,42,0.95); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 32px 40px; width: 440px; max-width: 90vw; box-shadow: 0 0 50px rgba(0,0,0,0.8);">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 11px; letter-spacing: 3px; color: #94a3b8; font-weight: 700;">OFFICIAL RACE RESULTS</div>
          <div style="font-size: 26px; font-weight: 900; color: ${isPodium ? '#facc15' : '#fff'}; margin-top: 4px;">${posLabel}</div>
        </div>

        ${unlockHtml}

        <div style="font-size: 11px; letter-spacing: 2px; color: #64748b; font-weight: 700; margin-bottom: 12px; text-transform: uppercase;">Itemized Reward Breakdown</div>

        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
          <span style="color: #cbd5e1;">Podium Finish (${posLabel})</span>
          <span style="color: #00f0ff; font-family: monospace;">+${b.podiumCredits.toLocaleString()} CR</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
          <span style="color: #cbd5e1;">Clean Overtakes</span>
          <span style="color: #00f0ff; font-family: monospace;">+${b.overtakeCredits.toLocaleString()} CR</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
          <span style="color: #cbd5e1;">Slipstream Drafting</span>
          <span style="color: #00f0ff; font-family: monospace;">+${b.slipstreamCredits.toLocaleString()} CR</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
          <span style="color: #cbd5e1;">Drift Combos</span>
          <span style="color: #00f0ff; font-family: monospace;">+${b.driftCredits.toLocaleString()} CR</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
          <span style="color: #cbd5e1;">Tactical Skybridge Stunts (+2,500 CR)</span>
          <span style="color: #00f0ff; font-family: monospace;">+${b.stuntCredits.toLocaleString()} CR</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 12px;">
          <span style="color: #cbd5e1;">Rival Takedowns</span>
          <span style="color: #00f0ff; font-family: monospace;">+${b.takedownCredits.toLocaleString()} CR</span>
        </div>

        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 700;">
            <span style="color: #fff;">Total Race Earnings</span>
            <span style="color: #22c55e; font-family: monospace;">+${report.totalEarnedCredits.toLocaleString()} CR</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px;">
            <span style="color: #94a3b8;">Driver XP Earned</span>
            <span style="color: #a855f7; font-family: monospace;">+${report.totalEarnedXp.toLocaleString()} XP</span>
          </div>
        </div>

        <button id="ceremony-continue-btn" style="
          width: 100%;
          background: linear-gradient(135deg, #00f0ff 0%, #0099ff 100%);
          color: #020617;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 1.5px;
          padding: 12px 0;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          text-transform: uppercase;
        ">CONTINUE TO PADDOCK</button>
      </div>
    `;

    const btn = this.rootElement.querySelector('#ceremony-continue-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        this.returnToPaddock();
      });
    }
  }
}
