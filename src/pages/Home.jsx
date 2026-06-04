import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const GENRE_STYLES = {
  fantasia:        { color: 'bg-purple-500',   icon: '🔮' },
  ciencia_ficcion: { color: 'bg-blue-500',     icon: '🚀' },
  thriller:        { color: 'bg-red-500',      icon: '🔪' },
  romance:         { color: 'bg-pink-500',     icon: '💕' },
  historica:       { color: 'bg-yellow-600',   icon: '⚔️' },
  terror:          { color: 'bg-orange-600',   icon: '👻' },
  no_ficcion:      { color: 'bg-teal-500',     icon: '📚' },
  autobiografia:   { color: 'bg-green-500',    icon: '✍️' },
  otro:            { color: 'bg-stone-500',    icon: '📖' },
}

function Home() {
  const [books, setBooks] = useState([])
  const [finishedBooks, setFinishedBooks] = useState([])
  const [user, setUser] = useState(null)
  const navigate = useNavigate()
  const [editingRating, setEditingRating] = useState(null)

  useEffect(() => {
    fetchBooks()
  }, [])

  async function fetchBooks() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    const { data } = await supabase.from('books').select('*')
    if (data) {
      setBooks(data.filter(b => !b.finished))
      setFinishedBooks(data.filter(b => b.finished))
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  async function handleRating(bookId, rating) {
    await supabase.from('books').update({ rating }).eq('id', bookId)
    setFinishedBooks(prevFinished => prevFinished.map(b => b.id === bookId ? { ...b, rating } : b))
    setEditingRating(null)
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white">

      {/* Nuevo Header / Navbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
        <h1 className="text-xl font-bold tracking-tight">folio</h1>
        <div className="flex items-center gap-4">
          {user?.id === '581dd0d6-6240-461a-90b7-224f74d577ab' && (
            <button
              onClick={() => navigate('/admin')}
              className="text-amber-500 hover:text-amber-400 text-sm transition-colors"
            >
              Moderación
            </button>
          )}
          <button
            onClick={handleLogout}
            className="text-stone-400 hover:text-white text-sm transition-colors"
          >
            Salir
          </button>
        </div>
      </div>

      {/* Nuevos Tabs de Navegación */}
      <div className="flex border-b border-stone-800">
        <button
          onClick={() => navigate('/feed')}
          className="flex-1 py-3 text-sm font-semibold text-stone-400 hover:text-white transition-colors"
        >
          Inicio
        </button>
        <button className="flex-1 py-3 text-sm font-semibold text-white border-b-2 border-amber-500">
          Registro
        </button>
        <button
          onClick={() => navigate('/stats')}
          className="flex-1 py-3 text-sm font-semibold text-stone-400 hover:text-white transition-colors"
        >
          Estadísticas
        </button>
        <button
          onClick={() => navigate('/profile')}
          className="flex-1 py-3 text-sm font-semibold text-stone-400 hover:text-white transition-colors"
        >
          Perfil
        </button>
      </div>

      {/* Contenido Principal */}
      <div className="px-6 py-8">
        <h2 className="text-2xl font-semibold mb-1">Hola 👋</h2>
        <p className="text-stone-400 text-sm mb-8">¿Qué estás leyendo hoy?</p>

        {/* Listado de Libros Activos */}
        {books.length === 0 ? (
          <div className="bg-stone-900 rounded-2xl p-6 text-center border border-stone-800">
            <p className="text-stone-400 text-sm">No tienes libros en curso</p>
            <button
              onClick={() => navigate('/add-book')}
              className="mt-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl px-6 py-2 text-sm transition-colors"
            >
              + Añadir libro
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {books.map(book => (
              <div key={book.id} className="bg-stone-900 rounded-2xl p-5 border border-stone-800">
                <div className="flex gap-4 mb-3">
                  <div className="relative flex-shrink-0">
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="w-16 h-24 object-cover rounded-lg shadow-lg"
                      />
                    ) : (
                      <div className={`w-16 h-24 rounded-lg flex items-center justify-center text-3xl ${GENRE_STYLES[book.genre]?.color || 'bg-stone-700'}`}>
                        {GENRE_STYLES[book.genre]?.icon || '📖'}
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 rounded-md px-1.5 py-0.5">
                      <span className="text-white text-xs font-bold">
                        {Math.round((book.current_page / book.total_pages) * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{book.title}</h3>
                    <p className="text-stone-400 text-sm">{book.author}</p>
                    <p className="text-stone-600 text-xs mt-1">
                      {[GENRE_STYLES[book.genre] ? book.genre.replace('_', ' ') : null, book.year].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                
                {/* Barra de Progreso */}
                <div className="w-full bg-stone-800 rounded-full h-2 relative">
                  <div
                    className={`${GENRE_STYLES[book.genre]?.color || 'bg-amber-500'} h-2 rounded-full transition-all relative`}
                    style={{ width: `${Math.max((book.current_page / book.total_pages) * 100, 2)}%` }}
                  >
                    <span className="absolute -right-4 -top-4 text-2xl">
                      {GENRE_STYLES[book.genre]?.icon || '📖'}
                    </span>
                  </div>
                </div>
                
                <p className="text-stone-500 text-xs mt-2">
                  Página {book.current_page} de {book.total_pages}
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => navigate(`/reading/${book.id}`)}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl py-2 text-sm transition-colors"
                  >
                    Registrar lectura
                  </button>
                  <button
                    onClick={() => navigate(`/notes/${book.id}`)}
                    className="border border-stone-800 hover:border-amber-500 text-stone-400 hover:text-amber-500 font-semibold rounded-xl px-4 py-2 text-sm transition-colors"
                  >
                    Mi diario
                  </button>
                </div>
              </div>
            ))}
            
            <button
              onClick={() => navigate('/add-book')}
              className="w-full border border-stone-800 hover:border-amber-500 text-stone-400 hover:text-amber-500 font-semibold rounded-xl py-3 text-sm transition-colors"
            >
              + Añadir otro libro
            </button>
          </div>
        )}

        {/* Listado de Libros Terminados */}
        {finishedBooks.length > 0 && (
          <div className="mt-8">
            <p className="text-stone-400 text-sm mb-3">Libros terminados ✅</p>
            <div className="space-y-3">
              {finishedBooks.map(book => (
                <div key={book.id} className="bg-stone-900 rounded-2xl p-4 border border-stone-800 flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="w-12 h-18 object-cover rounded-lg shadow-lg"
                      />
                    ) : (
                      <div className={`w-12 h-18 rounded-lg flex items-center justify-center text-2xl ${GENRE_STYLES[book.genre]?.color || 'bg-stone-700'}`}>
                        {GENRE_STYLES[book.genre]?.icon || '📖'}
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 rounded-md px-1 py-0.5">
                      <span className="text-white text-xs font-bold">100%</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{book.title}</h3>
                    <p className="text-stone-400 text-sm mb-2">{book.author}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            onClick={() => !book.rating || editingRating === book.id ? handleRating(book.id, star) : null}
                            className={`text-xl transition-colors ${
                              star <= (book.rating || 0)
                                ? 'text-amber-500'
                                : book.rating && editingRating !== book.id
                                ? 'text-stone-700 cursor-default'
                                : 'text-stone-700 hover:text-amber-400'
                            }`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      {book.rating && editingRating !== book.id && (
                        <>
                          <button
                            onClick={() => setEditingRating(book.id)}
                            className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
                          >
                            Cambiar
                          </button>
                          {/* Botón Mi diario añadido aquí */}
                          <button
                            onClick={() => navigate(`/notes/${book.id}`)}
                            className="text-stone-500 hover:text-amber-500 text-xs transition-colors ml-2"
                          >
                            Mi diario
                          </button>
                        </>
                      )}
                      {editingRating === book.id && (
                        <button
                          onClick={() => setEditingRating(null)}
                          className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
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
    </div>
  )
}

export default Home