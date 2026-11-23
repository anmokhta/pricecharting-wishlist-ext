# Roadmap

## Planned

### 1. Multiple searches ("OR")

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

### 2. Saved selections

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
- **Privacy policy.** The privacy policy (see item 4) must mention saved selections.

### 3. Group by set

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

### 4. Publish on the Chrome Web Store

**Status:** v1.4.6 approved and live on the [Chrome Web Store](https://chromewebstore.google.com/detail/opfopmnimlhgjgnoegkghpdpdgabjhcf) (seen 2026-11-21; it still shows the old name and icon until 1.4.7 or later is approved). Item ID `opfopmnimlhgjgnoegkghpdpdgabjhcf` (dashboard: https://chrome.google.com/webstore/devconsole).

- [x] Register a Chrome Web Store developer account; contact email set and verified.
- [x] Privacy policy rewritten (`docs/public/privacy-policy.md`) and published as a public gist: https://gist.github.com/anmokhta/0dbdab84b479a030717f3584833156b9. When the policy changes, edit `docs/public/privacy-policy.md` and update the gist with `gh gist edit 0dbdab84b479a030717f3584833156b9 docs/public/privacy-policy.md`.
- [x] Store description written (search, Select/Exclude lists, Move to collection, privacy note, not-affiliated line). Category: Functionality & UI.
- [x] Screenshots captured on the test account; 1280×800 versions (page only, no browser toolbar) are now in `design/drafts/store-listing-v1/` (replaced by the new store art).
- [x] Privacy practices: single-purpose statement, host-access justification (content script on `pricecharting.com/wishlist*` only; no permissions), no remote code, data usage = website content only, all three certifications.
- [x] Test account and test instructions (under 500 characters) entered. Keep that account's wishlist stocked and its password unchanged.
- [x] Uploaded the v1.4.6 zip from GitHub Releases and submitted for review (2026-11-15).
- [x] Approved and published (live by 2026-11-21).
- [x] Store link added to the README install section.
- [ ] Set up the service account and GitHub secrets for the "Submit to Chrome Web Store" action (docs/internal/releasing.md → One-time setup).
- [ ] Upload the new store art from `design/current/store-listing/` (marquee promo tile 1400×560 and four 1280×800 screenshots), and capture a Move to collection screenshot for the fifth slot.
- [ ] 1.4.6 has cleared review: run the action to submit 1.4.7 (the rename and new icon). The store listing name comes from the manifest. Check the dashboard listing text still matches the new name.

## Backlog

- **Freezes while the page loads.** On a 388-card wishlist, loading has two ~575 ms long tasks (`enhanceRows()` sorting, upgrading images and adding buttons over the whole table in one go), and in about half of loads a further ~2.8 s block with no page script or rendering in it (Chrome-internal work; it happens with or without the 1.4.8 search-box form, and with a search box that isn't a form field at all). Ideas: chunk `enhanceRows()` with yields between batches; look for what Chrome is doing in the 2.8 s block with a DevTools Performance trace.
- **CSV export (private build only).** Possibly a separate private branch or build that restores the Export CSV button (removed in 1.4.6). It must never ship in the public Chrome Web Store build.
- **Safari / iOS port.** No code changes are expected (plain MV3 content script, standard DOM APIs), but it needs:
  - Full Xcode from the App Store (Command Line Tools alone don't include `safari-web-extension-packager`).
  - `xcrun safari-web-extension-packager --copy-resources --app-name "Wishlist+" --bundle-identifier <reverse.dns.id> extension/` to generate the wrapper app.
  - A decision on whether to commit the generated Xcode project (e.g. under `safari/`) or regenerate it in CI.
  - Testing in macOS Safari (Settings → Developer → Add Temporary Extension), then the iOS Simulator. Check `localStorage` persistence.
  - A paid Apple Developer membership to run it on a real iPhone or publish it.

## Completed

Newest first. When a planned or backlog item ships, it moves here. This section is the developer view (code and tests); the short user-facing notes for each version go in [CHANGELOG.md](../../CHANGELOG.md), which CI requires before a release and uses as the GitHub Release description.

### 1.4.8 — Search-box freeze fixed, shift-click ranges, pick filters (2026-11-22)

- **What it does:**
  - **Search freeze:** the first click into the search box no longer freezes the page for ~3 s on large wishlists.
  - **Shift-click ranges:** click Select or Exclude on one card, then Shift-click another to apply the clicked card's new state to every visible card in between. Holding Shift previews the range under the pointer, outlined green or red when cards will be picked and grey when they will be un-picked.
  - **Pick filters:** the yellow panel has **Show only selected** in Select mode, and **Show only excluded** and **Hide excluded** in Exclude mode. While a filter is on, the blue totals box is hidden.
- **Cause of the freeze:** Chrome's autofill. The page has ~6,200 inputs and selects (every card's Watchtower controls), almost all outside any `<form>`. The first focus of a form-less field makes autofill gather and analyse all of them; the result is cached, so only the first click was slow. Measured live (388 cards, 5 loads each with Event Timing and Long Task data): first click 2.6–2.8 s with the old form-less box, 0.16–0.6 s in a form. A non-form (contenteditable) box was tried and dropped: no better, and the separate load-time block (see Backlog) happened with every variant.
- **Code (`content.js`, `content.css`):**
  - The search box is `<form class="pcw-search" role="search">` with `submit` prevented and `autocomplete="off"`.
  - `picks.setMany()` saves a whole range at once.
  - `pickAnchor` is set on each plain Select/Exclude click and reset when nothing is picked.
  - `rangeTo()` returns the visible cards between the anchor and a card, in either direction; `handlePick()` handles both kinds of click.
  - The Shift preview uses `pcw-range*` classes, driven by `mouseover` on the table body and Shift `keydown`/`keyup`. It is cleared after a click until the pointer moves to another card.
  - `pickFilter` is `'all'`, `'only'` or `'hide'`, and isn't saved. `applySearch()` is now the single visibility pass: search plus pick filter, and it hides the blue box while a filter is on, unless a load error or Retry is showing.
  - Every pick change re-runs `updatePickUI()` and `applySearch()`.
  - Grid view: `td.pcw-pick-actions` gets `margin-top: auto`, so the button block (Select/Exclude, Move, Remove) sits at the bottom of each card and lines up across a row when a set name wraps.
- **Tests:** 19 new.
  - Search box: it is alone in its own form; Enter doesn't submit or reload.
  - Shift-click: range down and up in list and grid view, with Select and with Exclude; a range that turns cards off; search-hidden cards skipped; no anchor acts as a normal click; Clear resets the anchor; the range survives a reload; the Shift preview, including the grey "off" preview.
  - Grid layout: buttons line up across a row and sit at the card's bottom when one card's set name wraps.
  - Filters: Show only selected in list and grid view (blue box hides and returns); Show only excluded; Hide excluded, including excluding while hidden and switching filters; combined with search; un-picking while filtered, and the last un-pick turning the filter off; Clear resets the filter; the filter is off after a reload.

### Move to collection verified on the live site (2026-11-15)

- **What it does:** confirmed on a real PriceCharting account that Move adds the card to the Collection tab and removes it from the wishlist. Until now it had only been tested against fake responses.
- **Code:** none.
- **Tests:** manual check on the live site.

### 1.4.7 — Rename, new icon and manual store submission (2026-11-21)

- **What it does:** renames the extension to "Wishlist+ for PriceCharting", replaces the icon (stacked cards with a green "+", no PriceCharting logo elements), and rewords the description around what it fixes (the whole wishlist loads, so price sorting covers every item). Adds a manual GitHub Action, "Submit to Chrome Web Store", that uploads the tested release zip for the current version and submits it for review. It never runs on push.
- **Code:** `extension/manifest.json`: name, description, version, and a new 32 px icon entry. `extension/icon16/32/48/128.png` redrawn; sources in `design/current/icon/`, concept rounds in `design/drafts/icon-concepts/`. Store art (marquee promo tile and screenshots) in `design/current/store-listing/`, built from `design/current/source/`. New `.github/workflows/store.yml` (`workflow_dispatch` only, `main` only; downloads the `v<version>` release zip and checks its manifest version). New `scripts/chrome-store.js`: signs a service-account JWT with `node:crypto`, then calls Chrome Web Store API v2 `fetchStatus` → `upload` → `publish`; refuses while another version is pending review. Docs renamed throughout; setup and pitfalls in `docs/internal/releasing.md`.
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

Cross-page price sort, grid view, totals, Remove relabel, Set filter label, Select/Exclude lists with CSV export, search, grid-view Move to collection, and the 1.4.1 fix for duplicate "bare" rows. No dates were recorded. See [technical-summary.md](technical-summary.md) and [debug-session-summary.md](debug-session-summary.md).
