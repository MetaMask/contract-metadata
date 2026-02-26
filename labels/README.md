# Address Labels

The Labels system enables the manual curation and management of trust signals data for blockchain assets by various teams across MetaMask. The curated trust signals provide critical metadata to ensure the trustworthiness and integrity of these assets. Teams can use this data to inform decision-making and enhance the MetaMask ecosystem’s reliability.

# Purpose of Trust Signals

Trust signals in the labels system provide curated metadata about blockchain assets, such as:

- Evidence of trustworthiness.
- Warnings about potential risks.
- Contextual metadata to inform intelligent decision-making.

By enabling manual curation, contributors can verify and add trusted data directly, ensuring higher integrity compared to automated systems alone.

# Folder Structure

Trust signals data will be organized in a hierarchical folder structure based on CAIP-2 Chain IDs (for networks) and CAIP-19 Asset IDs (for specific assets/tokens). The structure is as follows:

```
/labels
    ├── /eip155:1
    │   ├── erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.json
    │   ├── erc721:0xabc123def456...json
    │   └── ...
    ├── /eip155:137
    │   ├── erc20:0x123abc...json
    │   └── ...
```

This structure ensures that trust signals data is organized by network (using CAIP-2 Chain IDs), and specific assets (using CAIP-19 Asset IDs).

# Allowed Label

The **Labels** system supports the following predefined categories of trust signals data. A label is stored as an enum type in the trust signals JSON file:

- `verified`
- `benign`
- `warning`
- `malicious`

---

## Usage of Labels

When adding labels for a specific asset, they should be included a string in the respective JSON file.

## JSON Example:

For an asset flagged as `verified`, the JSON file would look like:

```json
{
  "label": "verified"
}
```

# Access and Contributions

To manage contributions securely:

Only specific teams within MetaMask can update or modify trust signals data.
Access control is enforced through the repository's CODEOWNERS configuration.
Contributing teams currently include:

- Product Safety Team
- API Platform Team
- Others as designated by MetaMask leadership.

If you'd like to contribute or request access, please contact the API platform team or the repository maintainers.
