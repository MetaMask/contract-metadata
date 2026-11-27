// The token icon API serves a PNG icon at its own pixel size, so a PNG over
// MAX_DIMENSION fails here. SVGs are not checked: their declared size does not
// change the vector artwork.

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

function readPngDimensions(buffer) {
  if (buffer.toString('ascii', 1, 4) !== 'PNG') {
    return undefined
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

function readDimensions(filePath) {
  return path.extname(filePath).toLowerCase() === '.png'
    ? readPngDimensions(fs.readFileSync(filePath))
    : undefined
}

function findOversizedIcons() {
  return ICON_DIRECTORIES.flatMap((directory) => listFiles(path.join(ROOT, directory)))
    .map((filePath) => ({ filePath, dimensions: readDimensions(filePath) }))
    .filter(
      ({ dimensions }) =>
        dimensions && Math.max(dimensions.width, dimensions.height) > MAX_DIMENSION,
    )
}

const test = require('tape')
test(`PNG icons are at most ${MAX_DIMENSION}px on each side`, function (t) {
  findOversizedIcons().forEach(({ filePath, dimensions }) => {
    t.fail(
      `${path.relative(ROOT, filePath)} is ${dimensions.width}x${dimensions.height}; resize it to at most ${MAX_DIMENSION}px on each side`,
    )
  })
  t.end()
})
