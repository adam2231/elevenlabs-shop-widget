import { useState, useRef, useEffect } from 'react'
import ProductCard from './ProductCard'
import productsData from '../products.json'
import useElevenLabs from '../hooks/useElevenLabs'

const DELOITTE_GREEN = '#86BC25'

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)
  const { startSession, stopSession, isConnected, isSpeaking, sendTextMessage } = useElevenLabs()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const init = async () => {
      const greeting = await sendTextMessage('Hello, introduce yourself briefly.')
      if (greeting) {
        setMessages([{ id: 1, role: 'agent', text: greeting, products: [] }])
      } else {
        setMessages([{ id: 1, role: 'agent', text: "Hi! I'm your Style Assistant. How can I help?", products: [] }])
      }
    }
    init()
  }, [])

  const getProductRecommendations = (text) => {
    const lower = text.toLowerCase()
    return productsData.products.filter(p =>
      p.tags.some(tag => lower.includes(tag)) ||
      lower.includes(p.category)
    ).slice(0, 3)
  }

  const handleSend = async () => {
    if (!input.trim()) return
    const text = input.trim()
    const userMsg = { id: Date.now(), role: 'user', text, products: [] }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    const agentReply = await sendTextMessage(text)
    const recommended = getProductRecommendations(text)

    const agentMsg = {
      id: Date.now() + 1,
      role: 'agent',
      text: agentReply || (recommended.length
        ? "Here are some options I'd recommend for you:"
        : "I'd love to help! Could you tell me more about what you're looking for?"),
      products: recommended
    }
    setMessages(prev => [...prev, agentMsg])
    setIsTyping(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleBuyNow = async (product) => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          price: product.price
        })
      })
      const { url } = await res.json()
      if (url) window.open(url, '_blank')
    } catch (err) {
      alert('Checkout unavailable — Stripe not configured yet.')
    }
  }

  const toggleVoice = async () => {
    if (isConnected) {
      await stopSession()
    } else {
      await startSession()
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
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#111' }}>Style Assistant</div>
              <div style={{ fontSize: '11px', color: '#888' }}>Powered by ElevenLabs</div>
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
                {msg.products.length > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.min(msg.products.length, 3)}, 1fr)`,
                    gap: '8px', marginTop: '10px', marginLeft: '36px'
                  }}>
                    {msg.products.map(p => (
                      <ProductCard
                        key={p.id}
                        image={p.image}
                        name={p.name}
                        price={p.price}
                        onView={() => window.open(p.image, '_blank')}
                        onBuyNow={() => handleBuyNow(p)}
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
            <button onClick={toggleVoice} title={isConnected ? 'Stop voice' : 'Start voice'} style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: isConnected ? DELOITTE_GREEN : '#111',
              border: 'none', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v7a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-1 17.93V22h2v-1.07A8 8 0 0 0 20 13h-2a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93z"/>
              </svg>
            </button>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              style={{
                flex: 1, border: '1px solid #e5e7eb', borderRadius: '20px',
                padding: '9px 14px', fontSize: '13px', outline: 'none',
                fontFamily: 'inherit', background: '#fafafa'
              }}
            />
            <button onClick={handleSend} style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: DELOITTE_GREEN, border: 'none', cursor: 'pointer',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
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