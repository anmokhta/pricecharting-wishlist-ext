// Tests for scripts/chrome-store.js against a fake Google API. No network,
// no browser, no real credentials: the service-account key is generated here.
const crypto = require('crypto');
const { test, expect } = require('@playwright/test');
const { run, makeJwt, SCOPE, TOKEN_URL } = require('../scripts/chrome-store.js');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' }
});
const KEY = { client_email: 'ci@example.iam.gserviceaccount.com', private_key: privateKey };
const ENV = { CWS_SERVICE_ACCOUNT_KEY: JSON.stringify(KEY), CWS_PUBLISHER_ID: 'pub1', CWS_ITEM_ID: 'item1' };
const ITEM = 'https://chromewebstore.googleapis.com/v2/publishers/pub1/items/item1';
const UPLOAD = 'https://chromewebstore.googleapis.com/upload/v2/publishers/pub1/items/item1:upload';

// Fake API: `routes` maps a URL to a response body, or to a list of bodies
// served in order. A body with `status` is sent as an error.
function fakeGoogle(routes) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, init });
    let r = routes[url];
    if (Array.isArray(r)) r = r.length > 1 ? r.shift() : r[0];
    if (r === undefined) throw new Error(`unexpected request to ${url}`);
    const status = r.status || 200;
    return { ok: status < 400, status, text: async () => JSON.stringify(r.body ?? r) };
  };
  return { fetch, calls, urls: () => calls.map((c) => c.url) };
}

const okRoutes = (over = {}) => ({
  [TOKEN_URL]: { access_token: 'tok-123' },
  [`${ITEM}:fetchStatus`]: { publishedItemRevisionStatus: { state: 'PUBLISHED', distributionChannels: [{ crxVersion: '1.4.6' }] } },
  [UPLOAD]: { uploadState: 'SUCCEEDED', crxVersion: '1.4.7' },
  [`${ITEM}:publish`]: { state: 'PENDING_REVIEW' },
  ...over
});

async function go(google, args = ['--zip', 'x.zip'], env = ENV) {
  const out = [];
  const code = await run({
    args, env, fetch: google.fetch,
    readFile: () => Buffer.from('zip-bytes'),
    log: (l) => out.push(l), error: (l) => out.push(l),
    sleep: async () => {}, pollMs: 0
  });
  return { code, out: out.join('\n') };
}

test('signs a JWT for the Chrome Web Store scope that verifies with the public key', () => {
  const jwt = makeJwt(KEY, 1000);
  const [h, c, sig] = jwt.split('.');
  expect(JSON.parse(Buffer.from(h, 'base64url'))).toEqual({ alg: 'RS256', typ: 'JWT' });
  expect(JSON.parse(Buffer.from(c, 'base64url'))).toEqual({
    iss: KEY.client_email, scope: SCOPE, aud: TOKEN_URL, iat: 1000, exp: 4600
  });
  expect(crypto.verify('RSA-SHA256', Buffer.from(`${h}.${c}`), publicKey, Buffer.from(sig, 'base64url'))).toBe(true);
});

test('uploads the zip, then submits it for review', async () => {
  const g = fakeGoogle(okRoutes());
  const { code, out } = await go(g);
  expect(code).toBe(0);
  expect(g.urls()).toEqual([TOKEN_URL, `${ITEM}:fetchStatus`, UPLOAD, `${ITEM}:publish`]);
  const up = g.calls[2].init;
  expect(up.headers.Authorization).toBe('Bearer tok-123');
  expect(up.body.toString()).toBe('zip-bytes');
  expect(new URLSearchParams(g.calls[0].init.body).get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
  expect(out).toContain('Submitted for review');
  expect(out).not.toContain('tok-123');
});

test('--no-submit uploads a draft and never calls publish', async () => {
  const g = fakeGoogle(okRoutes());
  const { code, out } = await go(g, ['--zip', 'x.zip', '--no-submit']);
  expect(code).toBe(0);
  expect(g.urls()).not.toContain(`${ITEM}:publish`);
  expect(out).toContain('draft');
});

test('stops before uploading while another version is in review', async () => {
  const g = fakeGoogle(okRoutes({
    [`${ITEM}:fetchStatus`]: { submittedItemRevisionStatus: { state: 'PENDING_REVIEW', distributionChannels: [{ crxVersion: '1.4.6' }] } }
  }));
  const { code, out } = await go(g);
  expect(code).toBe(1);
  expect(out).toContain('1.4.6 is still in review');
  expect(g.urls()).not.toContain(UPLOAD);
});

test('waits for an upload that is still processing', async () => {
  const g = fakeGoogle(okRoutes({
    [UPLOAD]: { uploadState: 'IN_PROGRESS' },
    [`${ITEM}:fetchStatus`]: [{}, { lastAsyncUploadState: 'IN_PROGRESS' }, { lastAsyncUploadState: 'SUCCEEDED' }]
  }));
  const { code } = await go(g);
  expect(code).toBe(0);
  expect(g.urls().filter((u) => u.endsWith(':fetchStatus'))).toHaveLength(3);
  expect(g.urls()).toContain(`${ITEM}:publish`);
});

test('fails without publishing when the upload fails', async () => {
  const g = fakeGoogle(okRoutes({ [UPLOAD]: { uploadState: 'FAILED' } }));
  const { code, out } = await go(g);
  expect(code).toBe(1);
  expect(out).toContain('Upload did not succeed');
  expect(g.urls()).not.toContain(`${ITEM}:publish`);
});

test("reports Google's error message on an HTTP error", async () => {
  const g = fakeGoogle(okRoutes({ [UPLOAD]: { status: 400, body: { error: { message: 'Version must be higher' } } } }));
  const { code, out } = await go(g);
  expect(code).toBe(1);
  expect(out).toContain('Uploading the zip failed (HTTP 400): Version must be higher');
});

test('explains missing secrets without calling Google', async () => {
  const g = fakeGoogle({});
  const { code, out } = await go(g, ['--zip', 'x.zip'], { CWS_ITEM_ID: 'item1' });
  expect(code).toBe(1);
  expect(out).toContain('Missing CWS_SERVICE_ACCOUNT_KEY, CWS_PUBLISHER_ID');
  expect(g.calls).toHaveLength(0);
});
