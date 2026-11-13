(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const state = { products: [], selected: null, meta: null, currentOrder: null, adminKey: '' };
  const money = (cents) => 'N$ ' + (Number(cents) / 100).toLocaleString('en-NA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let toastTimer;
  function toast(message) { const t = $('toast'); t.textContent = message; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 4200); }
  async function api(path, opts = {}) {
    let response;
    try { response = await fetch('/api' + path, { cache: 'no-store', ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } }); }
    catch { throw new Error('Network unavailable. Please check your internet connection.'); }
    let payload;
    try { payload = await response.json(); } catch { throw new Error('Unexpected server response.'); }
    if (!response.ok) { const detail = payload?.detail; throw new Error(typeof detail === 'string' ? detail : 'Request failed (' + response.status + ').'); }
    return payload;
  }
  const json = (data) => JSON.stringify(data);
  function modal(name, open) { $(name).hidden = !open; document.body.style.overflow = [...document.querySelectorAll('.modal-backdrop')].some(x => !x.hidden) ? 'hidden' : ''; if (open) { const el = $(name).querySelector('input'); if (el) setTimeout(() => el.focus(), 40); } }
  function showTracker() { modal('trackerModal', true); const prev = state.currentOrder; if (prev) { $('trackId').value = prev.id || ''; $('trackEmail').value = prev.email || ''; } }
  function setSelected(product) {
    state.selected = product;
    document.querySelectorAll('.pack').forEach(b => { const selected = b.dataset.id === product.id; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
    $('summaryProduct').textContent = product.title;
    $('summaryPrice').textContent = money(product.price_cents);
    $('summaryTotal').textContent = money(product.price_cents);
    $('buyButton').disabled = false;
    $('buyButton').innerHTML = (state.meta?.demo ? 'Simulate top-up' : 'Continue to secure payment') + ' <span aria-hidden="true">↗</span>';
  }
  function renderProducts(products) {
    const grid = $('productsGrid'); grid.replaceChildren();
    if (!products.length) { const el = document.createElement('p'); el.textContent = 'No Gold packages are currently available.'; grid.append(el); return; }
    products.forEach(p => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pack'; b.dataset.id = p.id; b.setAttribute('aria-label', `${p.title}, ${money(p.price_cents)}`);
      b.setAttribute('aria-pressed', 'false');
      // Product titles and badges are escaped before inserting into the DOM.
      b.innerHTML = `${p.badge ? '<span class="pack-tag">' + esc(p.badge) + '</span>' : ''}<span class="pack-icon"><span class="gold-gem">◆</span></span><b>${Number(p.gold).toLocaleString('en-US')}</b><span class="pack-gold-caption">GOLD</span><span class="pack-price">${money(p.price_cents)}</span>`;
      b.addEventListener('click', () => setSelected(p)); grid.append(b);
    });
    setSelected(products.find(p => p.badge === 'Popular') || products[0]);
  }
  function statusHuman(s) { return ({ awaiting_payment: 'Awaiting payment', paid_awaiting_delivery: 'Paid · awaiting delivery', supplier_submitting: 'Sending to supplier', supplier_processing: 'Delivery processing', delivered: 'Delivered', demo_delivered: 'Simulation complete', delivery_failed: 'Delivery needs attention', payment_failed: 'Payment unsuccessful', refund_review: 'Refund under review' })[s] || s.replaceAll('_', ' '); }
  function trackingHtml(order) {
    const ok = ['delivered', 'demo_delivered'].includes(order.status);
    const pending = ['awaiting_payment', 'paid_awaiting_delivery', 'supplier_submitting', 'supplier_processing'].includes(order.status);
    const extra = order.status === 'demo_delivered' ? '<p><strong>Demo only:</strong> No money was charged and no game Gold was sent.</p>' : '';
    const ref = order.fulfillment_reference ? `<div>Fulfillment reference: <strong>${esc(order.fulfillment_reference)}</strong></div>` : '';
    return `<div>Order: <strong>${esc(order.id)}</strong></div><div>Player ID: ${esc(order.player_id)}</div><div>Amount: ${money(order.price_cents)}</div><div class="status-pill ${ok ? 'good' : pending ? 'warn' : ''}">${esc(statusHuman(order.status))}</div>${extra}${ref}${order.error_note ? '<p>Attention: ' + esc(order.error_note) + '</p>' : ''}`;
  }
  async function checkOrder(orderId, email) {
    const order = await api(`/orders/${encodeURIComponent(orderId)}?email=${encodeURIComponent(email)}`);
    $('trackResult').innerHTML = trackingHtml(order); $('trackResult').hidden = false;
    $('refreshOrder').hidden = false;
    $('resumePayment').hidden = order.status !== 'awaiting_payment';
    state.currentOrder = { id: orderId, email };
    try { localStorage.setItem('pulse_last_order', json(state.currentOrder)); } catch { /* storage optional */ }
    return order;
  }
  async function refresh() {
    const cur = state.currentOrder; if (!cur) return;
    try { await api(`/orders/${encodeURIComponent(cur.id)}/refresh`, { method: 'POST', body: json({ email: cur.email }) }); await checkOrder(cur.id, cur.email); }
    catch (e) { toast(e.message); }
  }
  async function handleCheckout(event) {
    event.preventDefault();
    if (!state.selected || !state.meta) return toast('Select a Gold package first.');
    const uid = $('playerId').value.trim(), email = $('email').value.trim().toLowerCase();
    if (!/^\d{5,20}$/.test(uid)) return toast('Enter a numeric Player ID containing 5–20 digits.');
    if (!$('email').checkValidity()) return toast('Enter a valid email address.');
    if (!$('confirmId').checked || !$('acceptTerms').checked) return toast('Confirm the Player ID and accept the terms.');
    const btn = $('buyButton'); btn.disabled = true; btn.textContent = 'Preparing order…';
    try {
      const order = await api('/orders', { method: 'POST', body: json({ product_id: state.selected.id, player_id: uid, email, confirmed_player_id: true, accepted_terms: true }) });
      state.currentOrder = { id: order.id, email }; try { localStorage.setItem('pulse_last_order', json(state.currentOrder)); } catch {}
      const checkout = await api(`/orders/${encodeURIComponent(order.id)}/checkout`, { method: 'POST', body: json({ email }) });
      if (checkout.checkout_url) { const u = new URL(checkout.checkout_url); if (u.protocol !== 'https:') throw new Error('Payment URL was not secure.'); window.location.assign(u.href); return; }
      if (checkout.demo) { showTracker(); await checkOrder(order.id, email); toast('Simulated payment complete. No real Gold was sent.'); }
      else { showTracker(); await checkOrder(order.id, email); toast('Order created. Check its status in the tracker.'); }
    } catch (e) { toast(e.message); if (state.currentOrder) { showTracker(); $('trackResult').textContent = `Order ${state.currentOrder.id} was created. Please check its status before trying again.`; $('trackResult').hidden = false; } }
    finally { btn.disabled = !state.selected; btn.innerHTML = (state.meta?.demo ? 'Simulate top-up' : 'Continue to secure payment') + ' <span aria-hidden="true">↗</span>'; }
  }
  async function loadAdmin() {
    const key = $('adminKey').value;
    if (!key || key.length < 24) return toast('Enter the configured admin secret.');
    state.adminKey = key;
    const box = $('adminContent'), productBox = $('adminProducts');
    box.textContent = 'Loading dashboard…'; productBox.textContent = '';
    try {
      const auth = { headers: { 'X-Admin-Key': key } };
      const [orders, readiness, products] = await Promise.all([
        api('/admin/orders', auth), api('/admin/payment-readiness', auth), api('/admin/products', auth)
      ]);
      box.replaceChildren();
      const title = document.createElement('h3'); title.textContent = 'Payment readiness'; box.append(title);
      const ready = document.createElement('div'); ready.className = 'admin-readiness';
      const checks = [
        ['Checkout mode', readiness.mode],
        ['Merchant keys', readiness.payment_keys_configured ? 'Configured' : 'Missing'],
        ['Supplier authorization', readiness.supplier_authorized ? 'Confirmed' : 'Unconfirmed'],
        ['Persistent order database', readiness.durable_storage_confirmed ? 'Confirmed' : 'Not confirmed'],
        ['Catalogue prices', readiness.catalog_prices_approved ? 'Reviewed' : 'Not approved'],
        ['Approved sale items', String(readiness.approved_active_products)],
        ['Delivery process', readiness.fulfillment_mode],
      ];
      for (const [label, value] of checks) {
        const line = document.createElement('div');
        const name = document.createElement('b'); name.textContent = label;
        const detail = document.createElement('span'); detail.textContent = value;
        line.append(name, detail); ready.append(line);
      }
      box.append(ready);
      const note = document.createElement('p'); note.textContent = 'Provider webhook: ' + readiness.webhook_url + '. Configure private keys in Render Environment, never in this browser.'; box.append(note);
      const ordersTitle = document.createElement('h3'); ordersTitle.textContent = `Orders (${orders.length})`; box.append(ordersTitle);
      if (!orders.length) { const none = document.createElement('p'); none.textContent = 'No orders yet.'; box.append(none); }
      for (const o of orders) {
        const el = document.createElement('div'); el.className = 'admin-order';
        el.innerHTML = `<strong>${esc(o.id)}</strong> · ${esc(o.title)} · ${money(o.price_cents)}<div>Player ID: <b>${esc(o.player_id)}</b> | ${esc(o.email)}</div><div>Status: ${esc(statusHuman(o.status))} · ${esc(o.created_at)}</div>`;
        const actions = document.createElement('div'); actions.className = 'admin-actions';
        for (const [label, path] of [['Retry delivery', 'retry'], ['Reconcile', 'reconcile']]) {
          const b = document.createElement('button'); b.textContent = label;
          b.addEventListener('click', async () => {
            b.disabled = true;
            try { await api(`/admin/orders/${encodeURIComponent(o.id)}/${path}`, { method: 'POST', ...auth }); toast('Order checked.'); await loadAdmin(); }
            catch (e) { toast(e.message); } finally { b.disabled = false; }
          }); actions.append(b);
        }
        if (state.meta?.fulfillment_mode === 'manual' && o.status === 'paid_awaiting_delivery') {
          const b = document.createElement('button'); b.textContent = 'Mark delivered';
          b.addEventListener('click', async () => {
            const reference = prompt('Enter verified supplier fulfillment reference (min 4 characters):');
            if (!reference || reference.length < 4) return;
            try { await api(`/admin/orders/${encodeURIComponent(o.id)}/fulfill`, { method: 'POST', ...auth, body: json({ reference }) }); await loadAdmin(); }
            catch (e) { toast(e.message); }
          }); actions.append(b);
        }
        el.append(actions); box.append(el);
      }
      productBox.replaceChildren();
      const productTitle = document.createElement('h3'); productTitle.textContent = 'Catalogue approval'; productBox.append(productTitle);
      const guidance = document.createElement('p'); guidance.textContent = 'Starter prices are examples. Verify wholesale cost and your delivery rights before approving any real-money item.'; productBox.append(guidance);
      for (const product of products) {
        const row = document.createElement('form'); row.className = 'admin-product';
        const label = document.createElement('strong'); label.textContent = product.title;
        const input = document.createElement('input'); input.type = 'number'; input.step = '0.01'; input.min = '1'; input.value = (product.price_cents / 100).toFixed(2);
        const labelPrice = document.createElement('label'); labelPrice.textContent = 'Retail N$'; labelPrice.append(input);
        const cap = document.createElement('input'); cap.type = 'number'; cap.step = '0.01'; cap.min = '0'; cap.value = (product.max_wholesale_usd_cents / 100).toFixed(2);
        const labelCap = document.createElement('label'); labelCap.textContent = 'Supplier max USD'; labelCap.append(cap);
        const active = document.createElement('input'); active.type = 'checkbox'; active.checked = Boolean(product.active);
        const activeLabel = document.createElement('label'); activeLabel.className = 'admin-checkbox'; activeLabel.append(active, document.createTextNode('Active'));
        const approved = document.createElement('input'); approved.type = 'checkbox'; approved.checked = Boolean(product.price_approved);
        const approvedLabel = document.createElement('label'); approvedLabel.className = 'admin-checkbox'; approvedLabel.append(approved, document.createTextNode('Price approved'));
        const save = document.createElement('button'); save.type = 'submit'; save.textContent = 'Save';
        row.append(label, labelPrice, labelCap, activeLabel, approvedLabel, save);
        row.addEventListener('submit', async e => {
          e.preventDefault(); save.disabled = true;
          try {
            await api(`/admin/products/${encodeURIComponent(product.id)}`, { method: 'PUT', ...auth, body: json({
              price_cents: Math.round(Number(input.value) * 100),
              max_wholesale_usd_cents: Math.round(Number(cap.value) * 100),
              active: active.checked, price_approved: approved.checked
            }) });
            toast('Product saved. Approval does not activate live payments.');
            await loadAdmin();
          } catch (err) { toast(err.message); } finally { save.disabled = false; }
        }); productBox.append(row);
      }
    } catch (e) { box.textContent = ''; productBox.textContent = ''; toast(e.message); }
  }
  function wire() {
    $('year').textContent = new Date().getFullYear();
    for (const id of ['openTracker', 'openTrackerMobile', 'faqTracker', 'footerTrack']) $(id).addEventListener('click', showTracker);
    $('checkoutForm').addEventListener('submit', handleCheckout);
    $('termsBtn').addEventListener('click', () => modal('termsModal', true));
    $('adminOpen').addEventListener('click', () => modal('adminModal', true));
    $('adminLoad').addEventListener('click', loadAdmin);
    $('trackingForm').addEventListener('submit', async e => { e.preventDefault(); const btn = $('trackButton'); btn.disabled = true; try { await checkOrder($('trackId').value.trim(), $('trackEmail').value.trim().toLowerCase()); } catch (error) { $('trackResult').hidden = true; toast(error.message); } finally { btn.disabled = false; } });
    $('refreshOrder').addEventListener('click', refresh);
    $('resumePayment').addEventListener('click', async () => {
      if (!state.currentOrder) return;
      const { id, email } = state.currentOrder; const btn = $('resumePayment'); btn.disabled = true;
      try { const checkout = await api(`/orders/${encodeURIComponent(id)}/checkout`, { method: 'POST', body: json({ email }) });
        if (checkout.checkout_url) { const u = new URL(checkout.checkout_url); if (u.protocol !== 'https:') throw new Error('Insecure provider URL'); window.location.assign(u.href); return; }
        await checkOrder(id, email);
      } catch (e) { toast(e.message); } finally { btn.disabled = false; }
    });
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => modal(b.dataset.close, false)));
    document.querySelectorAll('.modal-backdrop').forEach(d => d.addEventListener('click', e => { if (e.target === d) modal(d.id, false); }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop').forEach(d => { if (!d.hidden) modal(d.id, false); }); });
    $('mobileMenuBtn').addEventListener('click', () => { const open = $('mobileNav').classList.toggle('open'); $('mobileMenuBtn').setAttribute('aria-expanded', String(open)); });
    $('mobileNav').querySelectorAll('a,button').forEach(x => x.addEventListener('click', () => { $('mobileNav').classList.remove('open'); $('mobileMenuBtn').setAttribute('aria-expanded','false'); }));
  }
  async function start() {
    wire();
    try {
      const [meta, products] = await Promise.all([api('/meta'), api('/products')]);
      state.meta = meta; state.products = products;
      $('modeNotice').textContent = meta.demo ? 'DEMO MODE · No payment or Gold delivery occurs' : meta.payment_mode === 'selcom_test' ? 'PAYMENT SANDBOX · Test transactions only' : 'LIVE CHECKOUT · Verify details before you pay';
      $('shopModeTag').textContent = meta.demo ? '● DEMO · NO REAL GOLD' : meta.payment_mode === 'selcom_test' ? '● PAYMENT SANDBOX' : '● LIVE CHECKOUT';
      $('shopModeTag').classList.toggle('live', !meta.demo && meta.payment_mode === 'selcom_live');
      renderProducts(products);
    } catch (e) { $('productsGrid').textContent = 'Unable to load packs. Refresh this page to try again.'; $('modeNotice').textContent = 'STORE UNAVAILABLE · Do not attempt payment'; toast(e.message); }
    const params = new URLSearchParams(window.location.search);
    let saved = null; try { saved = JSON.parse(localStorage.getItem('pulse_last_order') || 'null'); } catch {}
    if (params.get('order') && saved?.id === params.get('order') && saved?.email) { state.currentOrder = saved; history.replaceState({}, '', window.location.pathname + window.location.hash); showTracker(); await refresh(); }
    else if (saved?.id && saved?.email) state.currentOrder = saved;
  }
  start();
})();