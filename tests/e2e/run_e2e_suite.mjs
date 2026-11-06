#!/usr/bin/env node
/**
 * Unified CLI E2E Test Suite Runner for Apex Grand Prix: Uncapped Next-Gen Edition
 * Owned by: E2E_Testing_Track (tests/e2e/run_e2e_suite.mjs)
 *
 * Supported CLI Flags:
 *   --tier=1 | --tier=2 | --tier=3 | --tier=4 | --tier=all (default: all)
 *   --feature=F1..F42
 *   --discover
 *   --self-test
 *   --live
 */

import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  ALL_FEATURE_IDS,
  getRegisteredTests,
  resetCurrentAssertionCount,
  getCurrentAssertionCount,
  getTotalSuiteAssertionCount,
} from './helpers/e2e_harness.mjs';
import {
  REPO_ROOT,
  setRuntimeMode,
  getGameRuntimeContext,
  runNegativeFaultInjectionSelfTests,
} from './helpers/contract_runtime_adapter.mjs';

const args = process.argv.slice(2);

function parseCliFlags(argv) {
  let tierArg = 'all';
  let featureArg = null;
  let discoverOnly = false;
  let selfTestMode = false;
  let liveMode = false;

  for (const arg of argv) {
    if (arg.startsWith('--tier=')) {
      tierArg = arg.split('=')[1].trim().toLowerCase();
    } else if (arg.startsWith('--feature=')) {
      featureArg = arg.split('=')[1].trim().toUpperCase();
    } else if (arg === '--discover') {
      discoverOnly = true;
    } else if (arg === '--self-test') {
      selfTestMode = true;
    } else if (arg === '--live') {
      liveMode = true;
    }
  }

  let requestedTiers = [1, 2, 3, 4];
  if (tierArg !== 'all') {
    requestedTiers = tierArg
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => [1, 2, 3, 4].includes(n));
    if (requestedTiers.length === 0) {
      throw new Error(`Invalid --tier=${tierArg}; expected 1, 2, 3, 4, or all`);
    }
  }

  // Determine runtime mode: explicit --live, explicit --self-test, or auto detection
  let mode = 'auto';
  if (liveMode) {
    mode = 'live';
  } else if (selfTestMode) {
    mode = 'self-test';
  } else {
    const mainTsExists = fs.existsSync(path.join(REPO_ROOT, 'src/main.ts'));
    const skyPaksExist = fs.existsSync(path.join(REPO_ROOT, 'assets/paks/sky/sky_golden_hour.pak'));
    mode = mainTsExists && skyPaksExist ? 'live' : 'auto';
  }

  return { requestedTiers, featureArg, discoverOnly, selfTestMode, liveMode, mode };
}

async function loadAllTierSpecModules() {
  await import('./tier1_feature_coverage.spec.mjs');
  await import('./tier2_edge_cases_errors.spec.mjs');
  await import('./tier3_combinatorial_pairwise.spec.mjs');
  await import('./tier4_real_world_scenarios.spec.mjs');
}

function buildCoverageMatrix(allTests) {
  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const featureStats = {};
  for (const fid of ALL_FEATURE_IDS) {
    featureStats[fid] = { t1: 0, t2: 0, t3: 0, t4: 0, total: 0 };
  }

  for (const t of allTests) {
    tierCounts[t.tier] = (tierCounts[t.tier] || 0) + 1;
    for (const fid of t.features) {
      if (featureStats[fid]) {
        featureStats[fid][`t${t.tier}`] += 1;
        featureStats[fid].total += 1;
      }
    }
  }

  return { tierCounts, featureStats, totalTests: allTests.length };
}

function printDiscoveryAndThresholdSummary(matrix) {
  console.log('================================================================================');
  console.log(' APEX GRAND PRIX: UNCAPPED NEXT-GEN EDITION — E2E COVERAGE & DISCOVERY MATRIX');
  console.log('================================================================================');
  console.log(`  Tier 1 (Feature Coverage)          : ${matrix.tierCounts[1]} tests (Required >= 210)`);
  console.log(`  Tier 2 (Boundary & Negative Cases) : ${matrix.tierCounts[2]} tests (Required >= 210)`);
  console.log(`  Tier 3 (Combinatorial & Pairwise)  : ${matrix.tierCounts[3]} tests (Required >= 45)`);
  console.log(`  Tier 4 (Real-World E2E Scenarios)  : ${matrix.tierCounts[4]} tests (Required >= 21)`);
  console.log('--------------------------------------------------------------------------------');
  console.log(`  TOTAL REGISTERED E2E TESTS         : ${matrix.totalTests} tests (Required >= 486)`);
  console.log('================================================================================\n');

  console.log('Per-Feature Coverage Table (F1..F42):');
  console.log('Feature | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Total | Threshold (>=5 T1 & >=5 T2)');
  console.log('--------|--------|--------|--------|--------|-------|----------------------------');

  let allFeaturesMeetThresholds = true;
  for (const fid of ALL_FEATURE_IDS) {
    const st = matrix.featureStats[fid];
    const ok = st.t1 >= 5 && st.t2 >= 5;
    if (!ok) allFeaturesMeetThresholds = false;
    console.log(
      `${fid.padEnd(7)} | ${String(st.t1).padStart(6)} | ${String(st.t2).padStart(6)} | ${String(st.t3).padStart(6)} | ${String(st.t4).padStart(6)} | ${String(st.total).padStart(5)} | ${ok ? 'PASS' : 'FAIL'}`
    );
  }
  console.log('');

  const thresholdsMet =
    allFeaturesMeetThresholds &&
    matrix.tierCounts[1] >= 210 &&
    matrix.tierCounts[2] >= 210 &&
    matrix.tierCounts[3] >= 45 &&
    matrix.tierCounts[4] >= 21 &&
    matrix.totalTests >= 486;

  return thresholdsMet;
}

async function main() {
  const startTime = performance.now();
  const flags = parseCliFlags(args);
  setRuntimeMode(flags.mode);

  await loadAllTierSpecModules();
  const allTests = getRegisteredTests();
  const matrix = buildCoverageMatrix(allTests);
  const thresholdsMet = printDiscoveryAndThresholdSummary(matrix);

  if (!thresholdsMet) {
    console.error('ERROR: Mandatory E2E registration or per-feature coverage thresholds were not met.');
    process.exit(1);
  }

  if (flags.discoverOnly) {
    console.log('Discovery check passed: 100% of F1..F42 and Tier 1..4 thresholds satisfied.');
    process.exit(0);
  }

  // Filter tests by requested tiers and optional feature filter
  const selectedTests = allTests.filter((t) => {
    if (!flags.requestedTiers.includes(t.tier)) return false;
    if (flags.featureArg && !t.features.includes(flags.featureArg)) return false;
    return true;
  });

  console.log(
    `Executing ${selectedTests.length} E2E tests (Tiers: ${flags.requestedTiers.join(', ')}${flags.featureArg ? `, Feature: ${flags.featureArg}` : ''}, Mode: ${flags.mode.toUpperCase()})...\n`
  );

  const tierPassCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const tierFailCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const failures = [];

  // Execute sequentially by Tier 1 -> 2 -> 3 -> 4
  for (const tier of [1, 2, 3, 4]) {
    if (!flags.requestedTiers.includes(tier)) continue;
    const tierTests = selectedTests.filter((t) => t.tier === tier);
    if (tierTests.length === 0) continue;

    const tierStart = performance.now();
    for (const testCase of tierTests) {
      const ctx = await getGameRuntimeContext(flags.mode);
      resetCurrentAssertionCount();
      try {
        await testCase.fn(ctx);
        const assertionsRun = getCurrentAssertionCount();
        if (assertionsRun < 1) {
          throw new Error(`Test ${testCase.id} executed 0 assertions (anti-dummy enforcement)`);
        }
        tierPassCounts[tier] += 1;
      } catch (err) {
        tierFailCounts[tier] += 1;
        failures.push({
          id: testCase.id,
          tier: testCase.tier,
          features: testCase.features,
          title: testCase.title,
          error: err && err.stack ? err.stack : String(err),
        });
      }
    }
    const tierElapsedMs = (performance.now() - tierStart).toFixed(1);
    console.log(
      `  [Tier ${tier}] Passed: ${tierPassCounts[tier]}/${tierTests.length} | Failed: ${tierFailCounts[tier]} (${tierElapsedMs} ms)`
    );
  }

  if (flags.selfTestMode) {
    console.log('\nRunning Negative Fault-Injection Self-Tests (--self-test)...');
    const mutResults = await runNegativeFaultInjectionSelfTests();
    for (const m of mutResults) {
      console.log(`  [${m.id}] ${m.passed ? 'PASS' : 'FAIL'} — ${m.description}`);
      if (!m.passed) {
        failures.push({
          id: m.id,
          tier: 0,
          features: ['SELF_TEST'],
          title: m.description,
          error: m.error || 'Self-test mutation was not caught',
        });
      }
    }
  }

  const totalElapsedMs = (performance.now() - startTime).toFixed(1);
  const totalPassed = Object.values(tierPassCounts).reduce((a, b) => a + b, 0);
  const totalFailed = failures.length;

  console.log('\n================================================================================');
  console.log(
    ` E2E EXECUTION SUMMARY: ${totalPassed} Passed | ${totalFailed} Failed | ${getTotalSuiteAssertionCount()} Assertions Verified | ${totalElapsedMs} ms`
  );
  console.log('================================================================================');

  if (totalFailed > 0) {
    console.error('\nFAILED TESTS:');
    for (const f of failures) {
      console.error(`  ❌ [${f.id}] (${f.features.join(',')}) ${f.title}\n     ${f.error}`);
    }
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal E2E runner error:', err);
  process.exit(1);
});
