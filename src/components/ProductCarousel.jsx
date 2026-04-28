import { useState } from 'react'
import ProductCard from './ProductCard'

export default function ProductCarousel({ products, currency, onBuyNow }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  
  // Show 3 products at a time on desktop, 1 on mobile
  const productsPerPage = window.innerWidth > 768 ? 3 : 1
  const totalPages = Math.ceil(products.length / productsPerPage)
  
  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % totalPages)
  }
  
  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages)
  }
  
  const visibleProducts = products.slice(
    currentIndex * productsPerPage,
    (currentIndex + 1) * productsPerPage
  )
  
  return (
    <div style={{ position: 'relative', marginTop: '10px', marginLeft: '36px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(visibleProducts.length, 3)}, 1fr)`,
        gap: '8px',
        transition: 'opacity 0.3s ease'
      }}>
        {visibleProducts.map((p) => (
          <ProductCard
            key={p.id}
            id={p.id}
            name={p.name}
            price={parseFloat(String(p.price_eur || p.price_pln || p.price || '0').replace(/[^\d.]/g, ''))}
            currency={currency || 'EUR'}
            inStock={p.in_stock}
            image={p.image}
            onView={() => { /* View not functional for demo */ }}
            onBuyNow={() => onBuyNow(p, currency)}
          />
        ))}
      </div>
      
      {/* Navigation buttons - only show if more than one page */}
      {totalPages > 1 && (
        <>
          <button
            onClick={prevSlide}
            style={{
              position: 'absolute',
              left: '-12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: 'none',
              background: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              color: '#111',
              zIndex: 10
            }}
          >
            ←
          </button>
          <button
            onClick={nextSlide}
            style={{
              position: 'absolute',
              right: '-12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: 'none',
              background: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              color: '#111',
              zIndex: 10
            }}
          >
            →
          </button>
          
          {/* Pagination dots */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '6px',
            marginTop: '8px'
          }}>
            {Array.from({ length: totalPages }).map((_, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: idx === currentIndex ? '#86BC25' : '#d1d5db',
                  cursor: 'pointer',
                  transition: 'background 0.3s'
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
