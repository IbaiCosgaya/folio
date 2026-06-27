import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import { GENRES, getGenreStyle } from '../constants/genres'
import Navbar from '../components/layout/Navbar'

// Modo de búsqueda activo
const MODES = { title: 'título', author: 'autor', genre: 'género' }

function AddBook() {
  const [searchMode, setSearchMode] = useState('title')  // 'title' | 'author' | 'genre'
  const [query, setQuery] = useState('')
  const [authorQuery, setAuthorQuery] = useState('')
  const [genreFilter, setGenreFilter] = useState(null) // valor del género seleccionado como filtro
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchNote, setSearchNote] = useState('')
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

  // Dispara búsqueda automática cuando cambia el texto (debounce 500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const q = searchMode === 'author' ? authorQuery : query
      if (q.length > 2) executeSearch()
    }, 500)
    return () => clearTimeout(timer)
  }, [query, authorQuery, searchMode])

  // Búsqueda inmediata cuando se selecciona un género como filtro
  useEffect(() => {
    if (searchMode === 'genre' && genreFilter) executeSearch()
  }, [genreFilter])

  // ─── helpers anti-duplicados ────────────────────────────────────────────────

  async function addBookToLibrary(userId, bookId) {
    const { data: existing } = await supabase
      .from('user_books')
      .select('id, is_active')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .maybeSingle()

    if (existing) {
      if (existing.is_active) return { error: 'duplicate' }
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

  // ─── fuentes de búsqueda ────────────────────────────────────────────────────

  // Google Books: usa intitle:/inauthor: para resultados más relevantes
  async function searchGoogleBooks(googleQuery, signal) {
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
      const keyParam = apiKey ? `&key=${apiKey}` : ''
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(googleQuery)}&maxResults=8&langRestrict=es&orderBy=relevance${keyParam}`,
        { signal }
      )
      if (res.status === 429) {
        setSearchNote('Google Books temporalmente limitado, usando OpenLibrary.')
        return []
      }
      if (!res.ok) return []
      const data = await res.json()
      if (!data.items) return []
      return data.items
        .filter(item => {
          const info = item.volumeInfo || {}
          // Filtra resultados sin título limpio o que parezcan documentos académicos/legales
          return info.title && !['proceedings', 'journal', 'bulletin', 'actas', 'constitución'].some(
            w => info.title.toLowerCase().includes(w)
          )
        })
        .map(item => {
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
      if (e.name === 'AbortError') return []
      console.error('[Google Books] fallo de red:', e)
      return []
    }
  }

  async function searchOpenLibrary(olQuery, signal) {
    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(olQuery)}&limit=6`,
        { signal }
      )
      if (!res.ok) return []
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
      return []
    }
  }

  // ─── motor de búsqueda central ──────────────────────────────────────────────

  async function executeSearch() {
    if (searchAbortRef.current) searchAbortRef.current.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller
    setSearching(true)
    setSearchNote('')

    try {
      let dbQuery = supabase.from('global_books').select('*').limit(6)
      let googleQuery = ''
      let olQuery = ''

      if (searchMode === 'title' && query.trim().length > 2) {
        // intitle: fuerza coincidencia en el título, evita ruido de documentos académicos
        googleQuery = `intitle:${query.trim()}`
        olQuery = query.trim()
        dbQuery = dbQuery.ilike('title', `%${query.trim()}%`)

      } else if (searchMode === 'author' && authorQuery.trim().length > 2) {
        // inauthor: para encontrar todos los libros de un autor
        googleQuery = `inauthor:${authorQuery.trim()}`
        olQuery = `author:${authorQuery.trim()}`
        dbQuery = dbQuery.ilike('author', `%${authorQuery.trim()}%`)

      } else if (searchMode === 'genre' && genreFilter) {
        // Búsqueda por género: solo en catálogo local (las APIs externas no tienen taxonomía fiable)
        dbQuery = dbQuery.eq('genre', genreFilter)
        const { data: localBooks } = await dbQuery
        const flat = (localBooks || []).map(b => ({ ...b, pages: b.total_pages, cover: b.cover_url, isLocal: true }))
        setResults(flat)
        setSearching(false)
        return
      } else {
        setSearching(false)
        return
      }

      const [localBooksResult, googleResults, olResults] = await Promise.all([
        dbQuery,
        searchGoogleBooks(googleQuery, controller.signal),
        searchOpenLibrary(olQuery, controller.signal),
      ])

      if (controller.signal.aborted) return

      const dbResults = (localBooksResult.data || []).map(b => ({
        ...b,
        pages: b.total_pages,
        cover: b.cover_url,
        isLocal: true,
      }))

      const norm = s => (s || '').trim().toLowerCase()
      const seenKeys = new Set(dbResults.map(b => `${norm(b.title)}|${norm(b.author)}`))

      const filteredGoogle = googleResults.filter(b => {
        const key = `${norm(b.title)}|${norm(b.author)}`
        if (seenKeys.has(key)) return false
        seenKeys.add(key)
        return true
      })

      const filteredOL = olResults.filter(b => {
        const key = `${norm(b.title)}|${norm(b.author)}`
        if (seenKeys.has(key)) return false
        seenKeys.add(key)
        return true
      })

      setResults([...dbResults, ...filteredGoogle, ...filteredOL].slice(0, 10))
    } catch (err) {
      console.error('[executeSearch]', err)
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }

  // ─── handlers de selección ──────────────────────────────────────────────────

  async function handleSelect(book) {
    if (book.isLocal) {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await addBookToLibrary(user.id, book.id)
      setLoading(false)
      setResults([])
      setQuery('')
      if (!error) navigate('/home')
      else if (error === 'duplicate') alert('Ya tienes este libro en tu lista.')
      else alert('Hubo un error al añadir el libro.')
      return
    }
    setSelected(book)
    setTitle(book.title)
    setAuthor(book.author)
    setTotalPages(book.pages || '')
    setYear(book.year || '')
    setGenre(book.genre || '')
    setResults([])
    setQuery('')
    setAuthorQuery('')
  }

  function handleManual() {
    setManual(true)
    setSelected(null)
    setResults([])
  }

  function resetToSearch() {
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

    if (selected?.isLocal) {
      const { error } = await addBookToLibrary(user.id, selected.id)
      setLoading(false)
      if (!error) navigate('/home')
      else if (error === 'duplicate') alert('Ya tienes este libro en tu lista.')
      return
    }

    if (selected && !selected.isLocal) {
      let bookId = await findExistingGlobalBook(selected)
      if (!bookId) {
        const { data: inserted, error } = await supabase
          .from('global_books')
          .insert({
            google_books_id: selected.google_books_id || null,
            title, author, genre,
            cover_url: selected.cover || null,
            total_pages: parseInt(totalPages),
            year: year ? parseInt(year) : null,
            is_verified: true,
          })
          .select('id')
          .single()
        if (error) { setLoading(false); alert('Error al guardar el libro.'); return }
        bookId = inserted.id
      }
      const { error: ubError } = await addBookToLibrary(user.id, bookId)
      setLoading(false)
      if (!ubError) navigate('/home')
      else if (ubError === 'duplicate') alert('Ya tienes este libro en tu lista.')
      return
    }

    // Manual → a revisión
    const { error } = await supabase.from('book_requests').insert({
      user_id: user.id,
      title, author,
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

  // ─── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-32 antialiased" style={{ background: '#f8f6f2', fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/home')}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm border border-stone-200/60 text-stone-500 hover:text-stone-800 transition-colors"
        >
          ←
        </button>
        <div>
          <h1 className="text-[22px] font-black text-stone-900 tracking-tight leading-tight">Añadir libro</h1>
          <p className="text-stone-400 text-[13px]">Busca por título, autor o género</p>
        </div>
      </div>

      {/* Solo mostramos búsqueda cuando no hay selección ni modo manual */}
      {!selected && !manual && (
        <div className="px-5 space-y-4">

          {/* Selector de modo de búsqueda */}
          <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-stone-200/60 gap-1">
            {Object.entries(MODES).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => { setSearchMode(mode); setResults([]); setQuery(''); setAuthorQuery(''); setGenreFilter(null) }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                  searchMode === mode
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-700'
                }`}
              >
                {label.charAt(0).toUpperCase() + label.slice(1)}
              </button>
            ))}
          </div>

          {/* Input de texto (título o autor) */}
          {(searchMode === 'title' || searchMode === 'author') && (
            <div className="relative">
              <input
                type="text"
                placeholder={searchMode === 'title' ? 'Ej. El nombre del viento...' : 'Ej. Brandon Sanderson...'}
                value={searchMode === 'title' ? query : authorQuery}
                onChange={e => searchMode === 'title' ? setQuery(e.target.value) : setAuthorQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && executeSearch()}
                autoFocus
                className="w-full bg-white text-stone-800 placeholder-stone-400 rounded-2xl px-4 py-3.5 text-sm outline-none border border-stone-200/60 shadow-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all"
              />
              {searching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* Grid de géneros (modo género) */}
          {searchMode === 'genre' && (
            <div className="grid grid-cols-3 gap-2">
              {GENRES.map(g => {
                const Icon = g.icon
                const isSelected = genreFilter === g.value
                return (
                  <button
                    key={g.value}
                    onClick={() => setGenreFilter(isSelected ? null : g.value)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl text-xs font-semibold transition-all border ${
                      isSelected
                        ? `${g.badge} border-transparent shadow-sm scale-[1.02]`
                        : 'bg-white text-stone-500 border-stone-200/60 hover:border-stone-300'
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span className="text-center leading-tight">{g.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {searchNote && (
            <p className="text-amber-600 text-xs px-1">{searchNote}</p>
          )}

          {/* Resultados */}
          {results.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider px-1">
                {results.length} resultado{results.length !== 1 ? 's' : ''}
              </p>
              {results.map((book, i) => {
                const genreStyle = book.genre ? getGenreStyle(book.genre) : null
                const Icon = genreStyle?.icon
                return (
                  <div
                    key={book.isLocal ? `local-${book.id}` : `${book.source}-${book.google_books_id || book.title}-${i}`}
                    onClick={() => handleSelect(book)}
                    className="flex items-center gap-3 bg-white rounded-2xl p-3.5 border border-stone-100 shadow-sm cursor-pointer hover:shadow-md hover:border-orange-200 active:scale-[0.99] transition-all"
                  >
                    {/* Portada */}
                    {book.cover ? (
                      <img src={book.cover} alt={book.title} className="w-11 h-16 object-cover rounded-xl shadow-sm flex-shrink-0" />
                    ) : (
                      <div className={`w-11 h-16 rounded-xl flex items-center justify-center flex-shrink-0 ${genreStyle?.badge || 'bg-stone-100 text-stone-400'}`}>
                        {Icon && <Icon size={20} strokeWidth={1.8} />}
                      </div>
                    )}

                    {/* Datos */}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-stone-900 text-sm truncate leading-tight">{book.title}</p>
                      <p className="text-stone-400 text-xs font-medium truncate mt-0.5">{book.author}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {book.pages && (
                          <span className="text-stone-400 text-[10px]">{book.pages} págs.</span>
                        )}
                        {book.year && (
                          <span className="text-stone-400 text-[10px]">· {book.year}</span>
                        )}
                      </div>
                    </div>

                    {/* Badge */}
                    {book.isLocal ? (
                      <span className="flex-shrink-0 bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded-full border border-emerald-100">
                        Ya en Folio
                      </span>
                    ) : (
                      <svg className="flex-shrink-0 text-stone-300" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    )}
                  </div>
                )
              })}

              <button
                onClick={handleManual}
                className="w-full flex items-center justify-between bg-white hover:bg-stone-50 active:scale-[0.99] text-stone-700 rounded-2xl px-5 py-4 border border-stone-200/60 shadow-sm transition-all"
              >
                <div className="text-left">
                  <p className="text-sm font-bold leading-tight">No encuentro mi libro</p>
                  <p className="text-stone-400 text-xs mt-0.5">Añádelo manualmente</p>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-300 flex-shrink-0">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          )}

          {/* Estado vacío cuando no hay resultados */}
          {results.length === 0 && !searching && (
            (searchMode === 'title' && query.length > 2) ||
            (searchMode === 'author' && authorQuery.length > 2)
          ) && (
            <div className="space-y-2.5">
              <div className="bg-white rounded-2xl p-6 text-center border border-stone-100 shadow-sm">
                <p className="text-stone-500 text-sm font-semibold">Sin resultados para "{searchMode === 'title' ? query : authorQuery}"</p>
                <p className="text-stone-300 text-xs mt-1">Prueba con otro término o añádelo tú mismo</p>
              </div>
              <button
                onClick={handleManual}
                className="w-full flex items-center justify-between bg-stone-900 hover:bg-stone-800 active:scale-[0.99] text-white rounded-2xl px-5 py-4 shadow-sm transition-all"
              >
                <div className="text-left">
                  <p className="text-sm font-bold leading-tight">Añadir manualmente</p>
                  <p className="text-stone-400 text-xs mt-0.5">Rellena los datos tú mismo</p>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400 flex-shrink-0">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          )}

          {/* Estado vacío para modo género sin selección */}
          {searchMode === 'genre' && !genreFilter && results.length === 0 && (
            <p className="text-center text-stone-400 text-sm py-4">Selecciona un género para explorar tu catálogo</p>
          )}
        </div>
      )}

      {/* ─── Formulario de confirmación / manual ─────────────────────────────── */}
      {(selected || manual) && (
        <div className="px-5 space-y-3">

          {/* Portada seleccionada */}
          {selected?.cover && (
            <div className="flex justify-center mb-6">
              <div className="relative">
                <img src={selected.cover} alt={title} className="w-28 rounded-2xl shadow-xl" />
                <div className="absolute inset-0 rounded-2xl ring-1 ring-black/10" />
              </div>
            </div>
          )}

          {/* Contexto de lo que se está confirmando */}
          {selected && (
            <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm mb-1">
              <p className="text-[11px] text-stone-400 font-semibold uppercase tracking-wider mb-1">Confirma los datos</p>
              <p className="font-black text-stone-900 text-base leading-tight">{selected.title}</p>
              <p className="text-stone-400 text-sm mt-0.5">{selected.author}</p>
            </div>
          )}

          {manual && (
            <div className="bg-orange-50 rounded-2xl p-3.5 border border-orange-100 mb-1">
              <p className="text-orange-700 text-xs font-semibold">
                📋 Este libro se enviará a revisión antes de añadirse a tu lista.
              </p>
            </div>
          )}

          {/* Campos */}
          <input
            type="text"
            placeholder="Título"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-white text-stone-800 placeholder-stone-400 rounded-2xl px-4 py-3.5 text-sm outline-none border border-stone-200/60 shadow-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          />
          <input
            type="text"
            placeholder="Autor"
            value={author}
            onChange={e => setAuthor(e.target.value)}
            className="w-full bg-white text-stone-800 placeholder-stone-400 rounded-2xl px-4 py-3.5 text-sm outline-none border border-stone-200/60 shadow-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Páginas"
              value={totalPages}
              onChange={e => setTotalPages(e.target.value)}
              className="flex-1 bg-white text-stone-800 placeholder-stone-400 rounded-2xl px-4 py-3.5 text-sm outline-none border border-stone-200/60 shadow-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
            <input
              type="number"
              placeholder="Año (opcional)"
              value={year}
              onChange={e => setYear(e.target.value)}
              className="flex-1 bg-white text-stone-800 placeholder-stone-400 rounded-2xl px-4 py-3.5 text-sm outline-none border border-stone-200/60 shadow-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          {/* Selector de género */}
          <div>
            <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-2.5 px-1">Género</p>
            <div className="grid grid-cols-3 gap-2">
              {GENRES.map(g => {
                const Icon = g.icon
                const isSelected = genre === g.value
                return (
                  <button
                    key={g.value}
                    onClick={() => setGenre(g.value)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl text-xs font-semibold transition-all border ${
                      isSelected
                        ? `${g.badge} border-transparent shadow-sm`
                        : 'bg-white text-stone-500 border-stone-200/60 hover:border-stone-300'
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span className="text-center leading-tight">{g.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={resetToSearch}
              className="flex-1 bg-white text-stone-500 font-semibold rounded-2xl py-3.5 text-sm border border-stone-200/60 hover:border-stone-300 transition-all"
            >
              ← Volver
            </button>
            <button
              onClick={handleAddBook}
              disabled={loading || !genre || !title || !author || !totalPages}
              className="flex-1 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-2xl py-3.5 text-sm transition-all disabled:opacity-40 shadow-sm"
            >
              {loading ? 'Guardando...' : selected ? 'Añadir a mi lista' : 'Enviar para revisión'}
            </button>
          </div>
        </div>
      )}

      <Navbar active="/feed" />

    </div>
  )
}

export default AddBook