import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const GENRE_STYLES = {
  fantasia:       { color: 'bg-purple-100 text-purple-500', icon: '🔮', spine: '#7c3aed' },
  ciencia_ficcion:{ color: 'bg-blue-100 text-blue-500',    icon: '🚀', spine: '#2563eb' },
  thriller:       { color: 'bg-red-100 text-red-500',      icon: '🔪', spine: '#dc2626' },
  romance:        { color: 'bg-pink-100 text-pink-500',     icon: '💕', spine: '#db2777' },
  historica:      { color: 'bg-amber-100 text-amber-600',  icon: '⚔️', spine: '#d97706' },
  terror:         { color: 'bg-orange-100 text-orange-500',icon: '👻', spine: '#ea580c' },
  no_ficcion:     { color: 'bg-teal-100 text-teal-500',    icon: '📚', spine: '#0d9488' },
  autobiografia:  { color: 'bg-green-100 text-green-500',  icon: '✍️', spine: '#16a34a' },
  otro:           { color: 'bg-stone-100 text-stone-500',  icon: '📖', spine: '#57534e' },
}

function Feed() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [myProfile, setMyProfile] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [likes, setLikes] = useState({})
  const [toast, setToast] = useState(null)
  
  const navigate = useNavigate()

  useEffect(() => { fetchFeed() }, [])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function fetchFeed() {
    try {
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
        .select('*, books(title, author, cover_url, genre, year, total_pages, current_page, finished, rating)')
        .in('user_id', allIds)
        .order('created_at', { ascending: false })
        .limit(25)

      if (sessionData) {
        const uniqueUserIds = [...new Set(sessionData.map(s => s.user_id))]
        const { data: profilesData } = await supabase
          .from('profiles').select('id, username').in('id', uniqueUserIds)
        const profilesMap = {}
        profilesData?.forEach(p => { profilesMap[p.id] = p })
        
        setSessions(sessionData.map(s => ({ ...s, profiles: profilesMap[s.user_id] || null })))
        
        const sessionIds = sessionData.map(s => s.id)
        if (sessionIds.length > 0) {
          await fetchLikes(sessionIds, user?.id)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchLikes(sessionIds, currentUserId) {
    const { data } = await supabase
      .from('likes')
      .select('session_id, user_id')
      .in('session_id', sessionIds)
      
    const likesMap = {}
    sessionIds.forEach(id => { likesMap[id] = { count: 0, liked: false } })

    if (data) {
      data.forEach(like => {
        if (!likesMap[like.session_id]) likesMap[like.session_id] = { count: 0, liked: false }
        likesMap[like.session_id].count++
        if (like.user_id === currentUserId) likesMap[like.session_id].liked = true
      })
    }
    setLikes(likesMap)
  }

  async function handleLike(sessionId) {
    if (!user) return
    const isLiked = likes[sessionId]?.liked
    
    setLikes(prev => ({
      ...prev,
      [sessionId]: {
        count: (prev[sessionId]?.count || 0) + (isLiked ? -1 : 1),
        liked: !isLiked
      }
    }))

    if (isLiked) {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('session_id', sessionId)
    } else {
      await supabase.from('likes').insert({ user_id: user.id, session_id: sessionId })
    }
  }

  async function handleAddToList(session) {
    if (!user) return
    const { data: existing } = await supabase
      .from('books').select('id').eq('user_id', user.id).eq('title', session.books.title).single()

    if (existing) {
      showToast('Ya tienes este libro en tu lista')
      return
    }

    const { error } = await supabase.from('books').insert({
      user_id: user.id,
      title: session.books.title,
      author: session.books.author,
      cover_url: session.books.cover_url,
      genre: session.books.genre,
      year: session.books.year,
      total_pages: session.books.total_pages,
      current_page: 0,
      finished: false
    })

    if (!error) showToast(`"${session.books.title}" añadido a tu lista`)
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

      {/* Estilos CSS consolidados y optimizados para GPU */}
      <style>{`
        @keyframes cardEntrance {
          from {
            opacity: 0;
            transform: translateY(24px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .feed-card-native {
          animation: cardEntrance 0.55s cubic-bezier(0.215, 0.610, 0.355, 1) both;
          will-change: transform, opacity;
        }

        /* Contenedor plano y elegante del libro */
        .book-flat-container {
          position: relative;
          width: 135px;
          height: 195px;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Pequeño feedback visual nativo si el usuario pulsa la tarjeta */
        .feed-card-native:active .book-flat-container {
          transform: scale(1.02) rotate(-1deg);
        }

        .book-flat-cover {
          width: 100%;
          height: 100%;
          object-cover: cover;
          border-radius: 4px 6px 6px 4px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2), inset 2px 0 5px rgba(255,255,255,0.2);
        }

        /* Simulación sutil de las páginas/lomo del libro en vista plana */
        .book-flat-spine-effect {
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: 5px;
          background: linear-gradient(to right, rgba(0,0,0,0.2) 0%, transparent 100%);
          border-radius: 4px 0 0 4px;
          pointer-events: none;
        }
      `}</style>

      {/* Blurs fijos optimizados en iOS */}
      <div className="fixed top-0 left-0 right-0 z-35 h-24 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(248,246,242,1) 0%, rgba(248,246,242,0.8) 60%, transparent 100%)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', maskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 100%)' }} />
      <div className="fixed bottom-0 left-0 right-0 z-35 h-32 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(248,246,242,1) 0%, rgba(248,246,242,0.8) 60%, transparent 100%)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', maskImage: 'linear-gradient(to top, black 0%, black 40%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to top, black 0%, black 40%, transparent 100%)' }} />

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg transition-all animate-bounce">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between relative z-40">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/profile')}>
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
          <button onClick={() => supabase.auth.signOut().then(() => navigate('/'))} className="w-7 h-7 rounded-full bg-stone-200/60 flex items-center justify-center text-stone-500 text-[10px]">✕</button>
        </div>
      </div>

      {/* Saludo */}
      <div className="px-5 pb-4">
        <p className="text-[22px] font-bold text-stone-900 tracking-tight">Hola, {myProfile?.username || 'lector'} 👋</p>
        <p className="text-stone-400 text-[13px] mt-0.5 italic">¿qué están leyendo hoy?</p>
      </div>

      {/* Buscador */}
      <div className="px-5 mb-6 relative z-50">
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
                <div key={profile.id} onClick={() => { navigate(`/user/${profile.id}`); setSearchQuery(''); setSearchResults([]) }} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-0">
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

      {/* Feed — Tarjetas */}
      <div className="space-y-8 max-w-md mx-auto">
        {sessions.length === 0 ? (
          <div className="mx-5 bg-white rounded-3xl p-12 text-center border border-stone-200/40">
            <p className="text-stone-400 text-sm">Tu feed está vacío</p>
            <p className="text-stone-300 text-xs mt-1">Sigue a otros lectores para ver su activity</p>
          </div>
        ) : (
          sessions.map((session, index) => {
            const currentGenre = GENRE_STYLES[session.books?.genre] || GENRE_STYLES.otro

            return (
              <div
                key={session.id}
                className="feed-card-native mx-5 bg-white rounded-[2.5rem] overflow-hidden border border-stone-100 shadow-md flex flex-col justify-between"
                style={{
                  minHeight: '82vh',
                  animationDelay: `${index * 0.06}s` // Efecto cascada ultra veloz y fluido
                }}
              >
                {/* Contenedor visual del libro */}
                <div className="relative w-full overflow-hidden flex-1 flex items-center justify-center" style={{ minHeight: '52vh' }}>
                  
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
                    <div className={`absolute inset-0 ${currentGenre.color} opacity-40`} />
                  )}

                  <div className="absolute top-0 left-0 right-0 z-20 h-36" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)' }} />

                  {/* Perfil del Publicador */}
                  <div className="absolute top-6 left-6 z-30 flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/user/${session.user_id}`)}>
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-sm font-bold text-white border border-white/30 shadow-sm">
                      {session.profiles?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-white leading-tight drop-shadow-md">{session.profiles?.username || 'Usuario'}</p>
                      <p className="text-white/75 text-[11px] font-medium mt-0.5 drop-shadow-sm">{timeAgo(session.created_at)}</p>
                    </div>
                  </div>

                  <div className="absolute top-6 right-6 z-30">
                    <span className="text-base p-2 rounded-full bg-white/20 backdrop-blur-md border border-white/30 block shadow-sm">
                      {currentGenre.icon}
                    </span>
                  </div>

                  {/* Renderizado Plano Limpio (Sin 3D pesado) */}
                  <div className="relative z-10 w-full h-full max-h-[42vh] px-10 py-4 flex items-center justify-center">
                    <div className="book-flat-container">
                      {session.books?.cover_url ? (
                        <img 
                          src={session.books.cover_url} 
                          alt={session.books.title} 
                          className="book-flat-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className={`book-flat-cover ${currentGenre.color} flex flex-col items-center justify-center p-4 text-center border border-stone-200/50`}>
                          <span className="text-3xl mb-2">{currentGenre.icon}</span>
                          <p className="text-[11px] font-black uppercase tracking-wider line-clamp-4 leading-tight">{session.books?.title}</p>
                        </div>
                      )}
                      <div className="book-flat-shadow-effect" />
                      <div className="book-flat-spine-effect" />
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 z-20 h-32" style={{ background: 'linear-gradient(to top, #ffffff 0%, rgba(255,255,255,0.5) 40%, transparent 100%)' }} />
                </div>

                {/* Detalles de lectura */}
                <div className="px-6 pb-7 bg-white relative z-30">
                  <h3 className="text-xl font-black text-stone-900 tracking-tight leading-snug">{session.books?.title}</h3>
                  <p className="text-stone-400 text-sm mt-0.5 font-medium">
                    {session.books?.author}
                    {session.books?.year && <span className="text-stone-300 font-normal"> · {session.books.year}</span>}
                  </p>

                  {session.books?.finished ? (
                    <div className="mt-4">
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-100 rounded-2xl px-5 py-4 text-center">
                        <p className="text-2xl mb-1">🎉</p>
                        <p className="text-sm font-black text-stone-900">¡Libro terminado!</p>
                        <p className="text-stone-400 text-xs mt-0.5">{session.books.total_pages} páginas · {session.books.genre?.replace('_', ' ')}</p>
                        {session.books?.rating && (
                          <div className="flex justify-center gap-1 mt-2">
                            {[1, 2, 3, 4, 5].map(star => (
                              <span key={star} className={`text-sm ${star <= session.books.rating ? 'text-amber-400' : 'text-stone-200'}`}>★</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="text-xs font-bold px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100">
                          <b>📖 {session.pages_read} pág. hoy</b>
                        </span>
                        {session.minutes_read && (
                          <span className="text-xs font-bold px-3 py-1.5 bg-stone-50 text-stone-500 rounded-full border border-stone-200">
                            ⏱ {session.minutes_read} min
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4">
                      {session.books?.total_pages > 0 && (
                        <>
                          <div className="flex justify-between text-[11px] text-stone-400 mb-1.5 font-medium">
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
                              style={{ width: `${Math.max(Math.min((session.books.current_page / session.books.total_pages) * 100, 100), 2)}%` }}
                            />
                            <span
                              className="absolute text-lg leading-none transition-all duration-500 z-10"
                              style={{
                                left: `calc(${Math.min((session.books.current_page / session.books.total_pages) * 100, 98)}% - 10px)`,
                                top: '-8px'
                              }}
                            >
                              {currentGenre.icon}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex flex-wrap gap-2 mt-4">
                        <span className="text-xs font-bold px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100">
                          📖 {session.pages_read} pág. hoy
                        </span>
                        {session.minutes_read && (
                          <span className="text-xs font-bold px-3 py-1.5 bg-stone-50 text-stone-500 rounded-full border border-stone-200">
                            ⏱ {session.minutes_read} min
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-stone-100">
                    <button
                      onClick={() => handleLike(session.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                        likes[session.id]?.liked
                          ? 'bg-red-50 text-red-500 border border-red-100'
                          : 'bg-stone-50 text-stone-400 border border-stone-100'
                      }`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={likes[session.id]?.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      <span>{likes[session.id]?.count || 0}</span>
                    </button>

                    {session.user_id !== user?.id && (
                      <button
                        onClick={() => handleAddToList(session)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-stone-50 text-stone-400 border border-stone-100 active:bg-stone-100 transition-all"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        <span>Mi lista</span>
                      </button>
                    )}
                  </div>

                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Navbar flotante */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-3 py-2 rounded-full border border-white/40" style={{ background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(24px) saturate(2)', WebkitBackdropFilter: 'blur(24px) saturate(2)', boxShadow: '0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)', width: '85%', maxWidth: '360px' }}>
        {[
          { label: 'Inicio', path: '/feed', active: true, icon: (active) => <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg> },
          { label: 'Registro', path: '/home', active: false, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/></svg> },
          { label: 'Stats', path: '/stats', active: false, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
          { label: 'Perfil', path: '/profile', active: false, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} className={`flex-1 py-2 flex flex-col items-center gap-1 rounded-full transition-all ${item.active ? 'text-orange-500' : 'text-stone-400'}`}>
            {item.icon(item.active)}
            <span className="text-[9px] font-semibold tracking-tight">{item.label}</span>
          </button>
        ))}
      </div>

    </div>
  )
}

export default Feed