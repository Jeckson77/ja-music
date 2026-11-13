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
  function statusHuman(s) { return ({ awaiting_payment: 'Awaiting payment', paid_awaiting_delivery: 'Paid · awaiting delivery', supplier_submitting: 'Sending to supplier', supplier_processing: 'Delivery processing', delivered: 'Delivered', demo_delivered: 'Simulation complete', delivery_failed: 'Delivery needs attention', refund_review: 'Refund under review' })[s] || s.replaceAll('_', ' '); }
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
    state.adminKey = key; const box = $('adminContent'); box.textContent = 'Loading orders…';
    try { const orders = await api('/admin/orders', { headers: { 'X-Admin-Key': key } });
      box.replaceChildren(); if (!orders.length) { box.textContent = 'No orders yet.'; return; }
      const summary = document.createElement('p'); summary.textContent = `${orders.length} most recent orders`; box.append(summary);
      for (const o of orders) {
        const el = document.createElement('div'); el.className = 'admin-order';
        el.innerHTML = `<strong>${esc(o.id)}</strong> · ${esc(o.title)} · ${money(o.price_cents)}<div>Player ID: <b>${esc(o.player_id)}</b> | ${esc(o.email)}</div><div>Status: ${esc(statusHuman(o.status))} · ${esc(o.created_at)}</div>`;
        const actions = document.createElement('div'); actions.className = 'admin-actions';
        for (const [label, path] of [['Retry delivery', 'retry'], ['Reconcile', 'reconcile']]) { const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', async () => { b.disabled = true; try { await api(`/admin/orders/${encodeURIComponent(o.id)}/${path}`, { method: 'POST', headers: { 'X-Admin-Key': state.adminKey } }); toast('Order checked.'); await loadAdmin(); } catch (e) { toast(e.message); } finally { b.disabled = false; } }); actions.append(b); }
        if (state.meta?.fulfillment_mode === 'manual' && o.status === 'paid_awaiting_delivery') { const b = document.createElement('button'); b.textContent = 'Mark delivered'; b.addEventListener('click', async () => { const reference = prompt('Enter verified supplier fulfillment reference (min 4 characters):'); if (!reference || reference.length < 4) return; try { await api(`/admin/orders/${encodeURIComponent(o.id)}/fulfill`, { method: 'POST', headers: { 'X-Admin-Key': state.adminKey }, body: json({ reference }) }); await loadAdmin(); } catch (e) { toast(e.message); } }); actions.append(b); }
        el.append(actions); box.append(el);
      }
    } catch (e) { box.textContent = ''; toast(e.message); }
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