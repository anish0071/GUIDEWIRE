/** All API calls — single source of truth for network requests. */

const BASE = '/api'

async function request(path, options = {}) {
  const token = localStorage.getItem('pa_token')
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) throw new Error(data.detail || `Request failed: ${res.status}`)
  return data
}

// ── Auth ────────────────────────────────────────────────────
export const sendOTP   = (phone)       => request('/auth/login',      { method: 'POST', body: JSON.stringify({ phone }) })
export const verifyOTP = (phone, otp)  => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, otp }) })

// ── Users ───────────────────────────────────────────────────
export const getProfile    = (userId)          => request(`/users/${userId}/profile`)
export const updateProfile = (userId, payload) => request(`/users/${userId}/profile`, { method: 'PATCH', body: JSON.stringify(payload) })

// ── Policies ────────────────────────────────────────────────
export const getPlans       = ()         => request('/policies/plans')
export const subscribePlan  = (payload)  => request('/policies/subscribe', { method: 'POST', body: JSON.stringify(payload) })
export const getActivePolicy = (userId)  => request(`/policies/${userId}/active`)
export const renewPolicy     = (id)      => request(`/policies/${id}/renew`, { method: 'POST' })

// ── Claims ──────────────────────────────────────────────────
export const submitClaim   = (payload)  => request('/claims/', { method: 'POST', body: JSON.stringify(payload) })
export const getClaim      = (id)       => request(`/claims/${id}`)
export const triggerPayout = (id)       => request(`/claims/${id}/payout`, { method: 'POST' })
export const explainClaim  = (id)       => request(`/claims/${id}/explain`)

// ── Simulate ────────────────────────────────────────────────
export const getPresets    = ()         => request('/simulate/presets')
export const runSimulation = (payload)  => request('/simulate/run',  { method: 'POST', body: JSON.stringify(payload) })
export const getHistory    = (limit=50) => request(`/simulate/history?limit=${limit}`)
export const getUiDefaults = ()         => request('/simulate/ui-defaults')

// ── Admin ───────────────────────────────────────────────────
export const adminClaims     = (limit=50)     => request(`/admin/claims?limit=${limit}`)
export const fraudAlerts     = (threshold=0.5) => request(`/admin/fraud-alerts?threshold=${threshold}`)
export const systemStats     = ()             => request('/admin/stats')
export const runDbscanScan   = ()             => request('/admin/fraud/dbscan-scan', { method: 'POST' })
