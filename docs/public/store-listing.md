# Chrome Web Store listing (live)

The listing for **1.4.6**, the version live on the [store](https://chromewebstore.google.com/detail/opfopmnimlhgjgnoegkghpdpdgabjhcf). At that point the extension was still called "Wishlist Grid View for PriceCharting". The store's name, summary and icon come from `extension/manifest.json`; everything else here is pasted into the dashboard by hand.

The dashboard is the source of truth. If it was edited there, copy the change back here. The next version's text is in [../drafts/](../drafts/).

## Store listing tab

**Summary** (from the manifest `description`, 132 characters max):

> Sorts your whole PriceCharting wishlist by price, adds grid view, search, totals, Select/Exclude lists, and move-to-collection.

**Description** (copied from the live listing on 2026-11-22):

> THIS IS AN INDEPENDENT PROJECT, NOT AFFILIATED WITH OR ENDORSED BY PRICECHARTING
>
>
> Wishlist Grid View for PriceCharting makes your PriceCharting.com wishlist easier to browse, sort and manage.
>
> Currently, PriceCharting shows your wishlist 200 items at a time and sorts each 'page' separately (even though the wishlist is one infinite scrolling page), so “Price: low to high” starts over on every page. This extension loads your entire wishlist and sorts all of it at once, then adds tools the wishlist page doesn’t have.
>
> FEATURES
> • Whole-wishlist price sort: Sorting now sorts every card, not just within intervals of 200 items. Items without a price go last.
> • Grid view: switch between the normal list and a grid view with larger images, using the icons next to the filters. Your choice is remembered.
> • Totals at a glance: a box at the top always shows how many items are in your wishlist and their combined value.
> • Search: filter by card name or set. Every word you type must match, and the totals update to match. Press Esc to clear.
> • Select / Exclude: mark cards green to build a list and see its total, or mark car red to see what the rest of your wishlist is worth. Picks are remembered between visits.
> • Move to collection: move a card from your wishlist to your collection with one button: click once, then again to confirm. It uses your PriceCharting default condition and only removes the card from your wishlist if the add succeeds.
> • Small fixes: the tiny “-” button is relabeled “Remove”, and the Set filter’s leftover “Type part of console” hint now reads “Type part of set”.
>
> HOW TO USE
> Sign in to PriceCharting and open your wishlist (Collection → Wishlist). The extension starts automatically.
>
> PRIVACY
> The extension runs only on PriceCharting wishlist pages and requests no browser permissions. Everything happens in your browser. It talks only to PriceCharting.com, using your existing sign-in, and sends nothing to the developer or anyone else. No analytics, tracking or ads. Your view setting and Select/Exclude picks are stored only in your browser.

**Category:** Functionality & UI

**Images:** the plain 1280×800 screenshots in `design/drafts/store-listing-v1/`. The new art in `design/current/store-listing/` isn't uploaded yet.

## Privacy practices tab

**Single purpose description:**

> Improves the PriceCharting.com wishlist page: loads the whole wishlist so it can be sorted by price across all pages, and adds a grid view, search, item and value totals, Select/Exclude running totals, and a button to move a card from the wishlist to the user's PriceCharting collection.

**Permission justification.** The manifest requests no `permissions` or `host_permissions`. If the dashboard asks about host access for the content script:

> **Host access (content script on https://www.pricecharting.com/wishlist\*):** The extension only works on the PriceCharting wishlist page. It needs to run there to read the wishlist (card names, sets, prices) in order to sort, total, search and lay it out as a grid, and to add its buttons. It runs on no other pages or sites.

**Remote code:** "No, I am not using remote code." All JavaScript ships inside the package; nothing is loaded from elsewhere or evaluated at runtime.

**Data usage:** tick only **Website content** (card names, sets and prices are read from the page and never leave the browser). Everything else stays unticked: personally identifiable information, health, financial and payment, authentication, personal communications, location, web history, user activity.

Tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://gist.github.com/anmokhta/0dbdab84b479a030717f3584833156b9 (source: [privacy-policy.md](privacy-policy.md))

## Test instructions (for Google's reviewers)

The test account's login is typed into the dashboard only. **Never put it in this repo.**

> **Test account (PriceCharting.com):** [email] / [password]
>
> 1. Install the extension, then sign in at https://www.pricecharting.com with the account above.
> 2. Open **Collection → Wishlist** (or https://www.pricecharting.com/wishlist).
> 3. The extension loads the whole wishlist and shows a blue box with the total item count and value. With "Price: high to low" selected, every card is sorted by price.
> 4. Use the grid/list icons next to the filters to switch views. The search box filters by card name or set.
> 5. Click **Select** or **Exclude** on a few cards: a yellow panel shows the running total. Click **Clear** to reset.
> 6. **Move** (list view) / **Move to collection** (grid view): click once, then again to confirm. The card is added to the account's collection and removed from the wishlist. Feel free to try it; the account exists only for review.
> 7. The extension requests no permissions and only runs on pricecharting.com/wishlist pages.
