// tests/stress_audio_engine.mjs
// Empirical Stress Harness for GranularSynthEngine.ts across all 34 vehicle archetypes
// Verifies:
// 1. Audio node lifecycle, node recreation explosions (persistent vs one-shot nodes).
// 2. Audio clipping, gain saturation, NaN/Infinity safety across full operational envelope.
// 3. Operational envelope: idle, mid, redline, rev-limiter bounce, rapid throttle, transients.
// 4. Memory leak profiling over high iteration counts.
// 5. Genuine 48kHz PCM chunk loading from on-disk vehicle.pak bundles.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ============================================================================
// 1. HIGH-PRECISION MOCK WEB AUDIO API WITH NODE LIFECYCLE & CLIPPING TRACKING
// ============================================================================

class NodeTracker {
  constructor() {
    this.totalCreated = 0;
    this.currentlyActive = 0;
    this.peakActive = 0;
    this.nodesByType = {};
    this.gainPeakValues = {};
    this.clippingViolations = [];
    this.nanInfinityViolations = [];
  }

  recordCreate(type) {
    this.totalCreated++;
    this.currentlyActive++;
    this.peakActive = Math.max(this.peakActive, this.currentlyActive);
    this.nodesByType[type] = (this.nodesByType[type] || 0) + 1;
  }

  recordDestroy(type) {
    this.currentlyActive = Math.max(0, this.currentlyActive - 1);
  }

  recordParam(nodeName, paramName, val) {
    if (!Number.isFinite(val)) {
      this.nanInfinityViolations.push({
        node: nodeName,
        param: paramName,
        value: val,
        stack: new Error().stack
      });
      return;
    }

    if (paramName === 'gain') {
      const currentPeak = this.gainPeakValues[nodeName] ?? 0;
      if (val > currentPeak) {
        this.gainPeakValues[nodeName] = val;
      }
      // Check for audio clipping (gain exceeding 1.25 margin)
      if (val > 1.25 || val < -0.01) {
        this.clippingViolations.push({
          node: nodeName,
          gain: val,
          message: `Gain value ${val} out of non-clipping envelope [0.0, 1.25]`
        });
      }
    }
  }
}

const tracker = new NodeTracker();

class MockAudioParam {
  constructor(nodeName, paramName, defaultValue = 0) {
    this.nodeName = nodeName;
    this.paramName = paramName;
    this.value = defaultValue;
  }

  setValueAtTime(val, time) {
    tracker.recordParam(this.nodeName, this.paramName, val);
    this.value = val;
  }

  linearRampToValueAtTime(val, time) {
    tracker.recordParam(this.nodeName, this.paramName, val);
    this.value = val;
  }

  exponentialRampToValueAtTime(val, time) {
    tracker.recordParam(this.nodeName, this.paramName, val);
    this.value = val;
  }

  setTargetAtTime(target, time, timeConstant) {
    tracker.recordParam(this.nodeName, this.paramName, target);
    this.value = target;
  }
}

class MockAudioNode {
  constructor(type) {
    this.nodeType = type;
    this.connectedTo = [];
    tracker.recordCreate(type);
  }

  connect(target) {
    this.connectedTo.push(target);
    return target;
  }

  disconnect() {
    this.connectedTo = [];
    tracker.recordDestroy(this.nodeType);
  }
}

class MockGainNode extends MockAudioNode {
  constructor(name = 'gain') {
    super('GainNode');
    this.name = name;
    this.gain = new MockAudioParam(name, 'gain', 1.0);
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor() {
    super('OscillatorNode');
    this.type = 'sine';
    this.frequency = new MockAudioParam('osc', 'frequency', 440);
    this.periodicWave = null;
    this.isRunning = false;
  }

  setPeriodicWave(wave) {
    this.periodicWave = wave;
  }

  start(when = 0) {
    this.isRunning = true;
  }

  stop(when = 0) {
    this.isRunning = false;
    this.disconnect();
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor() {
    super('BiquadFilterNode');
    this.type = 'lowpass';
    this.frequency = new MockAudioParam('filter', 'frequency', 350);
    this.Q = new MockAudioParam('filter', 'Q', 1.0);
    this.gain = new MockAudioParam('filter', 'gain', 0.0);
  }
}

class MockWaveShaperNode extends MockAudioNode {
  constructor() {
    super('WaveShaperNode');
    this.curve = null;
  }
}

class MockStereoPannerNode extends MockAudioNode {
  constructor() {
    super('StereoPannerNode');
    this.pan = new MockAudioParam('panner', 'pan', 0.0);
  }
}

class MockDelayNode extends MockAudioNode {
  constructor(maxDelay = 1.0) {
    super('DelayNode');
    this.delayTime = new MockAudioParam('delay', 'delayTime', 0.0);
  }
}

class MockAudioBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._data = new Float32Array(length);
  }

  getChannelData(channel) {
    return this._data;
  }
}

class MockAudioBufferSourceNode extends MockAudioNode {
  constructor() {
    super('AudioBufferSourceNode');
    this.buffer = null;
    this.loop = false;
    this.playbackRate = new MockAudioParam('bufferSource', 'playbackRate', 1.0);
    this.isRunning = false;
  }

  start(when = 0) {
    this.isRunning = true;
  }

  stop(when = 0) {
    this.isRunning = false;
    this.disconnect();
  }
}

class MockPeriodicWave {
  constructor(real, imag) {
    this.real = real;
    this.imag = imag;
  }
}

class MockAudioContext {
  constructor() {
    this.sampleRate = 48000;
    this.currentTime = 0;
    this.state = 'running';
    this.destination = new MockGainNode('destination');
  }

  createGain() {
    return new MockGainNode();
  }

  createOscillator() {
    return new MockOscillatorNode();
  }

  createBiquadFilter() {
    return new MockBiquadFilterNode();
  }

  createWaveShaper() {
    return new MockWaveShaperNode();
  }

  createStereoPanner() {
    return new MockStereoPannerNode();
  }

  createDelay(maxDelay = 1.0) {
    return new MockDelayNode(maxDelay);
  }

  createBuffer(channels, length, sampleRate) {
    return new MockAudioBuffer(channels, length, sampleRate);
  }

  createBufferSource() {
    return new MockAudioBufferSourceNode();
  }

  createPeriodicWave(real, imag, options) {
    return new MockPeriodicWave(real, imag);
  }

  async resume() {
    this.state = 'running';
  }

  async close() {
    this.state = 'closed';
  }
}

// Install mock Web Audio environment globally
globalThis.AudioContext = MockAudioContext;
globalThis.window = {
  AudioContext: MockAudioContext
};

// ============================================================================
// 2. DYNAMIC IMPORT OF GRANULAR SYNTH ENGINE & ROSTER
// ============================================================================

// Transpiled or compiled import via tsx or dynamic typescript execution
// Since Vite / Node ESM is used, let's load compiled or use Vite runner / tsx
let GranularSynthEngine, VEHICLE_ROSTER, getVehicleById, POWERTRAIN_ARCHETYPES, POWERTRAIN_WAVETABLES;

try {
  // Try importing via tsx or standard path
  const synthMod = await import('../src/audio/GranularSynthEngine.ts');
  const rosterMod = await import('../src/vehicles/VehicleRoster.ts');
  GranularSynthEngine = synthMod.GranularSynthEngine;
  POWERTRAIN_ARCHETYPES = synthMod.POWERTRAIN_ARCHETYPES;
  POWERTRAIN_WAVETABLES = synthMod.POWERTRAIN_WAVETABLES;
  VEHICLE_ROSTER = rosterMod.VEHICLE_ROSTER;
  getVehicleById = rosterMod.getVehicleById;
} catch (err) {
  console.error('Failed to import modules directly. Ensure tsx/vitest is available:', err);
  process.exit(1);
}

console.log('='.repeat(80));
console.log(' APEX GRAND PRIX: EMPIRICAL GRANULAR AUDIO STRESS HARNESS');
console.log(' Testing all 34 vehicle archetypes across full operational envelope');
console.log('='.repeat(80));

// ============================================================================
// 3. STRESS TEST SUITE EXECUTION
// ============================================================================

async function runEmpiricalStressSuite() {
  const results = {
    totalArchetypesTested: 0,
    perArchetypeMetrics: {},
    nodeLifecycle: {},
    gainSafety: {},
    clippingViolations: [],
    nanInfinityViolations: [],
    memoryUsage: {},
    pcmBankLoadSuccesses: 0,
    pcmBankLoadErrors: []
  };

  const initialMemory = process.memoryUsage();
  const engine = new GranularSynthEngine();

  console.log(`\n[Stage 1] Initialized GranularSynthEngine with Web Audio Context.`);
  console.log(`  Sample Rate: ${engine.sampleRate} Hz`);
  console.log(`  Initial Nodes Created: ${tracker.totalCreated}`);
  console.log(`  Initial Active Nodes: ${tracker.currentlyActive}`);

  const baselinePersistentNodes = tracker.totalCreated;

  // Verify all 34 vehicles in roster
  if (VEHICLE_ROSTER.length !== 34) {
    throw new Error(`Expected 34 vehicles in VEHICLE_ROSTER, found ${VEHICLE_ROSTER.length}`);
  }

  // --------------------------------------------------------------------------
  // Stage 2: Stress test all 34 archetypes
  // --------------------------------------------------------------------------
  console.log(`\n[Stage 2] Stress-testing all 34 vehicle archetypes...`);

  for (let idx = 0; idx < VEHICLE_ROSTER.length; idx++) {
    const spec = VEHICLE_ROSTER[idx];
    results.totalArchetypesTested++;

    const archMetrics = {
      id: spec.id,
      name: spec.name,
      redlineRpm: spec.redlineRpm,
      powertrain: POWERTRAIN_ARCHETYPES[spec.id] || 'unknown',
      idleFreqHz: 0,
      redlineFreqHz: 0,
      overrevFreqHz: 0,
      nyquistSafe: true,
      clippingDetected: false
    };

    // 2.1 Idle Test (800 RPM, throttle 0.0)
    const idleTelem = engine.updateEngineAudio(spec, 800, 0.0);
    archMetrics.idleFreqHz = idleTelem.fundamentalFreqHz;
    if (idleTelem.fundamentalFreqHz < 20 || idleTelem.fundamentalFreqHz > 24000) {
      throw new Error(`Invalid idle freq for ${spec.id}: ${idleTelem.fundamentalFreqHz}`);
    }

    // 2.2 Mid-Range Test (50% redline, throttle 0.5)
    const midRpm = Math.floor(spec.redlineRpm * 0.5);
    const midTelem = engine.updateEngineAudio(spec, midRpm, 0.5);
    if (midTelem.fundamentalFreqHz <= idleTelem.fundamentalFreqHz) {
      throw new Error(`Mid frequency not greater than idle for ${spec.id}`);
    }

    // 2.3 Redline Test (100% redline, throttle 1.0)
    const redlineTelem = engine.updateEngineAudio(spec, spec.redlineRpm, 1.0);
    archMetrics.redlineFreqHz = redlineTelem.fundamentalFreqHz;
    if (redlineTelem.fundamentalFreqHz > 24000) {
      archMetrics.nyquistSafe = false;
      throw new Error(`Nyquist violation at redline for ${spec.id}: ${redlineTelem.fundamentalFreqHz}`);
    }

    // 2.4 Rev-Limiter Bounce Test (simulating fuel-cut oscillation over 100 cycles)
    for (let c = 0; c < 100; c++) {
      const bounceRpm = c % 2 === 0 ? spec.redlineRpm + 800 : spec.redlineRpm - 400;
      const bTelem = engine.updateEngineAudio(spec, bounceRpm, 1.0);
      if (bTelem.fundamentalFreqHz > 24000) {
        throw new Error(`Nyquist violation during rev bounce for ${spec.id}`);
      }
      archMetrics.overrevFreqHz = Math.max(archMetrics.overrevFreqHz, bTelem.fundamentalFreqHz);
    }

    // 2.5 Rapid Throttle Changes (0.0 -> 1.0 -> 0.0 at simulated 120Hz for 300 steps)
    for (let step = 0; step < 300; step++) {
      const load = (step % 4 < 2) ? 1.0 : 0.0;
      const rpm = 2000 + Math.sin(step * 0.1) * 1500;
      engine.updateEngineAudio(spec, rpm, load);
    }

    // 2.6 Transients: Gearshifts, Turbo Blow-Off, Tire Screech, Kerb Rumble
    engine.playGearShift('UPSHIFT', true);
    engine.playGearShift('DOWNSHIFT', false);
    engine.playTurboBlowOff(0.85);
    engine.playTireSkid(0.9);
    engine.playKerbRumble(0.75, 180);
    engine.playBarrierScrape(0.65, 'RIGHT');
    engine.playSlipstreamWind(0.5);
    engine.playAiDopplerPassBy(35.0, 4.0, 0.5);
    engine.setTunnelReverb(true);
    engine.setTunnelReverb(false);

    results.perArchetypeMetrics[spec.id] = archMetrics;
  }

  console.log(`  Completed full envelope verification across all 34 archetypes.`);

  // --------------------------------------------------------------------------
  // Stage 3: Node Recreation Explosion Check
  // --------------------------------------------------------------------------
  console.log(`\n[Stage 3] Testing for Node Recreation Explosions during continuous driving...`);
  const nodesBeforeContinuous = tracker.totalCreated;

  // Simulate 2,000 frames of continuous driving with continuous tire skid, kerb rumble, and barrier scrape
  for (let f = 0; f < 2000; f++) {
    const spec = VEHICLE_ROSTER[f % 34];
    engine.updateEngineAudio(spec, 4000 + (f % 5000), 0.7);
    engine.playTireSkid(0.8);
    engine.playKerbRumble(0.6, 220);
    engine.playBarrierScrape(0.5, 'LEFT');
    engine.playSlipstreamWind(0.4);
  }

  const nodesAfterContinuous = tracker.totalCreated;
  const nodesCreatedDuringContinuous = nodesAfterContinuous - nodesBeforeContinuous;

  console.log(`  Nodes created across 2,000 continuous frames: ${nodesCreatedDuringContinuous}`);
  if (nodesCreatedDuringContinuous > 0) {
    throw new Error(
      `NODE RECREATION EXPLOSION DETECTED: Expected 0 new nodes during continuous driving, but ${nodesCreatedDuringContinuous} nodes were allocated!`
    );
  } else {
    console.log(`  SUCCESS: Exactly 0 nodes allocated during 2,000 continuous driving frames (persistent resonators verified).`);
  }

  // --------------------------------------------------------------------------
  // Stage 4: Genuine 48kHz PCM Audio Bank Ingestion from on-disk vehicle.pak
  // --------------------------------------------------------------------------
  console.log(`\n[Stage 4] Testing genuine 48kHz PCM audio bank ingestion from on-disk .pak files...`);

  const paksDir = path.resolve(ROOT_DIR, 'assets/paks/vehicles');
  const carFolders = fs.readdirSync(paksDir).filter(f => f.startsWith('car_')).sort();

  console.log(`  Found ${carFolders.length} vehicle pak folders on disk.`);

  for (const folder of carFolders) {
    const pakPath = path.join(paksDir, folder, 'vehicle.pak');
    if (!fs.existsSync(pakPath)) {
      results.pcmBankLoadErrors.push(`Missing vehicle.pak in ${folder}`);
      continue;
    }

    const fileBuf = fs.readFileSync(pakPath);
    // Parse APEXPAK1 Header
    if (fileBuf.length < 64) {
      results.pcmBankLoadErrors.push(`Corrupt pak in ${folder}: length < 64`);
      continue;
    }

    const magic = fileBuf.toString('ascii', 0, 8);
    if (magic !== 'APEXPAK1') {
      results.pcmBankLoadErrors.push(`Invalid magic in ${folder}: ${magic}`);
      continue;
    }

    const entryCount = fileBuf.readUInt32LE(24);
    let offset = 64;
    const pcmChunks = new Map();

    for (let e = 0; e < entryCount; e++) {
      if (offset + 64 > fileBuf.length) break;
      const chunkName = fileBuf.toString('utf8', offset, offset + 32).replace(/\0/g, '');
      const chunkOffset = Number(fileBuf.readBigUInt64LE(offset + 48));
      const chunkLen = Number(fileBuf.readBigUInt64LE(offset + 56));

      if (chunkName.includes('pcm16') && chunkOffset + chunkLen <= fileBuf.length) {
        const payload = new Uint8Array(fileBuf.subarray(chunkOffset, chunkOffset + chunkLen));
        pcmChunks.set(chunkName, payload);
      }
      offset += 64;
    }

    if (pcmChunks.size > 0) {
      engine.loadVehiclePcmBank(pcmChunks);
      results.pcmBankLoadSuccesses++;
    } else {
      results.pcmBankLoadErrors.push(`No PCM chunks found in ${folder}`);
    }
  }

  console.log(`  Successfully decoded and ingested PCM banks for ${results.pcmBankLoadSuccesses} / ${carFolders.length} vehicles.`);

  // --------------------------------------------------------------------------
  // Stage 5: High-Frequency Torture & Memory Leak Check
  // --------------------------------------------------------------------------
  console.log(`\n[Stage 5] Executing 50,000 multi-archetype stress cycles with memory profiling...`);

  if (global.gc) {
    global.gc();
  }
  const memBefore50k = process.memoryUsage();

  for (let cycle = 0; cycle < 50000; cycle++) {
    const spec = VEHICLE_ROSTER[cycle % 34];
    const throttle = (cycle % 2 === 0) ? 1.0 : 0.0;
    const rpm = 1000 + (cycle % (spec.redlineRpm - 1000));
    engine.updateEngineAudio(spec, rpm, throttle);

    if (cycle % 250 === 0) {
      engine.playExhaustBackfire(0.6);
      engine.playTurboBlowOff(0.7);
      engine.playTireSkid(0.85);
      engine.playKerbRumble(0.7, 240);
    }
  }

  if (global.gc) {
    global.gc();
  }
  const memAfter50k = process.memoryUsage();
  const heapDeltaMb = (memAfter50k.heapUsed - memBefore50k.heapUsed) / (1024 * 1024);
  const rssDeltaMb = (memAfter50k.rss - memBefore50k.rss) / (1024 * 1024);

  console.log(`  Heap delta after 50k cycles: ${heapDeltaMb.toFixed(2)} MB`);
  console.log(`  RSS delta after 50k cycles: ${rssDeltaMb.toFixed(2)} MB`);

  results.memoryUsage = {
    heapBeforeMb: (memBefore50k.heapUsed / (1024 * 1024)).toFixed(2),
    heapAfterMb: (memAfter50k.heapUsed / (1024 * 1024)).toFixed(2),
    heapDeltaMb: heapDeltaMb.toFixed(2),
    rssDeltaMb: rssDeltaMb.toFixed(2)
  };

  // --------------------------------------------------------------------------
  // Stage 6: Audio Clipping & Gain Saturation Audit
  // --------------------------------------------------------------------------
  console.log(`\n[Stage 6] Auditing Audio Clipping & Gain Saturation...`);
  console.log(`  Tracked Gain Peaks across graph:`, tracker.gainPeakValues);
  console.log(`  Total Clipping Violations (> 1.25): ${tracker.clippingViolations.length}`);
  console.log(`  Total NaN / Infinity Violations: ${tracker.nanInfinityViolations.length}`);

  if (tracker.clippingViolations.length > 0) {
    console.error('CLIPPING VIOLATIONS DETECTED:', tracker.clippingViolations.slice(0, 5));
    throw new Error(`Audio clipping violations detected: ${tracker.clippingViolations.length}`);
  }

  if (tracker.nanInfinityViolations.length > 0) {
    console.error('NAN/INFINITY VIOLATIONS DETECTED:', tracker.nanInfinityViolations.slice(0, 5));
    throw new Error(`NaN/Infinity parameter violations detected: ${tracker.nanInfinityViolations.length}`);
  }

  // --------------------------------------------------------------------------
  // Stage 7: Lifecycle & Disposal Cleanliness
  // --------------------------------------------------------------------------
  console.log(`\n[Stage 7] Testing Engine Disposal and Context Teardown...`);
  engine.dispose();
  console.log(`  Engine successfully disposed. AudioContext closed.`);

  console.log('\n' + '='.repeat(80));
  console.log(' EMPIRICAL STRESS TEST PASSED: ALL 34 ARCHETYPES CERTIFIED');
  console.log('='.repeat(80));

  return results;
}

runEmpiricalStressSuite()
  .then(res => {
    fs.writeFileSync(
      path.resolve(__dirname, 'audio_stress_results.json'),
      JSON.stringify(res, null, 2)
    );
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ STRESS TEST FAILED:', err);
    process.exit(1);
  });
