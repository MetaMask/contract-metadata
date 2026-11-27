const test = require("tape");
const contractMap = require("../buildindex.js");
const { createUniswapTokenList } = require("../generate-multichain-uniswap-standard-list.js");

// The generated Uniswap-standard list must carry each asset's declared decimals
// verbatim. In particular `decimals: 0` must not be replaced by a default of 18.
test("uniswap list preserves declared decimals, including 0", function (t) {
  const tokens = createUniswapTokenList().tokens;
  const byKey = new Map(
    tokens.map((tok) => [`${tok.chainId}:${tok.address.toLowerCase()}`, tok]),
  );

  let zeroDecimalAssets = 0;
  Object.entries(contractMap).forEach(([caip19AssetId, data]) => {
    if (!caip19AssetId.startsWith("eip155:") || typeof data.decimals !== "number") return;
    const [chainPart, addressPart] = caip19AssetId.split("/");
    const key = `${chainPart.split(":")[1]}:${addressPart.split(":")[1].toLowerCase()}`;
    const tok = byKey.get(key);
    if (data.decimals === 0) zeroDecimalAssets++;
    t.equal(tok && tok.decimals, data.decimals, `${caip19AssetId} decimals`);
  });

  t.ok(zeroDecimalAssets > 0, "sanity: dataset contains 0-decimal assets");
  t.end();
});
