const test = require('tape')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawnSync } = require('child_process')

const cli = require('../cli-update-asset')

function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath)
  } catch (err) {
    // ignore
  }
}

test('setAsset removes old icon when extension changes', function (t) {
  const caip = 'eip155:999999/erc20:0x000000000000000000000000000000000000dEaD'
  const paths = cli.getAssetPaths(caip)

  // Ensure a clean slate
  safeUnlink(paths.metadataFile)
  for (const ext of ['.svg', '.png', '.jpg', '.jpeg']) {
    safeUnlink(`${paths.iconFileBase}${ext}`)
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-metadata-cli-'))
  const pngPath = path.join(tmpDir, 'logo.png')
  const svgPath = path.join(tmpDir, 'logo.svg')

  fs.writeFileSync(pngPath, 'not-a-real-png')
  fs.writeFileSync(svgPath, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>')

  cli
    .setAsset(caip, {
      caip,
      name: 'Test Token',
      symbol: 'TEST',
      decimals: '18',
      image: pngPath,
    })
    .then(() => {
      t.ok(fs.existsSync(`${paths.iconFileBase}.png`), 'png icon created')
      return cli.setAsset(caip, { caip, image: svgPath })
    })
    .then(() => {
      t.ok(fs.existsSync(`${paths.iconFileBase}.svg`), 'svg icon created')
      t.notOk(fs.existsSync(`${paths.iconFileBase}.png`), 'old png icon removed')

      const metadata = JSON.parse(fs.readFileSync(paths.metadataFile, 'utf8'))
      t.ok(metadata.logo.endsWith('.svg'), 'metadata.logo updated to svg')

      t.end()
    })
    .catch((err) => {
      t.fail(err)
      t.end()
    })
    .finally(() => {
      safeUnlink(pngPath)
      safeUnlink(svgPath)
      try {
        fs.rmdirSync(tmpDir)
      } catch (err) {
        // ignore
      }

      safeUnlink(paths.metadataFile)
      for (const ext of ['.svg', '.png', '.jpg', '.jpeg']) {
        safeUnlink(`${paths.iconFileBase}${ext}`)
      }
    })
})

test('verify does not crash when metadata.logo is missing', function (t) {
  const caip = 'eip155:999999/erc20:0x000000000000000000000000000000000000bEEF'
  const paths = cli.getAssetPaths(caip)

  fs.mkdirSync(paths.metadataDir, { recursive: true })
  fs.mkdirSync(paths.iconDir, { recursive: true })

  // Write invalid metadata (missing logo)
  fs.writeFileSync(
    paths.metadataFile,
    JSON.stringify({ name: 'Bad Token', symbol: 'BAD', decimals: 18 }, null, 2) + '\n',
  )

  // Ensure an icon exists so the old crash path is exercised
  fs.writeFileSync(`${paths.iconFileBase}.png`, 'not-a-real-png')

  t.ok(fs.existsSync(paths.metadataFile), 'metadata file exists before verify')

  const result = spawnSync(
    process.execPath,
    ['cli-update-asset.js', 'verify', '--caip', caip],
    {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
    },
  )

  const combined = `${result.stdout || ''}\n${result.stderr || ''}`

  t.equal(result.status, 1, 'verify exits non-zero when issues exist')
  t.ok(
    combined.includes('Metadata validation') || combined.includes('Issues found') || combined.includes('Metadata file error'),
    'verify reports validation or file issues',
  )
  t.notOk(
    combined.includes('The "path" argument must be of type string'),
    'verify does not throw path.basename TypeError',
  )

  // Cleanup
  safeUnlink(paths.metadataFile)
  for (const ext of ['.svg', '.png', '.jpg', '.jpeg']) {
    safeUnlink(`${paths.iconFileBase}${ext}`)
  }

  t.end()
})
