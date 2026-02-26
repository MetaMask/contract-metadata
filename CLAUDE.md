# CLAUDE.md — AI Instructions for contract-metadata

This file provides context and instructions for AI assistants (Claude, etc.) working on this repository.

## Repository Overview

`@metamask/contract-metadata` is a mapping of checksummed contract addresses to metadata (names, symbols, decimals, logos) for tokens across multiple blockchain networks. It uses the [CAIP-19](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-19.md) asset identifier standard.

## Directory Structure

- `metadata/` — JSON metadata files organized by chain: `metadata/<chainId>/<assetId>.json`
- `icons/` — SVG/PNG icon files organized by chain: `icons/<chainId>/<assetId>.<ext>`
- `images/` — Legacy icon directory (for old `contract-map.json` entries)
- `contract-map.json` — Legacy flat mapping (Ethereum-only, effectively frozen)
- `labels/` — Additional label metadata for select tokens
- `test/` — Test files using the `tape` testing framework
- `cli-update-asset.js` — CLI tool for managing assets

## CAIP-19 Format

Asset identifiers follow the format: `<chain_namespace>:<chain_reference>/<asset_namespace>:<asset_reference>`

Examples:
- EVM ERC-20: `eip155:1/erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F`
- Bitcoin: `bip122:000000000019d6689c085ae165831e93/slip44:0`
- Solana: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/token:2u1tszSeq...`

## Metadata JSON Format

Each asset has a metadata JSON file with these permitted fields (see `permitted-fields.json`):
- `name` (string, required) — Token name
- `symbol` (string) — Token symbol, max 11 characters
- `decimals` (number) — Token precision
- `erc20` (boolean) — Whether this is an ERC-20 token
- `spl20` (boolean) — Whether this is an SPL token
- `logo` (string) — Relative path to icon file

## Key Rules

1. **Addresses must be checksummed** — EVM addresses follow EIP-55 checksum format
2. **Icons must be SVG or PNG** — See `STYLEGUIDE.md` for icon requirements
3. **No ERC-721 or ERC-1155** — Only fungible tokens
4. **Only permitted fields** — Fields must be in `permitted-fields.json`
5. **Logo paths are relative** — Format: `./icons/<chainId>/<assetId>.<ext>`

## CLI Tool

Use `cli-update-asset.js` for asset management:
```bash
# Create/update an asset
node cli-update-asset.js update --asset "eip155:1/erc20:0x..." --name "Token" --symbol "TKN" --decimals 18 --erc20 --logo "https://..."

# Verify an asset's integrity
node cli-update-asset.js verify --asset "eip155:1/erc20:0x..."

# List all assets
node cli-update-asset.js list --chain "eip155:1"
```

Or via npm scripts: `npm run asset:update`, `npm run asset:verify`, `npm run asset:list`

## Testing

```bash
npm test                    # Run all tests
npm run test:caip          # Run CAIP metadata tests only
npm run test:cli           # Run CLI tool tests only
```

Tests use the `tape` testing framework. No build step is required.

## When Making Changes

- Run `npm test` to verify all tests pass
- Ensure new metadata entries have corresponding icon files
- Ensure addresses are checksummed for EVM chains
- Keep metadata minimal — only use permitted fields
