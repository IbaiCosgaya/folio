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

function Profile() {
  const [profile, setProfile] = useState(null)
  const [username, setUsername] = useState('')
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const { data: { user } } = await supabase.auth.getUser()

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    const { data: sessionData } = await supabase
      .from('reading_sessions')
      .select('*, books(title, genre)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    const { data: books } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', user.id)

    if (profileData) {
      setProfile(profileData)
      setUsername(profileData.username || '')
    }

    if (sessionData && books) {
      const today = new Date().toISOString().split('T')[0]
      const todayPages = sessionData
        .filter(s => s.date === today)
        .reduce((sum, s) => sum + s.pages_read, 0)
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

  function getLast30Days() {
    const days = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push(d.toISOString().split('T')[0])
    }
    return days
  }

  async function handleSaveUsername() {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').upsert({ id: user.id, username })
    setProfile(p => ({ ...p, username }))
    setEditing(false)
  }

  if (loading) return <div className="min-h-screen bg-stone-950 flex items-center justify-center text-white">Cargando...</div>

  const days = getLast30Days()
  const sessionsByDate = {}
  sessions.forEach(s => {
    if (!sessionsByDate[s.date]) sessionsByDate[s.date] = []
    sessionsByDate[s.date].push(s)
  })

  return (
    <div className="min-h-screen bg-stone-950 text-white">

      <div className="flex items-center gap-4 px-6 py-4 border-b border-stone-800">
        <button onClick={() => navigate('/home')} className="text-stone-400 hover:text-white transition-colors">
          ← Volver
        </button>
        <h1 className="text-lg font-semibold">Mi perfil</h1>
      </div>

      <div className="px-6 py-8 space-y-6">

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center text-2xl font-bold text-stone-950">
            {username ? username[0].toUpperCase() : '?'}
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Tu nombre"
                  className="flex-1 bg-stone-900 text-white rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
                <button
                  onClick={handleSaveUsername}
                  className="bg-amber-500 text-stone-950 font-semibold rounded-xl px-4 py-2 text-sm"
                >
                  Guardar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="font-bold text-lg">{username || 'Sin nombre'}</p>
                <button
                  onClick={() => setEditing(true)}
                  className="text-stone-500 hover:text-white text-xs transition-colors"
                >
                  ✏️
                </button>
              </div>
            )}
          </div>
        </div>

        {stats && (
          <>
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
                <p className="text-stone-400 text-xs mb-1">Libros terminados</p>
                <p className="text-3xl font-bold text-white">{stats.booksFinished}</p>
              </div>
            </div>

            {stats.favoriteGenre && (
              <div className="bg-stone-900 rounded-2xl p-4 border border-stone-800 flex items-center gap-3">
                <span className="text-2xl">{GENRE_LABELS[stats.favoriteGenre]?.split(' ')[0]}</span>
                <div>
                  <p className="text-stone-400 text-xs">Género favorito</p>
                  <p className="font-semibold">{GENRE_LABELS[stats.favoriteGenre]?.split(' ').slice(1).join(' ')}</p>
                </div>
              </div>
            )}

            <div>
              <p className="text-stone-400 text-sm mb-3">Últimos 30 días</p>
              <div className="grid grid-cols-10 gap-1">
                {days.map(day => {
                  const daySessions = sessionsByDate[day] || []
                  const hasReading = daySessions.length > 0
                  const genre = daySessions[0]?.books?.genre
                  const colorClass = genre ? GENRE_COLORS[genre] : ''
                  return (
                    <div
                      key={day}
                      title={day}
                      className={`aspect-square rounded-md ${hasReading ? colorClass || 'bg-amber-500' : 'bg-stone-800'}`}
                    />
                  )
                })}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-stone-600 text-xs">hace 30 días</span>
                <span className="text-stone-600 text-xs">hoy</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Profile