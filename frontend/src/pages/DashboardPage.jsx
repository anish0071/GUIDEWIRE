import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getActivePolicy, systemStats } from '../api'

export default function DashboardPage() {
  const { user, userId, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [policy, setPolicy] = useState(null)
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    Promise.all([
      getActivePolicy(userId).catch(() => null),
      systemStats().catch(() => null),
    ]).then(([p, s]) => {
      setPolicy(p?.policy_id ? p : null)
      setStats(s)
    }).finally(() => setLoading(false))
  }, [userId])

  useEffect(() => { refreshUser() }, [])

  if (loading) return <LoadingScreen />

  const greeting = getGreeting()
  const firstName = user?.name?.split(' ')[0] || 'Akshay'
  const trustScore = user?.trust_score ?? 50
  const wallet = user?.wallet_balance ?? 0

  return (
    <div className="page">
      <main style={{ padding: '16px', maxWidth: 480, margin: '0 auto', width: '100%' }}>

        {/* ── Greeting row ── */}
        <div className="fade-up" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: 2 }}>{greeting},</p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, lineHeight: 1.2 }}>{firstName}</h1>
        </div>

        {/* ── Quick stats row ── */}
        <div className="fade-up" style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <QuickStat icon="⭐" label="Trust" value={trustScore} suffix="/100"
            color={trustScore >= 70 ? '#10b981' : trustScore >= 40 ? '#f59e0b' : '#ef4444'} />
          <QuickStat icon="💰" label="Wallet" value={`₹${wallet.toFixed(0)}`} color="#2563eb" />
          <QuickStat icon="📄" label="Claims" value={stats?.claims?.total ?? 0} color="#6366f1" />
        </div>

        {/* ── Active Policy or CTA ── */}
        {policy ? (
          <PolicyCard policy={policy} />
        ) : (
          <div className="fade-up" style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16,
            padding: '20px 16px', textAlign: 'center', marginBottom: 14,
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🛡️</div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>No Active Policy</h3>
            <p style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: 14 }}>
              Get instant coverage for disruptions
            </p>
            <button className="btn btn--brand btn--full" onClick={() => navigate('/plans')}>
              Get Covered →
            </button>
          </div>
        )}

        {/* ── Live Status ── */}
        <div className="fade-up" style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16,
          padding: 16, marginBottom: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>📡 Live Status</span>
            <span style={{
              background: '#ecfdf5', color: '#059669', padding: '3px 10px',
              borderRadius: 999, fontSize: '0.7rem', fontWeight: 700,
            }}>NORMAL</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <StatusChip icon="🌤️" label="Weather" value="Clear" bg="#f0f9ff" />
            <StatusChip icon="🚗" label="Traffic" value="Light" bg="#f0fdf4" />
          </div>
        </div>

        {/* ── AI Risk Summary (compact) ── */}
        <div className="fade-up" style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16,
          padding: 16, marginBottom: 14,
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 14 }}>🤖 AI Analysis</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <RiskGauge label="Disruption" value={stats?.claims?.pending || 0} color="#2563eb" />
            <RiskGauge label="Confidence" value={88} color="#10b981" />
            <RiskGauge label="Fraud Risk" value={12} color="#ef4444" />
          </div>
        </div>

        {/* ── Recent Activity ── */}
        <div className="fade-up" style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16,
          padding: 16, marginBottom: 14,
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 12 }}>📋 Recent Activity</div>
          {stats?.claims?.total > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ActivityRow icon="📄" title="Claims processed" value={stats.claims.total} time="Total" />
              {stats.claims.paid > 0 && <ActivityRow icon="💰" title="Payouts credited" value={stats.claims.paid} time="Paid" accent />}
              {stats.claims.rejected > 0 && <ActivityRow icon="🚫" title="Claims rejected" value={stats.claims.rejected} time="Rejected" danger />}
            </div>
          ) : (
            <p style={{ fontSize: '0.82rem', color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>
              No activity yet. Subscribe to a plan to get started.
            </p>
          )}
        </div>

        {/* ── Wallet Card (dark) ── */}
        <div className="fade-up" style={{
          background: 'linear-gradient(135deg, #111827 0%, #1e293b 100%)',
          borderRadius: 16, padding: 16, color: '#fff', marginBottom: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#10b981', borderRadius: 10, padding: '8px 10px', fontSize: '1.1rem' }}>💰</div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Wallet Balance</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>₹{wallet.toFixed(0)}</div>
            </div>
          </div>
          {wallet > 0 && (
            <button style={{
              background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '8px 14px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            }}>Withdraw</button>
          )}
        </div>

      </main>
    </div>
  )
}

/* ── Sub-components ── */
function QuickStat({ icon, label, value, suffix, color }) {
  return (
    <div style={{
      flex: 1, background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: 14, padding: '12px 10px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '1rem', marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, color, lineHeight: 1 }}>
        {value}{suffix && <span style={{ fontSize: '0.6rem', fontWeight: 500, color: '#9ca3af' }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', marginTop: 2, letterSpacing: '0.04em' }}>{label}</div>
    </div>
  )
}

function PolicyCard({ policy }) {
  const days = Math.max(0, Math.ceil((new Date(policy.end_date) - new Date()) / 86400000))
  const pct = Math.round((policy.coverage_remaining / policy.coverage_limit) * 100)
  return (
    <div className="fade-up" style={{
      background: 'linear-gradient(140deg, #d4f700 0%, #c5e600 100%)',
      borderRadius: 18, padding: '18px 16px', marginBottom: 14, color: '#111',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span>🛡️</span>
            <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Active Policy</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#4a5500' }}>Expires in {days}d</span>
        </div>
        <span style={{
          background: '#111', color: '#d4f700', padding: '3px 10px',
          borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
        }}>{policy.plan_type.replace('_', ' ')}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: '0.65rem', color: '#4a5500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coverage Left</div>
          <span style={{ fontSize: '1.8rem', fontWeight: 900, lineHeight: 1 }}>₹{policy.coverage_remaining?.toFixed(0)}</span>
          <span style={{ fontSize: '0.78rem', color: '#4a5500' }}> / ₹{policy.coverage_limit}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.65rem', color: '#4a5500', textTransform: 'uppercase' }}>Premium</div>
          <div style={{ fontWeight: 800, fontSize: '1rem' }}>₹{policy.premium}/wk</div>
        </div>
      </div>
      {/* Progress bar */}
      <div style={{ height: 5, background: 'rgba(0,0,0,0.1)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#111', borderRadius: 999, transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

function StatusChip({ icon, label, value, bg }) {
  return (
    <div style={{
      background: bg, borderRadius: 12, padding: '12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: '1.2rem' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '0.62rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{value}</div>
      </div>
    </div>
  )
}

function RiskGauge({ label, value, color }) {
  const size = 56
  const stroke = 5
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  const offset = circ - (value / 100) * circ
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.8s ease' }} />
        <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
          style={{ fontSize: '0.72rem', fontWeight: 800, fill: color }}>{value}%</text>
      </svg>
      <div style={{ fontSize: '0.6rem', color: '#9ca3af', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
    </div>
  )
}

function ActivityRow({ icon, title, value, time, accent, danger }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', background: '#f9fafb', borderRadius: 10,
    }}>
      <span style={{ fontSize: '1rem' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{time}</div>
      </div>
      <span style={{
        fontWeight: 800, fontSize: '0.95rem',
        color: danger ? '#ef4444' : accent ? '#10b981' : '#111',
      }}>{value}</span>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <span className="spinner" style={{ width: 28, height: 28 }} />
        <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 10 }}>Loading your dashboard...</p>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}
