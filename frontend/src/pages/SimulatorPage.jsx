import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getPresets, runSimulation, getHistory } from '../api'

const SIGNAL_CONFIG = [
  { key: 'rain',       label: 'Rain',      unit: 'mm',   min: 0,   max: 300, danger: 30 },
  { key: 'traffic',    label: 'Traffic',    unit: 'km/h', min: 0,   max: 120, danger: 20, invert: true },
  { key: 'temp',       label: 'Temp',      unit: '°C',   min: -10, max: 60,  danger: 40 },
  { key: 'inactivity', label: 'Inactive',  unit: 'min',  min: 0,   max: 720, danger: 180 },
]

const DEFAULT_SIGNALS = { rain: 20, traffic: 40, temp: 22, inactivity: 120 }

function statusBadgeClass(status) {
  const map = { approved: 'badge--success', rejected: 'badge--danger', paid: 'badge--info', pending: 'badge--warning' }
  return map[status] || 'badge--neutral'
}

export default function SimulatorPage() {
  const { userId } = useAuth()
  const [signals,  setSignals]  = useState(DEFAULT_SIGNALS)
  const [presets,  setPresets]  = useState({})
  const [result,   setResult]   = useState(null)
  const [history,  setHistory]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [selPreset, setSelPreset] = useState('')
  const [tab, setTab] = useState('controls') // mobile tabs: 'controls' | 'result' | 'history'

  useEffect(() => {
    getPresets().then(setPresets).catch(() => {})
    fetchHistory()
  }, [])

  async function fetchHistory() {
    getHistory(20).then(setHistory).catch(() => {})
  }

  function applyPreset(name) {
    const p = presets[name]
    if (!p) return
    setSignals(prev => ({
      ...prev,
      rain: p.rain ?? prev.rain,
      traffic: p.traffic ?? prev.traffic,
      temp: p.temp ?? prev.temp,
      inactivity: p.inactivity ?? prev.inactivity,
    }))
    setSelPreset(name)
  }

  async function handleRun() {
    setLoading(true); setResult(null)
    try {
      const data = await runSimulation({ user_id: Number(userId), signals })
      setResult(data)
      setTab('result') // auto-switch to result tab on mobile
      fetchHistory()
    } catch (err) {
      setResult({ error: err.message })
      setTab('result')
    } finally { setLoading(false) }
  }

  return (
    <div className="page">
      <main className="container" style={{ padding: '20px 16px' }}>
        <div style={{ marginBottom: '16px' }} className="fade-up">
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>⚡ Simulator</h1>
          <p className="text-muted" style={{ fontSize: '0.82rem' }}>Simulate disruption signals.</p>
        </div>

        {/* Mobile tab switcher */}
        <div className="fade-up" style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto' }}>
          {[
            { key: 'controls', label: '🎛️ Controls' },
            { key: 'result',   label: '📊 Result' },
            { key: 'history',  label: '🕐 History' },
          ].map(t => (
            <button
              key={t.key}
              className={`btn btn--sm ${tab === t.key ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setTab(t.key)}
              style={{ whiteSpace: 'nowrap', flex: '1' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Controls tab */}
        {tab === 'controls' && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Presets */}
            <div className="card">
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px' }}>🎭 Presets</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {Object.keys(presets).map(name => (
                  <button
                    key={name}
                    className={`btn btn--sm ${selPreset === name ? 'btn--primary' : 'btn--ghost'}`}
                    onClick={() => applyPreset(name)}
                    style={{ fontSize: '0.75rem' }}
                  >
                    {name.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Signal sliders */}
            <div className="card">
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>🎛️ Signals</h2>
              {SIGNAL_CONFIG.map(cfg => {
                const val = signals[cfg.key] ?? cfg.min
                const isHigh = cfg.invert ? val < cfg.danger : val > cfg.danger
                return (
                  <div key={cfg.key} className="slider-row">
                    <div className="slider-label">
                      {isHigh && <span style={{ color: 'var(--color-danger)', marginRight: 2 }}>⚠️</span>}
                      {cfg.label}
                    </div>
                    <input
                      type="range"
                      min={cfg.min} max={cfg.max}
                      value={val}
                      onChange={e => setSignals(s => ({ ...s, [cfg.key]: Number(e.target.value) }))}
                    />
                    <span className="slider-value" style={{ color: isHigh ? 'var(--color-danger)' : 'var(--color-accent)' }}>
                      {val}
                    </span>
                  </div>
                )
              })}
              <button
                className="btn btn--primary btn--full"
                onClick={handleRun}
                disabled={loading}
                style={{ marginTop: '8px' }}
              >
                {loading ? <><span className="spinner" /> Processing...</> : '▶ Run Simulation'}
              </button>
            </div>
          </div>
        )}

        {/* Result tab */}
        {tab === 'result' && (
          <div className="card fade-up">
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>📊 Result</h2>
            {!result && !loading && (
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>Run a simulation first.</p>
            )}
            {result?.error && <div className="alert alert--error">{result.error}</div>}
            {result && !result.error && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <ResultRow label="Triggers" value={result.fired?.join(', ') || 'None'} />
                <ResultRow label="Claim ID" value={result.claim_id ?? 'No claim'} />
                {result.claim_status && (
                  <div className="flex-between">
                    <span className="text-muted" style={{ fontSize: '0.82rem' }}>Status</span>
                    <span className={`badge ${statusBadgeClass(result.claim_status)}`}>
                      {result.claim_status?.toUpperCase()}
                    </span>
                  </div>
                )}
                {result.payout_amount > 0 && (
                  <div className="alert alert--success" style={{ fontSize: '0.82rem' }}>
                    💰 ₹{result.payout_amount?.toFixed(2)} credited!
                  </div>
                )}
                <div className="divider" style={{ margin: '8px 0' }} />
                <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>AI Metrics</h3>
                <MetricBar label="Risk"       value={result.metrics?.risk}       color="#ef4444" />
                <MetricBar label="Confidence" value={result.metrics?.confidence} color="#22c55e" />
                <MetricBar label="Fraud"      value={result.metrics?.fraud}      color="#f59e0b" />
              </div>
            )}
          </div>
        )}

        {/* History tab */}
        {tab === 'history' && (
          <div className="card fade-up">
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>🕐 History</h2>
            {history.length === 0
              ? <p className="text-muted" style={{ fontSize: '0.85rem' }}>No history yet.</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                  {history.map(h => (
                    <div key={h.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                    }}>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                          {h.triggers_fired || 'No triggers'}
                        </div>
                        <div className="text-xs">
                          {new Date(h.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <span className={`badge ${statusBadgeClass(h.result_status)}`}>
                        {h.result_status || 'none'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}
      </main>
    </div>
  )
}

function ResultRow({ label, value }) {
  return (
    <div className="flex-between" style={{ fontSize: '0.82rem' }}>
      <span className="text-muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function MetricBar({ label, value, color }) {
  const pct = Math.round((value ?? 0) * 100)
  return (
    <div>
      <div className="flex-between" style={{ fontSize: '0.78rem', marginBottom: '3px' }}>
        <span className="text-muted">{label}</span>
        <span style={{ color, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '999px', transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}
