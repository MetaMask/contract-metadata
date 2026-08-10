const test = require('tape');
const { parseLabels, parseCAIP19 } = require('../cli-update-asset');

test('parseLabels returns undefined when labels are omitted', function (t) {
  t.equal(parseLabels(undefined), undefined);
  t.end();
});

test('parseLabels parses comma-separated values', function (t) {
  const labels = parseLabels('stable_coin, blue_chip');
  t.deepEqual(labels, ['stable_coin', 'blue_chip']);
  t.end();
});

test('parseLabels removes duplicate labels while preserving order', function (t) {
  const labels = parseLabels('stable_coin,blue_chip,stable_coin,spam');
  t.deepEqual(labels, ['stable_coin', 'blue_chip', 'spam']);
  t.end();
});

test('parseLabels parses JSON array input', function (t) {
  const labels = parseLabels('["stable_coin", "warning"]');
  t.deepEqual(labels, ['stable_coin', 'warning']);
  t.end();
});

test('parseLabels throws on empty input', function (t) {
  t.throws(
    () => parseLabels('   '),
    /Labels cannot be empty/,
    'throws useful error for empty string',
  );
  t.end();
});

test('parseLabels throws on invalid JSON', function (t) {
  t.throws(
    () => parseLabels('["stable_coin",]'),
    /Invalid JSON for --labels/,
    'throws useful error for malformed JSON',
  );
  t.end();
});

test('parseLabels throws when JSON input is not an array', function (t) {
  t.throws(
    () => parseLabels('{"label":"stable_coin"}'),
    /JSON labels input must be an array/,
    'rejects object JSON input',
  );
  t.end();
});

test('parseLabels returns empty array for empty JSON array', function (t) {
  const labels = parseLabels('[]');
  t.deepEqual(labels, []);
  t.end();
});

test('parseLabels throws on JSON array containing empty string', function (t) {
  t.throws(
    () => parseLabels('["stable_coin", ""]'),
    /Invalid --labels value/,
    'rejects empty string element in JSON array',
  );
  t.end();
});

test('parseLabels silently drops empty segments from comma-separated input', function (t) {
  const labels = parseLabels('stable_coin,,blue_chip,');
  t.deepEqual(labels, ['stable_coin', 'blue_chip']);
  t.end();
});

test('parseCAIP19 accepts Stellar classic asset IDs with hyphens', function (t) {
  const caip =
    'stellar:pubnet/asset:USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
  const parsed = parseCAIP19(caip);
  t.equal(parsed.chainNamespace, 'stellar:pubnet');
  t.equal(
    parsed.assetId,
    'asset:USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  );
  t.end();
});

test('parseCAIP19 accepts Stellar Soroban sep41 contract IDs', function (t) {
  const caip =
    'stellar:pubnet/sep41:CDT3KU6TQZNOHKNOHNAFFDQZDURVC3MSTL4ML7TUTZGNOPBZCLABP4FR';
  const parsed = parseCAIP19(caip);
  t.equal(parsed.chainNamespace, 'stellar:pubnet');
  t.equal(
    parsed.assetId,
    'sep41:CDT3KU6TQZNOHKNOHNAFFDQZDURVC3MSTL4ML7TUTZGNOPBZCLABP4FR',
  );
  t.end();
});
