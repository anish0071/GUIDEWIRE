import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { sendOTP, verifyOTP } from '../api'

export default function LoginPage() {
  const [phone, setPhone]   = useState('')
  const [otp, setOtp]       = useState('')
  const [step, setStep]     = useState('phone')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [otpHint, setOtpHint] = useState('')

  const { login } = useAuth()
  const navigate  = useNavigate()

  async function handleSendOTP(e) {
    e.preventDefault()
    if (!phone.trim()) return setError('Phone number is required.')
    setError(''); setLoading(true)
    try {
      const res = await sendOTP(phone.trim())
      setOtpHint(res.message || '')
      setStep('otp')
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  async function handleVerify(e) {
    e.preventDefault()
    if (!otp.trim()) return setError('Enter the OTP.')
    setError(''); setLoading(true)
    try {
      const res = await verifyOTP(phone.trim(), otp.trim())
      login(res.token, res.user_id)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={styles.root}>
      {/* Blue gradient top */}
      <div style={styles.topBg} />

      <div className="container container--narrow fade-up" style={styles.wrap}>
        <div style={styles.logoWrap}>
          <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>⚡</div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff' }}>
            Project-A
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', marginTop: '4px' }}>
            Parametric Insurance for Gig Workers
          </p>
        </div>

        <div className="section-card" style={{ width: '100%', padding: '24px 20px' }}>
          {step === 'phone' ? (
            <>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '4px' }}>Welcome back</h2>
              <p className="text-muted" style={{ marginBottom: '20px', fontSize: '0.85rem' }}>
                Enter your phone number to get started.
              </p>
              <form onSubmit={handleSendOTP}>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    className="form-input"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    autoFocus
                  />
                </div>
                {error && <div className="alert alert--error" style={{ marginBottom: '14px' }}>{error}</div>}
                <button className="btn btn--primary btn--full btn--lg" type="submit" disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Send OTP →'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '4px' }}>Verify OTP</h2>
              {otpHint && (
                <div className="alert alert--info" style={{ marginBottom: '14px', fontSize: '0.82rem' }}>
                  {otpHint}
                </div>
              )}
              <form onSubmit={handleVerify}>
                <div className="form-group">
                  <label className="form-label">OTP Code</label>
                  <input
                    className="form-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="6-digit OTP"
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    maxLength={6}
                    autoFocus
                    style={{ letterSpacing: '0.3em', fontSize: '1.4rem', textAlign: 'center', fontWeight: 700 }}
                  />
                </div>
                {error && <div className="alert alert--error" style={{ marginBottom: '14px' }}>{error}</div>}
                <button className="btn btn--primary btn--full btn--lg" type="submit" disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Verify & Enter →'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--full"
                  style={{ marginTop: '10px' }}
                  onClick={() => { setStep('phone'); setError(''); setOtp('') }}
                >
                  ← Change number
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    background: '#f0f2f5',
    padding: '24px 16px',
  },
  topBg: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: '45%',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    borderRadius: '0 0 40px 40px',
  },
  wrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px',
    position: 'relative', zIndex: 1, width: '100%',
  },
  logoWrap: { textAlign: 'center' },
}
