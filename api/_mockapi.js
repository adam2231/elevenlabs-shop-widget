// Shared exact-match lookup against the MockAPI demo backend.
// MockAPI query filters are case-insensitive SUBSTRING matches, so
// "?emailAddress=gmail&zipCode=0" returns other customers' records. The agent's
// verification tools go through here instead: a record is returned only when the
// email and ZIP code match exactly.

const MOCKAPI_BASE = 'https://69e8966855d62f3479796850.mockapi.io'

const normalizeEmail = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '')
const normalizeZip = (value) => String(value || '').replace(/\D/g, '')

export async function exactLookup(req, res, { resource, emailField }) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const email = normalizeEmail(req.query[emailField])
  const zip = normalizeZip(req.query.zipCode)
  if (!email || zip.length !== 5) {
    return res.status(200).json({ found: false, reason: 'Both the email address and a 5-digit ZIP code are required.' })
  }

  try {
    const response = await fetch(`${MOCKAPI_BASE}/${resource}?${emailField}=${encodeURIComponent(email)}`)
    // MockAPI answers 404 "Not found" when the filter matches nothing
    const rows = response.ok ? await response.json() : []
    const matches = (Array.isArray(rows) ? rows : [])
      .filter(row => normalizeEmail(row[emailField]) === email && normalizeZip(row.zipCode) === zip)

    if (matches.length === 0) {
      return res.status(200).json({ found: false, reason: 'No order matches that email address and ZIP code.' })
    }

    // Most recent record first if a customer ever has more than one
    matches.sort((a, b) => String(b.orderDate || b.dateofOrder || '').localeCompare(String(a.orderDate || a.dateofOrder || '')))
    res.status(200).json({ found: true, record: matches[0] })
  } catch (error) {
    console.error(`MockAPI ${resource} lookup failed:`, error)
    res.status(502).json({ found: false, reason: 'The order system is not responding right now.' })
  }
}
