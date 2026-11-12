// The token icon API serves each icon as a PNG at its declared size, so an
// icon over MAX_DIMENSION fails here. `yarn icons:resize` shrinks it to fit.

const fs = require('fs')
const path = require('path')

const MAX_DIMENSION = 256
const ROOT = path.join(__dirname, '..')
const ICON_DIRECTORIES = ['icons', 'images']

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath]
  })
}

function readSvgRootTag(contents) {
  return (contents.match(/<svg\b[^>]*>/i) || [''])[0]
}

function readSvgLength(rootTag, attribute) {
  const match = rootTag.match(
    new RegExp(`\\s${attribute}\\s*=\\s*["']\\s*([\\d.]+)\\s*(px)?\\s*["']`, 'i'),
  )
  return match ? parseFloat(match[1]) : undefined
}

function readSvgViewBox(rootTag) {
  const match = rootTag.match(
    /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i,
  )
  return match ? { width: parseFloat(match[1]), height: parseFloat(match[2]) } : undefined
}

function readSvgDimensions(contents) {
  const rootTag = readSvgRootTag(contents)
  const viewBox = readSvgViewBox(rootTag)
  const width = readSvgLength(rootTag, 'width') ?? viewBox?.width
  const height = readSvgLength(rootTag, 'height') ?? viewBox?.height
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
    .map((filePath) => ({ filePath, dimensions: readDimensions(filePath) }))
    .filter(
      ({ dimensions }) =>
        dimensions && Math.max(dimensions.width, dimensions.height) > MAX_DIMENSION,
    )
}

function round(value) {
  return Math.round(value * 100) / 100
}

// Rewrites only the root tag's width and height, so the drawing is untouched.
// Without a viewBox the old size becomes one, or the content would be cropped.
function resizeSvg(filePath, { width, height }) {
  const contents = fs.readFileSync(filePath, 'utf8')
  const rootTag = readSvgRootTag(contents)
  const scale = MAX_DIMENSION / Math.max(width, height)
  let resized = rootTag.replace(/\s(width|height)\s*=\s*(["'])[^"']*\2/gi, '')
  if (!readSvgViewBox(rootTag)) {
    resized = resized.replace(/^<svg\b/i, `<svg viewBox="0 0 ${width} ${height}"`)
  }
  resized = resized.replace(
    /^<svg\b/i,
    `<svg width="${round(width * scale)}" height="${round(height * scale)}"`,
  )
  fs.writeFileSync(filePath, contents.replace(rootTag, resized))
}

async function resizePng(filePath) {
  const sharp = require('sharp')
  const image = sharp(fs.readFileSync(filePath))
  const { isPalette } = await image.metadata()
  const resized = await image
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside' })
    .png({ compressionLevel: 9, palette: isPalette })
    .toBuffer()
  fs.writeFileSync(filePath, resized)
}

async function resizeOversizedIcons() {
  const oversized = findOversizedIcons()
  for (const { filePath, dimensions } of oversized) {
    if (filePath.toLowerCase().endsWith('.svg')) {
      resizeSvg(filePath, dimensions)
    } else {
      await resizePng(filePath)
    }
  }
  console.log(`Resized ${oversized.length} icons to at most ${MAX_DIMENSION}px on each side`)
}

if (process.argv.includes('--fix')) {
  resizeOversizedIcons()
} else {
  const test = require('tape')
  test(`icons are at most ${MAX_DIMENSION}px on each side`, function (t) {
    findOversizedIcons().forEach(({ filePath, dimensions }) => {
      t.fail(
        `${path.relative(ROOT, filePath)} is ${dimensions.width}x${dimensions.height}; run \`yarn icons:resize\` to shrink it to at most ${MAX_DIMENSION}px on each side`,
      )
    })
    t.end()
  })
}
