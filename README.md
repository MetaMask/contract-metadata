# @metamask/contract-metadata

A mapping of checksummed Ethereum contract addresses to metadata, like names, and images of their logos.

All address keys follow the [EIP 55 address checksum format](https://github.com/ethereum/EIPs/issues/55).

This repository is effectively frozen. We recommend that developers of new tokens use [EIP 747](https://docs.metamask.io/guide/registering-your-token.html) to ask the user's permission to display your tokens in their wallet. This reduces the dangers of airdrop-based phishing, and reduces administrative overhead from managing this list.

## Usage

You can install from npm with `npm install @metamask/contract-metadata` and use it in your code like this:

```javascript
import contractMap from '@metamask/contract-metadata'
import ethJSUtil from 'ethereumjs-util'
const { toChecksumAddress } = ethJSUtil

function imageElFor (address) {
  const metadata = contractMap[toChecksumAddress(address)]
  if (metadata?.logo) {
    const fileName = metadata.logo
    const path = `${__dirname}/images/contract/${fileName}`
    const img = document.createElement('img')
    img.src = path
    img.style.width = '100%'
    return img
  }
}

imageElFor ("0x06012c8cf97BEaD5deAe237070F9587f8E7A266d")
```

## Submission Process

Maintaining this list is a considerable chore, and it is not our highest priority. We do not guarantee inclusion in this list on any urgent timeline. We are actively looking for fair and safe ways to maintain a list like this in a decentralized way, because maintaining it is a large and security-delicate task.

1. Fork this repository.
2. Add your logo image in a web-safe format to the `images` folder.
3. Add an entry to the `contract-map.json` file with the specified address as the key, and the image file's name as the value.

Criteria:

- The icon should be small, square, but high resolution, ideally a vector/svg.
- The address should be in checksum format or it will not be accepted.
- Do not add your entry to the end of the JSON map, messing with the trailing comma. Your pull request should only be an addition of lines, and any line removals should be deliberate deprecations of those logos.
- PR should include link to official project website referencing the suggested address.
- Project website should include explanation of project.
- Project should have clear signs of activity, either traffic on the network, activity on GitHub, or community buzz.
- Nice to have a verified source code on a block explorer like Etherscan.
- Must have a ['NEUTRAL' reputation or 'OK' reputation](https://info.etherscan.com/etherscan-token-reputation) on Etherscan.

A sample submission:

```json
{
  "0x6090A6e47849629b7245Dfa1Ca21D94cd15878Ef": {
    "name": "ENS Registrar",
    "logo": "ens.svg"
  }
}
```

Tokens should include a field `"erc20": true`, and can include additional fields:

- symbol (a five-character or less ticker symbol)
- decimals (precision of the tokens stored)

A full list of permitted fields can be found in the [permitted-fields.json](./permitted-fields.json) file.
