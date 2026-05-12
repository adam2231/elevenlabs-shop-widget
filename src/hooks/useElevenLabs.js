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

export default function useElevenLabs({ agentId, onAgentMessage, onUserMessage, onProductsReceived } = {}) {
  const [status, setStatus] = useState('disconnected')
  const [mode, setMode] = useState('text')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [micError, setMicError] = useState(null)
  const conversationRef = useRef(null)

  const onAgentMessageRef = useRef(onAgentMessage)
  const onUserMessageRef = useRef(onUserMessage)
  const onProductsReceivedRef = useRef(onProductsReceived)
  onAgentMessageRef.current = onAgentMessage
  onUserMessageRef.current = onUserMessage
  onProductsReceivedRef.current = onProductsReceived

  const buildClientTools = useCallback(() => ({
    show_products_shopify: async (params) => {
      console.log('show_products raw params:', JSON.stringify(params, null, 2))
      
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
      
      if (handles.length === 0) {
        console.warn('No product handles found in params:', params)
        return 'No products to display.'
      }
      
      try {
        const productPromises = handles.map(handle => 
          fetch(`/api/shopify/product/${handle}`).then(r => r.json())
        )
        const products = await Promise.all(productPromises)
        const validProducts = products.filter(p => p && !p.error)
        
        if (validProducts.length > 0) {
          onProductsReceivedRef.current?.({ products: validProducts, currency: 'USD' })
        }
        return `Displayed ${validProducts.length} product(s) to user successfully.`
      } catch (error) {
        console.error('Error fetching Shopify products:', error)
        return 'Error displaying products.'
      }
    },
    
    navigate_to_product: async (params) => {
      let productHandle = params.product_handle || params.handle || params.product_id || params.productHandle
      if (!productHandle) return 'Could not navigate: no product specified.'
      productHandle = productHandle.toLowerCase().trim().replace(/\s+/g, '-')
      const productUrl = `https://green-dot-7952.myshopify.com/products/${productHandle}`
      window.open(productUrl, '_blank')
      return `Opened product page for ${productHandle}.`
    },
    
    navigate_to_category: async (params) => {
      let category = params.category || params.collection || params.categoryName
      if (!category) return 'Could not navigate: no category specified.'
      
      const matchResult = matchCollection(category)
      
      if (matchResult.exact && matchResult.matches.length === 1) {
        const collection = matchResult.matches[0]
        window.open(`https://green-dot-7952.myshopify.com/collections/${collection.handle}`, '_blank')
        return `Opened ${collection.handle} collection page.`
      } else if (matchResult.matches.length === 2) {
        const [o1, o2] = matchResult.matches
        return `I found two similar categories: "${o1.handle}" (${o1.products} items) and "${o2.handle}" (${o2.products} items). Which would you like to see?`
      } else if (matchResult.matches.length === 1) {
        return `Did you mean "${matchResult.matches[0].handle}"? I can take you there if you'd like.`
      } else {
        const available = Object.values(COLLECTIONS).map(c => c.handle).join(', ')
        return `I couldn't find a category matching "${category}". Available collections are: ${available}. Which would you like to see?`
      }
    },
    
    navigate_to_cart: async () => {
      window.open('https://green-dot-7952.myshopify.com/cart', '_blank')
      return 'Opened shopping cart.'
    },
    
    add_to_cart: async (params) => {
      let productHandle = params.product_handle || params.handle || params.product
      let variantId = params.variant_id || params.variantId
      let quantity = params.quantity || 1
      
      if (!productHandle && !variantId) return 'Could not add to cart: no product specified.'
      
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
        }
        return 'Failed to add item to cart.'
      } catch (error) {
        console.error('Error adding to cart:', error)
        return 'Error adding item to cart. Please try again.'
      }
    },
  }), [])

  const startSession = useCallback(async ({ textOnly = false } = {}) => {
    // End any existing session first
    if (conversationRef.current) {
      try { await conversationRef.current.endSession() } catch {}
      conversationRef.current = null
    }

    setMicError(null)

    try {
      setStatus('connecting')

      // For voice mode, request mic FIRST before tearing anything down
      if (!textOnly) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          // Got permission — release the test stream immediately
          stream.getTracks().forEach(t => t.stop())
        } catch (micErr) {
          console.error('Microphone access failed:', micErr)
          const errorMsg = micErr.name === 'NotAllowedError'
            ? 'Microphone permission denied. Please allow microphone access and try again.'
            : micErr.name === 'NotFoundError'
            ? 'No microphone found. Please connect a microphone and try again.'
            : `Microphone error: ${micErr.message}`
          
          setMicError(errorMsg)
          // Fall back to text mode instead of leaving the user disconnected
          setStatus('disconnected')
          return { success: false, error: errorMsg }
        }
      }

      const config = {
        onConnect: () => { setStatus('connected'); setMicError(null) },
        onDisconnect: () => { setStatus('disconnected'); setIsSpeaking(false) },
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
        clientTools: buildClientTools(),
      }

      // Fetch signed URL
      const signedUrlEndpoint = agentId 
        ? `/api/signed-url-embed?agentId=${encodeURIComponent(agentId)}` 
        : '/api/signed-url'
      
      const urlRes = await fetch(signedUrlEndpoint)
      if (!urlRes.ok) {
        throw new Error(`Failed to get signed URL: ${urlRes.status}`)
      }
      const { signedUrl } = await urlRes.json()
      config.signedUrl = signedUrl
      config.connectionType = 'websocket'

      if (textOnly) {
        config.overrides = { conversation: { textOnly: true } }
      }

      conversationRef.current = await Conversation.startSession(config)
      setMode(textOnly ? 'text' : 'voice')
      return { success: true }
    } catch (err) {
      console.error('Failed to start session:', err)
      setStatus('disconnected')
      return { success: false, error: err.message }
    }
  }, [agentId, buildClientTools])

  const endSession = useCallback(async () => {
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
