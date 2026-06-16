const test = require("tape");
const contractMap = require("../buildindex.js");

// --- Ondo tokenized-asset naming convention ---------------------------------
// Ondo tokenized assets are named "<Asset> (Ondo Tokenized)".
// To change the convention, update CANONICAL_ONDO_LABEL (and, if an old label
// should be explicitly rejected going forward, add it to DEPRECATED_ONDO_LABELS).
const CANONICAL_ONDO_LABEL = "(Ondo Tokenized)";
const DEPRECATED_ONDO_LABELS = ["(Ondo Tokenized Stock)"];

// Identifies an Ondo *tokenized* asset by its parenthetical label in any form
// (canonical or deprecated), e.g. "(Ondo Tokenized)" / "(Ondo Tokenized Stock)".
// This intentionally excludes other Ondo assets that don't carry this label,
// such as the ONDO governance token or "Ondo US Dollar Yield" (USDY).
const ONDO_TOKENIZED_LABEL_PATTERN = /\(ondo tokeniz[^)]*\)/i;
const isOndoTokenizedAsset = (name) =>
  typeof name === "string" && ONDO_TOKENIZED_LABEL_PATTERN.test(name);

test("ondo tokenized assets do not use any deprecated naming label", function (t) {
  Object.keys(contractMap).forEach((caip19AssetId) => {
    const { name } = contractMap[caip19AssetId];
    if (!isOndoTokenizedAsset(name)) return;
    DEPRECATED_ONDO_LABELS.forEach((deprecatedLabel) => {
      t.notOk(
        name.includes(deprecatedLabel),
        `"${name}" (${caip19AssetId}) must not use deprecated label "${deprecatedLabel}"`,
      );
    });
  });
  t.end();
});

test("ondo tokenized assets use the canonical naming label", function (t) {
  Object.keys(contractMap).forEach((caip19AssetId) => {
    const { name } = contractMap[caip19AssetId];
    if (!isOndoTokenizedAsset(name)) return;
    t.ok(
      name.includes(CANONICAL_ONDO_LABEL),
      `"${name}" (${caip19AssetId}) must use canonical label "${CANONICAL_ONDO_LABEL}"`,
    );
  });
  t.end();
});
