# Roadmap

## Planned

### 1. One-click "Move to collection" in list view

"One click" here means click once, then click again to confirm, the same as grid view. Move always uses your PriceCharting default condition.

- [x] Show the Move button in list view rows (1.4.3), under the Remove button (1.4.4).
- [x] Same click-to-confirm behavior in list and grid view.
- [ ] Verify the move end-to-end against the real API (has only been tested with stubbed `fetch`): add lands in the Collection tab, wishlist row removed, failure path leaves the card in place.

### 2. Publish on the Chrome Web Store

- [ ] Register a Chrome Web Store developer account (one-time $5 fee).
- [ ] Update the privacy policy: it currently says only the grid/list setting is stored. It must also cover pick lists in `localStorage` and the add-to-collection / remove-from-wishlist requests made on user action. Host it at a public URL (this repo is private, so it can't live here unless the repo is made public or the policy is hosted elsewhere, e.g. GitHub Pages from a public repo or a gist).
- [ ] Refresh the store description to mention search, Select/Exclude lists with CSV export, and Move to collection. Keep the manifest `description` ≤ 132 chars (currently 127).
- [ ] Recapture screenshots (existing ones predate pick lists, search and move).
- [ ] Single-purpose and permissions justification for review (no permissions declared; content script on `pricecharting.com/wishlist*` only).
- [ ] Upload the zip from the latest GitHub Release and submit for review.
- [ ] After approval: add the store link to the README install section.

### 3. Saved selections

After selecting or excluding cards, give the selection a name and save it. A control at the top of the list then re-applies a saved selection in one step.

- [ ] Add a "Save selection…" action to the pick panel (name prompt), and a "Saved selections" dropdown at the top that stays visible even when nothing is picked.
- [ ] Load, rename, overwrite and delete saved selections.
- [ ] Show how much of a saved selection still applies (e.g. "4 of 5 cards still on your wishlist").

**Pitfalls to design around:**

- **What identifies a card.** Picks are stored by row id (`bid-…`), which is the *wishlist entry*, not the card. If a card is removed and added again, it gets a new id and drops out of saved selections. Storing the product id (`data-product`) as well would let a selection re-match it, but two entries for the same product (if the site allows that) would then be ambiguous.
- **Cards that leave the wishlist.** Moving to the collection or removing a card leaves stale ids behind. Decide whether to prune them automatically, keep them silently, or show them as "missing".
- **Exclude-mode meaning drifts.** A saved *exclude* list means "everything except these", so its total and contents change every time the wishlist changes. A saved *select* list stays fixed. The UI should make that difference clear.
- **Overwriting current picks.** Loading a saved selection while you have unsaved picks would wipe them. Ask first, or offer to save the current picks.
- **Load timing.** A selection can only be applied once every page has loaded. If loading fails partway (the Retry state), some cards won't match yet. Apply it after the full load, or re-apply when Retry finishes.
- **Where it's stored.** `localStorage` on pricecharting.com is per browser and per device. Clearing site data wipes it, and PriceCharting's own scripts share that storage. `chrome.storage.sync` would sync across your Chrome installs, but it needs the `storage` permission, which changes the store review and privacy policy, and it has small quotas (about 8 KB per item, 100 KB total).
- **Which wishlist it belongs to.** Picks are already keyed by the `user=` URL parameter. Saved selections should be too, so viewing someone else's wishlist doesn't show (or apply) your saved lists.
- **Names.** Handle empty names, duplicate names (overwrite or reject), very long names, and a cap on how many can be saved.
- **Prices.** Totals should be recalculated from current prices when loaded, not stored, and the UI should say so.
- **Interaction with search.** A loaded selection can include cards hidden by the current search. Counts and totals already cover hidden cards; the UI should make that obvious.
- **Backup.** Consider exporting and importing saved selections (JSON), since browser storage is easy to lose.
- **Privacy policy.** The Chrome Web Store policy (item 2) must mention saved selections.

## Backlog

- **Safari / iOS port.** No code changes are expected (plain MV3 content script, standard DOM APIs), but it needs:
  - Full Xcode from the App Store (Command Line Tools alone don't include `safari-web-extension-packager`).
  - `xcrun safari-web-extension-packager --copy-resources --app-name "Wishlist Grid View" --bundle-identifier <reverse.dns.id> extension/` to generate the wrapper app.
  - A decision on whether to commit the generated Xcode project (e.g. under `safari/`) or regenerate it in CI.
  - Testing in macOS Safari (Settings → Developer → Add Temporary Extension), then the iOS Simulator. Check CSV download on iOS and `localStorage` persistence.
  - A paid Apple Developer membership to run it on a real iPhone or publish it.
