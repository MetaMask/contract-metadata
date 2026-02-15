## Submission Process

1. Fork this repository.
2. Add your logo image in `.svg` or `.png` format to `icons/<chainId>/<assetId>.<svg|png>`.
3. Add metadata for your asset to `metadata/<chainId>/<assetId>.json`.

Where:

- `<chainId>` uses the CAIP-2 chain id (for example `eip155:1`)
- `<assetId>` uses the CAIP-19 asset id suffix (for example `erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F`)

Criteria:

- The icon should be small, square, high resolution, and either SVG or PNG.
- For EVM assets, addresses must be EIP-55 checksummed.
- For all chains, keep address casing exactly correct when the address format is case-sensitive.
- PR should include link to official project website referencing the suggested address.
- Project website should include explanation of project.
- Project should have clear signs of activity, either traffic on the network, activity on GitHub, or community buzz.
- Nice to have a verified source code on a block explorer like Etherscan.
- Must have a 'NEUTRAL' reputation or 'OK' reputation on Etherscan for Ethereum-network assets.
- Assets must not be ERC-721s or ERC-1155s.

For complete requirements and release details, see the "Submission Process" and "Release & Publishing" sections in `README.md`.
