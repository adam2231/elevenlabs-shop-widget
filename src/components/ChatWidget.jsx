import { useState, useRef, useEffect } from 'react';
import ProductCard from './ProductCard';
import useElevenLabs from '../hooks/useElevenLabs';
import productsData from '../products.json';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { type: 'agent', text: 'Hello! I\'m your style assistant. How can I help you today?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [showProducts, setShowProducts] = useState(false);
  const messagesEndRef = useRef(null);
  const { startSession, stopSession, isConnected, isSpeaking } = useElevenLabs();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage = { type: 'user', text: inputText };
    setMessages(prev => [...prev, userMessage]);

    // Simulate agent response and show products
    setTimeout(() => {
      const agentMessage = { 
        type: 'agent', 
        text: 'Based on your request, here are some products that might interest you:' 
      };
      setMessages(prev => [...prev, agentMessage]);
      setShowProducts(true);
    }, 1000);

    setInputText('');
  };

  const handleBuyNow = async (product) => {
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          price: product.price,
        }),
      });

      const { url } = await response.json();
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error creating checkout session:', error);
    }
  };

  const handleView = (product) => {
    const viewMessage = { 
      type: 'agent', 
      text: `You selected: ${product.name}. ${product.description}` 
    };
    setMessages(prev => [...prev, viewMessage]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen && !isConnected) {
      startSession();
    }
  };

  return (
    <div className="chat-widget">
      {/* Floating Launcher Button */}
      <button
        onClick={toggleChat}
        className="chat-launcher"
        aria-label="Open chat"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="white"/>
        </svg>
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="chat-panel">
          {/* Header */}
          <div className="chat-header">
            <div className="header-left">
              <div className="deloitte-dot"></div>
              <div className="header-text">
                <h3>Style Assistant</h3>
                <p>Powered by ElevenLabs</p>
              </div>
            </div>
            <div className="online-indicator"></div>
          </div>

          {/* Messages Area */}
          <div className="messages-area">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.type}`}>
                <div className="message-content">
                  {message.text}
                </div>
              </div>
            ))}
            
            {/* Products Grid */}
            {showProducts && (
              <div className="products-grid">
                {productsData.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    image={product.image}
                    name={product.name}
                    price={product.price}
                    description={product.description}
                    onBuyNow={() => handleBuyNow(product)}
                    onView={() => handleView(product)}
                  />
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="input-bar">
            <button 
              className={`voice-orb ${isSpeaking ? 'speaking' : ''}`}
              onClick={() => isSpeaking ? stopSession() : startSession()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14Z" fill="currentColor"/>
                <path d="M17 11C17 14.53 14.39 17.44 11 17.93V21H13V22H11V21H9V22H7V21H5V19H7V17.93C3.61 17.44 1 14.53 1 11H3C3 13.76 5.24 16 8 16H16C18.76 16 21 13.76 21 11H17Z" fill="currentColor"/>
              </svg>
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="message-input"
            />
            <button 
              onClick={handleSendMessage}
              className="send-button"
              disabled={!inputText.trim()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
