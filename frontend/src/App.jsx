import React, { useState, useEffect } from 'react'

export default function App(){
  const [userId, setUserId] = useState(1)
  const [rain, setRain] = useState(20)
  const [traffic, setTraffic] = useState(40)
  const [temp, setTemp] = useState(22)
  const [inactivity, setInactivity] = useState(120)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [presets, setPresets] = useState({})
  const [history, setHistory] = useState([])
  const [selectedPreset, setSelectedPreset] = useState('')

  useEffect(()=>{
    fetch('/api/simulate/presets').then(r=>r.json()).then(setPresets).catch(()=>{})
    fetchHistory()
  }, [])

  async function fetchHistory(){
    try{
      const res = await fetch('/api/simulate/history')
      const data = await res.json()
      setHistory(data)
    }catch(e){
      // ignore
    }
  }

  async function simulate(){
    setLoading(true)
    setResult(null)
    try{
      const res = await fetch('/api/simulate/run', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ user_id: Number(userId), signals: { rain: Number(rain), traffic: Number(traffic), temp: Number(temp), inactivity: Number(inactivity) } })
      })
      const data = await res.json()
      setResult(data)
      fetchHistory()
    }catch(e){
      setResult({ error: e.message })
    }finally{
      setLoading(false)
    }
  }

  function applyPreset(name){
    const p = presets[name]
    if(!p) return
    setRain(p.rain ?? 0)
    setTraffic(p.traffic ?? 100)
    setTemp(p.temp ?? 22)
    setInactivity(p.inactivity ?? 0)
  }

  return (
    <div className="app-root">
      <header className="topbar">
        <button className="back">⟵</button>
        <h1>Your Claim</h1>
        <div className="badge">17</div>
      </header>

      <main className="container">
        <section className="card neon">
          <h2>Simulate Trigger</h2>
          <div className="row">
            <label>User ID</label>
            <input value={userId} onChange={e=>setUserId(e.target.value)} />
          </div>
          <div className="row">
            <label>Rain (mm)</label>
            <input type="range" min="0" max="200" value={rain} onChange={e=>setRain(e.target.value)} />
            <span>{rain}</span>
          </div>
          <div className="row">
            <label>Traffic Speed (km/h)</label>
            <input type="range" min="0" max="120" value={traffic} onChange={e=>setTraffic(e.target.value)} />
            <span>{traffic}</span>
          </div>
          <div className="row">
            <label>Temp (°C)</label>
            <input type="range" min="-10" max="60" value={temp} onChange={e=>setTemp(e.target.value)} />
            <span>{temp}</span>
          </div>
          <div className="row">
            <label>Inactivity (mins)</label>
            <input type="range" min="0" max="720" value={inactivity} onChange={e=>setInactivity(e.target.value)} />
            <span>{inactivity}</span>
          </div>
          <div className="actions">
            <button className="primary" onClick={simulate} disabled={loading}>{loading? 'Running...' : 'Run Simulation'}</button>
          </div>
        </section>

        <section className="card results">
          <h3>Result</h3>
          <pre>{result ? JSON.stringify(result, null, 2) : 'No result yet'}</pre>
        </section>

        <section className="card">
          <h3>Presets</h3>
          <div className="row">
            <select value={selectedPreset} onChange={e=>setSelectedPreset(e.target.value)}>
              <option value="">-- select --</option>
              {Object.keys(presets).map(k=>(<option key={k} value={k}>{k}</option>))}
            </select>
            <button className="primary" onClick={()=>applyPreset(selectedPreset)} disabled={!selectedPreset}>Apply</button>
          </div>
        </section>

        <section className="card">
          <h3>Simulation History (recent)</h3>
          <div className="results">
            {history.length===0? <div>No history</div> : (
              <ul>
                {history.map(h => (
                  <li key={h.id}>{new Date(h.timestamp).toLocaleString()} — triggers: {h.triggers_fired || 'none'} — claim: {h.created_claim_id || 'n/a'}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
