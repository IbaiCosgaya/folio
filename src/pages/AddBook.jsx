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
      if (query.length > 2) executeSearch()
    }, 500)
    return () => clearTimeout(timer)
  }, [query])

  // --- Evita duplicados: si el usuario ya tiene este book_id en su estantería,
  // reutiliza/reactiva esa fila en vez de crear una nueva ---
  async function addBookToLibrary(userId, bookId) {
    const { data: existing } = await supabase
      .from('user_books')
      .select('id, is_active')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .maybeSingle()

    if (existing) {
      if (existing.is_active) {
        return { error: 'duplicate' }
      }
      // Estaba desactivado (lo habías quitado de tu lista) → lo reactivamos
      const { error } = await supabase
        .from('user_books')
        .update({ is_active: true, current_page: 0, finished: false })
        .eq('id', existing.id)
      return { error: error ? error.message : null }
    }

    const { error } = await supabase.from('user_books').insert({
      user_id: userId,
      book_id: bookId,
      current_page: 0,
      finished: false,
      is_active: true,
    })
    return { error: error ? error.message : null }
  }

  // --- Búsqueda en Google Books, con fallback a OpenLibrary si falta portada ---
  async function fetchOpenLibraryCover(title, author) {
    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(`${title} ${author || ''}`)}&limit=1`
      )
      const data = await res.json()
      const coverId = data.docs?.[0]?.cover_i
      return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null
    } catch (e) {
      return null
    }
  }

  async function searchGoogleBooks(q) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=6`
      )
      const data = await res.json()
      if (!data.items) return []
      return Promise.all(data.items.map(async item => {
        const info = item.volumeInfo || {}
        let cover = info.imageLinks?.thumbnail
          ? info.imageLinks.thumbnail.replace('http://', 'https://').replace('zoom=1', 'zoom=2')
          : null

        // Google Books no siempre trae portada — probamos OpenLibrary como respaldo
        if (!cover) {
          cover = await fetchOpenLibraryCover(info.title, info.authors?.[0])
        }

        return {
          google_books_id: item.id,
          title: info.title,
          author: info.authors?.[0] || 'Autor desconocido',
          pages: info.pageCount || null,
          cover,
          year: info.publishedDate ? parseInt(info.publishedDate.slice(0, 4)) : null,
          isLocal: false,
        }
      }))
    } catch (e) {
      return []
    }
  }

  // --- Búsqueda híbrida: catálogo local primero, luego Google Books ---
  async function executeSearch() {
    if (!query.trim()) return
    setSearching(true)

    try {
      const { data: localBooks, error: dbError } = await supabase
        .from('global_books')
        .select('*')
        .ilike('title', `%${query}%`)
        .limit(6)

      if (dbError) console.error('Error al buscar en local:', dbError)

      const dbResults = (localBooks || []).map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        pages: b.total_pages,
        cover: b.cover_url,
        year: b.year,
        genre: b.genre,
        isLocal: true,
      }))

      const apiResults = await searchGoogleBooks(query)

      // Evitamos mostrar duplicados visuales: si Google Books trae algo que
      // ya tenemos en el catálogo (mismo título+autor), nos quedamos con la
      // versión local (marcada "Ya en Folio") y descartamos la de la API.
      const norm = s => (s || '').trim().toLowerCase()
      const localKeys = new Set(dbResults.map(b => `${norm(b.title)}|${norm(b.author)}`))
      const filteredApiResults = apiResults.filter(
        b => !localKeys.has(`${norm(b.title)}|${norm(b.author)}`)
      )

      setResults([...dbResults, ...filteredApiResults].slice(0, 8))
    } catch (error) {
      console.error('Error global en búsqueda:', error)
    } finally {
      setSearching(false)
    }
  }

  async function handleSelect(book) {
    // Si el libro ya está en nuestro catálogo (verificado o aprobado), se añade
    // directamente a la estantería: no tiene sentido volver a pedir sus datos.
    if (book.isLocal) {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await addBookToLibrary(user.id, book.id)
      setLoading(false)
      setResults([])
      setQuery('')
      if (!error) {
        navigate('/home')
      } else if (error === 'duplicate') {
        alert('Ya tienes este libro en tu lista.')
      } else {
        alert('Hubo un error al añadir el libro.')
      }
      return
    }

    // Libro de Google Books o candidato a manual: sí necesita pasar por el formulario
    setSelected(book)
    setTitle(book.title)
    setAuthor(book.author)
    setTotalPages(book.pages || '')
    setYear(book.year || '')
    setGenre(book.genre || '')
    setResults([])
    setQuery('')
  }

  function handleManual() {
    setManual(true)
    setSelected(null)
    setResults([])
    setQuery('')
  }

  function resetForm() {
    setSelected(null)
    setManual(false)
    setTitle('')
    setAuthor('')
    setTotalPages('')
    setGenre('')
    setYear('')
  }

  async function handleAddBook() {
    if (!title || !author || !totalPages || !genre) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    // --- Caso 1: libro venido de Google Books, aún no está en el catálogo ---
    if (selected && !selected.isLocal) {
      // Por si dos usuarios lo añaden casi a la vez, comprobamos antes de insertar
      const { data: existing } = await supabase
        .from('global_books')
        .select('id')
        .eq('google_books_id', selected.google_books_id)
        .maybeSingle()

      let bookId = existing?.id

      if (!bookId) {
        const { data: inserted, error } = await supabase
          .from('global_books')
          .insert({
            google_books_id: selected.google_books_id,
            title,
            author,
            genre,
            cover_url: selected.cover || null,
            total_pages: parseInt(totalPages),
            year: year ? parseInt(year) : null,
            is_verified: true,
          })
          .select('id')
          .single()
        if (error) { setLoading(false); return }
        bookId = inserted.id
      }

      const { error: ubError } = await addBookToLibrary(user.id, bookId)
      setLoading(false)
      if (!ubError) {
        navigate('/home')
      } else if (ubError === 'duplicate') {
        alert('Ya tienes este libro en tu lista.')
      } else {
        alert('Hubo un error al añadir el libro.')
      }
      return
    }

    // --- Caso 3: añadido manualmente, no encontrado en ningún sitio ---
    // No toca global_books directamente: va a revisión del moderador.
    const { error } = await supabase.from('book_requests').insert({
      user_id: user.id,
      title,
      author,
      total_pages: parseInt(totalPages),
      genre,
      year: year ? parseInt(year) : null,
      cover_url: null,
      status: 'pending',
    })
    setLoading(false)
    if (!error) {
      navigate('/home')
      alert('Tu libro ha sido enviado para revisión. Lo añadiremos pronto a tu lista.')
    }
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
                    key={book.isLocal ? `local-${book.id}` : `google-${book.google_books_id || i}`}
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
                        Ya en Folio
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
                onClick={resetForm}
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