// src/streaming/VirtualAssetPipeline.ts
// Arbitrary Scale Asset Streaming Pipeline: Chunk-Based Virtualized Loading & Hard Memory Bounding

export interface VirtualChunkPage {
  chunkId: string;
  assetType: 'TRACK_SECTOR' | 'VEHICLE_LOD' | 'SKY_HDRI' | 'AUDIO_BANK';
  byteOffset: number;
  byteLength: number;
  lastAccessTick: number;
  priority: number;
  isResident: boolean;
  data: Uint8Array | null;
  onEvict?: () => void;
}

export interface VirtualPipelineConfig {
  /** Maximum resident RAM/VRAM budget in bytes before garbage collection triggers (default: 256 MiB) */
  maxMemoryBudgetBytes?: number;
  /** Range request batch size in bytes */
  pageSizeBytes?: number;
  /** Base URL for asset streaming */
  baseUrl?: string;
}

export class VirtualAssetPipeline {
  private maxMemoryBytes: number;
  private pageSizeBytes: number;
  private baseUrl: string;
  private pages: Map<string, VirtualChunkPage> = new Map();
  private residentBytes = 0;
  private accessTick = 0;
  private activeFetches: Map<string, Promise<Uint8Array>> = new Map();

  constructor(config: VirtualPipelineConfig = {}) {
    this.maxMemoryBytes = config.maxMemoryBudgetBytes ?? 256 * 1024 * 1024; // 256 MiB default
    this.pageSizeBytes = config.pageSizeBytes ?? 1024 * 1024; // 1 MiB pages
    this.baseUrl = (config.baseUrl ?? '').replace(/\/$/, '');
  }

  public getResidentBytes(): number {
    return this.residentBytes;
  }

  public getMaxMemoryBytes(): number {
    return this.maxMemoryBytes;
  }

  public getResidentPageCount(): number {
    let count = 0;
    for (const page of this.pages.values()) {
      if (page.isResident) count++;
    }
    return count;
  }

  /**
   * Registers a chunk page in the virtual address table without loading it into memory.
   */
  public registerVirtualPage(
    chunkId: string,
    assetType: VirtualChunkPage['assetType'],
    byteOffset: number,
    byteLength: number,
    onEvict?: () => void
  ): void {
    if (this.pages.has(chunkId)) return;
    this.pages.set(chunkId, {
      chunkId,
      assetType,
      byteOffset,
      byteLength,
      lastAccessTick: 0,
      priority: 0,
      isResident: false,
      data: null,
      onEvict,
    });
  }

  /**
   * Fetches a chunk into resident memory via HTTP range request or synthetic stream,
   * triggering automated LRU eviction if memory exceeds the hard budget.
   */
  public async demandChunk(chunkId: string, url: string, priority = 1): Promise<Uint8Array> {
    this.accessTick++;
    let page = this.pages.get(chunkId);
    if (!page) {
      // Auto-register virtual page
      this.registerVirtualPage(chunkId, 'TRACK_SECTOR', 0, 0);
      page = this.pages.get(chunkId)!;
    }

    page.lastAccessTick = this.accessTick;
    page.priority = priority;

    if (page.isResident && page.data) {
      return page.data;
    }

    if (this.activeFetches.has(chunkId)) {
      return this.activeFetches.get(chunkId)!;
    }

    const fetchPromise = this.executePagedFetch(page, url);
    this.activeFetches.set(chunkId, fetchPromise);

    try {
      const data = await fetchPromise;
      return data;
    } finally {
      this.activeFetches.delete(chunkId);
    }
  }

  private async executePagedFetch(page: VirtualChunkPage, url: string): Promise<Uint8Array> {
    const fullUrl = this.baseUrl ? `${this.baseUrl}/${url.replace(/^\/+/, '')}` : url;

    const headers: Record<string, string> = {};
    if (page.byteLength > 0) {
      headers['Range'] = `bytes=${page.byteOffset}-${page.byteOffset + page.byteLength - 1}`;
    }

    const resp = await fetch(fullUrl, { headers });
    if (!resp.ok && resp.status !== 206) {
      throw new Error(`Failed to stream virtual chunk [${page.chunkId}]: HTTP ${resp.status}`);
    }

    const buf = await resp.arrayBuffer();
    const u8 = new Uint8Array(buf);

    page.byteLength = u8.byteLength;
    this.enforceBudget(page.byteLength);

    page.data = u8;
    page.isResident = true;
    this.residentBytes += page.byteLength;

    return u8;
  }

  /**
   * Strict proactive Garbage Collection & LRU Eviction loop.
   * Evicts least-recently-used pages until resident bytes are strictly below budget.
   */
  public enforceBudget(incomingBytes: number = 0): void {
    if (this.residentBytes + incomingBytes <= this.maxMemoryBytes) {
      return;
    }

    // Collect all resident pages sorted by priority ascending, then access tick ascending
    const residentPages: VirtualChunkPage[] = [];
    for (const p of this.pages.values()) {
      if (p.isResident && p.data) {
        residentPages.push(p);
      }
    }

    residentPages.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.lastAccessTick - b.lastAccessTick;
    });

    for (const victim of residentPages) {
      if (this.residentBytes + incomingBytes <= this.maxMemoryBytes) {
        break;
      }
      this.evictPage(victim);
    }
  }

  private evictPage(page: VirtualChunkPage): void {
    if (!page.isResident || !page.data) return;

    if (page.onEvict) {
      try {
        page.onEvict();
      } catch {}
    }

    this.residentBytes = Math.max(0, this.residentBytes - page.byteLength);
    page.data = null;
    page.isResident = false;
  }

  /**
   * Purges all non-essential resident pages immediately.
   */
  public purgeAll(): void {
    for (const page of this.pages.values()) {
      if (page.isResident) {
        this.evictPage(page);
      }
    }
    this.residentBytes = 0;
  }
}

export const virtualAssetPipeline = new VirtualAssetPipeline();
