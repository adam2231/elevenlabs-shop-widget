// Resolves a spoken/natural-language product or collection reference to a real
// Shopify handle, using the live storefront catalog instead of a hardcoded list.
// GET /api/shopify/resolve?type=product|collection&q=...

const shopifyStoreDomain = 'green-dot-7952.myshopify.com'
const CACHE_TTL_MS = 5 * 60 * 1000
const MIN_SCORE = 0.5

const cache = {}

// Checked both before and after stemming. 'clothing' is neutral so that
// "men's" / "men's clothing" both prefer the broad mens-clothing collection.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'to', 'for', 'of', 'and', 'me', 'my', 'show', 'take', 'go', 'open', 'see',
  'page', 'product', 'products', 'collection', 'collections', 'category', 'categories', 'section',
  'one', 'that', 'this', 'some', 'your', 'clothing',
])

// Applied after stemming, so plural/possessive forms collapse first
const SYNONYMS = {
  man: 'men', male: 'men', gentlemen: 'men', gent: 'men',
  woman: 'women', female: 'women', ladie: 'women', lady: 'women',
  pant: 'trouser', slack: 'trouser',
  clothe: 'clothing', wear: 'clothing',
}

function stem(token) {
  let t = token.replace(/'s$/, '').replace(/'/g, '')
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1)
  return SYNONYMS[t] || t
}

function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter(t => t && !STOPWORDS.has(t))
    .map(stem)
    .filter(t => t && !STOPWORDS.has(t))
}

async function loadCatalog(type) {
  const entry = cache[type]
  if (entry && Date.now() - entry.at < CACHE_TTL_MS) return entry.items

  let items
  if (type === 'collection') {
    const res = await fetch(`https://${shopifyStoreDomain}/collections.json?limit=250`)
    if (!res.ok) throw new Error(`collections.json ${res.status}`)
    const { collections } = await res.json()
    items = collections
      .filter(c => c.handle !== 'frontpage' && c.products_count > 0)
      .map(c => ({ handle: c.handle, title: c.title, productsCount: c.products_count }))
  } else {
    const res = await fetch(`https://${shopifyStoreDomain}/products.json?limit=250`)
    if (!res.ok) throw new Error(`products.json ${res.status}`)
    const { products } = await res.json()
    items = products.map(p => ({ handle: p.handle, title: p.title }))
  }
  items.forEach(item => { item.tokens = new Set([...tokens(item.title), ...tokens(item.handle.replace(/-/g, ' '))]) })

  cache[type] = { at: Date.now(), items }
  return items
}

function rank(items, query) {
  const q = [...new Set(tokens(query))]
  if (q.length === 0) return []
  return items
    .map(item => {
      const hits = q.filter(t => item.tokens.has(t)).length
      // Primary: share of the query matched. Tiebreak: tighter candidates first.
      const score = hits / q.length + (hits / item.tokens.size) * 0.01
      return { item, score }
    })
    .filter(r => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const type = req.query.type === 'collection' ? 'collection' : 'product'
  const q = String(req.query.q || '').trim()
  if (!q) return res.status(400).json({ error: 'q is required' })

  try {
    const items = await loadCatalog(type)
    const clean = ({ handle, title, productsCount }) => ({ handle, title, productsCount })

    // Exact handle wins outright
    const slug = q.toLowerCase().trim().replace(/\s+/g, '-')
    const exact = items.find(i => i.handle === slug)
    if (exact) return res.status(200).json({ match: clean(exact), candidates: [] })

    const ranked = rank(items, q)
    const top = ranked[0]
    const ambiguous = ranked.length > 1 && Math.abs(ranked[1].score - top.score) < 0.001
    // Only offer alternatives that matched as much of the query as the best one
    const candidates = top ? ranked.filter(r => r.score > top.score - 0.01) : []
    res.status(200).json({
      match: top && !ambiguous ? clean(top.item) : null,
      candidates: candidates.slice(0, 4).map(r => clean(r.item)),
    })
  } catch (error) {
    console.error('Shopify resolve error:', error)
    res.status(500).json({ error: 'Failed to resolve', message: error.message })
  }
}
