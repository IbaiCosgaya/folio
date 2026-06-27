// src/pages/Stats.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { getGenreStyle } from '../constants/genres'
import Navbar from '../components/layout/Navbar'

// ─────────────────────────────────────────────────────────────────────────────
// TODO (Fase 5 — optimización): mover estos cálculos a Supabase queries
// agregadas o Edge Functions para evitar descargar todas las sesiones al cliente.
// calcStreak, calcLongestStreak, calcMonthlyPages pueden resolverse con
// window functions en SQL. avgSpeed y bestHour con GROUP BY + AVG.
// ─────────────────────────────────────────────────────────────────────────────

// ── Pure calculation helpers ──────────────────────────────────────────────────

function calcStreak(sessions) {
  if (!sessions.length) return 0
  const dates = [...new Set(sessions.map(s => s.date))].sort().reverse()
  let streak = 0
  let current = new Date()
  for (const date of dates) {
    const d = new Date(date)
    const diff = Math.floor((current - d) / (1000 * 60 * 60 * 24))
    if (diff <= 1) { streak++; current = d }
    else break
  }
  return streak
}

function calcLongestStreak(sessions) {
  if (!sessions.length) return 0
  const dates = [...new Set(sessions.map(s => s.date))].sort()
  let longest = 1, current = 1
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1])
    const curr = new Date(dates[i])
    const diff = Math.floor((curr - prev) / (1000 * 60 * 60 * 24))
    if (diff === 1) { current++; longest = Math.max(longest, current) }
    else current = 1
  }
  return longest
}

function formatHourRange(h) {
  const labels = {
    5: 'Madrugada', 6: 'Madrugada', 7: 'Mañana temprano',
    8: 'Mañana', 9: 'Mañana', 10: 'Mañana',
    11: 'Mediodía', 12: 'Mediodía', 13: 'Mediodía',
    14: 'Tarde', 15: 'Tarde', 16: 'Tarde', 17: 'Tarde', 18: 'Tarde',
    19: 'Noche', 20: 'Noche', 21: 'Noche',
    22: 'Noche tardía', 23: 'Noche tardía', 0: 'Madrugada',
  }
  return labels[h] || `${h}:00h`
}

function calcMonthlyPages(sessions, months) {
  const result = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const pages = sessions
      .filter(s => s.date?.startsWith(key))
      .reduce((sum, s) => sum + s.pages_read, 0)
    result.push({
      label: d.toLocaleDateString('es-ES', { month: 'short' }),
      pages,
      key,
    })
  }
  return result
}

// ── Heatmap intensity: 4 levels of opacity based on pages read that day ───────

function heatmapStyle(pages) {
  if (!pages || pages === 0) return { background: 'rgba(26,23,20,0.06)' }
  if (pages < 20)  return { background: 'rgba(232,98,42,0.25)' }
  if (pages < 50)  return { background: 'rgba(232,98,42,0.50)' }
  if (pages < 100) return { background: 'rgba(232,98,42,0.75)' }
  return { background: '#e8622a' }
}

// ── Small UI primitives ───────────────────────────────────────────────────────

// Hero metric — large number, used for the two top stats
function HeroCard({ label, value, unit, accent = false }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      border: '0.5px solid rgba(26,23,20,0.07)',
      padding: '18px 20px 16px',
      flex: 1,
    }}>
      <p style={{
        fontSize: '9px', fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: '#9c9490', marginBottom: '6px',
      }}>
        {label}
      </p>
      <p style={{
        fontSize: '38px', fontWeight: 900,
        color: accent ? '#e8622a' : '#1a1714',
        letterSpacing: '-0.04em', lineHeight: 1,
      }}>
        {value}
      </p>
      <p style={{ fontSize: '11px', color: '#9c9490', marginTop: '5px', fontWeight: 500 }}>
        {unit}
      </p>
    </div>
  )
}

// Secondary metric — smaller, used for the supporting stats
function StatCard({ label, value, unit, wide = false }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '18px',
      border: '0.5px solid rgba(26,23,20,0.07)',
      padding: '14px 16px',
      flex: wide ? '1 1 100%' : 1,
    }}>
      <p style={{
        fontSize: '9px', fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: '#9c9490', marginBottom: '5px',
      }}>
        {label}
      </p>
      <p style={{
        fontSize: '22px', fontWeight: 800,
        color: '#1a1714', letterSpacing: '-0.03em', lineHeight: 1.1,
      }}>
        {value}
      </p>
      {unit && (
        <p style={{ fontSize: '10px', color: '#9c9490', marginTop: '3px', fontWeight: 500 }}>
          {unit}
        </p>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Stats() {
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const navigate = useNavigate()

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    const { data: { user } } = await supabase.auth.getUser()

    const { data: rawSessions } = await supabase
      .from('reading_sessions')
      .select('*, user_books(global_books(title, genre))')
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    const { data: userBooks } = await supabase
      .from('user_books')
      .select('finished, global_books(genre)')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (rawSessions && userBooks) {
      const sessionData = rawSessions.map(s => ({
        ...s,
        books: {
          title: s.user_books?.global_books?.title,
          genre: s.user_books?.global_books?.genre,
        },
      }))

      const today = new Date().toISOString().split('T')[0]
      const todayPages = sessionData
        .filter(s => s.date === today)
        .reduce((sum, s) => sum + s.pages_read, 0)
      const totalPages = sessionData.reduce((sum, s) => sum + s.pages_read, 0)
      const totalMinutes = sessionData.reduce((sum, s) => sum + (s.minutes_read || 0), 0)
      const booksFinished = userBooks.filter(b => b.finished).length
      const streak = calcStreak(sessionData)
      const longestStreak = calcLongestStreak(sessionData)

      const sessionsWithTime = sessionData.filter(s => s.minutes_read > 0)
      const avgSpeed = sessionsWithTime.length > 0
        ? Math.round(
            sessionsWithTime.reduce((sum, s) => sum + (s.pages_read / s.minutes_read * 60), 0)
            / sessionsWithTime.length
          )
        : null

      const hourCount = {}
      sessionData.forEach(s => {
        if (s.created_at) {
          const h = new Date(s.created_at).getHours()
          hourCount[h] = (hourCount[h] || 0) + s.pages_read
        }
      })
      const bestHourEntry = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0]
      const bestHour = bestHourEntry ? formatHourRange(parseInt(bestHourEntry[0])) : null

      const genreCount = {}
      userBooks.forEach(b => {
        const genre = b.global_books?.genre
        if (genre) genreCount[genre] = (genreCount[genre] || 0) + 1
      })
      const favoriteGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0]

      const monthlyPages = calcMonthlyPages(sessionData, 6)

      setStats({
        todayPages, totalPages, totalMinutes, booksFinished,
        streak, longestStreak, avgSpeed, bestHour, favoriteGenre, monthlyPages,
      })
      setSessions(sessionData)
    }
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f6f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9c9490', fontSize: '13px', letterSpacing: '0.02em' }}>cargando…</p>
    </div>
  )

  // ── Derived data for calendar ──────────────────────────────────────────────

  // Map date → total pages for that day (for heatmap intensity)
  const pagesByDate = {}
  sessions.forEach(s => {
    if (s.date) pagesByDate[s.date] = (pagesByDate[s.date] || 0) + s.pages_read
  })

  const calendarDays = (() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay()
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
    const offset = firstDay === 0 ? 6 : firstDay - 1
    const days = []
    for (let i = 0; i < offset; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) {
      const d = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      days.push(d)
    }
    return days
  })()

  const maxMonthlyPages = stats?.monthlyPages
    ? Math.max(...stats.monthlyPages.map(m => m.pages), 1)
    : 1

  const todayStr = new Date().toISOString().split('T')[0]
  const isCurrentMonthView =
    calendarMonth >= new Date().getMonth() &&
    calendarYear >= new Date().getFullYear()

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8f6f2',
      fontFamily: "'Inter', -apple-system, sans-serif",
      paddingBottom: '100px',
    }}>

      {/* Top blur */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '80px', zIndex: 30,
        background: 'linear-gradient(to bottom, rgba(248,246,242,1) 0%, rgba(248,246,242,0.8) 60%, transparent 100%)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ padding: '52px 20px 4px' }}>
        <p style={{
          fontSize: '22px', fontWeight: 800, color: '#1a1714',
          letterSpacing: '-0.025em', lineHeight: 1.15,
        }}>
          Estadísticas
        </p>
        <p style={{ fontSize: '13px', color: '#9c9490', marginTop: '3px', letterSpacing: '-0.005em' }}>
          Tu actividad lectora
        </p>
      </div>

      {stats && (
        <div style={{ padding: '20px 20px 0', maxWidth: '480px', margin: '0 auto' }}>

          {/* ── Row 1: two hero metrics ── */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <HeroCard
              label="Hoy"
              value={stats.todayPages}
              unit="páginas leídas"
              accent
            />
            <HeroCard
              label="Racha actual"
              value={stats.streak}
              unit={stats.streak === 1 ? 'día seguido' : 'días seguidos'}
              accent
            />
          </div>

          {/* ── Row 2: supporting metrics ── */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <StatCard
              label="Total páginas"
              value={stats.totalPages.toLocaleString('es-ES')}
              unit="en toda tu historia"
            />
            <StatCard
              label="Racha máxima"
              value={stats.longestStreak}
              unit={stats.longestStreak === 1 ? 'día' : 'días'}
            />
          </div>

          {/* ── Row 3: speed + best hour (compact, side by side) ── */}
          {(stats.avgSpeed || stats.bestHour) && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              {stats.avgSpeed && (
                <StatCard
                  label="Velocidad media"
                  value={stats.avgSpeed}
                  unit="págs. por hora"
                />
              )}
              {stats.bestHour && (
                <div style={{
                  background: 'white', borderRadius: '18px',
                  border: '0.5px solid rgba(26,23,20,0.07)',
                  padding: '14px 16px', flex: 1,
                }}>
                  <p style={{
                    fontSize: '9px', fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: '#9c9490', marginBottom: '5px',
                  }}>
                    Mejor momento
                  </p>
                  <p style={{
                    fontSize: '16px', fontWeight: 800,
                    color: '#1a1714', letterSpacing: '-0.02em', lineHeight: 1.2,
                  }}>
                    {stats.bestHour}
                  </p>
                  <p style={{ fontSize: '10px', color: '#9c9490', marginTop: '3px', fontWeight: 500 }}>
                    cuando más lees
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Favourite genre ── */}
          {stats.favoriteGenre && (
            <div style={{
              background: 'white', borderRadius: '18px',
              border: '0.5px solid rgba(26,23,20,0.07)',
              padding: '14px 16px', marginBottom: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <p style={{
                fontSize: '9px', fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9c9490',
              }}>
                Género favorito
              </p>
              {(() => {
                const g = getGenreStyle(stats.favoriteGenre)
                const Icon = g.icon
                return (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '5px 12px', borderRadius: '99px',
                    fontSize: '12px', fontWeight: 700,
                  }} className={g.badge}>
                    <Icon size={13} strokeWidth={2} />
                    {g.label}
                  </span>
                )
              })()}
            </div>
          )}

          {/* ── Library CTA ── */}
          <button
            onClick={() => navigate('/biblioteca')}
            style={{
              width: '100%', background: '#1a1714',
              border: 'none', borderRadius: '20px',
              padding: '18px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', marginBottom: '10px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <p style={{
                fontSize: '9px', fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'rgba(248,246,242,0.45)', marginBottom: '4px',
              }}>
                Mi Biblioteca
              </p>
              <p style={{
                fontSize: '22px', fontWeight: 900, color: '#f8f6f2',
                letterSpacing: '-0.03em', lineHeight: 1,
              }}>
                {stats.booksFinished} {stats.booksFinished === 1 ? 'libro' : 'libros'} terminados
              </p>
              <p style={{ fontSize: '11px', color: 'rgba(248,246,242,0.4)', marginTop: '4px', fontWeight: 500 }}>
                Ver mi colección →
              </p>
            </div>
            {/* Correct library icon — same as Navbar */}
            <div style={{
              width: '44px', height: '44px', borderRadius: '14px',
              background: 'rgba(248,246,242,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="rgba(248,246,242,0.7)" strokeWidth="1.75" strokeLinecap="round">
                <rect x="3"  y="4" width="4" height="16" rx="1"/>
                <rect x="9"  y="2" width="4" height="18" rx="1"/>
                <rect x="15" y="6" width="4" height="14" rx="1"/>
              </svg>
            </div>
          </button>

          {/* ── Bar chart: pages per month ── */}
          <div style={{
            background: 'white', borderRadius: '20px',
            border: '0.5px solid rgba(26,23,20,0.07)',
            padding: '18px 18px 16px', marginBottom: '10px',
          }}>
            <p style={{
              fontSize: '9px', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#9c9490', marginBottom: '18px',
            }}>
              Páginas por mes
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
              {stats.monthlyPages.map((m, i) => {
                const isCurrent = i === stats.monthlyPages.length - 1
                const height = m.pages > 0
                  ? Math.max((m.pages / maxMonthlyPages) * 100, 6)
                  : 3
                return (
                  <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    {m.pages > 0 && (
                      <p style={{
                        fontSize: '8px', fontWeight: 700,
                        color: isCurrent ? '#e8622a' : '#9c9490',
                      }}>
                        {m.pages}
                      </p>
                    )}
                    <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <div style={{
                        width: '100%',
                        height: `${height}%`,
                        borderRadius: '5px',
                        background: isCurrent
                          ? '#e8622a'
                          : 'rgba(26,23,20,0.08)',
                        transition: 'height 500ms cubic-bezier(0.16, 1, 0.3, 1)',
                        minHeight: '3px',
                      }} />
                    </div>
                    <p style={{
                      fontSize: '9px', fontWeight: 600,
                      textTransform: 'capitalize',
                      color: isCurrent ? '#e8622a' : '#9c9490',
                    }}>
                      {m.label}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Total reading time ── */}
          {stats.totalMinutes > 0 && (
            <div style={{
              background: 'white', borderRadius: '18px',
              border: '0.5px solid rgba(26,23,20,0.07)',
              padding: '14px 16px', marginBottom: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <p style={{
                fontSize: '9px', fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9c9490',
              }}>
                Tiempo total leyendo
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                {stats.totalMinutes >= 60 ? (
                  <>
                    <span style={{ fontSize: '22px', fontWeight: 800, color: '#1a1714', letterSpacing: '-0.03em' }}>
                      {Math.floor(stats.totalMinutes / 60)}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9c9490', fontWeight: 500 }}>h</span>
                    <span style={{ fontSize: '22px', fontWeight: 800, color: '#1a1714', letterSpacing: '-0.03em', marginLeft: '4px' }}>
                      {stats.totalMinutes % 60}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9c9490', fontWeight: 500 }}>min</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '22px', fontWeight: 800, color: '#1a1714', letterSpacing: '-0.03em' }}>
                      {stats.totalMinutes}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9c9490', fontWeight: 500 }}>min</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Heatmap calendar ── */}
          <div style={{
            background: 'white', borderRadius: '20px',
            border: '0.5px solid rgba(26,23,20,0.07)',
            padding: '18px', marginBottom: '10px',
          }}>
            {/* Calendar header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <p style={{
                fontSize: '9px', fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9c9490',
              }}>
                Actividad
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => {
                    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1) }
                    else setCalendarMonth(m => m - 1)
                  }}
                  style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: '#f8f6f2', border: '0.5px solid rgba(26,23,20,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#9c9490',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <span style={{
                  fontSize: '11px', fontWeight: 700, color: '#1a1714',
                  letterSpacing: '-0.01em', minWidth: '100px', textAlign: 'center',
                  textTransform: 'capitalize',
                }}>
                  {new Date(calendarYear, calendarMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => {
                    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1) }
                    else setCalendarMonth(m => m + 1)
                  }}
                  disabled={isCurrentMonthView}
                  style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: '#f8f6f2', border: '0.5px solid rgba(26,23,20,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: isCurrentMonthView ? 'default' : 'pointer',
                    color: isCurrentMonthView ? 'rgba(26,23,20,0.2)' : '#9c9490',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>

            {/* Day-of-week labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
              {['L','M','X','J','V','S','D'].map(d => (
                <div key={d} style={{
                  textAlign: 'center', fontSize: '9px',
                  fontWeight: 700, color: '#b8b4b0',
                  padding: '3px 0',
                }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells — monocolor heatmap */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {calendarDays.map((day, i) => {
                if (!day) return <div key={`e-${i}`} />
                const pages = pagesByDate[day] || 0
                const isToday = day === todayStr
                const dayNum = parseInt(day.split('-')[2])
                const heat = heatmapStyle(pages)

                return (
                  <div
                    key={day}
                    title={pages > 0 ? `${pages} páginas` : undefined}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '7px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 600,
                      color: pages > 50 ? 'white' : (pages > 0 ? '#e8622a' : '#b8b4b0'),
                      outline: isToday ? '2px solid #e8622a' : 'none',
                      outlineOffset: '1px',
                      cursor: pages > 0 ? 'default' : 'default',
                      transition: 'background 200ms ease',
                      ...heat,
                    }}
                  >
                    {dayNum}
                  </div>
                )
              })}
            </div>

            {/* Heatmap legend */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginTop: '12px' }}>
              <span style={{ fontSize: '9px', color: '#b8b4b0', fontWeight: 500 }}>Menos</span>
              {[0, 20, 50, 100, 150].map(v => (
                <div key={v} style={{
                  width: '12px', height: '12px', borderRadius: '3px',
                  ...heatmapStyle(v),
                }} />
              ))}
              <span style={{ fontSize: '9px', color: '#b8b4b0', fontWeight: 500 }}>Más</span>
            </div>
          </div>

        </div>
      )}

      <Navbar active="/stats" />
    </div>
  )
}