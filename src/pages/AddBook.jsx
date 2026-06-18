import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

const GENRES = [
  { value: 'fantasia', label: '🔮 Fantasía' },
  { value: 'ciencia_ficcion', label: '🚀 Ciencia ficción' },
  { value: 'thriller', label: '🔪 Thriller' },
  { value: 'romance', label: '💕 Romance' },
  { value: 'historica', label: '⚔️ Histórica' },
  { value: 'terror', label: '👻 Terror' },
  { value: 'no_ficcion', label: '📚 No ficción' },
  { value: 'autobiografia', label: '✍️ Autobiografía' },
  { value: 'otro', label: '📖 Otro' },
]

function AddBook() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [manual, setManual] = useState(false)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [totalPages, setTotalPages] = useState('')
  const [genre, setGenre] = useState('')
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState('')
  const navigate = useNavigate()

  // Debounce para búsqueda automática mientras el usuario escribe
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length > 2) {
        executeSearch()
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [query])

  async function fetchGoogleBooksCover(title, author) {
    try {
      const queryStr = encodeURIComponent(`${title} ${author}`)
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${queryStr}&maxResults=1`)
      const data = await res.json()
      const item = data.items?.[0]
      if (item?.volumeInfo?.imageLinks?.thumbnail) {
        return item.volumeInfo.imageLinks.thumbnail
          .replace('http://', 'https://')
          .replace('&zoom=1', '&zoom=3')
      }
    } catch (e) { return null }
    return null
  }

  // Centralizamos la lógica de búsqueda híbrida (Supabase + Open Library)
  async function executeSearch() {
    if (!query.trim()) return
    setSearching(true)

    try {
      // 1. Buscamos primero en nuestra base de datos local (Supabase)
      const { data: localBooks, error: dbError } = await supabase
        .from('books')
        .select('*')
        .ilike('title', `%${query}%`)
        .limit(5)

      if (dbError) console.error("Error al buscar en local:", dbError)

      // Si encontramos libros en nuestra BD, los formateamos con un tag distintivo [BD] u opcional
      let dbResults = []
      if (localBooks && localBooks.length > 0) {
        dbResults = localBooks.map(b => ({
          title: b.title,
          author: b.author,
          pages: b.total_pages,
          cover: b.cover_url,
          year: b.year,
          isLocal: true // Marcador para saber que ya existe en nuestra base de datos
        }))
      }

      // 2. Buscamos en Open Library para complementar o por si no hay en BD
      const res = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&limit=5`)
      const data = await res.json()
      
      const apiResults = await Promise.all((data.docs || []).map(async b => {
        let cover = b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : null
        if (!cover) {
          cover = await fetchGoogleBooksCover(b.title, b.author_name?.[0] || '')
        }
        return {
          title: b.title,
          author: b.author_name?.[0] || 'Autor desconocido',
          pages: b.number_of_pages_median || null,
          cover,
          year: b.first_publish_year || null,
          isLocal: false
        }
      }))

      // Unimos los resultados priorizando los de la base de datos local para evitar duplicados exactos
      const combinedResults = [...dbResults, ...apiResults].filter(
        (book, index, self) => 
          index === self.findIndex((t) => t.title.toLowerCase() === book.title.toLowerCase() && t.author.toLowerCase() === book.author.toLowerCase())
      )

      setResults(combinedResults.slice(0, 5))
    } catch (error) {
      console.error("Error global en búsqueda:", error)
    } finally {
      setSearching(false)
    }
  }

  function handleSelect(book) {
    setSelected(book)
    setTitle(book.title)
    setAuthor(book.author)
    setTotalPages(book.pages || '')
    setYear(book.year || '')
    setGenre(book.genre || '') // Si viene de BD local ya tiene género asignado
    setResults([])
    setQuery('')
  }

  function handleManual() {
    setManual(true)
    setSelected(null)
    setResults([])
    setQuery('')
  }

  async function handleAddBook() {
    if (!title || !author || !totalPages || !genre) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    // Si seleccionó un libro (sea de la API externa o ya registrado en local)
    if (selected) {
      const { data: newBook, error } = await supabase
        .from('books')
        .insert({
          user_id: user.id, // Se añade a la colección del usuario activo actual
          title,
          author,
          total_pages: parseInt(totalPages),
          current_page: 0,
          genre,
          cover_url: selected?.cover || null,
          year: year ? parseInt(year) : null,
          finished: false
        })
        .select()
        .single()

      if (!error && newBook) {
        // Le creamos su sesión inicial en 0 para que impacte el Feed/Registro de inmediato
        await supabase.from('reading_sessions').insert({
          user_id: user.id,
          book_id: newBook.id,
          pages_read: 0,
          minutes_read: 0
        })
        navigate('/home')
      }
    } else {
      // Si fue una creación totalmente manual va a moderación
      const { error } = await supabase.from('book_requests').insert({
        user_id: user.id,
        title,
        author,
        total_pages: parseInt(totalPages),
        genre,
        cover_url: null,
        status: 'pending'
      })
      if (!error) {
        navigate('/home')
        alert('Tu libro ha sido enviado para revisión. Lo añadiremos pronto.')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-stone-800">
        <button onClick={() => navigate('/home')} className="text-stone-400 hover:text-white transition-colors">
          ← Volver
        </button>
        <h1 className="text-lg font-semibold">Añadir libro</h1>
      </div>

      <div className="px-6 py-8 space-y-4">
        {!selected && !manual && (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Buscar libro por título..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && executeSearch()}
                className="flex-1 bg-stone-900 text-white placeholder-stone-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                onClick={executeSearch}
                className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl px-4 py-3 transition-colors"
              >
                {searching ? '...' : 'Buscar'}
              </button>
            </div>

            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((book, i) => (
                  <div
                    key={i}
                    onClick={() => handleSelect(book)}
                    className="flex items-center justify-between bg-stone-900 rounded-xl p-3 border border-stone-800 cursor-pointer hover:border-amber-500 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {book.cover ? (
                        <img src={book.cover} alt={book.title} className="w-10 h-14 object-cover rounded" />
                      ) : (
                        <div className="w-10 h-14 bg-stone-800 rounded flex items-center justify-center text-xl">📖</div>
                      )}
                      <div>
                        <p className="font-semibold text-sm">{book.title}</p>
                        <p className="text-stone-400 text-xs">{book.author}</p>
                        {book.pages && <p className="text-stone-500 text-xs">{book.pages} páginas</p>}
                      </div>
                    </div>
                    {book.isLocal && (
                      <span className="bg-green-500/10 text-green-400 text-[10px] font-bold px-2 py-1 rounded-md border border-green-500/20">
                        Catálogo
                      </span>
                    )}
                  </div>
                ))}
                <button
                  onClick={handleManual}
                  className="w-full text-stone-500 hover:text-amber-500 text-sm py-2 transition-colors"
                >
                  No encuentro mi libro → Añadirlo manualmente
                </button>
              </div>
            )}

            {results.length === 0 && query && !searching && (
              <button
                onClick={handleManual}
                className="w-full text-stone-500 hover:text-amber-500 text-sm py-2 transition-colors"
              >
                No encuentro mi libro → Añadirlo manualmente
              </button>
            )}
          </>
        )}

        {(selected || manual) && (
          <>
            {selected?.cover && (
              <div className="flex justify-center">
                <img src={selected.cover} alt={title} className="w-24 rounded-lg shadow-lg" />
              </div>
            )}

            <input
              type="text"
              placeholder="Título del libro"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-stone-900 text-white placeholder-stone-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              type="text"
              placeholder="Autor"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              className="w-full bg-stone-900 text-white placeholder-stone-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              type="number"
              placeholder="Número de páginas"
              value={totalPages}
              onChange={e => setTotalPages(e.target.value)}
              className="w-full bg-stone-900 text-white placeholder-stone-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              type="number"
              placeholder="Año de publicación (opcional)"
              value={year}
              onChange={e => setYear(e.target.value)}
              className="w-full bg-stone-900 text-white placeholder-stone-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
            />

            <div>
              <p className="text-stone-400 text-sm mb-3">Género</p>
              <div className="grid grid-cols-3 gap-2">
                {GENRES.map(g => (
                  <button
                    key={g.value}
                    onClick={() => setGenre(g.value)}
                    className={`py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                      genre === g.value
                        ? 'bg-amber-500 text-stone-950'
                        : 'bg-stone-900 text-stone-400 hover:bg-stone-800'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setSelected(null); setManual(false); setTitle(''); setAuthor(''); setTotalPages(''); setGenre(''); setYear('') }}
                className="flex-1 border border-stone-800 text-stone-400 font-semibold rounded-xl py-3 text-sm transition-colors hover:border-stone-600"
              >
                ← Volver a buscar
              </button>
              <button
                onClick={handleAddBook}
                disabled={loading || !genre || !title || !author || !totalPages}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl py-3 transition-colors disabled:opacity-50"
              >
                {loading ? 'Guardando...' : selected ? 'Guardar libro' : 'Enviar para revisión'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AddBook