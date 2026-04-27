import { useState, useRef, useEffect, useCallback } from 'react'
import ProductCard from './ProductCard'
import useElevenLabs from '../hooks/useElevenLabs'

const DELOITTE_GREEN = '#86BC25'

export default function ChatWidget() {
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
    // ... rest stays the same

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
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
          width: '420px', maxWidth: 'calc(100vw - 32px)',
          height: '600px', maxHeight: 'calc(100vh - 120px)',
          background: '#fff', borderRadius: '16px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          zIndex: 999, fontFamily: 'system-ui, sans-serif',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid #f0f0f0',
            display: 'flex', alignItems: 'center', gap: '10px',
            background: '#fff', flexShrink: 0
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: DELOITTE_GREEN,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#111' }}>Green Dot · Style Assistant</div>
              <div style={{ fontSize: '11px', color: '#888' }}>
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
                fontSize: '18px', color: '#888', lineHeight: 1
              }}>✕</button>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px',
            display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
            {messages.map(msg => (
              <div key={msg.id}>
                <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '8px' }}>
                  {msg.role === 'agent' && (
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: isSpeaking ? '#22c55e' : DELOITTE_GREEN,
                      flexShrink: 0, marginTop: '2px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.3s'
                    }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fff' }} />
                    </div>
                  )}
                  <div style={{
                    background: msg.role === 'user' ? '#111' : '#f5f5f5',
                    color: msg.role === 'user' ? '#fff' : '#111',
                    borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                    padding: '10px 14px', maxWidth: '80%',
                    fontSize: '13px', lineHeight: '1.5'
                  }}>
                    {msg.text}
                  </div>
                </div>
                {msg.products && msg.products.length > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.min(msg.products.length, 3)}, 1fr)`,
                    gap: '8px', marginTop: '10px', marginLeft: '36px'
                  }}>
                    {msg.products.map(p => (
                      <ProductCard
                        key={p.id}
                        id={p.id}
                        name={p.name}
                        price={parseFloat(String(p.price_eur || p.price_pln || p.price || '0').replace(/[^\d.]/g, ''))}
                        currency={msg.currency || 'EUR'}
                        inStock={p.in_stock}
                        onView={() => { /* View not functional for demo */ }}
                        onBuyNow={() => handleBuyNow(p, msg.currency)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: DELOITTE_GREEN, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fff' }} />
                </div>
                <div style={{
                  background: '#f5f5f5', borderRadius: '4px 16px 16px 16px',
                  padding: '10px 14px', fontSize: '13px', color: '#888'
                }}>
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div style={{
            padding: '12px', borderTop: '1px solid #f0f0f0',
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#fff', flexShrink: 0
          }}>
            <button onClick={toggleVoice} title={mode === 'voice' ? 'Switch to text' : 'Switch to voice'} style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: mode === 'voice' ? DELOITTE_GREEN : '#111',
              border: 'none', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
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
                flex: 1, border: '1px solid #e5e7eb', borderRadius: '20px',
                padding: '9px 14px', fontSize: '13px', outline: 'none',
                fontFamily: 'inherit',
                background: mode === 'voice' ? '#f0f0f0' : '#fafafa',
                color: mode === 'voice' ? '#888' : '#111'
              }}
            />
            <button
              onClick={handleSend}
              disabled={mode === 'voice' || !input.trim() || !isConnected}
              style={{
                width: '38px', height: '38px', borderRadius: '50%',
                background: DELOITTE_GREEN, border: 'none',
                cursor: (mode === 'voice' || !input.trim()) ? 'not-allowed' : 'pointer',
                opacity: (mode === 'voice' || !input.trim()) ? 0.5 : 1,
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Launcher Button */}
      <button onClick={() => setIsOpen(prev => !prev)} style={{
        position: 'fixed', bottom: '24px', right: '24px',
        width: '60px', height: '60px', borderRadius: '50%',
        background: DELOITTE_GREEN, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 998,
        transition: 'transform 0.2s'
      }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#fff' }} />
      </button>
    </>
  )
}
