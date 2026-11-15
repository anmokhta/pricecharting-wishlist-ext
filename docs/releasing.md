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
4. Push to `main`.

Without the CHANGELOG section, CI fails and nothing is published. Pushes without a version bump refresh the current release's zip and notes. If the tests fail, nothing is published. The workflow can also be run manually from the Actions tab. Zips are never committed to the repo.

## After the GitHub Release

The Chrome Web Store isn't updated automatically yet. Download the new zip from the repo's Releases and upload it in the [developer dashboard](https://chrome.google.com/webstore/devconsole) (item `opfopmnimlhgjgnoegkghpdpdgabjhcf`), then submit for review. Automating this is planned; see ROADMAP.md → Backlog.
