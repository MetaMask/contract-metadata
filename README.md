# @metamask/contract-metadata

A mapping of ethereum contract addresses to broadly accepted icons for those addresses, plus a CAIP-19 based multi-chain metadata store used in this repository.

- The **npm package** exports a legacy Ethereum mainnet map keyed by [EIP-55](https://github.com/ethereum/EIPs/issues/55) checksummed addresses (`contract-map.json` + `images/`).
- The **repository source of truth** for new assets is CAIP-19 file layout under `metadata/` and `icons/` ([CAIP-19](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-19.md)).

This repository is effectively frozen for casual token additions. We recommend that developers of new tokens use [EIP-747](https://docs.metamask.io/guide/registering-your-token.html) to ask the user's permission to display your tokens in their wallet. This reduces the dangers of airdrop-based phishing, and reduces administrative overhead from managing this list.

## Usage

Install from npm with `npm install @metamask/contract-metadata` and use it like this:

```javascript
import contractMap from '@metamask/contract-metadata'
import ethJSUtil from 'ethereumjs-util'
const { toChecksumAddress } = ethJSUtil

function imageElFor (address) {
  const metadata = contractMap[toChecksumAddress(address)]
  if (metadata?.logo) {
    const img = document.createElement('img')
    // Published package keeps logos under images/
    img.src = `${__dirname}/images/${metadata.logo}`
    img.style.width = '100%'
    return img
  }
}

imageElFor('0x6B175474E89094C44Da98b954EedeAC495271d0F')
```

Each map entry looks like:

```json
{
  "name": "Dai Stablecoin",
  "logo": "dai.svg",
  "erc20": true,
  "symbol": "DAI",
  "decimals": 18
}
```

For local CAIP-19 data in this repo, require `./buildindex.js` instead. That builds an in-memory map keyed by CAIP-19 asset IDs (for example `eip155:1/erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F`) from the `metadata/` folder. It does **not** rewrite `contract-map.json`.

## CLI Tool for Managing Assets

This repository includes a CLI tool (`cli-update-asset.js`) to help manage contract metadata and icons following the CAIP-19 standard.

### Available Commands

#### Add or Update an Asset

```bash
# Add a new asset
npm run asset:set -- \
  --caip "eip155:1/erc20:0xTOKEN_ADDRESS" \
  --name "Token Name" \
  --symbol "SYMBOL" \
  --decimals 18 \
  --image ./path/to/logo.svg

# Update an existing asset
npm run asset:set -- \
  --caip "eip155:1/erc20:0xTOKEN_ADDRESS" \
  --name "Updated Token Name"

# Update labels
npm run asset:set -- \
  --caip "eip155:1/erc20:0xTOKEN_ADDRESS" \
  --labels "stable_coin,blue_chip"

# Use an image URL
npm run asset:set -- \
  --caip "eip155:1/erc20:0xTOKEN_ADDRESS" \
  --name "Token Name" \
  --symbol "SYMBOL" \
  --decimals 18 \
  --image "https://example.com/logo.png"
```

#### Verify an Asset

```bash
npm run asset:verify -- \
  --caip "eip155:1/erc20:0xTOKEN_ADDRESS"
```

#### List Assets

```bash
# List all assets in a namespace
npm run asset:list -- --namespace "eip155:1"
```

### CLI Parameters

- `--caip`: CAIP-19 identifier (required) - Format: `namespace:chainId/assetNamespace:assetReference`
- `--name`: Token name (required for new assets)
- `--symbol`: Token symbol (required for new assets)
- `--decimals`: Number of decimals (required for new assets)
- `--image`: Path to image file or URL (required for new assets)
  - Supports: `.svg`, `.png`, `.jpg`, `.jpeg`
  - Can be a local file path or HTTP/HTTPS URL
- `--labels`: Labels for the asset (optional)
  - Comma-separated values: `stable_coin,blue_chip`
  - Or JSON array: `["stable_coin","blue_chip"]`
- `--erc20`: Set to `true` or `false` (optional, auto-detected for `erc20:` prefix)
- `--spl`: Set to `true` or `false` (optional, auto-detected for `spl:` prefix)

### File Structure

The tool manages:

- Metadata: `metadata/{namespace}/{assetId}.json`  
  Example: `metadata/eip155:1/erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F.json`
- Icons: `icons/{namespace}/{assetId}.{ext}`  
  Example: `icons/eip155:1/erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F.svg`
- Labels (optional): `labels/{namespace}/{assetId}.json`

### Workflow

1. Add or update an asset using `npm run asset:set`
2. Verify the changes using `npm run asset:verify`
3. Run tests: `npm test`
4. Review the changes in git
5. Commit and push your changes

The tool automatically:

- Validates all inputs using Zod schemas
- Renames icon files to match the asset ID
- Removes old icons when updating with a new image
- Auto-detects `erc20` and `spl` fields based on the asset namespace
- Downloads and saves images from URLs with the correct extension

## Network Icons

Network (chain) icons live in [`network-icons/`](./network-icons), one file per network, named by its [CAIP-2 chain ID](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md):

```
network-icons/eip155:1.svg
network-icons/eip155:59144.svg
network-icons/bip122:000000000019d6689c085ae165831e93.svg
```

Rules (enforced by `npm run network-icons:verify` and `npm test`):

- `.svg` only. Raster formats are not accepted.
- The file name must be a valid CAIP-2 chain ID.
- The root `<svg>` must declare `xmlns="http://www.w3.org/2000/svg"`.
- The root `<svg>` must be `width="256" height="256"` with a square `viewBox`. For non-square artwork, pad the viewBox to a square instead of stretching it (e.g. `viewBox="0 0 346 360"` → `viewBox="-7 0 360 360"`).
- No `<script>`, `<foreignObject>`, `<image>` (embedded rasters), inline event handlers, `DOCTYPE`/`ENTITY` declarations, or external references (`href`/`url()` must point to a `#fragment`).
- 100 KB max. Strip editor metadata (e.g. Adobe Illustrator's `i:pgf` blocks) before submitting.

On every merge to `master`, the icons are uploaded to the static cache bucket with the CAIP-2 colon turned into a path separator:

```
https://static.cx.metamask.io/api/v2/networkIcons/{namespace}/{reference}.svg
https://static.cx.metamask.io/api/v2/networkIcons/eip155/1.svg
```

The upload only adds or replaces objects. Deleting a file here does not remove it from the bucket.

## Submission Process

Maintaining this list is a considerable chore, and it is not our highest priority. We do not guarantee inclusion in this list on any urgent timeline. We are actively looking for fair and safe ways to maintain a list like this in a decentralized way, because maintaining it is a large and security-delicate task.

Preferred path: use the CLI (`npm run asset:set`) so paths and fields are generated correctly.

Manual submissions:

1. Fork this repository.
2. Add your logo image in `.svg` or `.png` format under `icons/{namespace}/` using the CAIP-19 asset id as the filename (for example `icons/eip155:1/erc20:0x….svg`).
3. Add asset metadata as a JSON object (not wrapped in an outer key) at `metadata/{namespace}/{assetId}.json`.

Criteria:

- The icon should be small, square, but high resolution, and a vector/svg or a png. Please refer to the [style guide](STYLEGUIDE.md) for best practices.
- The address should be in checksum format or it will not be accepted. This is true of non-evm assets as well - since some network's addressing formats are case-sensitive.
- PR should include link to official project website referencing the suggested address.
- Project website should include explanation of project.
- Project should have clear signs of activity, either traffic on the network, activity on GitHub, or community buzz.
- Nice to have a verified source code on a block explorer like Etherscan.
- Must have a ['NEUTRAL' reputation or 'OK' reputation](https://info.etherscan.com/etherscan-token-reputation) on Etherscan if it is an Ethereum-network asset. Other EVM Networks will be verified as possible.
- Assets must not be ERC-721s or ERC-1155s.

A sample submission file at `metadata/eip155:1/erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F.json`:

```json
{
  "name": "Dai Stablecoin",
  "decimals": 18,
  "symbol": "DAI",
  "erc20": true,
  "logo": "./icons/eip155:1/erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F.svg"
}
```

Tokens should include a field `"erc20": true` when applicable, and can include additional fields:

- `symbol` (ticker symbol; keep to 11 characters or fewer to pass tests)
- `decimals` (precision of the tokens stored)

A full list of permitted fields for the legacy contract map can be found in the [permitted-fields.json](./permitted-fields.json) file.

### Release & Publishing

The project follows the same release process as the other libraries in the MetaMask organization. The GitHub Actions [`action-create-release-pr`](https://github.com/MetaMask/action-create-release-pr) and [`action-publish-release`](https://github.com/MetaMask/action-publish-release) are used to automate the release process; see those repositories for more information about how they work.

1. Choose a release version.

   - The release version should be chosen according to SemVer. Analyze the changes to see whether they include any breaking changes, new features, or deprecations, then choose the appropriate SemVer version. See [the SemVer specification](https://semver.org/) for more information.

2. If this release is backporting changes onto a previous release, then ensure there is a major version branch for that version (e.g. `1.x` for a `v1` backport release).

   - The major version branch should be set to the most recent release with that major version. For example, when backporting a `v1.0.2` release, you'd want to ensure there was a `1.x` branch that was set to the `v1.0.1` tag.

3. Trigger the [`workflow_dispatch`](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#workflow_dispatch) event [manually](https://docs.github.com/en/actions/managing-workflow-runs/manually-running-a-workflow) for the `Create Release Pull Request` action to create the release PR.

   - For a backport release, the base branch should be the major version branch that you ensured existed in step 2. For a normal release, the base branch should be `master` (the workflow default).
   - This should trigger the [`action-create-release-pr`](https://github.com/MetaMask/action-create-release-pr) workflow to create the release PR.

4. Update the changelog to move each change entry into the appropriate change category ([See here](https://keepachangelog.com/en/1.0.0/#types) for the full list of change categories, and the correct ordering), and edit them to be more easily understood by users of the package.

   - Generally any changes that don't affect consumers of the package (e.g. lockfile changes or development environment changes) are omitted. Exceptions may be made for changes that might be of interest despite not having an effect upon the published package (e.g. major test improvements, security improvements, improved documentation, etc.).
   - Try to explain each change in terms that users of the package would understand (e.g. avoid referencing internal variables/concepts).
   - Consolidate related changes into one change entry if it makes it easier to explain.

5. Review and QA the release.

   - If changes are made to the base branch, the release branch will need to be updated with these changes and review/QA will need to restart again. As such, it's probably best to avoid merging other PRs into the base branch while review is underway.

6. Squash & Merge the release.

   - This should trigger the [`action-publish-release`](https://github.com/MetaMask/action-publish-release) workflow to tag the final release commit and publish the release on GitHub.

7. Publish the release on npm.

   - Wait for the `publish-release` GitHub Action workflow to finish. This should trigger a second job (`publish-npm`), which will wait for a run approval by the [`npm publishers`](https://github.com/orgs/MetaMask/teams/npm-publishers) team.
   - Approve the `publish-npm` job (or ask somebody on the npm publishers team to approve it for you).
   - Once the `publish-npm` job has finished, check npm to verify that it has been published.
