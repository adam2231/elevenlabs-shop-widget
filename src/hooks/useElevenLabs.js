import { useState, useCallback, useRef } from 'react'
import { Conversation } from '@elevenlabs/client'

export default function useElevenLabs({ onAgentMessage, onUserMessage, onProductsReceived } = {}) {
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

        // Register client tools — the agent calls these, our code handles them
        clientTools: {
          show_products: async (params) => {
            console.log('show_products raw params:', JSON.stringify(params))
            
            const { currency, ...rest } = params
            
            // Extract products from whatever shape arrives
            let products = []
            
            if (rest.products) {
              // products came as a single object or has sub-properties
              if (Array.isArray(rest.products)) {
                products = rest.products
              } else if (rest.products.id) {
                // Single product object
                products = [rest.products]
              } else {
                // Object with named keys — extract values
                products = Object.values(rest.products).filter(
                  v => v && typeof v === 'object' && v.id
                )
              }
            } else {
              // Products might be at top level as product_1, product_2, etc.
              products = Object.values(rest).filter(
                v => v && typeof v === 'object' && v.id
              )
            }

            if (products.length > 0) {
              onProductsReceivedRef.current?.({ products, currency: currency || 'EUR' })
            }
            
            return 'Products displayed to user successfully.'
          },
        },
      }

      // Fetch a fresh signed URL from our backend
      const urlRes = await fetch('/api/signed-url')
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
  }, [])

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
