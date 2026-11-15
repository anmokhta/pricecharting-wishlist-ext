# Wishlist Grid View for PriceCharting

A Chrome extension (Manifest V3) that fixes and extends the [PriceCharting](https://www.pricecharting.com) wishlist page: correct price sorting across the whole wishlist, a card grid view, search, running totals, Select/Exclude pick lists, and a one-step "Move to collection".

It is content-script only: no background worker, no popup, and no declared permissions. It only runs on `https://www.pricecharting.com/wishlist*`.

> Not affiliated with or endorsed by PriceCharting.

---

## Features

| Feature | What it does |
|---|---|
| **Whole-wishlist price sort** | PriceCharting sorts each 200-item page on its own, so "Low to high" restarts on page 2. The extension loads every page up front and re-sorts the entire list when the sort is *Lowest price* or *Highest price*. Items without a price go last. |
| **Grid / list toggle** | Two icons next to the sort/filter controls switch between the site's table and a card grid with larger (240px) images. Your choice is remembered. |
| **Count and total value** | A blue box above the list always shows the number of items and their combined value, plus how many have no price. While pages load it shows progress; if a page fails it shows a **Retry** button. The yellow Select/Exclude panel is separate. |
| **Search** | Filter by card name or set. Every word you type must match. Press <kbd>Esc</kbd> to clear. The count and total follow the search. |
| **Select / Exclude lists** | Each card gets *Select* and *Exclude* buttons. Build a list of cards to keep (green, with its total) or cards to drop (red, with the remaining wishlist total). Only one mode is active at a time. Picks are saved per wishlist and survive reloads. |
| **Move to collection** | A button on every card, in both list and grid view (in list view it's a short **Move** button under Remove, styled to match). Adds the card to your PriceCharting collection using your default condition (by design; there is no per-card condition choice), then removes it from the wishlist. Click once to arm, again within 4 seconds to confirm. The wishlist removal only happens if the add succeeds. |
| **Usable Remove button** | The site's bare `-` button is relabeled **Remove** and stays visible in grid view. |
| **Set filter label fix** | The Set filter's placeholder says "Type part of console" (a PriceCharting leftover from video games); it's relabeled to "Type part of set". |

---

## Install

### From a release (recommended)

1. Open this repo's **Releases** (right-hand sidebar) and download the latest `pricecharting-wishlist-vX.Y.Z.zip`.
2. Unzip it. You'll get a folder containing `manifest.json`.
3. Go to `chrome://extensions` and turn on **Developer mode** (top right).
4. Click **Load unpacked** and pick the unzipped folder.
5. Open your PriceCharting wishlist.

To update, remove the old version (or replace the folder's contents) and click the reload icon on the extension's card.

### From source

```bash
git clone https://github.com/anmokhta/pricecharting-wishlist-ext.git
```

Then **Load unpacked** the `extension/` folder. After pulling changes, click reload on the extension's card in `chrome://extensions`.

### Build the zip yourself

The zip must have `manifest.json` at its root, so zip the *contents* of `extension/`:

```bash
cd extension && zip -r ../pricecharting-wishlist.zip . -x '.*' && cd ..
```

---

## Repository layout

```
extension/                  Everything that ships in the extension
  manifest.json             MV3 manifest (the version number lives here)
  content.js                All behavior, one IIFE, no dependencies
  content.css               Grid layout and extension UI styles
  icon16/48/128.png         Original artwork
docs/
  technical-summary.md      Deep dive: DOM model, architecture, testing, history
  debug-session-summary.md  Root-cause write-up of the "bare rows" bug fixed in 1.4.1
  privacy-policy.md         Privacy policy (published copy: see ROADMAP, Chrome Web Store item)
test/
  extension.spec.js         Automated end-to-end tests (Playwright)
  fixtures.js               Fake wishlist pages shared by the tests and the mockup
  mockup.html               Manual mockup page for trying changes in a browser
  serve.js                  Tiny static server for the mockup
screencaps/                 Chrome Web Store screenshots (originals + 1280x800/ upload copies)
.github/workflows/ci.yml    Runs the tests; on main, builds the zip and publishes a Release
ROADMAP.md                  Planned work, backlog, and completed work (developer detail)
CHANGELOG.md                User-facing release notes for every version
scripts/release-notes.js    Prints a version's CHANGELOG notes; CI uses it
```

---

## How it works

### Startup

`content.js` runs at `document_idle` and exits immediately unless the page has `table#active` and `select[name=sort]`, so it's inert anywhere else. In order, it:

1. Relabels the Set filter placeholder.
2. Adds the grid/list toggle and applies the saved view (works before the rest of the list has loaded).
3. Relabels Remove buttons, inserts the search box, the blue totals box and the pick panel.
4. Runs `loadAll()`, then `enhanceRows()`: `purgeSiteRows()` → `sortRows()` → image upgrade → relabel → pick buttons → move buttons → pick UI → search. Every step is safe to repeat.
5. Starts a `MutationObserver` on the table body. Any wishlist row added later (by the site or anything else) triggers `enhanceRows()` again, so it gets the same buttons and is sorted into place.

### Loading every page

PriceCharting's wishlist is paginated server-side, 200 items per page, using an opaque cursor in `tr.offers-paging form.next_page input[name=cursor]`. `loadAll()` POSTs `cursor=<value>` back to the same URL, parses each response with `DOMParser`, and imports the `tr.item` / `tr.item-details` rows. It stops when no cursor comes back, the cursor repeats, or after 100 pages. A card that comes back on a second page (same row id) is skipped along with its details row.

The site also has its own infinite scroll that fetches the next page when you near the bottom. To avoid both loaders racing (which produced duplicate, featureless "bare" rows in 1.4.0), the extension removes the paging row at startup so the site has nothing to fetch, and `purgeSiteRows()` drops any class-less row that has a real twin. The paging row is never put back: once the site's loader finds it missing, it switches itself off for good. If a page fails to load, the extension keeps what it has and shows a **Retry** button in the totals box that resumes from the page that failed. See [docs/debug-session-summary.md](docs/debug-session-summary.md).

### Grid view

No markup is rebuilt. Adding `pcw-grid` to the table turns `<tbody>` into a CSS grid and each `tr.item` into a flex card, so the site's own jQuery handlers (Remove, etc.) keep working. Thumbnails swap from `/60.jpg` to `/240.jpg` with a fallback on error.

### Move to collection

Mirrors the site's own "In One Click" add:

```
POST /api/offer-publish?product=<id>&add-to-collection=on&max-price=0&condition-id=<default>
```

The condition comes from `localStorage['prefs.DefaultCondition']` (falls back to `1`). On `res.ok`, it clicks the row's native Remove button so the site handles the wishlist removal itself. Add-then-remove ordering means a failure can leave a card in both places but never lose it. Confirmed working on the live site (2026-11-15): the card lands in the Collection tab and leaves the wishlist.

### Network and storage

All requests are same-origin from the page, using your existing PriceCharting session:

| Request | When |
|---|---|
| `POST <wishlist URL>` with `cursor` | On load, once per extra page |
| `POST /api/offer-publish?…add-to-collection=on…` | When you confirm a Move |
| `POST /api/remove-wishlist` (via the site's handler) | After a successful add |

| `localStorage` key | Contents |
|---|---|
| `pcw-view` | `grid` or `list` |
| `pcw-picks-<user>` | `{ mode, ids[] }` for the current pick list |
| `pcw-debug` | Optional; set to `1` by hand to log per-page row and duplicate counts to the console |

Nothing is sent anywhere other than pricecharting.com.

### Selectors the extension depends on

If PriceCharting changes its markup, these are what break first: `table#active` with one `<tbody>`; rows `tr.item#bid-<id>` with `data-product`, each followed by `tr.item-details`; cells `td.expand` (with `input.js-cancel-bid`), `td.photo`, `td.meta p.title a`, `td.price .js-price`; and `tr.offers-paging form.next_page input[name=cursor]`.

---

## Known issues

- The item count has been seen to differ by one or two from PriceCharting's header. Duplicate cards across pages are now skipped; to investigate any remaining gap, run `localStorage.setItem('pcw-debug', '1')` in the page's console and reload.

More detail in [docs/technical-summary.md](docs/technical-summary.md) and the backlog in [ROADMAP.md](ROADMAP.md).

---

## Testing

```bash
npm install
npx playwright install chromium
npm test
```

The tests in [test/extension.spec.js](test/extension.spec.js) load the real unpacked extension into headless Chromium and answer every `www.pricecharting.com` request with fake pages from [test/fixtures.js](test/fixtures.js), so nothing touches the real site or your account. They cover loading and sorting, duplicate skipping, Retry, late rows, grid view, search, Select/Exclude, and Move to collection in both views (confirm, auto-reset, success and failure).

To click around by hand, run `npm run mockup` and open http://localhost:4173/. That page runs the extension's code against the same fake data and has buttons to inject a late card or a duplicate row. Add `?fail=1` to make page 3 fail once.

---

## Releasing

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull request. It first checks that [CHANGELOG.md](CHANGELOG.md) has notes for the version in `extension/manifest.json`, then runs the tests. On a push to `main`, once both pass, it:

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
