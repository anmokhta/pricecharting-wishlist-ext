# Roadmap

## Planned

### 1. Fix the ~2 second freeze on the first click into the search box

Right after the wishlist page loads, the first click into the search box takes about 2 seconds to respond (no cursor, no typing). After that it's instant. This is the most visible rough edge, so it comes first.

- [ ] Reproduce it on the live site and on the mockup, and record a Chrome DevTools **Performance** trace of page load plus the first click, to see what is running during the freeze.
- [ ] Fix the cause (see below), then confirm the first click responds immediately with a large wishlist (several hundred cards).
- [ ] Add a test that the search box accepts typing promptly right after load (e.g. type into it as soon as it appears and check the filter applies), so this can't come back unnoticed.

**Likely causes to check first:**

- **The main thread is busy finishing the load.** The search box appears before every page has loaded. `loadAll()` parses each 200-item page with `DOMParser`, imports the rows, and then `enhanceRows()` re-sorts the whole table, upgrades every image, and adds the buttons, in one long synchronous run. A click during that run waits until it ends. Fixes: do the work in smaller chunks that yield between batches (e.g. `requestIdleCallback`/`setTimeout(0)` per page or per few hundred rows), avoid re-running the full sort and image upgrade on every page, and build rows off-DOM before inserting them.
- **Layout and image work.** Inserting hundreds of rows and swapping image sources forces big layout/paint passes; grid view's 240px images make it heavier. Batch the DOM writes, and lazy-load images (`loading="lazy"`) so off-screen ones don't load at once.
- **The site's own scripts.** PriceCharting's jQuery handlers (e.g. autocomplete or form handlers in `market_ae.js`) might react to the first focus or to the new input. Check whether the delay remains with the extension's load work disabled.
- **The MutationObserver.** Each batch of inserted rows can trigger `enhanceRows()` again; make sure the extension's own inserts don't cause repeat passes.

### 2. Shift-click to select or exclude a range

Click **Select** (or **Exclude**) on one card, then hold <kbd>Shift</kbd> and click the same button on a card further down: every card in between gets selected (or excluded) too, like shift-click in a file list. Works in list and grid view.

- [ ] Remember the last card whose Select/Exclude button was clicked (the "anchor"). Shift-click applies the clicked card's new state to every card from the anchor to it, in either direction (up or down).
- [ ] The range follows the order on screen (the current sort, and later Group by set), and skips cards hidden by search (and collapsed sets, once those exist).
- [ ] Mirror the clicked card: if shift-clicking turns a card *on*, the whole range turns on; if it turns it *off*, the whole range turns off.
- [ ] Totals and the saved picks update once for the whole range, not card by card.
- [ ] Tests: range down and up, in both views, with Select and with Exclude, skipping search-hidden cards, shift-click with no anchor (acts like a normal click), and that picks survive a reload.

**Pitfalls to design around:**

- **Select vs Exclude.** Only one mode is active at a time, and picking one hides the other. Shift-clicking an Exclude button while Select mode is active can't happen (those buttons are hidden), but the anchor must reset when the lists are cleared or the mode changes.
- **Browser text selection.** Shift-click normally highlights text between the two clicks; prevent that on these buttons only.
- **Anchor that disappears.** If the anchor card is moved to the collection, removed, or hidden by a new search, fall back to a normal click (and start a new anchor).
- **Big ranges.** A shift-click across hundreds of cards should update in one pass and save once, so the page doesn't stutter.
- **Move to collection is excluded.** Range clicks only apply to Select/Exclude; Move and Remove stay one card at a time.

### 3. "Show only picked" filter in the yellow box

A toggle in the yellow Select/Exclude panel that hides every card except the ones currently picked: **Show only selected** in Select mode, **Show only excluded** in Exclude mode. Click it again (or **Show all**) to bring everything back. Useful for reviewing a list before acting on it.

- [ ] Add the toggle next to **Clear** in the yellow panel; its label follows the active mode. Hidden when nothing is picked.
- [ ] While it's on, only picked cards show, in both list and grid view. The blue totals box is hidden (the yellow panel's count and total describe what's on screen); it comes back when the filter is turned off.
- [ ] Combine with search: a card shows only if it is picked **and** matches the search.
- [ ] Turning it off, clearing the picks, or switching modes shows everything again.
- [ ] Tests: on and off in both views and both modes, combined with search, unpicking a card while filtered (it disappears), clearing picks resets the filter, the blue box hides while filtered and returns after, and the filter is off again after a reload.

**Pitfalls to design around:**

- **Unpicking while filtered.** Clicking Select/Exclude on a visible card un-picks it, so it vanishes right away. That's expected, but if the last picked card is un-picked the list goes empty: turn the filter off automatically.
- **Exclude mode wording.** "Show only excluded" shows the cards you're *leaving out*; the remaining total in the yellow box describes the hidden cards. Make the label and totals text clear about which set is on screen.
- **Persistence.** Probably shouldn't survive a reload (like search), so the page never opens looking almost empty.
- **Interaction with Group by set and shift-click ranges.** Set headers with no picked cards hide; shift-click ranges apply only to visible (picked) cards while filtered.

### 4. Multiple searches ("OR")

Search for several things at once, e.g. two Pokémon. A **+** button sits next to the search box. Pressing it (on the main box or any added one) adds a new search box below the main one, with an **×** button on its left to remove it. A card is shown if it matches **any** box. Inside a single box, words still all have to match, as today (`charizard ex` = both words).

- [ ] **+** button next to each search box; pressing it adds an empty box below the main one and focuses it.
- [ ] **×** button to the left of each added box removes it (the main box has no ×; clearing it is enough). <kbd>Esc</kbd> in an added box clears it, and Esc in an empty added box removes it.
- [ ] Matching: a card shows if any non-empty box matches it; empty boxes are ignored; with every box empty, everything shows.
- [ ] The blue totals box follows the combined result, and its wording lists the terms (e.g. `12 of 352 wishlist items match "pikachu" or "eevee"`).
- [ ] Tests: two boxes OR'd, words AND'd within a box, removing a box updates the results, empty boxes ignored, Esc behavior, and that Select/Exclude, Move and (once it exists) Group by set work with multiple searches.

**Pitfalls to design around:**

- **Two different rules.** Spaces mean AND inside a box and separate boxes mean OR. Make that obvious, e.g. an "or" label between boxes and placeholder text like "…or another search".
- **Layout.** Added boxes push the totals box and the list down. Keep the stack compact, cap the number of boxes (e.g. 5), and make sure it fits at narrow widths and in grid view.
- **Focus and keyboard.** After removing a box, move focus to the box above it. Enter shouldn't submit PriceCharting's own filter form.
- **Persistence.** Today the search isn't saved across reloads. Keep it that way for multiple boxes too, unless it's needed later for Saved selections.
- **Overlap with Saved selections and Group by set.** Hidden-by-search cards still count in Select/Exclude totals; a grouped view should hide set headers whose cards are all filtered out by the combined search.
- **Code.** `applySearch()` in `content.js` uses one `query` string; change it to a list of queries (one per box) with the same per-box token matching, and debounce input from every box the same way.

### 5. Saved selections

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
- **Privacy policy.** The privacy policy (item 7) must mention saved selections.

### 6. Group by set

A **Group by set** toggle next to the grid/list buttons. When it's on, cards are grouped by set (sets A→Z), and inside each set they follow the sort you've picked: price (low→high or high→low), name, or card number. Like the price sort, it works on the whole wishlist because every page is already loaded. Turning it off returns to the normal ungrouped list.

- [ ] Add the Group by set toggle (works in both list and grid view; remembered per browser, like grid/list).
- [ ] Within each set, use the current sort: the site's Lowest/Highest price and Name sorts, plus a new **Card number** sort the extension adds (the site doesn't have one). Newest/Oldest keep the server order inside each set.
- [ ] A small header (list row or grid divider) at the start of each set with the set name, card count and set total.
- [ ] Collapse and expand: clicking a set's header hides or shows that set's cards (with a ▸/▾ indicator). While grouping is on, **Collapse all** and **Expand all** buttons appear next to the toggle; they're hidden when grouping is off.
- [ ] Remember which sets are collapsed (per wishlist, per browser) so they stay collapsed after a reload or a sort change.
- [ ] Tests: grouping on and off, each sort inside groups, ties, unpriced cards, cards without a number, collapsing and expanding one set, Collapse all / Expand all, collapsed sets surviving a reload, switching views while grouped, and that Select/Exclude, search, Move and the totals keep working while grouped.

**Pitfalls to design around:**

- **Grouping is the extension's own control; sorting mostly isn't.** The site's sort dropdown (`select[name=sort]`) reloads the page from the server, which only knows Name, price, Newest and Oldest. Grouping must survive that reload (read the saved toggle on startup) and re-apply after `sortRows()`. Card number isn't a server sort, so it needs its own control or an option the extension adds to the dropdown and handles without a page reload.
- **Reading the set.** The set name is the title text minus the card-name link (`rowInfo()` in `content.js`). Check this holds for every category and for names that contain the set name.
- **Card numbers aren't plain numbers.** Numbers are parsed from the name (`#4`, `#123`, `#TG01`, `#SV107`, `#GG35`, sometimes none). Sort numerically where possible, with prefixes and suffixes compared naturally (`#2` before `#10`, `TG01` grouped together), and cards without a number last within their set.
- **Set order.** Alphabetical is the only order the page gives us; there's no release date. Ignore a leading "Pokemon" in set names when comparing, if most sets share it.
- **Unpriced cards.** Keep them last in a price sub-sort, as now.
- **Search and empty groups.** When a search hides every card in a set, hide that set's header too, and make the header counts follow the search like the main totals do.
- **Loading.** Group once every page has loaded; while loading or in the Retry state, show cards ungrouped or grouped so far, and regroup when loading finishes.
- **Collapsed sets and the rest of the page.** Collapsed cards are hidden, not removed, so the main count and total still include them (like search-hidden cards); the set header keeps showing its count and total. Decide what happens when a search matches cards in a collapsed set (auto-expand it, or show "3 matches" on the header). Select/Exclude picks inside a collapsed set still count toward the pick totals.
- **Collapsed-state storage.** Store collapsed sets by set name, keyed by wishlist like picks are. Prune names of sets no longer on the wishlist so the list doesn't grow forever. Collapse all / Expand all should apply to sets added later in the same way (e.g. store "all collapsed except…" rather than a list of every set).
- **Late rows.** Rows added after load (the observer path in `enhanceRows()`) must land in the right set, and set headers must never be mistaken for wishlist rows by the purge/dedupe code.
- **Performance.** Grouping a few thousand rows with string compares is fine, but avoid re-parsing set names and card numbers on every re-sort; cache them on the row.

### 7. Publish on the Chrome Web Store

**Status:** v1.4.6 approved and live on the [Chrome Web Store](https://chromewebstore.google.com/detail/opfopmnimlhgjgnoegkghpdpdgabjhcf) (seen 2026-11-21; it still shows the old name and icon until 1.4.7 or later is approved). Item ID `opfopmnimlhgjgnoegkghpdpdgabjhcf` (dashboard: https://chrome.google.com/webstore/devconsole).

- [x] Register a Chrome Web Store developer account; contact email set and verified.
- [x] Privacy policy rewritten (`docs/privacy-policy.md`) and published as a public gist: https://gist.github.com/anmokhta/0dbdab84b479a030717f3584833156b9. When the policy changes, edit `docs/privacy-policy.md` and update the gist with `gh gist edit 0dbdab84b479a030717f3584833156b9 docs/privacy-policy.md`.
- [x] Store description written (search, Select/Exclude lists, Move to collection, privacy note, not-affiliated line). Category: Functionality & UI.
- [x] Screenshots captured on the test account; 1280×800 versions (page only, no browser toolbar) are now in `design/drafts/store-listing-v1/` (replaced by the new store art).
- [x] Privacy practices: single-purpose statement, host-access justification (content script on `pricecharting.com/wishlist*` only; no permissions), no remote code, data usage = website content only, all three certifications.
- [x] Test account and test instructions (under 500 characters) entered. Keep that account's wishlist stocked and its password unchanged.
- [x] Uploaded the v1.4.6 zip from GitHub Releases and submitted for review (2026-11-15).
- [x] Approved and published (live by 2026-11-21).
- [x] Store link added to the README install section.
- [ ] Set up the service account and GitHub secrets for the "Submit to Chrome Web Store" action (docs/releasing.md → One-time setup).
- [ ] Upload the new store art from `design/current/store-listing/` (marquee promo tile 1400×560 and four 1280×800 screenshots), and capture a Move to collection screenshot for the fifth slot.
- [ ] 1.4.6 has cleared review: run the action to submit 1.4.7 (the rename and new icon). The store listing name comes from the manifest. Check the dashboard listing text still matches the new name.

## Backlog

- **CSV export (private build only).** Possibly a separate private branch or build that restores the Export CSV button (removed in 1.4.6). It must never ship in the public Chrome Web Store build.
- **Safari / iOS port.** No code changes are expected (plain MV3 content script, standard DOM APIs), but it needs:
  - Full Xcode from the App Store (Command Line Tools alone don't include `safari-web-extension-packager`).
  - `xcrun safari-web-extension-packager --copy-resources --app-name "Wishlist+" --bundle-identifier <reverse.dns.id> extension/` to generate the wrapper app.
  - A decision on whether to commit the generated Xcode project (e.g. under `safari/`) or regenerate it in CI.
  - Testing in macOS Safari (Settings → Developer → Add Temporary Extension), then the iOS Simulator. Check `localStorage` persistence.
  - A paid Apple Developer membership to run it on a real iPhone or publish it.

## Completed

Newest first. When a planned or backlog item ships, it moves here. This section is the developer view (code and tests); the short user-facing notes for each version go in [CHANGELOG.md](CHANGELOG.md), which CI requires before a release and uses as the GitHub Release description.

### Move to collection verified on the live site (2026-11-15)

- **What it does:** confirmed on a real PriceCharting account that Move adds the card to the Collection tab and removes it from the wishlist. Until now it had only been tested against fake responses.
- **Code:** none.
- **Tests:** manual check on the live site.

### 1.4.7 — Rename, new icon and manual store submission (2026-11-21)

- **What it does:** renames the extension to "Wishlist+ for PriceCharting", replaces the icon (stacked cards with a green "+", no PriceCharting logo elements), and rewords the description around what it fixes (the whole wishlist loads, so price sorting covers every item). Adds a manual GitHub Action, "Submit to Chrome Web Store", that uploads the tested release zip for the current version and submits it for review. It never runs on push.
- **Code:** `extension/manifest.json`: name, description, version, and a new 32 px icon entry. `extension/icon16/32/48/128.png` redrawn; sources in `design/current/icon/`, concept rounds in `design/drafts/icon-concepts/`. Store art (marquee promo tile and screenshots) in `design/current/store-listing/`, built from `design/current/source/`. New `.github/workflows/store.yml` (`workflow_dispatch` only, `main` only; downloads the `v<version>` release zip and checks its manifest version). New `scripts/chrome-store.js`: signs a service-account JWT with `node:crypto`, then calls Chrome Web Store API v2 `fetchStatus` → `upload` → `publish`; refuses while another version is pending review. Docs renamed throughout; setup and pitfalls in `docs/releasing.md`.
- **Tests:** `test/chrome-store.spec.js` (8 tests, fake Google API): JWT claims and signature, upload then publish, `--no-submit` draft, pending-review refusal, polling an in-progress upload, failed upload, HTTP error message, missing secrets.

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
