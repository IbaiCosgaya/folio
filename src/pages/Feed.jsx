import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const GENRE_STYLES = {
  fantasia:       { color: 'bg-purple-500',  icon: '🔮' },
  ciencia_ficcion:{ color: 'bg-blue-500',    icon: '🚀' },
  thriller:       { color: 'bg-red-500',     icon: '🔪' },
  romance:        { color: 'bg-pink-500',    icon: '💕' },
  historica:      { color: 'bg-yellow-600',  icon: '⚔️' },
  terror:         { color: 'bg-orange-600',  icon: '👻' },
  no_ficcion:     { color: 'bg-teal-500',    icon: '📚' },
  autobiografia:  { color: 'bg-green-500',   icon: '✍️' },
  otro:           { color: 'bg-stone-500',   icon: '📖' },
}

function Feed() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    fetchFeed()
  }, [])

  async function fetchFeed() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    const followingIds = follows?.map(f => f.following_id) || []
    const allIds = [user.id, ...followingIds]

    // Query limpia basada en tu estructura de la base de datos
    const { data: sessionData } = await supabase
      .from('reading_sessions')
      .select('*, books(title, author, cover_url, genre)')
      .in('user_id', allIds)
      .order('created_at', { ascending: false })
      .limit(50)

    if (sessionData) {
      const uniqueUserIds = [...new Set(sessionData.map(s => s.user_id))]
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, last_name')
        .in('id', uniqueUserIds)

      const profilesMap = {}
      profilesData?.forEach(p => { profilesMap[p.id] = p })

      const sessionsWithProfiles = sessionData.map(s => ({
        ...s,
        profiles: profilesMap[s.user_id] || null
      }))

      setSessions(sessionsWithProfiles)
    }
    setLoading(false)
  }

  // Esto busca automáticamente a medida que escribes
  async function handleSearch(q) {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (currentUser) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .ilike('username', `%${q}%`)
          .neq('id', currentUser.id)
          .limit(5)
        
        if (data) setSearchResults(data)
      }
    } catch (error) {
      console.error("Error buscando usuarios:", error)
    }
    
    setSearching(false)
  }

  function timeAgo(date) {
    const diff = Math.floor((new Date() - new Date(date)) / 1000)
    if (diff < 60) return 'ahora mismo'
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
    return `hace ${Math.floor(diff / 86400)} días`
  }

  if (loading) return <div className="min-h-screen bg-stone-950 flex items-center justify-center text-white">Cargando...</div>

  return (
    <div className="min-h-screen bg-stone-950 text-white pb-20">

      {/* Header / Navbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
        <h1 className="text-xl font-bold tracking-tight">folio</h1>
        <div className="flex items-center gap-4">
          {user?.id === '581dd0d6-6240-461a-90b7-224f74d577ab' && (
            <button onClick={() => navigate('/admin')} className="text-amber-500 hover:text-amber-400 text-sm transition-colors">
              Moderación
            </button>
          )}
          <button onClick={() => supabase.auth.signOut().then(() => navigate('/'))} className="text-stone-400 hover:text-white text-sm transition-colors">
            Salir
          </button>
        </div>
      </div>

      {/* Tabs de Navegación */}
      <div className="flex border-b border-stone-800 sticky top-0 z-10 bg-stone-950">
        <button className="flex-1 py-3 text-sm font-semibold text-white border-b-2 border-amber-500">
          Inicio
        </button>
        <button onClick={() => navigate('/home')} className="flex-1 py-3 text-sm font-semibold text-stone-400 hover:text-white transition-colors">
          Registro
        </button>
        <button onClick={() => navigate('/stats')} className="flex-1 py-3 text-sm font-semibold text-stone-400 hover:text-white transition-colors">
          Estadísticas
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 py-3 text-sm font-semibold text-stone-400 hover:text-white transition-colors">
          Perfil
        </button>
      </div>

      {/* Buscador de Lectores */}
      <div className="px-6 pt-4 relative z-30"> 
        <div className="relative">
          <input
            type="text"
            placeholder={searching ? "Buscando..." : "Buscar lectores..."}
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="w-full bg-stone-900 text-white placeholder-stone-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-stone-900 border border-stone-800 rounded-xl overflow-hidden z-50 shadow-2xl">
              {searchResults.map(profile => (
                <div
                  key={profile.id}
                  onClick={() => { navigate(`/user/${profile.id}`); setSearchQuery(''); setSearchResults([]) }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-stone-800 cursor-pointer transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-sm font-bold text-stone-950 flex-shrink-0">
                    {profile.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {profile.username} {profile.last_name && profile.last_name !== 'EMPTY' ? profile.last_name : ''}
                    </p>
                    {profile.bio && profile.bio !== 'EMPTY' && (
                      <p className="text-stone-500 text-xs mt-0.5">{profile.bio}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contenido del Feed */}
      <div className="px-6 py-6 space-y-4 relative z-0">
        {sessions.length === 0 ? (
          <div className="bg-stone-900 rounded-2xl p-8 text-center border border-stone-800">
            <p className="text-stone-400 text-sm mb-2">Tu feed está vacío</p>
            <p className="text-stone-600 text-xs">Sigue a otros lectores para ver su actividad aquí</p>
          </div>
        ) : (
          sessions.map(session => (
            <div key={session.id} className="bg-stone-900 rounded-2xl p-4 border border-stone-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-sm font-bold text-stone-950">
                  {session.profiles?.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <p
                    className="text-sm font-semibold cursor-pointer hover:text-amber-500 transition-colors"
                    onClick={() => navigate(`/user/${session.user_id}`)}
                  >
                    {session.profiles?.username || 'Usuario'}
                  </p>
                  <p className="text-stone-500 text-xs">{timeAgo(session.created_at)}</p>
                </div>
                <span className="text-xl">{GENRE_STYLES[session.books?.genre]?.icon || '📖'}</span>
              </div>

              <div className="flex items-center gap-3">
                {session.books?.cover_url ? (
                  <img src={session.books.cover_url} alt={session.books.title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
                ) : (
                  <div className={`w-10 h-14 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ${GENRE_STYLES[session.books?.genre]?.color || 'bg-stone-700'}`}>
                    {GENRE_STYLES[session.books?.genre]?.icon || '📖'}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold">{session.books?.title}</p>
                  <p className="text-stone-400 text-xs">{session.books?.author}</p>
                  <p className="text-amber-500 text-xs mt-1">
                    📖 {session.pages_read} páginas leídas
                    {session.minutes_read ? ` · ⏱ ${session.minutes_read} min` : ''}
                  </p>
                </div>
              </div>

              {session.note && (
                <div className="mt-3 bg-stone-800 rounded-xl px-3 py-2">
                  <p className="text-stone-300 text-xs italic">"{session.note}"</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Feed