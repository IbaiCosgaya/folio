// src/pages/Feed.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { getGenreStyle } from '../constants/genres'
import Navbar from '../components/layout/Navbar'
import { ADMIN_ID } from '../constants/config'

function flattenSession(s) {
  const ub = s.user_books || {}
  const gb = ub.global_books || {}
  return {
    id: s.id,
    user_id: s.user_id,
    created_at: s.created_at,
    pages_read: s.pages_read,
    minutes_read: s.minutes_read,
    profiles: null,
    books: {
      book_id: ub.book_id,
      title: gb.title,
      author: gb.author,
      cover_url: gb.cover_url,
      genre: gb.genre,
      year: gb.year,
      total_pages: gb.total_pages,
      current_page: ub.current_page,
      finished: ub.finished,
      rating: ub.rating,
    },
  }
}

function timeAgo(date) {
  const diff = Math.floor((new Date() - new Date(date)) / 1000)
  if (diff < 60) return 'ahora mismo'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  return `hace ${Math.floor(diff / 86400)}d`
}

// ─────────────────────────────────────────────────────────────────────────────
// Long-press panel sub-components
// ─────────────────────────────────────────────────────────────────────────────

// Skeleton shelf — ready for real data in Fase 4.
// Replace the inner div with actual book cards when the recommender is built.
function ComingSoonShelf({ label, tag }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h4 className="text-xs font-bold uppercase text-stone-400 tracking-wider">{label}</h4>
        <span className="text-[9px] bg-blue-50 text-blue-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
          {tag}
        </span>
      </div>
      {/* TODO Fase 4: replace these skeletons with real book cards from the recommender */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {[1, 2, 3].map(i => (
          <div key={i} className="min-w-[88px] flex-shrink-0">
            <div className="w-[88px] h-[120px] bg-stone-100 rounded-xl mb-2 animate-pulse" />
            <div className="h-2 bg-stone-100 rounded-full w-3/4 mb-1 animate-pulse" />
            <div className="h-2 bg-stone-100 rounded-full w-1/2 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

// More books by same author — real query to global_books
function AuthorShelf({ author, currentBookId }) {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!author) return
    supabase
      .from('global_books')
      .select('id, title, cover_url, genre')
      .ilike('author', author)
      .neq('id', currentBookId)
      .limit(6)
      .then(({ data }) => {
        setBooks(data || [])
        setLoading(false)
      })
  }, [author, currentBookId])

  if (!loading && books.length === 0) return null

  return (
    <div>
      <h4 className="text-xs font-bold uppercase text-stone-400 tracking-wider mb-3">
        Más de {author}
      </h4>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {loading
          ? [1, 2, 3].map(i => (
              <div key={i} className="min-w-[88px] flex-shrink-0">
                <div className="w-[88px] h-[120px] bg-stone-100 rounded-xl animate-pulse" />
              </div>
            ))
          : books.map(book => {
              const g = getGenreStyle(book.genre)
              const Icon = g.icon
              return (
                <div key={book.id} className="min-w-[88px] flex-shrink-0">
                  <div className="w-[88px] h-[120px] rounded-xl overflow-hidden mb-2 shadow-sm">
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={book.title}
                        className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${g.badge}`}>
                        <Icon size={22} strokeWidth={1.6} />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-stone-700 leading-tight line-clamp-2">
                    {book.title}
                  </p>
                </div>
              )
            })
        }
      </div>
    </div>
  )
}

// Friends who also finished this book — real query, correctly filtered by follows
function FriendsWhoRead({ bookId, currentUserId }) {
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!bookId || !currentUserId) return

    async function load() {
      // Step 1: get IDs of people the current user follows
      const { data: followData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId)

      const followingIds = (followData || []).map(f => f.following_id)
      if (followingIds.length === 0) { setLoading(false); return }

      // Step 2: among those, find who finished this specific book
      const { data } = await supabase
        .from('user_books')
        .select('user_id, profiles(username)')
        .eq('book_id', bookId)
        .eq('finished', true)
        .in('user_id', followingIds)
        .neq('user_id', currentUserId)

      setFriends(
        (data || [])
          .map(f => ({ id: f.user_id, username: f.profiles?.username }))
          .filter(f => f.username)
      )
      setLoading(false)
    }

    load()
  }, [bookId, currentUserId])

  if (loading || friends.length === 0) return null

  return (
    <div>
      <h4 className="text-xs font-bold uppercase text-stone-400 tracking-wider mb-3">
        También lo leyeron
      </h4>
      <div className="flex flex-wrap gap-2">
        {friends.map(f => (
          <div key={f.id}
            className="flex items-center gap-2 bg-stone-50 border border-stone-100 rounded-full pl-1 pr-3 py-1">
            <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-600 flex-shrink-0">
              {f.username[0].toUpperCase()}
            </div>
            <span className="text-xs font-semibold text-stone-700">{f.username}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Feed component
// ─────────────────────────────────────────────────────────────────────────────

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
  const [pendingCount, setPendingCount] = useState(0)
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

        if (user.id === ADMIN_ID) {
          const { count } = await supabase
            .from('book_requests')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending')
          setPendingCount(count || 0)
        }
      }

      const { data: follows } = await supabase
        .from('follows').select('following_id').eq('follower_id', user.id)

      const followingIds = follows?.map(f => f.following_id) || []
      const allIds = [user.id, ...followingIds]

      const { data: sessionData } = await supabase
        .from('reading_sessions')
        .select('*, user_books(book_id, current_page, finished, rating, global_books(title, author, cover_url, genre, year, total_pages))')
        .in('user_id', allIds)
        .order('created_at', { ascending: false })
        .limit(25)

      if (sessionData) {
        const flatSessions = sessionData.map(flattenSession)

        const uniqueUserIds = [...new Set(flatSessions.map(s => s.user_id))]
        const { data: profilesData } = await supabase
          .from('profiles').select('id, username').in('id', uniqueUserIds)
        const profilesMap = {}
        profilesData?.forEach(p => { profilesMap[p.id] = p })

        setSessions(flatSessions.map(s => ({ ...s, profiles: profilesMap[s.user_id] || null })))

        const sessionIds = flatSessions.map(s => s.id)
        if (sessionIds.length > 0) await fetchLikes(sessionIds, user?.id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchLikes(sessionIds, currentUserId) {
    const { data } = await supabase
      .from('likes').select('session_id, user_id').in('session_id', sessionIds)

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
        liked: !isLiked,
      },
    }))
    if (isLiked) {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('session_id', sessionId)
    } else {
      await supabase.from('likes').insert({ user_id: user.id, session_id: sessionId })
    }
  }

  async function handleAddToList(session) {
    if (!user) return
    const bookId = session.books?.book_id
    if (!bookId) return

    const { data: existing } = await supabase
      .from('user_books').select('id, is_active')
      .eq('user_id', user.id).eq('book_id', bookId).maybeSingle()

    if (existing) {
      if (existing.is_active) { showToast('Ya tienes este libro en tu lista'); return }
      await supabase.from('user_books')
        .update({ is_active: true, current_page: 0, finished: false }).eq('id', existing.id)
      showToast(`"${session.books.title}" añadido a tu lista`)
      return
    }

    const { error } = await supabase.from('user_books').insert({
      user_id: user.id, book_id: bookId,
      current_page: 0, finished: false, is_active: true,
    })
    if (!error) showToast(`"${session.books.title}" añadido a tu lista`)
  }

  async function handleSearch(q) {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      // Reuse already-fetched user from state instead of calling getUser() again
      if (user) {
        const { data } = await supabase
          .from('profiles').select('*')
          .ilike('username', `%${q}%`).neq('id', user.id).limit(5)
        if (data) setSearchResults(data)
      }
    } catch (e) { console.error(e) }
    setSearching(false)
  }

  const handleTouchStart = (session) => {
    if (selectedSession) return
    longPressTimer.current = setTimeout(() => setSelectedSession(session), 450)
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  const closeDetails = () => {
    setIsClosing(true)
    setTimeout(() => { setSelectedSession(null); setIsClosing(false) }, 400)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#f8f6f2] flex items-center justify-center">
      <p className="text-stone-400 text-sm tracking-wide">cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f6f2] pb-36 antialiased select-none"
      style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>

      <style>{`
        @keyframes cardEntrance {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .feed-card-native {
          animation: cardEntrance 0.55s cubic-bezier(0.215, 0.610, 0.355, 1) both;
          will-change: transform, opacity;
        }

        .book-flat-container {
          position: relative; width: 135px; height: 195px;
          perspective: 1000px; transform-style: preserve-3d;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); cursor: pointer;
        }
        .book-flat-container:active {
          transform: scale(1.08) rotateY(-18deg) rotateZ(-2deg);
        }
        .book-flat-cover {
          width: 100%; height: 100%; object-fit: cover;
          border-radius: 4px 6px 6px 4px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.14), inset 1px 0 3px rgba(255,255,255,0.2);
          transition: box-shadow 0.4s ease;
        }
        .book-flat-container:active .book-flat-cover {
          box-shadow: 14px 20px 36px rgba(0,0,0,0.3), 2px 4px 10px rgba(0,0,0,0.15);
        }
        .book-flat-spine-effect {
          position: absolute; top: 0; left: 0; bottom: 0; width: 5px;
          background: linear-gradient(to right, rgba(0,0,0,0.18) 0%, transparent 100%);
          border-radius: 4px 0 0 4px; pointer-events: none;
        }

        .blur-header-mask {
          position: fixed; top: 0; left: 0; right: 0; z-index: 35; height: 96px;
          background: rgba(248,246,242,0.85);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          mask-image: linear-gradient(to bottom, black 50%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%);
          pointer-events: none;
        }
        .blur-footer-mask {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 35; height: 128px;
          background: rgba(248,246,242,0.85);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          mask-image: linear-gradient(to top, black 55%, transparent 100%);
          -webkit-mask-image: linear-gradient(to top, black 55%, transparent 100%);
          pointer-events: none;
        }

        @keyframes bIn {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to   { opacity: 1; backdrop-filter: blur(20px); }
        }
        @keyframes bOut {
          from { opacity: 1; backdrop-filter: blur(20px); }
          to   { opacity: 0; backdrop-filter: blur(0px); }
        }
        .anim-bg-in  { animation: bIn  0.4s ease forwards; }
        .anim-bg-out { animation: bOut 0.4s ease forwards; }

        @keyframes bkOpen {
          0%   { transform: scale(0.75) rotateY(0deg);           opacity: 0; }
          100% { transform: scale(1)    rotateY(-24deg) rotateX(6deg); opacity: 1; }
        }
        @keyframes bkClose {
          from { transform: scale(1) rotateY(-24deg) rotateX(6deg); opacity: 1; }
          to   { transform: scale(0.6) rotateY(0deg);              opacity: 0; }
        }
        .anim-book-open  { animation: bkOpen  0.48s cubic-bezier(0.19, 1, 0.22, 1) forwards; transform-style: preserve-3d; perspective: 1000px; }
        .anim-book-close { animation: bkClose 0.35s cubic-bezier(0.55, 0, 1, 0.45) forwards; }

        @keyframes panelUp   { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes panelDown { from { transform: translateY(0); }    to { transform: translateY(100%); } }
        .anim-panel-in  { animation: panelUp   0.5s  cubic-bezier(0.16, 1, 0.3, 1)      forwards; }
        .anim-panel-out { animation: panelDown 0.35s cubic-bezier(0.55, 0, 1, 0.45)     forwards; }

        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { scrollbar-width: none; }
      `}</style>

      <div className="blur-header-mask" />
      <div className="blur-footer-mask" />

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
          {user?.id === ADMIN_ID && (
            <button onClick={() => navigate('/admin')}
              className="relative text-[11px] text-stone-400 tracking-widest uppercase font-semibold">
              admin
              {pendingCount > 0 && (
                <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => supabase.auth.signOut().then(() => navigate('/'))}
            className="w-7 h-7 rounded-full bg-stone-200/60 flex items-center justify-center text-stone-500 text-[10px]">
            ✕
          </button>
        </div>
      </div>

      <div className="px-5 pb-4">
        <p className="text-[22px] font-bold text-stone-900 tracking-tight">
          Hola, {myProfile?.username || 'lector'} 👋
        </p>
        <p className="text-stone-400 text-[13px] mt-0.5 italic">
          Mantén pulsada la portada para explorar
        </p>
      </div>

      {/* Search */}
      <div className="px-5 mb-6 relative z-30">
        <input
          type="text"
          placeholder="Buscar lectores..."
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          className="w-full bg-white/80 text-stone-800 placeholder-stone-400 rounded-2xl px-4 py-3 text-sm outline-none border border-stone-200/60"
        />
        {searchQuery.length >= 2 && (
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-stone-200/60 shadow-lg overflow-hidden z-40" style={{ left: '20px', right: '20px' }}>
            {searching ? (
              <p className="px-4 py-3 text-sm text-stone-400">Buscando...</p>
            ) : searchResults.length === 0 ? (
              <p className="px-4 py-3 text-sm text-stone-400">Sin resultados</p>
            ) : (
              searchResults.map(p => (
                <div key={p.id}
                  onClick={() => { navigate(`/user/${p.id}`); setSearchQuery(''); setSearchResults([]) }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">
                    {p.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <p className="text-sm font-semibold text-stone-800">{p.username}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Feed cards */}
      <div className="space-y-8 max-w-md mx-auto">
        {sessions.length === 0 ? (
          <div className="mx-5 bg-white rounded-3xl p-12 text-center border border-stone-200/40">
            <p className="text-stone-400 text-sm">Tu feed está vacío</p>
          </div>
        ) : (
          sessions.map((session, index) => {
            const currentGenre = getGenreStyle(session.books?.genre)
            // FIX: cap animation delay at 4 cards — beyond that, instant appearance
            const animDelay = `${Math.min(index, 3) * 0.06}s`

            return (
              <div
                key={session.id}
                className="feed-card-native mx-5 bg-white rounded-[2.5rem] overflow-hidden border border-stone-100 shadow-md flex flex-col justify-between"
                style={{ minHeight: '82vh', animationDelay: animDelay }}
              >
                {/* Cover area */}
                <div className="relative w-full overflow-hidden flex-1 flex items-center justify-center"
                  style={{ minHeight: '52vh' }}>
                  {session.books?.cover_url ? (
                    <div className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${session.books.cover_url})`, filter: 'blur(30px) brightness(0.65)', transform: 'scale(1.25)' }} />
                  ) : (
                    <div className={`absolute inset-0 ${currentGenre.badge} opacity-40`} />
                  )}

                  <div className="absolute top-6 left-6 z-30 flex items-center gap-3 cursor-pointer"
                    onClick={() => navigate(session.user_id === user?.id ? '/profile' : `/user/${session.user_id}`)}>
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-sm font-bold text-white border border-white/30">
                      {session.profiles?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-white leading-tight drop-shadow-md">
                        {session.profiles?.username || 'Usuario'}
                      </p>
                      <p className="text-white/75 text-[11px] font-medium mt-0.5">
                        {timeAgo(session.created_at)}
                      </p>
                    </div>
                  </div>

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
                        <img src={session.books.cover_url} alt={session.books.title}
                          className="book-flat-cover" loading="lazy" />
                      ) : (
                        <div className={`book-flat-cover ${currentGenre.badge} flex flex-col items-center justify-center p-4 text-center`}>
                          <currentGenre.icon size={32} strokeWidth={1.6} className="mb-2" />
                          <p className="text-[11px] font-black uppercase tracking-wider line-clamp-4">
                            {session.books?.title}
                          </p>
                        </div>
                      )}
                      <div className="book-flat-spine-effect" />
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 z-20 h-32"
                    style={{ background: 'linear-gradient(to top, #ffffff 0%, rgba(255,255,255,0.5) 40%, transparent 100%)' }} />
                </div>

                {/* Info area */}
                <div className="px-6 pb-7 bg-white relative z-30">
                  <span className="text-[10px] font-bold tracking-widest uppercase bg-stone-100 text-stone-500 px-2.5 py-1 rounded-md">
                    {(session.books?.genre || 'otro').replace('_', ' ')}
                  </span>

                  <h3 className="text-xl font-black text-stone-900 tracking-tight mt-2">
                    {session.books?.title}
                  </h3>
                  <p className="text-stone-400 text-sm mt-0.5 font-medium">
                    {session.books?.author}
                    {session.books?.year && (
                      <span className="text-stone-300 font-normal"> · {session.books.year}</span>
                    )}
                  </p>

                  {session.books?.finished ? (
                    <div className="mt-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-100 rounded-2xl px-4 py-3 text-center">
                      <p className="text-sm font-black text-stone-900">🎉 ¡Libro Completado!</p>
                    </div>
                  ) : session.books?.total_pages > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between text-[11px] text-stone-400 mb-1">
                        <span>Progreso Global</span>
                        <span className="font-bold text-orange-500">
                          {Math.round((session.books.current_page / session.books.total_pages) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-2 relative flex items-center mt-3">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${currentGenre.solid}`}
                          style={{ width: `${Math.max((session.books.current_page / session.books.total_pages) * 100, 2)}%` }}
                        />
                        <div
                          className={`absolute flex items-center justify-center w-6 h-6 rounded-full shadow-md ring-2 ring-white transition-all duration-500 z-10 ${currentGenre.solid}`}
                          style={{
                            left: `calc(${Math.min((session.books.current_page / session.books.total_pages) * 100, 94)}% - 12px)`,
                            top: '-8px',
                          }}
                        >
                          {(() => { const Icon = currentGenre.icon; return <Icon size={13} strokeWidth={2.75} className="text-white" /> })()}
                        </div>
                      </div>
                    </div>
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

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-stone-100">
                    <button
                      onClick={() => session.user_id !== user?.id && handleLike(session.id)}
                      disabled={session.user_id === user?.id}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                        session.user_id === user?.id
                          ? 'bg-stone-50 text-stone-300 cursor-not-allowed'
                          : likes[session.id]?.liked
                          ? 'bg-red-50 text-red-500 border border-red-100'
                          : 'bg-stone-50 text-stone-400'
                      }`}
                    >
                      ❤ <span>{likes[session.id]?.count || 0}</span>
                    </button>
                    {session.user_id !== user?.id && (
                      <button
                        onClick={() => handleAddToList(session)}
                        className="text-xs font-bold px-4 py-2 bg-stone-50 text-stone-500 rounded-full border border-stone-100">
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

      {/* ── Long-press detail overlay ── */}
      {selectedSession && (
        <div
          className={`fixed inset-0 z-50 flex flex-col justify-end bg-stone-950/85 ${isClosing ? 'anim-bg-out' : 'anim-bg-in'}`}
          style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        >
          {/* Floating book */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 relative">
            <button
              onClick={closeDetails}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-base active:scale-90 transition-transform"
            >
              ✕
            </button>
            <div className={`w-[145px] h-[210px] ${isClosing ? 'anim-book-close' : 'anim-book-open'}`}
              style={{
                boxShadow: '0 35px 65px rgba(0,0,0,0.65), 5px 15px 25px rgba(0,0,0,0.4)',
                borderRadius: '4px 8px 8px 4px', overflow: 'hidden',
              }}
            >
              {selectedSession.books?.cover_url ? (
                <img src={selectedSession.books.cover_url} alt=""
                  className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-stone-800 flex items-center justify-center">
                  <span className="text-3xl">📖</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom panel */}
          <div
            className={`w-full max-w-md mx-auto bg-white rounded-t-[2.5rem] shadow-2xl flex flex-col overflow-hidden ${isClosing ? 'anim-panel-out' : 'anim-panel-in'}`}
            style={{ maxHeight: '62vh', minHeight: '55vh' }}
          >
            {/* Panel header */}
            <div className="px-6 pt-6 pb-3 border-b border-stone-100 flex items-start justify-between flex-shrink-0">
              <div className="flex-1 min-w-0 pr-3">
                <span className="text-[9px] font-black tracking-widest uppercase bg-orange-100 text-orange-600 px-2 py-0.5 rounded">
                  {selectedSession.books?.genre || 'General'}
                </span>
                <h2 className="text-xl font-black text-stone-900 tracking-tight mt-1 truncate">
                  {selectedSession.books?.title}
                </h2>
                <p className="text-stone-400 text-xs font-medium mt-0.5">
                  {selectedSession.books?.author}
                </p>
              </div>
              <button
                onClick={closeDetails}
                className="text-xs font-bold text-stone-400 bg-stone-100 px-3 py-1.5 rounded-full hover:bg-stone-200 transition-colors flex-shrink-0">
                Cerrar
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 p-6 space-y-6 scrollbar-none">

              {/* Session stats — always real */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100">
                  <p className="text-[9px] uppercase text-stone-400 font-bold tracking-wider mb-1">Páginas hoy</p>
                  <p className="text-2xl font-black text-stone-900 tracking-tight">
                    +{selectedSession.pages_read}
                  </p>
                </div>
                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100">
                  <p className="text-[9px] uppercase text-stone-400 font-bold tracking-wider mb-1">Tiempo</p>
                  <p className="text-2xl font-black text-stone-900 tracking-tight">
                    {selectedSession.minutes_read ? `${selectedSession.minutes_read}m` : '—'}
                  </p>
                </div>
              </div>

              {/* Friends who also read — real data, filtered by follows */}
              <FriendsWhoRead
                bookId={selectedSession.books?.book_id}
                currentUserId={user?.id}
              />

              {/* More by same author — real data from global_books */}
              <AuthorShelf
                author={selectedSession.books?.author}
                currentBookId={selectedSession.books?.book_id}
              />

              {/* Similar books — skeleton ready for Fase 4 content-based recommender */}
              {/* TODO Fase 4: connect to content-based filtering engine */}
              <ComingSoonShelf label="Libros similares" tag="Próximamente" />

              {/* More from genre — skeleton ready for Fase 4 */}
              {/* TODO Fase 4: query by genre filtered by user reading history */}
              <ComingSoonShelf
                label={`Más de ${(selectedSession.books?.genre || 'este género').replace('_', ' ')}`}
                tag="Próximamente"
              />

            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-stone-100 flex-shrink-0">
              <button
                onClick={closeDetails}
                className="w-full bg-stone-900 text-white font-bold py-3.5 rounded-2xl text-sm active:scale-[0.99] transition-all">
                Volver al feed
              </button>
            </div>
          </div>
        </div>
      )}

      <Navbar active="/feed" />
    </div>
  )
}

export default Feed