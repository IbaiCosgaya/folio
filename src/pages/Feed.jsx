import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase' // Ruta verificada y corregida

const GENRE_STYLES = {
  fantasia:       { color: 'bg-purple-50 text-purple-400 border-purple-100',  icon: '🔮' },
  ciencia_ficcion:{ color: 'bg-blue-50 text-blue-400 border-blue-100',    icon: '🚀' },
  thriller:       { color: 'bg-red-50 text-red-400 border-red-100',     icon: '🔪' },
  romance:        { color: 'bg-pink-50 text-pink-400 border-pink-100',    icon: '💕' },
  historica:      { color: 'bg-amber-50 text-amber-500 border-amber-100',  icon: '⚔️' },
  terror:         { color: 'bg-orange-50 text-orange-400 border-orange-100', icon: '👻' },
  no_ficcion:     { color: 'bg-teal-50 text-teal-400 border-teal-100',    icon: '📚' },
  autobiografia:  { color: 'bg-green-50 text-green-400 border-green-100',   icon: '✍️' },
  otro:           { color: 'bg-stone-50 text-stone-400 border-stone-100',   icon: '📖' },
}

function Feed() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [myProfile, setMyProfile] = useState(null)

  useEffect(() => {
    fetchFeed()
  }, [])

  async function fetchFeed() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    // CORRECCIÓN DEL BUG: Consulta del perfil del usuario actual inmediatamente después de setUser
    if (user) {
      const { data: myProfileData } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()
      if (myProfileData) setMyProfile(myProfileData)
    }

    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

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

  if (loading) return <div className="min-h-screen bg-[#faf9f6] flex items-center justify-center text-stone-400 font-serif italic text-lg">Cargando tus lecturas...</div>

  return (
    <div className="min-h-screen bg-[#fcfbfa] bg-gradient-to-b from-[#fbfbfa] via-[#fcfbfa] to-[#f7f5f2] text-stone-800 pb-32 antialiased">
      
      {/* Header Minimalista con Estilo Editorial */}
      <div className="max-w-xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-2xl font-black tracking-tight text-stone-900 font-sans">folio</span>
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400/80 block mt-1"></span>
        </div>
        <div className="flex items-center gap-4">
          {user?.id === '581dd0d6-6240-461a-90b7-224f74d577ab' && (
            <button onClick={() => navigate('/admin')} className="text-stone-400 hover:text-stone-700 text-xs tracking-wider uppercase font-semibold transition-colors">
              Panel
            </button>
          )}
          <button onClick={() => supabase.auth.signOut().then(() => navigate('/'))} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200/60 transition-all">
            <span className="text-xs">✕</span>
          </button>
        </div>
      </div>

      {/* Saludo Personalizado Corregido */}
      <div className="max-w-xl mx-auto px-6 pt-2 pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-stone-900">Hola, {myProfile?.username || 'Lector'} 👋🏼</h2>
        <p className="text-stone-400 text-sm font-medium mt-1 italic font-serif">"Cada página te lleva más lejos."</p>
      </div>

      {/* Buscador de Lectores Integrado Ultra Limpio */}
      <div className="px-6 max-w-xl mx-auto mt-2 mb-6 relative z-30"> 
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder={searching ? "Buscando en la red..." : "Buscar lectores..."}
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="w-full bg-stone-100/60 border border-transparent text-stone-800 placeholder-stone-400 rounded-2xl pl-10 pr-4 py-3.5 outline-none focus:bg-white focus:border-stone-200/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)] focus:shadow-sm transition-all text-sm"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl border border-stone-200/60 rounded-2xl overflow-hidden z-50 shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
              {searchResults.map(profile => (
                <div
                  key={profile.id}
                  onClick={() => { navigate(`/user/${profile.id}`); setSearchQuery(''); setSearchResults([]) }}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50/80 cursor-pointer transition-colors border-b border-stone-100 last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-orange-100/50 flex items-center justify-center text-xs font-bold text-orange-700">
                    {profile.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <p className="text-sm font-semibold text-stone-800">{profile.username}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feed de Actividad - Tarjetas con Look Premium */}
      <div className="px-6 max-w-xl mx-auto space-y-6 relative z-0">
        {sessions.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-12 text-center border border-stone-200/40 shadow-[0_15px_40px_rgba(0,0,0,0.01)]">
            <p className="text-stone-400 text-sm font-medium">Tu feed está vacío</p>
          </div>
        ) : (
          sessions.map(session => (
            <div key={session.id} className="bg-white rounded-[2.2rem] p-6 border border-stone-200/30 shadow-[0_20px_50px_rgba(150,140,130,0.04)] transition-all hover:shadow-[0_25px_60px_rgba(150,140,130,0.08)] duration-300">
              
              {/* Info de cabecera de la tarjeta */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-600 shadow-inner">
                    {session.profiles?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <h4 onClick={() => navigate(`/user/${session.user_id}`)} className="text-sm font-bold text-stone-900 cursor-pointer hover:text-orange-500/90 transition-colors">
                      {session.profiles?.username || 'Usuario'}
                    </h4>
                    <p className="text-stone-400 text-[11px] font-medium mt-0.5">{timeAgo(session.created_at)}</p>
                  </div>
                </div>
                <button className="text-stone-300 hover:text-stone-500 text-sm font-bold px-1">···</button>
              </div>

              {/* Contenedor del Libro */}
              <div className="flex gap-4 items-start">
                {session.books?.cover_url ? (
                  <img src={session.books.cover_url} alt={session.books.title} className="w-[4.5rem] h-24 object-cover rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.08)] flex-shrink-0 border border-stone-100" />
                ) : (
                  <div className={`w-[4.5rem] h-24 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm bg-stone-100`}>
                    📖
                  </div>
                )}
                <div className="flex-1 min-w-0 pt-1">
                  <h3 className="text-base font-extrabold text-stone-900 truncate leading-tight">{session.books?.title}</h3>
                  <p className="text-stone-400 text-xs font-semibold mt-0.5 truncate">{session.books?.author}</p>
                  
                  {/* Badges Pastel en Fila */}
                  <div className="flex flex-wrap items-center gap-2 mt-3.5">
                    <span className="text-[11px] font-bold px-3 py-1 bg-orange-50/60 border border-orange-100 text-orange-700/80 rounded-full flex items-center gap-1">
                      📖 {session.pages_read} pág.
                    </span>
                    {session.minutes_read && (
                      <span className="text-[11px] font-bold px-3 py-1 bg-purple-50/40 border border-purple-100 text-purple-600/80 rounded-full flex items-center gap-1">
                        ⏱ {session.minutes_read} min
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Nota con cita elegante */}
              {session.note && (
                <div className="mt-4 bg-stone-50/60 border border-stone-100 rounded-2xl px-4 py-3">
                  <p className="text-stone-500 text-xs italic font-serif leading-relaxed">"{session.note}"</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Menú de Navegación Inferior Flotante */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-xl border border-stone-200/40 px-3 py-2 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.06)] z-50 flex items-center gap-1 max-w-sm w-[90%] justify-between">
        <button className="flex-1 py-2.5 text-xs font-bold text-orange-500 bg-orange-50/50 rounded-full flex flex-col items-center justify-center transition-all">
          <span className="text-base">🏠</span>
          <span className="text-[9px] tracking-tight mt-0.5">Inicio</span>
        </button>
        <button onClick={() => navigate('/home')} className="flex-1 py-2.5 text-xs font-semibold text-stone-400 hover:text-stone-800 flex flex-col items-center justify-center transition-colors">
          <span className="text-base">📝</span>
          <span className="text-[9px] tracking-tight mt-0.5">Registro</span>
        </button>
        <button onClick={() => navigate('/stats')} className="flex-1 py-2.5 text-xs font-semibold text-stone-400 hover:text-stone-800 flex flex-col items-center justify-center transition-colors">
          <span className="text-base">📊</span>
          <span className="text-[9px] tracking-tight mt-0.5">Métricas</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 py-2.5 text-xs font-semibold text-stone-400 hover:text-stone-800 flex flex-col items-center justify-center transition-colors">
          <span className="text-base">👤</span>
          <span className="text-[9px] tracking-tight mt-0.5">Perfil</span>
        </button>
      </div>

    </div>
  )
}

export default Feed