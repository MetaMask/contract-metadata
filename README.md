# @metamask/contract-metadata

A mapping of checksummed Ethereum contract addresses to metadata, like names, and images of their logos.

All address keys follow the [EIP 55 address checksum format](https://github.com/ethereum/EIPs/issues/55).
All file keys follow the [CAIP 19 asset id format](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-19.md).

This repository is effectively frozen. We recommend that developers of new tokens use [EIP 747](https://docs.metamask.io/guide/registering-your-token.html) to ask the user's permission to display your tokens in their wallet. This reduces the dangers of airdrop-based phishing, and reduces administrative overhead from managing this list.

## Usage

You can install from npm with `npm install @metamask/contract-metadata` and use it in your code like this:

```javascript
import contractMap from '@metamask/contract-metadata'
import ethJSUtil from 'ethereumjs-util'
const { toChecksumAddress } = ethJSUtil

function imageElForEVMToken (chainId, address) {
  const caip19Address = `eip155:${chainId}/erc20:${toChecksumAddress(address)}`
  const metadata = contractMap[caip19Address]
  if (metadata?.logo) {
    const fileName = metadata.logo
    const path = `${__dirname}/${metadata.logo}`
    const img = document.createElement('img')
    img.src = path
    img.style.width = '100%'
    return img
  }
}
// to get ethereum erc20 token img el
const ethereumNetworkChainId = 1
imageElForEVMToken (ethereumNetworkChainId, "0x06012c8cf97BEaD5deAe237070F9587f8E7A266d")
```

## Submission Process

Maintaining this list is a considerable chore, and it is not our highest priority. We do not guarantee inclusion in this list on any urgent timeline. We are actively looking for fair and safe ways to maintain a list like this in a decentralized way, because maintaining it is a large and security-delicate task.

1. Fork this repository.
2. Add your logo image in `.svg` or `.png` file format to the `icons` folder.
3. Add your asset metadata in a json format to a  `metadata/${caip19AssetId}.json` file with the CAIP-19 Asset ID as the key inside of the `metadata/` folder.

Criteria:

- The icon should be small, square, but high resolution, and a vector/svg or a png. Please refer to the [style guide](STYLEGUIDE.md) for best practices. 
- The address should be in checksum format or it will not be accepted. This is true of non-evm assets as well - since some network's addressing formats are case-sensitive.
- PR should include link to official project website referencing the suggested address.
- Project website should include explanation of project.
- Project should have clear signs of activity, either traffic on the network, activity on GitHub, or community buzz.
- Nice to have a verified source code on a block explorer like Etherscan.
- Must have a ['NEUTRAL' reputation or 'OK' reputation](https://info.etherscan.com/etherscan-token-reputation) on Etherscan if it is an Ethereum-network asset. Other EVM Networks will be verified as possible.
- Assets must not be ERC-721s or ERC-1155s.

A sample submission:

```json
{
  "eip:155/erc20:0x6090A6e47849629b7245Dfa1Ca21D94cd15878Ef": {
    "name": "ENS Registrar",
    "decimals": 18,
    "symbol": "ENS",
    "erc20": true,
    "logo": "./icons/eip:155/erc20:0x6090A6e47849629b7245Dfa1Ca21D94cd15878Ef.svg"
  }
}
```

Tokens should include a field `"erc20": true`, and can include additional fields:

- symbol (a five-character or less ticker symbol)
- decimals (precision of the tokens stored)

A full list of permitted fields can be found in the [permitted-fields.json](./permitted-fields.json) file.

### Release & Publishing

The project follows the same release process as the other libraries in the MetaMask organization. The GitHub Actions [`action-create-release-pr`](https://github.com/MetaMask/action-create-release-pr) and [`action-publish-release`](https://github.com/MetaMask/action-publish-release) are used to automate the release process; see those repositories for more information about how they work.

1. Choose a release version.

   - The release version should be chosen according to SemVer. Analyze the changes to see whether they include any breaking changes, new features, or deprecations, then choose the appropriate SemVer version. See [the SemVer specification](https://semver.org/) for more information.

2. If this release is backporting changes onto a previous release, then ensure there is a major version branch for that version (e.g. `1.x` for a `v1` backport release).

   - The major version branch should be set to the most recent release with that major version. For example, when backporting a `v1.0.2` release, you'd want to ensure there was a `1.x` branch that was set to the `v1.0.1` tag.

3. Trigger the [`workflow_dispatch`](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#workflow_dispatch) event [manually](https://docs.github.com/en/actions/managing-workflow-runs/manually-running-a-workflow) for the `Create Release Pull Request` action to create the release PR.

   - For a backport release, the base branch should be the major version branch that you ensured existed in step 2. For a normal release, the base branch should be the main branch for that repository (which should be the default value).
   - This should trigger the [`action-create-release-pr`](https://github.com/MetaMask/action-create-release-pr) workflow to create the release PR.

4. Update the changelog to move each change entry into the appropriate change category ([See here](https://keepachangelog.com/en/1.0.0/#types) for the full list of change categories, and the correct ordering), and edit them to be more easily understood by users of the package.

   - Generally any changes that don't affect consumers of the package (e.g. lockfile changes or development environment changes) are omitted. Exceptions may be made for changes that might be of interest despite not having an effect upon the published package (e.g. major test improvements, security improvements, improved documentation, etc.).
   - Try to explain each change in terms that users of the package would understand (e.g. avoid referencing internal variables/concepts).
   - Consolidate related changes into one change entry if it makes it easier to explain.
   - Run `yarn auto-changelog validate --rc` to check that the changelog is correctly formatted.

5. Review and QA the release.

   - If changes are made to the base branch, the release branch will need to be updated with these changes and review/QA will need to restart again. As such, it's probably best to avoid merging other PRs into the base branch while review is underway.

6. Squash & Merge the release.

   - This should trigger the [`action-publish-release`](https://github.com/MetaMask/action-publish-release) workflow to tag the final release commit and publish the release on GitHub.

7. Publish the release on npm.

   - Wait for the `publish-release` GitHub Action workflow to finish. This should trigger a second job (`publish-npm`), which will wait for a run approval by the [`npm publishers`](https://github.com/orgs/MetaMask/teams/npm-publishers) team.
   - Approve the `publish-npm` job (or ask somebody on the npm publishers team to approve it for you).
   - Once the `publish-npm` job has finished, check npm to verify that it has been published.
