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
  const [lastName, setLastName] = useState('')
  const [bio, setBio] = useState('')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [editing, setEditing] = useState(false)
  const [editingAuth, setEditingAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const navigate = useNavigate()
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const { data: { user } } = await supabase.auth.getUser()
    setEmail(user.email)

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
      setLastName(profileData.last_name || '')
      setBio(profileData.bio || '')
    }

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

  async function handleSaveProfile() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').upsert({
      id: user.id,
      username,
      last_name: lastName,
      bio
    })
    setProfile(p => ({ ...p, username, last_name: lastName, bio }))
    setEditing(false)
    setMessage('Perfil actualizado')
    setTimeout(() => setMessage(''), 3000)
    setSaving(false)
  }

  async function handleSaveAuth() {
    setSaving(true)
    if (email) {
      await supabase.auth.updateUser({ email })
    }
    if (newPassword) {
      if (newPassword !== confirmPassword) {
        setMessage('Las contraseñas no coinciden')
        setSaving(false)
        return
      }
      await supabase.auth.updateUser({ password: newPassword })
    }
    setEditingAuth(false)
    setNewPassword('')
    setConfirmPassword('') // Limpiamos también el campo de confirmación
    setMessage('Datos de acceso actualizados')
    setTimeout(() => setMessage(''), 3000)
    setSaving(false)
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
    <div className="min-h-screen bg-stone-950 text-white">

      <div className="flex items-center gap-4 px-6 py-4 border-b border-stone-800">
        <button onClick={() => navigate('/home')} className="text-stone-400 hover:text-white transition-colors">
          ← Volver
        </button>
        <h1 className="text-lg font-semibold">Mi perfil</h1>
      </div>

      <div className="px-6 py-8 space-y-6">

        {message && (
          <div className="bg-green-900 border border-green-700 text-green-300 rounded-xl px-4 py-3 text-sm">
            ✓ {message}
          </div>
        )}

        {/* Avatar y nombre */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center text-2xl font-bold text-stone-950">
            {username ? username[0].toUpperCase() : '?'}
          </div>
          <div>
            <p className="font-bold text-lg">{username || 'Sin nombre'} {lastName}</p>
            {bio && <p className="text-stone-400 text-sm">{bio}</p>}
          </div>
        </div>

        {/* Editar perfil */}
        <div className="bg-stone-900 rounded-2xl border border-stone-800 overflow-hidden">
          <button
            onClick={() => setEditing(!editing)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-stone-800 transition-colors"
          >
            <span>Editar perfil</span>
            <span className="text-stone-400">{editing ? '↑' : '↓'}</span>
          </button>
          {editing && (
            <div className="px-5 pb-5 space-y-3 border-t border-stone-800">
              <div className="pt-3">
                <p className="text-stone-400 text-xs mb-1">Nombre</p>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full bg-stone-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
              <div>
                <p className="text-stone-400 text-xs mb-1">Apellidos</p>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Tus apellidos"
                  className="w-full bg-stone-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
              <div>
                <p className="text-stone-400 text-xs mb-1">Bio</p>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Cuéntanos algo sobre ti..."
                  rows={3}
                  className="w-full bg-stone-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm resize-none"
                />
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl py-3 text-sm transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          )}
        </div>

        {/* Editar email y contraseña */}
        <div className="bg-stone-900 rounded-2xl border border-stone-800 overflow-hidden">
          <button
            onClick={() => setEditingAuth(!editingAuth)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-stone-800 transition-colors"
          >
            <span>Email y contraseña</span>
            <span className="text-stone-400">{editingAuth ? '↑' : '↓'}</span>
          </button>
          {editingAuth && (
            <div className="px-5 pb-5 space-y-3 border-t border-stone-800">
              <div className="pt-3">
                <p className="text-stone-400 text-xs mb-1">Email</p>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-stone-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
              <div>
                <p className="text-stone-400 text-xs mb-1">Nueva contraseña</p>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Dejar en blanco para no cambiar"
                  className="w-full bg-stone-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
              <div>
                <p className="text-stone-400 text-xs mb-1">Confirmar contraseña</p>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  className="w-full bg-stone-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
              <button
                onClick={handleSaveAuth}
                disabled={saving}
                className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl py-3 text-sm transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Actualizar acceso'}
              </button>
            </div>
          )}
        </div>

        {/* Estadísticas */}
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

export default Profile