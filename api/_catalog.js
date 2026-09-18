// Shared Shopify catalog access for the recommendation engine.
// Products come from the storefront's products.json (cached); tags carry the
// facets the engine filters on: gender, style, season, colour, category.

export const STORE = 'https://green-dot-7952.myshopify.com'
export const UCP_PROFILE = 'https://elevenlabsdemo-gilt.vercel.app/.well-known/ucp'

const CACHE_TTL_MS = 5 * 60 * 1000
let cache = null

export const STYLE_TAGS = {
  formal: ['formal', 'business-formal', 'business'],
  business: ['business-formal', 'business-casual', 'business', 'formal'],
  casual: ['casual', 'smart-casual', 'business-casual'],
  evening: ['evening', 'evening-wear', 'black-tie'],
}
export const SEASON_TAGS = {
  'spring-summer': ['spring-summer', 'all-seasons', 'spring-autumn', 'summer'],
  'autumn-winter': ['autumn-winter', 'all-seasons', 'spring-autumn'],
}
const COLOURS = ['navy', 'black', 'grey', 'charcoal', 'white', 'cream', 'beige', 'tan', 'khaki', 'camel',
  'brown', 'ivory', 'burgundy', 'emerald', 'pink', 'olive', 'blue', 'light-blue']

const STOPWORDS = new Set(['the', 'a', 'an', 'to', 'for', 'of', 'and', 'me', 'my', 'i', 'im', 'need', 'want',
  'looking', 'something', 'some', 'show', 'with', 'in', 'on', 'that', 'this', 'is', 'it', 'please', 'good', 'nice'])
const SYNONYMS = {
  man: 'men', male: 'men', gentlemen: 'men', guy: 'men', woman: 'women', female: 'women', ladie: 'women', lady: 'women',
  pant: 'trouser', slack: 'trouser', jacket: 'blazer', sweater: 'knitwear', jumper: 'knitwear', coat: 'outerwear',
  work: 'business', office: 'business', wedding: 'formal', interview: 'formal', party: 'evening',
  warm: 'autumn-winter', winter: 'autumn-winter', breathable: 'summer', hot: 'summer',
}

// Words that name a garment category → catalog slots they cover
export const CATEGORY_WORDS = {
  shirt: ['shirts', 'tops'], blouse: ['tops'], top: ['tops'], knitwear: ['tops'], cardigan: ['tops'], turtleneck: ['tops'],
  trouser: ['bottoms'], chino: ['bottoms'], jean: ['bottoms'], denim: ['bottoms'], skirt: ['bottoms'], culotte: ['bottoms'],
  outerwear: ['outerwear'], raincoat: ['outerwear'], trench: ['outerwear'], peacoat: ['outerwear'], overcoat: ['outerwear'], cape: ['outerwear'],
  dress: ['dresses'], blazer: ['blazers'], suit: ['suits'], tuxedo: ['suits'],
  tie: ['ties'], belt: ['belts'], scarf: ['scarves'], scarve: ['scarves'], accessory: ['ties', 'belts', 'scarves'], accessorie: ['ties', 'belts', 'scarves'],
}

// Preferences implied by the customer's own words
export function inferPreferences(text) {
  const t = new Set(tokens(text))
  const style = t.has('evening') ? 'evening' : t.has('formal') ? 'formal' : t.has('business') ? 'business' : t.has('casual') ? 'casual' : null
  const season = t.has('summer') ? 'spring-summer' : t.has('autumn-winter') ? 'autumn-winter' : null
  const slots = new Set([...t].flatMap(w => CATEGORY_WORDS[w] || []))
  return { style, season, slots }
}

function stem(token) {
  let t = token.replace(/'s$/, '').replace(/'/g, '')
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1)
  return SYNONYMS[t] || t
}

export function tokens(text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9'-]+/)
    .filter(t => t && !STOPWORDS.has(t))
    .flatMap(t => [t, ...t.split('-')])   // "spring-summer" also matches "summer"
    .map(stem)
    .filter(t => t && !STOPWORDS.has(t))
}

const slotOf = (type, tags) => {
  if (type === 'Accessories') return ['ties', 'belts', 'scarves'].find(s => tags.has(s)) || 'accessories'
  return type === 'Trousers' ? 'bottoms' : type.toLowerCase()
}

export async function loadCatalog() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.items
  const res = await fetch(`${STORE}/products.json?limit=250`)
  if (!res.ok) throw new Error(`products.json ${res.status}`)
  const { products } = await res.json()
  const items = products.map(p => {
    const tags = new Set(p.tags)
    const variant = p.variants.find(v => v.available) || p.variants[0]
    return {
      id: p.id,
      handle: p.handle,
      title: p.title,
      type: p.product_type,
      slot: slotOf(p.product_type, tags),
      gender: tags.has('mens') ? 'mens' : tags.has('womens') ? 'womens' : null,
      tags,
      colours: COLOURS.filter(c => tags.has(c) || p.handle.includes(c)),
      price: Number(variant?.price || 0),
      available: p.variants.some(v => v.available),
      tokens: new Set([...tokens(p.title), ...tokens(p.handle.replace(/-/g, ' ')), ...tokens(p.product_type), ...[...tags].flatMap(t => tokens(t))]),
    }
  })
  cache = { at: Date.now(), items }
  return items
}

// Shopify Product Recommendations API: intent=complementary (merchant-curated
// pairings from Search & Discovery) or intent=related (Shopify's algorithm)
export async function shopifyRecommendations(productId, intent, limit = 10) {
  const res = await fetch(`${STORE}/recommendations/products.json?product_id=${productId}&limit=${limit}&intent=${intent}`)
  if (!res.ok) return []
  const { products = [] } = await res.json()
  return products.map(p => p.handle)
}

// Shopify catalog search over the UCP MCP endpoint. Returns handles in Shopify's
// relevance order, or [] if the store's catalog index returns nothing.
export async function ucpSearch(query, { maxPrice, limit = 10 } = {}, timeoutMs = 2500) {
  const filters = { available: true }
  if (maxPrice) filters.price = { max: Math.round(maxPrice * 100) }
  const body = {
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: {
      name: 'search_catalog',
      arguments: {
        meta: { 'ucp-agent': { profile: UCP_PROFILE } },
        catalog: { query, filters, context: { address_country: 'PL', currency: 'PLN' }, pagination: { limit } },
      },
    },
  }
  try {
    const res = await fetch(`${STORE}/api/ucp/mcp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const data = await res.json()
    const result = data.result?.structuredContent || JSON.parse(data.result?.content?.[0]?.text || '{}')
    return (result.products || []).map(p => p.handle || String(p.url || '').match(/\/products\/([^/?#]+)/)?.[1]).filter(Boolean)
  } catch {
    return []
  }
}
