import fs from "node:fs";
import path from "node:path";
import { toChecksumAddress } from "ethereumjs-util";

/** Directory where label JSON files are stored */
const LABELS_DIR = path.resolve(import.meta.dirname, "../labels");

/**
 * CAIP-2 + asset namespace mapping for every platform CoinGecko returns.
 * This used to be a plain object (fast string-key lookup). It is now an array
 * for readability and future extensibility, so we must use .find() instead of
 * direct bracket access.
 */
const PLATFORM_MAP = [
  {
    platform: "ethereum",
    caip2: "eip155:1",
    assetNamespace: "erc20",
  },
  {
    platform: "polygon-pos",
    caip2: "eip155:137",
    assetNamespace: "erc20",
  },
  {
    platform: "binance-smart-chain",
    caip2: "eip155:56",
    assetNamespace: "erc20",
  },
  {
    platform: "linea",
    caip2: "eip155:59144",
    assetNamespace: "erc20",
  },
  {
    platform: "base",
    caip2: "eip155:8453",
    assetNamespace: "erc20",
  },
  {
    platform: "optimistic-ethereum",
    caip2: "eip155:10",
    assetNamespace: "erc20",
  },
  {
    platform: "arbitrum-one",
    caip2: "eip155:42161",
    assetNamespace: "erc20",
  },
  {
    platform: "scroll",
    caip2: "eip155:534352",
    assetNamespace: "erc20",
  },
  {
    platform: "monad",
    caip2: "eip155:143",
    assetNamespace: "erc20",
  },
  {
    platform: "hyperevm",
    caip2: "eip155:999",
    assetNamespace: "erc20",
  },
  {
    platform: "avalanche",
    caip2: "eip155:43114",
    assetNamespace: "erc20",
  },
  {
    platform: "zksync",
    caip2: "eip155:324",
    assetNamespace: "erc20",
  },
  {
    platform: "solana",
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    assetNamespace: "token",
  },
] as const;

/**
 * Convert a CoinGecko platform + contract address into a full CAIP-19 identifier.
 * Updated to work with the new array-based PLATFORM_MAP and added helpful warning.
 */
function platformToCaip19(platform: string, address: string): string | null {
  const mapping = PLATFORM_MAP.find((entry) => entry.platform === platform);

  if (!mapping) {
    console.warn(`No mapping found for platform: ${platform}`);
    return null;
  }

  if (mapping.assetNamespace === "erc20") {
    return `${mapping.caip2}/${mapping.assetNamespace}:${toChecksumAddress(address)}`;
  }

  return `${mapping.caip2}/${mapping.assetNamespace}:${address}`;
}

const CANONICAL_HEAD_GROUPS = [
  {
    coingeckoId: "ethereum",
    headCaip19: "eip155:1/slip44:60",
  },
  {
    coingeckoId: "weth",
    headCaip19: "eip155:1/slip44:60",
  },
  {
    coingeckoId: "usd-coin",
    headCaip19: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  {
    coingeckoId: "tether",
    headCaip19: "eip155:1/erc20:0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
  {
    coingeckoId: "binancecoin",
    headCaip19: "eip155:56/slip44:714",
  },
  {
    coingeckoId: "metamask-usd",
    headCaip19: "eip155:1/erc20:0xacA92E438df0B2401fF60dA7E4337B687a2435DA",
  },
];

function caip19ToFilePath(caip19: string): string {
  const slashIndex = caip19.lastIndexOf("/");
  const chain = caip19.substring(0, slashIndex);
  const asset = caip19.substring(slashIndex + 1);

  return path.join(LABELS_DIR, chain, `${asset}.json`);
}

function readOrCreateLabelFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  return { labels: [] };
}

function writeLabelFile(filePath: string, data: any) {
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

async function fetchCoinGeckoList() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/coins/list?include_platform=true",
  );

  if (!res.ok) {
    throw new Error(`CoinGecko API error: ${res.status}`);
  }

  return res.json();
}

async function seed() {
  console.log("Fetching CoinGecko coin list...\n");
  const coinList = await fetchCoinGeckoList();

  const coinById = new Map(coinList.map((c: any) => [c.id, c]));

  const summary: Array<{
    member: string;
    head: string;
    action: "created" | "updated" | "skipped";
  }> = [];

  for (const group of CANONICAL_HEAD_GROUPS) {
    const coin = coinById.get(group.coingeckoId);

    if (!coin) {
      console.warn(`⚠ CoinGecko ID "${group.coingeckoId}" not found — skipping`);
      continue;
    }

    console.log(`Processing: ${group.coingeckoId} → head: ${group.headCaip19}`);

    for (const [platform, address] of Object.entries(coin.platforms)) {
      if (!address) continue;

      const memberCaip19 = platformToCaip19(platform, address as string);

      if (!memberCaip19) continue;

      if (memberCaip19 === group.headCaip19) {
        console.log(`  ✓ ${memberCaip19} (head — skipping)`);
        continue;
      }

      const filePath = caip19ToFilePath(memberCaip19);
      const existing = readOrCreateLabelFile(filePath);

      if (existing.canonicalHead === group.headCaip19) {
        console.log(`  ✓ ${memberCaip19} (already set)`);

        summary.push({
          member: memberCaip19,
          head: group.headCaip19,
          action: "skipped",
        });

        continue;
      }

      const action = fs.existsSync(filePath) ? "updated" : "created";

      existing.canonicalHead = group.headCaip19;

      writeLabelFile(filePath, existing);

      console.log(`  + ${memberCaip19} → ${group.headCaip19} (${action})`);

      summary.push({ member: memberCaip19, head: group.headCaip19, action });
    }

    console.log(" ");
  }

  console.log("\n=== Summary ===");
  console.log(`Total processed: ${summary.length}`);
  console.log(`Created: ${summary.filter((s) => s.action === "created").length}`);
  console.log(`Updated: ${summary.filter((s) => s.action === "updated").length}`);
  console.log(`Skipped: ${summary.filter((s) => s.action === "skipped").length}`);
}

seed().catch(console.error);
