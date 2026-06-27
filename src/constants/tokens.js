// src/constants/tokens.js
// ─────────────────────────────────────────────────────────────────────────────
// FOLIO — Design tokens. Single source of truth.
// Every color, radius or shadow used in the app lives here first.
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  // Backgrounds
  bg:          '#f8f6f2',   // warm off-white — every post-login screen
  bgCard:      '#ffffff',
  bgDark:      '#111210',   // login / register screens

  // Text
  textPrimary: '#1a1714',   // near-black, warm undertone
  textSecond:  '#9c9490',   // muted labels
  textInverse: '#f8f6f2',

  // Brand accent
  accent:      '#e8622a',   // deeper, less saturated orange
  accentLight: '#fdf1eb',   // tint for chips / badges

  // Borders / dividers
  border:      'rgba(26, 23, 20, 0.08)',
  borderMid:   'rgba(26, 23, 20, 0.14)',

  // Navbar glass
  navBg:       'rgba(248, 246, 242, 0.72)',
  navBorder:   'rgba(255, 255, 255, 0.55)',
}

export const font = {
  // Use Inter from Google Fonts (must be imported in index.html)
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",

  // Type scale — 6 levels, nothing outside these
  display:  { size: '22px', weight: 800, letterSpacing: '-0.025em', lineHeight: 1.15 },
  title:    { size: '17px', weight: 700, letterSpacing: '-0.018em', lineHeight: 1.25 },
  heading:  { size: '13px', weight: 600, letterSpacing: '-0.01em',  lineHeight: 1.4  },
  body:     { size: '13px', weight: 400, letterSpacing: '-0.005em', lineHeight: 1.55 },
  caption:  { size: '11px', weight: 500, letterSpacing: '0.01em',  lineHeight: 1.4  },
  micro:    { size: '9px',  weight: 600, letterSpacing: '0.07em',  lineHeight: 1.3  },
}

export const radius = {
  sm:   '10px',
  md:   '16px',
  lg:   '24px',
  xl:   '32px',
  full: '9999px',
}

export const shadow = {
  card:  '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  nav:   '0 -1px 0 rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.08)',
  float: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
}