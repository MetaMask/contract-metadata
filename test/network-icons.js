const test = require('tape');
const {
  listNetworkIcons,
  validateNetworkIcon,
  parseCaip2,
  s3Key,
} = require('../scripts/network-icons.js');

test('network-icons/ is not empty', function (t) {
  t.ok(listNetworkIcons().length > 0, 'has at least one network icon');
  t.end();
});

test('every network icon is a safe .svg named by a CAIP-2 chain ID', function (t) {
  for (const fileName of listNetworkIcons()) {
    const errors = validateNetworkIcon(fileName);
    t.deepEqual(errors, [], `network-icons/${fileName}`);
  }
  t.end();
});

test('network icon S3 keys are unique', function (t) {
  const keys = listNetworkIcons().map((f) => s3Key(f.replace(/\.svg$/, '')));
  t.equal(new Set(keys).size, keys.length, 'no two icons map to the same key');
  t.end();
});

test('parseCaip2 and s3Key', function (t) {
  t.deepEqual(parseCaip2('eip155:1'), { namespace: 'eip155', reference: '1' });
  t.equal(parseCaip2('eip155'), null, 'rejects missing reference');
  t.equal(parseCaip2('eip155:1/erc20:0x0'), null, 'rejects CAIP-19');
  t.equal(parseCaip2('EIP155:1'), null, 'rejects upper-case namespace');
  t.equal(s3Key('eip155:59144'), 'api/v2/networkIcons/eip155/59144.svg');
  t.equal(
    s3Key('bip122:000000000019d6689c085ae165831e93'),
    'api/v2/networkIcons/bip122/000000000019d6689c085ae165831e93.svg',
  );
  t.end();
});
