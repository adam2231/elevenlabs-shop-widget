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
            
            const { currency, product, products } = params
            
            // Extract products - ElevenLabs sends as "product" (singular), not "products"
            let productArray = []
            
            if (product) {
              // Main path: ElevenLabs sends product as array or object
              if (Array.isArray(product)) {
                productArray = product
              } else if (product.id) {
                // Single product object
                productArray = [product]
              } else if (typeof product === 'object') {
                // Object with named keys — extract values
                productArray = Object.values(product).filter(
                  v => v && typeof v === 'object' && v.id
                )
              }
            } else if (products) {
              // Fallback: check plural form
              if (Array.isArray(products)) {
                productArray = products
              } else if (products.id) {
                productArray = [products]
              } else if (typeof products === 'object') {
                // Object with named keys
                productArray = Object.values(products).filter(
                  v => v && typeof v === 'object' && v.id
                )
              }
            }

            console.log('Extracted products:', productArray)

            if (productArray.length > 0) {
              onProductsReceivedRef.current?.({ 
                products: productArray, 
                currency: currency || 'EUR' 
              })
            } else {
              console.warn('No products extracted from params:', params)
            }
            
            return 'Products displayed to user successfully.'
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