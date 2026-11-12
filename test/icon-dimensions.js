// The token icon API serves each icon as a PNG at its declared size, so an
// icon over MAX_DIMENSION fails unless icon-dimensions-baseline.json lists it.
// The baseline only shrinks; regenerate it with `--write-baseline`.

const fs = require('fs')
const path = require('path')
const test = require('tape')

const MAX_DIMENSION = 256
const ROOT = path.join(__dirname, '..')
const ICON_DIRECTORIES = ['icons', 'images']
const BASELINE_PATH = path.join(__dirname, 'icon-dimensions-baseline.json')

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath]
  })
}

function readSvgDimensions(contents) {
  const rootTag = (contents.match(/<svg\b[^>]*>/i) || [''])[0]
  const readLength = (attribute) => {
    const match = rootTag.match(
      new RegExp(`\\s${attribute}\\s*=\\s*["']\\s*([\\d.]+)\\s*(px)?\\s*["']`, 'i'),
    )
    return match ? parseFloat(match[1]) : undefined
  }
  let width = readLength('width')
  let height = readLength('height')
  if (width === undefined || height === undefined) {
    const viewBox = rootTag.match(
      /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i,
    )
    if (viewBox) {
      width = width === undefined ? parseFloat(viewBox[1]) : width
      height = height === undefined ? parseFloat(viewBox[2]) : height
    }
  }
  return width === undefined || height === undefined ? undefined : { width, height }
}

function readPngDimensions(buffer) {
  if (buffer.toString('ascii', 1, 4) !== 'PNG') {
    return undefined
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

function readDimensions(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.svg') {
    return readSvgDimensions(fs.readFileSync(filePath, 'utf8'))
  }
  if (extension === '.png') {
    return readPngDimensions(fs.readFileSync(filePath))
  }
  return undefined
}

function findOversizedIcons() {
  return ICON_DIRECTORIES.flatMap((directory) => listFiles(path.join(ROOT, directory)))
    .map((filePath) => ({
      file: path.relative(ROOT, filePath).split(path.sep).join('/'),
      dimensions: readDimensions(filePath),
    }))
    .filter(
      ({ dimensions }) =>
        dimensions && Math.max(dimensions.width, dimensions.height) > MAX_DIMENSION,
    )
}

if (process.argv.includes('--write-baseline')) {
  const files = findOversizedIcons()
    .map(({ file }) => file)
    .sort()
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(files, null, 2)}\n`)
  console.log(`Wrote ${files.length} entries to ${path.relative(ROOT, BASELINE_PATH)}`)
} else {
  const baseline = new Set(JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')))
  const oversized = findOversizedIcons()
  const oversizedFiles = new Set(oversized.map(({ file }) => file))

  test(`icons are at most ${MAX_DIMENSION}px on each side`, function (t) {
    oversized
      .filter(({ file }) => !baseline.has(file))
      .forEach(({ file, dimensions }) => {
        t.fail(
          `${file} is ${dimensions.width}x${dimensions.height}; resize it to at most ${MAX_DIMENSION}x${MAX_DIMENSION} (for an SVG, set its width and height attributes and keep its viewBox)`,
        )
      })
    t.pass(`${oversized.length} icons exceed the cap, ${baseline.size} of them allowed by the baseline`)
    t.end()
  })

  test('the oversized-icon baseline lists only icons that are still oversized', function (t) {
    ;[...baseline]
      .filter((file) => !oversizedFiles.has(file))
      .forEach((file) => {
        t.fail(`${file} now fits the cap or no longer exists; remove it from test/icon-dimensions-baseline.json`)
      })
    t.end()
  })
}
