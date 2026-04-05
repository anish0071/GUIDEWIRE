import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { updateProfile, getActivePolicy } from '../api'

const WORK_TYPES = ['Delivery Rider', 'Freelancer', 'Auto Driver', 'Vendor', 'Domestic Worker', 'Other']

export default function ProfilePage() {
  const { user, userId, refreshUser, logout } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [policy, setPolicy] = useState(null)
  const [form, setForm] = useState({
    name: user?.name || '',
    age: user?.age || '',
    gender: user?.gender || '',
    location: user?.location || '',
    work_type: user?.work_type || '',
    daily_earnings: user?.daily_earnings || '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getActivePolicy(userId).then(p => setPolicy(p?.policy_id ? p : null)).catch(() => { })
  }, [userId])

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSave(e) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess(false)
    try {
      await updateProfile(userId, {
        ...form,
        age: form.age ? Number(form.age) : undefined,
        daily_earnings: form.daily_earnings ? Number(form.daily_earnings) : undefined,
      })
      await refreshUser()
      setSuccess(true); setEditing(false)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  function handleLogout() { logout(); navigate('/login') }

  const trust = user?.trust_score ?? 50
  const wallet = user?.wallet_balance ?? 0
  const initials = (user?.name || 'U').charAt(0).toUpperCase()

  return (
    <div className="page">
      <main style={{ padding: '16px', maxWidth: 480, margin: '0 auto', width: '100%' }}>

        {success && <div className="alert alert--success fade-up" style={{ marginBottom: 12 }}>✅ Profile saved!</div>}

        {/* ── Avatar + Name ── */}
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 10px',
            background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem', fontWeight: 800, color: '#fff', position: 'relative',
          }}>
            {initials}
            <div style={{
              position: 'absolute', bottom: -2, right: -2, width: 22, height: 22,
              borderRadius: '50%', background: '#2563eb', border: '2px solid #fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: '#fff',
            }}>📷</div>
          </div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{user?.name || 'Akshay'}</h1>
          {user?.work_type && (
            <p style={{ fontSize: '0.78rem', marginTop: 2 }}>
              <span style={{ color: '#2563eb', fontWeight: 600 }}>Verified</span>
              <span style={{ color: '#9ca3af' }}> · {user.work_type}</span>
            </p>
          )}
          {user?.location && <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{user.location}</p>}
        </div>

        {/* ── Personal Info ── */}
        <Section icon="👤" title="Personal Information"
          action={<ActionBtn label={editing ? 'Cancel' : 'Edit'} onClick={() => setEditing(!editing)} />}>
          {editing ? (
            <form onSubmit={handleSave}>
              <FormRow label="Full Name">
                <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your name" />
              </FormRow>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <FormRow label="Age">
                  <input className="form-input" type="number" inputMode="numeric" value={form.age} onChange={e => set('age', e.target.value)} placeholder="28" />
                </FormRow>
                <FormRow label="Gender">
                  <select className="form-input form-select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </FormRow>
              </div>
              <FormRow label="Location">
                <input className="form-input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Chennai" />
              </FormRow>
              <FormRow label="Work Type">
                <select className="form-input form-select" value={form.work_type} onChange={e => set('work_type', e.target.value)}>
                  <option value="">Select</option>
                  {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormRow>
              <FormRow label="Daily Earnings (₹)">
                <input className="form-input" type="number" inputMode="numeric" value={form.daily_earnings} onChange={e => set('daily_earnings', e.target.value)} placeholder="800" />
              </FormRow>
              {error && <div className="alert alert--error" style={{ marginBottom: 10, fontSize: '0.82rem' }}>{error}</div>}
              <button className="btn btn--brand btn--full" type="submit" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Save Changes'}
              </button>
            </form>
          ) : (
            <>
              <DataRow label="Phone" value={user?.phone ? `+91 ${user.phone}` : null} />
              <DataRow label="Age" value={user?.age ? `${user.age} years` : null} />
              <DataRow label="Gender" value={user?.gender ? cap(user.gender) : null} />
              <DataRow label="Location" value={user?.location} />
            </>
          )}
        </Section>

        {/* ── Trust Score ── */}
        <Section icon="🛡️" title="Trust Score"
          right={<span style={{ fontSize: '1.3rem', fontWeight: 900, color: trust >= 70 ? '#10b981' : trust >= 40 ? '#f59e0b' : '#ef4444' }}>
            {trust}<span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#9ca3af' }}>/100</span>
          </span>}>
          <div style={{ height: 6, background: '#e5e7eb', borderRadius: 999, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{
              width: `${trust}%`, height: '100%', borderRadius: 999, transition: 'width 0.5s',
              background: trust >= 70 ? '#10b981' : trust >= 40 ? '#f59e0b' : '#ef4444'
            }} />
          </div>
          <TrustFactor icon="✅" text="Active during work hours" ok />
          <TrustFactor icon="✅" text="Consistent location" ok />
          {trust < 70 && <TrustFactor icon="⚠️" text="Minor anomalies detected" />}
        </Section>

        {/* ── Policy Info ── */}
        {policy && (
          <div className="fade-up" style={{
            background: '#111827', color: '#fff', borderRadius: 16,
            padding: 16, marginBottom: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🛡️</span>
                <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Policy Info</span>
              </div>
              <span style={{ background: '#10b981', padding: '2px 8px', borderRadius: 999, fontSize: '0.62rem', fontWeight: 700 }}>ACTIVE</span>
            </div>
            <DataRow label="Plan Type" value={policy.plan_type.replace('_', ' ').toUpperCase()} light />
            <DataRow label="Premium" value={`₹${policy.premium}/wk`} light />
            <DataRow label="Coverage" value={`₹${policy.coverage_remaining} / ₹${policy.coverage_limit}`} light />
          </div>
        )}

        {/* ── Work & Earnings ── */}
        <Section icon="💼" title="Work & Earnings">
          <DataRow label="Work Type" value={user?.work_type} />
          <DataRow label="Daily Earnings" value={user?.daily_earnings ? `₹${user.daily_earnings}` : null} />
          <DataRow label="Wallet Balance" value={`₹${wallet.toFixed(0)}`} />
        </Section>

        {/* ── Notifications ── */}
        <Section icon="🔔" title="Notifications">
          <ToggleRow label="Disruption Alerts" sub="Notified about app disruptions" on />
          <ToggleRow label="Claim Updates" sub="Status of your active claims" on />
          <ToggleRow label="Payment Notifications" sub="Premium deductions and payouts" on />
        </Section>

        {/* ── Security ── */}
        <Section icon="🔒" title="Security">
          <NavRow label="Change Phone Number" />
          <NavRow label="Device Sessions" />
        </Section>

        {/* ── Logout ── */}
        <div className="fade-up" style={{ textAlign: 'center', padding: '16px 0 20px' }}>
          <button onClick={handleLogout} style={{
            background: 'transparent', color: '#ef4444', border: '1.5px solid #ef4444',
            borderRadius: 999, padding: '10px 36px', fontWeight: 600, fontSize: '0.88rem',
            cursor: 'pointer', fontFamily: 'var(--font-base)',
          }}>
            ↪ Logout Securely
          </button>
        </div>
      </main>
    </div>
  )
}

/* ── Reusable sub-components ── */
function Section({ icon, title, action, right, children }) {
  return (
    <div className="fade-up" style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16,
      padding: 16, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.92rem', flex: 1 }}>{title}</span>
        {right}
        {action}
      </div>
      {children}
    </div>
  )
}

function DataRow({ label, value, light }) {
  const hasValue = value !== null && value !== undefined && value !== ''
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', borderBottom: `1px solid ${light ? 'rgba(255,255,255,0.1)' : '#f0f0f0'}`,
      fontSize: '0.85rem',
    }}>
      <span style={{ color: light ? 'rgba(255,255,255,0.55)' : '#9ca3af' }}>{label}</span>
      {hasValue
        ? <span style={{ fontWeight: 600, color: light ? '#fff' : '#111' }}>{value}</span>
        : <span style={{ fontSize: '0.78rem', color: light ? 'rgba(255,255,255,0.3)' : '#d1d5db', fontStyle: 'italic' }}>Not set</span>
      }
    </div>
  )
}

function FormRow({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, display: 'block' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function TrustFactor({ icon, text, ok }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 4,
      background: ok ? '#f0fdf4' : '#fffbeb', borderRadius: 8, fontSize: '0.82rem',
      color: ok ? '#065f46' : '#92400e',
    }}>
      <span>{icon}</span><span>{text}</span>
    </div>
  )
}

function ToggleRow({ label, sub, on: defaultOn }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{label}</div>
        <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{sub}</div>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={on} onChange={() => setOn(!on)} />
        <span className="toggle__slider" />
      </label>
    </div>
  )
}

function NavRow({ label }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}>
      <span style={{ fontSize: '0.85rem' }}>{label}</span>
      <span style={{ color: '#d1d5db', fontSize: '0.9rem' }}>›</span>
    </div>
  )
}

function ActionBtn({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', color: '#2563eb', fontSize: '0.82rem',
      fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-base)',
    }}>{label}</button>
  )
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
