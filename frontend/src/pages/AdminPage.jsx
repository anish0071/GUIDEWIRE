import React, { useState, useEffect } from 'react'
import { adminClaims, fraudAlerts, systemStats, runDbscanScan } from '../api'

function statusClass(s) {
  const m = { approved: 'success', rejected: 'danger', paid: 'info', pending: 'warning' }
  return `badge--${m[s] || 'neutral'}`
}

export default function AdminPage() {
  const [claims,  setClaims]  = useState([])
  const [fraud,   setFraud]   = useState(null)
  const [stats,   setStats]   = useState(null)
  const [scan,    setScan]    = useState(null)
  const [tab,     setTab]     = useState('claims')
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    Promise.all([
      adminClaims(50),
      fraudAlerts(0.4),
      systemStats(),
    ]).then(([c, f, s]) => {
      setClaims(c)
      setFraud(f)
      setStats(s)
    }).finally(() => setLoading(false))
  }, [])

  async function handleDbscan() {
    setScanning(true)
    try {
      const res = await runDbscanScan()
      setScan(res)
    } catch {
      setScan({ error: 'DBSCAN scan failed.' })
    } finally { setScanning(false) }
  }

  if (loading) return <Loader />

  return (
    <div className="page">
      <main className="container" style={{ padding: '20px 16px' }}>
        <div style={{ marginBottom: '16px' }} className="fade-up">
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>🛡️ Admin</h1>
          <p className="text-muted" style={{ fontSize: '0.82rem' }}>Claims, fraud, and platform health.</p>
        </div>

        {/* Stats — 2x2 grid on mobile */}
        {stats && (
          <div className="grid grid--4 fade-up" style={{ marginBottom: '16px' }}>
            <StatCard label="Users"    value={stats.users}           color="#4f6ef7" icon="👥" />
            <StatCard label="Policies" value={stats.policies}        color="#22c55e" icon="📋" />
            <StatCard label="Paid"     value={stats.claims.paid}     color="#38bdf8" icon="💸" />
            <StatCard label="Rejected" value={stats.claims.rejected} color="#ef4444" icon="🚫" />
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto' }} className="fade-up">
          {['claims', 'fraud', 'dbscan'].map(t => (
            <button
              key={t}
              className={`btn ${tab === t ? 'btn--primary' : 'btn--ghost'} btn--sm`}
              onClick={() => setTab(t)}
              style={{ whiteSpace: 'nowrap', flex: '1' }}
            >
              {t === 'claims' ? '📄 Claims' : t === 'fraud' ? '⚠️ Fraud' : '🔬 DBSCAN'}
            </button>
          ))}
        </div>

        {/* Claims Tab */}
        {tab === 'claims' && (
          <div className="card fade-up">
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>
              Claims ({claims.length})
            </h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>Status</th><th>Conf</th><th>Fraud</th><th>Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map(c => (
                    <tr key={c.claim_id}>
                      <td><code>#{c.claim_id}</code></td>
                      <td><span className={`badge ${statusClass(c.status)}`}>{c.status}</span></td>
                      <td>{(c.confidence_score * 100).toFixed(0)}%</td>
                      <td>
                        <span style={{ color: c.fraud_score > 0.4 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                          {(c.fraud_score * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td>{c.payout_amount > 0 ? `₹${c.payout_amount.toFixed(0)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Fraud Tab */}
        {tab === 'fraud' && (
          <div className="card fade-up">
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700 }}>⚠️ Flagged</h2>
              <span className="badge badge--danger">{fraud?.total_flagged}</span>
            </div>
            {fraud?.claims?.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>No fraud alerts.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {fraud?.claims?.map(c => (
                  <div key={c.claim_id} className="flex-between" style={{
                    padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Claim #{c.claim_id}</div>
                      <div className="text-xs">User {c.user_id}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: 'var(--color-danger)', fontWeight: 700, fontSize: '0.9rem' }}>
                        {(c.fraud_score * 100).toFixed(0)}%
                      </span>
                      <div><span className={`badge ${statusClass(c.status)}`}>{c.status}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DBSCAN Tab */}
        {tab === 'dbscan' && (
          <div className="card fade-up">
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '6px' }}>🔬 DBSCAN Scan</h2>
            <p className="text-muted" style={{ fontSize: '0.78rem', marginBottom: '16px' }}>
              Cluster analysis on signals to detect coordinated fraud.
            </p>
            <button
              className="btn btn--primary btn--full"
              onClick={handleDbscan}
              disabled={scanning}
            >
              {scanning ? <><span className="spinner" /> Scanning...</> : '🔍 Run Scan'}
            </button>
            {scan && !scan.error && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: '12px' }}>
                  <MiniStat label="Scanned" value={scan.scanned} />
                  <MiniStat label="Flagged" value={scan.flagged_count} />
                  <MiniStat label="IDs" value={scan.flagged_claim_ids?.length} />
                </div>
                {scan.flagged_claim_ids?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {scan.flagged_claim_ids.map(id => (
                      <span key={id} className="badge badge--danger">#{id}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {scan?.error && <div className="alert alert--error" style={{ marginTop: '12px' }}>{scan.error}</div>}
          </div>
        )}
      </main>
    </div>
  )
}

function StatCard({ label, value, color, icon }) {
  return (
    <div className="card" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: '1.3rem', marginBottom: '6px' }}>{icon}</div>
      <div className="stat-block">
        <span className="stat-block__value" style={{ color }}>{value}</span>
        <span className="stat-block__label">{label}</span>
      </div>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-brand)' }}>{value ?? 0}</div>
      <div className="text-xs" style={{ marginTop: '2px' }}>{label}</div>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )
}
