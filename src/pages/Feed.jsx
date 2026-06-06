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

    const { data: myProfileData } = await supabase
      .from('profiles').select('username').eq('id', user.id).single()
    if (myProfileData) setMyProfile(myProfileData)

    const { data: follows } = await supabase
      .from('follows').select('following_id').eq('follower_id', user.id)

    const followingIds = follows?.map(f => f.following_id) || []
    const allIds = [user.id, ...followingIds]

    const { data: sessionData } = await supabase
      .from('reading_sessions')
      .select('*, books(title, author, cover_url, genre)')
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
    <div className="min-h-screen bg-[#f8f6f2]" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-xl font-black tracking-tight text-stone-900">folio</span>
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 block mb-0.5 ml-0.5" />
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
      <div className="px-5 mb-5 relative z-30">
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

      {/* Feed — cada post ocupa casi toda la pantalla */}
      <div className="space-y-4 pb-36">
        {sessions.length === 0 ? (
          <div className="mx-5 bg-white rounded-3xl p-12 text-center border border-stone-200/40">
            <p className="text-stone-400 text-sm">Tu feed está vacío</p>
            <p className="text-stone-300 text-xs mt-1">Sigue a otros lectores para ver su actividad</p>
          </div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              className="mx-5 bg-white rounded-3xl overflow-hidden border border-stone-100 shadow-sm"
              style={{ minHeight: '85vh' }}
            >
              {/* Portada a pantalla completa */}
              <div className="relative w-full" style={{ height: '55vh' }}>
                {session.books?.cover_url ? (
                  <>
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${session.books.cover_url})`,
                        filter: 'blur(20px) brightness(0.7)',
                        transform: 'scale(1.1)'
                      }}
                    />
                    <img
                      src={session.books.cover_url}
                      alt={session.books.title}
                      className="relative z-10 mx-auto h-full object-contain p-6 drop-shadow-2xl"
                    />
                  </>
                ) : (
                  <div className={`w-full h-full flex items-center justify-center text-6xl ${GENRE_STYLES[session.books?.genre]?.color || 'bg-stone-100'}`}>
                    {GENRE_STYLES[session.books?.genre]?.icon || '📖'}
                  </div>
                )}

                {/* Badge género arriba */}
                <div className="absolute top-4 right-4 z-20">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${GENRE_STYLES[session.books?.genre]?.color || 'bg-stone-100 text-stone-500'}`}>
                    {GENRE_STYLES[session.books?.genre]?.icon}
                  </span>
                </div>
              </div>

              {/* Info del post */}
              <div className="p-5">
                {/* Usuario */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-600">
                    {session.profiles?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <p
                      className="text-sm font-bold text-stone-900 cursor-pointer hover:text-orange-500 transition-colors"
                      onClick={() => navigate(`/user/${session.user_id}`)}
                    >
                      {session.profiles?.username || 'Usuario'}
                    </p>
                    <p className="text-stone-400 text-[11px]">{timeAgo(session.created_at)}</p>
                  </div>
                </div>

                {/* Título y autor */}
                <h3 className="text-lg font-black text-stone-900 leading-tight">{session.books?.title}</h3>
                <p className="text-stone-400 text-sm mt-0.5">{session.books?.author}</p>

                {/* Stats */}
                <div className="flex gap-2 mt-4">
                  <span className="text-xs font-semibold px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100">
                    📖 {session.pages_read} páginas
                  </span>
                  {session.minutes_read && (
                    <span className="text-xs font-semibold px-3 py-1.5 bg-stone-50 text-stone-500 rounded-full border border-stone-100">
                      ⏱ {session.minutes_read} min
                    </span>
                  )}
                </div>

                {/* Nota */}
                {session.note && (
                  <div className="mt-4 bg-stone-50 rounded-2xl px-4 py-3 border border-stone-100">
                    <p className="text-stone-500 text-sm italic leading-relaxed">"{session.note}"</p>
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

export default Feed