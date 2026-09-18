// GET /api/orders/lookup?emailAddress=...&zipCode=...
// Verified order lookup for the agent's OrderStatus tool (exact email + ZIP match)
import { exactLookup } from '../_mockapi.js'

export default function handler(req, res) {
  return exactLookup(req, res, { resource: 'OrderStatus', emailField: 'emailAddress' })
}
