import { useState, useCallback, useRef } from 'react'
import { Conversation } from '@elevenlabs/client'
import { isEmbedded, requestHost } from '../lib/hostBridge'

const STORE_URL = 'https://green-dot-7952.myshopify.com'

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_BASE_DELAY_MS = 1500
const SIGNED_URL_TIMEOUT_MS = 10000

// Maps a natural-language reference to a real product/collection handle
async function resolveHandle(type, query) {
  const res = await fetch(`/api/shopify/resolve?type=${type}&q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`resolve failed: ${res.status}`)
  return res.json()
}

function describeCandidates(candidates) {
  return candidates.map(c => `"${c.title}"`).join(' or ')
}

function unresolvedMessage(kind, query, candidates) {
  if (candidates.length > 0) {
    return `"${query}" matches more than one ${kind}: ${describeCandidates(candidates)}. Ask the customer which one they mean, then call this tool again with that exact name.`
  }
  return `No ${kind} matching "${query}" exists in the store. Tell the customer, and offer to search the catalog instead.`
}

// Same-tab navigation through the host page; standalone (non-embedded) use opens a tab
async function goTo(path) {
  if (!isEmbedded) {
    window.open(`${STORE_URL}${path}`, '_blank')
    return { ok: true }
  }
  return requestHost('el-navigate', { path })
}

export default function useElevenLabs({ agentId, onAgentMessage, onUserMessage, onProductsReceived } = {}) {
  const [status, setStatus] = useState('disconnected')
  const [mode, setMode] = useState('text')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [micError, setMicError] = useState(null)
  const conversationRef = useRef(null)

  // Keep latest callbacks available to the SDK without re-starting the session
  const onAgentMessageRef = useRef(onAgentMessage)
  const onUserMessageRef = useRef(onUserMessage)
  const onProductsReceivedRef = useRef(onProductsReceived)
  onAgentMessageRef.current = onAgentMessage
  onUserMessageRef.current = onUserMessage
  onProductsReceivedRef.current = onProductsReceived

  // Reconnect state
  const reconnectTimerRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const isIntentionalDisconnectRef = useRef(false)
  const lastTextOnlyRef = useRef(true)
  // Ref so onDisconnect / reconnect timers always call the latest startSession
  const startSessionRef = useRef(null)

  const scheduleReconnect = useCallback(() => {
    if (isIntentionalDisconnectRef.current) return
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('ElevenLabs: max reconnect attempts reached, giving up.')
      return
    }
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current), 30000)
    reconnectAttemptsRef.current++
    console.log(`ElevenLabs: reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`)
    clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = setTimeout(() => {
      // Reconnect silently — the customer has already been greeted
      startSessionRef.current?.({ textOnly: lastTextOnlyRef.current, silent: true, _isReconnect: true })
    }, delay)
  }, [])

  /**
   * silent  — start without the agent's greeting (first message override)
   * context — background text sent to the agent right after connecting
   */
  const startSession = useCallback(async ({ textOnly = false, silent = false, context = null, _isReconnect = false } = {}) => {
    // Cancel any pending reconnect timer
    clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = null

    // Explicit (non-reconnect) calls reset the counter and clear the intentional flag
    if (!_isReconnect) {
      reconnectAttemptsRef.current = 0
      isIntentionalDisconnectRef.current = false
    }

    lastTextOnlyRef.current = textOnly

    // End any existing session before starting a new one
    if (conversationRef.current) {
      try { await conversationRef.current.endSession() } catch {}
      conversationRef.current = null
    }

    setMicError(null)

    try {
      setStatus('connecting')

      // For voice mode, request mic permission FIRST
      // If it fails, we bail early without tearing down the user's experience
      if (!textOnly) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          // Got permission — release the test stream immediately
          stream.getTracks().forEach(t => t.stop())
        } catch (micErr) {
          console.error('Microphone access failed:', micErr)
          const errorMsg = micErr.name === 'NotAllowedError'
            ? 'Microphone permission denied. Please allow mic access in your browser and try again.'
            : micErr.name === 'NotFoundError'
            ? 'No microphone found. Please connect a microphone and try again.'
            : `Microphone error: ${micErr.message}`

          setMicError(errorMsg)
          setStatus('disconnected')
          return { success: false, error: errorMsg }
        }
      }

      const config = {
        onConnect: () => {
          setStatus('connected')
          setMicError(null)
          // Reset counter so future unexpected disconnects get a full retry budget
          reconnectAttemptsRef.current = 0
        },
        onDisconnect: (details) => {
          setStatus('disconnected')
          setIsSpeaking(false)
          // Only a dropped connection is worth retrying. An agent-side end
          // (end_call, idle timeout, max duration) must stay ended — retrying
          // those opened a fresh conversation every minute.
          if (details?.reason === 'error') scheduleReconnect()
        },
        onModeChange: (m) => setIsSpeaking(m?.mode === 'speaking'),
        onMessage: ({ message, source }) => {
          if (!message) return
          if (source === 'ai' || source === 'agent') {
            onAgentMessageRef.current?.(message)
          } else if (source === 'user') {
            onUserMessageRef.current?.(message)
          }
        },
        onError: (err) => console.error('ElevenLabs error:', err),

        clientTools: {
          show_products_shopify: async (params) => {
            let handles = params.product_handles ?? params.handles ?? []
            if (typeof handles === 'string') handles = [handles]

            if (handles.length === 0) return 'No products to display.'

            try {
              const products = await Promise.all(handles.map(handle =>
                fetch(`/api/shopify/product/${encodeURIComponent(handle)}`).then(r => r.json()).catch(() => null)
              ))
              const validProducts = products.filter(p => p && !p.error)
              const missing = handles.filter(h => !validProducts.some(p => p.handle === h))

              if (validProducts.length > 0) {
                onProductsReceivedRef.current?.({ products: validProducts })
              }

              let result = `Displayed ${validProducts.length} product card(s): ${validProducts.map(p => p.name).join(', ') || 'none'}.`
              if (missing.length) result += ` These handles do not exist and were NOT shown: ${missing.join(', ')}. Only use handles returned by the catalog search.`
              return result
            } catch (error) {
              console.error('Error fetching Shopify products:', error)
              return 'Error displaying products.'
            }
          },

          navigate_to_product: async (params) => {
            const ref = params.product_handle || params.handle || params.product_name || params.product
            if (!ref) return 'Could not navigate: no product specified.'

            try {
              const { match, candidates = [] } = await resolveHandle('product', ref)
              if (!match) return unresolvedMessage('product', ref, candidates)

              const result = await goTo(`/products/${match.handle}`)
              if (!result.ok) return `Could not open the ${match.title} page: ${result.error || 'page not found'}.`
              return `The customer is now viewing the ${match.title} product page.`
            } catch (error) {
              console.error('navigate_to_product failed:', error)
              return 'Navigation failed because of a technical error.'
            }
          },

          navigate_to_category: async (params) => {
            const ref = params.category || params.collection || params.categoryName
            if (!ref) return 'Could not navigate: no category specified.'

            try {
              const { match, candidates = [] } = await resolveHandle('collection', ref)
              if (!match) return unresolvedMessage('collection', ref, candidates)

              const result = await goTo(`/collections/${match.handle}`)
              if (!result.ok) return `Could not open the ${match.title} collection: ${result.error || 'page not found'}.`
              return `The customer is now viewing the ${match.title} collection (${match.productsCount} products).`
            } catch (error) {
              console.error('navigate_to_category failed:', error)
              return 'Navigation failed because of a technical error.'
            }
          },

          navigate_to_cart: async () => {
            const result = await goTo('/cart')
            if (!result.ok) return `Could not open the cart: ${result.error || 'unknown error'}.`
            return 'The customer is now viewing their shopping cart, where they can check out.'
          },

          add_to_cart: async (params) => {
            const ref = params.product_handle || params.handle || params.product
            const quantity = Math.max(1, parseInt(params.quantity, 10) || 1)
            if (!ref) return 'Could not add to cart: no product specified.'

            try {
              const { match, candidates = [] } = await resolveHandle('product', ref)
              if (!match) return unresolvedMessage('product', ref, candidates)

              const product = await fetch(`/api/shopify/product/${match.handle}`).then(r => r.json())
              if (!product?.variantId) return `Could not load ${match.title} from the store.`
              if (product.inStock === false) return `${product.name} is sold out and cannot be added to the cart.`

              if (!isEmbedded) {
                const { url } = await fetch('/api/shopify/add-to-cart', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ variantId: product.variantId, quantity }),
                }).then(r => r.json())
                window.open(url, '_blank')
                return `Added ${quantity} x ${product.name} to the cart.`
              }

              const result = await requestHost('el-add-to-cart', { variantId: product.variantId, quantity })
              if (!result.ok) return `Could not add ${product.name} to the cart: ${result.error}.`

              const total = result.totalPrice != null ? ` Cart total is now ${result.totalPrice} ${result.currency}.` : ''
              return `Added ${quantity} x ${product.name} to the cart. The cart now holds ${result.itemCount} item(s).${total} The customer is still on the same page.`
            } catch (error) {
              console.error('Error adding to cart:', error)
              return 'Error adding item to cart. Please try again.'
            }
          },
        },
      }

      const overrides = {}
      if (textOnly) overrides.conversation = { textOnly: true }
      if (silent) overrides.agent = { firstMessage: '' }
      if (Object.keys(overrides).length) config.overrides = overrides

      // Fetch credentials from our backend (with timeout).
      // Text mode → signed URL (WebSocket). Voice mode → conversation token (WebRTC/LiveKit).
      const fetchController = new AbortController()
      const fetchTimeout = setTimeout(() => fetchController.abort(), SIGNED_URL_TIMEOUT_MS)

      try {
        if (textOnly) {
          const endpoint = agentId
            ? `/api/signed-url-embed?agentId=${encodeURIComponent(agentId)}`
            : '/api/signed-url'
          const res = await fetch(endpoint, { signal: fetchController.signal })
          if (!res.ok) throw new Error(`Failed to get signed URL: ${res.status}`)
          const { signedUrl } = await res.json()
          if (isIntentionalDisconnectRef.current) return { success: false, error: 'Session cancelled' }
          config.signedUrl = signedUrl
          // SDK infers connectionType = 'websocket' from signedUrl
        } else {
          const endpoint = agentId
            ? `/api/conversation-token?agentId=${encodeURIComponent(agentId)}`
            : '/api/conversation-token'
          const res = await fetch(endpoint, { signal: fetchController.signal })
          if (!res.ok) throw new Error(`Failed to get conversation token: ${res.status}`)
          const { conversationToken } = await res.json()
          if (isIntentionalDisconnectRef.current) return { success: false, error: 'Session cancelled' }
          config.conversationToken = conversationToken
          // SDK infers connectionType = 'webrtc' from conversationToken
        }
      } finally {
        clearTimeout(fetchTimeout)
      }

      conversationRef.current = await Conversation.startSession(config)
      setMode(textOnly ? 'text' : 'voice')
      if (context) conversationRef.current.sendContextualUpdate(context)
      return { success: true }
    } catch (err) {
      console.error('Failed to start session:', err)
      setStatus('disconnected')
      // Don't retry if intentionally closed or if it was a mic-permission bail-out
      if (!isIntentionalDisconnectRef.current && err.name !== 'AbortError') {
        scheduleReconnect()
      }
      return { success: false, error: err.message }
    }
  }, [agentId, scheduleReconnect])

  // Keep ref current so reconnect timers always call the latest startSession
  startSessionRef.current = startSession

  const endSession = useCallback(async () => {
    // Mark as intentional so onDisconnect doesn't schedule a reconnect
    isIntentionalDisconnectRef.current = true
    clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = null
    reconnectAttemptsRef.current = 0

    if (conversationRef.current) {
      try { await conversationRef.current.endSession() } catch {}
      conversationRef.current = null
    }
    setStatus('disconnected')
    setIsSpeaking(false)
  }, [])

  const sendUserMessage = useCallback((text) => {
    const c = conversationRef.current
    if (c && typeof c.sendUserMessage === 'function') {
      c.sendUserMessage(text)
      return true
    }
    return false
  }, [])

  const sendUserActivity = useCallback(() => {
    const c = conversationRef.current
    if (c && typeof c.sendUserActivity === 'function') c.sendUserActivity()
  }, [])

  const sendContextualUpdate = useCallback((text) => {
    const c = conversationRef.current
    if (c && typeof c.sendContextualUpdate === 'function') c.sendContextualUpdate(text)
  }, [])

  return {
    status,
    mode,
    isSpeaking,
    micError,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    startSession,
    endSession,
    sendUserMessage,
    sendUserActivity,
    sendContextualUpdate,
  }
}
