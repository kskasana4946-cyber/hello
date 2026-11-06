/**
 * Unified E2E Test Harness & Assertion Library
 * Owned by: E2E_Testing_Track (tests/e2e/helpers/e2e_harness.mjs)
 *
 * Registers every test case with { id, tier, features: ['F1', ...], title, fn },
 * bridges automatically to Vitest (globalThis.describe / globalThis.it) when run under Vitest,
 * and tracks genuine assertion counts per test so zero dummy/empty tests can ever pass.
 */

import assert from 'node:assert/strict';

export const ALL_FEATURE_IDS = Array.from({ length: 42 }, (_, i) => `F${i + 1}`);
const VALID_FEATURE_SET = new Set(ALL_FEATURE_IDS);

/** @type {Array<{id: string, tier: number, features: string[], title: string, fn: Function}>} */
const E2E_TESTS = [];
const E2E_TEST_BY_ID = new Map();

let currentTestAssertionCount = 0;
let totalSuiteAssertionCount = 0;

function bumpAssertion() {
  currentTestAssertionCount += 1;
  totalSuiteAssertionCount += 1;
}

export function resetCurrentAssertionCount() {
  currentTestAssertionCount = 0;
}

export function getCurrentAssertionCount() {
  return currentTestAssertionCount;
}

export function getTotalSuiteAssertionCount() {
  return totalSuiteAssertionCount;
}

export function getRegisteredTests() {
  return E2E_TESTS.slice();
}

export function clearRegisteredTests() {
  E2E_TESTS.length = 0;
  E2E_TEST_BY_ID.clear();
}

/**
 * Registers an E2E test case and bridges to Vitest if running inside Vitest.
 * @param {{ id: string, tier: 1|2|3|4, features: string[], title: string, fn: (ctx: any) => Promise<void>|void }} def
 */
export function registerTest(def) {
  if (!def || typeof def.id !== 'string' || !def.id.trim()) {
    throw new Error('registerTest requires a non-empty string id');
  }
  if (E2E_TEST_BY_ID.has(def.id)) {
    throw new Error(`Duplicate E2E test ID registered: ${def.id}`);
  }
  if (![1, 2, 3, 4].includes(def.tier)) {
    throw new Error(`Invalid tier ${def.tier} for test ${def.id}; must be 1, 2, 3, or 4`);
  }
  if (!Array.isArray(def.features) || def.features.length === 0) {
    throw new Error(`Test ${def.id} must map to at least one feature ID (F1..F42)`);
  }
  for (const fid of def.features) {
    if (!VALID_FEATURE_SET.has(fid)) {
      throw new Error(`Test ${def.id} references unknown feature ID "${fid}"`);
    }
  }
  if (typeof def.fn !== 'function') {
    throw new Error(`Test ${def.id} must provide an executable test function fn`);
  }

  const normalized = {
    id: def.id.trim(),
    tier: def.tier,
    features: [...new Set(def.features)],
    title: def.title || def.id,
    fn: def.fn,
  };

  E2E_TESTS.push(normalized);
  E2E_TEST_BY_ID.set(normalized.id, normalized);

  // Automatic bridge when executed directly by Vitest
  if (typeof globalThis.it === 'function') {
    globalThis.it(`[${normalized.id}] (${normalized.features.join(',')}) ${normalized.title}`, async () => {
      const { getGameRuntimeContext } = await import('./contract_runtime_adapter.mjs');
      const ctx = await getGameRuntimeContext();
      resetCurrentAssertionCount();
      await normalized.fn(ctx);
      if (getCurrentAssertionCount() < 1) {
        throw new Error(`Test ${normalized.id} completed with 0 assertions!`);
      }
    });
  }
}

export function assertTrue(condition, message = 'Expected condition to be true') {
  bumpAssertion();
  assert.equal(Boolean(condition), true, message);
}

export function assertFalse(condition, message = 'Expected condition to be false') {
  bumpAssertion();
  assert.equal(Boolean(condition), false, message);
}

export function assertEqual(actual, expected, message = `Expected ${actual} === ${expected}`) {
  bumpAssertion();
  assert.strictEqual(actual, expected, message);
}

export function assertNotEqual(actual, unexpected, message = `Expected ${actual} !== ${unexpected}`) {
  bumpAssertion();
  assert.notStrictEqual(actual, unexpected, message);
}

export function assertDeepEqual(actual, expected, message = 'Expected deep equality') {
  bumpAssertion();
  assert.deepStrictEqual(actual, expected, message);
}

export function assertFiniteNumber(actual, message = `Expected finite number, got ${actual}`) {
  bumpAssertion();
  assert.equal(typeof actual === 'number' && Number.isFinite(actual), true, message);
}

export function assertApprox(actual, expected, tolerance = 1e-3, message = '') {
  bumpAssertion();
  if (typeof actual !== 'number' || !Number.isFinite(actual)) {
    throw new assert.AssertionError({
      message: message || `Expected finite number near ${expected}, got ${actual}`,
      actual,
      expected,
    });
  }
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new assert.AssertionError({
      message: message || `Expected ${actual} to be within ±${tolerance} of ${expected} (diff=${diff})`,
      actual,
      expected,
    });
  }
}

export function assertGreater(actual, minExclusive, message = '') {
  bumpAssertion();
  if (typeof actual !== 'number' || !Number.isFinite(actual) || !(actual > minExclusive)) {
    throw new assert.AssertionError({
      message: message || `Expected ${actual} > ${minExclusive}`,
      actual,
      expected: `> ${minExclusive}`,
    });
  }
}

export function assertGreaterOrEqual(actual, minInclusive, message = '') {
  bumpAssertion();
  if (typeof actual !== 'number' || !Number.isFinite(actual) || !(actual >= minInclusive)) {
    throw new assert.AssertionError({
      message: message || `Expected ${actual} >= ${minInclusive}`,
      actual,
      expected: `>= ${minInclusive}`,
    });
  }
}

export function assertLess(actual, maxExclusive, message = '') {
  bumpAssertion();
  if (typeof actual !== 'number' || !Number.isFinite(actual) || !(actual < maxExclusive)) {
    throw new assert.AssertionError({
      message: message || `Expected ${actual} < ${maxExclusive}`,
      actual,
      expected: `< ${maxExclusive}`,
    });
  }
}

export function assertLessOrEqual(actual, maxInclusive, message = '') {
  bumpAssertion();
  if (typeof actual !== 'number' || !Number.isFinite(actual) || !(actual <= maxInclusive)) {
    throw new assert.AssertionError({
      message: message || `Expected ${actual} <= ${maxInclusive}`,
      actual,
      expected: `<= ${maxInclusive}`,
    });
  }
}

export function assertInRange(actual, minInclusive, maxInclusive, message = '') {
  bumpAssertion();
  if (
    typeof actual !== 'number' ||
    !Number.isFinite(actual) ||
    actual < minInclusive ||
    actual > maxInclusive
  ) {
    throw new assert.AssertionError({
      message: message || `Expected ${actual} in [${minInclusive}, ${maxInclusive}]`,
      actual,
      expected: `[${minInclusive}, ${maxInclusive}]`,
    });
  }
}

export function assertIncludes(collectionOrString, item, message = '') {
  bumpAssertion();
  if (typeof collectionOrString === 'string' || Array.isArray(collectionOrString)) {
    if (!collectionOrString.includes(item)) {
      throw new assert.AssertionError({
        message: message || `Expected collection/string to include ${JSON.stringify(item)}`,
        actual: collectionOrString,
        expected: item,
      });
    }
    return;
  }
  throw new assert.AssertionError({
    message: message || `Expected string or array for assertIncludes`,
    actual: typeof collectionOrString,
    expected: 'string | Array',
  });
}

export function assertMatch(str, regex, message = '') {
  bumpAssertion();
  assert.match(String(str), regex, message || `Expected string to match ${regex}`);
}

export async function assertThrows(fn, expectedPattern = null, message = 'Expected function to throw') {
  bumpAssertion();
  let threw = false;
  let caughtErr = null;
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      await res;
    }
  } catch (err) {
    threw = true;
    caughtErr = err;
  }
  if (!threw) {
    throw new assert.AssertionError({
      message,
      actual: 'Did not throw',
      expected: expectedPattern ? String(expectedPattern) : 'Error thrown',
    });
  }
  if (expectedPattern) {
    const msg = caughtErr && caughtErr.message ? caughtErr.message : String(caughtErr);
    if (expectedPattern instanceof RegExp) {
      assert.match(msg, expectedPattern, message);
    } else if (typeof expectedPattern === 'string') {
      assert.equal(
        msg.toLowerCase().includes(expectedPattern.toLowerCase()),
        true,
        `${message}: expected "${msg}" to include "${expectedPattern}"`
      );
    }
  }
  return caughtErr;
}

/**
 * Validates an APEXPAK1 binary header & TOC structure against PROJECT.md § Interface Contracts 1.
 */
export function assertPakHeader(headerInfo, expected = {}, messagePrefix = 'APEXPAK1') {
  assertEqual(headerInfo.magic, 'APEXPAK1', `${messagePrefix}: magic must be "APEXPAK1"`);
  assertEqual(headerInfo.version, 1, `${messagePrefix}: version must be 1`);
  assertIncludes([1, 2, 3], headerInfo.pakType, `${messagePrefix}: pakType must be 1 (SKY), 2 (TRACK), or 3 (VEHICLE)`);
  if (expected.pakType !== undefined) {
    assertEqual(headerInfo.pakType, expected.pakType, `${messagePrefix}: pakType mismatch`);
  }
  if (expected.totalByteLength !== undefined) {
    assertEqual(headerInfo.totalByteLength, expected.totalByteLength, `${messagePrefix}: totalByteLength mismatch`);
  }
  if (expected.sectorCount !== undefined) {
    assertEqual(headerInfo.sectorCount, expected.sectorCount, `${messagePrefix}: sectorCount mismatch`);
  }
  if (expected.assetId !== undefined) {
    assertEqual(headerInfo.assetId, expected.assetId, `${messagePrefix}: assetId mismatch`);
  }
  assertGreaterOrEqual(headerInfo.entryCount, 1, `${messagePrefix}: entryCount must be >= 1`);
  assertEqual(Array.isArray(headerInfo.entries), true, `${messagePrefix}: TOC entries must be an array`);
  assertEqual(headerInfo.entries.length, headerInfo.entryCount, `${messagePrefix}: entries.length must equal entryCount`);

  const minDataOffset = 64 + headerInfo.entryCount * 64;
  let prevEnd = minDataOffset;
  for (let i = 0; i < headerInfo.entries.length; i++) {
    const entry = headerInfo.entries[i];
    assertGreaterOrEqual(entry.byteOffset, minDataOffset, `${messagePrefix}: entry[${i}] offset < header+TOC`);
    assertEqual(entry.byteOffset % 64, 0, `${messagePrefix}: entry[${i}] offset must be 64-byte aligned`);
    assertGreater(entry.byteLength, 0, `${messagePrefix}: entry[${i}] byteLength must be > 0`);
    assertLessOrEqual(
      entry.byteOffset + entry.byteLength,
      headerInfo.totalByteLength,
      `${messagePrefix}: entry[${i}] exceeds totalByteLength`
    );
    assertGreaterOrEqual(entry.byteOffset, prevEnd, `${messagePrefix}: entry[${i}] overlaps previous entry`);
    prevEnd = entry.byteOffset + entry.byteLength;
  }
}

/**
 * Validates a binary glTF 2.0 (.glb) buffer exported by Tab 4 Mod Studio.
 */
export function assertGlbHeader(glbBytes, messagePrefix = 'GLB Export') {
  assertTrue(
    glbBytes instanceof Uint8Array || Buffer.isBuffer(glbBytes),
    `${messagePrefix}: expected Uint8Array or Buffer`
  );
  assertGreater(glbBytes.byteLength, 1024, `${messagePrefix}: expected GLB > 1024 bytes`);
  const view = new DataView(glbBytes.buffer, glbBytes.byteOffset, glbBytes.byteLength);
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const totalLength = view.getUint32(8, true);

  assertEqual(magic, 0x46546c67, `${messagePrefix}: magic must be 0x46546C67 ("glTF")`);
  assertEqual(version, 2, `${messagePrefix}: glTF version must be 2`);
  assertEqual(totalLength, glbBytes.byteLength, `${messagePrefix}: header totalLength must match buffer byteLength`);

  const jsonChunkLen = view.getUint32(12, true);
  const jsonChunkType = view.getUint32(16, true);
  assertEqual(jsonChunkType, 0x4e4f534a, `${messagePrefix}: chunk 0 type must be 0x4E4F534A ("JSON")`);
  assertGreater(jsonChunkLen, 20, `${messagePrefix}: JSON chunk length must be > 20`);

  const jsonBytes = glbBytes.subarray(20, 20 + jsonChunkLen);
  const jsonStr = new TextDecoder().decode(jsonBytes).replace(/\0+$/g, '').trim();
  const parsed = JSON.parse(jsonStr);
  assertEqual(parsed?.asset?.version, '2.0', `${messagePrefix}: glTF asset.version must be "2.0"`);
  assertTrue(Array.isArray(parsed.meshes) && parsed.meshes.length > 0, `${messagePrefix}: glTF must contain meshes`);
  assertTrue(Array.isArray(parsed.materials) && parsed.materials.length > 0, `${messagePrefix}: glTF must contain materials`);
  assertTrue(Array.isArray(parsed.nodes) && parsed.nodes.length > 0, `${messagePrefix}: glTF must contain nodes`);

  const binChunkOffset = 20 + jsonChunkLen;
  assertLess(binChunkOffset + 8, glbBytes.byteLength, `${messagePrefix}: must include BIN chunk header`);
  const binChunkLen = view.getUint32(binChunkOffset, true);
  const binChunkType = view.getUint32(binChunkOffset + 4, true);
  assertEqual(binChunkType, 0x004e4942, `${messagePrefix}: chunk 1 type must be 0x004E4942 ("BIN")`);
  assertEqual(
    binChunkOffset + 8 + binChunkLen,
    glbBytes.byteLength,
    `${messagePrefix}: BIN chunk end must align with total GLB byteLength`
  );
  return { parsed, jsonChunkLen, binChunkLen };
}
