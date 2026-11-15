# Roadmap

## Planned

### 1. Verify "Move to collection" on the real site

The list-view Move button shipped in 1.4.3–1.4.5 (see Completed). What's left:

- [ ] Verify the move end-to-end against the real API (has only been tested with stubbed `fetch`): add lands in the Collection tab, wishlist row removed, failure path leaves the card in place.

### 2. Publish on the Chrome Web Store

**Status:** v1.4.6 submitted for review on 2026-11-15. Item ID `opfopmnimlhgjgnoegkghpdpdgabjhcf` (dashboard: https://chrome.google.com/webstore/devconsole).

- [x] Register a Chrome Web Store developer account; contact email set and verified.
- [x] Privacy policy rewritten (`docs/privacy-policy.md`) and published as a public gist: https://gist.github.com/anmokhta/0dbdab84b479a030717f3584833156b9. When the policy changes, edit `docs/privacy-policy.md` and update the gist with `gh gist edit 0dbdab84b479a030717f3584833156b9 docs/privacy-policy.md`.
- [x] Store description written (search, Select/Exclude lists, Move to collection, privacy note, not-affiliated line). Category: Functionality & UI.
- [x] Screenshots captured on the test account; 1280×800 versions (page only, no browser toolbar) are in `screencaps/1280x800/`.
- [x] Privacy practices: single-purpose statement, host-access justification (content script on `pricecharting.com/wishlist*` only; no permissions), no remote code, data usage = website content only, all three certifications.
- [x] Test account and test instructions (under 500 characters) entered. Keep that account's wishlist stocked and its password unchanged.
- [x] Uploaded the v1.4.6 zip from GitHub Releases and submitted for review (2026-11-15).
- [ ] Approved and published.
- [ ] After approval: add the store link to the README install section.

### 3. Saved selections

After selecting or excluding cards, give the selection a name and save it. A control at the top of the list then re-applies a saved selection in one step.

- [ ] Add a "Save selection…" action to the pick panel (name prompt), and a "Saved selections" dropdown at the top that stays visible even when nothing is picked.
- [ ] Load, rename, overwrite and delete saved selections.
- [ ] Show how much of a saved selection still applies (e.g. "4 of 5 cards still on your wishlist").

**Pitfalls to design around:**

- **What identifies a card.** Picks are stored by row id (`bid-…`), which is the *wishlist entry*, not the card. If a card is removed and added again, it gets a new id and drops out of saved selections. Storing the product id (`data-product`) as well would let a selection re-match it, but two entries for the same product (if the site allows that) would then be ambiguous.
- **Cards that leave the wishlist.** Moving to the collection or removing a card leaves stale ids behind. Decide whether to prune them automatically, keep them silently, or show them as "missing".
- **Exclude lists follow the wishlist (intended).** A saved *exclude* list means "everything except these", so new wishlist cards are automatically included and its total updates as the wishlist changes. That's the point of it. A saved *select* list stays fixed to the cards picked.
- **Overwriting current picks.** Loading a saved selection while you have unsaved picks would wipe them. Ask first, or offer to save the current picks.
- **Load timing.** A selection can only be applied once every page has loaded. If loading fails partway (the Retry state), some cards won't match yet. Apply it after the full load, or re-apply when Retry finishes.
- **Where it's stored.** `localStorage` on pricecharting.com is per browser and per device. Clearing site data wipes it, and PriceCharting's own scripts share that storage. `chrome.storage.sync` would sync across your Chrome installs, but it needs the `storage` permission, which changes the store review and privacy policy, and it has small quotas (about 8 KB per item, 100 KB total).
- **Which wishlist it belongs to.** Picks are already keyed by the `user=` URL parameter. Saved selections should be too, so viewing someone else's wishlist doesn't show (or apply) your saved lists.
- **Names.** Handle empty names, duplicate names (overwrite or reject), very long names, and a cap on how many can be saved.
- **Prices.** Totals should be recalculated from current prices when loaded, not stored, and the UI should say so.
- **Interaction with search.** A loaded selection can include cards hidden by the current search. Counts and totals already cover hidden cards; the UI should make that obvious.
- **Backup.** Consider exporting and importing saved selections (card ids and names only, no prices), since browser storage is easy to lose. Anything that exports price data is out of scope for the public build (see 1.4.6).
- **Privacy policy.** The Chrome Web Store policy (item 2) must mention saved selections.

## Backlog

- **Automated Chrome Web Store uploads from CI.** Today each new version means downloading the zip from GitHub Releases and uploading it by hand. Plan:
  - **Google side:** in a Google Cloud project, enable the Chrome Web Store API, create an OAuth client, and generate a refresh token for the publisher account.
  - **GitHub side:** store the client ID, client secret, refresh token and item ID as repository secrets (never in the repo).
  - **CI:** a `store` job in `.github/workflows/ci.yml` that runs after `release`, only on `main`, and only when the release job *created* a new version, not when it replaced a zip. The store rejects re-uploading the same version anyway. It uploads the zip, then either submits it for review automatically or leaves it as a draft for a manual click. Start with draft-only until the flow is trusted.
  - **Pitfalls:**
    - An upload fails while a previous version is still in review, so the job should report that clearly, not break the release.
    - Every submission goes through review again.
    - The API only updates the package; listing text, screenshots and privacy answers stay manual.
    - Check which version of the Chrome Web Store API is current when implementing, since Google has revised it.
    - The refresh token can expire if unused or revoked, so add a manual `workflow_dispatch` run to test it.
- **CSV export (private build only).** Possibly a separate private branch or build that restores the Export CSV button (removed in 1.4.6). It must never ship in the public Chrome Web Store build.
- **Safari / iOS port.** No code changes are expected (plain MV3 content script, standard DOM APIs), but it needs:
  - Full Xcode from the App Store (Command Line Tools alone don't include `safari-web-extension-packager`).
  - `xcrun safari-web-extension-packager --copy-resources --app-name "Wishlist Grid View" --bundle-identifier <reverse.dns.id> extension/` to generate the wrapper app.
  - A decision on whether to commit the generated Xcode project (e.g. under `safari/`) or regenerate it in CI.
  - Testing in macOS Safari (Settings → Developer → Add Temporary Extension), then the iOS Simulator. Check `localStorage` persistence.
  - A paid Apple Developer membership to run it on a real iPhone or publish it.

## Completed

Newest first. When a planned or backlog item ships, it moves here. This section is the developer view (code and tests); the short user-facing notes for each version go in [CHANGELOG.md](CHANGELOG.md), which CI requires before a release and uses as the GitHub Release description.

### 1.4.6 — CSV export removed (2026-11-15)

- **What it does:** removes the "Export CSV" button from the Select/Exclude panel. PriceCharting's terms restrict software that redistributes its price data, and exporting prices to a file is the clearest case of that. Removing it keeps the public Chrome Web Store build low-risk. A private build with CSV export may come later; the code is in git history (1.4.5 and earlier).
- **Code:** `extension/content.js`: removed `downloadText()`, `csvCell` and `exportPicks()`, and the Export button in `updatePickUI()`. `extension/content.css`: removed the Export button styles.
- **Tests:** the CSV test now checks the exclude total, and that the panel only offers Clear.

### 1.4.5 — Totals box and list-view buttons (2026-11-15)

- **What it does:**
  - The blue box above the list now permanently shows the wishlist's item count and total value, instead of a status message that disappeared after 6 seconds. It also shows loading progress, and a Retry button if a page fails.
  - In list view only, the Move button reads "Move" ("Confirm?" when armed). Remove now matches the other buttons: same size, font and rounded corners, stacked at the same width as Move. Grid view is unchanged.
- **Code:**
  - `extension/content.js`: the summary and status boxes are merged into one `.pcw-summary` box, with `.pcw-summary-text` for the totals and `.pcw-summary-note` for progress or Retry. The 6-second removal is gone. A new `setMoveLabel()` gives each Move state a long (grid) and a short (list) label.
  - `extension/content.css`: blue box styles; long/short label switching; list-view Remove styling.
- **Tests:**
  - The box stays visible after switching views and waiting past 6 seconds.
  - A search doesn't wipe the Retry button.
  - The Move tests check view-specific labels.
  - List-view Remove matches Select's style and Move's width.
  - Grid keeps the long label.

### 1.4.4 — Move under Remove in list view (2026-11-15)

- **What it does:** in list view, the Move button sits under the Remove button at the start of the row, instead of at the far end.
- **Code:** `extension/content.js`: a new `placeMoveButtons()` moves each button into the Remove cell (list) or its own cell (grid) whenever the view changes or rows are added. `extension/content.css`: list-view placement.
- **Tests:** the button is under Remove in list view and in its own cell in grid view, including after switching views. A card added after loading gets the button under Remove.

### 1.4.3 — Move to collection in list view (2026-11-15)

- **What it does:** the Move to collection button, previously grid-only, also appears in list view, with the same click-then-confirm. It always uses your PriceCharting default condition (by design).
- **Code:** `extension/content.css` only: the Move cell is no longer hidden in list view.
- **Tests:** the Move flow (confirm, success, failure) runs in both views. New tests for the 4-second auto-reset and the list-view layout.

### 1.4.2 — Backlog fixes and automated tests (2026-11-15)

- **What it does:**
  - Cards repeated across pages are skipped.
  - Cards that appear after loading get all the buttons and are sorted in.
  - A failed page shows Retry instead of silently breaking the site's own scrolling.
  - The failure path now also does the image swap and Remove relabel.
  - Every push runs automated tests, and the release zip is only published if they pass.
- **Code:**
  - `extension/content.js`: dedupe in `loadAll()`, the `pcw-debug` log, `enhanceRows()`, a `MutationObserver` for late rows, `run()` with Retry.
  - New `test/` folder: Playwright tests, shared fake pages, a manual mockup and a small server.
  - `package.json`, `playwright.config.js`.
  - `.github/workflows/ci.yml` replaces `release.yml`.
- **Tests:** the first 18 end-to-end tests: loading and sorting, duplicates, Retry, late rows, grid view, search, Select/Exclude with CSV export, and Move to collection.

### 1.4.1 and earlier (before this repo)

Cross-page price sort, grid view, totals, Remove relabel, Set filter label, Select/Exclude lists with CSV export, search, grid-view Move to collection, and the 1.4.1 fix for duplicate "bare" rows. No dates were recorded. See [docs/technical-summary.md](docs/technical-summary.md) and [docs/debug-session-summary.md](docs/debug-session-summary.md).
