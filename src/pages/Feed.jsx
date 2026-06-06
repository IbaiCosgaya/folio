import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const GENRE_STYLES = {
  fantasia:       { color: 'bg-purple-100 text-purple-500', icon: '🔮' },
  ciencia_ficcion:{ color: 'bg-blue-100 text-blue-500',    icon: '🚀' },
  thriller:       { color: 'bg-red-100 text-red-500',      icon: '🔪' },
  romance:        { color: 'bg-pink-100 text-pink-500',    icon: '💕' },
  historica:      { color: 'bg-amber-100 text-amber-600',  icon: '⚔️' },
  terror:         { color: 'bg-orange-100 text-orange-500',icon: '👻' },
  no_ficcion:     { color: 'bg-teal-100 text-teal-500',    icon: '📚' },
  autobiografia:  { color: 'bg-green-100 text-green-500',  icon: '✍️' },
  otro:           { color: 'bg-stone-100 text-stone-500',  icon: '📖' },
}

function Feed() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [myProfile, setMyProfile] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { fetchFeed() }, [])

  async function fetchFeed() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    if (user) {
      const { data: myProfileData } = await supabase
        .from('profiles').select('username').eq('id', user.id).single()
      if (myProfileData) setMyProfile(myProfileData)
    }

    const { data: follows } = await supabase
      .from('follows').select('following_id').eq('follower_id', user.id)

    const followingIds = follows?.map(f => f.following_id) || []
    const allIds = [user.id, ...followingIds]

    const { data: sessionData } = await supabase
      .from('reading_sessions')
      .select('*, books(title, author, cover_url, genre, year, total_pages, current_page)')
      .in('user_id', allIds)
      .order('created_at', { ascending: false })
      .limit(50)

    if (sessionData) {
      const uniqueUserIds = [...new Set(sessionData.map(s => s.user_id))]
      const { data: profilesData } = await supabase
        .from('profiles').select('id, username').in('id', uniqueUserIds)
      const profilesMap = {}
      profilesData?.forEach(p => { profilesMap[p.id] = p })
      setSessions(sessionData.map(s => ({ ...s, profiles: profilesMap[s.user_id] || null })))
    }
    setLoading(false)
  }

  async function handleSearch(q) {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        const { data } = await supabase
          .from('profiles').select('*').ilike('username', `%${q}%`).neq('id', currentUser.id).limit(5)
        if (data) setSearchResults(data)
      }
    } catch (e) { console.error(e) }
    setSearching(false)
  }

  function timeAgo(date) {
    const diff = Math.floor((new Date() - new Date(date)) / 1000)
    if (diff < 60) return 'ahora mismo'
    if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
    return `hace ${Math.floor(diff / 86400)}d`
  }

  if (loading) return (
    <div className="min-h-screen bg-[#f8f6f2] flex items-center justify-center">
      <p className="text-stone-400 text-sm tracking-wide">cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f6f2] pb-36 antialiased" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => navigate('/profile')}
        >
          <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600 border border-orange-200/60">
            {myProfile?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm font-bold text-stone-900 leading-tight">{myProfile?.username || 'Lector'}</p>
            <p className="text-[10px] text-stone-400">Ver perfil</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user?.id === '581dd0d6-6240-461a-90b7-224f74d577ab' && (
            <button onClick={() => navigate('/admin')} className="text-[11px] text-stone-400 tracking-widest uppercase font-semibold">
              admin
            </button>
          )}
          <button
            onClick={() => supabase.auth.signOut().then(() => navigate('/'))}
            className="w-7 h-7 rounded-full bg-stone-200/60 flex items-center justify-center text-stone-500 text-[10px]"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Saludo */}
      <div className="px-5 pb-4">
        <p className="text-[22px] font-bold text-stone-900 tracking-tight">
          Hola, {myProfile?.username || 'lector'} 👋
        </p>
        <p className="text-stone-400 text-[13px] mt-0.5 italic">¿qué están leyendo hoy?</p>
      </div>

      {/* Buscador */}
      <div className="px-5 mb-6 relative z-30">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Buscar lectores..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="w-full bg-white/70 text-stone-800 placeholder-stone-400 rounded-2xl pl-10 pr-4 py-3 text-sm outline-none border border-stone-200/60 focus:border-stone-300 transition-all"
            style={{ backdropFilter: 'blur(10px)' }}
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-stone-200/60 overflow-hidden z-50 shadow-lg">
              {searchResults.map(profile => (
                <div
                  key={profile.id}
                  onClick={() => { navigate(`/user/${profile.id}`); setSearchQuery(''); setSearchResults([]) }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">
                    {profile.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <p className="text-sm font-semibold text-stone-800">{profile.username}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feed — Lista de Tarjetas Estilo Post */}
      <div className="space-y-8 max-w-md mx-auto">
        {sessions.length === 0 ? (
          <div className="mx-5 bg-white rounded-3xl p-12 text-center border border-stone-200/40">
            <p className="text-stone-400 text-sm">Tu feed está vacío</p>
            <p className="text-stone-300 text-xs mt-1">Sigue a otros lectores para ver su actividad</p>
          </div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              className="mx-5 bg-white rounded-[2.5rem] overflow-hidden border border-stone-100 shadow-md flex flex-col justify-between"
              style={{ minHeight: '82vh' }}
            >
              {/* Bloque imagen superior */}
              <div className="relative w-full overflow-hidden flex-1 flex items-center justify-center" style={{ minHeight: '52vh' }}>

                {/* Fondo desenfocado de extremo a extremo superior */}
                {session.books?.cover_url ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${session.books.cover_url})`,
                      filter: 'blur(30px) brightness(0.65)',
                      transform: 'scale(1.25)'
                    }}
                  />
                ) : (
                  <div className={`absolute inset-0 ${GENRE_STYLES[session.books?.genre]?.color || 'bg-stone-100'} opacity-40`} />
                )}

                {/* Degradado superior oscuro para la lectura del perfil */}
                <div
                  className="absolute top-0 left-0 right-0 z-20 h-36"
                  style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)' }}
                />

                {/* Info del usuario arriba a la izquierda */}
                <div className="absolute top-6 left-6 z-30 flex items-center gap-3 cursor-pointer"
                  onClick={() => navigate(`/user/${session.user_id}`)}
                >
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-sm font-bold text-white border border-white/30 shadow-sm">
                    {session.profiles?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-white leading-tight drop-shadow-md">
                      {session.profiles?.username || 'Usuario'}
                    </p>
                    <p className="text-white/75 text-[11px] font-medium mt-0.5 drop-shadow-sm">{timeAgo(session.created_at)}</p>
                  </div>
                </div>

                {/* Badge género arriba derecha */}
                <div className="absolute top-6 right-6 z-30">
                  <span className="text-base p-2 rounded-full bg-white/20 backdrop-blur-md border border-white/30 block shadow-sm">
                    {GENRE_STYLES[session.books?.genre]?.icon || '📖'}
                  </span>
                </div>

                {/* Portada centrada real */}
                <div className="relative z-10 w-full h-full max-h-[42vh] px-10 py-4 flex items-center justify-center">
                  {session.books?.cover_url ? (
                    <img
                      src={session.books.cover_url}
                      alt={session.books.title}
                      className="max-h-full max-w-full object-contain rounded-lg shadow-[0_20px_35px_rgba(0,0,0,0.45)]"
                    />
                  ) : (
                    <div className="text-7xl drop-shadow-lg">
                      {GENRE_STYLES[session.books?.genre]?.icon || '📖'}
                    </div>
                  )}
                </div>

                {/* Degradado inferior orgánico hacia el blanco absoluto */}
                <div
                  className="absolute bottom-0 left-0 right-0 z-20 h-32"
                  style={{ background: 'linear-gradient(to top, #ffffff 0%, rgba(255,255,255,0.5) 40%, transparent 100%)' }}
                />
              </div>

              {/* Contenedor de detalles del post */}
              <div className="px-6 pb-7 bg-white relative z-30">
                <h3 className="text-xl font-black text-stone-900 tracking-tight leading-snug">{session.books?.title}</h3>
                <p className="text-stone-400 text-sm mt-0.5 font-medium">
                  {session.books?.author}
                  {session.books?.year && <span className="text-stone-300 font-normal"> · {session.books.year}</span>}
                </p>

                {/* Barra de progreso interactiva */}
                {session.books?.total_pages > 0 && session.books?.current_page !== undefined && (
                  <div className="mt-4">
                    <div className="flex justify-between text-[11px] text-stone-400 mb-2 font-medium">
                      <span>Progreso</span>
                      <span className="font-bold text-orange-500">
                        {Math.round((session.books.current_page / session.books.total_pages) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-2 relative flex items-center">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          session.books?.genre === 'fantasia' ? 'bg-purple-400' :
                          session.books?.genre === 'ciencia_ficcion' ? 'bg-blue-400' :
                          session.books?.genre === 'thriller' ? 'bg-red-400' :
                          session.books?.genre === 'romance' ? 'bg-pink-400' :
                          session.books?.genre === 'historica' ? 'bg-amber-400' :
                          session.books?.genre === 'terror' ? 'bg-orange-400' :
                          session.books?.genre === 'no_ficcion' ? 'bg-teal-400' :
                          session.books?.genre === 'autobiografia' ? 'bg-green-400' :
                          'bg-stone-400'
                        }`}
                        style={{ width: `${Math.max(Math.min((session.books.current_page / session.books.total_pages) * 100, 100), 0)}%` }}
                      />
                      <span 
                        className="absolute text-lg leading-none transition-all duration-500 z-10"
                        style={{ 
                          left: `calc(${Math.min((session.books.current_page / session.books.total_pages) * 100, 100)}% - 10px)`,
                          top: '-8px'
                        }}
                      >
                        {GENRE_STYLES[session.books?.genre]?.icon || '📖'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="flex flex-wrap gap-2 mt-5">
                  <span className="text-xs font-bold px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100">
                    📖 {session.pages_read} pág. hoy
                  </span>
                  {session.minutes_read && (
                    <span className="text-xs font-bold px-3 py-1.5 bg-stone-50 text-stone-500 rounded-full border border-stone-200">
                      ⏱ {session.minutes_read} min
                    </span>
                  )}
                </div>

                {/* Comentarios o Notas adicionales */}
                {session.note && (
                  <div className="mt-4 bg-stone-50/60 border border-stone-100 rounded-xl px-4 py-3">
                    <p className="text-stone-500 text-xs italic font-serif leading-relaxed">
                      "{session.note}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Navbar flotante con efecto cristal */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-3 py-2 rounded-full border border-white/40"
        style={{
          background: 'rgba(255, 255, 255, 0.55)',
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
          width: '88%',
          maxWidth: '380px',
        }}
      >
        {[
          { label: 'Inicio', icon: '🏠', path: '/feed', active: true },
          { label: 'Registro', icon: '📖', path: '/home', active: false },
          { label: 'Stats', icon: '📊', path: '/stats', active: false },
          { label: 'Perfil', icon: '👤', path: '/profile', active: false },
        ].map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 rounded-full transition-all ${
              item.active
                ? 'bg-orange-400/20 text-orange-500'
                : 'text-stone-400 hover:text-stone-700'
            }`}
          >
            <span className="text-[17px]">{item.icon}</span>
            <span className="text-[9px] font-semibold tracking-tight">{item.label}</span>
          </button>
        ))}
      </div>

    </div>
  )
}

export default Feed;