import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const GENRE_STYLES = {
  fantasia:       { color: 'bg-purple-100 text-purple-500', icon: '🔮' },
  ciencia_ficcion:{ color: 'bg-blue-100 text-blue-500',    icon: '🚀' },
  thriller:       { color: 'bg-red-100 text-red-500',      icon: '🔪' },
  romance:        { color: 'bg-pink-100 text-pink-500',     icon: '💕' },
  historica:      { color: 'bg-amber-100 text-amber-600',  icon: '⚔️' },
  terror:         { color: 'bg-orange-100 text-orange-500',icon: '👻' },
  no_ficcion:     { color: 'bg-teal-100 text-teal-500',    icon: '📚' },
  autobiografia:  { color: 'bg-green-100 text-green-500',  icon: '✍️' },
  otro:           { color: 'bg-stone-100 text-stone-500',  icon: '📖' },
}

function Home() {
  const [books, setBooks] = useState([])
  const [unstartedBooks, setUnstartedBooks] = useState([])
  const [finishedBooks, setFinishedBooks] = useState([])
  const [user, setUser] = useState(null)
  const [myProfile, setMyProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingRating, setEditingRating] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchBooks()
  }, [])

  async function fetchBooks() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    if (user) {
      const { data: myProfileData } = await supabase
        .from('profiles').select('username').eq('id', user.id).single()
      if (myProfileData) setMyProfile(myProfileData)

      const { data } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', user.id)

      if (data) {
        setBooks(data.filter(b => !b.finished && b.current_page > 0))
        setUnstartedBooks(data.filter(b => !b.finished && b.current_page === 0))
        setFinishedBooks(data.filter(b => b.finished))
      }
    }
    setLoading(false)
  }

  async function handleRating(bookId, rating) {
    await supabase.from('books').update({ rating }).eq('id', bookId)
    setFinishedBooks(prevFinished => prevFinished.map(b => b.id === bookId ? { ...b, rating } : b))
    setEditingRating(null)
  }

  async function handleDeleteBook(bookId) {
    const { error } = await supabase.from('books').delete().eq('id', bookId)
    if (!error) {
      setUnstartedBooks(prev => prev.filter(b => b.id !== bookId))
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#f8f6f2] flex items-center justify-center">
      <p className="text-stone-400 text-sm tracking-wide">cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f6f2] pb-36 antialiased" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* Blur superior fijo */}
      <div
        className="fixed top-0 left-0 right-0 z-35 h-24 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(248,246,242,1) 0%, rgba(248,246,242,0.8) 60%, transparent 100%)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          maskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 100%)',
        }}
      />

      {/* Blur inferior fijo */}
      <div
        className="fixed bottom-0 left-0 right-0 z-35 h-32 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(248,246,242,1) 0%, rgba(248,246,242,0.8) 60%, transparent 100%)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          maskImage: 'linear-gradient(to top, black 0%, black 40%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, black 0%, black 40%, transparent 100%)',
        }}
      />

      {/* Header idéntico a FEED */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between relative z-40">
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
      <div className="px-5 pb-5">
        <p className="text-[22px] font-bold text-stone-900 tracking-tight">
          Hola, {myProfile?.username || 'lector'} 👋
        </p>
        <p className="text-stone-400 text-[13px] mt-0.5 italic">Tu registro de lecturas personal</p>
      </div>

      {/* Contenido Principal Acotado como los Post */}
      <div className="max-w-md mx-auto px-5">

        {/* 1. BOTÓN AÑADIR OTRO LIBRO (Arriba del todo) */}
        <button
          onClick={() => navigate('/add-book')}
          className="w-full bg-white text-stone-700 hover:text-orange-600 border border-stone-200/60 hover:border-orange-200 font-bold rounded-2xl py-3.5 text-sm transition-all shadow-sm flex items-center justify-center gap-2 mb-6"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Añadir otro libro</span>
        </button>

        {/* 2. SECCIÓN: MI LISTA (Con título SVG) */}
        {unstartedBooks.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 text-stone-500 mb-3.5 px-1">
              <span className="text-xs font-black tracking-wider uppercase">Mi lista</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            
            <div className="space-y-3">
              {unstartedBooks.map(book => (
                <div key={book.id} className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm flex items-center gap-3.5">
                  {book.cover_url ? (
                    <img src={book.cover_url} alt={book.title} className="w-11 h-16 object-cover rounded-xl shadow-sm flex-shrink-0" />
                  ) : (
                    <div className={`w-11 h-16 rounded-xl flex items-center justify-center flex-shrink-0 ${GENRE_STYLES[book.genre]?.color || 'bg-stone-50'}`}>
                      <span className="text-xl">{GENRE_STYLES[book.genre]?.icon || '📖'}</span>
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-stone-900 text-[14px] truncate leading-tight">{book.title}</p>
                    <p className="text-stone-400 text-xs font-medium truncate mt-0.5">{book.author}</p>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <button
                      onClick={() => handleDeleteBook(book.id)}
                      className="text-stone-300 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50/50 transition-all"
                      title="Eliminar de mi lista"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>

                    <button
                      onClick={() => navigate(`/reading/${book.id}`)}
                      className="text-xs font-bold text-orange-500 bg-orange-50 hover:bg-orange-100 border border-orange-100/50 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
                    >
                      Empezar →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. LISTADO DE LIBROS ACTIVOS */}
        {books.length > 0 && (
          <div className="space-y-5 mb-8">
            <div className="flex items-center gap-2 text-stone-500 mb-1 px-1">
              <span className="text-xs font-black tracking-wider uppercase">Leyendo ahora</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {books.map(book => (
              <div key={book.id} className="bg-white rounded-3xl p-5 border border-stone-100 shadow-md">
                <div className="flex gap-4 mb-4">
                  <div className="relative flex-shrink-0">
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="w-16 h-24 object-cover rounded-xl shadow-md"
                      />
                    ) : (
                      <div className={`w-16 h-24 rounded-xl flex items-center justify-center text-3xl shadow-sm ${GENRE_STYLES[book.genre]?.color || 'bg-stone-50'}`}>
                        {GENRE_STYLES[book.genre]?.icon || '📖'}
                      </div>
                    )}
                    <div className="absolute -bottom-1.5 -right-1.5 bg-stone-900 rounded-lg px-1.5 py-0.5 shadow-sm border border-stone-800">
                      <span className="text-white text-[10px] font-black">
                        {Math.round((book.current_page / book.total_pages) * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block mb-1.5 ${GENRE_STYLES[book.genre]?.color || 'bg-stone-50'}`}>
                      {book.genre?.replace('_', ' ')}
                    </span>
                    <h3 className="font-black text-stone-900 text-base truncate leading-tight">{book.title}</h3>
                    <p className="text-stone-400 text-xs font-semibold truncate mt-0.5">{book.author}</p>
                    {book.year && <p className="text-stone-300 text-[11px] mt-1 font-medium">{book.year}</p>}
                  </div>
                </div>
                
                {/* Barra de Progreso adaptada de Feed */}
                <div className="w-full bg-stone-100 rounded-full h-2 relative flex items-center mt-2 mb-1">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      book.genre === 'fantasia' ? 'bg-purple-400' :
                      book.genre === 'ciencia_ficcion' ? 'bg-blue-400' :
                      book.genre === 'thriller' ? 'bg-red-400' :
                      book.genre === 'romance' ? 'bg-pink-400' :
                      book.genre === 'historica' ? 'bg-amber-400' :
                      book.genre === 'terror' ? 'bg-orange-400' :
                      book.genre === 'no_ficcion' ? 'bg-teal-400' :
                      book.genre === 'autobiografia' ? 'bg-green-400' :
                      'bg-stone-400'
                    }`}
                    style={{ width: `${Math.max(Math.min((book.current_page / book.total_pages) * 100, 100), 2)}%` }}
                  />
                  <span
                    className="absolute text-base leading-none transition-all duration-500 z-10"
                    style={{
                      left: `calc(${Math.min((book.current_page / book.total_pages) * 100, 96)}% - 8px)`,
                      top: '-7px'
                    }}
                  >
                    {GENRE_STYLES[book.genre]?.icon || '📖'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center mt-2.5">
                  <p className="text-stone-400 text-[11px] font-semibold">
                    Página <span className="text-stone-700 font-bold">{book.current_page}</span> de <span className="text-stone-700">{book.total_pages}</span>
                  </p>
                </div>

                <div className="flex gap-2.5 mt-4 pt-3.5 border-t border-stone-100/70">
                  <button
                    onClick={() => navigate(`/reading/${book.id}`)}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl py-2.5 text-xs tracking-wide transition-colors shadow-sm"
                  >
                    Registrar lectura
                  </button>
                  <button
                    onClick={() => navigate(`/notes/${book.id}`)}
                    className="flex-1 border border-stone-200/70 hover:border-stone-300 text-stone-500 font-bold rounded-xl py-2.5 text-xs tracking-wide transition-all bg-stone-50/40"
                  >
                    Mi diario
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Fallback si el usuario no tiene ningún libro metido en la base de datos */}
        {books.length === 0 && unstartedBooks.length === 0 && (
          <div className="bg-white rounded-3xl p-10 text-center border border-stone-100 shadow-sm mb-8">
            <p className="text-stone-400 text-sm font-medium">Tu estantería personal está vacía</p>
            <p className="text-stone-300 text-xs mt-1">Pulsa en añadir otro libro para empezar.</p>
          </div>
        )}

        {/* 4. LISTADO DE LIBROS TERMINADOS (Al final del todo) */}
        {finishedBooks.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 text-stone-400 mb-3.5 px-1">
              <span className="text-xs font-black tracking-wider uppercase">Libros terminados ✅</span>
            </div>
            
            <div className="space-y-3">
              {finishedBooks.map(book => (
                <div key={book.id} className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="w-12 h-18 object-cover rounded-xl shadow-sm"
                      />
                    ) : (
                      <div className={`w-12 h-18 rounded-xl flex items-center justify-center text-2xl ${GENRE_STYLES[book.genre]?.color || 'bg-stone-50'}`}>
                        {GENRE_STYLES[book.genre]?.icon || '📖'}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 bg-orange-500 rounded-md px-1 py-0.5 shadow-sm">
                      <span className="text-white text-[8px] font-black">100%</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-stone-900 text-[14px] truncate leading-tight">{book.title}</h3>
                    <p className="text-stone-400 text-xs font-medium truncate mt-0.5 mb-2">{book.author}</p>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            onClick={() => !book.rating || editingRating === book.id ? handleRating(book.id, star) : null}
                            className={`text-base transition-colors ${
                              star <= (book.rating || 0)
                                ? 'text-amber-400'
                                : book.rating && editingRating !== book.id
                                ? 'text-stone-200 cursor-default'
                                : 'text-stone-200 hover:text-amber-400'
                            }`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      
                      {book.rating && editingRating !== book.id && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingRating(book.id)}
                            className="text-stone-400 hover:text-stone-600 text-[10px] font-bold"
                          >
                            Editar
                          </button>
                          <span className="text-stone-200 text-xs">|</span>
                          <button
                            onClick={() => navigate(`/notes/${book.id}`)}
                            className="text-orange-500 hover:text-orange-600 text-[10px] font-bold"
                          >
                            Diario
                          </button>
                        </div>
                      )}
                      
                      {editingRating === book.id && (
                        <button
                          onClick={() => setEditingRating(null)}
                          className="text-stone-600 hover:text-stone-900 text-[10px] font-black uppercase tracking-wider bg-stone-100 px-2 py-0.5 rounded-md"
                        >
                          Listo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Navbar flotante idéntica a FEED (Con "Registro" Activo) */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-3 py-2 rounded-full border border-white/40"
        style={{
          background: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(24px) saturate(2)',
          WebkitBackdropFilter: 'blur(24px) saturate(2)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
          width: '85%',
          maxWidth: '360px',
        }}
      >
        {[
          {
            label: 'Inicio', path: '/feed', active: false,
            icon: () => (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
                <path d="M9 21V12h6v9"/>
              </svg>
            )
          },
          {
            label: 'Registro', path: '/home', active: true,
            icon: (active) => (
              <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                <line x1="9" y1="7" x2="15" y2="7"/>
                <line x1="9" y1="11" x2="15" y2="11"/>
              </svg>
            )
          },
          {
            label: 'Stats', path: '/stats', active: false,
            icon: () => (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            )
          },
          {
            label: 'Perfil', path: '/profile', active: false,
            icon: () => (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            )
          },
        ].map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex-1 py-2 flex flex-col items-center gap-1 rounded-full transition-all ${
              item.active
                ? 'text-orange-500'
                : 'text-stone-400 hover:text-stone-700'
            }`}
          >
            {item.icon(item.active)}
            <span className="text-[9px] font-semibold tracking-tight">{item.label}</span>
          </button>
        ))}
      </div>

    </div>
  )
}

export default Home