"use strict";
const fs = require("fs");
const path = require("path");

const SOURCE_JSON = "contract-map.json";
const TEST_JSON = "test.json";
const GENERATED_DIR = "generated";
const GENERATED_IMAGES = "images.js";

const main = async () => {
  const testJson = {};
  const generatedDir = path.resolve(__dirname, `../${GENERATED_DIR}`);
  const testJsonFilePath = path.join(generatedDir, TEST_JSON);
  const imageMapFilePath = path.join(generatedDir, GENERATED_IMAGES);
  // Create generated folder
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir);
  }
  const cmData = await fs.readFileSync(
    path.resolve(__dirname, `../${SOURCE_JSON}`)
  );
  const cmJson = JSON.parse(cmData);
  await fs.writeFileSync(imageMapFilePath, "");
  // Split out lines to make more readability
  await fs.appendFileSync(
    imageMapFilePath,
    `// Generated file - Do not edit - run "yarn generate" to regenerate file`
  );
  await fs.appendFileSync(imageMapFilePath, `\n\nmodule.exports = {`);
  for (const address in cmJson) {
    const token = cmJson[address];
    testJson[token.logo] = true;
    await fs.appendFileSync(
      imageMapFilePath,
      `\n  "${token.logo}": require("../images/${token.logo}"),`
    );
  }
  await fs.appendFileSync(imageMapFilePath, "\n};\n");
  await fs.writeFileSync(
    testJsonFilePath,
    `${JSON.stringify(testJson, null, 2)}\n`
  );
  console.log(
    `🔎 Detected ${Object.keys(cmJson).length} count in ${SOURCE_JSON}`
  );
  console.log(
    `🔎 Wrote ${
      Object.keys(testJson).length
    } count to ${testJsonFilePath} & ${imageMapFilePath}`
  );
  console.log(
    `🤔 Are the counts above different? This may be a result of duplicate images in ${SOURCE_JSON}`
  );
  console.log(`✅ Finished generating assets! 🎉🎉`);
};

main();
