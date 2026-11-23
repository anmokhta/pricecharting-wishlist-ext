# Chrome Web Store listing, 1.4.8 (draft)

Text to paste into the dashboard when 1.4.8 is submitted. It replaces [../public/store-listing.md](../public/store-listing.md); once 1.4.8 is submitted, move this text there and delete this draft.

## What changes from the live listing

- **Name, summary and icon** change automatically from the manifest (1.4.7 renamed it to "Wishlist+ for PriceCharting" and added the new icon).
- **Description:** new name, the "whole wishlist" wording, and new bullets for shift-click ranges, "Show only" / "Hide excluded", and the faster search box.
- **Images:** upload the new art from `design/current/store-listing/`: the 1400×560 marquee promo tile and screenshots 1–4. Slot 5 (Move to collection) still needs a capture.
- **Single purpose:** adds the pick filters and range selection.
- **Test instructions:** steps 5–6 cover shift-click and the filters.
- **Unchanged:** category, permission justification, remote code, data usage and certifications, privacy policy URL. The privacy policy itself needs no change: the new filter and the shift-click anchor aren't saved anywhere.

## Store listing tab

**Summary** (manifest `description`, 132 characters):

> Loads your whole wishlist so price sorting covers every item. Adds grid view, search, totals, Select/Exclude and move-to-collection.

**Description:**

> Wishlist+ for PriceCharting makes your PriceCharting.com wishlist easier to browse, sort and manage.
>
> PriceCharting shows your wishlist 200 items at a time, so sorting only ever covers the page you're on. Wishlist+ loads your entire wishlist onto one page, so price sorting covers every item, then adds tools the wishlist page doesn't have.
>
> FEATURES
>
> • Your whole wishlist on one page: every item loads, so "Price: high to low" and "low to high" cover all of it. Cards without a price go last.
> • Grid view: switch between the normal list and a card grid with larger images, using the icons next to the filters. Your choice is remembered.
> • Totals at a glance: a box at the top always shows how many cards are on your wishlist and their combined value.
> • Search: filter by card name or set. Every word you type must match, and the totals update to match. Press Esc to clear.
> • Select / Exclude: mark cards green to build a list and see its total, or mark cards red to see what the rest of your wishlist is worth. Picks are remembered between visits.
> • Select a range: click Select (or Exclude) on one card, then hold Shift and click another. Every card in between is picked too, and holding Shift previews which cards will change.
> • Show only what you picked: show only your selected or excluded cards to review them, or hide the excluded ones to see what's left.
> • Move to collection: move a card from your wishlist to your collection with one button: click once, then again to confirm. It uses your PriceCharting default condition and only removes the card from your wishlist if the add succeeds.
> • Small fixes: the tiny "-" button is relabeled "Remove", and the Set filter's leftover "Type part of console" hint now reads "Type part of set".
>
> HOW TO USE
>
> Sign in to PriceCharting and open your wishlist (Collection → Wishlist). Wishlist+ starts automatically.
>
> PRIVACY
>
> Wishlist+ runs only on PriceCharting wishlist pages and requests no browser permissions. Everything happens in your browser. It talks only to PriceCharting.com, using your existing sign-in, and sends nothing to the developer or anyone else. No analytics, tracking or ads. Your view setting and Select/Exclude picks are stored only in your browser.
>
> This is an independent project, not affiliated with or endorsed by PriceCharting.

**Category:** Functionality & UI (unchanged)

## Privacy practices tab

**Single purpose description:**

> Improves the PriceCharting.com wishlist page: loads the whole wishlist so it can be sorted by price across all pages, and adds a grid view, search, item and value totals, Select/Exclude lists with range selection and filters, and a button to move a card from the wishlist to the user's PriceCharting collection.

Permission justification, remote code, data usage, certifications and privacy policy URL: unchanged, copy from [../public/store-listing.md](../public/store-listing.md).

## Test instructions (for Google's reviewers)

The test account's login is typed into the dashboard only. **Never put it in this repo.**

> **Test account (PriceCharting.com):** [email] / [password]
>
> 1. Install the extension, then sign in at https://www.pricecharting.com with the account above.
> 2. Open **Collection → Wishlist** (or https://www.pricecharting.com/wishlist).
> 3. The extension loads the whole wishlist and shows a blue box with the total item count and value. With "Price: high to low" selected, every card is sorted by price.
> 4. Use the grid/list icons next to the filters to switch views. The search box filters by card name or set.
> 5. Click **Select** or **Exclude** on a card, then hold **Shift**: the cards between it and the pointer are outlined. Shift-click another card's button to pick the whole range. A yellow panel shows the running total.
> 6. In the yellow panel, click **Show only selected** (or, in Exclude mode, **Show only excluded** / **Hide excluded**), then **Show all**. Click **Clear** to reset.
> 7. **Move** (list view) / **Move to collection** (grid view): click once, then again to confirm. The card is added to the account's collection and removed from the wishlist. Feel free to try it; the account exists only for review.
> 8. The extension requests no permissions and only runs on pricecharting.com/wishlist pages.
