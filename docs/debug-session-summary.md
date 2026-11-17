# Debug Session Summary: "Bare rows" bug in Wishlist+ for PriceCharting (v1.4.0 → v1.4.1)

Handoff document for a new agent. It covers the problem, the investigation, the root cause, the code changes, what is verified versus unverified, and what is still open.

Related background doc: `wishlist-grid-view-technical-summary.md` (the user uploaded it at the start; it describes the whole extension through v1.4.0). This file only covers what happened in this conversation.

---

## 1. Context

- **Project:** a Chrome extension (Manifest V3), "Wishlist+ for PriceCharting" (then called "Wishlist Grid View for PriceCharting"). It is content-script-only, with no background worker, no popup and no permissions. It runs on `https://www.pricecharting.com/wishlist*`.
- **Files:** `manifest.json`, `content.js` (a single IIFE), `content.css`, and three icons.
- **What it does:** loads every wishlist page and sorts globally by price, adds a grid/list toggle, a count and total, Select/Exclude pick lists with CSV export, a search box, and a grid-view-only "Move to collection" button.
- **User:** the extension's owner, who had it installed in Chrome and was on their own wishlist page (`/wishlist`), sorted `highest-price`.
- **Environment:** Claude in Chrome side panel, which gave live access to the user's tab. I also had a cloud sandbox for editing files.

## 2. The reported problem

The user sent a screenshot and asked why the top three items on the page had no extension features. Those items were Galarian Moltres, Natu #55 and Professor Laventon. They showed:

- the old site-style layout, with the photo first, then the title, price and a tiny blue `-` Remove button
- no Select/Exclude buttons, no Move button, no `▼` expander on the left, and no Watchtower cells

The cards just below them (Eevee $870.49, Gyarados $452.12, Charizard ex $294.99) were rendered normally.

This matched **open item #2** in the technical summary ("Unexplained bare rows"). That item listed a leading hypothesis (rows inserted after the extension's pass, or stale extension state), but it was unconfirmed and had never been reproduced.

The user later corrected my framing in two ways:

- There are more than three bare cards.
- The cards came from PriceCharting, not from the extension.

Both turned out to be right.

## 3. Investigation (live DOM, via Claude in Chrome)

All inspection was read-only. I used `javascript_tool` for DOM queries and `fetch` calls. The only requests were GETs of the wishlist and one cursor POST, the same request the extension itself makes. The tool output filter blocks `?`, `=` and `&` in results, so I sanitized output with `.replace(/[?=&]/g,'_')`.

Findings, in order:

1. **`tr.item` rows were fine.** There were 329 `tr.item` rows and every one had `.pcw-pick-actions` and `.pcw-move`. The extension's summary read "329 wishlist items · Total value: $10,808.38".
2. **The three cards had a second, class-less copy.** Searching by name found each card twice:
   - the real `tr.item`, at DOM positions ~317, 318 and 328 among `tr.item` rows
   - a bare `<tr id="bid-…" data-product="…">` with no class and cells `photo | meta | price | cancel`
3. **There were 129 bare rows, not three.**
   - They sat at tbody child indices 3–131, directly after the column-header row.
   - All 129 had a real twin with the same `id`.
   - They were sorted high to low on their own, from Gyarados ($452.12) down to Professor Laventon ($0.05).
   - The user's screenshot was scrolled to the end of this block, so the "top three" were really the last three bare rows, just above the first real row (Eevee). That is why they looked like they were at the top.
4. **129 = 329 − 200.** PriceCharting pages 200 items at a time, so the bare block is exactly page 2.
5. **The server did not send the bare rows.** A fresh GET of `/wishlist` had 200 items in `tr.item` format with no bare rows. A cursor POST (the extension's own request) returned 129 `.item` rows and no bare rows.
6. **Searching `market_ae.js` (the site's script) found the source.** I read it in place and did not modify it.
   - A Hogan template, `templates["wishlist-item"]`, renders `<tr id="bid-{{id}}">` with `td.photo`, `td.meta`, `td.price` and `<td class="cancel"><input value="-" class="small blue button js-cancel-bid">`. This is the bare layout.
   - `getNewWishlist(data)` renders that template for each bid and does `$(html).insertBefore(paging)`. Here `paging = $('.js-offers .selling_table').find('tr.offers-paging').first()`.
   - It is called through `displayData(data)` from `fetch_next()`.
   - **Infinite scroll:** `implement_infinite_scrolling()` binds `$(window).on('scroll', on_scroll)`. `on_scroll` calls `fetch_next()` whenever `scrollTop + innerHeight >= height - 700`, unless `is_fetching_more_pages` is set. `fetch_next()` looks up `$('.offers-paging form.next_page')`. If none exists it calls `infinite_scrolling_is_done()` and returns. Otherwise it fetches the next page with that form's cursor.

## 4. Root cause (a race with the site's own infinite scroll)

I derived this from the code and DOM evidence above. I did not capture the race happening live.

1. At `document_idle` the extension starts `loadAll()`. It reads the cursor from `tr.offers-paging` and fetches the remaining pages. It only removes the paging row after all pages finish.
2. The page is only 200 rows tall at that point. Any scroll near the bottom, or a short page on load, makes the site's own `on_scroll → fetch_next()` fire. It finds the still-present `form.next_page` and fetches page 2.
3. The site injects page 2 as bare rows before the paging row.
4. The extension's own page-2 fetch also succeeds, and its `.item` rows are inserted before the same anchor.
5. `sortRows()` re-inserts only `tr.item` and `tr.item-details` rows. It calls `insertBefore(x, anchor)`, and `anchor` is `null` because the paging row was already removed, so those rows are appended at the end. The class-less bare rows are not touched. They end up at the top of the table, above all real rows.
6. Every extension feature selects `tr.item` (summary, picks, move buttons, relabel, search, upgrade images). Class-less rows match none of those selectors, so they were never processed.

**Why it looked timing-dependent:** it only happens if the site's scroll handler fires before the extension removes the paging row. That is why the user's tab showed it and the assistant's own tabs, which were never scrolled, did not.

**Why totals were not wrong:** the summary counts only `tr.item`, so the 129 bare rows were not double-counted. The pollution was visual and functional (no buttons), not numerical.

**Ruled out:** the extension code never creates class-less rows, and the old hypothesis ("stale extension state") is not needed.

## 5. Changes made

The user uploaded `pricecharting-wishlist-fix 2.zip`. It was v1.4.0 and had the same content as the technical summary describes. I unpacked it to a scratchpad folder (`.../scratchpad/ext/`), edited it, and re-zipped it.

**Deliverable:** `pricecharting-wishlist-fix-1.4.1.zip`. It holds `manifest.json`, `content.js`, `content.css` and the three icons, and was delivered to `/mnt/user-data/outputs/`.

### manifest.json
- `version`: `1.4.0` → `1.4.1`. Nothing else changed.

### content.js

All changes sit just above `loadAll()` and in the startup `.then`/`.catch` chain.

**(a) Detach the paging row at startup, so the site's scroll handler has nothing to fetch.**

```js
const initialCursor = cursorIn(tbody);
const detachedPaging = pagingRow();
detachedPaging?.remove();
```

With no `form.next_page` in the DOM, the site's `fetch_next()` hits its `form.length == 0` branch and calls `infinite_scrolling_is_done()`. Any in-flight site request that returns later runs `insertBefore` on an empty jQuery set, which inserts nothing.

**(b) `loadAll()` uses the saved cursor and no longer removes the paging row at the end.**

- `let cursor = initialCursor;` replaces `let cursor = cursorIn(tbody);`.
- The trailing `pagingRow()?.remove();` was deleted, since the row is already gone.
- The anchor logic (`insertBefore(..., pagingRow())`) now has `null` as the anchor, so rows append. The order of item and item-details pairs is preserved.

**(c) `purgeSiteRows()` is a safety net that removes only true duplicates.** The first version removed every class-less `bid-…` row. The user then asked that cleanup remove only duplicates and nothing important. The final version is:

```js
function purgeSiteRows() {
  const realIds = new Set([...tbody.querySelectorAll(':scope > tr.item')].map((r) => r.id));
  tbody.querySelectorAll(':scope > tr[id^="bid-"]:not(.item)').forEach((r) => {
    if (realIds.has(r.id)) r.remove();
  });
}
```

- It removes a class-less row only when a real `tr.item` with the same `id` exists.
- A class-less row with no twin is kept, so no card can disappear.
- It only looks at direct children of the tbody, and only at ids starting with `bid-`, so headers, `item-details` rows and anything else are safe.
- It is called as the first step of the success `.then` (before `sortRows()`).
- **Dry run on the live page:** 129 candidates, 129 would be removed (all with twins), 0 kept.

**(d) The failure path hands pagination back to the site.** In the `.catch`:

```js
if (detachedPaging && !pagingRow()) tbody.appendChild(detachedPaging);
```

If the extension's own load fails, the paging row goes back so the site's scrolling can still load the rest.

### Unchanged
`content.css` and the icons were not modified.

## 6. Verification status

**Verified**
- `node --check content.js` passes (syntax only).
- The live DOM facts in section 3 were all measured on the user's open tab.
- The dry-run check of the duplicate-only rule gave 129 / 129 / 0 as above.
- The site's code paths (`on_scroll`, `fetch_next`, `getNewWishlist`, the `wishlist-item` template) were read directly from `/js/market_ae.js`.

**Not verified**
- The new build was **never run as an installed extension in Chrome**. The sandbox cannot load an unpacked extension into the user's browser, and the user's installed copy is the old version.
- The race itself was not reproduced live. The causal chain in section 4 is inferred from the code and the DOM state.
- I did not check that `infinite_scrolling_is_done()` has no side effects the page needs. I only confirmed it is the branch `fetch_next()` takes when no paging form exists.
- I did not test the `.catch` path (re-attaching the paging row).

**Suggested test:** remove the old extension and load the unpacked v1.4.1 folder. Then reload the wishlist while scrolling to the bottom quickly. Expected: the first row is the most expensive card (Eevee, $870.49 in the user's data), every row has Select/Exclude, and the count stays at the real total (329 at the time).

## 7. Still open (from the technical summary, not addressed here)

- Move to collection has never run against the real API. Test it on a card you don't mind moving.
- Item-count drift: the page and raw paginated fetches have disagreed by a couple of items. The cause is unresolved. The page showed 329 items in this session.
- Optional hardening: a `MutationObserver` on the tbody that re-runs relabel, pick and move button insertion, and the summary, for any row that arrives late. The detach-paging fix removes the known source of late rows, but an observer would cover unknown ones.
- The `.catch` path still skips `upgradeImages` and `relabelRemoveButtons`.
- The privacy policy and store text are stale (picks, search, move). The policy needs updating before Chrome Web Store submission.
- Safari/iOS work is still planned and not started.

## 8. Notes for the next agent

- **User preference:** do not state unverified things as fact. Search or inspect for evidence before claiming something. I tried to follow this by inspecting the live DOM and the site's script before explaining.
- **Tool quirks:** the Chrome tool output filter blocks query-string-like text, so sanitize results. Chrome's `type` action did not reach the search input in earlier sessions, so tests fire `input` events programmatically.
- **Do not modify the live site's scripts.** All reading of `market_ae.js` was a read-only `fetch`.
- **Any new feature that adds rows must use `tr.item` selectors or it will miss rows.** Rows from other sources, such as the site's `wishlist-item` template, are class-less.
- **The site's own selectors:** table `table#active.selling_table` (inside `.js-offers`), rows `tr.item#bid-<id>` with `data-product`, paired `tr.item-details`, paging row `tr.offers-paging` containing `form.next_page input[name=cursor]`.
