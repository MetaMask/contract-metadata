const test = require("tape");
const contractMap = require("../buildindex.js");
const permittedFields = require("../permitted-fields.json");

const util = require("ethereumjs-util");
const fs = require("fs");
const path = require("path");

test("the object is parsable", function (t) {
  t.equal(typeof contractMap, "object", "is an object");
  t.end();
});

test("the eip155 accounts are valid checksum addresses", function (t) {
  Object.keys(contractMap).forEach((caip19AssetId) => {
    const idParts = caip19AssetId.split("/");
    // ignore non-evm networks for validation for now
    if (idParts[0].indexOf("eip155" === -1)) return;
    const address = idParts[1].split(":")[1];
    t.ok(
      util.isValidChecksumAddress(address),
      `Address should be valid checksum address: ${address}`,
    );
  });

  t.end();
});

test("logos should correspond to an included web image file", function (t) {
  Object.keys(contractMap).forEach((caip19AssetId) => {
    const contract = contractMap[caip19AssetId];
    if (!contract.logo) return;
    const fileName = contract.logo;
    t.ok(fs.existsSync(contract.logo), `file exists: "${fileName}"`);
  });

  t.end();
});

test("logos path names should be an svg or a png", function (t) {
  Object.keys(contractMap).forEach((caip19AssetId) => {
    const contract = contractMap[caip19AssetId];
    if (!contract.logo) return;
    const fileName = contract.logo;
    t.ok(
      fileName.includes(".svg") || fileName.includes(".png"),
      `filename is an svg or a png: "${fileName}"`,
    );
  });

  t.end();
});

test("logos icon should not be empty", function (t) {
  Object.keys(contractMap).forEach((caip19AssetId) => {
    const contract = contractMap[caip19AssetId];
    const logo = contract.logo;
    t.notEqual(logo.length, 0);
  });
  t.end();
});

test("logos path names should not contain space", function (t) {
  Object.keys(contractMap).forEach((caip19AssetId) => {
    const contract = contractMap[caip19AssetId];
    if (!contract.logo) return;
    const fileName = contract.logo;
    t.notOk(
      fileName.includes(" "),
      `filename does not include space: "${fileName}"`,
    );
  });

  t.end();
});

test("symbols should be eleven or less characters", function (t) {
  Object.keys(contractMap).forEach((caip19AssetId) => {
    const contract = contractMap[caip19AssetId];
    const symbol = contract.symbol;
    if (symbol) {
      t.notOk(
        symbol.length > 11,
        `symbol with more than 11 characters: "${symbol}"`,
      );
    }
  });
  t.end();
});

test("only permitted fields should be used", function (t) {
  Object.keys(contractMap).forEach((caip19AssetId) => {
    const contract = contractMap[caip19AssetId];

    const fields = Object.keys(contract);
    fields.forEach((field) => {
      t.ok(
        permittedFields.includes(field),
        `${field} must be part of permitted fields.`,
      );
    });
  });

  t.end();
});
