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
