export default function ProductCard({ name, id, price, currency, inStock, image, onView, onBuyNow }) {
  const currencySymbol = currency === 'PLN' ? 'zł' : '€'
  const formattedPrice = `${currencySymbol}${Number(price || 0).toFixed(2)}`

  // Fallback image if none provided
  const displayImage = image || `https://via.placeholder.com/300x400/f0f0f0/666666?text=${encodeURIComponent(name || id || 'Product')}`

  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: '12px', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontSize: '13px',
      opacity: inStock === false ? 0.6 : 1,
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'pointer'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)'
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)'
      e.currentTarget.style.boxShadow = 'none'
    }}
    >
      {/* Product image */}
      <div style={{
        height: '120px',
        background: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <img 
          src={displayImage} 
          alt={name || id}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          onError={(e) => {
            // Fallback to placeholder if image fails to load
            e.target.src = `https://via.placeholder.com/300x400/f0f0f0/666666?text=${encodeURIComponent(name || id || 'Product')}`
          }}
        />
        {inStock === false && (
          <div style={{
            position: 'absolute', top: '6px', right: '6px',
            background: '#ef4444', color: '#fff',
            fontSize: '10px', fontWeight: '600',
            padding: '3px 8px', borderRadius: '4px',
          }}>
            Out of Stock
          </div>
        )}
      </div>
      <div style={{ padding: '10px' }}>
        <div style={{
          fontWeight: '600', color: '#111', marginBottom: '4px',
          lineHeight: 1.3, fontSize: '12px',
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {name || `Product ${id}`}
        </div>
        <div style={{ color: '#86BC25', fontWeight: '700', marginBottom: '10px', fontSize: '15px' }}>
          {formattedPrice}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onView} style={{
            flex: 1, padding: '7px', fontSize: '12px', borderRadius: '6px',
            border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#111',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = '#f9fafb'}
          onMouseLeave={(e) => e.target.style.background = '#fff'}
          >
            View
          </button>
          <button
            onClick={onBuyNow}
            disabled={inStock === false}
            style={{
              flex: 1, padding: '7px', fontSize: '12px', borderRadius: '6px',
              border: 'none', background: inStock === false ? '#ccc' : '#86BC25',
              cursor: inStock === false ? 'not-allowed' : 'pointer',
              color: '#fff', fontWeight: '600',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              if (inStock !== false) e.target.style.background = '#6fa020'
            }}
            onMouseLeave={(e) => {
              if (inStock !== false) e.target.style.background = '#86BC25'
            }}
          >
            {inStock === false ? 'Sold Out' : 'Buy Now'}
          </button>
        </div>
      </div>
    </div>
  )
}
