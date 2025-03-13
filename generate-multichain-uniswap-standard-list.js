const fs = require('fs');
const path = require('path');
const contractMap = require('./buildindex.js');

// Get current timestamp in ISO format
const timestamp = new Date().toISOString();

// Create the Uniswap token list format
function createUniswapTokenList() {
  // Transform the metadata into the tokens array format for Uniswap standard
  const tokens = Object.entries(contractMap).map(([key, data]) => {
    // Parse the CAIP-19 ID to extract chain and address information
    // Expected format: eip155:1/erc20:0xAddress
    const [chainPart, addressPart] = key.split('/');
    const chainId = parseInt(chainPart.split(':')[1], 10);
    const address = addressPart.split(':')[1];

    // Generate GitHub raw content URL for the logo
    // The logo path in data is like ./icons/eip155:1/erc20:0xAddress.svg
    // We want to convert it to a GitHub raw URL
    let logoURI = '';
    if (data.logo) {
      const logoFileName = data.logo.split('/').pop();
      logoURI = `https://raw.githubusercontent.com/MetaMask/contract-metadata/master/icons/${chainPart}/${addressPart}.${logoFileName.split('.').pop()}`;
    }

    return {
      chainId,
      address,
      name: data.name || '',
      symbol: data.symbol || '',
      decimals: data.decimals || 18,
      logoURI
    };
  });

  // Create the token list structure according to Uniswap standard
  const tokenList = {
    name: "MetaMask Token List",
    logoURI: "https://images.ctfassets.net/clixtyxoaeas/1ezuBGezqfIeifWdVtwU4c/d970d4cdf13b163efddddd5709164d2e/MetaMask-icon-Fox.svg",
    keywords: [
      "metamask",
      "uniswap",
      "tokens"
    ],
    timestamp,
    tokens,
    version: {
      major: 1,
      minor: 0,
      patch: 0
    }
  };

  return tokenList;
}

// Generate the Uniswap standard token list
const tokenList = createUniswapTokenList();

// Write the token list to a file
const outputPath = path.join(__dirname, 'metamask-uniswap-tokenlist.json');

try {
  fs.writeFileSync(
    outputPath,
    JSON.stringify(tokenList, null, 2),
    'utf8'
  );
  console.log(`Successfully wrote MetaMask Uniswap token list to ${outputPath}`);
} catch (error) {
  console.error('Error writing Uniswap token list:', error);
  process.exit(1);
}
