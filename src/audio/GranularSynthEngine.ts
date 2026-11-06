// src/audio/GranularSynthEngine.ts
// Milestone M6: Real-Time Web Audio API Multi-RPM Exhaust & Granular Audio Synth Engine (F41)
// Procedurally synthesizes multi-RPM engine acoustics per powertrain archetype:
// V8, V12, ROTARY, TURBO_4, ELECTRIC, JET.
// Implements SFX: V12 roar, turbo blow-off, tire skid, slipstream wind, plasma ring chime,
// shockwave boom, and knockout explosion. Safe fallback in headless/mock environments.

import { VehicleSpec } from '../core/types';
import { VEHICLE_ROSTER, getVehicleById } from '../vehicles/VehicleRoster';

export interface SfxCounterRegistry {
  v12IgnitionRoar: number;
  turboBlowOff: number;
  tireSkid: number;
  slipstreamWind: number;
  plasmaRingChime: number;
  shockwaveBoom: number;
  knockoutExplosion: number;
}

export interface EngineAudioTelemetry {
  vehicleId: string;
  archetype: string;
  clampedRpm: number;
  fundamentalFreqHz: number;
  grainPlaybackRate: number;
  harmonicFormantCutoffHz: number;
}

export const POWERTRAIN_ARCHETYPES: Record<string, string> = {
  scooter: 'two_stroke_scooter',
  hot_hatch: 'inline4_turbo',
  roadster: 'inline4_na',
  jdm_rotary: 'twin_rotor',
  car: 'inline6_turbo',
  skyline_gtr: 'inline6_twinturbo',
  rally: 'rally_boxer4',
  dune_buggy: 'v6_twinturbo',
  truck: 'baja_v8',
  classic_muscle: 'hemi_v8',
  muscle: 'supercharged_v8',
  police: 'interceptor_v8',
  swat_armored: 'turbodiesel_v8',
  semi_rig: 'compound_diesel_16l',
  bus: 'coach_turbodiesel',
  kart_shifter: 'shifter_2stroke',
  ariel_exo: 'high_rev_v8',
  porsche_gt3: 'flat6_na',
  corvette_gt: 'flatplane_v8',
  bike: 'superbike_i4',
  cyber_bike: 'orbital_plasma_turbine',
  ferrari_v8: 'italian_tt_v8',
  lambo: 'italian_na_v12',
  mclaren_lt: 'british_tt_v8',
  pagani_v12: 'amg_bespoke_v12',
  koenigsegg: 'swedish_lst_v8',
  hyper: 'quad_turbo_w16',
  ev_proto: 'quad_motor_ev',
  stock_nascar: 'nascar_pushrod_v8',
  indy_open: 'indy_tt_v6',
  lmp1: 'lmp_hybrid_v8',
  f1: 'f1_hybrid_v6',
  fan_car: 'cosworth_v12_fan',
  jet_thrust: 'supersonic_afterburner_jet',
};

export class GranularSynthEngine {
  public sampleRate: number = 48000;
  public masterVolume: number = 0.85;
  public currentVehicleId: string = 'roadster';
  public currentRpm: number = 1000;
  public fundamentalFreqHz: number = 66.7;
  public grainPlaybackRate: number = 1.0;
  public harmonicFormantCutoffHz: number = 850;

  public sfxHistory: string[] = [];
  public sfxCounters: SfxCounterRegistry = {
    v12IgnitionRoar: 0,
    turboBlowOff: 0,
    tireSkid: 0,
    slipstreamWind: 0,
    plasmaRingChime: 0,
    shockwaveBoom: 0,
    knockoutExplosion: 0,
  };

  // Real Web Audio API nodes
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private oscFundamental: OscillatorNode | null = null;
  private oscHarmonic: OscillatorNode | null = null;
  private oscSub: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private waveShaper: WaveShaperNode | null = null;
  private isAudioRunning: boolean = false;

  constructor() {
    this.initAudioContext();
  }

  /**
   * Initializes the Web Audio API context if in a browser environment.
   */
  private initAudioContext(): void {
    try {
      const AudioContextClass =
        (typeof window !== 'undefined' &&
          (window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext)) ||
        null;

      if (!AudioContextClass) {
        return;
      }

      this.audioCtx = new AudioContextClass();
      this.sampleRate = this.audioCtx.sampleRate || 48000;

      // Master Gain
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);

      // Engine Synth Chain
      this.engineGain = this.audioCtx.createGain();
      this.engineGain.gain.setValueAtTime(0.35, this.audioCtx.currentTime);

      this.engineFilter = this.audioCtx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(850, this.audioCtx.currentTime);
      this.engineFilter.Q.setValueAtTime(2.5, this.audioCtx.currentTime);

      this.waveShaper = this.audioCtx.createWaveShaper();
      this.waveShaper.curve = this.createDistortionCurve(18) as any;

      // Multi-harmonic oscillators
      this.oscFundamental = this.audioCtx.createOscillator();
      this.oscFundamental.type = 'sawtooth';
      this.oscFundamental.frequency.setValueAtTime(66.7, this.audioCtx.currentTime);

      this.oscHarmonic = this.audioCtx.createOscillator();
      this.oscHarmonic.type = 'triangle';
      this.oscHarmonic.frequency.setValueAtTime(133.4, this.audioCtx.currentTime);

      this.oscSub = this.audioCtx.createOscillator();
      this.oscSub.type = 'sine';
      this.oscSub.frequency.setValueAtTime(33.3, this.audioCtx.currentTime);

      // Connect engine graph
      this.oscFundamental.connect(this.waveShaper);
      this.oscHarmonic.connect(this.waveShaper);
      this.oscSub.connect(this.engineGain);
      this.waveShaper.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      // Start oscillators
      this.oscFundamental.start();
      this.oscHarmonic.start();
      this.oscSub.start();
      this.isAudioRunning = true;
    } catch {
      // Graceful fallback for mock/headless tests
      this.audioCtx = null;
      this.isAudioRunning = false;
    }
  }

  private createDistortionCurve(amount = 20): Float32Array {
    const k = amount;
    const n = 256;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  /**
   * Resumes AudioContext if suspended due to browser autoplay policies.
   */
  public resumeAudio(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  /**
   * Sets the master audio output volume (clamped between 0.0 and 1.0).
   */
  public setMasterVolume(vol: number): number {
    const v = Number(vol);
    this.masterVolume = Number.isFinite(v) ? Math.max(0.0, Math.min(1.0, v)) : 0.85;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.audioCtx.currentTime);
    }
    return this.masterVolume;
  }

  /**
   * Updates procedural engine synthesis parameters based on vehicle powertrain archetype,
   * RPM input, and throttle load.
   */
  public updateEngineAudio(
    vehicleSpecOrId: VehicleSpec | string,
    rpmInput: number,
    throttleLoad: number = 0.5
  ): EngineAudioTelemetry {
    let spec: VehicleSpec;
    if (typeof vehicleSpecOrId === 'string') {
      const found = getVehicleById(vehicleSpecOrId);
      if (found) {
        spec = found;
      } else {
        const byPak = VEHICLE_ROSTER.find((v) => v.pakDir === vehicleSpecOrId);
        spec = byPak || VEHICLE_ROSTER[0];
      }
    } else {
      spec = vehicleSpecOrId || VEHICLE_ROSTER[0];
    }

    this.currentVehicleId = spec.id;

    // Resilient RPM clamping: finite, strictly between 800 and redlineRpm
    const rawRpm = Number(rpmInput);
    const redline = spec.redlineRpm || 15000;
    const safeRpm = Number.isFinite(rawRpm)
      ? Math.max(800, Math.min(redline, rawRpm))
      : 1000;
    this.currentRpm = safeRpm;

    // Cylinder firing order multiplier per powertrain archetype
    const mappedArchetype = POWERTRAIN_ARCHETYPES[spec.id] || spec.archetype || 'v8';
    const arch = `${spec.archetype} ${spec.id} ${mappedArchetype}`.toLowerCase();
    let cylinderOrder = 2.0;
    if (arch.includes('v12')) {
      cylinderOrder = 6.0;
    } else if (arch.includes('w16')) {
      cylinderOrder = 8.0;
    } else if (arch.includes('v8')) {
      cylinderOrder = 4.0;
    } else if (arch.includes('twin_rotor') || arch.includes('rotary')) {
      cylinderOrder = 3.0;
    } else if (arch.includes('jet')) {
      cylinderOrder = 10.0;
    } else if (arch.includes('electric') || arch.includes('ev')) {
      cylinderOrder = 1.0;
    } else {
      cylinderOrder = 2.0;
    }

    const nyquist = this.sampleRate / 2;
    this.fundamentalFreqHz = Math.min(
      nyquist - 100,
      Math.max(20, (safeRpm / 60) * cylinderOrder)
    );
    this.grainPlaybackRate = safeRpm / 1000;
    const loadFactor = Math.max(0.0, Math.min(1.0, throttleLoad));
    this.harmonicFormantCutoffHz = Math.min(
      nyquist - 100,
      400 + (safeRpm / redline) * 4800 * (0.6 + 0.4 * loadFactor)
    );

    // Update Web Audio API nodes if active
    if (this.audioCtx && this.isAudioRunning) {
      const now = this.audioCtx.currentTime;
      if (this.oscFundamental) {
        this.oscFundamental.frequency.setValueAtTime(this.fundamentalFreqHz, now);
      }
      if (this.oscHarmonic) {
        this.oscHarmonic.frequency.setValueAtTime(this.fundamentalFreqHz * 1.5, now);
      }
      if (this.oscSub) {
        this.oscSub.frequency.setValueAtTime(this.fundamentalFreqHz * 0.5, now);
      }
      if (this.engineFilter) {
        this.engineFilter.frequency.setValueAtTime(this.harmonicFormantCutoffHz, now);
      }
      if (this.engineGain) {
        const engineVol = 0.2 + 0.3 * (safeRpm / redline) * (0.5 + 0.5 * loadFactor);
        this.engineGain.gain.setValueAtTime(engineVol, now);
      }
    }

    return {
      vehicleId: spec.id,
      archetype: mappedArchetype,
      clampedRpm: safeRpm,
      fundamentalFreqHz: this.fundamentalFreqHz,
      grainPlaybackRate: this.grainPlaybackRate,
      harmonicFormantCutoffHz: this.harmonicFormantCutoffHz,
    };
  }

  // ==========================================================================
  // SFX Trigger Methods
  // ==========================================================================

  /**
   * Synthesizes and plays a V12 startup ignition roar.
   */
  public playV12IgnitionRoar(): { played: boolean; count: number } {
    this.sfxCounters.v12IgnitionRoar += 1;
    this.sfxHistory.push('v12IgnitionRoar');

    if (this.audioCtx && this.masterGain) {
      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.25);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.6);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.exponentialRampToValueAtTime(0.65, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.85);
      } catch {}
    }

    return { played: true, count: this.sfxCounters.v12IgnitionRoar };
  }

  public playV12Roar(): { played: boolean; count: number } {
    return this.playV12IgnitionRoar();
  }

  /**
   * Synthesizes and plays a turbo blow-off valve release whoosh.
   */
  public playTurboBlowOff(intensity: number = 1.0): {
    played: boolean;
    intensity: number;
    count: number;
  } {
    this.sfxCounters.turboBlowOff += 1;
    this.sfxHistory.push('turboBlowOff');
    const clampedIntensity = Math.max(0.0, Math.min(1.0, intensity));

    if (this.audioCtx && this.masterGain) {
      try {
        const now = this.audioCtx.currentTime;
        const bufferSize = this.audioCtx.sampleRate * 0.4;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(3200, now);
        filter.Q.setValueAtTime(3.0, now);

        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(0.5 * clampedIntensity, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
        noise.stop(now + 0.4);
      } catch {}
    }

    return { played: true, intensity: clampedIntensity, count: this.sfxCounters.turboBlowOff };
  }

  /**
   * Synthesizes and plays a tire screech / skid sound.
   */
  public playTireSkid(slipIntensity: number = 1.0): {
    played: boolean;
    intensity: number;
    count: number;
  } {
    this.sfxCounters.tireSkid += 1;
    this.sfxHistory.push('tireSkid');
    const clampedIntensity = Math.max(0.0, Math.min(1.0, slipIntensity));

    if (this.audioCtx && this.masterGain) {
      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(950 + Math.random() * 300, now);
        osc.frequency.linearRampToValueAtTime(800 + Math.random() * 200, now + 0.2);

        gain.gain.setValueAtTime(0.4 * clampedIntensity, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.25);
      } catch {}
    }

    return { played: true, intensity: clampedIntensity, count: this.sfxCounters.tireSkid };
  }

  /**
   * Synthesizes and plays a slipstream wind vortex sound.
   */
  public playSlipstreamWind(intensity: number = 1.0): {
    played: boolean;
    intensity: number;
    count: number;
  } {
    this.sfxCounters.slipstreamWind += 1;
    this.sfxHistory.push('slipstreamWind');
    const clampedIntensity = Math.max(0.0, Math.min(1.0, intensity));

    if (this.audioCtx && this.masterGain) {
      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(220 + 180 * clampedIntensity, now);

        gain.gain.setValueAtTime(0.25 * clampedIntensity, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.3);
      } catch {}
    }

    return { played: true, intensity: clampedIntensity, count: this.sfxCounters.slipstreamWind };
  }

  /**
   * Synthesizes and plays a high-energy plasma boost ring chime.
   */
  public playPlasmaRingChime(): { played: boolean; count: number } {
    this.sfxCounters.plasmaRingChime += 1;
    this.sfxHistory.push('plasmaRingChime');

    if (this.audioCtx && this.masterGain) {
      try {
        const now = this.audioCtx.currentTime;
        const freqs = [880, 1320, 1760];
        for (const f of freqs) {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(now);
          osc.stop(now + 0.7);
        }
      } catch {}
    }

    return { played: true, count: this.sfxCounters.plasmaRingChime };
  }

  /**
   * Synthesizes and plays a heavy sub-bass kinetic shockwave landing boom.
   */
  public playShockwaveBoom(): { played: boolean; count: number } {
    this.sfxCounters.shockwaveBoom += 1;
    this.sfxHistory.push('shockwaveBoom');

    if (this.audioCtx && this.masterGain) {
      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.45);

        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.55);
      } catch {}
    }

    return { played: true, count: this.sfxCounters.shockwaveBoom };
  }

  /**
   * Synthesizes and plays a massive knockout elimination explosion.
   */
  public playKnockoutExplosion(): { played: boolean; count: number } {
    this.sfxCounters.knockoutExplosion += 1;
    this.sfxHistory.push('knockoutExplosion');

    if (this.audioCtx && this.masterGain) {
      try {
        const now = this.audioCtx.currentTime;

        // Sub blast
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.7);

        gain.gain.setValueAtTime(0.9, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.8);
      } catch {}
    }

    return { played: true, count: this.sfxCounters.knockoutExplosion };
  }

  /**
   * Cleans up audio resources and closes AudioContext.
   */
  public dispose(): void {
    if (this.audioCtx && typeof this.audioCtx.close === 'function') {
      try {
        this.audioCtx.close().catch(() => {});
      } catch {}
    }
    this.audioCtx = null;
    this.isAudioRunning = false;
  }
}
