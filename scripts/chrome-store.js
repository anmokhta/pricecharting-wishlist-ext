#!/usr/bin/env node
// Uploads a release zip to the Chrome Web Store (API v2) and, unless
// --no-submit is given, submits it for review. Run by the manual
// "Submit to Chrome Web Store" workflow (.github/workflows/store.yml).
//
//   node scripts/chrome-store.js --zip pricecharting-wishlist-v1.4.7.zip [--no-submit]
//
// Environment:
//   CWS_SERVICE_ACCOUNT_KEY  the service account's JSON key (contents, not a path)
//   CWS_PUBLISHER_ID         Developer Dashboard → Publisher → Settings
//   CWS_ITEM_ID              the extension's store item ID
//
// No dependencies: the access token comes from a JWT signed with node:crypto.
// Never prints the key or the token.
const crypto = require('crypto');
const fs = require('fs');

const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://chromewebstore.googleapis.com';

const b64url = (x) => Buffer.from(x).toString('base64url');

function makeJwt(key, now = Math.floor(Date.now() / 1000)) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = { iss: key.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(input), key.private_key).toString('base64url');
  return `${input}.${sig}`;
}

class StoreError extends Error {}

// Calls the API and returns parsed JSON, or throws with Google's error message.
async function request(fetch, what, url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) {
    const msg = body.error?.message || body.error_description || body.error || body.raw || '';
    throw new StoreError(`${what} failed (HTTP ${res.status}): ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
  return body;
}

const IN_PROGRESS = new Set(['IN_PROGRESS', 'UPLOAD_IN_PROGRESS']);

async function run({ args = process.argv.slice(2), env = process.env, fetch = globalThis.fetch,
  readFile = fs.readFileSync, appendFile = fs.appendFileSync, log = console.log,
  error = console.error, sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  pollMs = 5000, pollTries = 24 } = {}) {
  const zipIdx = args.indexOf('--zip');
  const zip = zipIdx !== -1 ? args[zipIdx + 1] : null;
  const submit = !args.includes('--no-submit');
  const summary = [];
  const note = (line) => { log(line); summary.push(line); };
  const finish = (code) => {
    if (env.GITHUB_STEP_SUMMARY && summary.length) {
      appendFile(env.GITHUB_STEP_SUMMARY, `## Chrome Web Store\n\n${summary.map((l) => `- ${l}`).join('\n')}\n`);
    }
    return code;
  };

  try {
    if (!zip) throw new StoreError('Usage: chrome-store.js --zip <file> [--no-submit]');
    const missing = ['CWS_SERVICE_ACCOUNT_KEY', 'CWS_PUBLISHER_ID', 'CWS_ITEM_ID'].filter((k) => !env[k]);
    if (missing.length) {
      throw new StoreError(`Missing ${missing.join(', ')}. See docs/internal/releasing.md → "One-time setup".`);
    }
    let key;
    try { key = JSON.parse(env.CWS_SERVICE_ACCOUNT_KEY); } catch { key = null; }
    if (!key?.client_email || !key?.private_key) {
      throw new StoreError('CWS_SERVICE_ACCOUNT_KEY is not a service-account JSON key (needs client_email and private_key).');
    }

    const tok = await request(fetch, 'Getting an access token', TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: makeJwt(key) }).toString()
    });
    const token = tok.access_token;
    if (!token) throw new StoreError('Getting an access token failed: no access_token in the response.');
    if (env.GITHUB_ACTIONS) log(`::add-mask::${token}`);
    const auth = { Authorization: `Bearer ${token}` };
    const name = `publishers/${env.CWS_PUBLISHER_ID}/items/${env.CWS_ITEM_ID}`;
    const fetchStatus = () => request(fetch, 'Checking item status', `${API}/v2/${name}:fetchStatus`, { headers: auth });

    // Only one submission can be in review at a time.
    const before = await fetchStatus();
    const pending = before.submittedItemRevisionStatus;
    if (pending?.state === 'PENDING_REVIEW') {
      const v = pending.distributionChannels?.[0]?.crxVersion || 'A previous version';
      throw new StoreError(`${v} is still in review. Wait for it to finish, or cancel that submission in the Developer Dashboard, then run this again.`);
    }
    const live = before.publishedItemRevisionStatus?.distributionChannels?.[0]?.crxVersion;
    if (live) note(`Published version before this run: ${live}`);

    const up = await request(fetch, 'Uploading the zip', `${API}/upload/v2/${name}:upload`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/zip' },
      body: readFile(zip)
    });
    let state = up.uploadState;
    for (let i = 0; IN_PROGRESS.has(state) && i < pollTries; i++) {
      await sleep(pollMs);
      state = (await fetchStatus()).lastAsyncUploadState;
    }
    if (state !== 'SUCCEEDED') {
      throw new StoreError(`Upload did not succeed (state: ${state || 'unknown'}). Check the item's Package tab in the Developer Dashboard.`);
    }
    note(`Uploaded ${zip}${up.crxVersion ? ` (version ${up.crxVersion})` : ''}`);

    if (!submit) {
      note('Not submitted for review (--no-submit). The upload is saved as a draft in the Developer Dashboard.');
      return finish(0);
    }
    const pub = await request(fetch, 'Submitting for review', `${API}/v2/${name}:publish`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: '{}'
    });
    note(`Submitted for review. Store state: ${pub.state || 'unknown'}`);
    for (const w of pub.warningInfo?.warnings || []) note(`Warning: ${w.reason}: ${w.description}`);
    return finish(0);
  } catch (e) {
    if (!(e instanceof StoreError)) throw e;
    error(env.GITHUB_ACTIONS ? `::error::${e.message}` : e.message);
    summary.push(`Failed: ${e.message}`);
    return finish(1);
  }
}

module.exports = { run, makeJwt, SCOPE, TOKEN_URL };

if (require.main === module) {
  run().then((code) => process.exit(code), (e) => { console.error(e); process.exit(1); });
}
