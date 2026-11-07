// src/career/ProgressionManager.ts
// Win-by-Win Career Unlock Ladder, Economy & Sandbox State Machine (M5: F33)
// 1 Win = +1 New Car (Wins 1..28 -> #3 golf_r .. #30 rimac_nevera)
// CR & Driver XP Economy across 6 performance categories
// Early CR purchase boundary validation & non-destructive Sandbox Unlock-All toggle

import { VehicleSpec } from '../core/types';
import {
  VEHICLE_ROSTER,
  VEHICLE_COUNT,
  getVehicleById,
  getVehicleByIndex,
} from '../vehicles/VehicleRoster';

export const PROGRESSION_STORAGE_KEY = 'apex_gp_progression_v1';
export const TIER_0_STARTER_IDS: readonly string[] = ['mini_jcw', 'hot_hatch'];

export interface CareerRewardBreakdown {
  podiumCredits: number;
  overtakeCredits: number;
  slipstreamCredits: number;
  driftCredits: number;
  stuntCredits: number;
  takedownCredits: number;
}

export interface RaceResultOptions {
  position?: number;
  overtakes?: number;
  slipstreamSec?: number;
  driftCombos?: number;
  stunts?: number;
  takedowns?: number;
  laps?: number;
}

export interface PostRaceCeremonyReport {
  position: number;
  podiumStageActive: boolean;
  turntableRevealActive: boolean;
  newlyUnlockedVehicle: VehicleSpec | null;
  turntableAngularVelRadSec: number;
  breakdown: CareerRewardBreakdown;
  totalEarnedCredits: number;
  totalEarnedXp: number;
  totalWins: number;
  credits: number;
  driverXp: number;
}

export interface PurchaseVehicleResult {
  purchased: boolean;
  alreadyUnlocked?: boolean;
  reason?: 'UNKNOWN_VEHICLE' | 'INSUFFICIENT_CREDITS';
  vehicleId?: string;
  requiredCredits?: number;
  deductedCredits?: number;
  credits: number;
  unlockedVehicleIds?: string[];
}

export interface SandboxToggleResult {
  sandboxUnlockedAll: boolean;
  totalWins: number;
  unlockedVehicleIds: string[];
}

export interface CareerProgressionState {
  totalWins: number;
  credits: number;
  driverXp: number;
  sandboxUnlockedAll: boolean;
  unlockedVehicleIds: string[];
  lastCeremonyReport: PostRaceCeremonyReport | null;
}

export interface IProgressionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

class MemoryStorageFallback implements IProgressionStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

export class ProgressionManager {
  private storage: IProgressionStorage;
  private readonly storageKey: string = PROGRESSION_STORAGE_KEY;

  public totalWins: number = 0;
  public credits: number = 0;
  public driverXp: number = 0;
  public sandboxUnlockedAll: boolean = false;
  public earnedOrPurchasedIds: Set<string> = new Set(TIER_0_STARTER_IDS);
  public lastCeremonyReport: PostRaceCeremonyReport | null = null;

  constructor(storage?: IProgressionStorage | Map<string, string>) {
    if (storage) {
      if (typeof (storage as IProgressionStorage).getItem === 'function') {
        this.storage = storage as IProgressionStorage;
      } else if (storage instanceof Map) {
        this.storage = {
          getItem: (k: string) => (storage as Map<string, string>).get(k) ?? null,
          setItem: (k: string, v: string) => { (storage as Map<string, string>).set(k, v); },
          removeItem: (k: string) => { (storage as Map<string, string>).delete(k); },
        };
      } else {
        this.storage = new MemoryStorageFallback();
      }
    } else if (typeof window !== 'undefined' && window.localStorage) {
      this.storage = window.localStorage;
    } else {
      this.storage = new MemoryStorageFallback();
    }

    const existing = this.storage.getItem(this.storageKey);
    if (existing) {
      this.loadFromStorage();
    } else {
      this.saveToStorage();
    }
  }

  /**
   * Resets career progression state to initial defaults (0 wins, 0 credits, Tier 0 cars).
   */
  public resetCareer(): void {
    this.totalWins = 0;
    this.credits = 0;
    this.driverXp = 0;
    this.sandboxUnlockedAll = false;
    this.earnedOrPurchasedIds = new Set(TIER_0_STARTER_IDS);
    this.lastCeremonyReport = null;
    this.saveToStorage();
  }

  /**
   * Saves career progression to persistence storage.
   */
  public saveToStorage(): void {
    try {
      const payload = JSON.stringify({
        totalWins: this.totalWins,
        credits: this.credits,
        driverXp: this.driverXp,
        earnedOrPurchasedIds: Array.from(this.earnedOrPurchasedIds),
      });
      this.storage.setItem(this.storageKey, payload);
    } catch {
      // Ignore storage write errors (e.g. quota exceeded)
    }
  }

  public save(): void {
    this.saveToStorage();
  }

  /**
   * Loads career progression from persistence storage or optional JSON override.
   * Gracefully handles corrupted, empty, or negative data by resetting to defaults.
   */
  public loadFromStorage(rawJsonOverride?: string): CareerProgressionState {
    try {
      const raw = rawJsonOverride !== undefined
        ? rawJsonOverride
        : this.storage.getItem(this.storageKey);

      if (!raw) {
        return this.getState();
      }

      const parsed = JSON.parse(raw);
      if (
        typeof parsed.totalWins !== 'number' ||
        parsed.totalWins < 0 ||
        typeof parsed.credits !== 'number' ||
        parsed.credits < 0
      ) {
        this.resetCareer();
        return this.getState();
      }

      this.totalWins = Math.floor(parsed.totalWins);
      this.credits = Math.floor(parsed.credits);
      this.driverXp = Math.max(0, Math.floor(parsed.driverXp || 0));

      const incomingIds: string[] = Array.isArray(parsed.earnedOrPurchasedIds)
        ? parsed.earnedOrPurchasedIds
        : [];

      this.earnedOrPurchasedIds = new Set([...TIER_0_STARTER_IDS, ...incomingIds]);

      // Ensure vehicles corresponding to current totalWins are unlocked
      for (const car of VEHICLE_ROSTER) {
        if (car.winsRequired <= this.totalWins) {
          this.earnedOrPurchasedIds.add(car.id);
        }
      }
    } catch {
      this.resetCareer();
    }

    return this.getState();
  }

  public load(rawJson?: string): CareerProgressionState {
    return this.loadFromStorage(rawJson);
  }

  /**
   * Returns list of currently unlocked vehicle IDs.
   * If Sandbox is active, returns all 30 vehicle IDs.
   * Otherwise returns all vehicles earned through wins or early CR purchases.
   */
  public getUnlockedVehicleIds(): string[] {
    if (this.sandboxUnlockedAll) {
      return VEHICLE_ROSTER.map((v) => v.id);
    }
    return VEHICLE_ROSTER
      .filter((v) => this.earnedOrPurchasedIds.has(v.id) || v.winsRequired <= this.totalWins)
      .map((v) => v.id);
  }

  /**
   * Checks whether a specific vehicle is currently unlocked.
   */
  public isVehicleUnlocked(vehicleIdOrIndex: string | number): boolean {
    if (this.sandboxUnlockedAll) return true;
    const spec = typeof vehicleIdOrIndex === 'number'
      ? getVehicleByIndex(vehicleIdOrIndex)
      : getVehicleById(vehicleIdOrIndex);

    if (!spec) return false;
    return this.earnedOrPurchasedIds.has(spec.id) || this.totalWins >= spec.winsRequired;
  }

  /**
   * Toggles the non-destructive [🔓 SANDBOX: UNLOCK ALL 30 CARS] mode.
   * When turned OFF, cleanly restores the authentic career progression state.
   */
  public toggleSandboxUnlockAll(forceState?: boolean): SandboxToggleResult {
    this.sandboxUnlockedAll = forceState !== undefined ? forceState : !this.sandboxUnlockedAll;
    return {
      sandboxUnlockedAll: this.sandboxUnlockedAll,
      totalWins: this.totalWins,
      unlockedVehicleIds: this.getUnlockedVehicleIds(),
    };
  }

  /**
   * Unconditionally unlocks all 30 vehicles in Sandbox mode.
   */
  public unlockAllSandBox(): SandboxToggleResult {
    return this.toggleSandboxUnlockAll(true);
  }

  public unlockAllSandbox(): SandboxToggleResult {
    return this.unlockAllSandBox();
  }

  /**
   * Early purchase of locked vehicle using accumulated Apex Credits (CR).
   * Rejects if credits < creditCost. Re-purchasing an already unlocked vehicle deducts 0 CR.
   */
  public purchaseVehicleWithCredits(vehicleIdOrPakDir: string): PurchaseVehicleResult {
    const spec = getVehicleById(vehicleIdOrPakDir);
    if (!spec) {
      return {
        purchased: false,
        reason: 'UNKNOWN_VEHICLE',
        credits: this.credits,
      };
    }

    // Check if already unlocked (either via wins or previous purchase)
    if (this.earnedOrPurchasedIds.has(spec.id) || this.totalWins >= spec.winsRequired) {
      this.earnedOrPurchasedIds.add(spec.id);
      return {
        purchased: true,
        alreadyUnlocked: true,
        deductedCredits: 0,
        credits: this.credits,
        vehicleId: spec.id,
        unlockedVehicleIds: this.getUnlockedVehicleIds(),
      };
    }

    // Boundary check: credits must be >= creditCost
    if (this.credits < spec.creditCost) {
      return {
        purchased: false,
        reason: 'INSUFFICIENT_CREDITS',
        requiredCredits: spec.creditCost,
        credits: this.credits,
        vehicleId: spec.id,
      };
    }

    // Deduct credits and unlock
    this.credits -= spec.creditCost;
    this.earnedOrPurchasedIds.add(spec.id);
    this.saveToStorage();

    return {
      purchased: true,
      alreadyUnlocked: false,
      vehicleId: spec.id,
      deductedCredits: spec.creditCost,
      credits: this.credits,
      unlockedVehicleIds: this.getUnlockedVehicleIds(),
    };
  }

  public purchaseVehicleWithCR(vehicleIdOrPakDir: string): PurchaseVehicleResult {
    return this.purchaseVehicleWithCredits(vehicleIdOrPakDir);
  }

  /**
   * Records completion of a race and calculates itemized CR and Driver XP rewards.
   * 1st place wins increment totalWins (1..31) and unlock the sequential vehicle (#4..#34).
   */
  public recordRaceResult(options: RaceResultOptions = {}): PostRaceCeremonyReport {
    const position = Math.max(1, Math.floor(Number(options.position ?? 1)));
    const overtakes = Math.max(0, Number(options.overtakes ?? 2));
    const slipstreamSec = Math.max(0, Number(options.slipstreamSec ?? 2.0));
    const driftCombos = Math.max(0, Number(options.driftCombos ?? 1));
    const stunts = Math.max(0, Number(options.stunts ?? 1));
    const takedowns = Math.max(0, Number(options.takedowns ?? 1));
    const laps = Math.max(1, Math.floor(Number(options.laps ?? 1)));

    // Itemized rewards calculation
    const podiumCredits =
      position === 1 ? 10000 * laps :
      position === 2 ? 6000 * laps :
      position === 3 ? 3500 * laps :
      1000 * laps;

    const overtakeCredits = overtakes * 450;
    const slipstreamCredits = Math.round(slipstreamSec * 300);
    const driftCredits = driftCombos * 600;
    const stuntCredits = stunts * 2500; // Stunt bonus: +2,500 CR per stunt
    const takedownCredits = takedowns * 1200;

    const breakdown: CareerRewardBreakdown = {
      podiumCredits,
      overtakeCredits,
      slipstreamCredits,
      driftCredits,
      stuntCredits,
      takedownCredits,
    };

    const totalEarnedCredits =
      podiumCredits +
      overtakeCredits +
      slipstreamCredits +
      driftCredits +
      stuntCredits +
      takedownCredits;

    const totalEarnedXp = Math.round(totalEarnedCredits * 0.25);

    this.credits += totalEarnedCredits;
    this.driverXp += totalEarnedXp;

    let newlyUnlockedVehicle: VehicleSpec | null = null;

    if (position === 1) {
      this.totalWins += 1;
      // Win-by-Win Ladder: Car #4 at Win 1 ... Car #34 at Win 31
      // Check if there is a car requiring exactly this win count that was not already unlocked
      const carToUnlock = VEHICLE_ROSTER.find((v) => v.winsRequired === this.totalWins);
      if (carToUnlock && !this.earnedOrPurchasedIds.has(carToUnlock.id)) {
        this.earnedOrPurchasedIds.add(carToUnlock.id);
        newlyUnlockedVehicle = carToUnlock;
      } else if (carToUnlock) {
        // If already unlocked via early purchase, record as newly unlocked for ceremony if not previously won
        newlyUnlockedVehicle = carToUnlock;
      }
    }

    const podiumStageActive = position <= 3;
    const turntableRevealActive = newlyUnlockedVehicle !== null;
    const turntableAngularVelRadSec = turntableRevealActive ? 0.65 : 0.0;

    this.saveToStorage();

    this.lastCeremonyReport = {
      position,
      podiumStageActive,
      turntableRevealActive,
      newlyUnlockedVehicle,
      turntableAngularVelRadSec,
      breakdown,
      totalEarnedCredits,
      totalEarnedXp,
      totalWins: this.totalWins,
      credits: this.credits,
      driverXp: this.driverXp,
    };

    return this.lastCeremonyReport;
  }

  public recordRaceCompletion(options: RaceResultOptions = {}): PostRaceCeremonyReport {
    return this.recordRaceResult(options);
  }

  /**
   * Returns complete snapshot of career progression state.
   */
  public getState(): CareerProgressionState {
    return {
      totalWins: this.totalWins,
      credits: this.credits,
      driverXp: this.driverXp,
      sandboxUnlockedAll: this.sandboxUnlockedAll,
      unlockedVehicleIds: this.getUnlockedVehicleIds(),
      lastCeremonyReport: this.lastCeremonyReport,
    };
  }
}
