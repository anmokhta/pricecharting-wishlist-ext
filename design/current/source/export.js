// Renders the store-art artboards in canvas/ (copied from the Design canvas)
// to PNGs in ../store-listing/, at their exact store sizes.
// Run from the repo root:  node design/current/source/export.js
//
// Each .dc.html artboard is plain HTML plus two template holes ({{blue}},
// {{green}}) and uploaded-image urls (/_blob/<id>). This swaps in the
// default colors and the matching local files from crops/, then screenshots
// the artboard in headless Chromium (Playwright, already a dev dependency).
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const HERE = __dirname;
const CANVAS = path.join(HERE, 'canvas');
const OUT = path.join(HERE, '..', 'store-listing');

// Canvas upload id -> local file. Update when an image is re-uploaded.
const BLOBS = {
  '52dd5bc4e0e4524552c3eb91e88ef473': 'crops/icon.svg',
  '23d2fe14c4cd255f6eaaa0cfd95bfa80': 'crops/promo-list.jpg',
  '97e84b7fd65373e00b0cae348c36439e': 'crops/promo-grid.jpg',
  'd1930340b41b465e9664c80a2f2c77b2': 'crops/shot-grid.jpg',
  'ba12ac44e81262a9a78982bd49131f60': 'crops/shot-totals.jpg',
  '36f32a4e3c333c23d60bb17ad24a7e05': 'crops/shot-select-tall.jpg',
  '24e4cd4b7bc8fa6b62be502980aa7119': 'crops/shot-exclude-tall.jpg',
  '2d42bc144e3f2aa59cf0ee40895ea433': 'crops/shot-search.jpg',
};

// Artboard file -> output name.
const NAMES = {
  'Main.dc.html': 'promo-tile-1400x560.png',
  'Shot1-Grid.dc.html': 'screenshot-1-grid.png',
  'Shot2-Whole-wishlist.dc.html': 'screenshot-2-whole-wishlist.png',
  'Shot3-Select-Exclude.dc.html': 'screenshot-3-select-exclude.png',
  'Shot4-Search.dc.html': 'screenshot-4-search.png',
};

function toHtml(file) {
  const src = fs.readFileSync(path.join(CANVAS, file), 'utf8');
  const body = src.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1];
  const helmet = (body.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ''])[1];
  let markup = body.replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  const props = JSON.parse(src.match(/data-props='([^']*)'/)[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
  for (const [key, def] of Object.entries(props)) {
    if (def && def.default !== undefined) markup = markup.split(`{{${key}}}`).join(def.default);
  }
  const missing = [];
  markup = markup.replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => {
    if (!BLOBS[id]) { missing.push(id); return m; }
    return BLOBS[id];
  });
  if (missing.length) throw new Error(`${file}: no local file for upload id(s) ${missing.join(', ')}; add them to BLOBS.`);
  if (/\{\{/.test(markup)) throw new Error(`${file}: unfilled template hole left in markup.`);
  return `<!doctype html><html><head><meta charset="utf-8">${helmet}</head><body style="margin:0">${markup}</body></html>`;
}

(async () => {
  const canvas = JSON.parse(fs.readFileSync(path.join(CANVAS, 'canvas.json'), 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const file of canvas.order) {
      const { w, h } = canvas.boards[file];
      const name = NAMES[file] || file.replace('.dc.html', '.png');
      const tmp = path.join(HERE, `.export-${file}.html`);
      fs.writeFileSync(tmp, toHtml(file));
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      await page.goto('file://' + tmp, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const font = await page.evaluate(() => document.fonts.check("800 50px 'Plus Jakarta Sans'"));
      await page.screenshot({ path: path.join(OUT, name), clip: { x: 0, y: 0, width: w, height: h } });
      await page.close();
      fs.unlinkSync(tmp);
      console.log(`${name}  ${w}x${h}${font ? '' : '  (WARNING: web font not loaded, used fallback)'}`);
    }
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
