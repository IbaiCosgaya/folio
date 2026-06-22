import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import { GENRES } from '../constants/genres'

function AddBook() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchNote, setSearchNote] = useState('') // aviso no bloqueante (ej. límite de Google alcanzado)
  const [selected, setSelected] = useState(null)
  const [manual, setManual] = useState(false)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [totalPages, setTotalPages] = useState('')
  const [genre, setGenre] = useState('')
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState('')
  const navigate = useNavigate()
  const searchAbortRef = useRef(null)

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

  // --- Fuente 1: Google Books ---
  // Si defines VITE_GOOGLE_BOOKS_API_KEY en tu .env, se usa una cuota privada
  // mucho más alta que la anónima compartida (que se agota fácilmente con 429).
  async function searchGoogleBooks(q, signal) {
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
      const keyParam = apiKey ? `&key=${apiKey}` : ''
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=6${keyParam}`,
        { signal }
      )

      if (res.status === 429) {
        console.error('[Google Books] límite de peticiones alcanzado (429)')
        setSearchNote('Google Books está temporalmente limitado, mostrando resultados de OpenLibrary.')
        return []
      }
      if (!res.ok) {
        console.error('[Google Books] respuesta no OK:', res.status, res.statusText)
        return []
      }

      const data = await res.json()
      if (!data.items) return []

      return data.items.map(item => {
        const info = item.volumeInfo || {}
        return {
          source: 'google',
          google_books_id: item.id,
          title: info.title,
          author: info.authors?.[0] || 'Autor desconocido',
          pages: info.pageCount || null,
          cover: info.imageLinks?.thumbnail
            ? info.imageLinks.thumbnail.replace('http://', 'https://').replace('zoom=1', 'zoom=2')
            : null,
          year: info.publishedDate ? parseInt(info.publishedDate.slice(0, 4)) : null,
          isLocal: false,
        }
      })
    } catch (e) {
      if (e.name === 'AbortError') return [] // búsqueda cancelada porque escribiste algo más, no es un fallo real
      console.error('[Google Books] fallo de red:', e)
      return []
    }
  }

  // --- Fuente 2: OpenLibrary (no necesita clave, sirve de respaldo si Google falla) ---
  async function searchOpenLibrary(q, signal) {
    try {
      const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=6`, { signal })
      if (!res.ok) {
        console.error('[OpenLibrary] respuesta no OK:', res.status, res.statusText)
        return []
      }
      const data = await res.json()
      return (data.docs || []).map(b => ({
        source: 'openlibrary',
        google_books_id: null,
        title: b.title,
        author: b.author_name?.[0] || 'Autor desconocido',
        pages: b.number_of_pages_median || null,
        cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : null,
        year: b.first_publish_year || null,
        isLocal: false,
      }))
    } catch (e) {
      if (e.name === 'AbortError') return []
      console.error('[OpenLibrary] fallo de red:', e)
      return []
    }
  }

  // --- Búsqueda híbrida: catálogo local + Google Books + OpenLibrary en paralelo ---
  async function executeSearch() {
    if (!query.trim()) return

    // Cancela cualquier búsqueda anterior todavía en vuelo (escribiste otra letra antes de que terminara)
    if (searchAbortRef.current) searchAbortRef.current.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller

    setSearching(true)
    setSearchNote('')

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

      const [googleResults, openLibraryResults] = await Promise.all([
        searchGoogleBooks(query, controller.signal),
        searchOpenLibrary(query, controller.signal),
      ])

      // Si esta búsqueda fue cancelada mientras esperábamos, no pisamos los
      // resultados de la búsqueda más reciente que ya está en marcha
      if (controller.signal.aborted) return

      // Deduplicado por título+autor normalizados: local > Google > OpenLibrary
      const norm = s => (s || '').trim().toLowerCase()
      const seenKeys = new Set(dbResults.map(b => `${norm(b.title)}|${norm(b.author)}`))

      const filteredGoogle = googleResults.filter(b => {
        const key = `${norm(b.title)}|${norm(b.author)}`
        if (seenKeys.has(key)) return false
        seenKeys.add(key)
        return true
      })

      const filteredOpenLibrary = openLibraryResults.filter(b => {
        const key = `${norm(b.title)}|${norm(b.author)}`
        if (seenKeys.has(key)) return false
        seenKeys.add(key)
        return true
      })

      setResults([...dbResults, ...filteredGoogle, ...filteredOpenLibrary].slice(0, 10))
    } catch (error) {
      console.error('Error global en búsqueda:', error)
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }

  function handleSelect(book) {
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

  // Busca un libro ya existente en global_books por google_books_id (si lo hay)
  // o, si no, por título+autor (necesario para resultados de OpenLibrary, que no
  // traen un id estable) — evita crear catálogo duplicado.
  async function findExistingGlobalBook(book) {
    if (book.google_books_id) {
      const { data } = await supabase
        .from('global_books')
        .select('id')
        .eq('google_books_id', book.google_books_id)
        .maybeSingle()
      if (data) return data.id
    }
    const { data } = await supabase
      .from('global_books')
      .select('id')
      .ilike('title', book.title)
      .ilike('author', book.author || '')
      .maybeSingle()
    return data?.id || null
  }

  async function handleAddBook() {
    if (!title || !author || !totalPages || !genre) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    // --- Caso 1: libro ya existente en el catálogo local ---
    if (selected?.isLocal) {
      const { error } = await addBookToLibrary(user.id, selected.id)
      setLoading(false)
      if (!error) navigate('/home')
      else if (error === 'duplicate') alert('Ya tienes este libro en tu lista.')
      else alert('Hubo un error al añadir el libro.')
      return
    }

    // --- Caso 2: libro de Google Books u OpenLibrary, puede que ya esté en el catálogo ---
    if (selected && !selected.isLocal) {
      let bookId = await findExistingGlobalBook(selected)

      if (!bookId) {
        const { data: inserted, error } = await supabase
          .from('global_books')
          .insert({
            google_books_id: selected.google_books_id || null,
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
        if (error) { setLoading(false); alert('Hubo un error al guardar el libro.'); return }
        bookId = inserted.id
      }

      const { error: ubError } = await addBookToLibrary(user.id, bookId)
      setLoading(false)
      if (!ubError) navigate('/home')
      else if (ubError === 'duplicate') alert('Ya tienes este libro en tu lista.')
      else alert('Hubo un error al añadir el libro.')
      return
    }

    // --- Caso 3: añadido manualmente, no encontrado en ningún sitio → a revisión ---
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

            {searchNote && (
              <p className="text-amber-500/80 text-xs px-1">{searchNote}</p>
            )}

            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((book, i) => (
                  <div
                    key={book.isLocal ? `local-${book.id}` : `${book.source}-${book.google_books_id || book.title}-${i}`}
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
                {GENRES.map(g => {
                  const Icon = g.icon
                  return (
                    <button
                      key={g.value}
                      onClick={() => setGenre(g.value)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-colors ${
                        genre === g.value
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-stone-900 text-stone-400 hover:bg-stone-800'
                      }`}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                      <span className="text-center leading-tight">{g.label}</span>
                    </button>
                  )
                })}
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