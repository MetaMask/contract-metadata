#!/usr/bin/env node
/**
 * CLI tool for managing CAIP-19 contract metadata and icons.
 *
 * Commands:
 *   update  - Create or update an asset's metadata and icon
 *   verify  - Verify an asset's metadata and icon integrity
 *   list    - List all assets, optionally filtered by chain
 *
 * Usage:
 *   node cli-update-asset.js update --asset <caip19Id> --name <name> --symbol <symbol> --decimals <n> [--erc20] [--spl20] [--logo <url|path>]
 *   node cli-update-asset.js verify --asset <caip19Id>
 *   node cli-update-asset.js list [--chain <chainId>]
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ---------------------------------------------------------------------------
// CAIP-19 Validation
// ---------------------------------------------------------------------------

/**
 * Regex for CAIP-19 asset identifiers.
 *
 * Format:  <chain_namespace>:<chain_reference>/<asset_namespace>:<asset_reference>
 *
 * Per the CAIP-19 spec the asset reference is [-a-zA-Z0-9]{1,64} but we also
 * allow the longer hex addresses used by EVM chains. The chain reference is
 * similarly relaxed to accommodate the variety seen across ecosystems.
 */
const CAIP19_REGEX =
  /^[-a-zA-Z0-9]{3,8}:[-a-zA-Z0-9]{1,64}\/[-a-zA-Z0-9]{3,8}:[-a-zA-Z0-9]{1,128}$/;

/**
 * Validate that a string is a well-formed CAIP-19 asset identifier.
 */
function isValidCAIP19(id) {
  return CAIP19_REGEX.test(id);
}

/**
 * Parse a CAIP-19 ID into its components.
 * Returns { chainNamespace, chainReference, assetNamespace, assetReference }
 * or null if invalid.
 */
function parseCAIP19(id) {
  if (!isValidCAIP19(id)) return null;
  const [chainPart, assetPart] = id.split("/");
  const [chainNamespace, chainReference] = chainPart.split(":");
  const [assetNamespace, assetReference] = assetPart.split(":");
  return { chainNamespace, chainReference, assetNamespace, assetReference };
}

// ---------------------------------------------------------------------------
// Permitted Fields
// ---------------------------------------------------------------------------

const permittedFields = require("./permitted-fields.json");

// ---------------------------------------------------------------------------
// File-system helpers
// ---------------------------------------------------------------------------

const METADATA_DIR = path.join(__dirname, "metadata");
const ICONS_DIR = path.join(__dirname, "icons");

/**
 * Derive the metadata JSON path for a CAIP-19 id.
 * e.g. "eip155:1/erc20:0xABC..." -> metadata/eip155:1/erc20:0xABC....json
 */
function metadataPath(caip19Id) {
  const [chain, asset] = caip19Id.split("/");
  return path.join(METADATA_DIR, chain, `${asset}.json`);
}

/**
 * Find the existing icon file for a CAIP-19 id (any extension).
 * Returns the full path or null.
 */
function findIconPath(caip19Id) {
  const [chain, asset] = caip19Id.split("/");
  const dir = path.join(ICONS_DIR, chain);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir);
  const match = files.find(
    (f) => f.startsWith(asset + ".") && /\.(svg|png)$/.test(f),
  );
  return match ? path.join(dir, match) : null;
}

/**
 * Expected icon path based on logo field in metadata.
 */
function expectedIconPath(logoField) {
  return path.join(__dirname, logoField);
}

/**
 * Download a file from a URL and write to disk.
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const proto = url.startsWith("https") ? https : http;
    proto
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect
          return downloadFile(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const stream = fs.createWriteStream(dest);
        res.pipe(stream);
        stream.on("finish", () => {
          stream.close();
          resolve();
        });
        stream.on("error", reject);
      })
      .on("error", reject);
  });
}

/**
 * Detect file extension from content or URL.
 */
function detectExtension(urlOrPath) {
  const lower = urlOrPath.toLowerCase();
  if (lower.endsWith(".svg") || lower.includes("svg")) return "svg";
  if (lower.endsWith(".png") || lower.includes("png")) return "png";
  return "svg"; // default
}

// ---------------------------------------------------------------------------
// Argument Parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];
      // Boolean flags (no value following, or next arg is also a flag)
      if (!nextArg || nextArg.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = nextArg;
        i++;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command: positional[0], args };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * CREATE / UPDATE an asset.
 */
async function commandUpdate(opts) {
  const caip19Id = opts.asset;
  if (!caip19Id) {
    console.error("Error: --asset <caip19Id> is required");
    process.exit(1);
  }

  if (!isValidCAIP19(caip19Id)) {
    console.error(`Error: "${caip19Id}" is not a valid CAIP-19 identifier`);
    process.exit(1);
  }

  const parsed = parseCAIP19(caip19Id);
  const chain = `${parsed.chainNamespace}:${parsed.chainReference}`;
  const asset = `${parsed.assetNamespace}:${parsed.assetReference}`;

  // Build metadata object
  const metaFile = metadataPath(caip19Id);
  let metadata = {};

  // Load existing if present
  if (fs.existsSync(metaFile)) {
    try {
      metadata = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
      console.log(`Updating existing asset: ${caip19Id}`);
    } catch (e) {
      console.warn(`Warning: could not parse existing metadata, overwriting.`);
    }
  } else {
    console.log(`Creating new asset: ${caip19Id}`);
  }

  // Apply fields from args
  if (opts.name) metadata.name = opts.name;
  if (opts.symbol) metadata.symbol = opts.symbol;
  if (opts.decimals !== undefined) {
    metadata.decimals = parseInt(opts.decimals, 10);
    if (isNaN(metadata.decimals)) {
      console.error("Error: --decimals must be a number");
      process.exit(1);
    }
  }
  if (opts.erc20 !== undefined) metadata.erc20 = opts.erc20 === true || opts.erc20 === "true";
  if (opts.spl20 !== undefined) metadata.spl20 = opts.spl20 === true || opts.spl20 === "true";

  // Validate required fields for new assets
  if (!metadata.name) {
    console.error("Error: --name is required for new assets");
    process.exit(1);
  }

  // Handle icon / logo
  if (opts.logo) {
    const ext = detectExtension(opts.logo);
    const iconRelPath = `./icons/${chain}/${asset}.${ext}`;
    const iconAbsPath = path.join(__dirname, iconRelPath);
    const iconDir = path.dirname(iconAbsPath);

    // Remove old icon if format changed
    const oldIcon = findIconPath(caip19Id);
    if (oldIcon && oldIcon !== iconAbsPath) {
      console.log(`Removing old icon: ${path.relative(__dirname, oldIcon)}`);
      fs.unlinkSync(oldIcon);
    }

    // Create icon directory
    if (!fs.existsSync(iconDir)) {
      fs.mkdirSync(iconDir, { recursive: true });
    }

    // Download or copy
    if (opts.logo.startsWith("http://") || opts.logo.startsWith("https://")) {
      console.log(`Downloading icon from: ${opts.logo}`);
      await downloadFile(opts.logo, iconAbsPath);
    } else {
      // Local file
      if (!fs.existsSync(opts.logo)) {
        console.error(`Error: logo file not found: ${opts.logo}`);
        process.exit(1);
      }
      fs.copyFileSync(opts.logo, iconAbsPath);
    }

    metadata.logo = iconRelPath;
    console.log(`Icon saved: ${iconRelPath}`);
  } else if (!metadata.logo) {
    // Default logo path even if no logo provided yet
    metadata.logo = `./icons/${chain}/${asset}.svg`;
  }

  // Validate no unknown fields
  const unknownFields = Object.keys(metadata).filter(
    (f) => !permittedFields.includes(f),
  );
  if (unknownFields.length > 0) {
    console.error(
      `Error: unknown fields not permitted: ${unknownFields.join(", ")}`,
    );
    process.exit(1);
  }

  // Write metadata
  const metaDir = path.dirname(metaFile);
  if (!fs.existsSync(metaDir)) {
    fs.mkdirSync(metaDir, { recursive: true });
  }
  fs.writeFileSync(metaFile, JSON.stringify(metadata, null, 2) + "\n");
  console.log(`Metadata written: ${path.relative(__dirname, metaFile)}`);
  console.log(JSON.stringify(metadata, null, 2));
}

/**
 * VERIFY an asset's metadata and icon integrity.
 */
function commandVerify(opts) {
  const caip19Id = opts.asset;
  if (!caip19Id) {
    console.error("Error: --asset <caip19Id> is required");
    process.exit(1);
  }

  if (!isValidCAIP19(caip19Id)) {
    console.error(`Error: "${caip19Id}" is not a valid CAIP-19 identifier`);
    process.exit(1);
  }

  const errors = [];
  const warnings = [];

  // 1. Check metadata file exists
  const metaFile = metadataPath(caip19Id);
  if (!fs.existsSync(metaFile)) {
    errors.push(`Metadata file not found: ${path.relative(__dirname, metaFile)}`);
    printVerifyResult(caip19Id, errors, warnings);
    return;
  }

  // 2. Parse metadata
  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
  } catch (e) {
    errors.push(`Metadata file is not valid JSON: ${e.message}`);
    printVerifyResult(caip19Id, errors, warnings);
    return;
  }

  // 3. Check required fields
  if (!metadata.name) errors.push("Missing required field: name");
  if (!metadata.logo) errors.push("Missing required field: logo");

  // 4. Check permitted fields
  const unknownFields = Object.keys(metadata).filter(
    (f) => !permittedFields.includes(f),
  );
  if (unknownFields.length > 0) {
    errors.push(`Unknown fields: ${unknownFields.join(", ")}`);
  }

  // 5. Symbol length check
  if (metadata.symbol && metadata.symbol.length > 11) {
    errors.push(
      `Symbol "${metadata.symbol}" exceeds 11 characters (${metadata.symbol.length})`,
    );
  }

  // 6. Check logo file exists
  if (metadata.logo) {
    const logoPath = expectedIconPath(metadata.logo);
    if (!fs.existsSync(logoPath)) {
      errors.push(`Logo file not found: ${metadata.logo}`);
    } else {
      // Check file isn't empty
      const stat = fs.statSync(logoPath);
      if (stat.size === 0) {
        errors.push(`Logo file is empty: ${metadata.logo}`);
      }

      // Check file extension
      const ext = path.extname(logoPath).toLowerCase();
      if (ext !== ".svg" && ext !== ".png") {
        warnings.push(`Logo file should be .svg or .png, got: ${ext}`);
      }

      // Check filename has no spaces
      if (path.basename(logoPath).includes(" ")) {
        errors.push(`Logo filename contains spaces: ${metadata.logo}`);
      }
    }
  }

  // 7. Check decimals is a number
  if (metadata.decimals !== undefined && typeof metadata.decimals !== "number") {
    errors.push(`decimals should be a number, got: ${typeof metadata.decimals}`);
  }

  // 8. EVM-specific: check address checksum
  const parsed = parseCAIP19(caip19Id);
  if (parsed && parsed.chainNamespace === "eip155") {
    const address = parsed.assetReference;
    if (address.startsWith("0x")) {
      try {
        const util = require("ethereumjs-util");
        if (!util.isValidChecksumAddress(address)) {
          errors.push(
            `Address is not in valid checksum format: ${address}`,
          );
        }
      } catch (e) {
        warnings.push(
          `Could not validate checksum (ethereumjs-util not available)`,
        );
      }
    }
  }

  printVerifyResult(caip19Id, errors, warnings);
}

function printVerifyResult(caip19Id, errors, warnings) {
  if (errors.length === 0 && warnings.length === 0) {
    console.log(`✓ ${caip19Id} — OK`);
  } else {
    if (errors.length > 0) {
      console.error(`✗ ${caip19Id} — ${errors.length} error(s):`);
      errors.forEach((e) => console.error(`  ERROR: ${e}`));
    }
    if (warnings.length > 0) {
      console.warn(`  ${warnings.length} warning(s):`);
      warnings.forEach((w) => console.warn(`  WARN: ${w}`));
    }
    if (errors.length > 0) {
      process.exitCode = 1;
    }
  }
}

/**
 * LIST assets, optionally filtered by chain.
 */
function commandList(opts) {
  const filterChain = opts.chain || null;

  if (!fs.existsSync(METADATA_DIR)) {
    console.error("Error: metadata directory not found");
    process.exit(1);
  }

  const chains = fs.readdirSync(METADATA_DIR).filter((f) => {
    const full = path.join(METADATA_DIR, f);
    return fs.statSync(full).isDirectory();
  });

  let totalCount = 0;

  for (const chain of chains) {
    if (filterChain && chain !== filterChain) continue;

    const chainDir = path.join(METADATA_DIR, chain);
    const assets = fs.readdirSync(chainDir).filter((f) => f.endsWith(".json"));

    if (assets.length === 0) continue;

    console.log(`\n${chain} (${assets.length} assets):`);
    for (const assetFile of assets) {
      const assetId = assetFile.replace(".json", "");
      const caip19Id = `${chain}/${assetId}`;
      try {
        const meta = JSON.parse(
          fs.readFileSync(path.join(chainDir, assetFile), "utf-8"),
        );
        const symbol = meta.symbol || "???";
        const name = meta.name || "Unknown";
        console.log(`  ${symbol.padEnd(12)} ${name.padEnd(30)} ${caip19Id}`);
      } catch (e) {
        console.log(`  ${"???".padEnd(12)} ${"(parse error)".padEnd(30)} ${caip19Id}`);
      }
      totalCount++;
    }
  }

  console.log(`\nTotal: ${totalCount} assets`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { command, args } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "update":
      await commandUpdate(args);
      break;
    case "verify":
      commandVerify(args);
      break;
    case "list":
      commandList(args);
      break;
    default:
      console.log(`
CAIP-19 Asset Management CLI

Commands:
  update    Create or update an asset's metadata and icon
  verify    Verify an asset's metadata and icon integrity
  list      List all assets, optionally filtered by chain

Examples:
  node cli-update-asset.js update \\
    --asset "eip155:1/erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F" \\
    --name "Dai Stablecoin" --symbol "DAI" --decimals 18 --erc20 \\
    --logo "https://example.com/dai.svg"

  node cli-update-asset.js verify \\
    --asset "eip155:1/erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F"

  node cli-update-asset.js list --chain "eip155:1"
      `);
      if (command) {
        console.error(`Unknown command: ${command}`);
        process.exit(1);
      }
      break;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
