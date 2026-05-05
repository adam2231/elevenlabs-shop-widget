// Shopify Product Details API Endpoint
// Fetches product details from Shopify using the product handle

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Extract handle from path parameter
  const handle = req.query.handle

  if (!handle) {
    return res.status(400).json({ error: 'Product handle is required' })
  }

  const shopifyStoreDomain = 'green-dot-7952.myshopify.com'
  const productUrl = `https://${shopifyStoreDomain}/products/${handle}.json`

  try {
    const response = await fetch(productUrl)
    
    if (!response.ok) {
      console.error(`Shopify API error for handle ${handle}:`, response.status)
      return res.status(response.status).json({ 
        error: 'Product not found',
        handle 
      })
    }

    const data = await response.json()
    const product = data.product

    if (!product) {
      return res.status(404).json({ error: 'Product not found', handle })
    }

    // FIX: Shopify's .json endpoint uses different property names than UCP API
    // The public API returns `available` as a boolean directly on the variant
    const firstVariant = product.variants[0]
    
    // Transform Shopify product data to widget format
    const transformedProduct = {
      id: product.id.toString(),
      handle: product.handle,
      name: product.title,
      description: product.body_html?.replace(/<[^>]*>/g, '').substring(0, 150) || '',
      price: firstVariant?.price || '0.00',
      compareAtPrice: firstVariant?.compare_at_price,
      currency: 'PLN', // Your store uses PLN
      image: product.images[0]?.src || product.image?.src || null,
      images: product.images?.map(img => img.src) || [],
      // FIX: Check the `available` property directly (not nested)
      // Shopify's public JSON API returns available as a boolean on the variant
      inStock: firstVariant?.available === true,
      variantId: firstVariant?.id,
      productUrl: `https://${shopifyStoreDomain}/products/${product.handle}`,
      vendor: product.vendor,
      productType: product.product_type,
      tags: product.tags,
    }

    res.status(200).json(transformedProduct)
  } catch (error) {
    console.error('Error fetching Shopify product:', error)
    res.status(500).json({ 
      error: 'Failed to fetch product',
      message: error.message 
    })
  }
}