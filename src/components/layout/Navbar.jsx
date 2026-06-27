// src/components/layout/Navbar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The single Navbar for all post-login screens.
// Replaces the 5 inline copies previously duplicated across pages.
//
// Usage:
//   <Navbar active="/feed" />
//
// The `active` prop should match the current route exactly.
// ─────────────────────────────────────────────────────────────────────────────
import { useNavigate } from 'react-router-dom'

// ── Icons ────────────────────────────────────────────────────────────────────
// Thin-stroke, rounded — consistent weight across all four tabs.

function IconHome({ filled }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={filled ? 2.2 : 1.7}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
        fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.12 : 0} />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function IconBooks({ filled }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={filled ? 2.2 : 1.7}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"
        fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.12 : 0} />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
        fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.12 : 0} />
      {filled && (
        <>
          <line x1="9" y1="7" x2="15" y2="7" />
          <line x1="9" y1="11" x2="13" y2="11" />
        </>
      )}
    </svg>
  )
}

function IconStats({ filled }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={filled ? 2.2 : 1.7}
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="12" width="4" height="8" rx="1"
        fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.9 : 0} />
      <rect x="10" y="6" width="4" height="14" rx="1"
        fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.9 : 0} />
      <rect x="17" y="9" width="4" height="11" rx="1"
        fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.9 : 0} />
      {!filled && (
        <>
          <line x1="5"  y1="20" x2="5"  y2="12" />
          <line x1="12" y1="20" x2="12" y2="6"  />
          <line x1="19" y1="20" x2="19" y2="9"  />
        </>
      )}
    </svg>
  )
}

function IconLibrary({ filled }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={filled ? 2.2 : 1.7}
      strokeLinecap="round" strokeLinejoin="round">
      {/* Three book spines side by side */}
      <rect x="3"  y="4" width="4" height="16" rx="1"
        fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.9 : 0} />
      <rect x="9"  y="2" width="4" height="18" rx="1"
        fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.9 : 0} />
      <rect x="15" y="6" width="4" height="14" rx="1"
        fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.9 : 0} />
      {!filled && (
        <>
          <line x1="3"  y1="4"  x2="3"  y2="20" />
          <line x1="7"  y1="4"  x2="7"  y2="20" />
          <line x1="9"  y1="2"  x2="9"  y2="20" />
          <line x1="13" y1="2"  x2="13" y2="20" />
          <line x1="15" y1="6"  x2="15" y2="20" />
          <line x1="19" y1="6"  x2="19" y2="20" />
        </>
      )}
    </svg>
  )
}

// ── Nav items definition ─────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    path:  '/feed',
    label: 'Inicio',
    Icon:  IconHome,
  },
  {
    path:  '/home',
    label: 'Mis libros',
    Icon:  IconBooks,
  },
  {
    path:  '/stats',
    label: 'Stats',
    Icon:  IconStats,
  },
  {
    path:  '/biblioteca',
    label: 'Biblioteca',
    Icon:  IconLibrary,
  },
]

// ── Component ────────────────────────────────────────────────────────────────

export default function Navbar({ active }) {
  const navigate = useNavigate()

  return (
    <>
      {/* Inline styles — no Tailwind dependencies for the glass pill */}
      <style>{`
        .folio-nav {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 6px 8px;
          border-radius: 9999px;
          background: rgba(248, 246, 242, 0.78);
          backdrop-filter: blur(20px) saturate(1.8);
          -webkit-backdrop-filter: blur(20px) saturate(1.8);
          border: 1px solid rgba(255, 255, 255, 0.6);
          box-shadow:
            0 4px 24px rgba(0, 0, 0, 0.08),
            0 1px 4px rgba(0, 0, 0, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
          width: min(360px, 88vw);
        }

        .folio-nav-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 7px 4px 6px;
          border: none;
          background: transparent;
          border-radius: 9999px;
          cursor: pointer;
          transition:
            color 220ms cubic-bezier(0.16, 1, 0.3, 1),
            background 220ms cubic-bezier(0.16, 1, 0.3, 1),
            transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1);
          -webkit-tap-highlight-color: transparent;
          position: relative;
          overflow: hidden;
        }

        .folio-nav-btn:active {
          transform: scale(0.91);
        }

        /* Inactive state */
        .folio-nav-btn {
          color: #9c9490;
        }

        /* Active state */
        .folio-nav-btn.is-active {
          color: #e8622a;
          background: rgba(232, 98, 42, 0.07);
        }

        /* Active indicator dot */
        .folio-nav-btn.is-active::after {
          content: '';
          position: absolute;
          bottom: 5px;
          left: 50%;
          transform: translateX(-50%);
          width: 3px;
          height: 3px;
          border-radius: 9999px;
          background: #e8622a;
          opacity: 0.6;
        }

        /* Icon container — handles the scale on active */
        .folio-nav-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .folio-nav-btn.is-active .folio-nav-icon {
          transform: scale(1.08);
        }

        /* Label */
        .folio-nav-label {
          font-family: 'Inter', -apple-system, sans-serif;
          font-size: 8.5px;
          font-weight: 600;
          letter-spacing: 0.04em;
          line-height: 1;
          text-transform: uppercase;
          /* prevent layout shift between active/inactive */
          min-width: 0;
        }
      `}</style>

      <nav className="folio-nav" role="navigation" aria-label="Navegación principal">
        {NAV_ITEMS.map(({ path, label, Icon }) => {
          const isActive = active === path
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`folio-nav-btn${isActive ? ' is-active' : ''}`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="folio-nav-icon">
                <Icon filled={isActive} />
              </span>
              <span className="folio-nav-label">{label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}