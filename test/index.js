const test = require('tape')
const contractMap = require('../')

const util = require('ethereumjs-util')
const fs = require('fs')
const path = require('path')

test('the object is parsable', function (t) {
  t.equal(typeof contractMap, 'object', 'is an object')
  t.end()
})

test('the accounts are valid checksum addresses', function (t) {
  Object.keys(contractMap).forEach(address => {
    t.ok(util.isValidChecksumAddress(address), `Address should be valid: ${address}`)
  })

  t.end()
})

test('logos should correspond to an included web image file', function (t) {
  Object.keys(contractMap).forEach(address => {
    const contract = contractMap[address]
    if ('logo' in contract) {
      const fileName = contract.logo
      t.ok(fs.existsSync(path.join(__dirname, '..', 'images', fileName)), `file exists: ${fileName}`)
    }
  })

  t.end()
})

