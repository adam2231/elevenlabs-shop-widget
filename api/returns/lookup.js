// GET /api/returns/lookup?email=...&zipCode=...
// Verified return lookup for the agent's ReturnGET tool (exact email + ZIP match)
import { exactLookup } from '../_mockapi.js'

export default function handler(req, res) {
  return exactLookup(req, res, { resource: 'ProductReturn', emailField: 'email' })
}
