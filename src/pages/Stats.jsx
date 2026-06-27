import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { GENRES, getGenreStyle } from '../constants/genres'
import Navbar from '../components/layout/Navbar' //  AÑADIDO: Importación del componente global

function Stats() {
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
      const todayPages = sessionData.filter(s => s.date === today).reduce((sum, s) => sum + s.pages_read, 0)
      const totalPages = sessionData.reduce((sum, s) => sum + s.pages_read, 0)
      const totalMinutes = sessionData.reduce((sum, s) => sum + (s.minutes_read || 0), 0)
      const booksFinished = userBooks.filter(b => b.finished).length
      const streak = calcStreak(sessionData)
      const longestStreak = calcLongestStreak(sessionData)

      // Velocidad lectora media (páginas/hora, solo sesiones con minutos registrados)
      const sessionsWithTime = sessionData.filter(s => s.minutes_read > 0)
      const avgSpeed = sessionsWithTime.length > 0
        ? Math.round(sessionsWithTime.reduce((sum, s) => sum + (s.pages_read / s.minutes_read * 60), 0) / sessionsWithTime.length)
        : null

      // Mejor hora para leer (hora del día con más sesiones — usando created_at)
      const hourCount = {}
      sessionData.forEach(s => {
        if (s.created_at) {
          const h = new Date(s.created_at).getHours()
          hourCount[h] = (hourCount[h] || 0) + s.pages_read
        }
      })
      const bestHourEntry = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0]
      const bestHour = bestHourEntry ? formatHourRange(parseInt(bestHourEntry[0])) : null

      // Género favorito
      const genreCount = {}
      userBooks.forEach(b => {
        const genre = b.global_books?.genre
        if (genre) genreCount[genre] = (genreCount[genre] || 0) + 1
      })
      const favoriteGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0]

      // Páginas por mes — últimos 6 meses
      const monthlyPages = calcMonthlyPages(sessionData, 6)

      setStats({ todayPages, totalPages, totalMinutes, booksFinished, streak, longestStreak, avgSpeed, bestHour, favoriteGenre, monthlyPages })
      setSessions(sessionData)
    }
    setLoading(false)
  }

  function calcStreak(sessions) {
    if (!sessions.length) return 0
    const dates = [...new Set(sessions.map(s => s.date))].sort().reverse()
    let streak = 0
    let current = new Date()
    for (let date of dates) {
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
      5: 'Madrugada', 6: 'Madrugada', 7: 'Mañana temprano', 8: 'Mañana',
      9: 'Mañana', 10: 'Mañana', 11: 'Mediodía', 12: 'Mediodía',
      13: 'Mediodía', 14: 'Tarde', 15: 'Tarde', 16: 'Tarde',
      17: 'Tarde', 18: 'Tarde', 19: 'Noche', 20: 'Noche',
      21: 'Noche', 22: 'Noche tardía', 23: 'Noche tardía', 0: 'Madrugada',
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8f6f2' }}>
      <p className="text-stone-400 text-sm tracking-wide">cargando...</p>
    </div>
  )

  const sessionsByDate = {}
  sessions.forEach(s => {
    if (!sessionsByDate[s.date]) sessionsByDate[s.date] = []
    sessionsByDate[s.date].push(s)
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

  const maxMonthlyPages = stats?.monthlyPages ? Math.max(...stats.monthlyPages.map(m => m.pages), 1) : 1

  return (
    <div className="min-h-screen pb-32 antialiased" style={{ background: '#f8f6f2', fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* Blur superior */}
      <div className="fixed top-0 left-0 right-0 z-30 h-20 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(248,246,242,1) 0%, rgba(248,246,242,0.8) 60%, transparent 100%)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        }}
      />

      {/* Header */}
      <div className="px-5 pt-12 pb-2 relative z-10">
        <p className="text-[22px] font-black text-stone-900 tracking-tight">Estadísticas</p>
        <p className="text-stone-400 text-[13px] mt-0.5">Tu actividad lectora</p>
      </div>

      <div className="px-5 py-4 space-y-5 max-w-md mx-auto">
        {stats && (
          <>
            {/* ── Métricas principales ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">

              <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
                <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1">Hoy</p>
                <p className="text-3xl font-black text-orange-500">{stats.todayPages}</p>
                <p className="text-stone-400 text-xs mt-0.5">páginas</p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
                <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1">Racha actual</p>
                <p className="text-3xl font-black text-orange-500">{stats.streak}</p>
                <p className="text-stone-400 text-xs mt-0.5">días seguidos</p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
                <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1">Total páginas</p>
                <p className="text-3xl font-black text-stone-900">{stats.totalPages.toLocaleString()}</p>
                <p className="text-stone-400 text-xs mt-0.5">en toda tu historia</p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
                <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1">Racha máxima</p>
                <p className="text-3xl font-black text-stone-900">{stats.longestStreak}</p>
                <p className="text-stone-400 text-xs mt-0.5">días consecutivos</p>
              </div>

              {stats.avgSpeed && (
                <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
                  <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1">Velocidad media</p>
                  <p className="text-3xl font-black text-stone-900">{stats.avgSpeed}</p>
                  <p className="text-stone-400 text-xs mt-0.5">págs. por hora</p>
                </div>
              )}

              {stats.bestHour && (
                <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
                  <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1">Mejor momento</p>
                  <p className="text-lg font-black text-stone-900 leading-tight mt-1">{stats.bestHour}</p>
                  <p className="text-stone-400 text-xs mt-0.5">cuando más lees</p>
                </div>
              )}

              {stats.favoriteGenre && (
                <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm col-span-2">
                  <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-2">Género favorito</p>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${getGenreStyle(stats.favoriteGenre).badge}`}>
                    {(() => { const Icon = getGenreStyle(stats.favoriteGenre).icon; return <Icon size={15} strokeWidth={2} /> })()}
                    {getGenreStyle(stats.favoriteGenre).label}
                  </div>
                </div>
              )}
            </div>

            {/* ── Libros terminados → Mi Biblioteca ───────────────────────────── */}
            <button
              onClick={() => navigate('/biblioteca')}
              className="w-full bg-stone-900 hover:bg-stone-800 active:scale-[0.99] rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all"
            >
              <div className="text-left">
                <p className="text-white text-xs font-semibold uppercase tracking-wider mb-0.5 opacity-60">Mi Biblioteca</p>
                <p className="text-white text-2xl font-black">{stats.booksFinished} libros terminados</p>
                <p className="text-stone-400 text-xs mt-0.5">Ver mi colección →</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 016.5 2z"/>
                </svg>
              </div>
            </button>

            {/* ── Gráfico de páginas por mes ───────────────────────────────────── */}
            <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
              <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-4">Páginas por mes</p>
              <div className="flex items-end gap-1.5 h-28">
                {stats.monthlyPages.map((m, i) => {
                  const isCurrentMonth = i === stats.monthlyPages.length - 1
                  const height = m.pages > 0 ? Math.max((m.pages / maxMonthlyPages) * 100, 6) : 4
                  return (
                    <div key={m.key} className="flex-1 flex flex-col items-center gap-1.5">
                      <p className="text-[9px] text-stone-400 font-medium">{m.pages > 0 ? m.pages : ''}</p>
                      <div className="flex flex-col justify-end w-full" style={{ height: '80px' }}>
                        <div
                          className={`w-full rounded-lg transition-all duration-500 ${isCurrentMonth ? 'bg-orange-400' : 'bg-stone-200'}`}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <p className={`text-[10px] font-semibold capitalize ${isCurrentMonth ? 'text-orange-500' : 'text-stone-400'}`}>{m.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Minutos leídos ───────────────────────────────────────────────── */}
            {stats.totalMinutes > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
                <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1">Tiempo total leyendo</p>
                <div className="flex items-baseline gap-2 mt-1">
                  {stats.totalMinutes >= 60 ? (
                    <>
                      <p className="text-3xl font-black text-stone-900">{Math.floor(stats.totalMinutes / 60)}</p>
                      <p className="text-stone-400 text-sm">h</p>
                      <p className="text-3xl font-black text-stone-900">{stats.totalMinutes % 60}</p>
                      <p className="text-stone-400 text-sm">min</p>
                    </>
                  ) : (
                    <>
                      <p className="text-3xl font-black text-stone-900">{stats.totalMinutes}</p>
                      <p className="text-stone-400 text-sm">minutos</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Calendario de actividad ──────────────────────────────────────── */}
            <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider">Actividad</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1) }
                      else setCalendarMonth(m => m - 1)
                    }}
                    className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 text-xs transition-colors"
                  >←</button>
                  <span className="text-xs font-semibold text-center uppercase truncate w-24 text-stone-600">
                    {new Date(calendarYear, calendarMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => {
                      if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1) }
                      else setCalendarMonth(m => m + 1)
                    }}
                    disabled={calendarMonth >= new Date().getMonth() && calendarYear >= new Date().getFullYear()}
                    className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 text-xs transition-colors disabled:opacity-30"
                  >→</button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {['L','M','X','J','V','S','D'].map(d => (
                  <div key={d} className="text-center text-stone-400 text-[10px] font-semibold py-1">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} />
                  const daySessions = sessionsByDate[day] || []
                  const hasReading = daySessions.length > 0
                  const genre = daySessions[0]?.books?.genre
                  const colorClass = genre ? getGenreStyle(genre).solid : ''
                  const dayNum = parseInt(day.split('-')[2])
                  const isToday = day === new Date().toISOString().split('T')[0]
                  return (
                    <div
                      key={day}
                      title={`${day}${hasReading ? ` · ${daySessions.reduce((s, x) => s + x.pages_read, 0)} págs.` : ''}`}
                      className={`aspect-square rounded-lg flex items-center justify-center text-[11px] font-semibold transition-all
                        ${hasReading ? colorClass || 'bg-orange-400' : 'bg-stone-100'}
                        ${isToday ? 'ring-2 ring-orange-400 ring-offset-1' : ''}
                        ${hasReading ? 'text-white' : 'text-stone-400'}
                      `}
                    >
                      {dayNum}
                    </div>
                  )
                })}
              </div>

              {/* Leyenda compacta — solo géneros con actividad */}
              {(() => {
                const activeGenres = [...new Set(sessions.map(s => s.books?.genre).filter(Boolean))]
                return activeGenres.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {activeGenres.map(gv => {
                      const g = getGenreStyle(gv)
                      return (
                        <div key={gv} className="flex items-center gap-1">
                          <div className={`w-2.5 h-2.5 rounded-sm ${g.solid}`} />
                          <span className="text-stone-400 text-[10px]">{g.label}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : null
              })()}
            </div>
          </>
        )}
      </div>

      {/* AÑADIDO: Inclusión de la Navbar global al final de la página */}
      <Navbar active="/stats" />

    </div>
  )
}

export default Stats