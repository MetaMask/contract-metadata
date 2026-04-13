import fs from "node:fs";
import path from "node:path";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { utf8ToBytes, bytesToHex } from "ethereum-cryptography/utils.js";

const LABELS_DIR = path.resolve(import.meta.dirname, "../labels");

const PLATFORM_TO_CAIP2 = {
  ethereum: "eip155:1",
  "polygon-pos": "eip155:137",
  "binance-smart-chain": "eip155:56",
  linea: "eip155:59144",
  base: "eip155:8453",
  "optimistic-ethereum": "eip155:10",
  "arbitrum-one": "eip155:42161",
  scroll: "eip155:534352",
  monad: "eip155:143",
  hyperevm: "eip155:999",
};

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

function toChecksumAddress(address) {
  const addr = address.toLowerCase().replace("0x", "");
  const hash = bytesToHex(keccak256(utf8ToBytes(addr)));

  let checksummed = "0x";

  for (let i = 0; i < addr.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      checksummed += addr[i].toUpperCase();
    } else {
      checksummed += addr[i];
    }
  }

  return checksummed;
}

function caip19ToFilePath(caip19) {
  const [chain, asset] = caip19.split("/");

  return path.join(LABELS_DIR, chain, `${asset}.json`);
}

function readOrCreateLabelFile(filePath) {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  return { labels: [] };
}

function writeLabelFile(filePath, data) {
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 4) + "\n");
}

function platformToCaip19(platform, address) {
  const caip2 = PLATFORM_TO_CAIP2[platform];

  if (!caip2) return null;

  const checksummed = toChecksumAddress(address);

  return `${caip2}/erc20:${checksummed}`;
}

async function fetchCoinGeckoList() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/coins/list?include_platform=true",
  );

  if (!res.ok) {
    throw new Error(`CoinGecko error: ${res.status}`);
  }

  return res.json();
}

async function seed() {
  console.log("Fetching CoinGecko coin list...\n");

  const coinList = await fetchCoinGeckoList();

  const coinById = new Map(coinList.map((c) => [c.id, c]));

  const summary = [];

  for (const group of CANONICAL_HEAD_GROUPS) {
    const coin = coinById.get(group.coingeckoId);

    if (!coin) {
      console.warn(
        `⚠ CoinGecko ID "${group.coingeckoId}" not found — skipping`,
      );

      continue;
    }

    console.log(`Processing: ${group.coingeckoId} → head: ${group.headCaip19}`);

    for (const [platform, address] of Object.entries(coin.platforms)) {
      if (!address) continue;

      const memberCaip19 = platformToCaip19(platform, address);

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
  console.log(
    `Created: ${summary.filter((s) => s.action === "created").length}`,
  );
  console.log(
    `Updated: ${summary.filter((s) => s.action === "updated").length}`,
  );
  console.log(
    `Skipped: ${summary.filter((s) => s.action === "skipped").length}`,
  );
}

seed().catch(console.error);
