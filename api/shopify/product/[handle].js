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

    // Transform Shopify product data to widget format
    const transformedProduct = {
      id: product.id.toString(),
      handle: product.handle,
      name: product.title,
      description: product.body_html?.replace(/<[^>]*>/g, '').substring(0, 150) || '',
      price: product.variants[0]?.price || '0.00',
      compareAtPrice: product.variants[0]?.compare_at_price,
      currency: 'USD', // Adjust if your store uses different currency
      image: product.images[0]?.src || product.image?.src || null,
      images: product.images?.map(img => img.src) || [],
      inStock: product.variants[0]?.available || false,
      variantId: product.variants[0]?.id,
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