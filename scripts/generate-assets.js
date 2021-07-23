'use strict';
const fs = require('fs');
const path = require('path');

const main = async() => {
    const testJson = {};
    const generatedDir = path.resolve(__dirname, '../generated');
    const testJsonFilePath = path.resolve(__dirname, '../generated/test.json');
    const imageMapFilePath = path.join(generatedDir, 'index.js');
    // Create generated folder
    if (!fs.existsSync(generatedDir)) {
        fs.mkdirSync(generatedDir);
    }
    const cmData = await fs.readFileSync(path.resolve(__dirname, '../contract-map.json'));
    const cmJson = JSON.parse(cmData);
    await fs.writeFileSync(imageMapFilePath, '');
    // Split out lines to make more readability
    await fs.appendFileSync(imageMapFilePath, `// Generated file - Do not edit - run "yarn generate" to regenerate file`)
    await fs.appendFileSync(imageMapFilePath, `\n\nmodule.exports = {`)
    for (const address in cmJson) {
        const token = cmJson[address];
        testJson[token.logo] = true;
        await fs.appendFileSync(imageMapFilePath, `\n  "${token.logo}": require("../images/${token.logo}"),`)
    }
    await fs.appendFileSync(imageMapFilePath, '\n};')
    await fs.writeFileSync(testJsonFilePath, JSON.stringify(testJson, null, 2));
    console.log(`🔎 Detected ${Object.keys(cmJson).length} count in contract-map.json`);
    console.log(`🔎 Wrote ${Object.keys(testJson).length} count to ../generated/index.js & test.json`);
    console.log(`🤔 Are the counts above different? This may be a result of duplicate images in contract-map.json`);
    console.log(`✅ Finished generating assets! 🎉🎉`);
}

main();