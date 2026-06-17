import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const GENRE_STYLES = {
  fantasia:       { color: 'bg-purple-100 text-purple-500', icon: '🔮', spine: '#7c3aed' },
  ciencia_ficcion:{ color: 'bg-blue-100 text-blue-500',    icon: '🚀', spine: '#2563eb' },
  thriller:       { color: 'bg-red-100 text-red-500',      icon: '🔪', spine: '#dc2626' },
  romance:        { color: 'bg-pink-100 text-pink-500',     icon: '💕', spine: '#db2777' },
  historica:      { color: 'bg-amber-100 text-amber-600',  icon: '⚔️', spine: '#d97706' },
  terror:         { color: 'bg-orange-100 text-orange-500',icon: 'ghost', spine: '#ea580c' },
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
  
  // ESTADOS LONG TOUCH & DETALLES
  const [selectedSession, setSelectedSession] = useState(null)
  const [isClosing, setIsClosing] = useState(false)
  const longPressTimer = useRef(null)

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

  // --- CONTROL GESTOS TACTILES ---
  const handleTouchStart = (session) => {
    if (selectedSession) return
    longPressTimer.current = setTimeout(() => {
      setSelectedSession(session)
    }, 450)
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  const closeDetails = () => {
    setIsClosing(true)
    setTimeout(() => {
      setSelectedSession(null)
      setIsClosing(false)
    }, 400)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#f8f6f2] flex items-center justify-center">
      <p className="text-stone-400 text-sm tracking-wide">cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f6f2] pb-36 antialiased select-none" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>

      <style>{`
        @keyframes cardEntrance {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .feed-card-native {
          animation: cardEntrance 0.55s cubic-bezier(0.215, 0.610, 0.355, 1) both;
          will-change: transform, opacity;
        }

        .book-flat-container {
          position: relative;
          width: 135px;
          height: 195px;
          perspective: 1000px;
          transform-style: preserve-3d;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
        }
        .book-flat-container:active {
          transform: scale(1.08) rotateY(-18deg) rotateZ(-2deg);
        }

        .book-flat-cover {
          width: 100%; height: 100%; object-fit: cover;
          border-radius: 4px 6px 6px 4px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14), inset 1px 0 3px rgba(255,255,255,0.2);
          transition: box-shadow 0.4s ease;
        }
        .book-flat-container:active .book-flat-cover {
          box-shadow: 14px 20px 36px rgba(0, 0, 0, 0.3), 2px 4px 10px rgba(0, 0, 0, 0.15);
        }

        .book-flat-spine-effect {
          position: absolute; top: 0; left: 0; bottom: 0; width: 5px;
          background: linear-gradient(to right, rgba(0,0,0,0.18) 0%, transparent 100%);
          border-radius: 4px 0 0 4px; pointer-events: none;
        }

        /* FIX DE BLURS USANDO DEGRADADO MASK-IMAGE */
        .blur-header-mask {
          position: fixed; top: 0; left: 0; right: 0; z-index: 35; h-28;
          background: rgba(248,246,242, 0.85);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          mask-image: linear-gradient(to bottom, black 50%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%);
          pointer-events: none;
        }
        .blur-footer-mask {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 35; h-36;
          background: rgba(248,246,242, 0.85);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          mask-image: linear-gradient(to top, black 55%, transparent 100%);
          -webkit-mask-image: linear-gradient(to top, black 55%, transparent 100%);
          pointer-events: none;
        }

        /* ANIMACIONES EN MODO OSCURO (LONG PRESS) */
        @keyframes bIn {
          from { opacity: 0; backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
        }
        @keyframes bOut {
          from { opacity: 1; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
          to { opacity: 0; backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
        }
        .anim-bg-in { animation: bIn 0.4s ease forwards; }
        .anim-bg-out { animation: bOut 0.4s ease forwards; }

        @keyframes bkOpen {
          0% { transform: scale(0.75) rotateY(0deg); opacity: 0; }
          100% { transform: scale(1) rotateY(-24deg) rotateX(6deg); opacity: 1; }
        }
        @keyframes bkClose {
          from { transform: scale(1) rotateY(-24deg) rotateX(6deg); opacity: 1; }
          to { transform: scale(0.6) rotateY(0deg); opacity: 0; }
        }
        .anim-book-open { animation: bkOpen 0.48s cubic-bezier(0.19, 1, 0.22, 1) forwards; transform-style: preserve-3d; perspective: 1000px; }
        .anim-book-close { animation: bkClose 0.35s cubic-bezier(0.55, 0, 1, 0.45) forwards; }

        @keyframes panelUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes panelDown {
          from { transform: translateY(0); }
          to { transform: translateY(100%); }
        }
        .anim-panel-in { animation: panelUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .anim-panel-out { animation: panelDown 0.35s cubic-bezier(0.55, 0, 1, 0.45) forwards; }
      `}</style>

      {/* Máscaras de Desenfoque Corregidas sin saltos visuales */}
      <div className="blur-header-mask h-24" />
      <div className="blur-footer-mask h-32" />

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg">
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
            <button onClick={() => navigate('/admin')} className="text-[11px] text-stone-400 tracking-widest uppercase font-semibold">admin</button>
          )}
          <button onClick={() => supabase.auth.signOut().then(() => navigate('/'))} className="w-7 h-7 rounded-full bg-stone-200/60 flex items-center justify-center text-stone-500 text-[10px]">✕</button>
        </div>
      </div>

      <div className="px-5 pb-4">
        <p className="text-[22px] font-bold text-stone-900 tracking-tight">Hola, {myProfile?.username || 'lector'} 👋</p>
        <p className="text-stone-400 text-[13px] mt-0.5 italic">Manten pulsada la portada para inspeccionar</p>
      </div>

      {/* Buscador */}
      <div className="px-5 mb-6 relative z-30">
        <input
          type="text"
          placeholder="Buscar lectores..."
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          className="w-full bg-white/80 text-stone-800 placeholder-stone-400 rounded-2xl px-4 py-3 text-sm outline-none border border-stone-200/60"
        />
      </div>

      {/* Feed principal */}
      <div className="space-y-8 max-w-md mx-auto">
        {sessions.length === 0 ? (
          <div className="mx-5 bg-white rounded-3xl p-12 text-center border border-stone-200/40">
            <p className="text-stone-400 text-sm">Tu feed está vacío</p>
          </div>
        ) : (
          sessions.map((session, index) => {
            const currentGenre = GENRE_STYLES[session.books?.genre] || GENRE_STYLES.otro

            return (
              <div
                key={session.id}
                className="feed-card-native mx-5 bg-white rounded-[2.5rem] overflow-hidden border border-stone-100 shadow-md flex flex-col justify-between"
                style={{ minHeight: '82vh', animationDelay: `${index * 0.06}s` }}
              >
                {/* Render multimedia superior */}
                <div className="relative w-full overflow-hidden flex-1 flex items-center justify-center" style={{ minHeight: '52vh' }}>
                  {session.books?.cover_url ? (
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${session.books.cover_url})`, filter: 'blur(30px) brightness(0.65)', transform: 'scale(1.25)' }} />
                  ) : (
                    <div className={`absolute inset-0 ${currentGenre.color} opacity-40`} />
                  )}

                  <div className="absolute top-6 left-6 z-30 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-sm font-bold text-white border border-white/30">
                      {session.profiles?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-white leading-tight drop-shadow-md">{session.profiles?.username || 'Usuario'}</p>
                      <p className="text-white/75 text-[11px] font-medium mt-0.5">{timeAgo(session.created_at)}</p>
                    </div>
                  </div>

                  {/* Libro de la Tarjeta */}
                  <div className="relative z-10 w-full h-full max-h-[42vh] px-10 py-4 flex items-center justify-center">
                    <div 
                      className="book-flat-container"
                      onTouchStart={() => handleTouchStart(session)}
                      onTouchEnd={handleTouchEnd}
                      onMouseDown={() => handleTouchStart(session)}
                      onMouseUp={handleTouchEnd}
                      onMouseLeave={handleTouchEnd}
                    >
                      {session.books?.cover_url ? (
                        <img src={session.books.cover_url} alt={session.books.title} className="book-flat-cover" loading="lazy" />
                      ) : (
                        <div className={`book-flat-cover ${currentGenre.color} flex flex-col items-center justify-center p-4 text-center`}>
                          <span className="text-3xl mb-2">{currentGenre.icon}</span>
                          <p className="text-[11px] font-black uppercase tracking-wider line-clamp-4">{session.books?.title}</p>
                        </div>
                      )}
                      <div className="book-flat-spine-effect" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 z-20 h-32" style={{ background: 'linear-gradient(to top, #ffffff 0%, rgba(255,255,255,0.5) 40%, transparent 100%)' }} />
                </div>

                {/* Bloque Completo de Información en Tarjeta */}
                <div className="px-6 pb-7 bg-white relative z-30">
                  <span className="text-[10px] font-bold tracking-widest uppercase bg-stone-100 text-stone-500 px-2.5 py-1 rounded-md">
                    {(session.books?.genre || 'otro').replace('_', ' ')}
                  </span>

                  <h3 className="text-xl font-black text-stone-900 tracking-tight mt-2">{session.books?.title}</h3>
                  <p className="text-stone-400 text-sm mt-0.5 font-medium">
                    {session.books?.author}
                    {session.books?.year && <span className="text-stone-300 font-normal"> · {session.books.year}</span>}
                  </p>

                  {/* Progreso de la sesión */}
                  {session.books?.finished ? (
                    <div className="mt-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-100 rounded-2xl px-4 py-3 text-center">
                      <p className="text-sm font-black text-stone-900">🎉 ¡Libro Completado!</p>
                    </div>
                  ) : (
                    session.books?.total_pages > 0 && (
                      <div className="mt-4">
                        <div className="flex justify-between text-[11px] text-stone-400 mb-1">
                          <span>Progreso Global</span>
                          <span className="font-bold text-orange-500">{Math.round((session.books.current_page / session.books.total_pages) * 100)}%</span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              session.books?.genre === 'fantasia' ? 'bg-purple-500' :
                              session.books?.genre === 'historica' ? 'bg-amber-500' : 'bg-orange-500'
                            }`}
                            style={{ width: `${(session.books.current_page / session.books.total_pages) * 100}%` }}
                          />
                        </div>
                      </div>
                    )
                  )}

                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className="text-xs font-bold px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100">📖 {session.pages_read} pág. hoy</span>
                    {session.minutes_read && <span className="text-xs font-bold px-3 py-1.5 bg-stone-50 text-stone-500 rounded-full border border-stone-200">⏱ {session.minutes_read} min</span>}
                  </div>

                  {/* Botones de acción inferiores */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-stone-100">
                    <button onClick={() => handleLike(session.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${likes[session.id]?.liked ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-stone-50 text-stone-400'}`}>
                      ❤ <span>{likes[session.id]?.count || 0}</span>
                    </button>
                    {session.user_id !== user?.id && (
                      <button onClick={() => handleAddToList(session)} className="text-xs font-bold px-4 py-2 bg-stone-50 text-stone-500 rounded-full border border-stone-100">
                        + Mi lista
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* --- MODO DETALLE EN OSCURO: CON CONTENIDO EXPANDIBLE DE RECOMENDACIÓN --- */}
      {selectedSession && (
        <div 
          className={`fixed inset-0 z-50 flex flex-col justify-end bg-stone-950/85 transition-all ${isClosing ? 'anim-bg-out' : 'anim-bg-in'}`}
          style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        >
          {/* Libro flotante en la mitad superior */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 relative">
            <button 
              onClick={closeDetails} 
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-base hover:bg-white/20 active:scale-90 transition-transform"
            >
              ✕
            </button>
            
            <div 
              className={`w-[145px] h-[210px] ${isClosing ? 'anim-book-close' : 'anim-book-open'}`}
              style={{ boxShadow: '0 35px 65px rgba(0,0,0,0.65), 5px 15px 25px rgba(0,0,0,0.4)' }}
            >
              {selectedSession.books?.cover_url ? (
                <img src={selectedSession.books.cover_url} alt="" className="w-full h-full object-cover rounded-r-md rounded-l-sm" />
              ) : (
                <div className="w-full h-full bg-stone-800 flex items-center justify-center rounded-r-md"><span className="text-3xl">📖</span></div>
              )}
              <div className="absolute top-0 left-0 bottom-0 w-5 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />
            </div>
          </div>

          {/* PANEL INFERIOR INTEGRADO: Limitado al tamaño simétrico de tus tarjetas de feed (max-w-md mx-auto) */}
          <div 
            className={`w-full max-w-md mx-auto bg-white rounded-t-[2.5rem] md:rounded-b-[2.5rem] md:mb-6 shadow-2xl flex flex-col overflow-hidden ${
              isClosing ? 'anim-panel-out' : 'anim-panel-in'
            }`}
            style={{ maxHeight: '62vh', minHeight: '55vh' }}
          >
            {/* Cabecera fija interna */}
            <div className="px-6 pt-6 pb-3 border-b border-stone-100 flex items-center justify-between flex-shrink-0">
              <div>
                <span className="text-[9px] font-black tracking-widest uppercase bg-orange-100 text-orange-600 px-2 py-0.5 rounded">
                  {selectedSession.books?.genre || 'General'}
                </span>
                <h2 className="text-xl font-black text-stone-900 tracking-tight mt-1 truncate max-w-[220px]">
                  {selectedSession.books?.title}
                </h2>
              </div>
              <button onClick={closeDetails} className="text-xs font-bold text-stone-400 bg-stone-100 px-3 py-1.5 rounded-full hover:bg-stone-200 transition-colors">
                Cerrar
              </button>
            </div>

            {/* Contenedor scrolleable interno */}
            <div className="overflow-y-auto flex-1 p-6 space-y-6 text-stone-800 scrollbar-none">
              
              {/* Bloque Estadístico */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100">
                  <p className="text-[10px] uppercase text-stone-400 font-bold tracking-wide">PÁGINAS LEÍDAS</p>
                  <p className="text-lg font-black text-stone-800 mt-0.5">+{selectedSession.pages_read} <span className="text-xs text-stone-400 font-normal">pags</span></p>
                </div>
                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100">
                  <p className="text-[10px] uppercase text-stone-400 font-bold tracking-wide">TIEMPO DEDICADO</p>
                  <p className="text-lg font-black text-stone-800 mt-0.5">{selectedSession.minutes_read || '--'} <span className="text-xs text-stone-400 font-normal">min</span></p>
                </div>
              </div>

              {/* Sección 1: Sinopsis */}
              <div>
                <h4 className="text-xs font-bold uppercase text-stone-400 tracking-wider mb-2">Sinopsis</h4>
                <p className="text-sm text-stone-600 leading-relaxed bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  Esta es una sinopsis provisional del libro. Próximamente se sincronizará automáticamente con metadatos extendidos de la base de datos para ofrecer una inmersión completa al lector antes de interactuar con el recomendador.
                </p>
              </div>

              {/* Sección 2: Recomendador Content-Based */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <h4 className="text-xs font-bold uppercase text-stone-400 tracking-wider">Libros Similares</h4>
                  <span className="text-[9px] bg-blue-50 text-blue-600 font-extrabold px-1.5 py-0.5 rounded">Content-Based AI</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="min-w-[105px] w-[105px] bg-stone-50 p-2 rounded-xl border border-stone-100 text-center">
                      <div className="w-full h-28 bg-stone-200 rounded-md mb-1.5 flex items-center justify-center text-stone-400 text-xs">📖</div>
                      <p className="text-[10px] font-bold text-stone-700 truncate">Libro similar {i}</p>
                      <p className="text-[9px] text-stone-400 truncate">94% Match</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sección 3: Mismo Género */}
              <div>
                <h4 className="text-xs font-bold uppercase text-stone-400 tracking-wider mb-2">Más de este género</h4>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="min-w-[105px] w-[105px] bg-stone-50 p-2 rounded-xl border border-stone-100 text-center">
                      <div className="w-full h-28 bg-stone-200 rounded-md mb-1.5 flex items-center justify-center text-stone-400 text-xs">🔮</div>
                      <p className="text-[10px] font-bold text-stone-700 truncate">Ejemplar {i}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sección 4: Autores Relacionados */}
              <div className="pb-4">
                <h4 className="text-xs font-bold uppercase text-stone-400 tracking-wider mb-2">Autores Parecidos</h4>
                <div className="grid grid-cols-2 gap-2">
                  {['Autor Relacionado A', 'Autor Relacionado B'].map((author, idx) => (
                    <div key={idx} className="bg-stone-50 px-3 py-2.5 rounded-xl border border-stone-100 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-stone-200 flex-shrink-0" />
                      <p className="text-xs font-semibold text-stone-700 truncate">{author}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer Fijo del Panel */}
            <div className="p-4 bg-white border-t border-stone-100 flex-shrink-0">
              <button onClick={closeDetails} className="w-full bg-stone-900 text-white font-bold py-3.5 rounded-2xl shadow-md text-sm active:scale-[0.99] transition-all">
                Volver al Feed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navbar flotante */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 px-3 py-2 rounded-full border border-white/40" style={{ background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', width: '85%', maxWidth: '360px' }}>
        {[
          { label: 'Inicio', path: '/feed', active: true, icon: (active) => <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg> },
          { label: 'Registro', path: '/home', active: false, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 016.5 2z"/></svg> },
          { label: 'Stats', path: '/stats', active: false, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
          { label: 'Perfil', path: '/profile', active: false, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} className={`flex-1 py-2 flex flex-col items-center gap-1 rounded-full ${item.active ? 'text-orange-500' : 'text-stone-400'}`}>
            {item.icon(item.active)}
            <span className="text-[9px] font-semibold">{item.label}</span>
          </button>
        ))}
      </div>

    </div>
  )
}

export default Feed