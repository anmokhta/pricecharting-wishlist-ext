# Wishlist+ for PriceCharting: Technical Summary

Chrome extension (Manifest V3), current version **1.4.0**. Content-script-only; no background worker, no popup, no declared permissions.

This document covers what was built, how it works internally, how it was tested, what is verified versus unverified, and the open items.

---

## 1. Goals and history

The work started from a PriceCharting.com wishlist page that had two problems:

1. **Broken price sort.** "Low to high" put cheap cards after a $1000 item.
2. **No grid view.** PriceCharting's search-results pages have one; the wishlist does not.

Features were then added in this order:

| Version | Added |
|---|---|
| ≤1.1.0 | Cross-page price sort fix; grid/list toggle; item count and total value; working Remove button in grid view; `Type part of console` → `Type part of set` placeholder relabel; rename to "Wishlist Grid View for PriceCharting" (renamed to "Wishlist+ for PriceCharting" after 1.4.6); generated icons |
| 1.2.0 | Select/Exclude pick lists with running totals, localStorage persistence, CSV export |
| 1.3.0 | Search box (name and set); manifest description cut to ≤132 chars |
| 1.4.0 | "Move to collection" button (grid view only) |

---

## 2. File inventory

```
pricecharting-wishlist-fix/
├── manifest.json      MV3 manifest, 578 B
├── content.js         ~443 lines, single IIFE, no dependencies
├── content.css        ~125 lines
├── icon16.png  icon48.png  icon128.png   (original artwork, generated with Pillow)
```

Packaged as `pricecharting-wishlist-fix.zip` (6 files).

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "Wishlist Grid View for PriceCharting",
  "version": "1.4.0",
  "description": "Sorts your whole PriceCharting wishlist by price, adds grid view, search, totals, Select/Exclude lists, and move-to-collection.",
  "icons": { "16": "icon16.png", "48": "icon48.png", "128": "icon128.png" },
  "content_scripts": [{
    "matches": ["https://www.pricecharting.com/wishlist*"],
    "js": ["content.js"], "css": ["content.css"],
    "run_at": "document_idle"
  }]
}
```

- No `permissions` or `host_permissions`. All network calls are same-origin from the page's own context.
- The description is 127 characters. Chrome's limit for this field is 132 (confirmed against Chrome's manifest docs). Earlier versions were over the limit and would have been rejected at submission.

---

## 3. PriceCharting DOM model (what the extension depends on)

Observed on the live wishlist page:

- `table#active.selling_table` has a single `<tbody>` containing:
  - `tr.watchtower-headers` (header rows)
  - `tr.item#bid-<id>` with `data-product="<productId>"` and `data-id="<bidId>"`
  - `tr.item-details` (one paired sibling per item)
  - `tr.offers-paging` (class `gap offers-paging`) containing `form.next_page` with a hidden `input[name=cursor]`
- Cells inside `tr.item`: `td.expand` (three buttons: `.js-expand-bid` "▼", `.js-shrink-bid` "▲", `.js-cancel-bid`, originally `value="-"`), `td.photo`, `td.meta` (`p.title` containing an `<a>` for the name plus set text), `td.price` (contains `.js-price`), and several `td.watchtower…` cells.
- Sort and filter controls live in a form: `select[name=sort]` (values `name`, `lowest-price`, `highest-price`, `newest`, `oldest`), plus Category and Set selects.
- **Pagination is server-side, cursor-based, 200 items per page.** The next page is a POST to the same URL with `cursor=<opaque>`.
- **Sorting happens server-side per page.** This is the root cause of the broken price sort: page 2 restarts from the cheapest item.
- Rows are processed by jQuery delegated handlers in `/js/market_ae.js`, for example `$('.selling_table').on('click', '.js-cancel-bid', …)`.
- The "Type part of console" text is a jQuery UI autocomplete field reused from the video-game template. It is a PriceCharting bug, confirmed by loading the page with the extension's overrides disabled. It still works as a set-name filter, so the extension only relabels its placeholder.

---

## 4. Architecture of content.js

One IIFE. It bails out if `table#active` or `select[name=sort]` is missing, so it is inert on other pages.

### Startup order

1. Cache `table`, `tbody = table.tBodies[0]`, and `sort = select[name=sort].value`. `MAX_PAGES = 100`.
2. Relabel `input[placeholder="Type part of console"]` to `Type part of set`.
3. Build the view toggle (grid and list icons using the site's `/images/grid.png` and `/images/table.png`). Insert it after the last `<select>` outside the table in the sort form.
4. `relabelRemoveButtons()`, then `setView(localStorage['pcw-view'] === 'grid' ? 'grid' : 'list')`.
5. Insert the `.pcw-summary` and `.pcw-status` divs before the table.
6. Define the helper functions. `picks.load()` restores saved pick state.
7. Create the `.pcw-pick-panel` and the `.pcw-search` box.
8. `loadAll()` runs asynchronously. On success it calls, in order: `sortRows()`, `upgradeImages()`, `relabelRemoveButtons()`, `addPickButtons()`, `addMoveButtons()`, `updatePickUI()`, `applySearch()` (which calls `updateSummary()`), then sets the status text. The status div is removed after 6 seconds.
9. On failure (`.catch`), it runs `sortRows`, `addPickButtons`, `addMoveButtons`, `updatePickUI`, `applySearch`, and shows an error in the status line. Note that this path does not call `upgradeImages` or `relabelRemoveButtons`; it is a minor gap.

The view toggle and Remove relabel run immediately, so they work while the rest of the wishlist is still loading.

### 4.1 Cross-page load and sort (`loadAll`, `sortRows`)

`loadAll`:

- Reads the cursor from `form.next_page input[name=cursor]` in the current tbody.
- Loops while a cursor exists and `pages < MAX_PAGES`:
  - `fetch(location.href, {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({cursor})})`
  - Parses the response with `DOMParser`.
  - Selects `table#active > tbody > tr` rows that are `.item` or `.item-details`.
  - Imports each with `document.importNode(r, true)` and inserts it before the `tr.offers-paging` anchor.
  - Reads the next cursor. If it equals the current one, it stops, as a guard against a repeating cursor.
- Removes the paging row at the end.
- Throws on a non-OK HTTP status. The `.catch` branch then displays what loaded.

`sortRows`:

- Runs only when the page's sort is `lowest-price` or `highest-price`. Other sorts are already correct server-side, because the global order is preserved by cursor pagination.
- Builds `{item, det, price}` pairs, where `det` is the `item-details` sibling.
- Sorts numerically with `priceOf`. Rows with no price (`NaN`) always go last.
- Re-inserts each pair before the paging anchor. When that anchor is `null` (after removal), `insertBefore(x, null)` appends, which gives the correct order.

`priceOf(row)` reads `.js-price` text, strips commas, and matches `/\$?([\d.]+)/`.

### 4.2 Grid view (CSS-only transformation of the table)

Toggling `table.pcw-grid` repurposes the existing `<table>` as a card grid. Native controls keep working because no markup is rebuilt.

- `table#active.pcw-grid, > tbody` → `display:block`. Then `> tbody { display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:10px }`.
- `tr.item` → `display:flex; flex-direction:column` with card border, radius, and padding.
- Non-item rows (headers, details, paging) → `display:none`. `td.watchtower` is also hidden.
- Cell order inside each card, via flex `order`: photo 1, meta 2, price 3, pick-actions 4, move 5, expand/Remove 6.
- `upgradeImages(true)` swaps `/60.jpg` thumbnails for `/240.jpg`, stores the original in `data-pcw-small`, and falls back through `onerror`. Switching to list view restores the small image.
- The view choice is stored in `localStorage['pcw-view']`.

**Remove button in grid view.** Hiding the whole `td.expand` column (the first attempt) also hid the real Remove control. The fix:

- Keep `td.expand` visible, hide `.js-expand-bid` and `.js-shrink-bid`, and style `.js-cancel-bid` as a full-width in-flow button.
- Relabel its value from `-` to `Remove`.
- An absolute-positioned "×" overlay was tried and abandoned. It rendered outside the card boundary because of positioning-context mismatches.

### 4.3 Count and total (`updateSummary`)

- Counts `tr.item` rows and sums `priceOf`, skipping `NaN`.
- Appends `(N with no price)` when applicable.
- With a search active, it counts only rows without `.pcw-hidden`. The text becomes `X of N wishlist items match "q" · Total value: $…`.

### 4.4 Select/Exclude pick lists

State object `picks`: `mode` (`'none' | 'select' | 'exclude'`) and `ids` (a `Set` of `tr.id` values such as `bid-…`).

- **Persistence.** `localStorage['pcw-picks-<user>']`, where `<user>` comes from the `user=` query parameter (fallback `default`). The stored value is `{mode, ids[]}`. The key is removed when the mode returns to `none`.
- **Mutual exclusivity.** `updatePickUI` toggles `pcw-mode-select` / `pcw-mode-exclude` on the table. CSS then hides the opposite button everywhere:
  - `table#active.pcw-mode-select .pcw-btn-exclude { display:none !important }`
  - the mirror rule for exclude mode.
- **Per-row buttons.** `addPickButtons()` inserts `td.pcw-pick-actions` (a `.pcw-btn-select` and a `.pcw-btn-exclude`) after `td.price`. It is idempotent: rows that already have the cell are skipped. Picked rows get `pcw-picked-select` or `pcw-picked-exclude` (outline, with dimming for excluded rows), and the label changes to `✓ Selected` / `✕ Excluded`.
- **Totals.** The `.pcw-pick-panel` banner shows:
  - select mode: `N cards selected · Total: $X`
  - exclude mode: `N cards excluded · Remaining total: $(grand total − excluded total)`
- **Scope.** Totals iterate over all `tr.item` rows, not just visible ones, so a search never changes pick math.
- **Clear.** A Clear button resets the mode and the saved state.
- **Export CSV.** `exportPicks()` builds a CSV with columns `Name,Set,Price` and summary rows, then downloads it through `Blob` + `URL.createObjectURL` + a temporary `<a download>`.
  - Select mode rows: `Selected items`, `Total`.
  - Exclude mode rows: `Excluded items`, `Wishlist total`, `Remaining total (wishlist minus excluded)`.
  - File names are `wishlist-selected-YYYY-MM-DD.csv` and `wishlist-excluded-YYYY-MM-DD.csv`.
  - `rowInfo(row)` extracts the name from `td.meta p.title a`. The set is the `p.title` text with the name removed.
  - Cells are quoted with `"` doubled.

### 4.5 Search (`applySearch`)

- An `<input type="search">` is inserted before the summary. Input is debounced by 120 ms. Escape clears it.
- The query is lowercased and split on whitespace. A row stays visible only if **every token** is a substring of `(name + ' ' + set).toLowerCase()`.
- Hidden rows get `.pcw-hidden`, and so does their `item-details` sibling. The CSS rule `table#active tr.pcw-hidden { display:none !important }` is `!important` so it beats the grid's `display:flex`.
- Rows stay in the DOM, so picks and sorting are unaffected.
- `applySearch` is also called after the initial load and after a card is moved.

### 4.6 Move to collection (grid view only)

The mechanism was reverse-engineered from `/js/market_ae.js`, read-only. The site's own `add_to_collection(id)` does:

```
POST /api/offer-publish?product=<productId>&add-to-collection=on&max-price=0&condition-id=<DefaultCondition || "1">
```

The site fires this and ignores the response. It reads the default condition from `localStorage['prefs.DefaultCondition']` and falls back to `"1"`. In the tested profile the stored value was empty, so it used `"1"`.

The extension's flow:

1. **Click 1 (arm).** The button turns orange and says "Click again to confirm". It auto-resets after 4 seconds. This is a deliberate guard against accidental moves, and it avoids `confirm()`, whose blocking dialog would freeze browser automation.
2. **Click 2 (execute).** The button goes into a `moving` state and is disabled. It POSTs the URL above using `row.dataset.product`.
3. **Check.** If `!res.ok`, it throws. The row stays and the button reads "Failed — try again". Nothing is removed.
4. **Remove.** On success it calls `.click()` on the row's native `td.expand input.js-cancel-bid`. That triggers the site's delegated handler, which calls `cancel_from_wishlist(bidId)` → `POST /api/remove-wishlist` with `{bidId}`. The extension deliberately does not reimplement the removal request.
5. **Cleanup.** The button shows "✓ Moved to collection". The row's id is removed from `picks`. After 1200 ms the row and its `item-details` sibling are removed from the DOM, then `updatePickUI()` and `applySearch()` refresh counts and totals.

Ordering is add-then-remove, so a failure can leave a card in both the collection and the wishlist but never lose it.

Layout: `td.pcw-move` is `display:none` in list view and visible in grid view (`order: 5`). The purple button turns orange while armed.

---

## 5. Network and storage footprint

**Requests (all same-origin, `credentials: 'same-origin'`):**

| Request | When |
|---|---|
| `POST <wishlist URL>` with `cursor` | Page load, once per extra page (200 items/page) |
| `POST /api/offer-publish?product=…&add-to-collection=on&max-price=0&condition-id=…` | User confirms a Move |
| `POST /api/remove-wishlist` (via the site's own handler) | After a successful add |

**localStorage:**

- `pcw-view`: grid or list.
- `pcw-picks-<user>`: `{mode, ids[]}`.
- `prefs.DefaultCondition`: read-only; it is the site's own key.

No data leaves pricecharting.com, and there is no analytics or third-party request.

---

## 6. Testing methodology and results

All testing was done with Claude in Chrome against the live wishlist page. The real browser profile already had an older build of the extension installed, which created two problems:

- The installed extension had already modified the DOM, so injected tests had to clean up its elements first (`.pcw-summary`, `.pcw-status`, `.pcw-view-icons`, `.pcw-pick-panel`, `.pcw-pick-actions`).
- CSS cascade: an override rule only replaces the properties it sets. The old version's `display:none` survived whenever the new rule omitted `display`. The reliable pattern was to inject the **complete** new CSS and **explicitly set every property that differs**, using `!important` where needed.

| Feature | Test | Result |
|---|---|---|
| Cross-page sort | Compared extension output against raw paginated fetches | Pass. The earlier real-extension runs showed all pages merged and sorted |
| Grid view, Remove | Screenshots; computed styles | Pass after the in-flow button redesign |
| Pick lists | Clicked Select; checked panel text; Clear; Exclude mode; grid and list view | Pass. Math checked: $65.04 + $8.29 = $73.33; $8,617.16 − $65.04 = $8,552.12 |
| CSV export | Stubbed `HTMLAnchorElement.click` to capture the download name | Pass: no exception, correct file name. The file contents were **not** inspected |
| Search | Dispatched `input` events with several queries | Pass: `charizard` → 3/317, `charizard 151` → 1, `shining fates` → 8, nonsense → 0, Escape restores 317 |
| Move to collection | **Stubbed** `window.fetch` and `$.ajax`; ran the exact flow | Pass: arm, 4 s timeout reset, one add request, one `/api/remove-wishlist` with `bidId`, row removed from the DOM, double-click ignored. Failure path made no removal call and kept the row. Reloaded afterward: wishlist unchanged |

Tooling quirks:

- The tool's `type` action did not reach the search input, so tests fired `input` events programmatically.
- The tool output filter blocks strings that look like query strings or cookies, so inspection output had to be sanitized by replacing `?`, `=` and `&`.

---

## 7. Known issues and open items

1. **Move to collection has never run against the real API.** The success criterion is `res.ok` only, since the site does not inspect the response either. The first real use should be on a card you don't mind moving, followed by a check of the Collection tab.
2. **Unexplained "bare rows" in the user's window.** A screenshot showed three expensive cards (Gyarados Staff, Umbreon & Darkrai GX, Charizard ex) above the sorted list. They had the old `-` Remove button, no Select/Exclude buttons, and no Watchtower cells. They were never processed by the extension.
   - Fresh loads in my own tabs rendered the same cards normally, so it was not reproduced.
   - Leading hypothesis: those rows were inserted into the table after the extension's pass, or the tab's extension state was stale. Not confirmed.
   - Candidate mitigation if it recurs: a `MutationObserver` on `tbody` that re-runs relabel, pick and move button insertion, and summary.
3. **Item-count drift.** The page showed 271 → 306 → 304 → 317 → 334 items across sessions, consistent with the wishlist changing. Separately, a raw cursor-paginated fetch returned 304 rows while the page header said 306 at that moment (Ponyta #SH11 and Shinx #SH12 appeared in one load and not in the fetches). The cause is unresolved: either the list changed between requests or PriceCharting's pagination is inconsistent.
4. `.catch` path in the startup chain skips `upgradeImages` and `relabelRemoveButtons` (minor).
5. Move uses the account's **default condition only**; there is no per-card condition picker.
6. **Privacy policy and store text are stale.** The published policy says the extension saves one setting (grid or list). It now also saves pick lists and makes add-to-collection requests on user action. The policy must be updated before submission, and the store description should mention search, picks, and move-to-collection.

---

## 8. Distribution

### Chrome Web Store (prepared, not submitted)

- Name: "Wishlist+ for PriceCharting" (previously "Wishlist Grid View for PriceCharting"). The name puts the extension first and PriceCharting second to avoid implying official affiliation.
- Icons are original artwork: a blue rounded square, a white 2×2 grid motif, and a "P" badge. PriceCharting's own logo was deliberately not used because of trademark and Chrome policy risk.
- Three screenshots were captured from the live wishlist: grid view with Remove and total, list view sorted by price, and the relabeled Set filter. They predate the pick lists, search, and move features.
- A privacy policy was drafted and published as a private Claude artifact. It needs its sharing changed to a public URL, plus the update in item 6 above.
- The one-time Chrome developer registration fee is $5.

### Safari / iOS (planned, free path first)

Per Apple's documentation (these steps have not been run, and no Mac was available from the cloud sandbox):

1. **macOS Safari temporary install.** In Settings → Developer, choose "Add Temporary Extension…". Safari removes it after 24 hours or on quit.
2. **iOS Simulator.** Run `xcrun safari-web-extension-packager --copy-resources --app-name "Wishlist+" --bundle-identifier <reverse.dns.id> /path/to/unzipped`, then build for an iPhone simulator in Xcode. Enable it in Safari → Extensions.
3. **Real iPhone.** Requires Apple Developer Program membership.

Things to watch in Safari: cross-page fetch, `localStorage` persistence, CSV download behavior on iOS, and the page's content-security behavior.

Alternative considered: the Userscripts app, which would need the CSS folded into a `.user.js` file.

---

## 9. Sources consulted

- Chrome manifest `description` field: https://developer.chrome.com/docs/extensions/mv3/manifest/description
- Apple, Packaging a web extension for Safari: https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari
- Apple, Running your Safari web extension: https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension
- Userscripts for Safari: https://github.com/quoid/userscripts
- PriceCharting's own `/js/market_ae.js` (read-only inspection of `add_to_collection`, `implement_cancel_bid`, `preference_get`)
