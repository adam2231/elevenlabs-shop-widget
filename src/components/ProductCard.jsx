
export default function ProductCard({ image, name, price, description, onBuyNow, onView }) {
  return (
    <div className="product-card">
      <div className="product-image">
        <img src={image} alt={name} />
      </div>
      <div className="product-info">
        <h4 className="product-name">{name}</h4>
        <p className="product-price">${price}</p>
        <p className="product-description">{description}</p>
      </div>
      <div className="product-actions">
        <button onClick={onView} className="view-button">
          View
        </button>
        <button onClick={onBuyNow} className="buy-button">
          Buy Now
        </button>
      </div>
    </div>
  );
}
