// src/ui/ResponsiveLayout.ts
// Apex Grand Prix: Next-Gen Responsive Layout Engine & Modern Color Profile

export interface ViewportMetrics {
  width: number;
  height: number;
  aspectRatio: number;
  isUltrawide: boolean; // > 2.0 (e.g. 21:9, 32:9)
  isMobile: boolean;    // < 1.0 (portrait) or touch handheld
  isTablet: boolean;    // 1.2 to 1.5 (e.g. 4:3 iPad)
  safeAreaTop: number;
  safeAreaBottom: number;
  scaleFactor: number;
}

/**
 * Modern High-Performance Responsive Layout and Styling Framework.
 */
export class ResponsiveLayoutEngine {
  // Official Designated Modern Color Palette Profile
  public static readonly PALETTE = {
    VOID_DARK: '#0B0E14',         // Deep Cyber Charcoal
    SURFACE_TITANIUM: '#121721',  // Aerospace Titanium Surface
    PANEL_CARBON: '#1A2230',      // Carbon Fiber Accent Panel
    ELECTRIC_CYAN: '#00F0FF',     // Hyper Velocity Cyan Glow
    NITRO_AMBER: '#FF5E00',       // Twin-Turbo Nitro Amber
    PODIUM_GOLD: '#FFD700',       // Championship Trophy Gold
    TELEMETRY_LIME: '#39FF14',    // Apex Racing Apex Lime
    REDLINE_CRIMSON: '#FF1E56',   // High-RPM Redline Crimson
    POLAR_WHITE: '#F0F4F8',       // High-Contrast Cockpit White
    MUTED_TITANIUM: '#8A99AD',    // Subdued HUD Secondary Label
  } as const;

  private static instance: ResponsiveLayoutEngine | null = null;
  private metrics: ViewportMetrics = this.computeMetrics();
  private listeners: ((metrics: ViewportMetrics) => void)[] = [];

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.handleResize(), { passive: true });
      window.addEventListener('orientationchange', () => this.handleResize(), { passive: true });
    }
  }

  public static getInstance(): ResponsiveLayoutEngine {
    if (!this.instance) {
      this.instance = new ResponsiveLayoutEngine();
    }
    return this.instance;
  }

  public getMetrics(): ViewportMetrics {
    return this.metrics;
  }

  private computeMetrics(): ViewportMetrics {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const height = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const aspectRatio = width / Math.max(1, height);

    return {
      width,
      height,
      aspectRatio,
      isUltrawide: aspectRatio > 2.05,
      isMobile: width < 768 || aspectRatio < 1.0,
      isTablet: width >= 768 && width <= 1024 && aspectRatio < 1.6,
      safeAreaTop: 0,
      safeAreaBottom: 0,
      scaleFactor: Math.min(Math.max(width / 1920, 0.65), 1.75),
    };
  }

  private handleResize(): void {
    this.metrics = this.computeMetrics();
    for (const listener of this.listeners) {
      listener(this.metrics);
    }
  }

  public onResize(cb: (metrics: ViewportMetrics) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  /**
   * Smooth Hermite interpolation for UI transitions and needle gauges.
   */
  public static smoothHermite(start: number, end: number, t: number): number {
    const clampedT = Math.max(0, Math.min(1, t));
    const smoothT = clampedT * clampedT * (3 - 2 * clampedT);
    return start + (end - start) * smoothT;
  }

  /**
   * Calculates responsive relative coordinates clamped to safe boundary zones.
   */
  public clampCoordinate(val: number, minVal: number, maxVal: number): number {
    return Math.max(minVal, Math.min(maxVal, val));
  }
}

export const responsiveLayout = ResponsiveLayoutEngine.getInstance();
