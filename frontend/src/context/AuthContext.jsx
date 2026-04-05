import React, { createContext, useContext, useState, useEffect } from 'react'
import { getProfile } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token,  setToken]  = useState(() => localStorage.getItem('pa_token') || null)
  const [userId, setUserId] = useState(() => Number(localStorage.getItem('pa_user_id')) || null)
  const [user,   setUser]   = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch user profile whenever userId changes
  useEffect(() => {
    if (!userId) { setLoading(false); return }
    getProfile(userId)
      .then(setUser)
      .catch(() => logout())
      .finally(() => setLoading(false))
  }, [userId])

  function login(tok, uid) {
    localStorage.setItem('pa_token',   tok)
    localStorage.setItem('pa_user_id', uid)
    setToken(tok)
    setUserId(uid)
  }

  function logout() {
    localStorage.removeItem('pa_token')
    localStorage.removeItem('pa_user_id')
    setToken(null)
    setUserId(null)
    setUser(null)
  }

  function refreshUser() {
    if (!userId) return
    getProfile(userId).then(setUser).catch(() => {})
  }

  const isAuthenticated = !!token && !!userId

  return (
    <AuthContext.Provider value={{ token, userId, user, loading, isAuthenticated, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
