const BASE_URL = 'http://localhost:8000'

/**
 * Centralised fetch helper — automatically attaches the JWT token.
 * Usage:  const res = await apiFetch('/api/tickets', { method: 'POST', body: JSON.stringify({...}) })
 */
export function apiFetch(path, options = {}) {
  const token = localStorage.getItem('helpdesk_token')

  // Build headers separately so they never accidentally get overwritten
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  // Destructure options so we can safely override headers
  const { headers: _ignored, ...restOptions } = options

  return fetch(`${BASE_URL}${path}`, {
    ...restOptions,
    headers,
  })
}
