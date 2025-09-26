#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'src', 'lib', 'opencc');
const outputFile = path.join(outputDir, 'raw-data.ts');

const presetUrl = new URL('../node_modules/opencc-js/dist/esm-lib/preset/full.js', import.meta.url);
const presetModule = await import(presetUrl);
const { from: fromPresets, to: toPresets } = presetModule;

const parseDictString = (dictString) => {
  if (!dictString) return [];
  return dictString.split('|').flatMap((line) => {
    if (!line) return [];
    const sanitized = line.replace(/\r/g, '');
    const [left, ...rest] = sanitized.split(' ');
    if (!left) return [];
    const right = rest.join(' ');
    if (rest.length === 0) {
      // No explicit mapping target provided -> map to empty string (character deletion)
      return [[left, '']];
    }
    return [[left, right]];
  });
};

const normalizeGroup = (group) => {
  /** @type {[string, string][]} */
  const entries = [];
  for (const dict of group) {
    if (typeof dict === 'string') {
      entries.push(...parseDictString(dict));
    } else if (Array.isArray(dict)) {
      for (const pair of dict) {
        if (!Array.isArray(pair) || pair.length !== 2) {
          throw new Error('Unexpected dictionary pair structure');
        }
        const [left, right] = pair;
        entries.push([left, right]);
      }
    } else {
      throw new Error('Unsupported dictionary entry type');
    }
  }
  return entries;
};

const normalizePreset = (presetRecord) => {
  const normalized = {};
  for (const [locale, group] of Object.entries(presetRecord)) {
    normalized[locale] = [normalizeGroup(group)];
  }
  return normalized;
};

const normalized = {
  from: normalizePreset(fromPresets),
  to: normalizePreset(toPresets),
};

await mkdir(outputDir, { recursive: true });
const banner = `/**\n * AUTO-GENERATED FILE - DO NOT EDIT.\n * Generated via scripts/generate-opencc-data.mjs\n */`;
const content = `${banner}\n\nexport const rawOpenCCData = ${JSON.stringify(normalized)} as const;\n\nexport type RawOpenCCData = typeof rawOpenCCData;\n`;

await writeFile(outputFile, content, 'utf8');
