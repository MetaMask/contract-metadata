# Ethereum Contract Icons

[![CircleCI](https://circleci.com/gh/MetaMask/ethereum-contract-icons.svg?style=svg)](https://circleci.com/gh/MetaMask/ethereum-contract-icons)

A mapping of checksummed ethereum addresses to images of those addresses' logos.

All address keys follow the [EIP 55 address checksum format](https://github.com/ethereum/EIPs/issues/55).

Submit PRs to add valid logos, and obviously valid logos will be merged.

## Submission Process

1. Fork this repository.
2. Add your logo image in a web-safe format to the `images` folder.
3. Add an entry to the `icon-map.json` file with the specified address as the key, and the image file's name as the value.

Criteria:
- The icon should be small, but high resolution, ideally a vector/svg.
- Do not add your entry to the end of the JSON map, messing with the trailing comma. Your pull request should only be an addition of lines, and any line removals should be deliberate deprecations of those logos.


