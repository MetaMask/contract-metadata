#!/usr/bin/env node
/**
 * Network icons: one SVG per network, named by its CAIP-2 chain ID.
 *
 *   network-icons/eip155:1.svg
 *   network-icons/bip122:000000000019d6689c085ae165831e93.svg
 *
 * On merge to master the icons are uploaded to the static cache bucket under
 * `api/v2/networkIcons/<namespace>/<reference>.svg`, mirroring the CAIP path
 * layout of `api/v2/tokenIcons/assets/...`.
 *
 * Usage:
 *   node scripts/network-icons.js verify
 *   node scripts/network-icons.js stage <outDir>   # writes <outDir>/<namespace>/<reference>.svg
 */
const fs = require('fs');
const path = require('path');

const NETWORK_ICONS_DIR = path.join(__dirname, '..', 'network-icons');
const S3_PREFIX = 'api/v2/networkIcons';

// https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md
const CAIP2_REGEX = /^([-a-z0-9]{3,8}):([-_a-zA-Z0-9]{1,32})$/;

const MAX_BYTES = 100 * 1024;
const ICON_SIZE = 256;

// Icons are served from a MetaMask-owned origin, so reject anything that can
// execute, pull in external content, or abuse the XML parser.
const FORBIDDEN_PATTERNS = [
  [/<script\b/i, '<script> element'],
  [/<foreignObject\b/i, '<foreignObject> element'],
  [/<iframe\b|<embed\b|<object\b/i, 'embedded document'],
  [/<!DOCTYPE\b|<!ENTITY\b/i, 'DOCTYPE/ENTITY declaration'],
  [/\son[a-z]+\s*=/i, 'inline event handler attribute'],
  [/javascript:/i, 'javascript: URL'],
  [/(?:xlink:)?href\s*=\s*["']\s*(?!#)/i, 'non-fragment href (only #fragment references are allowed)'],
  [/<image\b/i, '<image> element (embedded rasters are not allowed)'],
  [/url\(\s*["']?\s*(?!#)/i, 'external url() reference'],
  [/@import\b/i, 'CSS @import'],
];

function parseCaip2(chainId) {
  const match = CAIP2_REGEX.exec(chainId);
  if (!match) return null;
  return { namespace: match[1], reference: match[2] };
}

function listNetworkIcons() {
  return fs
    .readdirSync(NETWORK_ICONS_DIR)
    .filter((f) => !f.startsWith('.'))
    .sort();
}

/** Returns a list of problems with a file in network-icons/ (empty = valid). */
function validateNetworkIcon(fileName) {
  const errors = [];
  const ext = path.extname(fileName);
  const chainId = path.basename(fileName, ext);

  if (ext !== '.svg') {
    errors.push(`must be an .svg file (got "${ext || 'no extension'}")`);
  }
  if (!parseCaip2(chainId)) {
    errors.push(`file name "${chainId}" is not a valid CAIP-2 chain ID`);
  }
  if (errors.length) return errors;

  const filePath = path.join(NETWORK_ICONS_DIR, fileName);
  const { size } = fs.statSync(filePath);
  if (size === 0) errors.push('file is empty');
  if (size > MAX_BYTES) errors.push(`file is ${size} bytes, max is ${MAX_BYTES}`);

  const content = fs.readFileSync(filePath, 'utf8');
  if (!/<svg[\s>]/.test(content) || !/<\/svg>\s*$/.test(content)) {
    errors.push('does not look like an SVG document (missing <svg> root)');
  }
  if (!/xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/.test(content)) {
    errors.push('missing xmlns="http://www.w3.org/2000/svg" (required to render via <img>)');
  }
  errors.push(...validateDimensions(content));
  for (const [pattern, label] of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) errors.push(`contains ${label}`);
  }
  return errors;
}

/** Root <svg> must be ICON_SIZE x ICON_SIZE with a square viewBox. */
function validateDimensions(content) {
  const root = /<svg\b[^>]*>/.exec(content);
  if (!root) return [];
  const attr = (name) => {
    const m = new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`).exec(root[0]);
    return m ? m[1].trim() : null;
  };
  const errors = [];
  const width = attr('width');
  const height = attr('height');
  if (width !== String(ICON_SIZE) || height !== String(ICON_SIZE)) {
    errors.push(`root <svg> must have width="${ICON_SIZE}" height="${ICON_SIZE}" (got width=${width} height=${height})`);
  }
  const viewBox = attr('viewBox');
  const parts = viewBox ? viewBox.split(/[\s,]+/).map(Number) : [];
  if (parts.length !== 4 || !parts.every(Number.isFinite) || parts[2] <= 0 || parts[2] !== parts[3]) {
    errors.push(`root <svg> must have a square viewBox (got ${viewBox === null ? 'none' : `"${viewBox}"`})`);
  }
  return errors;
}

function s3Key(chainId) {
  const { namespace, reference } = parseCaip2(chainId);
  return `${S3_PREFIX}/${namespace}/${reference}.svg`;
}

function verify() {
  let failed = false;
  for (const fileName of listNetworkIcons()) {
    const errors = validateNetworkIcon(fileName);
    if (errors.length) {
      failed = true;
      console.error(`✗ network-icons/${fileName}\n  - ${errors.join('\n  - ')}`);
    }
  }
  return !failed;
}

/** Copies every icon to <outDir>/<namespace>/<reference>.svg, ready for `aws s3 sync`. */
function stage(outDir) {
  if (!verify()) {
    throw new Error('network icon validation failed, refusing to stage');
  }
  const files = listNetworkIcons();
  for (const fileName of files) {
    const chainId = path.basename(fileName, '.svg');
    const { namespace, reference } = parseCaip2(chainId);
    const dest = path.join(outDir, namespace, `${reference}.svg`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(NETWORK_ICONS_DIR, fileName), dest);
    console.log(`${fileName} -> ${s3Key(chainId)}`);
  }
  console.log(`Staged ${files.length} network icons in ${outDir}`);
}

module.exports = {
  NETWORK_ICONS_DIR,
  S3_PREFIX,
  parseCaip2,
  listNetworkIcons,
  validateNetworkIcon,
  s3Key,
};

if (require.main === module) {
  const [command, outDir] = process.argv.slice(2);
  if (command === 'verify') {
    if (!verify()) process.exit(1);
    console.log(`All ${listNetworkIcons().length} network icons are valid`);
  } else if (command === 'stage' && outDir) {
    stage(path.resolve(outDir));
  } else {
    console.error('Usage: network-icons.js verify | stage <outDir>');
    process.exit(1);
  }
}
