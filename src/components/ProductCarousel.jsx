import { useState } from 'react'
import ProductCard from './ProductCard'

const GREEN = '#86BC25'

export default function ProductCarousel({ products, onAddToCart, onViewProduct, glassMode = false }) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Always show 2 cards per page for narrower/taller layout
  const productsPerPage = 2
  const totalPages = Math.ceil(products.length / productsPerPage)

  const nextSlide = () => setCurrentIndex(prev => (prev + 1) % totalPages)
  const prevSlide = () => setCurrentIndex(prev => (prev - 1 + totalPages) % totalPages)

  const visibleProducts = products.slice(
    currentIndex * productsPerPage,
    (currentIndex + 1) * productsPerPage,
  )

  const isSingle = visibleProducts.length === 1

  /* ── Nav button styles ── */
  const navBtn = (side) => ({
    position: 'absolute',
    [side]: '-14px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '28px', height: '28px',
    borderRadius: '50%',
    background: glassMode ? 'rgba(255,255,255,0.22)' : '#fff',
    backdropFilter: glassMode ? 'blur(10px)' : 'none',
    WebkitBackdropFilter: glassMode ? 'blur(10px)' : 'none',
    boxShadow: glassMode
      ? '0 2px 10px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)'
      : '0 2px 8px rgba(0,0,0,0.12)',
    border: glassMode ? '1px solid rgba(255,255,255,0.28)' : '1px solid #eee',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '14px',
    color: glassMode ? 'rgba(255,255,255,0.9)' : '#333',
    zIndex: 10,
    transition: 'background 0.15s',
  })

  return (
    <div style={{ position: 'relative', marginTop: '10px' }}>
      {/* Single product: centered + capped width. Multiple: 2-col grid */}
      <div style={isSingle ? {
        display: 'flex',
        justifyContent: 'center',
      } : {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '10px',
      }}>
        {visibleProducts.map((product, idx) => (
          <div
            key={
              product.id ||
              product.handle ||
              product.title ||
              `${currentIndex * productsPerPage + idx}-${product?.name || 'card'}`
            }
            style={isSingle ? { width: '55%', minWidth: '180px', maxWidth: '220px' } : {}}
          >
            <ProductCard
              product={product}
              onAddToCart={onAddToCart}
              onViewProduct={onViewProduct}
              glassMode={glassMode}
            />
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <>
          <button
            onClick={prevSlide}
            style={navBtn('left')}
            onMouseEnter={e => e.currentTarget.style.background = glassMode ? 'rgba(255,255,255,0.38)' : '#f0f0f0'}
            onMouseLeave={e => e.currentTarget.style.background = glassMode ? 'rgba(255,255,255,0.22)' : '#fff'}
            aria-label="Previous"
          >
            ←
          </button>
          <button
            onClick={nextSlide}
            style={navBtn('right')}
            onMouseEnter={e => e.currentTarget.style.background = glassMode ? 'rgba(255,255,255,0.38)' : '#f0f0f0'}
            onMouseLeave={e => e.currentTarget.style.background = glassMode ? 'rgba(255,255,255,0.22)' : '#fff'}
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
                    ? (glassMode ? 'rgba(255,255,255,0.9)' : GREEN)
                    : (glassMode ? 'rgba(255,255,255,0.28)' : '#ddd'),
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
