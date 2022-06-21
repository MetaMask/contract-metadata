const test = require('tape')
const contractMap = require('../')
const permittedFields = require('../permitted-fields.json')

const util = require('ethereumjs-util')
const fs = require('fs')
const path = require('path')

test('the object is parsable', function (t) {
  t.equal(typeof contractMap, 'object', 'is an object')
  t.end()
})

test('the accounts are valid checksum addresses', function (t) {
  Object.keys(contractMap).forEach(address => {
    t.ok(util.isValidChecksumAddress(address), `Address should be valid checksum address: ${address}`)
  })

  t.end()
})

test('logos should correspond to an included web image file', function (t) {
  Object.keys(contractMap).forEach(address => {
    const contract = contractMap[address]
    if (!contract.logo) return
    const fileName = contract.logo
    const filePath = path.join(__dirname, '..', 'images', fileName)
    t.ok(fs.existsSync(filePath), `file exists: "${fileName}"`)
  })

  t.end()
})

test('logos path names should match exactly', function (t) {
  const dirContent = fs.readdirSync(path.join(__dirname, '..', 'images'))
  Object.keys(contractMap).forEach(address => {
    const contract = contractMap[address]
    if (!contract.logo) return
    const fileName = contract.logo
    t.ok(dirContent.includes(fileName), `filename matches exactly: "${fileName}"`)
  })

  t.end()
})

test('logos icon should not be empty', function (t) {
  Object.keys(contractMap).forEach(address => {
    const contract = contractMap[address]
    const logo = contract.logo
    t.notEqual(logo.length, 0)

  })
  t.end()
})

test('logos path names should not contain space', function (t) {
  const dirContent = fs.readdirSync(path.join(__dirname, '..', 'images'))
  Object.keys(contractMap).forEach(address => {
    const contract = contractMap[address]
    if (!contract.logo) return
    const fileName = contract.logo
    t.notOk(fileName.includes(' '), `filename does not include space: "${fileName}"`)
  })

  t.end()
})

test('symbols should be six or less characters', function (t) {
  Object.keys(contractMap).forEach(address => {
    const contract = contractMap[address]
    const symbol = contract.symbol
    if (symbol) {
      t.notOk(symbol.length > 11, `symbol with more than 11 characters: "${symbol}"`)
    }
  })
  t.end()
})

test('only permitted fields should be used', function (t) {
  Object.keys(contractMap).forEach(address => {
    const contract = contractMap[address]

    const fields = Object.keys(contract)
    fields.forEach(field => {
      t.ok(permittedFields.includes(field), `${field} must be part of permitted fields.`)
    })
  })

  t.end()
})

test('symbols should not overlap', function (t) {
  const symbols = Object.values(contractMap).map(contract => contract.symbol)
  const symbolsCheck = new Map()
  let duplicateSymbol

  symbols.forEach(symbol => {
    if (symbolsCheck.has(symbol) && symbol !== undefined) {
      duplicateSymbol = symbol
      return
    }
    symbolsCheck.set(symbol, true)
  })
  
  const msg = duplicateSymbol ? `found overlapping symbol ${duplicateSymbol}` : 'symbols should not overlap'
  t.notOk(duplicateSymbol, msg)
  t.end()
})
