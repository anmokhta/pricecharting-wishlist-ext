# Roadmap

## Planned

### 1. One-click "Move to collection" in list view

Today the Move button only appears in grid view (`td.pcw-move` is hidden in list view by `content.css`), and it takes two clicks (arm, then confirm).

- [ ] Show a compact Move control in list view rows (fits the table's column layout without breaking the site's header alignment).
- [ ] Decide on the confirmation model for list view: true single click, or keep the arm/confirm guard (possibly as a setting).
- [ ] Optional: per-card condition picker instead of always using `prefs.DefaultCondition`.
- [ ] Verify the move end-to-end against the real API (has only been tested with stubbed `fetch`): add lands in the Collection tab, wishlist row removed, failure path leaves the card in place.

### 2. Publish on the Chrome Web Store

- [ ] Register a Chrome Web Store developer account (one-time $5 fee).
- [ ] Update the privacy policy: it currently says only the grid/list setting is stored. It must also cover pick lists in `localStorage` and the add-to-collection / remove-from-wishlist requests made on user action. Host it at a public URL (this repo is private, so it can't live here unless the repo is made public or the policy is hosted elsewhere, e.g. GitHub Pages from a public repo or a gist).
- [ ] Refresh the store description to mention search, Select/Exclude lists with CSV export, and Move to collection. Keep the manifest `description` ≤ 132 chars (currently 127).
- [ ] Recapture screenshots (existing ones predate pick lists, search and move).
- [ ] Single-purpose and permissions justification for review (no permissions declared; content script on `pricecharting.com/wishlist*` only).
- [ ] Upload the zip from the latest GitHub Release and submit for review.
- [ ] After approval: add the store link to the README install section.

## Backlog

- **Safari / iOS port.** No code changes are expected (plain MV3 content script, standard DOM APIs), but it needs:
  - Full Xcode from the App Store (Command Line Tools alone don't include `safari-web-extension-packager`).
  - `xcrun safari-web-extension-packager --copy-resources --app-name "Wishlist Grid View" --bundle-identifier <reverse.dns.id> extension/` to generate the wrapper app.
  - A decision on whether to commit the generated Xcode project (e.g. under `safari/`) or regenerate it in CI.
  - Testing in macOS Safari (Settings → Developer → Add Temporary Extension), then the iOS Simulator. Check CSV download on iOS and `localStorage` persistence.
  - A paid Apple Developer membership to run it on a real iPhone or publish it.
