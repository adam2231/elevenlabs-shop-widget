export default function ProductCard({ image, name, price, onView, onBuyNow }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: '10px', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontSize: '12px'
    }}>
      <div style={{
        height: '90px', background: '#f5f5f5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden'
      }}>
        <img src={image} alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { e.target.style.display = 'none' }}
        />
      </div>
      <div style={{ padding: '8px' }}>
        <div style={{ fontWeight: '600', color: '#111', marginBottom: '2px', lineHeight: 1.3 }}>{name}</div>
        <div style={{ color: '#555', marginBottom: '8px' }}>£{price.toFixed(2)}</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={onView} style={{
            flex: 1, padding: '5px', fontSize: '11px', borderRadius: '6px',
            border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#111'
          }}>View</button>
          <button onClick={onBuyNow} style={{
            flex: 1, padding: '5px', fontSize: '11px', borderRadius: '6px',
            border: 'none', background: '#86BC25', cursor: 'pointer', color: '#fff', fontWeight: '600'
          }}>Buy Now</button>
        </div>
      </div>
    </div>
  )
}