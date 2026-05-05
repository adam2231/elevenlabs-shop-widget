import { useState, useCallback, useRef } from 'react'
import { Conversation } from '@elevenlabs/client'

export default function useElevenLabs({ agentId, onAgentMessage, onUserMessage, onProductsReceived } = {}) {
  const [status, setStatus] = useState('disconnected')
  const [mode, setMode] = useState('text')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const conversationRef = useRef(null)

  // Keep latest callbacks available to the SDK without re-starting the session
  const onAgentMessageRef = useRef(onAgentMessage)
  const onUserMessageRef = useRef(onUserMessage)
  const onProductsReceivedRef = useRef(onProductsReceived)
  onAgentMessageRef.current = onAgentMessage
  onUserMessageRef.current = onUserMessage
  onProductsReceivedRef.current = onProductsReceived

  const startSession = useCallback(async ({ textOnly = false } = {}) => {
    // End any existing session before starting a new one
    if (conversationRef.current) {
      try { await conversationRef.current.endSession() } catch {}
      conversationRef.current = null
    }

    try {
      setStatus('connecting')

      if (!textOnly) {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      }

      const config = {
        onConnect: () => setStatus('connected'),
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

        clientTools: {
          show_products: async (params) => {
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
                  currency: 'USD' // Shopify uses store currency
                })
              }
              
              return `Displayed ${validProducts.length} product(s) to user successfully.`
            } catch (error) {
              console.error('Error fetching Shopify products:', error)
              return 'Error displaying products.'
            }
          },
        },
      }

      // Fetch a fresh signed URL from our backend
      // If agentId is provided (embed mode), pass it as a query parameter
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
    } catch (err) {
      console.error('Failed to start session:', err)
      setStatus('disconnected')
    }
  }, [agentId])

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
    isConnected: status === 'connected',
    startSession,
    endSession,
    sendUserMessage,
    sendUserActivity,
  }
}