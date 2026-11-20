#!/usr/bin/env node
/**
 * Find assets in metadata/ whose `decimals` differs from the on-chain value.
 *
 * Covers: eip155:* erc20:<address>   (eth_call decimals())
 *         solana:* token:<mint>      (getAccountInfo jsonParsed -> mint decimals)
 * Skipped: native/slip44/asset/hip3/sep41 and the zero address (no on-chain decimals() to read).
 *
 * Usage:
 *   node scripts/check-decimals.mjs [--chain eip155:1] [--rpc-file rpcs.json]
 *                                   [--concurrency 8] [--out report.json]
 *
 * RPCs: --rpc-file is a JSON map { "eip155:1": ["https://...", ...], "solana:5eyk...": [...] }.
 * Chains missing from it fall back to public RPCs from https://chainid.network/chains.json
 * (keyless https endpoints only). Public RPCs are flaky: failed lookups are reported as
 * "unreachable", never as mismatches. Re-run or supply better RPCs for those chains.
 *
 * Network safety: the only data sent to RPC endpoints is the JSON-RPC call for a contract address taken
 * from a metadata file name (validated as an EVM/Solana address). RPC URLs from --rpc-file must be https,
 * without embedded credentials, and must not point to localhost/private networks.
 *
 * Exit code 1 if any mismatch found.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const META = join(ROOT, 'metadata')

const args = process.argv.slice(2)
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d }
const onlyChain = opt('chain')
const concurrency = Number(opt('concurrency', 8))
const outFile = opt('out')
const rpcFile = opt('rpc-file')

// Only RPC endpoints and on-chain addresses ever leave this machine. Both are validated below
// before any request is built: nothing else read from disk (names, symbols, file contents) is sent.
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal)$|^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|^\[?(::1?|f[cd][0-9a-f]{2}:|fe80:)/i

function validateRpcUrl(raw) {
  let u
  try { u = new URL(raw) } catch { throw new Error(`Invalid RPC URL: ${raw}`) }
  if (u.protocol !== 'https:') throw new Error(`RPC URL must use https: ${u.origin}`)
  if (u.username || u.password) throw new Error(`RPC URL must not embed credentials: ${u.origin}`)
  if (PRIVATE_HOST.test(u.hostname)) throw new Error(`RPC URL must not point to a local/private host: ${u.hostname}`)
  return u.toString()
}

function loadUserRpcs(file) {
  if (!file) return {}
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  const out = {}
  for (const [chain, urls] of Object.entries(raw)) {
    if (!Array.isArray(urls)) throw new Error(`rpc-file: "${chain}" must be an array of URLs`)
    out[chain] = urls.map(validateRpcUrl)
  }
  return out
}

const userRpcs = loadUserRpcs(rpcFile)
const SOLANA_DEFAULT = ['https://api.mainnet-beta.solana.com']
const ZERO = '0x0000000000000000000000000000000000000000'

async function rpc(url, method, params, timeoutMs = 10000) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  if (j.error) { const e = new Error(j.error.message); e.rpcError = true; throw e }
  return j.result
}

// Try each RPC in turn (rotating start so load spreads). Returns {ok, value} or {ok:false, reason}.
async function withFailover(urls, method, params, seed) {
  let lastErr
  for (let k = 0; k < urls.length; k++) {
    const url = urls[(seed + k) % urls.length]
    try { return { ok: true, value: await rpc(url, method, params) } }
    catch (e) {
      // A contract revert is a real answer from the node, not an RPC failure.
      if (e.rpcError && /revert|execution|invalid opcode|out of gas/i.test(e.message)) return { ok: true, value: null }
      lastErr = e
    }
  }
  return { ok: false, reason: lastErr?.message ?? 'no rpc' }
}

async function loadPublicRpcs() {
  const chains = await (await fetch('https://chainid.network/chains.json', { signal: AbortSignal.timeout(30000) })).json()
  const map = {}
  for (const c of chains) {
    map[`eip155:${c.chainId}`] = (c.rpc || []).filter((u) => u.startsWith('https://') && !u.includes('${'))
  }
  return map
}

function collect() {
  const items = []
  for (const chain of readdirSync(META)) {
    if (onlyChain && chain !== onlyChain) continue
    const isEvm = chain.startsWith('eip155:')
    const isSol = chain.startsWith('solana:')
    if (!isEvm && !isSol) continue
    for (const f of readdirSync(join(META, chain))) {
      const m = f.match(/^(erc20|token):(.+)\.json$/)
      if (!m) continue
      if (isEvm && m[1] !== 'erc20') continue
      if (isSol && m[1] !== 'token') continue
      if (m[2].toLowerCase() === ZERO) continue
      const data = JSON.parse(readFileSync(join(META, chain, f), 'utf8'))
      items.push({ chain, address: m[2], file: `metadata/${chain}/${f}`, symbol: data.symbol, declared: data.decimals })
    }
  }
  return items
}

async function readOnchain(item, urls, seed) {
  const isSolana = item.chain.startsWith('solana:')
  if (!(isSolana ? SOLANA_ADDRESS : EVM_ADDRESS).test(item.address)) {
    return { ok: false, reason: 'invalid address in file name, skipped' }
  }
  if (isSolana) {
    const r = await withFailover(urls, 'getAccountInfo', [item.address, { encoding: 'jsonParsed' }], seed)
    if (!r.ok) return r
    const d = r.value?.value?.data?.parsed?.info?.decimals
    return typeof d === 'number' ? { ok: true, value: d } : { ok: true, value: null }
  }
  const r = await withFailover(urls, 'eth_call', [{ to: item.address, data: '0x313ce567' }, 'latest'], seed)
  if (!r.ok) return r
  if (!r.value || r.value === '0x' || r.value.length < 66) return { ok: true, value: null }
  return { ok: true, value: Number(BigInt(r.value.slice(0, 66))) }
}

async function main() {
  const items = collect()
  const needPublic = [...new Set(items.map((i) => i.chain))].some((c) => !userRpcs[c] && c.startsWith('eip155:'))
  const pub = needPublic ? await loadPublicRpcs().catch((e) => { console.error('chainid.network fetch failed:', e.message); return {} }) : {}
  const rpcsFor = (chain) => userRpcs[chain] || (chain.startsWith('solana:') ? SOLANA_DEFAULT : pub[chain] || [])

  console.error(`Checking ${items.length} assets across ${new Set(items.map((i) => i.chain)).size} chains...`)

  const mismatches = [], noDecimals = [], unreachable = []
  let done = 0, ok = 0, idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      const it = items[i]
      const urls = rpcsFor(it.chain)
      const r = urls.length ? await readOnchain(it, urls, i) : { ok: false, reason: 'no rpc configured' }
      if (!r.ok) unreachable.push({ ...it, reason: r.reason })
      else if (r.value === null) noDecimals.push(it)
      else if (r.value !== it.declared) mismatches.push({ ...it, onchain: r.value })
      else ok++
      if (++done % 100 === 0) console.error(`  ${done}/${items.length}`)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))

  const byFile = (a, b) => a.file.localeCompare(b.file)
  mismatches.sort(byFile); noDecimals.sort(byFile); unreachable.sort(byFile)
  const report = { summary: { checked: items.length, matching: ok, mismatched: mismatches.length, noOnchainDecimals: noDecimals.length, unreachable: unreachable.length }, mismatches, noDecimals, unreachable }

  if (outFile) writeFileSync(outFile, JSON.stringify(report, null, 2))
  console.log('\nMISMATCHES (file | symbol | declared -> on-chain)')
  for (const m of mismatches) console.log(`${m.file} | ${m.symbol} | ${m.declared} -> ${m.onchain}`)
  console.log('\n' + JSON.stringify(report.summary))
  if (unreachable.length) console.log('Unreachable per chain:', Object.entries(unreachable.reduce((a, u) => ((a[u.chain] = (a[u.chain] || 0) + 1), a), {})).map(([c, n]) => `${c}=${n}`).join(' '))
  process.exit(mismatches.length ? 1 : 0)
}

main()
