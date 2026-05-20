import { useState, useCallback, useRef } from 'react'
import { Conversation } from '@elevenlabs/client'

// Available Shopify collections with their handles and aliases
const COLLECTIONS = {
  'business-formal': {
    handle: 'business-formal',
    aliases: ['business formal', 'formal wear', 'formal', 'suit', 'suits'],
    products: 20
  },
  'mens-trousers': {
    handle: 'mens-trousers',
    aliases: ['mens trousers', 'men trousers', 'pants', 'trousers', 'mens pants', 'men pants'],
    products: 8
  },
  'mens': {
    handle: 'mens',
    aliases: ['mens', 'men', 'mens clothing', 'men clothing', 'mens catalog', 'men catalog', 'mens products', 'men products'],
    products: 34
  },
  'business-casual': {
    handle: 'business-casual',
    aliases: ['business casual', 'casual wear', 'smart casual', 'casual'],
    products: 14
  },
  'mens-shirts': {
    handle: 'mens-shirts',
    aliases: ['mens shirts', 'men shirts', 'shirts', 'dress shirts', 'button ups'],
    products: 10
  },
  'womens': {
    handle: 'womens',
    aliases: ['womens', 'women', 'womens clothing', 'women clothing', 'womens catalog', 'women catalog'],
    products: 33
  }
}

// Fuzzy match user input to collection
function matchCollection(userInput) {
  const input = userInput.toLowerCase().trim()
  
  for (const [, data] of Object.entries(COLLECTIONS)) {
    if (data.handle === input || data.aliases.some(alias => alias === input)) {
      return { exact: true, matches: [data] }
    }
  }
  
  const matches = []
  for (const [, data] of Object.entries(COLLECTIONS)) {
    if (data.aliases.some(alias => alias.includes(input) || input.includes(alias))) {
      matches.push(data)
    }
  }
  
  return { exact: false, matches: matches.slice(0, 2) }
}

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_BASE_DELAY_MS = 1500
const SIGNED_URL_TIMEOUT_MS = 10000

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
      startSessionRef.current?.({ textOnly: lastTextOnlyRef.current, _isReconnect: true })
    }, delay)
  }, [])

  const startSession = useCallback(async ({ textOnly = false, _isReconnect = false } = {}) => {
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
        onDisconnect: () => {
          setStatus('disconnected')
          setIsSpeaking(false)
          scheduleReconnect()
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
            console.log('show_products raw params:', JSON.stringify(params, null, 2))
            
            // Extract product handles from params
            let handles = []
            
            if (params.product_handles && Array.isArray(params.product_handles)) {
              handles = params.product_handles
            } else if (params.product_handles && typeof params.product_handles === 'string') {
              handles = [params.product_handles]
            } else if (params.handles && Array.isArray(params.handles)) {
              handles = params.handles
            } else if (params.handles && typeof params.handles === 'string') {
              handles = [params.handles]
            }
            
            console.log('Extracted handles:', handles)
            
            if (handles.length === 0) {
              console.warn('No product handles found in params:', params)
              return 'No products to display.'
            }
            
            // Fetch product details from Shopify API
            try {
              const productPromises = handles.map(handle => 
                fetch(`/api/shopify/product/${handle}`).then(r => r.json())
              )
              
              const products = await Promise.all(productPromises)
              const validProducts = products.filter(p => p && !p.error)
              
              console.log('Fetched Shopify products:', validProducts)
              
              if (validProducts.length > 0) {
                onProductsReceivedRef.current?.({ 
                  products: validProducts,
                  currency: 'USD'
                })
              }
              
              return `Displayed ${validProducts.length} product(s) to user successfully.`
            } catch (error) {
              console.error('Error fetching Shopify products:', error)
              return 'Error displaying products.'
            }
          },
          
          navigate_to_product: async (params) => {
            console.log('navigate_to_product params:', params)
            
            let productHandle = params.product_handle || params.handle || params.product_id || params.productHandle
            
            if (!productHandle) {
              console.warn('No product handle provided in params:', params)
              return 'Could not navigate: no product specified.'
            }
            
            productHandle = productHandle.toLowerCase().trim().replace(/\s+/g, '-')
            
            console.log('Navigating to product:', productHandle)
            
            const productUrl = `https://green-dot-7952.myshopify.com/products/${productHandle}`
            window.open(productUrl, '_blank')
            
            return `Opened product page for ${productHandle}.`
          },
          
          navigate_to_category: async (params) => {
            console.log('navigate_to_category params:', params)
            
            let category = params.category || params.collection || params.categoryName
            
            if (!category) {
              console.warn('No category provided in params:', params)
              return 'Could not navigate: no category specified.'
            }
            
            const matchResult = matchCollection(category)
            
            if (matchResult.exact && matchResult.matches.length === 1) {
              const collection = matchResult.matches[0]
              const categoryUrl = `https://green-dot-7952.myshopify.com/collections/${collection.handle}`
              console.log('Exact match found, navigating to:', categoryUrl)
              window.open(categoryUrl, '_blank')
              return `Opened ${collection.handle} collection page.`
            } else if (matchResult.matches.length === 2) {
              const option1 = matchResult.matches[0]
              const option2 = matchResult.matches[1]
              return `I found two similar categories: "${option1.handle}" (${option1.products} items) and "${option2.handle}" (${option2.products} items). Which would you like to see?`
            } else if (matchResult.matches.length === 1) {
              const collection = matchResult.matches[0]
              return `Did you mean "${collection.handle}"? I can take you there if you'd like.`
            } else {
              const availableCollections = Object.values(COLLECTIONS).map(c => c.handle).join(', ')
              return `I couldn't find a category matching "${category}". Available collections are: ${availableCollections}. Which would you like to see?`
            }
          },
          
          navigate_to_cart: async () => {
            console.log('Navigating to cart')
            const cartUrl = 'https://green-dot-7952.myshopify.com/cart'
            window.open(cartUrl, '_blank')
            return 'Opened shopping cart.'
          },
          
          add_to_cart: async (params) => {
            console.log('add_to_cart params:', params)
            
            let productHandle = params.product_handle || params.handle || params.product
            let variantId = params.variant_id || params.variantId
            let quantity = params.quantity || 1
            
            if (!productHandle && !variantId) {
              console.warn('No product specified in add_to_cart')
              return 'Could not add to cart: no product specified.'
            }
            
            try {
              if (productHandle && !variantId) {
                const cleanHandle = productHandle.toLowerCase().trim().replace(/\s+/g, '-')
                const productRes = await fetch(`/api/shopify/product/${cleanHandle}`)
                const product = await productRes.json()
                
                if (product && product.variantId) {
                  variantId = product.variantId
                } else {
                  return `Could not find product "${productHandle}" to add to cart.`
                }
              }
              
              const addRes = await fetch('/api/shopify/add-to-cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ variantId, quantity })
              })
              
              const { url } = await addRes.json()
              
              if (url) {
                window.open(url, '_blank')
                return `Added ${quantity}x "${productHandle}" to cart successfully. Cart page opened.`
              } else {
                return 'Failed to add item to cart.'
              }
            } catch (error) {
              console.error('Error adding to cart:', error)
              return 'Error adding item to cart. Please try again.'
            }
          },
        },
      }

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
          config.overrides = { conversation: { textOnly: true } }
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
  }
}