import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPlans, subscribePlan, getActivePolicy } from '../api'

export default function PlansPage() {
  const { userId, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans]       = useState([])
  const [active, setActive]     = useState(null)
  const [selected, setSelected] = useState(null)
  const [step, setStep]         = useState('browse')
  const [payMethod, setPayMethod] = useState('mock')
  const [loading, setLoading]   = useState(true)
  const [subLoading, setSubLoading] = useState(false)
  const [success, setSuccess]   = useState('')
  const [error, setError]       = useState('')

  useEffect(() => {
    Promise.all([
      getPlans(),
      getActivePolicy(userId).catch(() => null),
    ]).then(([p, a]) => {
      setPlans(p)
      setActive(a?.policy_id ? a : null)
    }).finally(() => setLoading(false))
  }, [userId])

  function handleSelect(plan) {
    setSelected(plan); setStep('checkout'); setError(''); setSuccess('')
  }

  async function handlePurchase() {
    if (!selected) return
    setSubLoading(true); setError('')
    try {
      await subscribePlan({ user_id: userId, plan_type: selected.plan })
      setSuccess('You\'re now covered! 🎉')
      refreshUser()
      const a = await getActivePolicy(userId).catch(() => null)
      setActive(a?.policy_id ? a : null)
      setTimeout(() => { setStep('browse'); setSuccess('') }, 2000)
    } catch (err) { setError(err.message) }
    finally { setSubLoading(false) }
  }

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  )

  /* ── CHECKOUT FLOW ── */
  if (step === 'checkout' && selected) {
    return (
      <div className="page">
        <main style={{ padding: '16px', maxWidth: 480, margin: '0 auto', width: '100%' }}>
          <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <button onClick={() => setStep('browse')} style={{
              background: '#f3f4f6', border: 'none', borderRadius: 10, width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', cursor: 'pointer',
            }}>←</button>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Complete Purchase</h1>
          </div>

          {/* Plan Details */}
          <div className="fade-up" style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 12 }}>Plan Details</div>
            <InfoRow label="Plan" value={selected.plan.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} />
            <InfoRow label="Coverage" value={`₹${selected.coverage}`} />
            <InfoRow label="Daily Limit" value={`₹${(selected.coverage / 7).toFixed(0)}`} />
            <InfoRow label="Duration" value="7 Days" />
          </div>

          {/* Risk + Premium card */}
          <div className="fade-up" style={{
            background: 'linear-gradient(140deg, #d4f700 0%, #c5e600 100%)',
            borderRadius: 16, padding: 16, marginBottom: 14, color: '#111',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Risk Level</span>
              <span style={{ background: '#111', color: '#d4f700', padding: '2px 10px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700 }}>MODERATE</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Total Premium</span>
              <span style={{ fontWeight: 900, fontSize: '1.8rem', lineHeight: 1 }}>₹{selected.base}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="fade-up" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 10 }}>Payment Method</div>
            {[
              { key: 'upi',  icon: '📱', label: 'UPI' },
              { key: 'card', icon: '💳', label: 'Credit/Debit Card' },
              { key: 'mock', icon: '✅', label: 'Mock Pay (Demo)' },
            ].map(m => (
              <div key={m.key} onClick={() => setPayMethod(m.key)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px',
                border: payMethod === m.key ? '2px solid #2563eb' : '1.5px solid #e5e7eb',
                borderRadius: 12, marginBottom: 8, cursor: 'pointer',
                background: payMethod === m.key ? '#eff6ff' : '#fff',
                transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: '1.1rem' }}>{m.icon}</span>
                <span style={{ fontWeight: 500, fontSize: '0.88rem' }}>{m.label}</span>
                {payMethod === m.key && (
                  <span style={{ marginLeft: 'auto', color: '#2563eb', fontWeight: 700 }}>✓</span>
                )}
              </div>
            ))}
          </div>

          {error && <div className="alert alert--error" style={{ marginBottom: 12 }}>{error}</div>}
          {success && <div className="alert alert--success" style={{ marginBottom: 12 }}>{success}</div>}

          <button className="btn btn--primary btn--full btn--lg fade-up"
            onClick={handlePurchase} disabled={subLoading}>
            {subLoading ? <span className="spinner" /> : `Pay ₹${selected.base}`}
          </button>
        </main>
      </div>
    )
  }

  /* ── BROWSE PLANS ── */
  return (
    <div className="page">
      <main style={{ padding: '16px', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        <div className="fade-up" style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Choose a Plan</h1>
          <p style={{ fontSize: '0.82rem', color: '#9ca3af' }}>Weekly protection for gig disruptions.</p>
        </div>

        {success && <div className="alert alert--success fade-up" style={{ marginBottom: 14 }}>{success}</div>}

        {/* Active policy mini-banner */}
        {active && (
          <div className="fade-up" style={{
            ...cardStyle, borderLeft: '3px solid #10b981', marginBottom: 14,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <span style={{
                background: '#ecfdf5', color: '#059669', padding: '2px 8px',
                borderRadius: 999, fontSize: '0.65rem', fontWeight: 700,
              }}>ACTIVE</span>
              <p style={{ fontWeight: 600, fontSize: '0.88rem', marginTop: 4 }}>
                {active.plan_type.replace('_', ' ').toUpperCase()}
              </p>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => navigate('/dashboard')}>View →</button>
          </div>
        )}

        {/* Plan cards */}
        {plans.map(plan => {
          const isPremium = plan.plan === 'weekly_premium'
          const isCurrent = active?.plan_type === plan.plan
          return (
            <div key={plan.plan} className="fade-up" style={{
              ...cardStyle, marginBottom: 14, position: 'relative',
              border: isCurrent ? '2px solid #10b981' : isPremium ? '2px solid #2563eb' : '1px solid #e5e7eb',
            }}>
              {isPremium && (
                <div style={{
                  position: 'absolute', top: -9, right: 14,
                  background: '#2563eb', color: '#fff', padding: '2px 10px',
                  borderRadius: 999, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                }}>Popular</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 44, height: 44, background: isPremium ? '#eff6ff' : '#f0fdf4',
                  borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
                }}>{isPremium ? '🏆' : '🌱'}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {plan.plan.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  <div>
                    <span style={{ fontSize: '1.4rem', fontWeight: 900 }}>₹{plan.base}</span>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}> /wk</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: '0.78rem', color: '#6b7280', marginBottom: 14 }}>
                <span>✅ ₹{plan.coverage} coverage</span>
                <span>✅ Auto-claims</span>
                <span>✅ Instant payout</span>
                {isPremium && <span>✅ 2× limit</span>}
              </div>
              <button className={`btn btn--full ${isCurrent ? 'btn--ghost' : 'btn--brand'}`}
                onClick={() => !isCurrent && handleSelect(plan)} disabled={isCurrent}>
                {isCurrent ? '✓ Current Plan' : 'Select Plan →'}
              </button>
            </div>
          )
        })}
      </main>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '10px 0',
      borderBottom: '1px solid #f0f0f0', fontSize: '0.85rem',
    }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  )
}

const cardStyle = {
  background: '#fff', border: '1px solid #e5e7eb',
  borderRadius: 16, padding: 16,
}
