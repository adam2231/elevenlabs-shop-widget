// Messaging bridge between the widget iframe and the host storefront page.
// The host side lives in public/embed.js — only it can navigate the shopper's
// tab or call the Shopify cart API with the shopper's cookies.

const params = new URLSearchParams(window.location.search)
const hostOrigin = params.get('host')

export const isEmbedded = window.parent !== window && !!hostOrigin

const REQUEST_TIMEOUT_MS = 10000
let nextId = 1
const pending = new Map()
const listeners = new Set()

if (isEmbedded) {
  window.addEventListener('message', (event) => {
    if (event.origin !== hostOrigin || event.source !== window.parent) return
    const data = event.data || {}
    if (data.type === 'el-result' && pending.has(data.id)) {
      pending.get(data.id)(data)
      pending.delete(data.id)
      return
    }
    listeners.forEach(fn => fn(data))
  })
}

export function postToHost(type, payload = {}) {
  if (isEmbedded) window.parent.postMessage({ type, ...payload }, hostOrigin)
}

// Sends a request to the host page and resolves with its reply
export function requestHost(type, payload = {}) {
  if (!isEmbedded) return Promise.resolve({ ok: false, error: 'Widget is not embedded in a store page' })
  const id = nextId++
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      resolve({ ok: false, error: 'The store page did not respond' })
    }, REQUEST_TIMEOUT_MS)
    pending.set(id, (data) => { clearTimeout(timer); resolve(data) })
    window.parent.postMessage({ type, id, ...payload }, hostOrigin)
  })
}

export function onHostMessage(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
