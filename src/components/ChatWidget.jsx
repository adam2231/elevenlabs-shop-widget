import { useState, useRef, useEffect, useCallback } from 'react'
import ProductCarousel from './ProductCarousel'
import useElevenLabs from '../hooks/useElevenLabs'

const DELOITTE_GREEN = '#86BC25'

export default function ChatWidget({ embedConfig = { isEmbed: false, agentId: null } }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)
  const modeRef = useRef('text')

  // Pending products buffer: when the agent calls show_products,
  // the products arrive before or alongside the text message.
  // We store them here and attach to the next agent message.
  const pendingProductsRef = useRef(null)

  // Notify parent window (for embed mode) when widget opens/closes
  useEffect(() => {
    if (embedConfig.isEmbed && window.parent !== window) {
      window.parent.postMessage(
        { type: isOpen ? 'widget-opened' : 'widget-closed' },
        '*'
      )
    }
  }, [isOpen, embedConfig.isEmbed])

  const handleAgentMessage = useCallback((text) => {
    setIsTyping(false)

    // Attach any pending products from a show_products tool call
    const pending = pendingProductsRef.current
    pendingProductsRef.current = null

    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      role: 'agent',
      text,
      products: pending?.products || [],
      currency: pending?.currency || 'EUR',
    }])
  }, [])

  const handleUserMessage = useCallback((text) => {
    // Voice transcriptions only — in text mode the message is already added on send
    if (modeRef.current !== 'voice') return
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      role: 'user',
      text,
      products: [],
    }])
  }, [])

  const handleProductsReceived = useCallback(({ products, currency }) => {
    // Store products to attach to the next agent text message
    pendingProductsRef.current = { products, currency }
  }, [])

  const {
    isConnected,
    isSpeaking,
    mode,
    startSession,
    endSession,
    sendUserMessage,
    sendUserActivity,
  } = useElevenLabs({
    agentId: embedConfig.agentId,  // ADD THIS LINE
    onAgentMessage: handleAgentMessage,
    onUserMessage: handleUserMessage,
    onProductsReceived: handleProductsReceived,
  })

  useEffect(() => { modeRef.current = mode }, [mode])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-start text session on mount
  useEffect(() => {
    startSession({ textOnly: true })
    return () => { endSession() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSend = () => {
    if (!input.trim() || !isConnected) return
    const text = input.trim()
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: 'user',
      text,
      products: [],
    }])
    setInput('')
    setIsTyping(true)
    sendUserMessage(text)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e) => {
    setInput(e.target.value)
    sendUserActivity()
  }

  const toggleVoice = async () => {
    if (mode === 'voice') {
      await endSession()
      await startSession({ textOnly: true })
    } else {
      await endSession()
      await startSession({ textOnly: false })
    }
  }

  const handleBuyNow = async (product, currency) => {
    const rawPrice = currency === 'PLN' ? product.price_pln : (product.price_eur || product.price)
    const price = parseFloat(String(rawPrice || '0').replace(/[^\d.]/g, ''))
    const cur = currency === 'PLN' ? 'pln' : 'eur'

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name || product.id,
          price,
          currency: cur,
        }),
      })
      const { url } = await res.json()
      if (url) window.open(url, '_blank')
    } catch {
      alert('Checkout unavailable — Stripe not configured yet.')
    }
  }

  return (
    <>
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: '90px', right: '24px',
          width: '520px', maxWidth: 'calc(100vw - 32px)',
          height: '700px', maxHeight: 'calc(100vh - 120px)',
          background: '#fff', borderRadius: '16px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          zIndex: 999, fontFamily: 'system-ui, sans-serif',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid #f0f0f0',
            display: 'flex', alignItems: 'center', gap: '12px',
            background: '#fff', flexShrink: 0
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: DELOITTE_GREEN,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#111' }}>Green Dot · Style Assistant</div>
              <div style={{ fontSize: '12px', color: '#888' }}>
                {mode === 'voice' ? 'Voice mode' : 'Text mode'} · Powered by ElevenLabs
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: isConnected ? '#22c55e' : '#d1d5db'
              }} />
              <button onClick={() => setIsOpen(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '20px', color: '#888', lineHeight: 1
              }}>✕</button>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '20px',
            display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            {messages.map(msg => (
              <div key={msg.id}>
                <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '10px' }}>
                  {msg.role === 'agent' && (
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: isSpeaking ? '#22c55e' : DELOITTE_GREEN,
                      flexShrink: 0, marginTop: '2px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.3s'
                    }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff' }} />
                    </div>
                  )}
                  <div style={{
                    background: msg.role === 'user' ? '#111' : '#f5f5f5',
                    color: msg.role === 'user' ? '#fff' : '#111',
                    borderRadius: msg.role === 'user' ? '18px 6px 18px 18px' : '6px 18px 18px 18px',
                    padding: '12px 16px', maxWidth: '75%',
                    fontSize: '14px', lineHeight: '1.5'
                  }}>
                    {msg.text}
                  </div>
                </div>
                {msg.products && msg.products.length > 0 && (
                  <ProductCarousel
                    products={msg.products}
                    currency={msg.currency}
                    onBuyNow={handleBuyNow}
                  />
                )}
              </div>
            ))}
            {isTyping && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: DELOITTE_GREEN, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff' }} />
                </div>
                <div style={{
                  background: '#f5f5f5', borderRadius: '6px 18px 18px 18px',
                  padding: '12px 16px', fontSize: '14px', color: '#888'
                }}>
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div style={{
            padding: '16px', borderTop: '1px solid #f0f0f0',
            display: 'flex', alignItems: 'center', gap: '10px',
            background: '#fff', flexShrink: 0
          }}>
            <button onClick={toggleVoice} title={mode === 'voice' ? 'Switch to text' : 'Switch to voice'} style={{
              width: '42px', height: '42px', borderRadius: '50%',
              background: mode === 'voice' ? DELOITTE_GREEN : '#111',
              border: 'none', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v7a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-1 17.93V22h2v-1.07A8 8 0 0 0 20 13h-2a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93z" />
              </svg>
            </button>
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'voice' ? 'Voice mode active...' : 'Type a message...'}
              disabled={mode === 'voice'}
              style={{
                flex: 1, border: '1px solid #e5e7eb', borderRadius: '22px',
                padding: '11px 16px', fontSize: '14px', outline: 'none',
                fontFamily: 'inherit',
                background: mode === 'voice' ? '#f0f0f0' : '#fafafa',
                color: mode === 'voice' ? '#888' : '#111'
              }}
            />
            <button
              onClick={handleSend}
              disabled={mode === 'voice' || !input.trim() || !isConnected}
              style={{
                width: '42px', height: '42px', borderRadius: '50%',
                background: DELOITTE_GREEN, border: 'none',
                cursor: (mode === 'voice' || !input.trim()) ? 'not-allowed' : 'pointer',
                opacity: (mode === 'voice' || !input.trim()) ? 0.5 : 1,
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Launcher Button */}
      <button onClick={() => setIsOpen(prev => !prev)} style={{
        position: 'fixed', bottom: '24px', right: '24px',
        width: '64px', height: '64px', borderRadius: '50%',
        background: DELOITTE_GREEN, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 998,
        transition: 'transform 0.2s'
      }}>
        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#fff' }} />
      </button>
    </>
  )
}
