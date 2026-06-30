// src/pages/AddBook.jsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import { GENRES, getGenreStyle } from '../constants/genres'
import Navbar from '../components/layout/Navbar'

const MODES = { title: 'Título', author: 'Autor', genre: 'Género' }

// ── Shared primitives ─────────────────────────────────────────────────────────

const baseInput = {
  width: '100%',
  background: 'white',
  border: '0.5px solid rgba(26,23,20,0.10)',
  borderRadius: '14px',
  padding: '13px 16px',
  fontSize: '14px',
  color: '#1a1714',
  fontFamily: "'Inter', -apple-system, sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
  letterSpacing: '-0.01em',
}

function Input({ type = 'text', placeholder, value, onChange, autoFocus, onKeyDown }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      autoFocus={autoFocus}
      onKeyDown={onKeyDown}
      style={baseInput}
    />
  )
}

function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '36px', height: '36px', borderRadius: '50%',
        background: 'white', border: '0.5px solid rgba(26,23,20,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#9c9490', flexShrink: 0,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AddBook() {
  const [searchMode, setSearchMode] = useState('title')
  const [query, setQuery] = useState('')
  const [authorQuery, setAuthorQuery] = useState('')
  const [genreFilter, setGenreFilter] = useState(null)
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
  const [description, setDescription] = useState('')
  const navigate = useNavigate()
  const searchAbortRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      const q = searchMode === 'author' ? authorQuery : query
      if (q.length > 2) executeSearch()
    }, 500)
    return () => clearTimeout(timer)
  }, [query, authorQuery, searchMode])

  useEffect(() => {
    if (searchMode === 'genre' && genreFilter) executeSearch()
  }, [genreFilter])

  // ── Library helpers ──────────────────────────────────────────────────────────

  async function addBookToLibrary(userId, bookId) {
    const { data: existing } = await supabase
      .from('user_books').select('id, is_active')
      .eq('user_id', userId).eq('book_id', bookId).maybeSingle()

    if (existing) {
      if (existing.is_active) return { error: 'duplicate' }
      const { error } = await supabase.from('user_books')
        .update({ is_active: true, current_page: 0, finished: false }).eq('id', existing.id)
      return { error: error ? error.message : null }
    }

    const { error } = await supabase.from('user_books').insert({
      user_id: userId, book_id: bookId,
      current_page: 0, finished: false, is_active: true,
    })
    return { error: error ? error.message : null }
  }

  async function findExistingGlobalBook(book) {
    if (book.google_books_id) {
      const { data } = await supabase.from('global_books').select('id')
        .eq('google_books_id', book.google_books_id).maybeSingle()
      if (data) return data.id
    }
    const { data } = await supabase.from('global_books').select('id')
      .ilike('title', book.title).ilike('author', book.author || '').maybeSingle()
    return data?.id || null
  }

  // ── Search sources ───────────────────────────────────────────────────────────

  async function searchGoogleBooks(googleQuery, signal) {
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
      const keyParam = apiKey ? `&key=${apiKey}` : ''
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(googleQuery)}&maxResults=8&langRestrict=es&orderBy=relevance${keyParam}`,
        { signal }
      )
      if (res.status === 429) { setSearchNote('Google Books temporalmente limitado, usando OpenLibrary.'); return [] }
      if (!res.ok) return []
      const data = await res.json()
      if (!data.items) return []
      return data.items
        .filter(item => {
          const info = item.volumeInfo || {}
          return info.title && !['proceedings', 'journal', 'bulletin', 'actas', 'constitución']
            .some(w => info.title.toLowerCase().includes(w))
        })
        .map(item => {
          const info = item.volumeInfo || {}
          return {
            source: 'google', google_books_id: item.id,
            title: info.title, author: info.authors?.[0] || 'Autor desconocido',
            pages: info.pageCount || null,
            cover: info.imageLinks?.thumbnail
              ? info.imageLinks.thumbnail.replace('http://', 'https://').replace('zoom=1', 'zoom=2')
              : null,
            year: info.publishedDate ? parseInt(info.publishedDate.slice(0, 4)) : null,
            description: info.description || null,
            isLocal: false,
          }
        })
    } catch (e) {
      if (e.name === 'AbortError') return []
      return []
    }
  }

  async function searchOpenLibrary(olQuery, signal) {
    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(olQuery)}&limit=6`, { signal })
      if (!res.ok) return []
      const data = await res.json()
      return (data.docs || []).map(b => ({
        source: 'openlibrary', google_books_id: null,
        title: b.title, author: b.author_name?.[0] || 'Autor desconocido',
        pages: b.number_of_pages_median || null,
        cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : null,
        year: b.first_publish_year || null,
        description: b.first_sentence?.[0] || null,
        isLocal: false,
      }))
    } catch (e) {
      if (e.name === 'AbortError') return []
      return []
    }
  }

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
        googleQuery = `intitle:${query.trim()}`
        olQuery = query.trim()
        dbQuery = dbQuery.ilike('title', `%${query.trim()}%`)
      } else if (searchMode === 'author' && authorQuery.trim().length > 2) {
        googleQuery = `inauthor:${authorQuery.trim()}`
        olQuery = `author:${authorQuery.trim()}`
        dbQuery = dbQuery.ilike('author', `%${authorQuery.trim()}%`)
      } else if (searchMode === 'genre' && genreFilter) {
        dbQuery = dbQuery.eq('genre', genreFilter)
        const { data: localBooks } = await dbQuery
        setResults((localBooks || []).map(b => ({ ...b, pages: b.total_pages, cover: b.cover_url, isLocal: true })))
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
        ...b, pages: b.total_pages, cover: b.cover_url, isLocal: true,
      }))

      const norm = s => (s || '').trim().toLowerCase()
      const seenKeys = new Set(dbResults.map(b => `${norm(b.title)}|${norm(b.author)}`))

      const filteredGoogle = googleResults.filter(b => {
        const key = `${norm(b.title)}|${norm(b.author)}`
        if (seenKeys.has(key)) return false
        seenKeys.add(key); return true
      })
      const filteredOL = olResults.filter(b => {
        const key = `${norm(b.title)}|${norm(b.author)}`
        if (seenKeys.has(key)) return false
        seenKeys.add(key); return true
      })

      setResults([...dbResults, ...filteredGoogle, ...filteredOL].slice(0, 10))
    } catch (err) {
      console.error('[executeSearch]', err)
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }

  // ── Selection handlers ───────────────────────────────────────────────────────

  async function handleSelect(book) {
    if (book.isLocal) {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await addBookToLibrary(user.id, book.id)
      setLoading(false)
      setResults([]); setQuery('')
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
    setDescription(book.description || '')
    setResults([]); setQuery(''); setAuthorQuery('')
  }

  function handleManual() { setManual(true); setSelected(null); setResults([]) }

  function resetToSearch() {
    setSelected(null); setManual(false)
    setTitle(''); setAuthor(''); setTotalPages(''); setGenre(''); setYear(''); setDescription('')
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
        const { data: inserted, error } = await supabase.from('global_books')
          .insert({
            google_books_id: selected.google_books_id || null,
            title, author, genre,
            cover_url: selected.cover || null,
            total_pages: parseInt(totalPages),
            year: year ? parseInt(year) : null,
            description: description.trim() || null,
            is_verified: true,
          })
          .select('id').single()
        if (error) { setLoading(false); alert('Error al guardar el libro.'); return }
        bookId = inserted.id
      }
      const { error: ubError } = await addBookToLibrary(user.id, bookId)
      setLoading(false)
      if (!ubError) navigate('/home')
      else if (ubError === 'duplicate') alert('Ya tienes este libro en tu lista.')
      return
    }

    // Manual → pending review
    const { error } = await supabase.from('book_requests').insert({
      user_id: user.id, title, author,
      total_pages: parseInt(totalPages), genre,
      year: year ? parseInt(year) : null,
      description: description.trim() || null,
      cover_url: null, status: 'pending',
    })
    setLoading(false)
    if (!error) {
      navigate('/home')
      alert('Tu libro ha sido enviado para revisión. Lo añadiremos pronto a tu lista.')
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f6f2', paddingBottom: '100px',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>

      {/* Top blur */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '80px', zIndex: 30,
        background: 'linear-gradient(to bottom, rgba(248,246,242,1) 0%, rgba(248,246,242,0.8) 60%, transparent 100%)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '52px 20px 20px',
      }}>
        <BackButton onClick={() => navigate('/home')} />
        <div>
          <h1 style={{
            fontSize: '22px', fontWeight: 800, color: '#1a1714',
            letterSpacing: '-0.025em', lineHeight: 1.15,
          }}>
            Añadir libro
          </h1>
          <p style={{ fontSize: '13px', color: '#9c9490', marginTop: '2px' }}>
            Busca por título, autor o género
          </p>
        </div>
      </div>

      {/* Search view */}
      {!selected && !manual && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Mode selector */}
          <div style={{
            display: 'flex', background: 'white', borderRadius: '16px',
            border: '0.5px solid rgba(26,23,20,0.08)', padding: '4px', gap: '4px',
          }}>
            {Object.entries(MODES).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => { setSearchMode(mode); setResults([]); setQuery(''); setAuthorQuery(''); setGenreFilter(null) }}
                style={{
                  flex: 1, padding: '9px 4px', borderRadius: '12px',
                  border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600,
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  background: searchMode === mode ? '#1a1714' : 'transparent',
                  color: searchMode === mode ? '#f8f6f2' : '#9c9490',
                  transition: 'all 180ms ease',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Text input */}
          {(searchMode === 'title' || searchMode === 'author') && (
            <div style={{ position: 'relative' }}>
              <Input
                placeholder={searchMode === 'title' ? 'Ej. El nombre del viento…' : 'Ej. Brandon Sanderson…'}
                value={searchMode === 'title' ? query : authorQuery}
                onChange={e => searchMode === 'title' ? setQuery(e.target.value) : setAuthorQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && executeSearch()}
                autoFocus
              />
              {searching && (
                <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)' }}>
                  <div style={{
                    width: '16px', height: '16px',
                    border: '2px solid #e8622a', borderTopColor: 'transparent',
                    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                  }} />
                </div>
              )}
            </div>
          )}

          {/* Genre grid */}
          {searchMode === 'genre' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {GENRES.map(g => {
                const Icon = g.icon
                const isActive = genreFilter === g.value
                return (
                  <button
                    key={g.value}
                    onClick={() => setGenreFilter(isActive ? null : g.value)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl text-xs font-semibold transition-all border ${
                      isActive
                        ? `${g.badge} border-transparent shadow-sm scale-[1.02]`
                        : 'bg-white text-stone-500 border-stone-200/60 hover:border-stone-300'
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span style={{ textAlign: 'center', lineHeight: 1.3 }}>{g.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {searchNote && (
            <p style={{ fontSize: '11px', color: '#d97706', paddingLeft: '2px' }}>{searchNote}</p>
          )}

          {/* Genre empty state */}
          {searchMode === 'genre' && !genreFilter && results.length === 0 && (
            <p style={{ textAlign: 'center', fontSize: '13px', color: '#9c9490', padding: '16px 0' }}>
              Selecciona un género para explorar el catálogo
            </p>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{
                fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#9c9490', paddingLeft: '2px',
              }}>
                {results.length} resultado{results.length !== 1 ? 's' : ''}
              </p>

              {results.map((book, i) => {
                const genreStyle = book.genre ? getGenreStyle(book.genre) : null
                const Icon = genreStyle?.icon
                return (
                  <div
                    key={book.isLocal ? `local-${book.id}` : `${book.source}-${book.google_books_id || book.title}-${i}`}
                    onClick={() => handleSelect(book)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      background: 'white', borderRadius: '18px',
                      border: '0.5px solid rgba(26,23,20,0.07)',
                      padding: '12px 14px', cursor: 'pointer',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                      transition: 'all 150ms ease',
                    }}
                  >
                    {book.cover ? (
                      <img src={book.cover} alt={book.title} style={{
                        width: '44px', height: '64px', objectFit: 'cover',
                        borderRadius: '8px', flexShrink: 0,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                      }} />
                    ) : (
                      <div className={`${genreStyle?.badge || 'bg-stone-100 text-stone-400'}`}
                        style={{
                          width: '44px', height: '64px', borderRadius: '8px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                        {Icon && <Icon size={20} strokeWidth={1.8} />}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: '14px', fontWeight: 800, color: '#1a1714',
                        letterSpacing: '-0.01em', lineHeight: 1.2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {book.title}
                      </p>
                      <p style={{ fontSize: '12px', color: '#9c9490', fontWeight: 500, marginTop: '2px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {book.author}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        {book.pages && <span style={{ fontSize: '10px', color: '#b8b4b0' }}>{book.pages} págs.</span>}
                        {book.year && <span style={{ fontSize: '10px', color: '#b8b4b0' }}>· {book.year}</span>}
                      </div>
                    </div>
                    {book.isLocal ? (
                      <span style={{
                        fontSize: '10px', fontWeight: 700, color: '#16a34a',
                        background: '#f0faf4', border: '0.5px solid rgba(22,163,74,0.2)',
                        padding: '3px 8px', borderRadius: '99px', flexShrink: 0,
                      }}>
                        Ya en Folio
                      </span>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="#b8b4b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ flexShrink: 0 }}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    )}
                  </div>
                )
              })}

              {/* Not found CTA */}
              <button
                onClick={handleManual}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'white', borderRadius: '18px',
                  border: '0.5px solid rgba(26,23,20,0.07)',
                  padding: '14px 16px', cursor: 'pointer', width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1714', letterSpacing: '-0.01em' }}>
                    No encuentro mi libro
                  </p>
                  <p style={{ fontSize: '11px', color: '#9c9490', marginTop: '2px' }}>Añádelo manualmente</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="#b8b4b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          )}

          {/* Empty results */}
          {results.length === 0 && !searching && (
            (searchMode === 'title' && query.length > 2) ||
            (searchMode === 'author' && authorQuery.length > 2)
          ) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{
                background: 'white', borderRadius: '18px',
                border: '0.5px solid rgba(26,23,20,0.07)',
                padding: '24px', textAlign: 'center',
              }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1714' }}>
                  Sin resultados para "{searchMode === 'title' ? query : authorQuery}"
                </p>
                <p style={{ fontSize: '11px', color: '#9c9490', marginTop: '4px' }}>
                  Prueba con otro término o añádelo manualmente
                </p>
              </div>
              <button
                onClick={handleManual}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#1a1714', borderRadius: '18px', border: 'none',
                  padding: '14px 16px', cursor: 'pointer', width: '100%', boxSizing: 'border-box',
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#f8f6f2', letterSpacing: '-0.01em' }}>
                    Añadir manualmente
                  </p>
                  <p style={{ fontSize: '11px', color: 'rgba(248,246,242,0.5)', marginTop: '2px' }}>
                    Rellena los datos tú mismo
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(248,246,242,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation / manual form */}
      {(selected || manual) && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {selected?.cover && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '8px' }}>
              <div style={{
                borderRadius: '12px', overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
              }}>
                <img src={selected.cover} alt={title}
                  style={{ width: '100px', display: 'block' }} />
              </div>
            </div>
          )}

          {selected && (
            <div style={{
              background: 'white', borderRadius: '16px',
              border: '0.5px solid rgba(26,23,20,0.07)', padding: '14px 16px',
            }}>
              <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#9c9490', marginBottom: '4px' }}>
                Confirma los datos
              </p>
              <p style={{ fontSize: '15px', fontWeight: 800, color: '#1a1714', letterSpacing: '-0.015em' }}>
                {selected.title}
              </p>
              <p style={{ fontSize: '12px', color: '#9c9490', marginTop: '2px' }}>{selected.author}</p>
            </div>
          )}

          {manual && (
            <div style={{
              background: '#fdf8f0', borderRadius: '14px',
              border: '0.5px solid rgba(232,98,42,0.15)', padding: '12px 14px',
            }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#c2651a' }}>
                📋 Este libro se enviará a revisión antes de añadirse a tu lista.
              </p>
            </div>
          )}

          <Input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} />
          <Input placeholder="Autor" value={author} onChange={e => setAuthor(e.target.value)} />

          <div style={{ display: 'flex', gap: '8px' }}>
            <Input type="number" placeholder="Páginas" value={totalPages}
              onChange={e => setTotalPages(e.target.value)} />
            <Input type="number" placeholder="Año (opcional)" value={year}
              onChange={e => setYear(e.target.value)} />
          </div>

          {/* Sinopsis — auto-rellenada desde Google Books cuando está disponible,
              editable manualmente como fallback */}
          <div>
            <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#9c9490', marginBottom: '6px', paddingLeft: '2px' }}>
              Sinopsis <span style={{ opacity: 0.5, fontWeight: 500 }}>· Opcional</span>
            </p>
            <textarea
              placeholder="Breve sinopsis del libro…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              style={{
                width: '100%', background: 'white',
                border: '0.5px solid rgba(26,23,20,0.10)', borderRadius: '14px',
                padding: '13px 16px', fontSize: '13px', color: '#1a1714',
                lineHeight: 1.6, fontFamily: "'Inter', -apple-system, sans-serif",
                outline: 'none', resize: 'none', boxSizing: 'border-box',
                letterSpacing: '-0.005em',
              }}
            />
            {selected?.description && description === selected.description && (
              <p style={{ fontSize: '10px', color: '#16a34a', marginTop: '5px', fontWeight: 600, paddingLeft: '2px' }}>
                ✓ Autocompletada desde Google Books — puedes editarla
              </p>
            )}
          </div>

          {/* Genre selector */}
          <div>
            <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#9c9490', marginBottom: '10px', paddingLeft: '2px' }}>
              Género
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {GENRES.map(g => {
                const Icon = g.icon
                const isActive = genre === g.value
                return (
                  <button
                    key={g.value}
                    onClick={() => setGenre(g.value)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl text-xs font-semibold transition-all border ${
                      isActive
                        ? `${g.badge} border-transparent shadow-sm`
                        : 'bg-white text-stone-500 border-stone-200/60 hover:border-stone-300'
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span style={{ textAlign: 'center', lineHeight: 1.3 }}>{g.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <button
              onClick={resetToSearch}
              style={{
                flex: 1, background: 'white', color: '#9c9490',
                border: '0.5px solid rgba(26,23,20,0.10)', borderRadius: '14px',
                padding: '14px', fontSize: '13px', fontWeight: 700,
                fontFamily: "'Inter', -apple-system, sans-serif", cursor: 'pointer',
              }}
            >
              ← Volver
            </button>
            <button
              onClick={handleAddBook}
              disabled={loading || !genre || !title || !author || !totalPages}
              style={{
                flex: 1,
                background: loading || !genre || !title || !author || !totalPages ? '#e8e4df' : '#1a1714',
                color: loading || !genre || !title || !author || !totalPages ? '#9c9490' : '#f8f6f2',
                border: 'none', borderRadius: '14px',
                padding: '14px', fontSize: '13px', fontWeight: 700,
                fontFamily: "'Inter', -apple-system, sans-serif",
                cursor: loading || !genre || !title || !author || !totalPages ? 'not-allowed' : 'pointer',
                transition: 'all 200ms ease',
              }}
            >
              {loading ? 'Guardando…' : selected ? 'Añadir a mi lista' : 'Enviar para revisión'}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* FIX: active="/home" — comes from Mis libros, not Feed */}
      <Navbar active="/home" />
    </div>
  )
}