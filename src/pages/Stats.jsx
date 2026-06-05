import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const GENRE_LABELS = {
  fantasia: '🔮 Fantasía', ciencia_ficcion: '🚀 Ciencia ficción',
  thriller: '🔪 Thriller', romance: '💕 Romance',
  historica: '⚔️ Histórica', terror: '👻 Terror',
  no_ficcion: '📚 No ficción', autobiografia: '✍️ Autobiografía', otro: '📖 Otro'
}

const GENRE_COLORS = {
  fantasia: 'bg-purple-500', ciencia_ficcion: 'bg-blue-500',
  thriller: 'bg-red-500', romance: 'bg-pink-500',
  historica: 'bg-yellow-600', terror: 'bg-orange-600',
  no_ficcion: 'bg-teal-500', autobiografia: 'bg-green-500', otro: 'bg-stone-500'
}

function Stats() {
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const navigate = useNavigate()

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    const { data: { user } } = await supabase.auth.getUser()

    const { data: sessionData } = await supabase
      .from('reading_sessions')
      .select('*, books(title, genre)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    const { data: books } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', user.id)

    if (sessionData && books) {
      const today = new Date().toISOString().split('T')[0]
      const todayPages = sessionData.filter(s => s.date === today).reduce((sum, s) => sum + s.pages_read, 0)
      const totalPages = sessionData.reduce((sum, s) => sum + s.pages_read, 0)
      const totalMinutes = sessionData.reduce((sum, s) => sum + (s.minutes_read || 0), 0)
      const booksFinished = books.filter(b => b.finished).length
      const streak = calcStreak(sessionData)
      const genreCount = {}
      books.forEach(b => { if (b.genre) genreCount[b.genre] = (genreCount[b.genre] || 0) + 1 })
      const favoriteGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0]
      setStats({ todayPages, totalPages, totalMinutes, booksFinished, streak, favoriteGenre })
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

  if (loading) return <div className="min-h-screen bg-stone-950 flex items-center justify-center text-white">Cargando...</div>

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

  return (
    <div className="min-h-screen bg-stone-950 text-white pb-20">

      {/* Header / Navbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
        <h1 className="text-xl font-bold tracking-tight">folio</h1>
      </div>

      {/* Tabs de Navegación */}
      <div className="flex border-b border-stone-800 sticky top-0 z-10 bg-stone-950">
        <button
          onClick={() => navigate('/feed')}
          className="flex-1 py-3 text-sm font-semibold text-stone-400 hover:text-white transition-colors"
        >
          Inicio
        </button>
        <button
          onClick={() => navigate('/home')}
          className="flex-1 py-3 text-sm font-semibold text-stone-400 hover:text-white transition-colors"
        >
          Registro
        </button>
        <button className="flex-1 py-3 text-sm font-semibold text-white border-b-2 border-amber-500">
          Estadísticas
        </button>
        <button
          onClick={() => navigate('/profile')}
          className="flex-1 py-3 text-sm font-semibold text-stone-400 hover:text-white transition-colors"
        >
          Perfil
        </button>
      </div>

      <div className="px-6 py-8 space-y-6">
        {stats && (
          <>
            {/* Grid de Métricas usando tu diseño original */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-stone-900 rounded-2xl p-4 border border-stone-800">
                <p className="text-stone-400 text-xs mb-1">Páginas hoy</p>
                <p className="text-3xl font-bold text-amber-500">{stats.todayPages}</p>
              </div>
              <div className="bg-stone-900 rounded-2xl p-4 border border-stone-800">
                <p className="text-stone-400 text-xs mb-1">Racha</p>
                <p className="text-3xl font-bold text-amber-500">{stats.streak} 🔥</p>
              </div>
              <div className="bg-stone-900 rounded-2xl p-4 border border-stone-800">
                <p className="text-stone-400 text-xs mb-1">Páginas totales</p>
                <p className="text-3xl font-bold text-white">{stats.totalPages}</p>
              </div>
              <div className="bg-stone-900 rounded-2xl p-4 border border-stone-800">
                <p className="text-stone-400 text-xs mb-1">Minutos leídos</p>
                <p className="text-3xl font-bold text-white">{stats.totalMinutes}</p>
              </div>
              <div className="bg-stone-900 rounded-2xl p-4 border border-stone-800">
                <p className="text-stone-400 text-xs mb-1">Libros terminados</p>
                <p className="text-3xl font-bold text-white">{stats.booksFinished}</p>
              </div>
              {stats.favoriteGenre && (
                <div className="bg-stone-900 rounded-2xl p-4 border border-stone-800">
                  <p className="text-stone-400 text-xs mb-1">Género favorito</p>
                  <p className="text-lg font-bold text-white">{GENRE_LABELS[stats.favoriteGenre]}</p>
                </div>
              )}
            </div>

            {/* Calendario de Actividad de Lectura */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-stone-400 text-sm">Actividad de lectura</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCalendarMonth(m => m - 1)}
                    className="text-stone-400 hover:text-white text-sm transition-colors px-2"
                  >
                    ←
                  </button>
                  <span className="text-stone-300 text-sm font-medium w-28 text-center">
                    {new Date(calendarYear, calendarMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => setCalendarMonth(m => m + 1)}
                    className="text-stone-400 hover:text-white text-sm transition-colors px-2"
                    disabled={calendarMonth >= new Date().getMonth() && calendarYear >= new Date().getFullYear()}
                  >
                    →
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {['L','M','X','J','V','S','D'].map(d => (
                  <div key={d} className="text-center text-stone-600 text-xs py-1">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} />
                  const daySessions = sessionsByDate[day] || []
                  const hasReading = daySessions.length > 0
                  const genre = daySessions[0]?.books?.genre
                  const colorClass = genre ? GENRE_COLORS[genre] : ''
                  const dayNum = parseInt(day.split('-')[2])
                  const isToday = day === new Date().toISOString().split('T')[0]
                  return (
                    <div
                      key={day}
                      title={`${day}${hasReading ? ` · ${daySessions.reduce((s,x) => s + x.pages_read, 0)} páginas` : ''}`}
                      className={`aspect-square rounded-md flex items-center justify-center text-xs font-medium transition-all
                        ${hasReading ? colorClass || 'bg-amber-500' : 'bg-stone-800'}
                        ${isToday ? 'ring-2 ring-amber-400' : ''}
                        ${hasReading ? 'text-white' : 'text-stone-600'}
                      `}
                    >
                      {dayNum}
                    </div>
                  )
                })}
              </div>

              {/* Leyenda de Géneros */}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {Object.entries(GENRE_COLORS).map(([genre, color]) => (
                  <div key={genre} className="flex items-center gap-1">
                    <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
                    <span className="text-stone-500 text-xs">{GENRE_LABELS[genre]?.split(' ').slice(1).join(' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Stats