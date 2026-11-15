(() => {
  const table = document.querySelector('table#active');
  const sortSel = document.querySelector('select[name=sort]');
  if (!table || !sortSel) return;
  const tbody = table.tBodies[0];
  const sort = sortSel.value;
  const MAX_PAGES = 100;

  const priceOf = (row) => {
    const t = row.querySelector('.js-price')?.textContent || '';
    const m = t.replace(/,/g, '').match(/\$?([\d.]+)/);
    return m ? parseFloat(m[1]) : NaN;
  };
  const pagingRow = () => tbody.querySelector('tr.offers-paging');
  const cursorIn = (root) => root.querySelector('form.next_page input[name=cursor]')?.value || null;

  // The "Set" filter becomes a free-text box once a category is chosen, but the
  // site leaves it labeled "Type part of console" (leftover wording from video
  // games). It still works as a set-name filter — just relabel the placeholder.
  document.querySelectorAll('input[placeholder="Type part of console"]').forEach((input) => {
    input.placeholder = 'Type part of set';
  });

  // ---- Grid toggle (works immediately, independent of loading) ----
  const store = {
    get() { try { return localStorage.getItem('pcw-view'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem('pcw-view', v); } catch (e) {} }
  };
  const mkIcon = (src, alt) => {
    const box = document.createElement('div');
    box.className = 'pcw-icon';
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    box.title = alt;
    box.appendChild(img);
    return box;
  };
  const wrap = document.createElement('div');
  wrap.className = 'pcw-view-icons';
  const bGrid = mkIcon('/images/grid.png', 'grid view');
  const bList = mkIcon('/images/table.png', 'list view');
  wrap.append(bGrid, bList);
  const setView = (v) => {
    table.classList.toggle('pcw-grid', v === 'grid');
    bGrid.classList.toggle('pcw-selected', v === 'grid');
    bList.classList.toggle('pcw-selected', v !== 'grid');
    store.set(v);
    upgradeImages(v === 'grid');
  };
  bList.onclick = () => setView('list');
  bGrid.onclick = () => setView('grid');
  // Place the toggle after the last control in the sort/filter form, like the search page.
  const sortForm = sortSel.form;
  const lastControl = sortForm && [...sortForm.querySelectorAll('select')].filter((el) => !el.closest('table')).pop();
  (lastControl || sortSel).insertAdjacentElement('afterend', wrap);
  // Grid cards use the larger 240px thumbnail; fall back to the original if missing.
  function upgradeImages(big) {
    table.querySelectorAll('tr.item td.photo img').forEach((img) => {
      const cur = img.getAttribute('src') || '';
      if (big && /\/60\.jpg$/.test(cur)) {
        img.dataset.pcwSmall = cur;
        img.onerror = () => { img.onerror = null; img.src = img.dataset.pcwSmall; };
        img.src = cur.replace(/\/60\.jpg$/, '/240.jpg');
      } else if (!big && img.dataset.pcwSmall) {
        img.onerror = null;
        img.src = img.dataset.pcwSmall;
      }
    });
  }
  // The site's own Remove control is a bare "-" button; relabel it so it's usable
  // once the grid view hides the expand/shrink arrows next to it. Safe to re-run
  // any time rows are added (loadAll() pulls in more pages after this first runs).
  function relabelRemoveButtons() {
    table.querySelectorAll('tr.item td.expand input.js-cancel-bid').forEach((btn) => {
      if (btn.value !== 'Remove') btn.value = 'Remove';
    });
  }
  relabelRemoveButtons();
  bList.onclick = () => setView('list');
  bGrid.onclick = () => setView('grid');
  setView(store.get() === 'grid' ? 'grid' : 'list');

  // ---- Load every page, then sort globally ----
  const summary = document.createElement('div');
  summary.className = 'pcw-summary';
  summary.textContent = 'Counting wishlist items…';
  table.parentElement.insertBefore(summary, table);

  const status = document.createElement('div');
  status.className = 'pcw-status';
  table.parentElement.insertBefore(status, table);

  // Current search text (see the search box below). Empty = show everything.
  let query = '';
  let queryRaw = '';

  function updateSummary() {
    const all = [...tbody.querySelectorAll('tr.item')];
    const rows = query ? all.filter((r) => !r.classList.contains('pcw-hidden')) : all;
    let total = 0;
    let priced = 0;
    rows.forEach((row) => {
      const p = priceOf(row);
      if (!isNaN(p)) { total += p; priced++; }
    });
    const fmt = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    let text = query
      ? `${rows.length.toLocaleString()} of ${all.length.toLocaleString()} wishlist items match “${queryRaw}” · Total value: ${fmt(total)}`
      : `${rows.length.toLocaleString()} wishlist item${rows.length === 1 ? '' : 's'} · Total value: ${fmt(total)}`;
    if (priced < rows.length) text += ` (${rows.length - priced} with no price)`;
    summary.textContent = text;
  }

  // The site has its own infinite scroll (market_ae.js: on_scroll -> fetch_next)
  // that fires whenever you're within 700px of the page bottom, reads the cursor
  // from this same paging row, and injects its own class-less wishlist rows
  // before it. If that races with loadAll(), the page-2 cards show up twice and
  // the site's copies never get the extension's features. So take the paging
  // row out of the page up front: with no form.next_page, the site's scroll
  // handler finds nothing to fetch and stops. It never comes back: once the
  // site's fetch_next() sees no form it unbinds its scroll handler for good, so
  // a failed load is resumed by our own Retry button instead (see run()).
  const initialCursor = cursorIn(tbody);
  pagingRow()?.remove();

  // Safety net: drop a site-rendered wishlist row (no .item class) ONLY when a
  // real tr.item with the same id exists, i.e. it is a true duplicate. A row
  // with no twin is left alone so no card can ever disappear.
  function purgeSiteRows() {
    const realIds = new Set([...tbody.querySelectorAll(':scope > tr.item')].map((r) => r.id));
    tbody.querySelectorAll(':scope > tr[id^="bid-"]:not(.item)').forEach((r) => {
      if (realIds.has(r.id)) r.remove();
    });
  }

  // Paging state lives outside loadAll() so a failed load can resume from the
  // page that failed. pendingCursor only advances after a page is inserted.
  let pendingCursor = initialCursor;
  let pagesLoaded = 1;
  let dupesSkipped = 0;
  const debug = (() => { try { return localStorage.getItem('pcw-debug') === '1'; } catch (e) { return false; } })();
  if (debug) console.log(`[pcw] page 1: ${tbody.querySelectorAll(':scope > tr.item').length} rows`);

  async function loadAll() {
    // Cursor paging over a price sort can return the same card on two pages
    // (ties at a page boundary). Keep the first copy of each row id only.
    const seen = new Set([...tbody.querySelectorAll(':scope > tr.item')].map((r) => r.id));
    while (pendingCursor && pagesLoaded < MAX_PAGES) {
      const cursor = pendingCursor;
      status.textContent = `Loading all wishlist items… (${tbody.querySelectorAll('tr.item').length} so far)`;
      const res = await fetch(location.href, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ cursor })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const next = cursorIn(doc);
      const rows = [...doc.querySelectorAll('table#active > tbody > tr')].filter(
        (r) => r.classList.contains('item') || r.classList.contains('item-details')
      );
      let added = 0;
      let dupes = 0;
      let skipDetails = false;
      rows.forEach((r) => {
        if (r.classList.contains('item')) {
          skipDetails = !!r.id && seen.has(r.id);
          if (skipDetails) { dupes++; return; }
          if (r.id) seen.add(r.id);
          added++;
        } else if (skipDetails) {
          return; // the item-details row paired with a skipped duplicate
        }
        tbody.insertBefore(document.importNode(r, true), pagingRow());
      });
      dupesSkipped += dupes;
      pagesLoaded++;
      if (debug) console.log(`[pcw] page ${pagesLoaded}: ${added + dupes} rows, ${added} new, ${dupes} duplicate`);
      pendingCursor = next === cursor ? null : next;
    }
  }

  function sortRows() {
    if (sort !== 'lowest-price' && sort !== 'highest-price') return;
    const asc = sort === 'lowest-price';
    const pairs = [...tbody.querySelectorAll('tr.item')].map((item) => {
      const det = item.nextElementSibling?.classList.contains('item-details') ? item.nextElementSibling : null;
      return { item, det, price: priceOf(item) };
    });
    pairs.sort((a, b) => {
      if (isNaN(a.price) && isNaN(b.price)) return 0;
      if (isNaN(a.price)) return 1;
      if (isNaN(b.price)) return -1;
      return asc ? a.price - b.price : b.price - a.price;
    });
    const anchor = pagingRow();
    pairs.forEach((p) => {
      tbody.insertBefore(p.item, anchor);
      if (p.det) tbody.insertBefore(p.det, anchor);
    });
  }

  // ---- Pick-list: tag cards green (keep) or red (exclude), with a running
  // total and an export of whichever list you're building. Only one color is
  // active at a time — picking one hides the other everywhere on the page
  // until you clear it. State is per wishlist (by id) and survives reloads.
  const fmtMoney = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const wishlistKey = (() => {
    const m = location.search.match(/[?&]user=([^&]+)/);
    return 'pcw-picks-' + (m ? m[1] : 'default');
  })();
  const picks = {
    mode: 'none', // 'none' | 'select' | 'exclude'
    ids: new Set(),
    load() {
      try {
        const raw = JSON.parse(localStorage.getItem(wishlistKey) || 'null');
        if (raw && (raw.mode === 'select' || raw.mode === 'exclude') && Array.isArray(raw.ids)) {
          this.mode = raw.mode;
          this.ids = new Set(raw.ids);
        }
      } catch (e) {}
    },
    save() {
      try {
        if (this.mode === 'none') localStorage.removeItem(wishlistKey);
        else localStorage.setItem(wishlistKey, JSON.stringify({ mode: this.mode, ids: [...this.ids] }));
      } catch (e) {}
    },
    clear() {
      this.mode = 'none';
      this.ids.clear();
      this.save();
    },
    toggle(id, color) {
      // Switching colors with picks already made isn't allowed by the UI
      // (the other button is hidden), but guard anyway.
      if (this.mode === 'none') this.mode = color;
      if (this.mode !== color) return;
      if (this.ids.has(id)) this.ids.delete(id);
      else this.ids.add(id);
      if (this.ids.size === 0) this.mode = 'none';
      this.save();
    }
  };
  picks.load();

  function rowInfo(row) {
    const titleEl = row.querySelector('td.meta p.title');
    const nameLink = titleEl?.querySelector('a');
    const name = nameLink ? nameLink.textContent.trim() : '';
    const set = titleEl ? titleEl.textContent.replace(name, '').trim() : '';
    return { id: row.id, name, set, price: priceOf(row) };
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const csvCell = (v) => '"' + String(v).replace(/"/g, '""') + '"';

  function exportPicks() {
    const rows = [...tbody.querySelectorAll('tr.item')].map(rowInfo);
    const grandTotal = rows.reduce((s, r) => s + (isNaN(r.price) ? 0 : r.price), 0);
    const picked = rows.filter((r) => picks.ids.has(r.id));
    const lines = [['Name', 'Set', 'Price'].map(csvCell).join(',')];
    picked.forEach((r) => lines.push([r.name, r.set, isNaN(r.price) ? '' : r.price.toFixed(2)].map(csvCell).join(',')));
    lines.push('');
    if (picks.mode === 'select') {
      const total = picked.reduce((s, r) => s + (isNaN(r.price) ? 0 : r.price), 0);
      lines.push(['Selected items', picked.length].map(csvCell).join(','));
      lines.push(['Total', total.toFixed(2)].map(csvCell).join(','));
    } else {
      const excludedTotal = picked.reduce((s, r) => s + (isNaN(r.price) ? 0 : r.price), 0);
      const remaining = grandTotal - excludedTotal;
      lines.push(['Excluded items', picked.length].map(csvCell).join(','));
      lines.push(['Wishlist total', grandTotal.toFixed(2)].map(csvCell).join(','));
      lines.push(['Remaining total (wishlist minus excluded)', remaining.toFixed(2)].map(csvCell).join(','));
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`wishlist-${picks.mode === 'select' ? 'selected' : 'excluded'}-${stamp}.csv`, lines.join('\r\n'));
  }

  const pickPanel = document.createElement('div');
  pickPanel.className = 'pcw-pick-panel';
  table.parentElement.insertBefore(pickPanel, table);

  function updatePickUI() {
    table.classList.toggle('pcw-mode-select', picks.mode === 'select');
    table.classList.toggle('pcw-mode-exclude', picks.mode === 'exclude');
    tbody.querySelectorAll('tr.item').forEach((row) => {
      const on = picks.ids.has(row.id);
      row.classList.toggle('pcw-picked-select', on && picks.mode === 'select');
      row.classList.toggle('pcw-picked-exclude', on && picks.mode === 'exclude');
      const g = row.querySelector('.pcw-btn-select');
      const r = row.querySelector('.pcw-btn-exclude');
      if (g) g.textContent = on && picks.mode === 'select' ? '✓ Selected' : 'Select';
      if (r) r.textContent = on && picks.mode === 'exclude' ? '✕ Excluded' : 'Exclude';
    });
    if (picks.mode === 'none') {
      pickPanel.hidden = true;
      return;
    }
    pickPanel.hidden = false;
    const rows = [...tbody.querySelectorAll('tr.item')].map(rowInfo);
    const picked = rows.filter((r) => picks.ids.has(r.id));
    const pickedTotal = picked.reduce((s, r) => s + (isNaN(r.price) ? 0 : r.price), 0);
    let text;
    if (picks.mode === 'select') {
      text = `${picked.length} card${picked.length === 1 ? '' : 's'} selected · Total: ${fmtMoney(pickedTotal)}`;
    } else {
      const grandTotal = rows.reduce((s, r) => s + (isNaN(r.price) ? 0 : r.price), 0);
      text = `${picked.length} card${picked.length === 1 ? '' : 's'} excluded · Remaining total: ${fmtMoney(grandTotal - pickedTotal)}`;
    }
    pickPanel.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = text;
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'pcw-pick-export';
    exportBtn.textContent = 'Export CSV';
    exportBtn.onclick = exportPicks;
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'pcw-pick-clear';
    clearBtn.textContent = 'Clear';
    clearBtn.onclick = () => { picks.clear(); updatePickUI(); };
    pickPanel.append(span, exportBtn, clearBtn);
  }

  function addPickButtons() {
    tbody.querySelectorAll('tr.item').forEach((row) => {
      if (row.querySelector('.pcw-pick-actions')) return;
      const td = document.createElement('td');
      td.className = 'pcw-pick-actions';
      const g = document.createElement('button');
      g.type = 'button';
      g.className = 'pcw-btn-select';
      g.textContent = 'Select';
      g.onclick = () => { picks.toggle(row.id, 'select'); updatePickUI(); };
      const r = document.createElement('button');
      r.type = 'button';
      r.className = 'pcw-btn-exclude';
      r.textContent = 'Exclude';
      r.onclick = () => { picks.toggle(row.id, 'exclude'); updatePickUI(); };
      td.append(g, r);
      const priceCell = row.querySelector('td.price');
      (priceCell || row.lastElementChild).insertAdjacentElement('afterend', td);
    });
  }

  // ---- Move to collection (grid view): adds the card to your PriceCharting
  // collection the same way the site's own "In One Click" button does, using
  // your default condition, then removes it from the wishlist with the site's
  // own Remove button. The wishlist removal only happens if the add succeeded.
  function defaultConditionId() {
    try { return localStorage.getItem('prefs.DefaultCondition') || '1'; } catch (e) { return '1'; }
  }
  async function moveToCollection(row) {
    const product = row.dataset.product;
    if (!product) throw new Error('missing product id');
    const url = '/api/offer-publish?product=' + encodeURIComponent(product) +
      '&add-to-collection=on&max-price=0&condition-id=' + encodeURIComponent(defaultConditionId());
    const res = await fetch(url, { method: 'POST', credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const removeBtn = row.querySelector('td.expand input.js-cancel-bid');
    if (!removeBtn) throw new Error('added to collection, but Remove button not found');
    removeBtn.click();
  }

  function addMoveButtons() {
    tbody.querySelectorAll('tr.item').forEach((row) => {
      if (row.querySelector('.pcw-move')) return;
      const td = document.createElement('td');
      td.className = 'pcw-move';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pcw-btn-move';
      b.textContent = 'Move to collection';
      let armTimer = null;
      const reset = () => { b.dataset.state = ''; b.textContent = 'Move to collection'; b.disabled = false; };
      b.onclick = async () => {
        if (b.dataset.state === 'moving') return;
        if (b.dataset.state !== 'armed') {
          // First click arms the button; a second click within 4s confirms.
          b.dataset.state = 'armed';
          b.textContent = 'Click again to confirm';
          armTimer = setTimeout(reset, 4000);
          return;
        }
        clearTimeout(armTimer);
        b.dataset.state = 'moving';
        b.textContent = 'Moving…';
        b.disabled = true;
        try {
          await moveToCollection(row);
          b.textContent = '✓ Moved to collection';
          if (picks.ids.delete(row.id)) {
            if (picks.ids.size === 0) picks.mode = 'none';
            picks.save();
          }
          setTimeout(() => {
            const det = row.nextElementSibling;
            if (det && det.classList.contains('item-details')) det.remove();
            row.remove();
            updatePickUI();
            applySearch();
          }, 1200);
        } catch (err) {
          console.error('Move to collection failed:', err);
          reset();
          b.textContent = 'Failed — try again';
        }
      };
      td.appendChild(b);
      const anchor = row.querySelector('.pcw-pick-actions') || row.querySelector('td.price') || row.lastElementChild;
      anchor.insertAdjacentElement('afterend', td);
    });
  }

  // ---- Search box: hides cards whose name/set don't contain every typed word.
  // Hidden cards stay in the page, so Select/Exclude picks and their totals
  // still cover the whole wishlist.
  const searchWrap = document.createElement('div');
  searchWrap.className = 'pcw-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search wishlist by card name or set…';
  searchInput.setAttribute('aria-label', 'Search wishlist');
  searchWrap.appendChild(searchInput);
  table.parentElement.insertBefore(searchWrap, summary);

  function applySearch() {
    const tokens = query.split(/\s+/).filter(Boolean);
    tbody.querySelectorAll('tr.item').forEach((row) => {
      const info = rowInfo(row);
      const hay = (info.name + ' ' + info.set).toLowerCase();
      const hide = tokens.length > 0 && !tokens.every((t) => hay.includes(t));
      row.classList.toggle('pcw-hidden', hide);
      const det = row.nextElementSibling;
      if (det && det.classList.contains('item-details')) det.classList.toggle('pcw-hidden', hide);
    });
    updateSummary();
  }
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      queryRaw = searchInput.value.trim();
      query = queryRaw.toLowerCase();
      applySearch();
    }, 120);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { searchInput.value = ''; queryRaw = ''; query = ''; applySearch(); }
  });

  // ---- One pass that brings every row up to date. Each step is idempotent
  // (button inserts skip rows that already have them), so it is safe to run
  // after the initial load, after a partial load, and for rows added later.
  let enhancing = false;
  function enhanceRows() {
    enhancing = true;
    try {
      purgeSiteRows();
      sortRows();
      upgradeImages(table.classList.contains('pcw-grid'));
      relabelRemoveButtons();
      addPickButtons();
      addMoveButtons();
      updatePickUI();
      applySearch();
    } finally {
      observer.takeRecords(); // drop the mutations our own sort just caused
      enhancing = false;
    }
  }

  // Rows that show up after the load (from the site or anything else) get the
  // same treatment. Only direct children of tbody are watched, so the cells we
  // add inside rows don't retrigger this.
  let enhanceQueued = false;
  const observer = new MutationObserver((mutations) => {
    if (enhancing || enhanceQueued) return;
    const rowAdded = mutations.some((m) =>
      [...m.addedNodes].some((n) => n.nodeType === 1 && n.matches('tr[id^="bid-"]')));
    if (!rowAdded) return;
    enhanceQueued = true;
    requestAnimationFrame(() => { enhanceQueued = false; enhanceRows(); });
  });

  function run() {
    observer.disconnect();
    loadAll()
      .then(() => {
        enhanceRows();
        const n = tbody.querySelectorAll('tr.item').length;
        status.textContent = `Showing all ${n} wishlist items` +
          (sort === 'lowest-price' || sort === 'highest-price' ? ', sorted by price.' : '.');
        if (debug) console.log(`[pcw] done: ${n} items, ${dupesSkipped} duplicate${dupesSkipped === 1 ? '' : 's'} skipped`);
        setTimeout(() => status.remove(), 6000);
      })
      .catch((e) => {
        // Keep what loaded and offer to resume from the page that failed.
        enhanceRows();
        const n = tbody.querySelectorAll('tr.item').length;
        status.textContent = `Loaded ${n} wishlist items, but the next page failed (${e.message}). `;
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'pcw-retry';
        retry.textContent = 'Retry';
        retry.onclick = run;
        status.appendChild(retry);
      })
      .finally(() => observer.observe(tbody, { childList: true }));
  }
  run();
})();
