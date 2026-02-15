# Copilot Instructions for contract-metadata

See [CLAUDE.md](../CLAUDE.md) for full AI assistant instructions.

## Quick Reference

- **CAIP-19 format**: `<chain_namespace>:<chain_reference>/<asset_namespace>:<asset_reference>`
- **Metadata location**: `metadata/<chainId>/<assetId>.json`
- **Icons location**: `icons/<chainId>/<assetId>.<svg|png>`
- **Permitted fields**: `name`, `logo`, `erc20`, `erc721`, `symbol`, `decimals`, `spl20`
- **Tests**: `npm test` (uses `tape` framework)
- **CLI tool**: `node cli-update-asset.js <update|verify|list>`
- **Addresses must be EIP-55 checksummed** for EVM chains
- **Icons must be SVG or PNG** — see `STYLEGUIDE.md`
# Contract Metadata CLI Tool Instructions

## Managing CAIP-19 Assets

This repository uses a CLI tool (`cli-update-asset.js`) to manage contract metadata and icons following the CAIP-19 standard.

### Available Commands

#### 1. Add or Update an Asset

Use the `set` command to add a new asset or update an existing one:

```bash
# Add a new asset with all required fields
npm run asset:set -- \
  --caip "eip155:1/erc20:0xTOKEN_ADDRESS" \
  --name "Token Name" \
  --symbol "SYMBOL" \
  --decimals 18 \
  --image ./path/to/logo.svg

# Or use a direct URL for the image
npm run asset:set -- \
  --caip "eip155:1/erc20:0xTOKEN_ADDRESS" \
  --name "Token Name" \
  --symbol "SYMBOL" \
  --decimals 18 \
  --image "https://example.com/logo.png"

# Update only specific fields of an existing asset
npm run asset:set -- \
  --caip "eip155:1/erc20:0xTOKEN_ADDRESS" \
  --name "Updated Token Name"

# Update just the image
npm run asset:set -- \
  --caip "eip155:1/erc20:0xTOKEN_ADDRESS" \
  --image ./new-logo.svg
```

**Parameters:**
- `--caip`: CAIP-19 identifier (required) - Format: `namespace:chainId/assetNamespace:assetReference`
- `--name`: Token name (required for new assets)
- `--symbol`: Token symbol (required for new assets)
- `--decimals`: Number of decimals (required for new assets)
- `--image`: Path to image file or URL (required for new assets)
  - Supports: `.svg`, `.png`, `.jpg`, `.jpeg`
  - Can be a local file path or HTTP/HTTPS URL
- `--erc20`: Set to `true` or `false` (optional, auto-detected for `erc20:` prefix)
- `--spl`: Set to `true` or `false` (optional, auto-detected for `spl:` prefix)

**CAIP-19 Examples:**
- Ethereum Mainnet: `eip155:1/erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F`
- Polygon: `eip155:137/erc20:0xTOKEN_ADDRESS`
- Solana: `solana:mainnet/spl:TOKEN_ADDRESS`

#### 2. Verify an Asset

Check if an asset's metadata and icon files are valid:

```bash
npm run asset:verify -- \
  --caip "eip155:1/erc20:0xTOKEN_ADDRESS"
```

#### 3. List Assets

List all assets in a specific namespace:

```bash
# List all Ethereum Mainnet assets
npm run asset:list -- --namespace "eip155:1"

# List all Polygon assets
npm run asset:list -- --namespace "eip155:137"
```

### Workflow

1. **Add or update** an asset using `npm run asset:set`
2. **Verify** the changes using `npm run asset:verify`
3. **Rebuild** the contract-map.json: `node buildindex.js`
4. **Review** the changes in git
5. **Commit and push** your changes

### File Structure

The tool automatically manages:
- Metadata files: `metadata/{namespace}/{assetId}.json`
- Icon files: `icons/{namespace}/{assetId}.{ext}`

### Notes

- The tool validates all inputs using Zod schemas
- Icon files are automatically renamed to match the asset ID
- Old icons are removed when updating with a new image
- The `erc20` and `spl` fields are auto-detected based on the asset namespace
- Images from URLs are downloaded and saved with the correct extension
