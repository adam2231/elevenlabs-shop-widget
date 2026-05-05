export default function ProductCard({ product, onAddToCart }) {
  const { 
    name, 
    handle,
    price, 
    currency = 'USD',
    inStock, 
    image,
    productUrl,
    variantId,
    compareAtPrice
  } = product

  const currencySymbol = currency === 'USD' ? '$' : '€'
  const formattedPrice = `${currencySymbol}${Number(price || 0).toFixed(2)}`
  const hasDiscount = compareAtPrice && parseFloat(compareAtPrice) > parseFloat(price)
  const formattedComparePrice = hasDiscount ? `${currencySymbol}${Number(compareAtPrice).toFixed(2)}` : null

  // Fallback image if none provided
  const displayImage = image || `https://via.placeholder.com/300x400/f0f0f0/666666?text=${encodeURIComponent(name || handle || 'Product')}`

  const handleViewProduct = () => {
    if (productUrl) {
      window.open(productUrl, '_blank')
    }
  }

  const handleBuyNow = async () => {
    if (!inStock || !variantId) return
    
    try {
      const res = await fetch('/api/shopify/add-to-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: variantId,
          quantity: 1
        })
      })
      
      const { url } = await res.json()
      if (url) {
        window.open(url, '_blank')
        // Also call the callback if provided
        if (onAddToCart) {
          onAddToCart(product)
        }
      }
    } catch (error) {
      console.error('Error adding to cart:', error)
      alert('Unable to add to cart. Please try again.')
    }
  }

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
          alt={name || handle}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          onError={(e) => {
            // Fallback to placeholder if image fails to load
            e.target.src = `https://via.placeholder.com/300x400/f0f0f0/666666?text=${encodeURIComponent(name || handle || 'Product')}`
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
        {hasDiscount && inStock !== false && (
          <div style={{
            position: 'absolute', top: '6px', left: '6px',
            background: '#86BC25', color: '#fff',
            fontSize: '10px', fontWeight: '600',
            padding: '3px 8px', borderRadius: '4px',
          }}>
            Sale
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
          {name || `Product ${handle}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <div style={{ color: '#86BC25', fontWeight: '700', fontSize: '15px' }}>
            {formattedPrice}
          </div>
          {formattedComparePrice && (
            <div style={{ 
              color: '#999', 
              fontSize: '12px', 
              textDecoration: 'line-through' 
            }}>
              {formattedComparePrice}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={handleViewProduct} style={{
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
            onClick={handleBuyNow}
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
            {inStock === false ? 'Sold Out' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}