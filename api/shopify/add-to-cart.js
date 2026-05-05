// Shopify Add to Cart API Endpoint
// Returns the cart URL with the variant added

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { variantId, quantity = 1 } = req.body

  if (!variantId) {
    return res.status(400).json({ error: 'Variant ID is required' })
  }

  const shopifyStoreDomain = 'green-dot-7952.myshopify.com'
  
  // Generate the Shopify cart URL with the variant
  // Format: /cart/add?id=VARIANT_ID&quantity=QUANTITY
  const cartUrl = `https://${shopifyStoreDomain}/cart/add?id=${variantId}&quantity=${quantity}`

  res.status(200).json({ 
    url: cartUrl,
    variantId,
    quantity 
  })
}