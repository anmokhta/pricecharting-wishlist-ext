# Releasing a new version

Developer notes for shipping an update. User-facing documentation is in the [README](../README.md).

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push and pull request. It first checks that [CHANGELOG.md](../CHANGELOG.md) has notes for the version in `extension/manifest.json`, then runs the tests. On a push to `main`, once both pass, it:

1. Reads `version` from `extension/manifest.json`.
2. Zips the contents of `extension/` into `pricecharting-wishlist-v<version>.zip`.
3. Publishes it to the GitHub Release tagged `v<version>`, creating the release if it's new or replacing the zip if it already exists. The release description is that version's CHANGELOG section.

**Every release needs release notes.** To ship a new version:

1. Bump `version` in `extension/manifest.json`.
2. Add a section at the top of `CHANGELOG.md`:

   ```markdown
   ## 1.4.7 — 2026-11-20

   ### New
   - Short description of a new feature, written for people using the extension.

   ### Changed
   - Something that works differently now.

   ### Fixed
   - A bug that's fixed.
   ```

   Use only the headings that apply; at least one with a bullet is required. Run `node scripts/release-notes.js` to check it.
3. Add the developer-side entry (code and tests) to ROADMAP.md → Completed.
4. Push to `main` and wait for CI to publish the GitHub Release.
5. Submit it to the Chrome Web Store with the manual workflow (below).

Without the CHANGELOG section, CI fails and nothing is published. Pushes without a version bump refresh the current release's zip and notes. If the tests fail, nothing is published. The workflow can also be run manually from the Actions tab. Zips are never committed to the repo.

## Submitting to the Chrome Web Store

[`.github/workflows/store.yml`](../.github/workflows/store.yml) ("Submit to Chrome Web Store") sends a version to the store. **It only runs when you start it**; pushes never trigger it.

**To run it:** GitHub → **Actions** → **Submit to Chrome Web Store** → **Run workflow** (branch `main`), or:

```bash
gh workflow run store.yml
```

Untick **submit** (or add `-f submit=false`) to upload a draft without sending it for review, which is a safe way to test the credentials.

What it does:

1. Reads the version from `extension/manifest.json` on `main`.
2. Downloads `pricecharting-wishlist-v<version>.zip` from the GitHub Release `v<version>`. That's the exact zip CI built after the tests passed. If the release doesn't exist yet, it stops and tells you to push and wait for CI.
3. Checks the zip's manifest has the same version.
4. Runs [`scripts/chrome-store.js`](../scripts/chrome-store.js), which uses Chrome Web Store API v2 to:
   - check the item's status, and stop if another version is still pending review;
   - upload the zip and wait for it to finish processing;
   - submit it for review (unless **submit** is unticked).
5. Writes the result to the run's summary page.

### One-time setup

These steps use your Google account and create a key, so do them yourself. Your Google account needs 2-step verification.

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project (or pick one) and enable the **Chrome Web Store API**.
2. Under **IAM & Admin → Service accounts**, create a service account. It needs no roles. Open it → **Keys** → **Add key → Create new key → JSON**, and download the file.
3. In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) → **Account**, add the service account's email. Only one service account is allowed per publisher.
4. Copy your publisher ID from **Publisher → Settings** in the dashboard.
5. Save both as repository secrets, then delete the downloaded key:

   ```bash
   gh secret set CWS_SERVICE_ACCOUNT_KEY < path/to/key.json
   ```

   ```bash
   gh secret set CWS_PUBLISHER_ID
   ```

The item ID (`opfopmnimlhgjgnoegkghpdpdgabjhcf`) is public and set in the workflow. If the key is ever exposed, delete it in the Cloud console and create a new one.

### Pitfalls

- **One review at a time.** If a version is still pending review, the workflow stops before uploading. Wait, or cancel that submission in the dashboard.
- **Every update is reviewed again.** Submitting doesn't publish immediately.
- **The version must go up.** The store rejects a zip whose version isn't higher than the last one uploaded, so bump the version and add release notes first.
- **Listing details stay manual.** The API only sends the package. The store name and short description come from `manifest.json`; the long description, screenshots and privacy answers are edited in the dashboard.
- **Visibility changes.** If you change the item's visibility in the dashboard, publish once from the dashboard before the API can publish again.
