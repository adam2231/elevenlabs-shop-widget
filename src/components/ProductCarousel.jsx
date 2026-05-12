import { useState } from 'react'
import ProductCard from './ProductCard'

const GREEN = '#86BC25'

export default function ProductCarousel({ products, onAddToCart, glassMode = false }) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const productsPerPage = typeof window !== 'undefined' && window.innerWidth > 640 ? 3 : 1
  const totalPages = Math.ceil(products.length / productsPerPage)

  const nextSlide = () => setCurrentIndex(prev => (prev + 1) % totalPages)
  const prevSlide = () => setCurrentIndex(prev => (prev - 1 + totalPages) % totalPages)

  const visibleProducts = products.slice(
    currentIndex * productsPerPage,
    (currentIndex + 1) * productsPerPage,
  )

  /* ── Nav button styles ── */
  const navBtn = (side) => ({
    position: 'absolute',
    [side]: '-14px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '28px', height: '28px',
    borderRadius: '50%', border: 'none',
    background: glassMode ? 'rgba(255,255,255,0.2)' : '#fff',
    backdropFilter: glassMode ? 'blur(8px)' : 'none',
    WebkitBackdropFilter: glassMode ? 'blur(8px)' : 'none',
    boxShadow: glassMode ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.12)',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '14px',
    color: glassMode ? 'rgba(255,255,255,0.85)' : '#333',
    zIndex: 10,
    transition: 'background 0.15s',
  })

  return (
    <div style={{ position: 'relative', marginTop: '10px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(visibleProducts.length, 3)}, 1fr)`,
        gap: '8px',
      }}>
        {visibleProducts.map((product, idx) => (
          <ProductCard
            key={
              product.id ||
              product.handle ||
              product.title ||
              `${currentIndex * productsPerPage + idx}-${product?.name || 'card'}`
            }
            product={product}
            onAddToCart={onAddToCart}
            glassMode={glassMode}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <>
          <button
            onClick={prevSlide}
            style={navBtn('left')}
            onMouseEnter={e => e.currentTarget.style.background = glassMode ? 'rgba(255,255,255,0.35)' : '#f0f0f0'}
            onMouseLeave={e => e.currentTarget.style.background = glassMode ? 'rgba(255,255,255,0.2)' : '#fff'}
            aria-label="Previous"
          >
            ←
          </button>
          <button
            onClick={nextSlide}
            style={navBtn('right')}
            onMouseEnter={e => e.currentTarget.style.background = glassMode ? 'rgba(255,255,255,0.35)' : '#f0f0f0'}
            onMouseLeave={e => e.currentTarget.style.background = glassMode ? 'rgba(255,255,255,0.2)' : '#fff'}
            aria-label="Next"
          >
            →
          </button>

          {/* Pagination dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '10px' }}>
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Page ${idx + 1}`}
                style={{
                  width: idx === currentIndex ? '18px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  border: 'none',
                  background: idx === currentIndex
                    ? (glassMode ? 'rgba(255,255,255,0.85)' : GREEN)
                    : (glassMode ? 'rgba(255,255,255,0.25)' : '#ddd'),
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
