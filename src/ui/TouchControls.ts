// src/ui/TouchControls.ts
// Ergonomic Multi-Touch Driving Interface for Mobile & Desktop Testing

export interface TouchInputState {
  throttle: number;   // 0.0 to 1.0
  brake: number;      // 0.0 to 1.0
  steer: number;      // -1.0 (full left) to +1.0 (full right)
  handbrake: boolean; // drift / handbrake
  nitro: boolean;     // nitro boost
}

export type SteeringMode = 'BUTTONS' | 'JOYSTICK';

export interface TouchControlsOptions {
  container?: HTMLElement;
  initialMode?: SteeringMode;
  autoDetect?: boolean;
  onCameraToggle?: () => void;
  onPaddockReturn?: () => void;
}

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    (navigator && navigator.maxTouchPoints > 0) ||
    ((navigator as any)?.msMaxTouchPoints > 0) ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
  );
}

export class TouchControls {
  private container: HTMLElement;
  private rootElement: HTMLElement | null = null;
  private steeringMode: SteeringMode = 'BUTTONS';
  private visible = false;

  private state: TouchInputState = {
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
    nitro: false,
  };

  private targetSteer = 0;
  private currentSteer = 0;
  private activePointers = new Map<number, string>();

  // Virtual Joystick Elements & Coordinates
  private joystickBase: HTMLElement | null = null;
  private joystickKnob: HTMLElement | null = null;
  private joystickCenter = { x: 0, y: 0 };
  private joystickActivePointerId: number | null = null;
  private joystickRadius = 55; // pixels

  // Tactile Buttons Container
  private buttonsContainer: HTMLElement | null = null;

  // Active simulated keys tracking to ensure balanced keydown/keyup events
  private simulatedKeys = new Set<string>();

  public options: TouchControlsOptions;

  constructor(options: TouchControlsOptions = {}) {
    this.options = options;
    this.container = options.container || (typeof document !== 'undefined' ? document.body : (null as any));
    this.steeringMode = options.initialMode || 'BUTTONS';
    this.visible = options.autoDetect !== false ? isTouchDevice() : true;

    if (typeof document !== 'undefined') {
      this.initDOM();
      this.setVisible(this.visible);
    }
  }

  public getInputState(): TouchInputState {
    return {
      throttle: this.state.throttle,
      brake: this.state.brake,
      steer: this.currentSteer,
      handbrake: this.state.handbrake,
      nitro: this.state.nitro,
    };
  }

  public update(dt: number = 0.016): void {
    // Smooth steering interpolation (prevents jerky turns)
    const smoothRate = this.steeringMode === 'BUTTONS' ? 16.0 : 24.0;
    const factor = Math.min(1.0, dt * smoothRate);
    this.currentSteer += (this.targetSteer - this.currentSteer) * factor;

    if (Math.abs(this.currentSteer) < 0.005 && this.targetSteer === 0) {
      this.currentSteer = 0;
    }
    this.state.steer = this.currentSteer;

    // Synchronize synthesized steering keys
    if (this.currentSteer < -0.15) {
      this.dispatchSimulatedKey('KeyA', true);
      this.dispatchSimulatedKey('KeyD', false);
    } else if (this.currentSteer > 0.15) {
      this.dispatchSimulatedKey('KeyD', true);
      this.dispatchSimulatedKey('KeyA', false);
    } else {
      this.dispatchSimulatedKey('KeyA', false);
      this.dispatchSimulatedKey('KeyD', false);
    }
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.rootElement) {
      this.rootElement.style.display = visible ? 'block' : 'none';
    }
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public setSteeringMode(mode: SteeringMode): void {
    this.steeringMode = mode;
    this.targetSteer = 0;
    this.resetJoystick();
    if (this.buttonsContainer) {
      this.buttonsContainer.style.display = mode === 'BUTTONS' ? 'flex' : 'none';
    }
    if (this.joystickBase) {
      this.joystickBase.style.display = mode === 'JOYSTICK' ? 'flex' : 'none';
    }
  }

  public getSteeringMode(): SteeringMode {
    return this.steeringMode;
  }

  private initDOM(): void {
    if (this.rootElement || !this.container) return;

    this.rootElement = document.createElement('div');
    this.rootElement.id = 'apex-touch-controls';
    this.rootElement.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 700;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    `;

    // 1. LEFT ZONE: Steering (Buttons or Joystick)
    const leftZone = document.createElement('div');
    leftZone.id = 'touch-left-zone';
    leftZone.style.cssText = `
      position: absolute;
      bottom: max(20px, env(safe-area-inset-bottom, 20px));
      left: max(20px, env(safe-area-inset-left, 20px));
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 710;
    `;

    // A. Tactile Steering Buttons
    this.buttonsContainer = document.createElement('div');
    this.buttonsContainer.style.cssText = 'display: flex; gap: 14px; align-items: center;';

    const btnLeft = this.createButton('touch-btn-left', '◀', '82px', '82px', '#00f0ff', 28);
    const btnRight = this.createButton('touch-btn-right', '▶', '82px', '82px', '#00f0ff', 28);

    this.bindPointerAction(btnLeft, (active) => {
      if (active) {
        this.targetSteer = -1.0;
      } else {
        this.updateButtonsSteer();
      }
    }, 'steer_left');

    this.bindPointerAction(btnRight, (active) => {
      if (active) {
        this.targetSteer = 1.0;
      } else {
        this.updateButtonsSteer();
      }
    }, 'steer_right');

    this.buttonsContainer.appendChild(btnLeft);
    this.buttonsContainer.appendChild(btnRight);
    leftZone.appendChild(this.buttonsContainer);

    // B. Analog Virtual Thumbstick
    this.joystickBase = document.createElement('div');
    this.joystickBase.id = 'touch-joystick-base';
    this.joystickBase.style.cssText = `
      width: 130px;
      height: 130px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(15, 23, 42, 0.7) 0%, rgba(2, 6, 23, 0.85) 100%);
      border: 2px solid rgba(0, 240, 255, 0.4);
      box-shadow: 0 8px 32px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,240,255,0.15);
      position: relative;
      display: none;
      align-items: center;
      justify-content: center;
      touch-action: none;
      user-select: none;
    `;

    this.joystickKnob = document.createElement('div');
    this.joystickKnob.id = 'touch-joystick-knob';
    this.joystickKnob.style.cssText = `
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: radial-gradient(circle, #38bdf8 0%, #0284c7 100%);
      border: 2px solid #ffffff;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5), 0 0 16px rgba(56, 189, 248, 0.6);
      position: absolute;
      top: 35px;
      left: 35px;
      touch-action: none;
      pointer-events: none;
      transition: transform 0.05s ease-out;
    `;
    this.joystickBase.appendChild(this.joystickKnob);
    this.bindJoystick(this.joystickBase);
    leftZone.appendChild(this.joystickBase);

    this.rootElement.appendChild(leftZone);

    // 2. RIGHT ZONE: Accelerator, Brake, Nitro, Drift
    const rightZone = document.createElement('div');
    rightZone.id = 'touch-right-zone';
    rightZone.style.cssText = `
      position: absolute;
      bottom: max(16px, env(safe-area-inset-bottom, 16px));
      right: max(20px, env(safe-area-inset-right, 20px));
      pointer-events: auto;
      display: flex;
      align-items: flex-end;
      gap: 16px;
      z-index: 710;
    `;

    // Action Column (Nitro, Drift, Brake)
    const actionCol = document.createElement('div');
    actionCol.style.cssText = 'display: flex; flex-direction: column; gap: 12px; align-items: center;';

    // Nitro Button (Cyan pill)
    const btnNitro = this.createButton('touch-btn-nitro', '⚡ NITRO', '76px', '60px', '#00f0ff', 12, true);
    btnNitro.style.borderRadius = '30px';
    this.bindPointerAction(btnNitro, (active) => {
      this.state.nitro = active;
      this.dispatchSimulatedKey('ShiftLeft', active);
    }, 'nitro');

    // Drift / Handbrake Button (Amber pill)
    const btnDrift = this.createButton('touch-btn-drift', '🛞 DRIFT', '76px', '52px', '#f59e0b', 12);
    btnDrift.style.borderRadius = '16px';
    this.bindPointerAction(btnDrift, (active) => {
      this.state.handbrake = active;
      this.dispatchSimulatedKey('Space', active);
    }, 'drift');

    // Brake Pedal (Red)
    const btnBrake = this.createButton('touch-btn-brake', '▼\nBRAKE', '76px', '95px', '#ef4444', 13);
    btnBrake.style.borderRadius = '14px';
    this.bindPointerAction(btnBrake, (active) => {
      this.state.brake = active ? 1.0 : 0.0;
      this.dispatchSimulatedKey('KeyS', active);
      this.dispatchSimulatedKey('ArrowDown', active);
    }, 'brake');

    actionCol.appendChild(btnNitro);
    actionCol.appendChild(btnDrift);
    actionCol.appendChild(btnBrake);

    // Gas Pedal (Green, tall ergonomic vertical pedal)
    const btnGas = this.createButton('touch-btn-gas', '▲\n\nGAS', '86px', '168px', '#22c55e', 14);
    btnGas.style.borderRadius = '16px';
    this.bindPointerAction(btnGas, (active) => {
      this.state.throttle = active ? 1.0 : 0.0;
      this.dispatchSimulatedKey('KeyW', active);
      this.dispatchSimulatedKey('ArrowUp', active);
    }, 'gas');

    rightZone.appendChild(actionCol);
    rightZone.appendChild(btnGas);
    this.rootElement.appendChild(rightZone);

    // 3. TOP QUICK BAR
    const topBar = document.createElement('div');
    topBar.id = 'touch-top-bar';
    topBar.style.cssText = `
      position: absolute;
      top: max(14px, env(safe-area-inset-top, 14px));
      right: max(18px, env(safe-area-inset-right, 18px));
      pointer-events: auto;
      display: flex;
      gap: 8px;
      z-index: 720;
    `;

    // Camera toggle button
    const btnCam = this.createMiniButton('🎥 CAM', () => {
      this.dispatchTapKey('KeyC');
      this.options.onCameraToggle?.();
    });

    // Steering mode switch button (Buttons vs Joystick)
    const btnMode = this.createMiniButton(
      this.steeringMode === 'BUTTONS' ? '🕹️ STICK' : '◀▶ KEYS',
      () => {
        const nextMode = this.steeringMode === 'BUTTONS' ? 'JOYSTICK' : 'BUTTONS';
        this.setSteeringMode(nextMode);
        btnMode.textContent = nextMode === 'BUTTONS' ? '🕹️ STICK' : '◀▶ KEYS';
      }
    );

    // Touch controls toggle on/off button
    const btnToggle = this.createMiniButton('📱 TOGGLE', () => {
      this.setVisible(!this.visible);
    });

    // Quick Race Launch / Spacebar tap button
    const btnStart = this.createMiniButton('🏁 RACE', () => {
      this.dispatchTapKey('Space');
      this.dispatchTapKey('Enter');
    });

    topBar.appendChild(btnStart);
    topBar.appendChild(btnCam);
    topBar.appendChild(btnMode);
    topBar.appendChild(btnToggle);
    this.rootElement.appendChild(topBar);

    this.container.appendChild(this.rootElement);
  }

  private updateButtonsSteer(): void {
    let target = 0;
    for (const action of this.activePointers.values()) {
      if (action === 'steer_left') target -= 1.0;
      if (action === 'steer_right') target += 1.0;
    }
    this.targetSteer = Math.max(-1.0, Math.min(1.0, target));
  }

  private createButton(
    id: string,
    label: string,
    width: string,
    height: string,
    accentColor: string,
    fontSize: number = 13,
    pulse: boolean = false
  ): HTMLElement {
    const btn = document.createElement('div');
    btn.id = id;
    btn.style.cssText = `
      width: ${width};
      height: ${height};
      background: rgba(2, 6, 23, 0.82);
      border: 2px solid ${accentColor};
      border-radius: 14px;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: ${fontSize}px;
      letter-spacing: 1px;
      white-space: pre-line;
      text-align: center;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.55), inset 0 0 16px ${accentColor}33;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      transition: transform 0.08s ease, background 0.08s ease, border-color 0.08s ease;
      cursor: pointer;
    `;
    btn.textContent = label;
    return btn;
  }

  private createMiniButton(label: string, onClick: () => void): HTMLElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      background: rgba(2, 6, 23, 0.88);
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 8px;
      color: #e2e8f0;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      padding: 7px 12px;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      cursor: pointer;
      touch-action: none;
      user-select: none;
    `;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.unlockAudio();
      onClick();
    });
    return btn;
  }

  private bindPointerAction(
    elem: HTMLElement,
    callback: (active: boolean) => void,
    actionName: string
  ): void {
    elem.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      this.unlockAudio();
      elem.setPointerCapture(e.pointerId);
      this.activePointers.set(e.pointerId, actionName);
      elem.style.transform = 'scale(0.93)';
      elem.style.background = 'rgba(255, 255, 255, 0.28)';
      callback(true);
    });

    const release = (e: PointerEvent) => {
      if (this.activePointers.has(e.pointerId)) {
        this.activePointers.delete(e.pointerId);
        elem.style.transform = 'scale(1.0)';
        elem.style.background = 'rgba(2, 6, 23, 0.82)';
        callback(false);
      }
    };

    elem.addEventListener('pointerup', release);
    elem.addEventListener('pointercancel', release);
  }

  private bindJoystick(base: HTMLElement): void {
    base.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      this.unlockAudio();
      base.setPointerCapture(e.pointerId);
      this.joystickActivePointerId = e.pointerId;

      const rect = base.getBoundingClientRect();
      this.joystickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      this.handleJoystickMove(e.clientX, e.clientY);
    });

    base.addEventListener('pointermove', (e: PointerEvent) => {
      if (this.joystickActivePointerId === e.pointerId) {
        this.handleJoystickMove(e.clientX, e.clientY);
      }
    });

    const release = (e: PointerEvent) => {
      if (this.joystickActivePointerId === e.pointerId) {
        this.joystickActivePointerId = null;
        this.resetJoystick();
      }
    };

    base.addEventListener('pointerup', release);
    base.addEventListener('pointercancel', release);
  }

  private handleJoystickMove(clientX: number, clientY: number): void {
    const dx = clientX - this.joystickCenter.x;
    const dy = clientY - this.joystickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const clampedDist = Math.min(dist, this.joystickRadius);
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    if (this.joystickKnob) {
      this.joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
    }

    // Deadzone and normalized horizontal steer
    const normalizedDist = clampedDist / this.joystickRadius;
    const deadzone = 0.12;
    if (normalizedDist < deadzone) {
      this.targetSteer = 0;
    } else {
      const activeRange = (normalizedDist - deadzone) / (1.0 - deadzone);
      const sign = Math.sign(dx);
      this.targetSteer = sign * Math.min(1.0, activeRange * Math.abs(Math.cos(angle)));
    }
  }

  private resetJoystick(): void {
    if (this.joystickKnob) {
      this.joystickKnob.style.transform = 'translate(0px, 0px)';
    }
    this.targetSteer = 0;
  }

  private dispatchSimulatedKey(code: string, active: boolean): void {
    if (typeof window === 'undefined') return;

    if (active) {
      if (!this.simulatedKeys.has(code)) {
        this.simulatedKeys.add(code);
        const event = new KeyboardEvent('keydown', {
          code,
          key: code,
          bubbles: true,
          cancelable: true,
        });
        window.dispatchEvent(event);
      }
    } else {
      if (this.simulatedKeys.has(code)) {
        this.simulatedKeys.delete(code);
        const event = new KeyboardEvent('keyup', {
          code,
          key: code,
          bubbles: true,
          cancelable: true,
        });
        window.dispatchEvent(event);
      }
    }
  }

  private dispatchTapKey(code: string): void {
    if (typeof window === 'undefined') return;
    this.dispatchSimulatedKey(code, true);
    setTimeout(() => {
      this.dispatchSimulatedKey(code, false);
    }, 120);
  }

  private unlockAudio(): void {
    if (typeof window === 'undefined') return;
    try {
      const w = window as any;
      if (w.audioContext && typeof w.audioContext.resume === 'function' && w.audioContext.state === 'suspended') {
        w.audioContext.resume();
      }
      if (w.synthEngine && typeof w.synthEngine.resumeAudio === 'function') {
        w.synthEngine.resumeAudio();
      }
    } catch {}
  }
}

// Global Singleton Instance & Auto-Initialization
export let touchControls: TouchControls | null = null;

if (typeof window !== 'undefined') {
  touchControls = new TouchControls();
  (window as any).touchControls = touchControls;

  // Continuously update touch steering rate smoothing on animation frames
  let lastTime = performance.now();
  const tickTouchLoop = (now: number) => {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    if (touchControls) {
      touchControls.update(dt);
    }
    requestAnimationFrame(tickTouchLoop);
  };
  requestAnimationFrame(tickTouchLoop);
}
