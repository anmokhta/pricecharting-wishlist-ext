#!/usr/bin/env node
// Prints the CHANGELOG.md notes for one version (default: the version in
// extension/manifest.json) and exits non-zero if they're missing or empty.
// CI runs this to block releases without notes and to fill the GitHub Release.
//   node scripts/release-notes.js            # manifest version
//   node scripts/release-notes.js 1.4.5      # a specific version
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const version = process.argv[2] ||
  JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json'), 'utf8')).version;
const lines = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').split(/\r?\n/);

const esc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const start = lines.findIndex((l) => new RegExp(`^## ${esc}(\\s|$)`).test(l));
if (start === -1) {
  console.error(`CHANGELOG.md has no "## ${version} — YYYY-MM-DD" section. Add one with New / Changed / Fixed bullets before releasing.`);
  process.exit(1);
}
let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
if (end === -1) end = lines.length;
const body = lines.slice(start + 1, end).join('\n').trim();

const hasSection = /^### (New|Changed|Fixed)\s*$/m.test(body);
const hasBullet = /^\s*[-*] \S/m.test(body);
if (!hasSection || !hasBullet) {
  console.error(`CHANGELOG.md section for ${version} needs at least one "### New", "### Changed" or "### Fixed" heading with a bullet under it.`);
  process.exit(1);
}
process.stdout.write(body + '\n');
