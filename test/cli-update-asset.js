const test = require('tape');
const { parseLabels } = require('../cli-update-asset');

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
