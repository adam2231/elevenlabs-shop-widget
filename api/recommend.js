// POST /api/recommend — product recommendation engine for the ElevenLabs agent.
//
// Modes
//   discover          free-text request → Shopify catalog search (UCP MCP), falling
//                     back to tag/text scoring when the store's search returns nothing
//   complete_the_look anchor product → Shopify complementary recommendations
//                     (Search & Discovery pairings)
//   similar           anchor product → Shopify related recommendations (same category)
//
// Every mode then applies the same hard filters (gender, stock, price, already shown)
// and tag-based scoring (style, season, colour), and returns reasons per product.

import { loadCatalog, shopifyRecommendations, ucpSearch, tokens, inferPreferences, STYLE_TAGS, SEASON_TAGS } from './_catalog.js'

const DEFAULT_LIMIT = 3
const MAX_LIMIT = 6
const OUTFIT_SLOTS = new Set(['suits', 'dresses', 'shirts', 'tops', 'bottoms', 'blazers', 'outerwear'])
// Facets that don't describe what a product looks like
const NEUTRAL_TAGS = new Set(['mens', 'womens', 'all-seasons'])

const pretty = (tag) => tag.replace(/-/g, ' ')

// Resolves the anchor product. Returns { product } or { ambiguous: [...] } when a name
// fits several products (e.g. the men's and women's "Navy Two-Piece Suit").
function findProduct(catalog, ref, gender) {
  if (!ref) return {}
  const text = String(ref).toLowerCase().trim()
  const slug = text.replace(/\s+/g, '-')
  // Only handle-shaped input is matched as a handle: "Navy Two-Piece Suit" spells the
  // men's handle but is also the women's product title
  const byHandle = !/\s/.test(text) && catalog.find(p => p.handle === slug)
  if (byHandle) return { product: byHandle }

  const q = new Set(tokens(ref))
  const scored = catalog
    .map(p => ({ p, score: p.title.toLowerCase() === text ? 2 : [...q].filter(t => p.tokens.has(t)).length / (q.size || 1) }))
    .filter(s => s.score >= 0.6)
  const top = Math.max(0, ...scored.map(s => s.score))
  let matches = scored.filter(s => s.score === top).map(s => s.p)
  if (matches.length > 1 && gender) matches = matches.filter(p => p.gender === gender)
  if (matches.length === 1) return { product: matches[0] }
  return matches.length ? { ambiguous: matches } : {}
}

// Share of an anchor's descriptive tags (style, season, colour, material) a product has
function tagSimilarity(a, b) {
  const at = [...a.tags].filter(t => !NEUTRAL_TAGS.has(t))
  return at.length ? at.filter(t => b.tags.has(t)).length / at.length : 0
}

function inferGender(text) {
  const t = new Set(tokens(text))
  if (t.has('women') || t.has('womens')) return 'womens'
  if (t.has('men') || t.has('mens')) return 'mens'
  return null
}

// Tag-based preference score and the reasons it produced
function preferenceScore(p, { style, season, colours }) {
  let score = 0
  const reasons = []
  if (style) {
    const match = (STYLE_TAGS[style] || [style]).find(t => p.tags.has(t))
    if (match) { score += 0.3; reasons.push(`${pretty(match)} style`) }
    else if (style === 'formal' || style === 'evening') score -= 0.3
  }
  if (season) {
    const ok = (SEASON_TAGS[season] || [season]).some(t => p.tags.has(t))
    if (ok) { score += 0.2; if (!p.tags.has('all-seasons')) reasons.push(`made for ${pretty(season)}`) }
    else score -= 0.6
  }
  const colourHits = colours.filter(c => p.colours.includes(c))
  if (colourHits.length) { score += 0.25; reasons.push(`in ${colourHits.join('/')}`) }
  return { score, reasons }
}

async function candidates(mode, catalog, { anchor, query, maxPrice }) {
  const byHandle = new Map(catalog.map(p => [p.handle, p]))
  const ranked = (handles, reason) => handles
    .map((h, i) => byHandle.get(h) && { product: byHandle.get(h), base: 1 - i / (handles.length + 1), reasons: [reason] })
    .filter(Boolean)

  if (mode === 'complete_the_look') {
    const handles = await shopifyRecommendations(anchor.id, 'complementary')
    if (handles.length) return { source: 'shopify_complementary', list: ranked(handles, `pairs with the ${anchor.title}`) }
    const related = (await shopifyRecommendations(anchor.id, 'related')).filter(h => byHandle.get(h)?.slot !== anchor.slot)
    return { source: 'shopify_related', list: ranked(related, `goes with the ${anchor.title}`) }
  }

  if (mode === 'similar') {
    // Shopify's related products, backed by tag similarity within the same category
    // (the algorithm needs sales history the store doesn't have yet)
    const related = new Map(ranked(await shopifyRecommendations(anchor.id, 'related'), `similar to the ${anchor.title}`)
      .map(c => [c.product.handle, c]))
    const sameSlot = catalog.filter(p => p.slot === anchor.slot && p.handle !== anchor.handle && p.gender === anchor.gender)
    // Nothing else in this category (e.g. the only women's blazer): use Shopify's related picks as they are
    if (!sameSlot.length) return { source: 'shopify_related', list: [...related.values()] }
    const list = sameSlot
      .map(p => {
        const sim = tagSimilarity(anchor, p)
        const shared = [...anchor.tags].filter(t => !NEUTRAL_TAGS.has(t) && p.tags.has(t)).slice(0, 3).map(pretty)
        const fromShopify = related.get(p.handle)
        return {
          product: p,
          base: sim + (fromShopify ? 0.3 * fromShopify.base : 0),
          reasons: [fromShopify ? `Shopify rates it similar to the ${anchor.title}` : `same category as the ${anchor.title}`,
            ...(shared.length ? [`shares ${shared.join(', ')}`] : [])],
        }
      })
    return { source: related.size ? 'shopify_related+tags' : 'catalog_tags', list }
  }

  // discover
  const handles = await ucpSearch(query, { maxPrice })
  if (handles.length) return { source: 'shopify_search', list: ranked(handles, 'matches your search') }

  const q = [...new Set(tokens(query))]
  const list = catalog.map(p => {
    const hits = q.filter(t => p.tokens.has(t))
    return { product: p, base: q.length ? hits.length / q.length : 0, reasons: [] }
  }).filter(c => c.base > 0)
  return { source: 'catalog_tags', list }
}

// Discovery boosts: named categories win outright; otherwise favour full garments
// over accessories unless the customer asked for accessories
function categoryAdjust(p, slots, style) {
  if (slots.size) return slots.has(p.slot) ? 0.5 : -1
  // An occasion without a category ("for a wedding") leads with the main outfit piece
  const hero = ['formal', 'evening'].includes(style) && ['suits', 'dresses'].includes(p.slot) ? 0.3 : 0
  return (OUTFIT_SLOTS.has(p.slot) ? 0.2 : -0.2) + hero
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const input = req.method === 'POST' ? (req.body || {}) : req.query
  const mode = ['discover', 'complete_the_look', 'similar'].includes(input.mode) ? input.mode : 'discover'
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(input.limit, 10) || DEFAULT_LIMIT))
  const maxPrice = Number(input.max_price) || null
  const exclude = new Set(String(input.exclude || '').split(',').map(s => s.trim()).filter(Boolean))
  const query = String(input.query || '').trim()
  const implied = inferPreferences(query)
  const style = input.style || implied.style
  const season = input.season || implied.season
  const colours = String(input.colors || input.colours || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean)
  const requestedGender = ['mens', 'womens'].includes(input.gender) ? input.gender : inferGender(query)

  try {
    const catalog = await loadCatalog()
    const { product: anchor, ambiguous } = findProduct(catalog, input.product, requestedGender)
    if (mode !== 'discover' && !anchor) {
      const message = ambiguous
        ? `"${input.product}" matches ${ambiguous.map(p => `${p.title} (${p.gender === 'mens' ? "men's" : "women's"}, handle ${p.handle})`).join(' and ')}. Ask which one, or pass the gender.`
        : `No product matching "${input.product || ''}" was found. Ask which product the customer means.`
      return res.status(200).json({ mode, recommendations: [], message })
    }
    if (mode === 'discover' && !query) {
      return res.status(200).json({ mode, recommendations: [], message: 'Describe what the customer is looking for in "query".' })
    }

    const gender = requestedGender || anchor?.gender || null
    const { source, list } = await candidates(mode, catalog, { anchor, query, maxPrice })
    if (mode === 'discover') list.forEach(c => { c.base += categoryAdjust(c.product, implied.slots, style) })

    const seenSlots = new Map()
    const results = list
      .filter(({ product: p }) => p.available && !exclude.has(p.handle) && p.handle !== anchor?.handle
        && (!gender || p.gender === gender) && (!maxPrice || p.price <= maxPrice))
      .map(c => {
        const pref = preferenceScore(c.product, { style, season, colours })
        return { ...c, score: c.base + pref.score, reasons: [...c.reasons, ...pref.reasons] }
      })
      .sort((a, b) => b.score - a.score)
      // An outfit needs different pieces: at most one per category when completing a look
      .filter(({ product: p }) => {
        if (mode !== 'complete_the_look') return true
        const n = seenSlots.get(p.slot) || 0
        seenSlots.set(p.slot, n + 1)
        return n === 0
      })
      .slice(0, limit)

    res.status(200).json({
      mode,
      source,
      anchor: anchor ? { handle: anchor.handle, title: anchor.title } : null,
      filters: { gender: gender || 'any', style, season, colors: colours, max_price: maxPrice },
      recommendations: results.map(({ product: p, reasons }) => ({
        handle: p.handle,
        title: p.title,
        price: p.price,
        currency: 'PLN',
        category: p.type,
        reasons,
      })),
      ...(results.length ? {} : { message: 'Nothing in stock matches all of these filters. Suggest relaxing one of them.' }),
    })
  } catch (error) {
    console.error('Recommendation engine error:', error)
    res.status(500).json({ recommendations: [], message: 'Recommendations are unavailable right now.' })
  }
}
