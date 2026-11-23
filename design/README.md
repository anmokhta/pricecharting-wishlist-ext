# Design

All images and artwork for Wishlist+ for PriceCharting. Nothing in this folder ships in the extension; the icons the extension uses are copied into `extension/`.

## current/ — what's in use

| Folder | What's in it |
|---|---|
| `icon/` | The extension icon. `icon.svg` is the master (48 px and up), `icon-small.svg` is the simplified 16/32 px version, `icon-128.svg` adds the store's transparent margin. The PNGs are the exact files in `extension/`. `sheet.png` previews every size on light and dark. |
| `store-listing/` | Ready-to-upload Chrome Web Store art: `promo-tile-1400x560.png` (marquee promo tile), `small-promo-tile-440x280.png` (small promo tile) and `screenshot-1…4-*.png` (1280×800). |
| `source/canvas/` | The store art's source, copied from the Design canvas (one `.dc.html` per image, plus `canvas.json`). |
| `source/crops/` | The cropped interface images the canvas uses. |
| `source/captures/` | The original full-resolution screen captures (test account). The crops are cut from these. |
| `source/make_shots.py` | Re-cuts `crops/` from `captures/` (skipping the browser window's frame). |
| `source/export.js` | Renders `canvas/` to the PNGs in `store-listing/`. |

To rebuild the store PNGs after changing the canvas, copy its files into `source/canvas/`, then:

```bash
node design/current/source/export.js
```

If the canvas uses a newly uploaded image, add its upload id and local file to `BLOBS` in `export.js`.

## drafts/ — earlier versions

| Folder | What's in it |
|---|---|
| `icon-concepts/` | Icon concept rounds: `batch1` (three card + plus ideas) and `batch2` (three variations of the chosen one, A2-stack won). `make_sheet.py` builds the preview sheets. |
| `store-listing-v1/` | The first store screenshots (plain page captures), live on the store until the new art is uploaded. |
| `store-art-drafts/` | Unused pieces: the short Select/Exclude crops (draft 1 of screenshot 3) and the first export of the promo tile. |
