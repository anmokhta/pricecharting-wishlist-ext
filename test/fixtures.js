// Fake PriceCharting wishlist markup, shaped like the real page's table.
// Used by the Playwright tests (Node, via require) and by test/mockup.html
// (browser, via a plain <script> tag that exposes window.PCWFixtures).
(function (root) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  // A wishlist card: tr.item plus its paired tr.item-details row.
  function itemRow({ id, name, set = 'Base Set', price }) {
    const priceText = price == null ? '' : '$' + Number(price).toLocaleString('en-US', { minimumFractionDigits: 2 });
    return (
      `<tr class="item" id="bid-${id}" data-product="${id}" data-id="${id}">` +
      '<td class="expand">' +
      '<input type="button" class="js-expand-bid" value="▼">' +
      '<input type="button" class="js-shrink-bid" value="▲">' +
      '<input type="button" class="small blue button js-cancel-bid" value="-">' +
      '</td>' +
      `<td class="photo"><div><img alt="" src="/img/${id}/60.jpg"></div></td>` +
      `<td class="meta"><p class="title"><a href="#">${esc(name)}</a> ${esc(set)}</p></td>` +
      `<td class="price"><span class="js-price">${priceText}</span></td>` +
      '<td class="watchtower">w</td>' +
      '</tr>' +
      `<tr class="item-details" id="details-${id}"><td colspan="5">details for ${id}</td></tr>`
    );
  }

  // What the site's own infinite scroll injects: no class, different cells.
  function siteRow({ id, name, set = 'Base Set', price }) {
    return (
      `<tr id="bid-${id}" data-product="${id}">` +
      `<td class="photo"></td><td class="meta"><p class="title"><a href="#">${esc(name)}</a> ${esc(set)}</p></td>` +
      `<td class="price">$${price}</td>` +
      '<td class="cancel"><input value="-" class="small blue button js-cancel-bid"></td>' +
      '</tr>'
    );
  }

  const pagingRow = (cursor) =>
    cursor
      ? '<tr class="gap offers-paging"><td colspan="5"><form class="next_page">' +
        `<input type="hidden" name="cursor" value="${esc(cursor)}"></form></td></tr>`
      : '';

  // Rows for one page (initial page or a cursor POST response).
  const tbodyHtml = (items, cursor) =>
    '<tr class="watchtower-headers"><th colspan="5">headers</th></tr>' +
    items.map(itemRow).join('') +
    pagingRow(cursor);

  // A whole wishlist document, as returned for GET /wishlist or a cursor POST.
  function wishlistDocument({ items, cursor = null, sort = 'highest-price' }) {
    const opt = (v, label) => `<option value="${v}"${v === sort ? ' selected' : ''}>${label}</option>`;
    return (
      '<!doctype html><html><head><meta charset="utf-8"><title>Wishlist</title></head><body>' +
      '<form class="sort-form">' +
      '<select name="sort">' +
      opt('name', 'Name') + opt('lowest-price', 'Lowest price') + opt('highest-price', 'Highest price') +
      opt('newest', 'Newest') + opt('oldest', 'Oldest') +
      '</select>' +
      '<select name="category"><option>Pokemon Cards</option></select>' +
      '<input type="text" placeholder="Type part of console">' +
      '</form>' +
      '<div class="js-offers">' +
      `<table id="active" class="selling_table"><tbody>${tbodyHtml(items, cursor)}</tbody></table>` +
      '</div>' +
      '</body></html>'
    );
  }

  // Default three-page scenario. Page 2 repeats Charmander from page 1, the way
  // cursor paging can when prices tie at a page boundary.
  const scenario = {
    page1: [
      { id: 1, name: 'Bulbasaur', price: 10 },
      { id: 2, name: 'Squirtle', price: 30 },
      { id: 3, name: 'Charmander', price: 50 }
    ],
    page2: [
      { id: 3, name: 'Charmander', price: 50 },
      { id: 4, name: 'Pikachu', set: 'Jungle', price: 5 },
      { id: 5, name: 'Mew', set: 'Promo', price: 120 }
    ],
    page3: [
      { id: 6, name: 'Eevee', set: 'Fossil', price: 870.49 },
      { id: 7, name: 'Unpriced Promo', set: 'Promo', price: null }
    ]
  };

  const api = { itemRow, siteRow, pagingRow, tbodyHtml, wishlistDocument, scenario };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PCWFixtures = api;
})(typeof window !== 'undefined' ? window : globalThis);
