(function() {
  'use strict';

  const scriptTag = document.currentScript || document.querySelector('script[src*="embed.js"]');
  if (!scriptTag) {
    console.error('❌ ElevenLabs Widget: Could not find embed script tag');
    return;
  }

  const agentId = scriptTag.getAttribute('data-agent-id');

  if (!agentId) {
    console.error('❌ ElevenLabs Widget: data-agent-id attribute is required');
    return;
  }

  const WIDGET_BASE_URL = scriptTag.src.replace('/embed.js', '');
  const WIDGET_ORIGIN = new URL(WIDGET_BASE_URL).origin;

  // Widget state is kept in the host's sessionStorage (first-party) so the
  // conversation transcript survives a full page load.
  const STATE_KEY = 'elevenlabs-widget-state';
  const STATE_TTL_MS = 30 * 60 * 1000;

  // Shopify Markets may prefix storefront routes (e.g. /en-pl/)
  const ROOT = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  let iframe = null;
  let softNavUsed = false;

  /* ── Helpers ─────────────────────────────────────────────── */

  function send(message) {
    if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage(message, WIDGET_ORIGIN);
  }

  function pageInfo() {
    return { path: location.pathname + location.search, title: document.title };
  }

  // Resolve a storefront path against the Markets root, same-origin only
  function storeUrl(path) {
    const relative = String(path || '').replace(/^\/+/, '');
    const url = new URL(relative, location.origin + ROOT);
    if (url.origin !== location.origin) throw new Error('Cross-origin navigation blocked');
    return url;
  }

  function readState() {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (!saved || Date.now() - saved.savedAt > STATE_TTL_MS) return null;
      return saved.state;
    } catch {
      return null;
    }
  }

  function writeState(state) {
    try {
      if (state) sessionStorage.setItem(STATE_KEY, JSON.stringify({ savedAt: Date.now(), state: state }));
      else sessionStorage.removeItem(STATE_KEY);
    } catch { /* storage unavailable — resume just won't work */ }
  }

  /* ── Soft navigation ─────────────────────────────────────────
     Swaps #MainContent in place instead of reloading the page, so the
     widget iframe — and the live voice session inside it — survives.
     Any failure falls back to a normal same-tab page load.            */

  function recreateScript(oldScript) {
    const script = document.createElement('script');
    for (const attr of oldScript.attributes) script.setAttribute(attr.name, attr.value);
    script.textContent = oldScript.textContent;
    return script;
  }

  function loadedScriptSrcs() {
    return new Set(Array.from(document.scripts).map(s => s.src).filter(Boolean));
  }

  async function refreshCartBubble() {
    const bubble = document.getElementById('cart-icon-bubble');
    if (!bubble) return;
    try {
      const res = await fetch(ROOT + '?sections=cart-icon-bubble');
      const sections = await res.json();
      const html = sections['cart-icon-bubble'];
      if (!html) return;
      const section = new DOMParser().parseFromString(html, 'text/html').querySelector('.shopify-section');
      if (section) bubble.innerHTML = section.innerHTML;
    } catch { /* cosmetic only */ }
  }

  async function softNavigate(url, push) {
    const res = await fetch(url.href, { credentials: 'same-origin', headers: { Accept: 'text/html' } });
    if (res.status === 404) return { ok: false, notFound: true };
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const finalUrl = new URL(res.url || url.href);
    if (finalUrl.origin !== location.origin) throw new Error('Redirected off-site');

    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const nextMain = doc.getElementById('MainContent');
    const currentMain = document.getElementById('MainContent');
    if (!nextMain || !currentMain) throw new Error('Page has no #MainContent');

    // Stylesheets referenced in the next page's <head> that this page lacks
    const haveCss = new Set(Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href));
    doc.querySelectorAll('head link[rel="stylesheet"]').forEach(link => {
      if (!haveCss.has(link.href)) document.head.appendChild(link.cloneNode(true));
    });

    const main = document.importNode(nextMain, true);
    // Scripts parsed by DOMParser never execute — re-create them, skipping
    // external scripts this page has already loaded
    const haveJs = loadedScriptSrcs();
    main.querySelectorAll('script').forEach(old => {
      if (old.src && haveJs.has(old.src)) { old.remove(); return; }
      old.replaceWith(recreateScript(old));
    });

    currentMain.replaceWith(main);
    document.title = doc.title;

    const nextBubble = doc.getElementById('cart-icon-bubble');
    const bubble = document.getElementById('cart-icon-bubble');
    if (nextBubble && bubble) bubble.innerHTML = nextBubble.innerHTML;

    if (push) history.pushState({ elevenlabsSoftNav: true }, '', finalUrl.pathname + finalUrl.search + finalUrl.hash);
    softNavUsed = true;
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent('elevenlabs:page-load', { detail: pageInfo() }));

    return { ok: true, path: pageInfo().path, title: document.title };
  }

  async function navigate(path) {
    let url;
    try {
      url = storeUrl(path);
    } catch (e) {
      return { ok: false, error: e.message };
    }
    try {
      return await softNavigate(url, true);
    } catch (e) {
      console.warn('ElevenLabs: soft navigation failed, loading page normally:', e.message);
      // The widget has already saved its state; it resumes after the load
      location.assign(url.href);
      return { ok: true, path: url.pathname, title: '', fullReload: true };
    }
  }

  async function addToCart(variantId, quantity) {
    const res = await fetch(ROOT + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: Number(variantId), quantity: Number(quantity) || 1 }] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.description || data.message || 'Could not add to cart' };

    const cart = await fetch(ROOT + 'cart.js').then(r => r.json()).catch(() => null);
    await refreshCartBubble();
    return {
      ok: true,
      itemCount: cart ? cart.item_count : null,
      totalPrice: cart ? cart.total_price / 100 : null,
      currency: cart ? cart.currency : null,
    };
  }

  /* ── Message handling ────────────────────────────────────── */

  async function handleRequest(data) {
    switch (data.type) {
      case 'el-navigate': return navigate(data.path);
      case 'el-add-to-cart': return addToCart(data.variantId, data.quantity);
      default: return { ok: false, error: 'Unknown request ' + data.type };
    }
  }

  function onMessage(event) {
    if (event.origin !== WIDGET_ORIGIN || !iframe || event.source !== iframe.contentWindow) return;
    const data = event.data || {};

    if (data.type === 'widget-opened') {
      iframe.style.width = '100vw';
      iframe.style.height = '100vh';
      iframe.style.maxWidth = '100%';
      iframe.style.maxHeight = '100%';
    } else if (data.type === 'widget-closed') {
      iframe.style.width = '100px';
      iframe.style.height = '100px';
      iframe.style.maxWidth = '';
      iframe.style.maxHeight = '';
    } else if (data.type === 'widget-ready') {
      send({ type: 'el-resume', state: readState(), page: pageInfo() });
    } else if (data.type === 'el-save-state') {
      writeState(data.state);
    } else if (data.type && data.id != null) {
      handleRequest(data)
        .catch(e => ({ ok: false, error: e.message }))
        .then(result => send(Object.assign({ type: 'el-result', id: data.id }, result)));
    }
  }

  function initWidget() {
    iframe = document.createElement('iframe');
    iframe.id = 'elevenlabs-widget-frame';
    iframe.src = WIDGET_BASE_URL + '/?embed=true'
      + '&agentId=' + encodeURIComponent(agentId)
      + '&host=' + encodeURIComponent(location.origin);
    iframe.setAttribute('allowtransparency', 'true');

    // Start SMALL — just enough for the launcher button (bottom-right corner)
    iframe.style.cssText = `
      position: fixed;
      bottom: 0;
      right: 0;
      width: 100px;
      height: 100px;
      border: none;
      background: transparent;
      z-index: 2147483647;
      pointer-events: auto;
      color-scheme: normal;
    `;

    iframe.allow = 'microphone; autoplay';
    iframe.title = 'ElevenLabs Shopping Assistant';

    window.addEventListener('message', onMessage);

    // Back/forward across soft-navigated entries: swap content again
    window.addEventListener('popstate', function() {
      if (!softNavUsed) return;
      softNavigate(new URL(location.href), false).catch(() => location.reload());
    });

    document.body.appendChild(iframe);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
