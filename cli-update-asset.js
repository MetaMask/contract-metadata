#!/usr/bin/env node

/**
 * CLI Tool for updating CAIP-19 assets (metadata and images)
 *
 * Usage:
 *   node cli-update-asset.js set --caip "eip155:1/erc20:0x..." --name "Token Name" --symbol "TKN" --decimals 18 --image path/to/logo.svg
 *   node cli-update-asset.js set --caip "eip155:1/erc20:0x..." --name "New Name" --image path/to/new-logo.png
 *   node cli-update-asset.js verify --caip "eip155:1/erc20:0x..."
 *   node cli-update-asset.js list --namespace "eip155:1"
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { z } = require('zod');
const https = require('https');
const http = require('http');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);
const readdir = promisify(fs.readdir);

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Supported image extensions
const SUPPORTED_IMAGE_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg'];

// Zod Schemas
const CAIP19Schema = z.string().regex(
  /^[-a-z0-9]{3,8}:[-a-zA-Z0-9]{1,32}\/[-a-z0-9]{3,8}:[a-zA-Z0-9]+$/,
  'Invalid CAIP-19 format. Expected: namespace:chainId/assetNamespace:assetReference'
);

const MetadataSchema = z.object({
  name: z.string().min(1, "Name is required and cannot be empty"),
  symbol: z
    .string()
    .min(1, "Symbol is required and cannot be empty")
    .max(20, "Symbol must be 20 characters or less"),
  decimals: z
    .number()
    .int()
    .min(0)
    .max(255, "Decimals must be between 0 and 255"),
  logo: z.string().min(1, "Logo path is required"),
  erc20: z.boolean().optional(),
  spl: z.boolean().optional(),
});

const SetCommandFlagsSchema = z.object({
  caip: z.string(),
  name: z.string().optional(),
  symbol: z.string().optional(),
  decimals: z.string().optional(),
  image: z.string().optional(),
  erc20: z.enum(["true", "false"]).optional(),
  spl: z.enum(["true", "false"]).optional(),
});

const VerifyCommandFlagsSchema = z.object({
  caip: z.string()
});

const ListCommandFlagsSchema = z.object({
  namespace: z.string().regex(/^[-a-z0-9]{3,8}:[-a-zA-Z0-9]{1,32}$/, 'Invalid namespace format')
});

/**
 * Parse CAIP-19 asset identifier
 * Format: {namespace}:{chain_id}/{asset_namespace}:{asset_reference}
 * Example: eip155:1/erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F
 */
function parseCAIP19(caipId) {
  // Validate with Zod
  const result = CAIP19Schema.safeParse(caipId);
  if (!result.success) {
    const errorMessage = result.error.errors[0]?.message || 'Invalid CAIP-19 format';
    throw new Error(`${errorMessage}\nExpected format: namespace:chainId/assetNamespace:assetReference\nExample: eip155:1/erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F`);
  }

  const match = caipId.match(/^([^:]+:[^/]+)\/(.+)$/);
  const [, chainNamespace, assetId] = match;

  return {
    chainNamespace,  // e.g., "eip155:1"
    assetId,         // e.g., "erc20:0x..."
    full: caipId
  };
}

/**
 * Get file paths for metadata and icon
 */
function getAssetPaths(caipId) {
  const parsed = parseCAIP19(caipId);

  return {
    metadataDir: path.join(__dirname, 'metadata', parsed.chainNamespace),
    metadataFile: path.join(__dirname, 'metadata', parsed.chainNamespace, `${parsed.assetId}.json`),
    iconDir: path.join(__dirname, 'icons', parsed.chainNamespace),
    // We'll determine the actual icon file extension later
    iconFileBase: path.join(__dirname, 'icons', parsed.chainNamespace, parsed.assetId)
  };
}

/**
 * Find existing icon file (any supported extension)
 */
async function findExistingIcon(iconFileBase) {
  for (const ext of SUPPORTED_IMAGE_EXTENSIONS) {
    const iconPath = `${iconFileBase}${ext}`;
    try {
      await access(iconPath, fs.constants.F_OK);
      return iconPath;
    } catch (err) {
      // File doesn't exist, continue
    }
  }
  return null;
}

/**
 * Check if a string is a URL
 */
function isUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Download a file from a URL
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    client.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(response.headers['content-type']);
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {}); // Clean up partial file
        reject(err);
      });
    }).on('error', reject);
  });
}

/**
 * Get file extension from URL or content-type
 */
function getExtensionFromUrl(url, contentType) {
  // Try to get extension from URL
  const urlPath = new URL(url).pathname;
  const urlExt = path.extname(urlPath).toLowerCase();

  if (SUPPORTED_IMAGE_EXTENSIONS.includes(urlExt)) {
    return urlExt;
  }

  // Fall back to content-type
  if (contentType) {
    const mimeToExt = {
      'image/svg+xml': '.svg',
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg'
    };

    const type = contentType.split(';')[0].trim();
    return mimeToExt[type] || '.png';
  }

  return '.png'; // Default fallback
}

/**
 * Parse command line flags
 */
function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const value = args[i + 1];
      flags[key] = value;
      i++; // Skip next argument since it's the value
    }
  }
  return flags;
}

/**
 * Validate metadata fields using Zod
 */
function validateMetadata(metadata) {
  const result = MetadataSchema.safeParse(metadata);

  if (!result.success) {
    return result.error.errors.map(err => {
      const field = err.path.join('.');
      return `${field}: ${err.message}`;
    });
  }

  return [];
}

/**
 * Set (add or update) an asset
 */
async function setAsset(caipId, options) {
  const paths = getAssetPaths(caipId);
  const parsed = parseCAIP19(caipId);

  // Check if asset already exists
  let existingMetadata = null;
  let isNewAsset = false;

  try {
    const metadataContent = await readFile(paths.metadataFile, 'utf8');
    existingMetadata = JSON.parse(metadataContent);
    console.log(`Updating existing asset: ${caipId}`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`Creating new asset: ${caipId}`);
      isNewAsset = true;
    } else {
      throw err;
    }
  }

  // For new assets, ensure required fields are provided
  if (isNewAsset) {
    const missingFields = [];
    if (!options.name) missingFields.push('--name');
    if (!options.symbol) missingFields.push('--symbol');
    if (options.decimals === undefined) missingFields.push('--decimals');
    if (!options.image) missingFields.push('--image');

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields for new asset: ${missingFields.join(', ')}`);
    }
  }

  // Create directories if they don't exist
  await mkdir(paths.metadataDir, { recursive: true });
  await mkdir(paths.iconDir, { recursive: true });

  // Build or update metadata
  const metadata = existingMetadata || {};

  // Handle image update/creation
  if (options.image) {
    let imageSource = options.image;
    let imageExt;
    let tempDownloadPath = null;

    try {
      // Check if image is a URL
      if (isUrl(options.image)) {
        console.log(`Downloading image from URL: ${options.image}`);

        // Download to temporary location first
        tempDownloadPath = path.join(paths.iconDir, `temp-download-${Date.now()}`);
        const contentType = await downloadFile(options.image, tempDownloadPath);
        imageExt = getExtensionFromUrl(options.image, contentType);
        imageSource = tempDownloadPath;

        console.log(`✓ Downloaded image (${contentType})`);
      } else {
        // Local file path
        imageExt = path.extname(options.image).toLowerCase();
        if (!SUPPORTED_IMAGE_EXTENSIONS.includes(imageExt)) {
          throw new Error(`Unsupported image format: ${imageExt}. Supported: ${SUPPORTED_IMAGE_EXTENSIONS.join(', ')}`);
        }
      }

      // Remove old icon if updating
      if (!isNewAsset) {
        const oldIcon = await findExistingIcon(paths.iconFileBase);
        if (oldIcon) {
          fs.unlinkSync(oldIcon);
          console.log(`✓ Removed old icon: ${oldIcon}`);
        }
      }

      // Copy/move image to final location with correct name
      const iconFile = `${paths.iconFileBase}${imageExt}`;
      await copyFile(imageSource, iconFile);
      console.log(`✓ ${isNewAsset ? 'Saved' : 'Updated'} image to: ${iconFile}`);

      // Update metadata logo path
      metadata.logo = `./icons/${parsed.chainNamespace}/${parsed.assetId}${imageExt}`;
    } finally {
      // Clean up temp file if we downloaded (always runs, even on error)
      if (tempDownloadPath) {
        try {
          fs.unlinkSync(tempDownloadPath);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    }
  }

  // Update fields (only if provided, or if new asset and required)
  if (options.name) {
    metadata.name = options.name;
  }

  if (options.symbol) {
    metadata.symbol = options.symbol;
  }

  if (options.decimals !== undefined) {
    metadata.decimals = parseInt(options.decimals, 10);
  }

  // Handle optional fields
  if (options.erc20 !== undefined) {
    metadata.erc20 = options.erc20 === 'true';
  } else if (isNewAsset && parsed.assetId.startsWith('erc20:')) {
    metadata.erc20 = true;
  }

  if (options.spl !== undefined) {
    metadata.spl = options.spl === 'true';
  } else if (isNewAsset && parsed.assetId.startsWith('spl:')) {
    metadata.spl = true;
  }

  // Validate metadata
  const errors = validateMetadata(metadata);
  if (errors.length > 0) {
    throw new Error(`Metadata validation failed:\n${errors.join('\n')}`);
  }

  // Write metadata file
  await writeFile(paths.metadataFile, JSON.stringify(metadata, null, 2) + '\n');
  console.log(`✓ ${isNewAsset ? 'Created' : 'Updated'} metadata file: ${paths.metadataFile}`);

  console.log(`\n✓ Asset ${isNewAsset ? 'added' : 'updated'} successfully!`);
  console.log('\nNext steps:');
  console.log('1. Review the changes');
  console.log('2. Rebuild the contract-map.json: node buildindex.js');
  console.log('3. Commit and push your changes');
}

/**
 * Verify an asset's files exist and are valid
 */
async function verifyAsset(caipId) {
  console.log(`Verifying asset: ${caipId}`);

  const paths = getAssetPaths(caipId);
  const issues = [];

  // Check metadata file
  let metadata;
  try {
    const metadataContent = await readFile(paths.metadataFile, 'utf8');
    metadata = JSON.parse(metadataContent);
    console.log('✓ Metadata file exists and is valid JSON');
  } catch (err) {
    issues.push(`Metadata file error: ${err.message}`);
  }

  if (metadata) {
    // Validate metadata structure
    const errors = validateMetadata(metadata);
    if (errors.length > 0) {
      issues.push(...errors.map(e => `Metadata validation: ${e}`));
    } else {
      console.log('✓ Metadata structure is valid');
    }

    // Check if icon file exists
    const iconFile = await findExistingIcon(paths.iconFileBase);
    if (iconFile) {
      console.log(`✓ Icon file exists: ${iconFile}`);

      // Check if logo path in metadata matches actual file
      const expectedLogoPath = path.basename(iconFile);
      const metadataLogoPath = path.basename(metadata.logo);
      if (expectedLogoPath !== metadataLogoPath) {
        issues.push(`Logo path mismatch: metadata references "${metadataLogoPath}" but file is "${expectedLogoPath}"`);
      }
    } else {
      issues.push('Icon file not found');
    }
  }

  if (issues.length > 0) {
    console.log('\n⚠ Issues found:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    process.exit(1);
  } else {
    console.log('\n✓ Asset verification passed!');
  }
}

/**
 * List assets in a namespace
 */
async function listAssets(namespace) {
  console.log(`Listing assets in namespace: ${namespace}`);

  const metadataDir = path.join(__dirname, 'metadata', namespace);

  try {
    const files = await readdir(metadataDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    console.log(`\nFound ${jsonFiles.length} assets:\n`);

    for (const file of jsonFiles.sort()) {
      const assetId = file.replace('.json', '');
      const caipId = `${namespace}/${assetId}`;
      const metadataPath = path.join(metadataDir, file);

      try {
        const content = await readFile(metadataPath, 'utf8');
        const metadata = JSON.parse(content);
        console.log(`  ${caipId}`);
        console.log(`    Name: ${metadata.name}`);
        console.log(`    Symbol: ${metadata.symbol}`);
        console.log(`    Decimals: ${metadata.decimals}`);
      } catch (err) {
        console.log(`  ${caipId} (error reading metadata: ${err.message})`);
      }
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('No assets found in this namespace.');
    } else {
      throw err;
    }
  }
}

/**
 * Display help information
 */
function showHelp() {
  console.log(`
CAIP-19 Asset Update CLI Tool

Usage:
  node cli-update-asset.js <command> [options]

Commands:
  set       Add a new asset or update an existing one
  verify    Verify an asset's files exist and are valid
  list      List all assets in a namespace
  help      Show this help message

Set Command Options:
  --caip <id>        CAIP-19 asset identifier (required)
                     Format: namespace:chainId/assetNamespace:assetReference
                     Example: eip155:1/erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F
  --name <name>      Asset name (required for new assets)
  --symbol <symbol>  Asset symbol (required for new assets)
  --decimals <num>   Number of decimals (required for new assets)
  --image <path>     Path to image file or URL (required for new assets)
                     Supports: .svg, .png, .jpg, .jpeg
                     Can be a local file path or HTTP/HTTPS URL
  --erc20 <bool>     Whether this is an ERC20 token (optional, default: auto-detect)
  --spl <bool>       Whether this is a Solana SPL token (optional, default: auto-detect)

Verify Command Options:
  --caip <id>        CAIP-19 asset identifier (required)

List Command Options:
  --namespace <ns>   Chain namespace (required)
                     Example: eip155:1, eip155:137, etc.

Examples:
  # Add a new token with a local image file
  node cli-update-asset.js set \\
    --caip "eip155:1/erc20:0x1234567890123456789012345678901234567890" \\
    --name "My Token" \\
    --symbol "MTK" \\
    --decimals 18 \\
    --image ./my-token-logo.svg

  # Add a new token with an image URL
  node cli-update-asset.js set \\
    --caip "eip155:1/erc20:0x1234567890123456789012345678901234567890" \\
    --name "My Token" \\
    --symbol "MTK" \\
    --decimals 18 \\
    --image "https://example.com/logo.svg"

  # Update token name and image
  node cli-update-asset.js set \\
    --caip "eip155:1/erc20:0x1234567890123456789012345678901234567890" \\
    --name "My New Token Name" \\
    --image ./new-logo.png

  # Update just the image
  node cli-update-asset.js set \\
    --caip "eip155:1/erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F" \\
    --image ./new-dai-logo.svg

  # Verify an asset
  node cli-update-asset.js verify \\
    --caip "eip155:1/erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F"

  # List all assets on Ethereum mainnet
  node cli-update-asset.js list --namespace "eip155:1"

Notes:
  - Supported image formats: .svg, .png, .jpg, .jpeg
  - After adding/updating assets, rebuild the index: node buildindex.js
  - Follow CAIP-19 standard for asset identifiers
  - Icon files should be square and high resolution (preferably vector/svg)
  - The 'set' command automatically detects whether to add or update
`);
}

/**
 * Main CLI handler
 */
async function main() {
  try {
    const flags = parseFlags(args.slice(1));

    switch (command) {
      case 'set':
      case 'add':
      case 'update':
        {
          const validationResult = SetCommandFlagsSchema.safeParse(flags);
          if (!validationResult.success) {
            const errors = validationResult.error.errors.map(err =>
              `${err.path.join('.')}: ${err.message}`
            ).join('\n');
            throw new Error(`Invalid flags:\n${errors}`);
          }

          if (!flags.caip) {
            throw new Error('--caip flag is required');
          }
          await setAsset(flags.caip, flags);
        }
        break;

      case 'verify':
        {
          const validationResult = VerifyCommandFlagsSchema.safeParse(flags);
          if (!validationResult.success) {
            const errors = validationResult.error.errors.map(err =>
              `${err.path.join('.')}: ${err.message}`
            ).join('\n');
            throw new Error(`Invalid flags:\n${errors}`);
          }

          if (!flags.caip) {
            throw new Error('--caip flag is required');
          }
          await verifyAsset(flags.caip);
        }
        break;

      case 'list':
        {
          const validationResult = ListCommandFlagsSchema.safeParse(flags);
          if (!validationResult.success) {
            const errors = validationResult.error.errors.map(err =>
              `${err.path.join('.')}: ${err.message}`
            ).join('\n');
            throw new Error(`Invalid flags:\n${errors}`);
          }

          if (!flags.namespace) {
            throw new Error('--namespace flag is required');
          }
          await listAssets(flags.namespace);
        }
        break;

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        console.error(`Unknown command: ${command}\n`);
        showHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}\n`);
    if (err.stack && process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  parseCAIP19,
  getAssetPaths,
  validateMetadata,
  setAsset,
  verifyAsset,
  listAssets
};
