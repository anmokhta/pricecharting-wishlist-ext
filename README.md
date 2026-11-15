# Wishlist Grid View for PriceCharting

A Chrome extension (Manifest V3) that fixes and extends the [PriceCharting](https://www.pricecharting.com) wishlist page: correct price sorting across the whole wishlist, a card grid view, search, running totals, pick lists with CSV export, and a one-step "Move to collection".

It is content-script only: no background worker, no popup, and no declared permissions. It only runs on `https://www.pricecharting.com/wishlist*`.

> Not affiliated with or endorsed by PriceCharting.

---

## Features

| Feature | What it does |
|---|---|
| **Whole-wishlist price sort** | PriceCharting sorts each 200-item page on its own, so "Low to high" restarts on page 2. The extension loads every page up front and re-sorts the entire list when the sort is *Lowest price* or *Highest price*. Items without a price go last. |
| **Grid / list toggle** | Two icons next to the sort/filter controls switch between the site's table and a card grid with larger (240px) images. Your choice is remembered. |
| **Count and total value** | A banner above the list shows the number of items and their combined value, plus how many have no price. |
| **Search** | Filter by card name or set. Every word you type must match. Press <kbd>Esc</kbd> to clear. The count and total follow the search. |
| **Select / Exclude lists** | Each card gets *Select* and *Exclude* buttons. Build a list of cards to keep (green, with its total) or cards to drop (red, with the remaining wishlist total). Only one mode is active at a time. Picks are saved per wishlist and survive reloads. |
| **Export CSV** | Downloads the current pick list as `wishlist-selected-YYYY-MM-DD.csv` or `wishlist-excluded-YYYY-MM-DD.csv`, with summary totals. |
| **Move to collection** *(grid view)* | Adds the card to your PriceCharting collection using your default condition, then removes it from the wishlist. Click once to arm, again within 4 seconds to confirm. The wishlist removal only happens if the add succeeds. |
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
.github/workflows/release.yml   Builds the zip and publishes a GitHub Release
ROADMAP.md                  Planned work and backlog
```

---

## How it works

### Startup

`content.js` runs at `document_idle` and exits immediately unless the page has `table#active` and `select[name=sort]`, so it's inert anywhere else. In order, it:

1. Relabels the Set filter placeholder.
2. Adds the grid/list toggle and applies the saved view (works before the rest of the list has loaded).
3. Relabels Remove buttons, inserts the summary, status, pick panel and search box.
4. Runs `loadAll()`; on success: `purgeSiteRows()` → `sortRows()` → image upgrade → relabel → pick buttons → move buttons → pick UI → search.

### Loading every page

PriceCharting's wishlist is paginated server-side, 200 items per page, using an opaque cursor in `tr.offers-paging form.next_page input[name=cursor]`. `loadAll()` POSTs `cursor=<value>` back to the same URL, parses each response with `DOMParser`, and imports the `tr.item` / `tr.item-details` rows. It stops when no cursor comes back, the cursor repeats, or after 100 pages.

The site also has its own infinite scroll that fetches the next page when you near the bottom. To avoid both loaders racing (which produced duplicate, featureless "bare" rows in 1.4.0), the extension removes the paging row at startup so the site has nothing to fetch, and `purgeSiteRows()` drops any class-less row that has a real twin. If the extension's load fails, the paging row is put back so the site's scrolling still works. See [docs/debug-session-summary.md](docs/debug-session-summary.md).

### Grid view

No markup is rebuilt. Adding `pcw-grid` to the table turns `<tbody>` into a CSS grid and each `tr.item` into a flex card, so the site's own jQuery handlers (Remove, etc.) keep working. Thumbnails swap from `/60.jpg` to `/240.jpg` with a fallback on error.

### Move to collection

Mirrors the site's own "In One Click" add:

```
POST /api/offer-publish?product=<id>&add-to-collection=on&max-price=0&condition-id=<default>
```

The condition comes from `localStorage['prefs.DefaultCondition']` (falls back to `1`). On `res.ok`, it clicks the row's native Remove button so the site handles the wishlist removal itself. Add-then-remove ordering means a failure can leave a card in both places but never lose it.

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

Nothing is sent anywhere other than pricecharting.com.

### Selectors the extension depends on

If PriceCharting changes its markup, these are what break first: `table#active` with one `<tbody>`; rows `tr.item#bid-<id>` with `data-product`, each followed by `tr.item-details`; cells `td.expand` (with `input.js-cancel-bid`), `td.photo`, `td.meta p.title a`, `td.price .js-price`; and `tr.offers-paging form.next_page input[name=cursor]`.

---

## Known issues

- **Move to collection** has not yet been confirmed against the live API; try it first on a card you don't mind moving and check your Collection tab. It always uses your default condition, and only appears in grid view.
- The item count can differ by one or two from PriceCharting's header (cause unresolved).
- If loading all pages fails, the fallback path skips the image upgrade and Remove relabel.

More detail in [docs/technical-summary.md](docs/technical-summary.md) and the backlog in [ROADMAP.md](ROADMAP.md).

---

## Releasing

Every push to `main` that touches `extension/` runs [`.github/workflows/release.yml`](.github/workflows/release.yml), which:

1. Reads `version` from `extension/manifest.json`.
2. Zips the contents of `extension/` into `pricecharting-wishlist-v<version>.zip`.
3. Publishes it to the GitHub Release tagged `v<version>`, creating the release if it's new or replacing the zip if it already exists.

So: **bump `version` in `extension/manifest.json` for a new release**; pushes without a bump refresh the current release's zip. The workflow can also be run manually from the Actions tab. Zips are never committed to the repo.
