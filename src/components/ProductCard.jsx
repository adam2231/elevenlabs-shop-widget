import { isEmbedded, requestHost } from '../lib/hostBridge'

const GREEN = '#86BC25'
const GREEN_DARK = '#6fa020'

/* ─── helpers ─────────────────────────────────────────────────── */
function getKind(product) {
  return (product?.kind || product?.cardType || product?.type || product?.__kind || 'shopify')
}

function formatMoney(amount, currency) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return ''
  const c = (currency || '').toUpperCase()
  if (c === 'PLN') return `${Math.round(value)} zł`
  if (c === 'USD') return `$${value.toFixed(2)}`
  if (c === 'EUR') return `€${value.toFixed(2)}`
  if (c) return `${value.toFixed(2)} ${c}`
  return value.toFixed(2)
}

function getPlaceLabel(place) {
  if (!place) return ''
  if (typeof place === 'string') return place
  return place.city || place.name || place.airport || place.label || ''
}

function getDateTimeLabel(obj) {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  const date = obj.date || ''; const time = obj.time || ''
  if (date && time) return `${date} · ${time}`
  return date || time || ''
}

/* ════════════════════════════════════════════════════════════════
   GLASS BUTTON  — used inside glass cards in voice mode
   Key fix: much higher contrast so buttons are clearly visible
════════════════════════════════════════════════════════════════ */
function GlassBtn({ children, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '8px 10px', fontSize: '11px', fontWeight: '600',
        borderRadius: '8px',
        border: primary ? '1px solid rgba(255,255,255,0.9)' : '1px solid rgba(255,255,255,0.5)',
        background: primary
          ? 'rgba(255,255,255,0.95)'
          : 'rgba(255,255,255,0.25)',
        color: primary ? '#2d5a00' : '#fff',
        cursor: 'pointer', transition: 'all 0.15s',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: primary
          ? '0 2px 8px rgba(0,0,0,0.15)'
          : '0 1px 4px rgba(0,0,0,0.1)',
        letterSpacing: '0.2px',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.03)'
        if (!primary) e.currentTarget.style.background = 'rgba(255,255,255,0.35)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)'
        if (!primary) e.currentTarget.style.background = 'rgba(255,255,255,0.25)'
      }}
    >
      {children}
    </button>
  )
}

/* ════════════════════════════════════════════════════════════════
   PRODUCT CARD
════════════════════════════════════════════════════════════════ */
export default function ProductCard({ product, onAddToCart, onViewProduct, onPrimaryAction, glassMode = false }) {
  const kind = getKind(product)
  const onAction = onPrimaryAction || onAddToCart
  const isFlight = kind === 'flight' || kind === 'flight_offer'
  const isLuggage = kind === 'luggage' || kind === 'luggage_option'

  /* ── Glass card wrapper styles ──
     Key fix: much stronger white tint + border so the card
     actually reads as a frosted panel against the green bg */
  const glassCard = {
    background: 'rgba(255,255,255,0.22)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1.5px solid rgba(255,255,255,0.45)',
    borderRadius: '16px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.4)',
  }

  /* ── Normal card wrapper styles ── */
  const normalCard = {
    background: '#fff',
    border: '1px solid #e8e8e8',
    borderRadius: '14px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  }

  const cardStyle = glassMode ? glassCard : normalCard

  const cardHover = (el, entering) => {
    if (glassMode) {
      el.style.background = entering ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.22)'
      el.style.borderColor = entering ? 'rgba(255,255,255,0.60)' : 'rgba(255,255,255,0.45)'
      el.style.transform = entering ? 'translateY(-4px) scale(1.01)' : 'translateY(0) scale(1)'
      el.style.boxShadow = entering
        ? '0 12px 40px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.5)'
        : '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.4)'
    } else {
      el.style.transform = entering ? 'translateY(-3px)' : 'translateY(0)'
      el.style.boxShadow = entering ? '0 6px 20px rgba(0,0,0,0.10)' : 'none'
    }
  }

  /* ── Text colour helpers ── */
  const titleColor = glassMode ? '#fff' : '#111'
  const subColor = glassMode ? 'rgba(255,255,255,0.70)' : '#888'
  const priceColor = glassMode ? '#fff' : GREEN
  const labelBg = glassMode ? 'rgba(255,255,255,0.20)' : 'rgba(134,188,37,0.1)'
  const labelColor = glassMode ? '#fff' : GREEN
  const labelBorder = glassMode ? 'rgba(255,255,255,0.35)' : 'rgba(134,188,37,0.3)'
  const dividerColor = glassMode ? 'rgba(255,255,255,0.15)' : '#f3f3f3'

  /* ════════════════════════════════
     FLIGHT CARD
  ════════════════════════════════ */
  if (isFlight) {
    const fromLabel = getPlaceLabel(product.from || product.origin || product.fromCity)
    const toLabel = getPlaceLabel(product.to || product.destination || product.toCity)
    const departLabel = getDateTimeLabel(product.depart || product.departure)
    const returnLabel = getDateTimeLabel(product.return || product.returnFlight)
    const priceLabel = formatMoney(product.cost ?? product.price, product.currency || 'PLN')
    const title = product.title || `${fromLabel} → ${toLabel}`

    return (
      <div
        style={cardStyle}
        onMouseEnter={e => cardHover(e.currentTarget, true)}
        onMouseLeave={e => cardHover(e.currentTarget, false)}
      >
        <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${dividerColor}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '7px' }}>
            <span style={{
              fontSize: '9px', fontWeight: '700', color: labelColor,
              background: labelBg, border: `1px solid ${labelBorder}`,
              padding: '2px 7px', borderRadius: '20px',
            }}>
              FLIGHT
            </span>
            <span style={{ marginLeft: 'auto', color: priceColor, fontWeight: '700', fontSize: '15px' }}>
              {priceLabel}
            </span>
          </div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: titleColor, lineHeight: 1.3 }}>
            {title}
          </div>
        </div>

        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '9px', color: subColor, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>From</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: titleColor }}>{fromLabel}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: subColor, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>To</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: titleColor }}>{toLabel}</div>
            </div>
            {departLabel && (
              <div>
                <div style={{ fontSize: '9px', color: subColor, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Departure</div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: titleColor }}>{departLabel}</div>
              </div>
            )}
            {returnLabel && (
              <div>
                <div style={{ fontSize: '9px', color: subColor, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Return</div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: titleColor }}>{returnLabel}</div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', paddingTop: '4px' }}>
            {glassMode ? (
              <GlassBtn primary onClick={() => onAction?.(product)}>Select flight</GlassBtn>
            ) : (
              <button
                onClick={() => onAction?.(product)}
                style={{
                  flex: 1, padding: '8px', fontSize: '11px', borderRadius: '8px',
                  border: 'none', background: GREEN, color: '#fff', fontWeight: '600',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.target.style.background = GREEN_DARK}
                onMouseLeave={e => e.target.style.background = GREEN}
              >
                Select flight
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* ════════════════════════════════
     LUGGAGE CARD
  ════════════════════════════════ */
  if (isLuggage) {
    const luggageName = product.name || product.title || 'Luggage'
    const description = product.description || product.details || ''
    const flightsCount = Number(product.flightsCount || product.flights || 2)
    const priceLabel = formatMoney(product.price ?? product.cost, product.currency || 'PLN')

    return (
      <div
        style={cardStyle}
        onMouseEnter={e => cardHover(e.currentTarget, true)}
        onMouseLeave={e => cardHover(e.currentTarget, false)}
      >
        <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${dividerColor}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{
              fontSize: '9px', fontWeight: '700', color: subColor,
              background: glassMode ? 'rgba(255,255,255,0.12)' : '#f5f5f5',
              border: `1px solid ${glassMode ? 'rgba(255,255,255,0.25)' : '#e8e8e8'}`,
              padding: '2px 7px', borderRadius: '20px',
            }}>
              LUGGAGE
            </span>
            <span style={{ marginLeft: 'auto', color: priceColor, fontWeight: '700', fontSize: '15px' }}>
              {priceLabel}
            </span>
          </div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: titleColor }}>{luggageName}</div>
          <div style={{ fontSize: '10px', color: subColor, marginTop: '2px' }}>
            Price for {Number.isFinite(flightsCount) ? flightsCount : 2} flights
          </div>
        </div>

        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
          {description && (
            <div style={{ fontSize: '11px', color: subColor, lineHeight: 1.5 }}>{description}</div>
          )}
          <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
            {glassMode ? (
              <GlassBtn primary onClick={() => onAction?.(product)}>Select</GlassBtn>
            ) : (
              <button
                onClick={() => onAction?.(product)}
                style={{
                  flex: 1, padding: '8px', fontSize: '11px', borderRadius: '8px',
                  border: 'none', background: GREEN, color: '#fff', fontWeight: '600',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.target.style.background = GREEN_DARK}
                onMouseLeave={e => e.target.style.background = GREEN}
              >
                Select luggage
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* ════════════════════════════════
     SHOPIFY / DEFAULT CARD
  ════════════════════════════════ */
  const {
    name, handle, price, currency = 'PLN',
    inStock, image, productUrl, variantId, compareAtPrice,
  } = product

  const formattedPrice = currency === 'PLN'
    ? `${Math.round(Number(price || 0))} zł`
    : currency === 'USD'
    ? `$${Number(price || 0).toFixed(2)}`
    : `€${Number(price || 0).toFixed(2)}`

  const hasDiscount = compareAtPrice && parseFloat(compareAtPrice) > parseFloat(price)
  const formattedComparePrice = hasDiscount
    ? (currency === 'PLN'
        ? `${Math.round(Number(compareAtPrice))} zł`
        : `$${Number(compareAtPrice).toFixed(2)}`)
    : null

  const displayImage = image
    || `https://via.placeholder.com/300x400/f0f0f0/666666?text=${encodeURIComponent(name || handle || 'Product')}`

  const handleViewProduct = async () => {
    if (!handle && !productUrl) return
    if (!isEmbedded) { if (productUrl) window.open(productUrl, '_blank'); return }
    const result = await requestHost('el-navigate', { path: `/products/${handle}` })
    if (result.ok) onViewProduct?.(product)
  }

  const handleBuyNow = async () => {
    if (!inStock || !variantId) return
    try {
      if (!isEmbedded) {
        const res = await fetch('/api/shopify/add-to-cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantId, quantity: 1 }),
        })
        const { url } = await res.json()
        if (url) { window.open(url, '_blank'); onAddToCart?.(product) }
        return
      }
      const result = await requestHost('el-add-to-cart', { variantId, quantity: 1 })
      if (result.ok) onAddToCart?.(product)
      else alert(result.error || 'Unable to add to cart. Please try again.')
    } catch { alert('Unable to add to cart. Please try again.') }
  }

  return (
    <div
      style={{ ...cardStyle, opacity: inStock === false ? 0.65 : 1 }}
      onMouseEnter={e => cardHover(e.currentTarget, true)}
      onMouseLeave={e => cardHover(e.currentTarget, false)}
    >
      {/* Image — taller to show more product */}
      <div style={{
        height: glassMode ? '160px' : '140px',
        background: glassMode ? 'rgba(255,255,255,0.12)' : '#f7f7f7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative',
        flexShrink: 0,
      }}>
        <img
          src={displayImage}
          alt={name || handle}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => {
            e.target.src = `https://via.placeholder.com/300x400/f0f0f0/666666?text=${encodeURIComponent(name || handle || 'Product')}`
          }}
        />
        {/* Subtle diagonal shine on glass cards */}
        {glassMode && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 50%)',
            pointerEvents: 'none',
          }} />
        )}
        {inStock === false && (
          <div style={{
            position: 'absolute', top: '8px', right: '8px',
            background: '#ef4444', color: '#fff',
            fontSize: '9px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px',
          }}>OUT OF STOCK</div>
        )}
        {hasDiscount && inStock !== false && (
          <div style={{
            position: 'absolute', top: '8px', left: '8px',
            background: glassMode ? 'rgba(255,255,255,0.9)' : GREEN,
            color: glassMode ? '#2d5a00' : '#fff',
            fontSize: '9px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px',
          }}>SALE</div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{
          fontSize: '13px', fontWeight: '600', color: titleColor, marginBottom: '5px',
          lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {name || `Product ${handle}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '12px' }}>
          <span style={{
            color: priceColor, fontWeight: '800', fontSize: '15px',
            ...(glassMode ? { textShadow: '0 1px 3px rgba(0,0,0,0.15)' } : {}),
          }}>
            {formattedPrice}
          </span>
          {formattedComparePrice && (
            <span style={{ color: subColor, fontSize: '11px', textDecoration: 'line-through' }}>
              {formattedComparePrice}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '7px', marginTop: 'auto' }}>
          {glassMode ? (
            <>
              <GlassBtn onClick={handleViewProduct}>View</GlassBtn>
              <GlassBtn primary onClick={handleBuyNow}>Add to cart</GlassBtn>
            </>
          ) : (
            <>
              <button
                onClick={handleViewProduct}
                style={{
                  flex: 1, padding: '8px', fontSize: '11px', borderRadius: '8px',
                  border: '1px solid #e8e8e8', background: '#fff', color: '#333',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.target.style.background = '#f5f5f5'}
                onMouseLeave={e => e.target.style.background = '#fff'}
              >
                View
              </button>
              <button
                onClick={handleBuyNow}
                disabled={inStock === false}
                style={{
                  flex: 1, padding: '8px', fontSize: '11px', borderRadius: '8px',
                  border: 'none',
                  background: inStock === false ? '#d1d5db' : GREEN,
                  color: '#fff', fontWeight: '600',
                  cursor: inStock === false ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (inStock !== false) e.target.style.background = GREEN_DARK }}
                onMouseLeave={e => { if (inStock !== false) e.target.style.background = GREEN }}
              >
                {inStock === false ? 'Sold Out' : 'Add to Cart'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
