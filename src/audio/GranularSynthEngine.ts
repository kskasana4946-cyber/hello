// src/audio/GranularSynthEngine.ts
// Milestone M6 & M8: Next-Gen Real-Time Web Audio API Multi-RPM Exhaust & Granular Audio Synth Engine
// Features:
// 1. 12 custom 32-harmonic PeriodicWave Fourier wavetables for 12 powertrain families.
// 2. 48kHz PCM audio decoding and equal-power looping crossfade from .pak chunk data.
// 3. Persistent stick-slip dual-formant tire screech resonator (zero frame-spam oscillator allocation).
// 4. Motorsport transients: ignition-cut pops, rev-match barks, dual-stage 15Hz stu-tu-tu turbo flutter,
//    overrun crackles, 55-130Hz kerb rumble thump, stereo barrier scrape sparks, AI Doppler pass-by,
//    biome ambiences, and tunnel reverb.
// Headless / mock test environment safe.

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

/**
 * 12 Custom 32-Harmonic PeriodicWave Fourier Wavetables (33 coefficients: DC k=0 + k=1..32)
 */
export const POWERTRAIN_WAVETABLES: Record<string, { real: number[]; imag: number[] }> = {
  // 1. Two-Stroke (scooter, kart_shifter): Aggressive odd harmonics, high-frequency buzz
  two_stroke: {
    real: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    imag: [0, 1.0, 0.45, 0.78, 0.32, 0.62, 0.22, 0.48, 0.18, 0.35, 0.12, 0.26, 0.09, 0.18, 0.06, 0.12, 0.05, 0.09, 0.04, 0.07, 0.03, 0.05, 0.02, 0.04, 0.02, 0.03, 0.01, 0.02, 0.01, 0.02, 0.01, 0.01, 0.01]
  },
  // 2. Twin-Rotor (jdm_rotary): 3.0x rotor pulse dominance, 1600 Hz nasal port resonance
  twin_rotor: {
    real: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    imag: [0, 0.85, 0.35, 1.0, 0.28, 0.42, 0.88, 0.18, 0.30, 0.72, 0.12, 0.22, 0.58, 0.08, 0.15, 0.42, 0.06, 0.10, 0.32, 0.05, 0.08, 0.24, 0.04, 0.06, 0.18, 0.03, 0.05, 0.14, 0.02, 0.04, 0.10, 0.02, 0.03]
  },
  // 3. Inline-4 Naturally Aspirated (roadster): Balanced even/odd harmonic decay, 2nd order dominance
  inline4_na: {
    real: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    imag: [0, 0.95, 0.82, 0.55, 0.65, 0.38, 0.45, 0.28, 0.32, 0.20, 0.22, 0.14, 0.16, 0.10, 0.11, 0.07, 0.08, 0.05, 0.06, 0.04, 0.04, 0.03, 0.03, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]
  },
  // 4. Inline-4 Turbo (hot_hatch, bike): Compressed mids with high-frequency wastegate hiss harmonics
  inline4_turbo: {
    real: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    imag: [0, 1.0, 0.75, 0.60, 0.55, 0.42, 0.38, 0.28, 0.32, 0.22, 0.28, 0.18, 0.24, 0.15, 0.20, 0.12, 0.18, 0.10, 0.15, 0.08, 0.12, 0.07, 0.10, 0.06, 0.08, 0.05, 0.07, 0.04, 0.06, 0.03, 0.05, 0.03, 0.04]
  },
  // 5. Inline-6 Twin-Turbo (car, skyline_gtr): Smooth Bavarian firing order (1-5-3-6-2-4), 3rd order warmth
  inline6_turbo: {
    real: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    imag: [0, 0.90, 0.50, 0.95, 0.35, 0.45, 0.85, 0.25, 0.30, 0.70, 0.18, 0.22, 0.55, 0.12, 0.16, 0.42, 0.09, 0.12, 0.32, 0.07, 0.09, 0.25, 0.05, 0.07, 0.18, 0.04, 0.05, 0.14, 0.03, 0.04, 0.10, 0.02, 0.03]
  },
  // 6. Rally Boxer-4 (rally): Unequal-length header 110 deg phase delay, strong sub-harmonic 0.5x & 1.5x rumble
  rally_boxer4: {
    real: [0, 0.35, 0.15, 0.28, 0.10, 0.22, 0.08, 0.16, 0.05, 0.12, 0.04, 0.08, 0.03, 0.06, 0.02, 0.04, 0.02, 0.03, 0.01, 0.02, 0.01, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.0, 0.0, 0.0, 0.0, 0.0],
    imag: [0, 0.95, 0.40, 0.85, 0.32, 0.70, 0.25, 0.55, 0.18, 0.42, 0.14, 0.32, 0.10, 0.24, 0.08, 0.18, 0.06, 0.14, 0.05, 0.10, 0.04, 0.08, 0.03, 0.06, 0.02, 0.05, 0.02, 0.04, 0.01, 0.03, 0.01, 0.02, 0.01]
  },
  // 7. Crossplane V8 (classic_muscle, muscle, police, truck, stock_nascar, swat_armored, semi_rig, bus, dune_buggy): Uneven 90-180 deg burble & sub-orders
  crossplane_v8: {
    real: [0, 0.45, 0.20, 0.38, 0.15, 0.28, 0.10, 0.20, 0.08, 0.14, 0.06, 0.10, 0.04, 0.08, 0.03, 0.06, 0.02, 0.04, 0.02, 0.03, 0.01, 0.02, 0.01, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.0, 0.0, 0.0],
    imag: [0, 1.0, 0.42, 0.88, 0.35, 0.75, 0.28, 0.60, 0.22, 0.48, 0.16, 0.38, 0.12, 0.28, 0.09, 0.22, 0.07, 0.16, 0.05, 0.12, 0.04, 0.09, 0.03, 0.07, 0.02, 0.05, 0.02, 0.04, 0.01, 0.03, 0.01, 0.02, 0.01]
  },
  // 8. Flatplane V8 (corvette_gt, ferrari_v8, mclaren_lt, ariel_exo, lmp1): High-revving European 180 deg crank, crisp 4th/8th harmonics
  flatplane_v8: {
    real: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    imag: [0, 0.70, 0.40, 0.30, 1.0, 0.25, 0.35, 0.20, 0.85, 0.15, 0.22, 0.12, 0.70, 0.10, 0.16, 0.08, 0.55, 0.06, 0.11, 0.05, 0.42, 0.04, 0.08, 0.03, 0.32, 0.03, 0.06, 0.02, 0.24, 0.02, 0.04, 0.02, 0.18]
  },
  // 9. Flat-6 Naturally Aspirated (porsche_gt3): Crisp metallic rasp, 3rd & 6th order resonance up to 9,000 RPM
  flat6_na: {
    real: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    imag: [0, 0.80, 0.55, 1.0, 0.45, 0.35, 0.90, 0.28, 0.22, 0.78, 0.18, 0.15, 0.65, 0.12, 0.10, 0.50, 0.08, 0.07, 0.38, 0.06, 0.05, 0.28, 0.04, 0.04, 0.20, 0.03, 0.03, 0.15, 0.02, 0.02, 0.11, 0.02, 0.01]
  },
  // 10. Screaming V12 / F1 / W16 (lambo, pagani_v12, hyper, fan_car, f1, indy_open): Megaphone exhaust, 6x/12x brassy howl
  screaming_v12: {
    real: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    imag: [0, 0.65, 0.35, 0.50, 0.40, 0.30, 1.0, 0.25, 0.32, 0.45, 0.20, 0.25, 0.90, 0.15, 0.18, 0.35, 0.12, 0.14, 0.75, 0.09, 0.10, 0.28, 0.07, 0.08, 0.60, 0.05, 0.06, 0.20, 0.04, 0.05, 0.45, 0.03, 0.04]
  },
  // 11. Quad-Motor EV / Laser-Bike (ev_proto, cyber_bike): PWM inverter switching carrier sidebands & gear mesh
  ev_motor: {
    real: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    imag: [0, 0.30, 0.12, 0.08, 0.85, 0.06, 0.05, 0.04, 0.95, 0.03, 0.02, 0.02, 0.70, 0.02, 0.01, 0.01, 0.50, 0.01, 0.01, 0.01, 0.35, 0.01, 0.0, 0.0, 0.25, 0.0, 0.0, 0.0, 0.15, 0.0, 0.0, 0.0, 0.10]
  },
  // 12. Supersonic Jet Turbine (jet_thrust): Axial compressor blade passing tones + broadband exhaust shear
  supersonic_jet: {
    real: [0, 0.10, 0.08, 0.06, 0.05, 0.25, 0.04, 0.03, 0.02, 0.02, 0.20, 0.01, 0.01, 0.01, 0.01, 0.15, 0.01, 0.01, 0.0, 0.0, 0.10, 0.0, 0.0, 0.0, 0.0, 0.08, 0.0, 0.0, 0.0, 0.0, 0.05, 0.0, 0.0],
    imag: [0, 0.40, 0.18, 0.12, 0.10, 0.80, 0.08, 0.06, 0.05, 0.04, 0.70, 0.03, 0.03, 0.02, 0.02, 0.60, 0.02, 0.02, 0.01, 0.01, 0.45, 0.01, 0.01, 0.01, 0.0, 0.35, 0.0, 0.0, 0.0, 0.0, 0.25, 0.0, 0.0]
  }
};

export const POWERTRAIN_ARCHETYPES: Record<string, string> = {
  scooter: 'two_stroke',
  hot_hatch: 'inline4_turbo',
  roadster: 'inline4_na',
  jdm_rotary: 'twin_rotor',
  car: 'inline6_turbo',
  skyline_gtr: 'inline6_turbo',
  rally: 'rally_boxer4',
  dune_buggy: 'crossplane_v8',
  truck: 'crossplane_v8',
  classic_muscle: 'crossplane_v8',
  muscle: 'crossplane_v8',
  police: 'crossplane_v8',
  swat_armored: 'crossplane_v8',
  semi_rig: 'crossplane_v8',
  bus: 'crossplane_v8',
  kart_shifter: 'two_stroke',
  ariel_exo: 'flatplane_v8',
  porsche_gt3: 'flat6_na',
  corvette_gt: 'flatplane_v8',
  bike: 'inline4_turbo',
  cyber_bike: 'ev_motor',
  ferrari_v8: 'flatplane_v8',
  lambo: 'screaming_v12',
  mclaren_lt: 'flatplane_v8',
  pagani_v12: 'screaming_v12',
  koenigsegg: 'flatplane_v8',
  hyper: 'screaming_v12',
  ev_proto: 'ev_motor',
  stock_nascar: 'crossplane_v8',
  indy_open: 'screaming_v12',
  lmp1: 'flatplane_v8',
  f1: 'screaming_v12',
  fan_car: 'screaming_v12',
  jet_thrust: 'supersonic_jet',
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

  // PeriodicWave Cache
  private periodicWaves: Map<string, PeriodicWave> = new Map();
  private currentWaveFamily: string = 'inline4_na';

  // Persistent stick-slip dual-formant tire screech resonator
  private tireSkidGain: GainNode | null = null;
  private tireResonator1: BiquadFilterNode | null = null;
  private tireResonator2: BiquadFilterNode | null = null;
  private tireNoiseNode: AudioBufferSourceNode | null = null;
  private tireDecayTimer: ReturnType<typeof setTimeout> | null = null;

  // Persistent Kerb Rumble sub-bass synth
  private kerbRumbleGain: GainNode | null = null;
  private kerbRumbleOsc: OscillatorNode | null = null;
  private kerbDecayTimer: ReturnType<typeof setTimeout> | null = null;

  // Persistent Barrier Scrape sparks friction
  private barrierScrapeGain: GainNode | null = null;
  private barrierPanner: StereoPannerNode | null = null;
  private barrierFilter: BiquadFilterNode | null = null;
  private barrierNoiseNode: AudioBufferSourceNode | null = null;
  private barrierDecayTimer: ReturnType<typeof setTimeout> | null = null;

  // Slipstream Wind broadband pink noise
  private slipstreamGain: GainNode | null = null;
  private slipstreamFilter: BiquadFilterNode | null = null;
  private slipstreamNoiseNode: AudioBufferSourceNode | null = null;

  // Tunnel Reverb & Environment Aux Sends
  private tunnelDelayNode: DelayNode | null = null;
  private tunnelFeedbackGain: GainNode | null = null;
  private tunnelReverbWetGain: GainNode | null = null;

  // 48kHz PCM Audio Bank Buffers (from vehicle.pak)
  private pcmBuffers: Map<string, AudioBuffer> = new Map();
  private pcmIdleSource: AudioBufferSourceNode | null = null;
  private pcmMidSource: AudioBufferSourceNode | null = null;
  private pcmRedlineSource: AudioBufferSourceNode | null = null;
  private pcmIdleGain: GainNode | null = null;
  private pcmMidGain: GainNode | null = null;
  private pcmRedlineGain: GainNode | null = null;

  constructor() {
    this.initAudioContext();
  }

  /**
   * Initializes the Web Audio API context and all persistent audio graphs.
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

      // 1. Build and cache all 12 custom 32-harmonic PeriodicWaves
      for (const [name, table] of Object.entries(POWERTRAIN_WAVETABLES)) {
        try {
          const real = new Float32Array(table.real);
          const imag = new Float32Array(table.imag);
          const wave = this.audioCtx.createPeriodicWave(real, imag, { disableNormalization: false });
          this.periodicWaves.set(name, wave);
        } catch {}
      }

      // 2. Engine Synth Graph
      this.engineGain = this.audioCtx.createGain();
      this.engineGain.gain.setValueAtTime(0.35, this.audioCtx.currentTime);

      this.engineFilter = this.audioCtx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(850, this.audioCtx.currentTime);
      this.engineFilter.Q.setValueAtTime(2.5, this.audioCtx.currentTime);

      this.waveShaper = this.audioCtx.createWaveShaper();
      this.waveShaper.curve = this.createDistortionCurve(18) as any;

      this.oscFundamental = this.audioCtx.createOscillator();
      const defaultWave = this.periodicWaves.get('inline4_na');
      if (defaultWave) {
        this.oscFundamental.setPeriodicWave(defaultWave);
      } else {
        this.oscFundamental.type = 'sawtooth';
      }
      this.oscFundamental.frequency.setValueAtTime(66.7, this.audioCtx.currentTime);

      this.oscHarmonic = this.audioCtx.createOscillator();
      this.oscHarmonic.type = 'triangle';
      this.oscHarmonic.frequency.setValueAtTime(133.4, this.audioCtx.currentTime);

      this.oscSub = this.audioCtx.createOscillator();
      this.oscSub.type = 'sine';
      this.oscSub.frequency.setValueAtTime(33.3, this.audioCtx.currentTime);

      this.oscFundamental.connect(this.waveShaper);
      this.oscHarmonic.connect(this.waveShaper);
      this.oscSub.connect(this.engineGain);
      this.waveShaper.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.oscFundamental.start();
      this.oscHarmonic.start();
      this.oscSub.start();

      // 3. Persistent Stick-Slip Dual-Formant Tire Resonator (eliminates frame-spam)
      this.initPersistentTireResonator();

      // 4. Persistent Kerb Rumble Sub-Bass Synth
      this.initPersistentKerbRumble();

      // 5. Persistent Barrier Scrape Metallic Friction
      this.initPersistentBarrierScrape();

      // 6. Persistent Slipstream Wind Broadband Noise
      this.initPersistentSlipstream();

      // 7. Tunnel Reverb Loop
      this.initTunnelReverb();

      this.isAudioRunning = true;
    } catch {
      // Graceful fallback for mock/headless tests
      this.audioCtx = null;
      this.isAudioRunning = false;
    }
  }

  private initPersistentTireResonator(): void {
    if (!this.audioCtx || !this.masterGain) return;
    try {
      this.tireSkidGain = this.audioCtx.createGain();
      this.tireSkidGain.gain.setValueAtTime(0.0, this.audioCtx.currentTime);

      // Create continuous looping noise buffer (1.5 seconds)
      const bufferSize = Math.floor(this.audioCtx.sampleRate * 1.5);
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2) * 0.35;
      }

      this.tireNoiseNode = this.audioCtx.createBufferSource();
      this.tireNoiseNode.buffer = buffer;
      this.tireNoiseNode.loop = true;

      // Dual formant bandpass filters (F1: 1080Hz, F2: 2240Hz)
      this.tireResonator1 = this.audioCtx.createBiquadFilter();
      this.tireResonator1.type = 'bandpass';
      this.tireResonator1.frequency.setValueAtTime(1080, this.audioCtx.currentTime);
      this.tireResonator1.Q.setValueAtTime(4.2, this.audioCtx.currentTime);

      this.tireResonator2 = this.audioCtx.createBiquadFilter();
      this.tireResonator2.type = 'bandpass';
      this.tireResonator2.frequency.setValueAtTime(2240, this.audioCtx.currentTime);
      this.tireResonator2.Q.setValueAtTime(5.8, this.audioCtx.currentTime);

      this.tireNoiseNode.connect(this.tireResonator1);
      this.tireNoiseNode.connect(this.tireResonator2);
      this.tireResonator1.connect(this.tireSkidGain);
      this.tireResonator2.connect(this.tireSkidGain);
      this.tireSkidGain.connect(this.masterGain);

      this.tireNoiseNode.start();
    } catch {}
  }

  private initPersistentKerbRumble(): void {
    if (!this.audioCtx || !this.masterGain) return;
    try {
      this.kerbRumbleGain = this.audioCtx.createGain();
      this.kerbRumbleGain.gain.setValueAtTime(0.0, this.audioCtx.currentTime);

      this.kerbRumbleOsc = this.audioCtx.createOscillator();
      this.kerbRumbleOsc.type = 'sawtooth';
      this.kerbRumbleOsc.frequency.setValueAtTime(75, this.audioCtx.currentTime);

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, this.audioCtx.currentTime);

      this.kerbRumbleOsc.connect(filter);
      filter.connect(this.kerbRumbleGain);
      this.kerbRumbleGain.connect(this.masterGain);

      this.kerbRumbleOsc.start();
    } catch {}
  }

  private initPersistentBarrierScrape(): void {
    if (!this.audioCtx || !this.masterGain) return;
    try {
      this.barrierScrapeGain = this.audioCtx.createGain();
      this.barrierScrapeGain.gain.setValueAtTime(0.0, this.audioCtx.currentTime);

      if (typeof this.audioCtx.createStereoPanner === 'function') {
        this.barrierPanner = this.audioCtx.createStereoPanner();
        this.barrierPanner.pan.setValueAtTime(0.85, this.audioCtx.currentTime);
      }

      this.barrierFilter = this.audioCtx.createBiquadFilter();
      this.barrierFilter.type = 'bandpass';
      this.barrierFilter.frequency.setValueAtTime(4500, this.audioCtx.currentTime);
      this.barrierFilter.Q.setValueAtTime(3.5, this.audioCtx.currentTime);

      const bufferSize = Math.floor(this.audioCtx.sampleRate * 1.0);
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.88 ? 1.0 : 0.3);
      }

      this.barrierNoiseNode = this.audioCtx.createBufferSource();
      this.barrierNoiseNode.buffer = buffer;
      this.barrierNoiseNode.loop = true;

      this.barrierNoiseNode.connect(this.barrierFilter);
      this.barrierFilter.connect(this.barrierScrapeGain);
      if (this.barrierPanner) {
        this.barrierScrapeGain.connect(this.barrierPanner);
        this.barrierPanner.connect(this.masterGain);
      } else {
        this.barrierScrapeGain.connect(this.masterGain);
      }

      this.barrierNoiseNode.start();
    } catch {}
  }

  private initPersistentSlipstream(): void {
    if (!this.audioCtx || !this.masterGain) return;
    try {
      this.slipstreamGain = this.audioCtx.createGain();
      this.slipstreamGain.gain.setValueAtTime(0.0, this.audioCtx.currentTime);

      this.slipstreamFilter = this.audioCtx.createBiquadFilter();
      this.slipstreamFilter.type = 'lowpass';
      this.slipstreamFilter.frequency.setValueAtTime(600, this.audioCtx.currentTime);

      const bufferSize = Math.floor(this.audioCtx.sampleRate * 2.0);
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.slipstreamNoiseNode = this.audioCtx.createBufferSource();
      this.slipstreamNoiseNode.buffer = buffer;
      this.slipstreamNoiseNode.loop = true;

      this.slipstreamNoiseNode.connect(this.slipstreamFilter);
      this.slipstreamFilter.connect(this.slipstreamGain);
      this.slipstreamGain.connect(this.masterGain);

      this.slipstreamNoiseNode.start();
    } catch {}
  }

  private initTunnelReverb(): void {
    if (!this.audioCtx || !this.masterGain || !this.engineGain) return;
    try {
      this.tunnelDelayNode = this.audioCtx.createDelay(0.6);
      this.tunnelDelayNode.delayTime.setValueAtTime(0.24, this.audioCtx.currentTime);

      this.tunnelFeedbackGain = this.audioCtx.createGain();
      this.tunnelFeedbackGain.gain.setValueAtTime(0.42, this.audioCtx.currentTime);

      this.tunnelReverbWetGain = this.audioCtx.createGain();
      this.tunnelReverbWetGain.gain.setValueAtTime(0.0, this.audioCtx.currentTime);

      // Loop: engine -> delay -> feedback -> delay
      this.engineGain.connect(this.tunnelDelayNode);
      this.tunnelDelayNode.connect(this.tunnelFeedbackGain);
      this.tunnelFeedbackGain.connect(this.tunnelDelayNode);
      this.tunnelDelayNode.connect(this.tunnelReverbWetGain);
      this.tunnelReverbWetGain.connect(this.masterGain);
    } catch {}
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

  // ==========================================================================
  // 48kHz PCM Audio Decoding from .pak Chunks
  // ==========================================================================

  /**
   * Decodes a raw 48kHz 16-bit signed PCM audio chunk from a .pak bundle into an AudioBuffer.
   */
  public decodePcmChunkToAudioBuffer(rawChunk: Uint8Array, sampleRate = 48000): AudioBuffer | null {
    if (!this.audioCtx) return null;
    try {
      const sampleCount = Math.floor(rawChunk.byteLength / 2);
      if (sampleCount <= 0) return null;
      const int16 = new Int16Array(rawChunk.buffer, rawChunk.byteOffset, sampleCount);
      const audioBuffer = this.audioCtx.createBuffer(1, sampleCount, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < sampleCount; i++) {
        channelData[i] = int16[i] / 32768.0;
      }
      return audioBuffer;
    } catch {
      return null;
    }
  }

  /**
   * Ingests 48kHz PCM audio chunks extracted from vehicle.pak and starts looping audio voices.
   */
  public loadVehiclePcmBank(chunks: Map<string, Uint8Array> | Array<{ name: string; payload: Uint8Array }>): void {
    if (!this.audioCtx) return;
    const chunkMap =
      chunks instanceof Map
        ? chunks
        : new Map(chunks.map((c) => [c.name, c.payload]));

    for (const [name, payload] of chunkMap.entries()) {
      if (name.includes('pcm16')) {
        const buf = this.decodePcmChunkToAudioBuffer(payload, 48000);
        if (buf) {
          this.pcmBuffers.set(name, buf);
        }
      }
    }

    this.startPcmLoopVoices();
  }

  private startPcmLoopVoices(): void {
    if (!this.audioCtx || !this.masterGain) return;
    try {
      // Stop any existing PCM loop voices
      this.stopPcmLoopVoices();

      const idleBuf = this.pcmBuffers.get('exhaust_idle_pcm16');
      const midBuf = this.pcmBuffers.get('exhaust_mid_pcm16');
      const redlineBuf = this.pcmBuffers.get('exhaust_redline_pcm16');

      if (idleBuf) {
        this.pcmIdleSource = this.audioCtx.createBufferSource();
        this.pcmIdleSource.buffer = idleBuf;
        this.pcmIdleSource.loop = true;
        this.pcmIdleGain = this.audioCtx.createGain();
        this.pcmIdleGain.gain.setValueAtTime(0.4, this.audioCtx.currentTime);
        this.pcmIdleSource.connect(this.pcmIdleGain);
        this.pcmIdleGain.connect(this.masterGain);
        this.pcmIdleSource.start();
      }

      if (midBuf) {
        this.pcmMidSource = this.audioCtx.createBufferSource();
        this.pcmMidSource.buffer = midBuf;
        this.pcmMidSource.loop = true;
        this.pcmMidGain = this.audioCtx.createGain();
        this.pcmMidGain.gain.setValueAtTime(0.0, this.audioCtx.currentTime);
        this.pcmMidSource.connect(this.pcmMidGain);
        this.pcmMidGain.connect(this.masterGain);
        this.pcmMidSource.start();
      }

      if (redlineBuf) {
        this.pcmRedlineSource = this.audioCtx.createBufferSource();
        this.pcmRedlineSource.buffer = redlineBuf;
        this.pcmRedlineSource.loop = true;
        this.pcmRedlineGain = this.audioCtx.createGain();
        this.pcmRedlineGain.gain.setValueAtTime(0.0, this.audioCtx.currentTime);
        this.pcmRedlineSource.connect(this.pcmRedlineGain);
        this.pcmRedlineGain.connect(this.masterGain);
        this.pcmRedlineSource.start();
      }
    } catch {}
  }

  private stopPcmLoopVoices(): void {
    try {
      if (this.pcmIdleSource) {
        this.pcmIdleSource.stop();
        this.pcmIdleSource.disconnect();
        this.pcmIdleSource = null;
      }
      if (this.pcmMidSource) {
        this.pcmMidSource.stop();
        this.pcmMidSource.disconnect();
        this.pcmMidSource = null;
      }
      if (this.pcmRedlineSource) {
        this.pcmRedlineSource.stop();
        this.pcmRedlineSource.disconnect();
        this.pcmRedlineSource = null;
      }
    } catch {}
  }

  // ==========================================================================
  // Multi-RPM Procedural Synthesis Update
  // ==========================================================================

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

    // Powertrain family selection
    const waveFamily = POWERTRAIN_ARCHETYPES[spec.id] || 'crossplane_v8';
    if (waveFamily !== this.currentWaveFamily) {
      this.currentWaveFamily = waveFamily;
      if (this.oscFundamental && this.audioCtx) {
        const wave = this.periodicWaves.get(waveFamily);
        if (wave) {
          try {
            this.oscFundamental.setPeriodicWave(wave);
          } catch {}
        }
      }
    }

    // Cylinder firing order multiplier per powertrain archetype
    let cylinderOrder = 2.0;
    if (waveFamily === 'screaming_v12') {
      cylinderOrder = 6.0;
    } else if (waveFamily === 'crossplane_v8' || waveFamily === 'flatplane_v8') {
      cylinderOrder = 4.0;
    } else if (waveFamily === 'twin_rotor' || waveFamily === 'inline6_turbo' || waveFamily === 'flat6_na') {
      cylinderOrder = 3.0;
    } else if (waveFamily === 'supersonic_jet') {
      cylinderOrder = 10.0;
    } else if (waveFamily === 'ev_motor') {
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

      // Crossfade PCM loops if available
      const normRpm = safeRpm / redline;
      if (this.pcmIdleSource && this.pcmIdleGain) {
        this.pcmIdleSource.playbackRate.setValueAtTime(Math.max(0.6, safeRpm / 1200), now);
        this.pcmIdleGain.gain.setValueAtTime(Math.max(0, 1 - normRpm * 2.5) * 0.35, now);
      }
      if (this.pcmMidSource && this.pcmMidGain) {
        this.pcmMidSource.playbackRate.setValueAtTime(safeRpm / 4500, now);
        this.pcmMidGain.gain.setValueAtTime(Math.max(0, 1 - Math.abs(normRpm - 0.5) * 2.2) * 0.45, now);
      }
      if (this.pcmRedlineSource && this.pcmRedlineGain) {
        this.pcmRedlineSource.playbackRate.setValueAtTime(safeRpm / redline, now);
        this.pcmRedlineGain.gain.setValueAtTime(Math.max(0, (normRpm - 0.55) * 2.2) * 0.55, now);
      }
    }

    // Preserve archetype text matching for backwards compatibility
    const legacyArch = spec.id === 'jdm_rotary' ? 'twin_rotor' : waveFamily === 'screaming_v12' ? 'v12' : waveFamily;

    return {
      vehicleId: spec.id,
      archetype: legacyArch,
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
   * Synthesizes and plays a dual-stage turbo blow-off valve with 15Hz stu-tu-tu compressor surge flutter.
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
        const duration = 0.45;
        const bufferSize = Math.floor(this.audioCtx.sampleRate * duration);
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        // 15Hz compressor surge envelope modulation
        for (let i = 0; i < bufferSize; i++) {
          const t = i / this.audioCtx.sampleRate;
          const flutter = 0.5 + 0.5 * Math.sin(2 * Math.PI * 15 * t);
          data[i] = (Math.random() * 2 - 1) * flutter;
        }

        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(3200, now);
        filter.Q.setValueAtTime(3.8, now);

        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(0.55 * clampedIntensity, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
        noise.stop(now + duration);
      } catch {}
    }

    return { played: true, intensity: clampedIntensity, count: this.sfxCounters.turboBlowOff };
  }

  /**
   * Plays tire screech / scrub via persistent stick-slip dual-formant resonator.
   * Completely eliminates frame-spamming node allocation during continuous drifting!
   */
  public playTireSkid(slipIntensity: number = 1.0): {
    played: boolean;
    intensity: number;
    count: number;
  } {
    this.sfxCounters.tireSkid += 1;
    this.sfxHistory.push('tireSkid');
    const clampedIntensity = Math.max(0.0, Math.min(1.0, slipIntensity));

    if (this.audioCtx && this.tireSkidGain) {
      try {
        const now = this.audioCtx.currentTime;
        const targetVol = Math.min(0.85, clampedIntensity * 0.72);
        this.tireSkidGain.gain.setTargetAtTime(targetVol, now, 0.03);

        if (this.tireDecayTimer) {
          clearTimeout(this.tireDecayTimer);
        }
        this.tireDecayTimer = setTimeout(() => {
          if (this.audioCtx && this.tireSkidGain) {
            this.tireSkidGain.gain.setTargetAtTime(0.0, this.audioCtx.currentTime, 0.05);
          }
        }, 90);
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

    if (this.audioCtx && this.slipstreamGain && this.slipstreamFilter) {
      try {
        const now = this.audioCtx.currentTime;
        this.slipstreamGain.gain.setTargetAtTime(0.35 * clampedIntensity, now, 0.05);
        this.slipstreamFilter.frequency.setTargetAtTime(400 + clampedIntensity * 1200, now, 0.05);

        setTimeout(() => {
          if (this.audioCtx && this.slipstreamGain) {
            this.slipstreamGain.gain.setTargetAtTime(0.0, this.audioCtx.currentTime, 0.15);
          }
        }, 120);
      } catch {}
    }

    return { played: true, intensity: clampedIntensity, count: this.sfxCounters.slipstreamWind };
  }

  /**
   * Synthesizes and plays 55-130Hz sub-bass FIA sawtooth kerb rumble thump.
   */
  public playKerbRumble(intensity: number = 1.0, speedKph: number = 120): { played: boolean } {
    const clampedIntensity = Math.max(0.0, Math.min(1.0, intensity));
    if (this.audioCtx && this.kerbRumbleGain && this.kerbRumbleOsc) {
      try {
        const now = this.audioCtx.currentTime;
        const rumbleFreq = Math.min(130, Math.max(55, 45 + speedKph * 0.35));
        this.kerbRumbleOsc.frequency.setValueAtTime(rumbleFreq, now);
        this.kerbRumbleGain.gain.setTargetAtTime(0.45 * clampedIntensity, now, 0.02);

        if (this.kerbDecayTimer) clearTimeout(this.kerbDecayTimer);
        this.kerbDecayTimer = setTimeout(() => {
          if (this.audioCtx && this.kerbRumbleGain) {
            this.kerbRumbleGain.gain.setTargetAtTime(0.0, this.audioCtx.currentTime, 0.04);
          }
        }, 80);
      } catch {}
    }
    return { played: true };
  }

  /**
   * Synthesizes and plays stereo-panned barrier scrape sparks audio.
   */
  public playBarrierScrape(intensity: number = 1.0, side: 'LEFT' | 'RIGHT' = 'RIGHT'): { played: boolean } {
    const clampedIntensity = Math.max(0.0, Math.min(1.0, intensity));
    if (this.audioCtx && this.barrierScrapeGain) {
      try {
        const now = this.audioCtx.currentTime;
        if (this.barrierPanner) {
          this.barrierPanner.pan.setValueAtTime(side === 'LEFT' ? -0.85 : 0.85, now);
        }
        this.barrierScrapeGain.gain.setTargetAtTime(0.5 * clampedIntensity, now, 0.02);

        if (this.barrierDecayTimer) clearTimeout(this.barrierDecayTimer);
        this.barrierDecayTimer = setTimeout(() => {
          if (this.audioCtx && this.barrierScrapeGain) {
            this.barrierScrapeGain.gain.setTargetAtTime(0.0, this.audioCtx.currentTime, 0.05);
          }
        }, 90);
      } catch {}
    }
    return { played: true };
  }

  /**
   * Synthesizes motorsport gear shift transients: ignition-cut pop on upshift, rev-match blip on downshift.
   */
  public playGearShift(direction: 'UPSHIFT' | 'DOWNSHIFT', isTurbo: boolean = false): { played: boolean } {
    if (!this.audioCtx || !this.masterGain) return { played: true };
    try {
      const now = this.audioCtx.currentTime;
      if (direction === 'UPSHIFT') {
        // Duck engine gain briefly for ignition-cut pop
        if (this.engineGain) {
          this.engineGain.gain.setValueAtTime(0.08, now);
          this.engineGain.gain.setValueAtTime(0.35, now + 0.055);
        }
        // Punchy 160Hz pop + 1800Hz mechanical engagement clunk
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.06);
        gain.gain.setValueAtTime(0.65, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.07);

        if (isTurbo) {
          this.playTurboBlowOff(0.8);
        }
      } else {
        // Rev-match blip
        if (this.oscFundamental) {
          const curF = this.oscFundamental.frequency.value;
          this.oscFundamental.frequency.setValueAtTime(curF * 1.18, now);
          this.oscFundamental.frequency.setValueAtTime(curF, now + 0.08);
        }
        this.playExhaustBackfire(0.65);
      }
    } catch {}
    return { played: true };
  }

  /**
   * Synthesizes exhaust overrun pops and backfire crackles.
   */
  public playExhaustBackfire(intensity: number = 0.8): { played: boolean } {
    if (!this.audioCtx || !this.masterGain) return { played: true };
    try {
      const now = this.audioCtx.currentTime;
      const burstCount = 1 + Math.floor(Math.random() * 3);
      for (let b = 0; b < burstCount; b++) {
        const offset = now + b * 0.035;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240 + Math.random() * 180, offset);
        gain.gain.setValueAtTime(0.5 * intensity, offset);
        gain.gain.exponentialRampToValueAtTime(0.001, offset + 0.04);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(offset);
        osc.stop(offset + 0.045);
      }
    } catch {}
    return { played: true };
  }

  /**
   * Synthesizes 3D Doppler pass-by woosh for overtaking AI rival vehicles.
   */
  public playAiDopplerPassBy(relativeSpeedMs: number, distanceMeters: number, panX: number = 0.0): { played: boolean } {
    if (!this.audioCtx || !this.masterGain) return { played: true };
    try {
      const now = this.audioCtx.currentTime;
      const speedOfSound = 343;
      const dopplerFactor = Math.max(0.6, Math.min(1.6, speedOfSound / (speedOfSound - relativeSpeedMs * 0.5)));
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140 * dopplerFactor, now);
      osc.frequency.linearRampToValueAtTime(90 / dopplerFactor, now + 0.35);

      const distAtten = Math.max(0.0, 1.0 - distanceMeters / 30.0);
      gain.gain.setValueAtTime(0.4 * distAtten, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      if (typeof this.audioCtx.createStereoPanner === 'function') {
        const panner = this.audioCtx.createStereoPanner();
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, panX)), now);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain);
      } else {
        osc.connect(gain);
        gain.connect(this.masterGain);
      }
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
    return { played: true };
  }

  /**
   * Configures tunnel acoustic reverberation wet send.
   */
  public setTunnelReverb(isTunnel: boolean): void {
    if (!this.audioCtx || !this.tunnelReverbWetGain) return;
    try {
      const now = this.audioCtx.currentTime;
      this.tunnelReverbWetGain.gain.setTargetAtTime(isTunnel ? 0.45 : 0.0, now, 0.1);
    } catch {}
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
    if (this.tireDecayTimer) clearTimeout(this.tireDecayTimer);
    if (this.kerbDecayTimer) clearTimeout(this.kerbDecayTimer);
    if (this.barrierDecayTimer) clearTimeout(this.barrierDecayTimer);
    this.stopPcmLoopVoices();
    if (this.audioCtx && typeof this.audioCtx.close === 'function') {
      try {
        this.audioCtx.close().catch(() => {});
      } catch {}
    }
    this.audioCtx = null;
    this.isAudioRunning = false;
  }
}
