#!/usr/bin/env node

/**
 * Validates label files:
 * 1. Every file with a "category:" label must also have a "provider:" label.
 * 2. Each asset_id (filename stem) must have at most 1 "category:" label.
 * 3. Each asset_id (filename stem) must have at most 1 "provider:" label.
 *
 * Usage:
 *   node scripts/validate-labels.mjs
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

const LABELS_DIR = new URL('../labels', import.meta.url).pathname;

async function getChainDirs() {
  const entries = await readdir(LABELS_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function validate() {
  const errors = [];
  const chainDirs = await getChainDirs();

  for (const chain of chainDirs) {
    const chainPath = join(LABELS_DIR, chain);
    const files = (await readdir(chainPath)).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const filePath = join(chainPath, file);
      const relativePath = `labels/${chain}/${file}`;

      let data;
      try {
        data = JSON.parse(await readFile(filePath, 'utf-8'));
      } catch (err) {
        errors.push(`${relativePath}: invalid JSON - ${err.message}`);
        continue;
      }

      const labels = data.labels || [];
      const categories = labels.filter((l) => l.startsWith('category:'));
      const providers = labels.filter((l) => l.startsWith('provider:'));

      // Rule 1: category requires provider
      if (categories.length > 0 && providers.length === 0) {
        errors.push(
          `${relativePath}: has category label(s) [${categories.join(', ')}] but no provider: label`,
        );
      }

      // Rule 2: at most 1 category per asset
      if (categories.length > 1) {
        errors.push(
          `${relativePath}: has ${categories.length} category labels [${categories.join(', ')}] - only 1 allowed`,
        );
      }

      // Rule 3: at most 1 provider per asset
      if (providers.length > 1) {
        errors.push(
          `${relativePath}: has ${providers.length} provider labels [${providers.join(', ')}] - only 1 allowed`,
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error(`Label validation failed with ${errors.length} error(s):\n`);
    for (const err of errors) {
      console.error(`  ✗ ${err}`);
    }
    process.exit(1);
  }

  console.log('Label validation passed.');
}

validate();
