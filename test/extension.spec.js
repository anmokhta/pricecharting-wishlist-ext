// End-to-end tests: the real unpacked extension is loaded into Chromium, and
// every request to www.pricecharting.com is answered from test/fixtures.js,
// so nothing reaches the real site.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { test: base, expect, chromium } = require('@playwright/test');
const F = require('./fixtures');

const EXTENSION = path.resolve(__dirname, '../extension');
const WISHLIST = 'https://www.pricecharting.com/wishlist';
const GREY = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#ccc"/></svg>';

const test = base.extend({
  // One browser profile per test with the extension installed.
  context: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcw-'));
    const context = await chromium.launchPersistentContext(dir, {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`]
    });
    await use(context);
    await context.close();
    fs.rmSync(dir, { recursive: true, force: true });
  },
  page: async ({ context }, use) => {
    const page = context.pages()[0] || (await context.newPage());
    // Stand-in for the site's delegated Remove handler.
    await page.addInitScript(() => {
      window.__removed = [];
      document.addEventListener('click', (e) => {
        if (e.target.matches && e.target.matches('.js-cancel-bid')) window.__removed.push(e.target.closest('tr').id);
      });
    });
    await use(page);
  },
  // Fake pricecharting.com. Tests tweak `site` before calling site.open().
  site: async ({ page }, use) => {
    const site = {
      sort: 'highest-price',
      pages: [F.scenario.page1, F.scenario.page2, F.scenario.page3],
      failCursors: new Set(), // cursors that fail once with HTTP 500
      addStatus: 200,
      missingLarge: new Set(), // image paths that 404

      cursorsRequested: [],
      apiCalls: [],
      async open(url = WISHLIST) {
        await page.goto(url);
      },
      async loaded() {
        await expect(page.locator('.pcw-summary-note')).not.toContainText('Loading');
        await expect(page.locator('.pcw-summary-text')).toContainText('Total value');
      }
    };
    const cursorFor = (i) => (i + 1 < site.pages.length ? 'c' + (i + 2) : null);
    await page.route('https://www.pricecharting.com/**', async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname.startsWith('/api/')) {
        site.apiCalls.push(url.pathname + url.search);
        return route.fulfill({ status: url.pathname === '/api/offer-publish' ? site.addStatus : 200, body: '{}' });
      }
      if (url.pathname.startsWith('/images/')) return route.fulfill({ status: 404, body: '' });
      if (url.pathname.startsWith('/img/')) {
        if (site.missingLarge.has(url.pathname)) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: GREY });
      }
      if (url.pathname !== '/wishlist') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><p>other page</p>' });
      if (req.method() === 'POST') {
        const cursor = new URLSearchParams(req.postData() || '').get('cursor');
        site.cursorsRequested.push(cursor);
        if (site.failCursors.delete(cursor)) return route.fulfill({ status: 500, body: 'error' });
        const i = Number(cursor.slice(1)) - 1;
        return route.fulfill({ status: 200, contentType: 'text/html', body: F.wishlistDocument({ items: site.pages[i], cursor: cursorFor(i), sort: site.sort }) });
      }
      return route.fulfill({ status: 200, contentType: 'text/html', body: F.wishlistDocument({ items: site.pages[0], cursor: cursorFor(0), sort: site.sort }) });
    });
    await use(site);
  }
});

const ids = (page) => page.locator('table#active tr.item').evaluateAll((rows) => rows.map((r) => r.id));
const visibleIds = (page) => page.locator('table#active tr.item:visible').evaluateAll((rows) => rows.map((r) => r.id));

test.describe('loading and sorting', () => {
  test('loads every page and sorts the whole list high to low, unpriced last', async ({ page, site }) => {
    await site.open();
    await site.loaded();
    expect(await ids(page)).toEqual(['bid-6', 'bid-5', 'bid-3', 'bid-2', 'bid-1', 'bid-4', 'bid-7']);
    await expect(page.locator('.pcw-summary-text')).toHaveText('7 wishlist items · Total value: $1,085.49 (1 with no price)');
    await expect(page.locator('.pcw-summary-note')).toBeEmpty();
    expect(site.cursorsRequested).toEqual(['c2', 'c3']);
  });

  test('sorts low to high', async ({ page, site }) => {
    site.sort = 'lowest-price';
    await site.open();
    await site.loaded();
    expect(await ids(page)).toEqual(['bid-4', 'bid-1', 'bid-2', 'bid-3', 'bid-5', 'bid-6', 'bid-7']);
  });

  test('keeps server order for non-price sorts', async ({ page, site }) => {
    site.sort = 'name';
    await site.open();
    await site.loaded();
    expect(await ids(page)).toEqual(['bid-1', 'bid-2', 'bid-3', 'bid-4', 'bid-5', 'bid-6', 'bid-7']);
  });

  test('skips a card repeated across pages, with its details row', async ({ page, site }) => {
    await site.open();
    await site.loaded();
    await expect(page.locator('tr#bid-3')).toHaveCount(1);
    await expect(page.locator('tr#details-3')).toHaveCount(1);
  });

  test('keeps each item-details row right after its item', async ({ page, site }) => {
    await site.open();
    await site.loaded();
    const pairs = await page.locator('table#active tr.item').evaluateAll((rows) =>
      rows.map((r) => r.nextElementSibling && r.nextElementSibling.id === r.id.replace('bid-', 'details-')));
    expect(pairs.every(Boolean)).toBe(true);
  });

  test('removes the paging row so the site cannot load pages itself', async ({ page, site }) => {
    await site.open();
    await site.loaded();
    await expect(page.locator('tr.offers-paging')).toHaveCount(0);
  });

  test('on a failed page, shows Retry, which resumes from the failed page only', async ({ page, site }) => {
    site.failCursors.add('c3');
    await site.open();
    await expect(page.locator('.pcw-summary-note')).toContainText("Couldn't load everything (HTTP 500)");
    await expect(page.locator('.pcw-summary-text')).toContainText('5 wishlist items');
    // Typing a search updates the totals but must not wipe the Retry button.
    await page.locator('.pcw-search input').fill('base');
    await expect(page.locator('.pcw-summary-text')).toContainText('match “base”');
    await expect(page.locator('.pcw-summary .pcw-retry')).toBeVisible();
    await page.locator('.pcw-search input').press('Escape');
    // What loaded is still fully enhanced, including the parts the old fallback skipped.
    await expect(page.locator('tr.item .pcw-pick-actions')).toHaveCount(5);
    await expect(page.locator('tr.item input.js-cancel-bid[value="Remove"]')).toHaveCount(5);
    await page.locator('.pcw-retry').click();
    await expect(page.locator('.pcw-summary-note')).toBeEmpty();
    await expect(page.locator('.pcw-summary-text')).toContainText('7 wishlist items');
    expect(site.cursorsRequested).toEqual(['c2', 'c3', 'c3']);
    expect(await ids(page)).toEqual(['bid-6', 'bid-5', 'bid-3', 'bid-2', 'bid-1', 'bid-4', 'bid-7']);
  });

  test('does nothing on pages without the wishlist table', async ({ page, site }) => {
    await site.open('https://www.pricecharting.com/wishlist/other');
    await page.waitForTimeout(500);
    await expect(page.locator('.pcw-summary')).toHaveCount(0);
  });
});

test.describe('rows that arrive after loading', () => {
  test('a late card gets buttons and is sorted in', async ({ page, site }) => {
    await site.open();
    await site.loaded();
    await page.evaluate((html) => document.querySelector('table#active tbody').insertAdjacentHTML('beforeend', html),
      F.itemRow({ id: 50, name: 'Late Card', price: 200 }));
    await expect(page.locator('tr#bid-50 .pcw-pick-actions')).toHaveCount(1);
    await expect(page.locator('tr#bid-50 .pcw-move')).toHaveCount(1);
    await expect(page.locator('tr#bid-50 input.js-cancel-bid')).toHaveValue('Remove');
    expect((await ids(page)).slice(0, 2)).toEqual(['bid-6', 'bid-50']);
    await expect(page.locator('.pcw-summary')).toContainText('8 wishlist items');
  });

  test('the totals box stays visible after loading and after switching views', async ({ page, site }) => {
    await site.open();
    await site.loaded();
    await page.locator('.pcw-view-icons .pcw-icon[title="grid view"]').click();
    await page.waitForTimeout(6500);
    await expect(page.locator('.pcw-summary')).toBeVisible();
    await expect(page.locator('.pcw-summary-text')).toHaveText('7 wishlist items · Total value: $1,085.49 (1 with no price)');
    await expect(page.locator('.pcw-status')).toHaveCount(0);
  });

  test('a site-rendered duplicate is removed; one without a twin is kept', async ({ page, site }) => {
    await site.open();
    await site.loaded();
    await page.evaluate(([dup, lone]) => {
      const tb = document.querySelector('table#active tbody');
      tb.insertAdjacentHTML('afterbegin', dup + lone);
    }, [F.siteRow({ id: 5, name: 'Mew', price: 120 }), F.siteRow({ id: 99, name: 'Lonely', price: 1 })]);
    await expect(page.locator('tbody > tr#bid-5')).toHaveCount(1);
    await expect(page.locator('tbody > tr#bid-5')).toHaveClass(/item/);
    await expect(page.locator('tbody > tr#bid-99')).toHaveCount(1);
  });
});

test.describe('page tweaks and view', () => {
  test('relabels the Set filter and the Remove buttons', async ({ page, site }) => {
    await site.open();
    await site.loaded();
    await expect(page.locator('input[placeholder="Type part of set"]')).toHaveCount(1);
    await expect(page.locator('input.js-cancel-bid[value="-"]')).toHaveCount(0);
  });

  test('grid view toggles, swaps in large images, and is remembered', async ({ page, site }) => {
    await site.open();
    await site.loaded();
    await page.locator('.pcw-view-icons .pcw-icon[title="grid view"]').click();
    await expect(page.locator('table#active')).toHaveClass(/pcw-grid/);
    await expect(page.locator('tr#bid-1 td.photo img')).toHaveAttribute('src', /\/240\.jpg$/);
    await expect(page.locator('tr#bid-1 .pcw-btn-move')).toBeVisible();
    await page.reload();
    await site.loaded();
    await expect(page.locator('table#active')).toHaveClass(/pcw-grid/);
    await page.locator('.pcw-view-icons .pcw-icon[title="list view"]').click();
    await expect(page.locator('tr#bid-1 td.photo img')).toHaveAttribute('src', /\/60\.jpg$/);
    await expect(page.locator('tr#bid-1 .pcw-btn-move')).toBeVisible();
  });
});

test('grid view falls back to the small image when the large one is missing', async ({ page, site }) => {
  site.missingLarge.add('/img/2/240.jpg');
  await site.open();
  await site.loaded();
  await page.locator('.pcw-view-icons .pcw-icon[title="grid view"]').click();
  await expect(page.locator('tr#bid-1 td.photo img')).toHaveAttribute('src', /\/240\.jpg$/);
  await expect(page.locator('tr#bid-2 td.photo img')).toHaveAttribute('src', /\/60\.jpg$/);
});

test.describe('search', () => {
  test('filters by every word in name or set, updates totals, Escape clears', async ({ page, site }) => {
    await site.open();
    await site.loaded();
    const box = page.locator('.pcw-search input');
    await box.fill('promo');
    await expect.poll(() => visibleIds(page)).toEqual(['bid-5', 'bid-7']);
    await expect(page.locator('.pcw-summary')).toHaveText('2 of 7 wishlist items match “promo” · Total value: $120.00 (1 with no price)');
    await box.fill('base char');
    await expect.poll(() => visibleIds(page)).toEqual(['bid-3']);
    await box.press('Escape');
    await expect.poll(async () => (await visibleIds(page)).length).toBe(7);
  });
});

test.describe('Select / Exclude lists', () => {
  test('select mode totals picks, hides Exclude, and survives a reload', async ({ page, site }) => {
    await site.open();
    await site.loaded();
    await page.locator('tr#bid-6 .pcw-btn-select').click();
    await page.locator('tr#bid-2 .pcw-btn-select').click();
    await expect(page.locator('.pcw-pick-panel span')).toHaveText('2 cards selected · Total: $900.49');
    await expect(page.locator('tr#bid-1 .pcw-btn-exclude')).toBeHidden();
    await page.reload();
    await site.loaded();
    await expect(page.locator('.pcw-pick-panel span')).toHaveText('2 cards selected · Total: $900.49');
    await page.locator('.pcw-pick-clear').click();
    await expect(page.locator('.pcw-pick-panel')).toBeHidden();
    await expect(page.locator('tr#bid-1 .pcw-btn-exclude')).toBeVisible();
  });

  test('exclude mode shows the remaining total, with no export option', async ({ page, site }) => {
    await site.open();
    await site.loaded();
    await page.locator('tr#bid-6 .pcw-btn-exclude').click();
    await expect(page.locator('.pcw-pick-panel span')).toHaveText('1 card excluded · Remaining total: $215.00');
    await expect(page.locator('.pcw-pick-panel button')).toHaveText(['Clear']);
  });
});

test.describe('Move to collection', () => {
  for (const view of ['list', 'grid']) {
    test.describe(`in ${view} view`, () => {
      const L = view === 'grid'
        ? { idle: 'Move to collection', armed: 'Click again to confirm', failed: 'Failed — try again' }
        : { idle: 'Move', armed: 'Confirm?', failed: 'Failed, retry' };
      test.beforeEach(async ({ page, site }) => {
        await site.open();
        await site.loaded();
        await page.locator(`.pcw-view-icons .pcw-icon[title="${view} view"]`).click();
        await expect(page.locator('tr#bid-2 .pcw-btn-move')).toBeVisible();
      });

      test('arms on first click, then adds and removes the card', async ({ page, site }) => {
        const btn = page.locator('tr#bid-2 .pcw-btn-move');
        await expect(btn).toHaveText(L.idle, { useInnerText: true });
        await btn.click();
        await expect(btn).toHaveText(L.armed, { useInnerText: true });
        expect(site.apiCalls).toEqual([]);
        await btn.click();
        await expect(page.locator('tr#bid-2')).toHaveCount(0);
        await expect(page.locator('tr#details-2')).toHaveCount(0);
        expect(site.apiCalls).toEqual(['/api/offer-publish?product=2&add-to-collection=on&max-price=0&condition-id=1']);
        expect(await page.evaluate(() => window.__removed)).toEqual(['bid-2']);
        await expect(page.locator('.pcw-summary')).toContainText('6 wishlist items');
      });

      test('resets after 4 seconds without a second click', async ({ page, site }) => {
        const btn = page.locator('tr#bid-2 .pcw-btn-move');
        await btn.click();
        await expect(btn).toHaveText(L.armed, { useInnerText: true });
        await expect(btn).toHaveText(L.idle, { useInnerText: true, timeout: 6000 });
        expect(site.apiCalls).toEqual([]);
        await expect(page.locator('tr#bid-2')).toHaveCount(1);
      });

      test('a failed add keeps the card and never removes it', async ({ page, site }) => {
        site.addStatus = 500;
        const btn = page.locator('tr#bid-2 .pcw-btn-move');
        await btn.click();
        await btn.click();
        await expect(btn).toHaveText(L.failed, { useInnerText: true });
        await expect(page.locator('tr#bid-2')).toHaveCount(1);
        expect(await page.evaluate(() => window.__removed)).toEqual([]);
      });
    });
  }

  test('in list view, the button sits under Remove; in grid view, in its own cell', async ({ page, site }) => {
    await site.open();
    await site.loaded();
    const btn = page.locator('tr#bid-2 .pcw-btn-move');
    await expect(page.locator('tr#bid-2 td.expand .pcw-btn-move')).toHaveCount(1);
    await expect(page.locator('tr#bid-2 td.pcw-move')).toBeHidden();
    const remove = await page.locator('tr#bid-2 td.expand input.js-cancel-bid').boundingBox();
    const box = await btn.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(remove.y + remove.height - 1);
    expect(box.width).toBeLessThan(200);

    await page.locator('.pcw-view-icons .pcw-icon[title="grid view"]').click();
    await expect(page.locator('tr#bid-2 td.pcw-move .pcw-btn-move')).toBeVisible();
    await expect(page.locator('tr#bid-2 td.expand .pcw-btn-move')).toHaveCount(0);

    await page.locator('.pcw-view-icons .pcw-icon[title="list view"]').click();
    await expect(page.locator('tr#bid-2 td.expand .pcw-btn-move')).toBeVisible();
  });

  test('in list view, Remove matches the other buttons and lines up with Move', async ({ page, site }) => {
    await site.open();
    await site.loaded();
    const styles = (sel) => page.locator(sel).evaluate((el) => {
      const c = getComputedStyle(el);
      return { font: c.fontSize, weight: c.fontWeight, pad: c.padding, radius: c.borderRadius, shadow: c.boxShadow, width: el.getBoundingClientRect().width };
    });
    const remove = await styles('tr#bid-2 td.expand input.js-cancel-bid');
    const move = await styles('tr#bid-2 .pcw-btn-move');
    const select = await styles('tr#bid-2 .pcw-btn-select');
    expect(remove.font).toBe(select.font);
    expect(remove.weight).toBe(select.weight);
    expect(remove.pad).toBe(select.pad);
    expect(remove.radius).toBe(select.radius);
    expect(remove.shadow).toBe('none');
    expect(Math.abs(remove.width - move.width)).toBeLessThan(1);
  });

  test('grid view keeps its own Remove and Move styling', async ({ page, site }) => {
    await site.open();
    await site.loaded();
    await page.locator('.pcw-view-icons .pcw-icon[title="grid view"]').click();
    await expect(page.locator('tr#bid-2 .pcw-btn-move')).toHaveText('Move to collection', { useInnerText: true });
  });

  test('a card added after loading gets its Move button under Remove in list view', async ({ page, site }) => {
    await site.open();
    await site.loaded();
    await page.evaluate((html) => document.querySelector('table#active tbody').insertAdjacentHTML('beforeend', html),
      F.itemRow({ id: 60, name: 'Late Card', price: 2 }));
    await expect(page.locator('tr#bid-60 td.expand .pcw-btn-move')).toBeVisible();
  });
});
