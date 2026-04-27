export default function ProductCard({ name, id, price, currency, inStock, onView, onBuyNow }) {
  const currencySymbol = currency === 'PLN' ? 'zł' : '€'
  const formattedPrice = `${currencySymbol}${Number(price || 0).toFixed(2)}`

  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: '10px', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontSize: '12px',
      opacity: inStock === false ? 0.6 : 1,
    }}>
      {/* Placeholder image area — real images not yet generated */}
      <div style={{
        height: '90px', background: 'linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative',
      }}>
        <span style={{ fontSize: '24px', opacity: 0.3 }}>👔</span>
        {inStock === false && (
          <div style={{
            position: 'absolute', top: '4px', right: '4px',
            background: '#ef4444', color: '#fff',
            fontSize: '9px', fontWeight: '600',
            padding: '2px 6px', borderRadius: '4px',
          }}>
            Out of Stock
          </div>
        )}
      </div>
      <div style={{ padding: '8px' }}>
        <div style={{
          fontWeight: '600', color: '#111', marginBottom: '2px',
          lineHeight: 1.3, fontSize: '11px',
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {name || `Product ${id}`}
        </div>
        <div style={{ color: '#86BC25', fontWeight: '700', marginBottom: '8px', fontSize: '13px' }}>
          {formattedPrice}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={onView} style={{
            flex: 1, padding: '5px', fontSize: '11px', borderRadius: '6px',
            border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#111'
          }}>
            View
          </button>
          <button
            onClick={onBuyNow}
            disabled={inStock === false}
            style={{
              flex: 1, padding: '5px', fontSize: '11px', borderRadius: '6px',
              border: 'none', background: inStock === false ? '#ccc' : '#86BC25',
              cursor: inStock === false ? 'not-allowed' : 'pointer',
              color: '#fff', fontWeight: '600'
            }}
          >
            {inStock === false ? 'Sold Out' : 'Buy Now'}
          </button>
        </div>
      </div>
    </div>
  )
}
