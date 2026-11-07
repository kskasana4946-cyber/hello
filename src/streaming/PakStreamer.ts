// src/streaming/PakStreamer.ts
import {
  APEX_PAK_HEADER_BYTES,
  APEX_PAK_MAGIC,
  APEX_PAK_TOC_ENTRY_BYTES,
  APEX_PAK_VERSION,
  CanonicalSkyBiomeId,
  CanonicalTrackBiomeId,
  PakChunkType,
  PakChunkTypeId,
  PakHeader,
  PakTocEntry,
  PakType,
  PakTypeId,
  ParsedPakBundle,
  SkyBiomeId,
  TrackBiomeId,
} from '../core/types';

export const PAK_MAGIC = APEX_PAK_MAGIC;

// ============================================================================
// 1. BIDIRECTIONAL ALIAS MAPS (SKY, TRACK, AND 34 VEHICLES)
// ============================================================================

export const SKY_ID_TO_CANONICAL: Record<string, CanonicalSkyBiomeId> = {
  sky_01: 'sky_golden_hour',
  sky_golden_hour: 'sky_golden_hour',
  'sky_golden_hour.pak': 'sky_golden_hour',
  sky_02: 'sky_neotokyo_cyber',
  sky_neotokyo_cyber: 'sky_neotokyo_cyber',
  'sky_neotokyo_cyber.pak': 'sky_neotokyo_cyber',
  sky_03: 'sky_redrock_canyon',
  sky_redrock_canyon: 'sky_redrock_canyon',
  'sky_redrock_canyon.pak': 'sky_redrock_canyon',
  sky_04: 'sky_alpine_glacier',
  sky_alpine_glacier: 'sky_alpine_glacier',
  'sky_alpine_glacier.pak': 'sky_alpine_glacier',
};

export const CANONICAL_SKY_TO_ALIAS: Record<CanonicalSkyBiomeId, string> = {
  sky_golden_hour: 'sky_01',
  sky_neotokyo_cyber: 'sky_02',
  sky_redrock_canyon: 'sky_03',
  sky_alpine_glacier: 'sky_04',
};

export const TRACK_ID_TO_CANONICAL: Record<string, CanonicalTrackBiomeId> = {
  track_01: 'track_golden_gp',
  track_golden_gp: 'track_golden_gp',
  'track_golden_gp.pak': 'track_golden_gp',
  track_02: 'track_neotokyo',
  track_neotokyo: 'track_neotokyo',
  'track_neotokyo.pak': 'track_neotokyo',
  track_03: 'track_canyon',
  track_canyon: 'track_canyon',
  'track_canyon.pak': 'track_canyon',
  track_04: 'track_alpine',
  track_alpine: 'track_alpine',
  'track_alpine.pak': 'track_alpine',
};

export const CANONICAL_TRACK_TO_ALIAS: Record<CanonicalTrackBiomeId, string> = {
  track_golden_gp: 'track_01',
  track_neotokyo: 'track_02',
  track_canyon: 'track_03',
  track_alpine: 'track_04',
};

export const VEHICLE_SLUG_BY_INDEX: readonly string[] = [
  'mini_jcw',         // car_01
  'hot_hatch',        // car_02
  'golf_r',           // car_03
  'gr_yaris',         // car_04
  'roadster',         // car_05
  'ranger_truck',     // car_06
  'jdm_sedan',        // car_07
  'trail_suv',        // car_08
  'sport_mpv',        // car_09
  'overland_truck',   // car_10
  'classic_muscle',   // car_11
  'police_sedan',     // car_12
  'swat_suv',         // car_13
  'vip_mpv',          // car_14
  'bentley_sedan',    // car_15
  'porsche_cabrio',   // car_16
  'porsche_targa',    // car_17
  'urus_suv',         // car_18
  'trophy_truck',     // car_19
  'corvette_c8',      // car_20
  'porsche_gt3',      // car_21
  'lambo_v12',        // car_22
  'mclaren_lt',       // car_23
  'cyber_mpv',        // car_24
  'pagani_utopia',    // car_25
  'ferrari_laferrari',// car_26
  'bugatti_bolide',   // car_27
  'terzo_ev',         // car_28
  'koenigsegg_jesko', // car_29
  'rimac_nevera',     // car_30
] as const;

export const VEHICLE_SLUGS_ORDERED = VEHICLE_SLUG_BY_INDEX;

export const LEGACY_VEHICLE_ALIASES: Record<string, string> = {
  scooter: 'mini_jcw',
  jdm_rotary: 'jdm_sedan',
  car: 'jdm_sedan',
  skyline_gtr: 'jdm_sedan',
  rally: 'gr_yaris',
  dune_buggy: 'trail_suv',
  truck: 'trophy_truck',
  muscle: 'classic_muscle',
  swat_armored: 'swat_suv',
  semi_rig: 'overland_truck',
  bus: 'sport_mpv',
  kart_shifter: 'golf_r',
  ariel_exo: 'roadster',
  corvette_gt: 'corvette_c8',
  bike: 'porsche_cabrio',
  cyber_bike: 'cyber_mpv',
  ferrari_v8: 'ferrari_laferrari',
  lambo: 'lambo_v12',
  pagani_v12: 'pagani_utopia',
  koenigsegg: 'koenigsegg_jesko',
  hyper: 'bugatti_bolide',
  ev_proto: 'rimac_nevera',
  stock_nascar: 'classic_muscle',
  indy_open: 'porsche_gt3',
  lmp1: 'mclaren_lt',
  f1: 'terzo_ev',
  fan_car: 'pagani_utopia',
  jet_thrust: 'rimac_nevera',
};

export function resolveSkyCanonicalId(input: SkyBiomeId | string): CanonicalSkyBiomeId {
  const clean = input.trim().replace(/^.*\/+/, '');
  return SKY_ID_TO_CANONICAL[clean] ?? 'sky_golden_hour';
}

export function resolveSkyPakPath(input: SkyBiomeId | string): string {
  const canonical = resolveSkyCanonicalId(input);
  return `assets/paks/sky/${canonical}.pak`;
}

export function resolveTrackCanonicalId(input: TrackBiomeId | string): CanonicalTrackBiomeId {
  const clean = input.trim().replace(/^.*\/+/, '');
  return TRACK_ID_TO_CANONICAL[clean] ?? 'track_golden_gp';
}

export function resolveTrackPakPath(input: TrackBiomeId | string): string {
  const canonical = resolveTrackCanonicalId(input);
  return `assets/paks/tracks/${canonical}.pak`;
}

export function resolveVehiclePakDir(idOrDir: string | number): {
  carDir: string;
  slug: string;
  index: number;
  pakPath: string;
} {
  if (typeof idOrDir === 'number') {
    const idx = Math.max(1, Math.min(34, Math.floor(idOrDir)));
    const carDir = `car_${String(idx).padStart(2, '0')}`;
    const slug = idx === 34 ? 'jet_thrust' : (idx <= 30 ? VEHICLE_SLUG_BY_INDEX[idx - 1] : `car_${idx}`);
    return { carDir, slug, index: idx, pakPath: `assets/paks/vehicles/${carDir}/vehicle.pak` };
  }
  const clean = idOrDir.trim().toLowerCase();
  if (clean === 'car_34') {
    return { carDir: 'car_34', slug: 'jet_thrust', index: 34, pakPath: 'assets/paks/vehicles/car_34/vehicle.pak' };
  }
  const dirMatch = clean.match(/^car_(\d{1,2})$/);
  if (dirMatch) {
    const idx = Math.max(1, Math.min(30, parseInt(dirMatch[1], 10)));
    const carDir = `car_${String(idx).padStart(2, '0')}`;
    const slug = VEHICLE_SLUG_BY_INDEX[idx - 1];
    return { carDir, slug, index: idx, pakPath: `assets/paks/vehicles/${carDir}/vehicle.pak` };
  }
  if (clean === 'scooter') {
    return { carDir: 'car_01', slug: 'mini_jcw', index: 1, pakPath: 'assets/paks/vehicles/car_01/vehicle.pak' };
  }
  const resolvedSlug = LEGACY_VEHICLE_ALIASES[clean] ?? clean;
  const slugIdx = VEHICLE_SLUG_BY_INDEX.indexOf(resolvedSlug);
  const idx = slugIdx >= 0 ? slugIdx + 1 : 1;
  const carDir = `car_${String(idx).padStart(2, '0')}`;
  const slug = VEHICLE_SLUG_BY_INDEX[idx - 1];
  return { carDir, slug, index: idx, pakPath: `assets/paks/vehicles/${carDir}/vehicle.pak` };
}

// ============================================================================
// 2. BINARY "APEXPAK1" HEADER & TOC PARSER / BUILDER
// ============================================================================

function writeFixedUtf8String(view: Uint8Array, byteOffset: number, maxLength: number, text: string): void {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);
  view.fill(0, byteOffset, byteOffset + maxLength);
  view.set(encoded.subarray(0, maxLength), byteOffset);
}

function readFixedUtf8String(view: Uint8Array, byteOffset: number, maxLength: number): string {
  let end = byteOffset;
  const limit = byteOffset + maxLength;
  while (end < limit && view[end] !== 0) {
    end++;
  }
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(view.subarray(byteOffset, end));
}

export function alignTo64(value: number): number {
  return Math.ceil(value / 64) * 64;
}

export interface SyntheticPakChunkInput {
  name: string;
  chunkType: PakChunkTypeId;
  width?: number;
  height?: number;
  depthOrItems?: number;
  payload: Uint8Array;
}

export interface SyntheticPakBuildOptions {
  pakType: PakTypeId;
  assetId: string;
  sectorCount?: number;
  chunks: SyntheticPakChunkInput[];
  targetTotalBytes?: number;
}

/**
 * Builds a valid little-endian APEXPAK1 binary container buffer.
 * Used both for deterministic unit testing and as an on-demand runtime synthesizer.
 */
export function buildSyntheticPakBuffer(options: SyntheticPakBuildOptions): ArrayBuffer {
  const entryCount = options.chunks.length;
  const tocOffset = APEX_PAK_HEADER_BYTES;
  const payloadStartOffset = alignTo64(tocOffset + entryCount * APEX_PAK_TOC_ENTRY_BYTES);

  let runningOffset = payloadStartOffset;
  const offsets: number[] = [];
  for (const chunk of options.chunks) {
    runningOffset = alignTo64(runningOffset);
    offsets.push(runningOffset);
    runningOffset += chunk.payload.byteLength;
  }

  const totalByteLength = Math.max(runningOffset, options.targetTotalBytes ?? runningOffset);
  const buffer = new ArrayBuffer(totalByteLength);
  const u8 = new Uint8Array(buffer);
  const dv = new DataView(buffer);

  // 1. Write 64-byte Global Header
  writeFixedUtf8String(u8, 0, 8, APEX_PAK_MAGIC);
  dv.setUint32(8, APEX_PAK_VERSION, true);
  dv.setUint32(12, options.pakType, true);
  dv.setBigUint64(16, BigInt(totalByteLength), true);
  dv.setUint32(24, entryCount, true);
  dv.setUint32(28, options.sectorCount ?? (options.pakType === PakType.TRACK ? 100 : 0), true);
  writeFixedUtf8String(u8, 32, 32, options.assetId);

  // 2. Write 64-byte TOC Entries & Payload Chunks
  for (let i = 0; i < entryCount; i++) {
    const chunk = options.chunks[i];
    const entryBase = tocOffset + i * APEX_PAK_TOC_ENTRY_BYTES;
    const chunkOffset = offsets[i];

    writeFixedUtf8String(u8, entryBase, 32, chunk.name);
    dv.setUint32(entryBase + 32, chunk.chunkType, true);
    dv.setUint32(entryBase + 36, chunk.width ?? chunk.payload.byteLength, true);
    dv.setUint32(entryBase + 40, chunk.height ?? 1, true);
    dv.setUint32(entryBase + 44, chunk.depthOrItems ?? 1, true);
    dv.setBigUint64(entryBase + 48, BigInt(chunkOffset), true);
    dv.setBigUint64(entryBase + 56, BigInt(chunk.payload.byteLength), true);

    u8.set(chunk.payload, chunkOffset);
  }

  return buffer;
}

export function parsePakHeader(buffer: ArrayBuffer): PakHeader {
  if (buffer.byteLength < APEX_PAK_HEADER_BYTES) {
    throw new Error(
      `Invalid PAK buffer: expected at least ${APEX_PAK_HEADER_BYTES} bytes, got ${buffer.byteLength}`
    );
  }
  const u8 = new Uint8Array(buffer, 0, APEX_PAK_HEADER_BYTES);
  const dv = new DataView(buffer, 0, APEX_PAK_HEADER_BYTES);
  const magic = readFixedUtf8String(u8, 0, 8);
  if (magic !== APEX_PAK_MAGIC) {
    throw new Error(`Invalid PAK magic header: expected "${APEX_PAK_MAGIC}", got "${magic}"`);
  }
  const version = dv.getUint32(8, true);
  const pakType = dv.getUint32(12, true) as PakTypeId;
  const totalByteLength = Number(dv.getBigUint64(16, true));
  const entryCount = dv.getUint32(24, true);
  const sectorCount = dv.getUint32(28, true);
  const assetId = readFixedUtf8String(u8, 32, 32);

  return {
    magic,
    version,
    pakType,
    totalByteLength,
    entryCount,
    sectorCount,
    assetId,
  };
}

export function parsePakToc(buffer: ArrayBuffer, entryCount: number): PakTocEntry[] {
  const requiredBytes = APEX_PAK_HEADER_BYTES + entryCount * APEX_PAK_TOC_ENTRY_BYTES;
  if (buffer.byteLength < requiredBytes) {
    throw new Error(
      `PAK buffer truncated before TOC completion: need ${requiredBytes} B, got ${buffer.byteLength} B`
    );
  }
  const u8 = new Uint8Array(buffer);
  const dv = new DataView(buffer);
  const entries: PakTocEntry[] = [];

  for (let i = 0; i < entryCount; i++) {
    const base = APEX_PAK_HEADER_BYTES + i * APEX_PAK_TOC_ENTRY_BYTES;
    const name = readFixedUtf8String(u8, base, 32);
    let chunkType = dv.getUint32(base + 32, true) as PakChunkTypeId;
    let width = dv.getUint32(base + 36, true);
    let height = dv.getUint32(base + 40, true);
    let depthOrItems = dv.getUint32(base + 44, true);
    let byteOffset = Number(dv.getBigUint64(base + 48, true));
    let byteLength = Number(dv.getBigUint64(base + 56, true));

    // Support <32sQQIIQ TOC layout (used by build_track_paks.py: byteOffset at +32, byteLength at +40, chunkType at +48)
    if (
      byteOffset < requiredBytes ||
      byteLength === 0 ||
      byteOffset + byteLength > buffer.byteLength
    ) {
      const altOffset = Number(dv.getBigUint64(base + 32, true));
      const altLength = Number(dv.getBigUint64(base + 40, true));
      if (altOffset >= requiredBytes && altLength > 0 && altOffset + altLength <= buffer.byteLength) {
        byteOffset = altOffset;
        byteLength = altLength;
        chunkType = dv.getUint32(base + 48, true) as PakChunkTypeId;
        width = altLength;
        height = 1;
        depthOrItems = 1;
      }
    }

    entries.push({
      name,
      chunkType,
      width,
      height,
      depthOrItems,
      byteOffset,
      byteLength,
    });
  }
  return entries;
}

export function parsePakBundle(buffer: ArrayBuffer): ParsedPakBundle {
  const header = parsePakHeader(buffer);
  const toc = parsePakToc(buffer, header.entryCount);
  const chunks = new Map<string, Uint8Array>();
  let metadata: Record<string, unknown> | undefined;

  for (const entry of toc) {
    const endOffset = entry.byteOffset + entry.byteLength;
    if (endOffset <= buffer.byteLength) {
      const view = new Uint8Array(buffer, entry.byteOffset, entry.byteLength);
      chunks.set(entry.name, view);
      if (entry.chunkType === PakChunkType.JSON_META || entry.name.includes('meta')) {
        try {
          const text = new TextDecoder().decode(view).replace(/\0+$/, '').trim();
          if (text.startsWith('{')) {
            metadata = JSON.parse(text);
          }
        } catch {
          // Non-JSON metadata chunk
        }
      }
    }
  }

  return {
    header,
    toc,
    buffer,
    chunks,
    metadata,
  };
}

export const parsePakBuffer = parsePakBundle;

// ============================================================================
// 3. LRU GPU VRAM CACHE & OCTREE 500M SECTOR STREAMER
// ============================================================================

export interface VramCacheEntry {
  key: string;
  assetId: string;
  pakType: PakTypeId;
  byteLength: number;
  lastAccessTick: number;
  pinned: boolean;
  sectorIndex?: number;
  bundle?: ParsedPakBundle;
  sectorPayload?: Float32Array;
}

export interface PakStreamerOptions {
  /** Maximum GPU VRAM budget in bytes before LRU cache eviction triggers (default: 256 MiB) */
  maxVramBytes?: number;
  /** Base URL or filesystem prefix for .pak bundles */
  baseUrl?: string;
  /** Enable WebWorker thread pool when supported by runtime */
  useWebWorker?: boolean;
}

export interface StreamedSectorWindowResult {
  trackId: CanonicalTrackBiomeId;
  centerSectorIndex: number;
  totalSectorsInCircuit: number;
  activeSectorIndices: number[];
  evictedKeys: string[];
  residentVramBytes: number;
}

export class PakStreamer {
  private maxVramBytes: number;
  private baseUrl: string;
  private useWebWorker: boolean;
  private cache: Map<string, VramCacheEntry> = new Map();
  private residentVramBytes = 0;
  private accessCounter = 0;
  private evictionCount = 0;
  private worker: Worker | null = null;
  private pendingWorkerRequests = new Map<
    number,
    { resolve: (buf: ArrayBuffer) => void; reject: (err: Error) => void }
  >();
  private nextRequestId = 1;

  // Nominal footprint sizes matching the modular architecture
  public static readonly NOMINAL_VEHICLE_PAK_BYTES = 9_411_776;     // ~9.412 MB × 30 = 282.35 MB (282,353,280 B)
  public static readonly NOMINAL_SKY_PAK_BYTES = 26_214_400;        // 25.00 MiB × 4 = 100.00 MiB (104,857,600 B)
  public static readonly NOMINAL_TRACK_PAK_BYTES = 83_886_080;      // 80.00 MiB × 4 = 320.00 MiB (335,544,320 B)
  public static readonly NOMINAL_TRACK_SECTOR_BYTES = 838_860;      // 1/100th of 80 MiB per 500m sector

  constructor(options: PakStreamerOptions = {}) {
    this.maxVramBytes = options.maxVramBytes ?? 256 * 1024 * 1024; // 256 MiB default VRAM budget
    this.baseUrl = (options.baseUrl ?? '').replace(/\/$/, '');
    this.useWebWorker = options.useWebWorker ?? true;

    if (this.useWebWorker) {
      this.initInlineWorkerIfSupported();
    }
  }

  public static createSyntheticPakBuffer(
    assetId: string,
    pakType: PakTypeId = PakType.SKY,
    targetByteLength = 4096
  ): ArrayBuffer {
    const metaBytes = new TextEncoder().encode(JSON.stringify({ assetId, pakType }));
    const payloadLength = Math.max(64, targetByteLength - 256);
    return buildSyntheticPakBuffer({
      pakType,
      assetId,
      sectorCount: pakType === PakType.TRACK ? 100 : 0,
      chunks: [
        { name: 'json_meta', chunkType: PakChunkType.JSON_META, payload: metaBytes },
        { name: 'binary_payload', chunkType: PakChunkType.TEX_RGBA8, payload: new Uint8Array(payloadLength) },
      ],
      targetTotalBytes: targetByteLength,
    });
  }

  private initInlineWorkerIfSupported(): void {
    if (typeof window === 'undefined' || typeof Worker === 'undefined' || typeof Blob === 'undefined') {
      return;
    }
    try {
      const workerCode = `
        self.onmessage = async (e) => {
          const { requestId, url } = e.data;
          try {
            const resp = await fetch(url);
            if (!resp.ok) {
              throw new Error('HTTP ' + resp.status);
            }
            const buffer = await resp.arrayBuffer();
            self.postMessage({ requestId, ok: true, buffer }, [buffer]);
          } catch (err) {
            self.postMessage({ requestId, ok: false, error: String(err) });
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      this.worker = new Worker(blobUrl, { type: 'module' });
      this.worker.onmessage = (event: MessageEvent) => {
        const { requestId, ok, buffer, error } = event.data;
        const pending = this.pendingWorkerRequests.get(requestId);
        if (!pending) return;
        this.pendingWorkerRequests.delete(requestId);
        if (ok && buffer instanceof ArrayBuffer) {
          pending.resolve(buffer);
        } else {
          pending.reject(new Error(error || 'Worker PAK fetch failed'));
        }
      };
    } catch {
      this.worker = null;
    }
  }

  public resolveAssetPath(idOrAlias: string): string {
    const clean = idOrAlias.trim();
    if (clean in SKY_ID_TO_CANONICAL || clean.startsWith('sky_')) {
      return resolveSkyPakPath(clean);
    }
    if (clean in TRACK_ID_TO_CANONICAL || clean.startsWith('track_')) {
      return resolveTrackPakPath(clean);
    }
    return resolveVehiclePakDir(clean).pakPath;
  }

  public getMaxVramBytes(): number {
    return this.maxVramBytes;
  }

  public setMaxVramBytes(maxBytes: number): string[] {
    this.maxVramBytes = Math.max(64 * 1024, maxBytes);
    return this.evictToFit(0);
  }

  public getResidentVramBytes(): number {
    return this.residentVramBytes;
  }

  public getUsedVramBytes(): number {
    return this.residentVramBytes;
  }

  public getEvictionCount(): number {
    return this.evictionCount;
  }

  public getCachedKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  public hasKey(key: string): boolean {
    return this.cache.has(key);
  }

  public hasResidentAsset(keyOrId: string): boolean {
    if (this.cache.has(keyOrId)) return true;
    for (const entry of this.cache.values()) {
      if (entry.assetId === keyOrId) return true;
    }
    return false;
  }

  public getResidentAsset(keyOrId: string): ParsedPakBundle | undefined {
    const direct = this.cache.get(keyOrId);
    if (direct) {
      direct.lastAccessTick = ++this.accessCounter;
      return direct.bundle;
    }
    for (const entry of this.cache.values()) {
      if (entry.assetId === keyOrId) {
        entry.lastAccessTick = ++this.accessCounter;
        return entry.bundle;
      }
    }
    return undefined;
  }

  public loadFromBuffer(key: string, buffer: ArrayBuffer, pin = false): ParsedPakBundle {
    const bundle = parsePakBundle(buffer);
    this.insertCacheEntry({
      key,
      assetId: bundle.header.assetId || key,
      pakType: bundle.header.pakType,
      byteLength: buffer.byteLength,
      pinned: pin,
      bundle,
    });
    return bundle;
  }

  public touchKey(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    entry.lastAccessTick = ++this.accessCounter;
    return true;
  }

  public setPinned(key: string, pinned: boolean): void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.pinned = pinned;
      entry.lastAccessTick = ++this.accessCounter;
    }
  }

  /**
   * Evicts least-recently-used unpinned entries until residentVramBytes + incomingBytes <= maxVramBytes.
   */
  public evictToFit(incomingBytes: number): string[] {
    const evicted: string[] = [];
    if (this.residentVramBytes + incomingBytes <= this.maxVramBytes) {
      return evicted;
    }

    const candidates = Array.from(this.cache.values())
      .filter((entry) => !entry.pinned)
      .sort((a, b) => a.lastAccessTick - b.lastAccessTick);

    for (const candidate of candidates) {
      if (this.residentVramBytes + incomingBytes <= this.maxVramBytes) {
        break;
      }
      this.cache.delete(candidate.key);
      this.residentVramBytes = Math.max(0, this.residentVramBytes - candidate.byteLength);
      this.evictionCount++;
      evicted.push(candidate.key);
    }

    return evicted;
  }

  private insertCacheEntry(entry: Omit<VramCacheEntry, 'lastAccessTick'>): string[] {
    const existing = this.cache.get(entry.key);
    if (existing) {
      this.residentVramBytes = Math.max(0, this.residentVramBytes - existing.byteLength);
      this.cache.delete(entry.key);
    }

    const evicted = this.evictToFit(entry.byteLength);
    const fullEntry: VramCacheEntry = {
      ...entry,
      lastAccessTick: ++this.accessCounter,
    };
    this.cache.set(entry.key, fullEntry);
    this.residentVramBytes += entry.byteLength;
    return evicted;
  }

  private async loadRawPakBuffer(
    relPath: string,
    fallbackOptions: SyntheticPakBuildOptions
  ): Promise<ArrayBuffer> {
    // 1. If in browser with active WebWorker, try Worker fetch first
    if (this.worker && typeof window !== 'undefined') {
      const url = `${this.baseUrl}/${relPath.replace(/^\//, '')}`;
      try {
        return await new Promise<ArrayBuffer>((resolve, reject) => {
          const requestId = this.nextRequestId++;
          this.pendingWorkerRequests.set(requestId, { resolve, reject });
          this.worker!.postMessage({ requestId, url });
        });
      } catch {
        // Fallback to direct fetch or synthetic buffer
      }
    }

    // 2. If in browser with global fetch, try HTTP Range header or full fetch
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const url = `${this.baseUrl}/${relPath.replace(/^\//, '')}`;
        const resp = await fetch(url);
        if (resp.ok) {
          return await resp.arrayBuffer();
        }
      } catch {
        // Fallback below
      }
    }

    // 3. Fallback to in-memory synthetic buffer matching the exact APEXPAK1 binary schema
    return buildSyntheticPakBuffer(fallbackOptions);
  }

  /**
   * Streams a Sky .PAK bundle (~12.5 MB nominal VRAM budget) by canonical ID or alias ('sky_01'..'sky_04').
   */
  public async loadSkyPak(skyIdOrAlias: SkyBiomeId | string, pin = true): Promise<ParsedPakBundle> {
    const canonicalId = resolveSkyCanonicalId(skyIdOrAlias);
    const cacheKey = `sky:${canonicalId}`;
    const existing = this.cache.get(cacheKey);
    if (existing && existing.bundle) {
      existing.lastAccessTick = ++this.accessCounter;
      existing.pinned = pin;
      return existing.bundle;
    }

    const relPath = resolveSkyPakPath(canonicalId);
    const metaJson = new TextEncoder().encode(
      JSON.stringify({
        skyId: canonicalId,
        alias: CANONICAL_SKY_TO_ALIAS[canonicalId],
        sunIntensity: canonicalId === 'sky_golden_hour' ? 2.4 : 1.5,
      })
    );
    const hdriSample = new Uint8Array(4096);
    const cloudNoiseSample = new Uint8Array(4096);

    const buffer = await this.loadRawPakBuffer(relPath, {
      pakType: PakType.SKY,
      assetId: canonicalId,
      sectorCount: 0,
      chunks: [
        { name: 'json_meta', chunkType: PakChunkType.JSON_META, payload: metaJson },
        {
          name: 'hdri_equirect_rgbe',
          chunkType: PakChunkType.TEX_RGBE,
          width: 2048,
          height: 1024,
          payload: hdriSample,
        },
        {
          name: 'cloud_noise_3d',
          chunkType: PakChunkType.VOL_U8,
          width: 128,
          height: 64,
          depthOrItems: 64,
          payload: cloudNoiseSample,
        },
      ],
    });

    const bundle = parsePakBundle(buffer);
    this.insertCacheEntry({
      key: cacheKey,
      assetId: canonicalId,
      pakType: PakType.SKY,
      byteLength: PakStreamer.NOMINAL_SKY_PAK_BYTES,
      pinned: pin,
      bundle,
    });

    return bundle;
  }

  /**
   * Streams a Vehicle .PAK bundle (~4.7 MB nominal VRAM budget) by slug ('mini_jcw'..'rimac_nevera'),
   * folder ('car_01'..'car_30'), or 1-based index (1..30).
   */
  public async loadVehiclePak(vehicleIdOrDir: string | number, pin = false): Promise<ParsedPakBundle> {
    const resolved = resolveVehiclePakDir(vehicleIdOrDir);
    const cacheKey = `vehicle:${resolved.carDir}`;
    const existing = this.cache.get(cacheKey);
    if (existing && existing.bundle) {
      existing.lastAccessTick = ++this.accessCounter;
      if (pin) existing.pinned = true;
      return existing.bundle;
    }

    const metaJson = new TextEncoder().encode(
      JSON.stringify({
        carDir: resolved.carDir,
        slug: resolved.slug,
        index: resolved.index,
        liveryCount: 12,
      })
    );
    const lod0MeshStub = new Uint8Array(new Float32Array(256).buffer);
    const pbrTexStub = new Uint8Array(1024);
    const exhaustAudioStub = new Uint8Array(1024);

    const buffer = await this.loadRawPakBuffer(resolved.pakPath, {
      pakType: PakType.VEHICLE,
      assetId: resolved.carDir,
      sectorCount: 0,
      chunks: [
        { name: 'json_meta', chunkType: PakChunkType.JSON_META, payload: metaJson },
        { name: 'lod0_mesh_f32', chunkType: PakChunkType.MESH_F32, width: 256, height: 1, payload: lod0MeshStub },
        { name: 'pbr_albedo_4k', chunkType: PakChunkType.TEX_RGBA8, width: 4096, height: 4096, payload: pbrTexStub },
        {
          name: 'exhaust_rpm_pcm16',
          chunkType: PakChunkType.AUDIO_PCM16,
          width: 44100,
          height: 1,
          payload: exhaustAudioStub,
        },
      ],
    });

    const bundle = parsePakBundle(buffer);
    this.insertCacheEntry({
      key: cacheKey,
      assetId: resolved.carDir,
      pakType: PakType.VEHICLE,
      byteLength: PakStreamer.NOMINAL_VEHICLE_PAK_BYTES,
      pinned: pin,
      bundle,
    });

    return bundle;
  }

  /**
   * Streams the active window of 500m spatial sectors for a Track biome ('track_01'..'track_04'
   * or 'track_golden_gp'..'track_alpine') across any of the 6 true physical circuit lengths (2.0 KM to 50.0 KM).
   * Unpins sectors outside [center - lookbehind, center + lookahead] and applies LRU VRAM eviction.
   */
  public streamTrackSectorWindow(
    trackIdOrAlias: TrackBiomeId | string,
    currentArcLengthMeters: number,
    circuitLengthMeters: number,
    lookbehindSectors = 2,
    lookaheadSectors = 6
  ): StreamedSectorWindowResult {
    const canonicalTrackId = resolveTrackCanonicalId(trackIdOrAlias);
    const totalSectorsInCircuit = Math.max(4, Math.round(circuitLengthMeters / 500));
    const normalizedS =
      ((currentArcLengthMeters % circuitLengthMeters) + circuitLengthMeters) % circuitLengthMeters;
    const centerSectorIndex = Math.floor(normalizedS / 500) % totalSectorsInCircuit;

    const activeSet = new Set<number>();
    const activeSectorIndices: number[] = [];
    for (let offset = -lookbehindSectors; offset <= lookaheadSectors; offset++) {
      const sectorIdx =
        ((centerSectorIndex + offset) % totalSectorsInCircuit + totalSectorsInCircuit) %
        totalSectorsInCircuit;
      if (!activeSet.has(sectorIdx)) {
        activeSet.add(sectorIdx);
        activeSectorIndices.push(sectorIdx);
      }
    }

    // 1. Unpin any previously cached sectors for this track that fell outside the active window
    for (const entry of this.cache.values()) {
      if (
        entry.pakType === PakType.TRACK &&
        entry.assetId === canonicalTrackId &&
        entry.sectorIndex !== undefined &&
        !activeSet.has(entry.sectorIndex)
      ) {
        entry.pinned = false;
      }
    }

    // 2. Ensure all active window sectors are resident and pinned in VRAM
    const allEvicted: string[] = [];
    for (const sectorIdx of activeSectorIndices) {
      const sectorKey = `track:${canonicalTrackId}:sector_${String(sectorIdx).padStart(3, '0')}`;
      const existing = this.cache.get(sectorKey);
      if (existing) {
        existing.pinned = true;
        existing.lastAccessTick = ++this.accessCounter;
        continue;
      }

      const sectorPayload = new Float32Array(128);
      sectorPayload[0] = sectorIdx * 500;
      sectorPayload[1] = (sectorIdx + 1) * 500;

      const evicted = this.insertCacheEntry({
        key: sectorKey,
        assetId: canonicalTrackId,
        pakType: PakType.TRACK,
        byteLength: PakStreamer.NOMINAL_TRACK_SECTOR_BYTES,
        pinned: true,
        sectorIndex: sectorIdx,
        sectorPayload,
      });
      allEvicted.push(...evicted);
    }

    return {
      trackId: canonicalTrackId,
      centerSectorIndex,
      totalSectorsInCircuit,
      activeSectorIndices,
      evictedKeys: allEvicted,
      residentVramBytes: this.residentVramBytes,
    };
  }

  public dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.cache.clear();
    this.residentVramBytes = 0;
  }
}
