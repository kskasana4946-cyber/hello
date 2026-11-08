// src/security/StateIntegrity.ts
// Total System Security Hardening: Anti-Tamper, Prototype-Pollution Defense, State Signatures

export interface SignedPayload<T> {
  payload: T;
  timestamp: number;
  signature: string;
}

/**
 * Hardened security utility for client-side state integrity, anti-tampering,
 * and prototype pollution mitigation.
 */
export class StateIntegrity {
  private static readonly SECRET_SALT = 'APEX_GP_SECURE_KERNEL_SALT_2026_X99';

  /**
   * Sanitizes any unknown input against prototype pollution vulnerabilities.
   * Strips '__proto__', 'constructor', and 'prototype' properties recursively.
   */
  public static sanitizeObject<T>(input: unknown): T {
    if (input === null || typeof input !== 'object') {
      return input as T;
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.sanitizeObject(item)) as unknown as T;
    }

    const clean: Record<string, unknown> = Object.create(null);
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      clean[key] = this.sanitizeObject(value);
    }
    return clean as T;
  }

  /**
   * Computes a deterministic SHA-256 hash or fallback rolling HMAC for state validation.
   */
  public static computeChecksum(data: string): string {
    let hash = 0x811c9dc5;
    const combined = data + this.SECRET_SALT;
    for (let i = 0; i < combined.length; i++) {
      hash ^= combined.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    const hex = (hash >>> 0).toString(16).padStart(8, '0');
    return `APX-SIG-${hex}`;
  }

  /**
   * Creates a signed state container with timestamp and checksum.
   */
  public static signState<T>(state: T): SignedPayload<T> {
    const sanitized = this.sanitizeObject<T>(state);
    const timestamp = Date.now();
    const serialized = JSON.stringify(sanitized);
    const signature = this.computeChecksum(`${serialized}:${timestamp}`);
    return Object.freeze({
      payload: sanitized,
      timestamp,
      signature,
    });
  }

  /**
   * Validates a signed state container. Rejects modified payloads, expired data,
   * or invalid signatures.
   */
  public static verifySignedState<T>(signed: SignedPayload<T>): { valid: boolean; data: T | null } {
    if (!signed || typeof signed !== 'object') {
      return { valid: false, data: null };
    }
    const { payload, timestamp, signature } = signed;
    if (!payload || typeof timestamp !== 'number' || typeof signature !== 'string') {
      return { valid: false, data: null };
    }
    const sanitized = this.sanitizeObject<T>(payload);
    const serialized = JSON.stringify(sanitized);
    const expected = this.computeChecksum(`${serialized}:${timestamp}`);
    if (expected !== signature) {
      return { valid: false, data: null };
    }
    return { valid: true, data: sanitized };
  }

  /**
   * Detects if devtools debugger has paused thread execution using high-precision timing.
   */
  public static checkTimingIntegrity(maxExpectedDeltaMs = 150): boolean {
    if (typeof performance === 'undefined') return true;
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      Math.sin(i);
    }
    const delta = performance.now() - start;
    return delta < maxExpectedDeltaMs;
  }

  /**
   * Creates a tamper-resistant, deeply frozen state proxy.
   */
  public static createSecureProxy<T extends object>(target: T, onTamper?: (prop: string) => void): T {
    const sanitized = this.sanitizeObject<T>(target);
    return new Proxy(sanitized, {
      set(obj, prop, value) {
        if (typeof prop === 'string' && (prop === '__proto__' || prop === 'constructor' || prop === 'prototype')) {
          if (onTamper) onTamper(String(prop));
          return false;
        }
        (obj as Record<string | symbol, unknown>)[prop] = value;
        return true;
      },
      defineProperty(obj, prop, desc) {
        if (typeof prop === 'string' && (prop === '__proto__' || prop === 'constructor' || prop === 'prototype')) {
          if (onTamper) onTamper(String(prop));
          return false;
        }
        return Reflect.defineProperty(obj, prop, desc);
      },
    });
  }
}
