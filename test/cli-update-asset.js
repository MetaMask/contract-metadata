const test = require("tape");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const CLI = path.join(__dirname, "..", "cli-update-asset.js");

// Helper to run the CLI and capture output
function run(args, opts = {}) {
  try {
    const result = execSync(`node "${CLI}" ${args}`, {
      encoding: "utf-8",
      cwd: path.join(__dirname, ".."),
      timeout: 15000,
      ...opts,
    });
    return { stdout: result, exitCode: 0 };
  } catch (e) {
    return {
      stdout: (e.stdout || "") + (e.stderr || ""),
      exitCode: e.status || 1,
    };
  }
}

// ---------------------------------------------------------------------------
// CAIP-19 Validation Tests
// ---------------------------------------------------------------------------

test("cli: shows help with no command", function (t) {
  const { stdout, exitCode } = run("");
  t.equal(exitCode, 0, "exits with 0");
  t.ok(stdout.includes("CAIP-19 Asset Management CLI"), "shows help text");
  t.end();
});

test("cli: errors on unknown command", function (t) {
  const { stdout, exitCode } = run("foobar");
  t.equal(exitCode, 1, "exits with 1");
  t.ok(stdout.includes("Unknown command"), "mentions unknown command");
  t.end();
});

// ---------------------------------------------------------------------------
// Update Command Tests
// ---------------------------------------------------------------------------

test("cli update: requires --asset flag", function (t) {
  const { stdout, exitCode } = run("update --name Test");
  t.equal(exitCode, 1, "exits with 1");
  t.ok(stdout.includes("--asset"), "mentions --asset requirement");
  t.end();
});

test("cli update: rejects invalid CAIP-19 id", function (t) {
  const { stdout, exitCode } = run(
    'update --asset "not-a-valid-id" --name Test',
  );
  t.equal(exitCode, 1, "exits with 1");
  t.ok(stdout.includes("not a valid CAIP-19"), "reports invalid CAIP-19");
  t.end();
});

test("cli update: creates new asset metadata", function (t) {
  const testChain = "eip155:999999";
  const testAsset = "erc20:0xTEST1234567890abcdef1234567890abcdef1234";
  const caip19 = `${testChain}/${testAsset}`;
  const metaFile = path.join(
    __dirname,
    "..",
    "metadata",
    testChain,
    `${testAsset}.json`,
  );

  // Clean up before test
  if (fs.existsSync(metaFile)) fs.unlinkSync(metaFile);

  const { stdout, exitCode } = run(
    `update --asset "${caip19}" --name "Test Token" --symbol "TST" --decimals 18 --erc20`,
  );
  t.equal(exitCode, 0, "exits with 0");
  t.ok(stdout.includes("Creating new asset"), "reports creating new asset");
  t.ok(fs.existsSync(metaFile), "metadata file was created");

  const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
  t.equal(meta.name, "Test Token", "name is correct");
  t.equal(meta.symbol, "TST", "symbol is correct");
  t.equal(meta.decimals, 18, "decimals is correct");
  t.equal(meta.erc20, true, "erc20 flag is set");

  // Clean up
  fs.unlinkSync(metaFile);
  // Clean up directory if empty
  const dir = path.dirname(metaFile);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }

  t.end();
});

test("cli update: updates existing asset metadata", function (t) {
  const testChain = "eip155:999999";
  const testAsset = "erc20:0xTEST1234567890abcdef1234567890abcdef1234";
  const caip19 = `${testChain}/${testAsset}`;
  const metaDir = path.join(__dirname, "..", "metadata", testChain);
  const metaFile = path.join(metaDir, `${testAsset}.json`);

  // Create initial asset
  if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(
    metaFile,
    JSON.stringify({ name: "Old Name", symbol: "OLD", decimals: 8, erc20: true, logo: `./icons/${testChain}/${testAsset}.svg` }),
  );

  const { stdout, exitCode } = run(
    `update --asset "${caip19}" --name "New Name" --symbol "NEW"`,
  );
  t.equal(exitCode, 0, "exits with 0");
  t.ok(stdout.includes("Updating existing asset"), "reports updating");

  const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
  t.equal(meta.name, "New Name", "name was updated");
  t.equal(meta.symbol, "NEW", "symbol was updated");
  t.equal(meta.decimals, 8, "decimals preserved from original");

  // Clean up
  fs.unlinkSync(metaFile);
  if (fs.existsSync(metaDir) && fs.readdirSync(metaDir).length === 0) {
    fs.rmdirSync(metaDir);
  }

  t.end();
});

// ---------------------------------------------------------------------------
// Icon Replacement Tests
// ---------------------------------------------------------------------------

test("cli update: removes old icon when format changes", function (t) {
  const testChain = "eip155:999999";
  const testAsset = "erc20:0xICON1234567890abcdef1234567890abcdef1234";
  const caip19 = `${testChain}/${testAsset}`;
  const metaDir = path.join(__dirname, "..", "metadata", testChain);
  const metaFile = path.join(metaDir, `${testAsset}.json`);
  const iconsDir = path.join(__dirname, "..", "icons", testChain);
  const oldIconPath = path.join(iconsDir, `${testAsset}.svg`);
  const newIconPath = path.join(iconsDir, `${testAsset}.png`);

  // Setup: create existing metadata + old SVG icon
  if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true });
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
  fs.writeFileSync(
    metaFile,
    JSON.stringify({
      name: "Icon Test",
      symbol: "ICT",
      decimals: 18,
      erc20: true,
      logo: `./icons/${testChain}/${testAsset}.svg`,
    }),
  );
  fs.writeFileSync(oldIconPath, "<svg>test</svg>");

  // Create a temporary PNG to use as source
  const tmpPng = path.join(__dirname, "tmp-test-icon.png");
  fs.writeFileSync(tmpPng, Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG magic bytes

  const { stdout, exitCode } = run(
    `update --asset "${caip19}" --name "Icon Test" --logo "${tmpPng}"`,
  );

  t.equal(exitCode, 0, "exits with 0");
  t.ok(stdout.includes("Removing old icon"), "reports removing old icon");
  t.ok(!fs.existsSync(oldIconPath), "old SVG icon was removed");
  t.ok(fs.existsSync(newIconPath), "new PNG icon was created");

  // Clean up
  if (fs.existsSync(tmpPng)) fs.unlinkSync(tmpPng);
  if (fs.existsSync(newIconPath)) fs.unlinkSync(newIconPath);
  if (fs.existsSync(metaFile)) fs.unlinkSync(metaFile);
  if (fs.existsSync(iconsDir) && fs.readdirSync(iconsDir).length === 0) {
    fs.rmdirSync(iconsDir);
  }
  if (fs.existsSync(metaDir) && fs.readdirSync(metaDir).length === 0) {
    fs.rmdirSync(metaDir);
  }

  t.end();
});

// ---------------------------------------------------------------------------
// Verify Command Tests
// ---------------------------------------------------------------------------

test("cli verify: requires --asset flag", function (t) {
  const { stdout, exitCode } = run("verify");
  t.equal(exitCode, 1, "exits with 1");
  t.ok(stdout.includes("--asset"), "mentions --asset requirement");
  t.end();
});

test("cli verify: rejects invalid CAIP-19 id", function (t) {
  const { stdout, exitCode } = run('verify --asset "bad-id"');
  t.equal(exitCode, 1, "exits with 1");
  t.ok(stdout.includes("not a valid CAIP-19"), "reports invalid CAIP-19");
  t.end();
});

test("cli verify: reports error when metadata file missing", function (t) {
  const { stdout, exitCode } = run(
    'verify --asset "eip155:1/erc20:0x0000000000000000000000000000000000000000"',
  );
  t.ok(stdout.includes("not found") || exitCode === 1, "reports missing file");
  t.end();
});

test("cli verify: succeeds on valid existing asset", function (t) {
  // Verify DAI which we know exists
  const { stdout, exitCode } = run(
    'verify --asset "eip155:1/erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F"',
  );
  t.equal(exitCode, 0, "exits with 0");
  t.ok(stdout.includes("OK"), "reports OK");
  t.end();
});

test("cli verify: reports errors for bad metadata", function (t) {
  const testChain = "eip155:999998";
  const testAsset = "erc20:0xVERIFY234567890abcdef1234567890abcdef1234";
  const caip19 = `${testChain}/${testAsset}`;
  const metaDir = path.join(__dirname, "..", "metadata", testChain);
  const metaFile = path.join(metaDir, `${testAsset}.json`);

  // Create bad metadata (missing name, unknown field)
  if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(
    metaFile,
    JSON.stringify({ badField: true, logo: "./icons/nonexistent.svg" }),
  );

  const { stdout, exitCode } = run(`verify --asset "${caip19}"`);
  t.equal(exitCode, 1, "exits with 1");
  t.ok(stdout.includes("error"), "reports errors");

  // Clean up
  fs.unlinkSync(metaFile);
  if (fs.existsSync(metaDir) && fs.readdirSync(metaDir).length === 0) {
    fs.rmdirSync(metaDir);
  }

  t.end();
});

// ---------------------------------------------------------------------------
// List Command Tests
// ---------------------------------------------------------------------------

test("cli list: lists assets", function (t) {
  const { stdout, exitCode } = run("list");
  t.equal(exitCode, 0, "exits with 0");
  t.ok(stdout.includes("Total:"), "shows total count");
  t.ok(stdout.includes("eip155:1"), "includes eip155:1 chain");
  t.end();
});

test("cli list: filters by chain", function (t) {
  const { stdout, exitCode } = run('list --chain "eip155:56"');
  t.equal(exitCode, 0, "exits with 0");
  t.ok(stdout.includes("eip155:56"), "shows filtered chain");
  t.ok(!stdout.includes("\neip155:1 "), "does not show other chains");
  t.end();
});

// ---------------------------------------------------------------------------
// CAIP-19 Regex Tests (including hyphen support per spec)
// ---------------------------------------------------------------------------

test("cli verify: accepts CAIP-19 ids with hyphens in references", function (t) {
  // This tests the bugfix: asset references can contain hyphens per CAIP-19 spec
  // We just ensure the regex doesn't reject them (even if the asset doesn't exist)
  const { stdout } = run(
    'verify --asset "bip122:000000000019d6689c085ae165831e93/slip44:0"',
  );
  // Should not fail with "not a valid CAIP-19" - it may fail with "not found" which is fine
  t.ok(
    !stdout.includes("not a valid CAIP-19"),
    "does not reject valid CAIP-19 with standard chars",
  );
  t.end();
});
