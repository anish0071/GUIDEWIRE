import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Home',    icon: '🏠' },
  { to: '/plans',     label: 'Plans',   icon: '📋' },
  { to: '/profile',   label: 'Profile', icon: '👤' },
]

export function Navbar() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <>
      {/* ── Top Header ── */}
      <header className="top-header">
        <div className="top-header__brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <span className="top-header__logo">⚡</span>
          <span className="top-header__name">Project-A</span>
        </div>

        <nav className="top-header__desktop-nav">
          {NAV_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `nav-link nav-link--desktop${isActive ? ' nav-link--active' : ''}`
              }
            >
              <span className="nav-link__icon">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="top-header__right">
          <span className="top-header__user">{user?.name || 'Akshay'}</span>
          <div
            onClick={() => navigate('/profile')}
            style={{
              width: 34, height: 34, borderRadius: '50%', background: '#e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: '0.9rem',
            }}
          >👤</div>
        </div>
      </header>

      {/* ── Bottom Navigation (mobile) ── */}
      <nav className="bottom-nav">
        {NAV_LINKS.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `nav-link${isActive ? ' nav-link--active' : ''}`
            }
          >
            <span className="nav-link__icon">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
