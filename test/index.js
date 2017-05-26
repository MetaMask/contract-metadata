const test = require('tape')
const iconMap = require('../')

const util = require('ethereumjs-util')
const fs = require('fs')
const path = require('path')

test('the object is parsable', function (t) {
  t.equal(typeof iconMap, 'object', 'is an object')
  t.end()
})

test('the accounts are valid checksum addresses', function (t) {
  Object.keys(iconMap).forEach(address => {
    t.ok(util.isValidChecksumAddress(address), `Address should be valid: ${address}`)
  })

  t.end()
})

test('value should correspond to a web image file', function (t) {
  Object.keys(iconMap).forEach(address => {
    const fileName = iconMap[address]
    t.ok(fs.existsSync(path.join(__dirname, '..', 'images', fileName)), `file exists: ${fileName}`)
  })

  t.end()
})

