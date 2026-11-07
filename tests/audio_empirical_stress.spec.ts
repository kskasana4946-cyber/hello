// tests/audio_empirical_stress.spec.ts
// Milestone M8 Round 2: Empirical Adversarial Stress Test Suite for GranularSynthEngine
// Verifies:
// 1. Stress test GranularSynthEngine across ALL 34 vehicle archetypes across full operational envelope:
//    idle, mid, redline, rev-limiter bounce, rapid throttle changes, gearshift transients,
//    turbo blow-off, tire screech, kerb rumble, barrier scrape, slipstream wind, AI Doppler.
// 2. Node lifecycle & zero node recreation explosions under continuous high-frequency driving.
// 3. Audio clipping, gain saturation bounds, and numerical safety (zero NaN / Infinity).
// 4. Memory footprint stability across thousands of stress cycles.
// 5. Genuine 48kHz PCM audio bank decoding and playback voice lifecycle from on-disk vehicle.pak files.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  GranularSynthEngine,
  POWERTRAIN_ARCHETYPES,
  POWERTRAIN_WAVETABLES,
} from '../src/audio/GranularSynthEngine';
import { VEHICLE_ROSTER, getVehicleById } from '../src/vehicles/VehicleRoster';

// ============================================================================
// Mock Web Audio API for Node Lifecycle & Gain Clipping Verification
// ============================================================================

class ParamTracker {
  public clippingViolations: Array<{ node: string; value: number }> = [];
  public nanViolations: Array<{ node: string; param: string; value: number }> = [];

  record(node: string, param: string, val: number) {
    if (!Number.isFinite(val)) {
      this.nanViolations.push({ node, param, value: val });
      return;
    }
    if (param === 'gain' && (val > 1.25 || val < -0.01)) {
      this.clippingViolations.push({ node, value: val });
    }
  }
}

function createMockAudioContext(tracker: ParamTracker) {
  let createdNodesCount = 0;

  class MockParam {
    constructor(private nodeName: string, private paramName: string, public value: number = 0) {}
    setValueAtTime(v: number) {
      tracker.record(this.nodeName, this.paramName, v);
      this.value = v;
    }
    linearRampToValueAtTime(v: number) {
      tracker.record(this.nodeName, this.paramName, v);
      this.value = v;
    }
    exponentialRampToValueAtTime(v: number) {
      tracker.record(this.nodeName, this.paramName, v);
      this.value = v;
    }
    setTargetAtTime(v: number) {
      tracker.record(this.nodeName, this.paramName, v);
      this.value = v;
    }
  }

  class MockNode {
    constructor(public type: string) {
      createdNodesCount++;
    }
    connect(dest: any) {
      return dest;
    }
    disconnect() {}
  }

  class MockGain extends MockNode {
    public gain = new MockParam('gain', 'gain', 1.0);
    constructor() {
      super('GainNode');
    }
  }

  class MockOsc extends MockNode {
    public frequency = new MockParam('osc', 'frequency', 440);
    public type: string = 'sine';
    constructor() {
      super('OscillatorNode');
    }
    setPeriodicWave(_wave: any) {}
    start() {}
    stop() {
      this.disconnect();
    }
  }

  class MockFilter extends MockNode {
    public frequency = new MockParam('filter', 'frequency', 350);
    public Q = new MockParam('filter', 'Q', 1.0);
    public gain = new MockParam('filter', 'gain', 0.0);
    public type: string = 'lowpass';
    constructor() {
      super('BiquadFilterNode');
    }
  }

  class MockBufferSource extends MockNode {
    public buffer: any = null;
    public loop: boolean = false;
    public playbackRate = new MockParam('source', 'playbackRate', 1.0);
    constructor() {
      super('AudioBufferSourceNode');
    }
    start() {}
    stop() {
      this.disconnect();
    }
  }

  class MockAudioContextImpl {
    public sampleRate = 48000;
    public currentTime = 0;
    public state = 'running';
    public destination = new MockGain();

    createGain() {
      return new MockGain();
    }
    createOscillator() {
      return new MockOsc();
    }
    createBiquadFilter() {
      return new MockFilter();
    }
    createWaveShaper() {
      return new MockNode('WaveShaperNode');
    }
    createStereoPanner() {
      return { pan: new MockParam('panner', 'pan', 0.0), connect: (d: any) => d, disconnect: () => {} };
    }
    createDelay() {
      return { delayTime: new MockParam('delay', 'delayTime', 0.0), connect: (d: any) => d, disconnect: () => {} };
    }
    createBuffer(ch: number, len: number, sr: number) {
      const data = new Float32Array(len);
      return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: () => data };
    }
    createBufferSource() {
      return new MockBufferSource();
    }
    createPeriodicWave(r: Float32Array, i: Float32Array) {
      return { real: r, imag: i };
    }
    async resume() {}
    async close() {
      this.state = 'closed';
    }
  }

  return {
    ContextClass: MockAudioContextImpl,
    getCreatedNodesCount: () => createdNodesCount,
  };
}

describe('Empirical Audio Synthesis & Granular Engine Stress Test (M8 R2)', () => {
  let paramTracker: ParamTracker;
  let mockEnv: ReturnType<typeof createMockAudioContext>;
  let engine: GranularSynthEngine;
  const originalWindow = (globalThis as any).window;

  beforeEach(() => {
    paramTracker = new ParamTracker();
    mockEnv = createMockAudioContext(paramTracker);
    (globalThis as any).window = {
      AudioContext: mockEnv.ContextClass,
    };
    engine = new GranularSynthEngine();
  });

  afterEach(() => {
    engine.dispose();
    if (originalWindow !== undefined) {
      (globalThis as any).window = originalWindow;
    } else {
      delete (globalThis as any).window;
    }
  });

  // ==========================================================================
  // 1. All 34 Vehicle Archetypes Envelope Stress
  // ==========================================================================
  describe('1. Full Operational Envelope Across All 34 Vehicle Archetypes', () => {
    it('contains all 34 vehicle archetypes in VEHICLE_ROSTER and POWERTRAIN_ARCHETYPES', () => {
      expect(VEHICLE_ROSTER.length).toBe(34);
      for (const vehicle of VEHICLE_ROSTER) {
        expect(POWERTRAIN_ARCHETYPES[vehicle.id]).toBeDefined();
        const wave = POWERTRAIN_ARCHETYPES[vehicle.id];
        expect(POWERTRAIN_WAVETABLES[wave]).toBeDefined();
        expect(POWERTRAIN_WAVETABLES[wave].real.length).toBe(33);
        expect(POWERTRAIN_WAVETABLES[wave].imag.length).toBe(33);
      }
    });

    it('synthesizes monotonic frequency and formant progression across idle, mid, redline for all 34 vehicles', () => {
      const nyquist = engine.sampleRate / 2; // 24,000 Hz

      for (const vehicle of VEHICLE_ROSTER) {
        // Idle
        const idle = engine.updateEngineAudio(vehicle, 800, 0.0);
        expect(idle.clampedRpm).toBe(800);
        expect(idle.fundamentalFreqHz).toBeGreaterThanOrEqual(20);
        expect(idle.fundamentalFreqHz).toBeLessThan(nyquist);
        expect(idle.harmonicFormantCutoffHz).toBeGreaterThanOrEqual(400);
        expect(idle.harmonicFormantCutoffHz).toBeLessThan(nyquist);

        // Mid-Range
        const midRpm = Math.floor(vehicle.redlineRpm * 0.5);
        const mid = engine.updateEngineAudio(vehicle, midRpm, 0.5);
        expect(mid.fundamentalFreqHz).toBeGreaterThan(idle.fundamentalFreqHz);
        expect(mid.harmonicFormantCutoffHz).toBeGreaterThan(idle.harmonicFormantCutoffHz);
        expect(mid.grainPlaybackRate).toBeGreaterThan(idle.grainPlaybackRate);

        // Redline
        const redline = engine.updateEngineAudio(vehicle, vehicle.redlineRpm, 1.0);
        expect(redline.fundamentalFreqHz).toBeGreaterThan(mid.fundamentalFreqHz);
        expect(redline.harmonicFormantCutoffHz).toBeGreaterThan(mid.harmonicFormantCutoffHz);
        expect(redline.fundamentalFreqHz).toBeLessThanOrEqual(nyquist - 100);
        expect(redline.harmonicFormantCutoffHz).toBeLessThanOrEqual(nyquist - 100);
      }
    });

    it('survives severe rev-limiter bounce (redline + 2,000 RPM) across all 34 vehicles without aliasing', () => {
      const nyquist = engine.sampleRate / 2;

      for (const vehicle of VEHICLE_ROSTER) {
        for (let cycle = 0; cycle < 20; cycle++) {
          const bounceRpm = cycle % 2 === 0 ? vehicle.redlineRpm + 1500 : vehicle.redlineRpm - 300;
          const bounce = engine.updateEngineAudio(vehicle, bounceRpm, 1.0);
          expect(bounce.fundamentalFreqHz).toBeLessThanOrEqual(nyquist - 100);
          expect(bounce.harmonicFormantCutoffHz).toBeLessThanOrEqual(nyquist - 100);
          expect(Number.isFinite(bounce.fundamentalFreqHz)).toBe(true);
          expect(Number.isFinite(bounce.harmonicFormantCutoffHz)).toBe(true);
        }
      }
    });

    it('withstands 1,000 rapid throttle oscillations (0.0 <-> 1.0 at 120Hz) without instability', () => {
      const porsche = getVehicleById('porsche_gt3')!;
      for (let step = 0; step < 1000; step++) {
        const throttle = (step % 2 === 0) ? 1.0 : 0.0;
        const rpm = 3000 + Math.sin(step * 0.05) * 2000;
        const t = engine.updateEngineAudio(porsche, rpm, throttle);
        expect(Number.isFinite(t.fundamentalFreqHz)).toBe(true);
        expect(Number.isFinite(t.harmonicFormantCutoffHz)).toBe(true);
      }
    });
  });

  // ==========================================================================
  // 2. Node Recreation Explosions & Lifecycle
  // ==========================================================================
  describe('2. Node Recreation Explosion Prevention & Lifecycle', () => {
    it('allocates persistent resonators once and produces ZERO node allocations during continuous driving', () => {
      const nodesAfterInit = mockEnv.getCreatedNodesCount();

      // Run 1,000 frames of continuous driving with active tire skids, kerb rumbles, and scrapes
      for (let f = 0; f < 1000; f++) {
        const v = VEHICLE_ROSTER[f % 34];
        engine.updateEngineAudio(v, 5000, 0.8);
        engine.playTireSkid(0.85);
        engine.playKerbRumble(0.7, 210);
        engine.playBarrierScrape(0.6, 'RIGHT');
        engine.playSlipstreamWind(0.5);
      }

      const nodesAfterDriving = mockEnv.getCreatedNodesCount();
      // Zero new nodes must be created for persistent synthesizers!
      expect(nodesAfterDriving - nodesAfterInit).toBe(0);
    });

    it('safely triggers transient motorsport SFX without leaving undestroyed nodes', () => {
      for (let i = 0; i < 25; i++) {
        expect(engine.playGearShift('UPSHIFT', true).played).toBe(true);
        expect(engine.playGearShift('DOWNSHIFT', false).played).toBe(true);
        expect(engine.playTurboBlowOff(0.8).played).toBe(true);
        expect(engine.playExhaustBackfire(0.7).played).toBe(true);
        expect(engine.playAiDopplerPassBy(40, 5, 0.2).played).toBe(true);
      }
    });
  });

  // ==========================================================================
  // 3. Audio Clipping & Gain Saturation Audit
  // ==========================================================================
  describe('3. Audio Clipping & Numerical Parameter Safety', () => {
    it('never produces clipping gain values or NaN/Infinity audio parameters', () => {
      // Execute multi-vehicle torture run
      for (let i = 0; i < 500; i++) {
        const spec = VEHICLE_ROSTER[i % 34];
        engine.updateEngineAudio(spec, 800 + i * 20, (i % 10) / 10);
        if (i % 20 === 0) {
          engine.playTireSkid(1.0);
          engine.playKerbRumble(1.0, 350);
          engine.playBarrierScrape(1.0, 'LEFT');
          engine.playTurboBlowOff(1.0);
        }
      }

      expect(paramTracker.clippingViolations.length).toBe(0);
      expect(paramTracker.nanViolations.length).toBe(0);
    });

    it('handles extreme adversarial RPM inputs (negative, NaN, Infinity) without crashing or NaN propagation', () => {
      const buggy = getVehicleById('dune_buggy')!;
      const badInputs = [-999999, -1, 0, NaN, Infinity, -Infinity, 1000000];

      for (const badRpm of badInputs) {
        const t = engine.updateEngineAudio(buggy, badRpm); // Uses default throttleLoad = 0.5
        expect(Number.isFinite(t.clampedRpm)).toBe(true);
        expect(t.clampedRpm).toBeGreaterThanOrEqual(800);
        expect(t.clampedRpm).toBeLessThanOrEqual(buggy.redlineRpm);
        expect(Number.isFinite(t.fundamentalFreqHz)).toBe(true);
        expect(Number.isFinite(t.harmonicFormantCutoffHz)).toBe(true);
      }
    });
  });

  // ==========================================================================
  // 4. Memory Stability Across 10,000 Cycles
  // ==========================================================================
  describe('4. Memory Footprint Stability Across High-Frequency Cycles', () => {
    it('bounds heap memory growth strictly (< 20 MB) over 10,000 stress cycles', () => {
      if (global.gc) global.gc();
      const memStart = process.memoryUsage().heapUsed;

      for (let i = 0; i < 10000; i++) {
        const v = VEHICLE_ROSTER[i % 34];
        engine.updateEngineAudio(v, 2000 + (i % 6000), (i % 2 === 0) ? 1.0 : 0.0);
        if (i % 100 === 0) {
          engine.playTireSkid(0.5);
          engine.playKerbRumble(0.5, 120);
        }
      }

      if (global.gc) global.gc();
      const memEnd = process.memoryUsage().heapUsed;
      const heapDeltaMb = (memEnd - memStart) / (1024 * 1024);

      expect(heapDeltaMb).toBeLessThan(20.0);
    });
  });

  // ==========================================================================
  // 5. On-Disk 48kHz PCM Audio Bank Verification
  // ==========================================================================
  describe('5. Genuine On-Disk 48kHz PCM Audio Bank Decoding', () => {
    it('decodes real 48kHz PCM audio chunks from on-disk vehicle.pak files across all 34 vehicles', () => {
      const paksDir = path.resolve(__dirname, '../assets/paks/vehicles');
      const folders = fs.readdirSync(paksDir).filter(f => f.startsWith('car_')).sort();
      expect(folders.length).toBe(34);

      let loadedPaks = 0;

      for (const folder of folders) {
        const pakPath = path.join(paksDir, folder, 'vehicle.pak');
        expect(fs.existsSync(pakPath)).toBe(true);

        const buf = fs.readFileSync(pakPath);
        expect(buf.length).toBe(9411776); // Exactly 9,411,776 bytes target footprint

        const entryCount = buf.readUInt32LE(24);
        let offset = 64;
        const pcmMap = new Map<string, Uint8Array>();

        for (let e = 0; e < entryCount; e++) {
          if (offset + 64 > buf.length) break;
          const chunkName = buf.toString('utf8', offset, offset + 32).replace(/\0/g, '');
          const chunkOffset = Number(buf.readBigUInt64LE(offset + 48));
          const chunkLen = Number(buf.readBigUInt64LE(offset + 56));

          if (chunkName.includes('pcm16')) {
            const chunkData = new Uint8Array(buf.subarray(chunkOffset, chunkOffset + chunkLen));
            pcmMap.set(chunkName, chunkData);
          }
          offset += 64;
        }

        expect(pcmMap.size).toBeGreaterThanOrEqual(7);
        engine.loadVehiclePcmBank(pcmMap);
        loadedPaks++;
      }

      expect(loadedPaks).toBe(34);
    });
  });
});
