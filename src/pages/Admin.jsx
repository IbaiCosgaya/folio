// src/pages/Admin.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { GENRES as GENRE_OPTIONS, getGenreStyle } from '../constants/genres'
import { ADMIN_ID } from '../constants/config'

// ── Shared primitives ─────────────────────────────────────────────────────────

const baseInput = {
  width: '100%',
  background: '#f8f6f2',
  border: '0.5px solid rgba(26,23,20,0.10)',
  borderRadius: '12px',
  padding: '10px 14px',
  fontSize: '13px',
  color: '#1a1714',
  fontFamily: "'Inter', -apple-system, sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
  letterSpacing: '-0.01em',
}

function Field({ label, children }) {
  return (
    <div>
      <p style={{
        fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: '#9c9490', marginBottom: '6px',
      }}>
        {label}
      </p>
      {children}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: '#9c9490', marginBottom: '12px',
    }}>
      {children}
    </p>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Admin() {
  const [requests, setRequests] = useState([])
  const [catalogBooks, setCatalogBooks] = useState([])
  const [filteredBooks, setFilteredBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogGenreFilter, setCatalogGenreFilter] = useState('')
  const [editingRequest, setEditingRequest] = useState(null)
  const [editingBook, setEditingBook] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { checkAdmin() }, [])

  // Live filter whenever search/genre/catalog changes
  useEffect(() => {
    let filtered = catalogBooks
    if (catalogSearch.trim().length > 0) {
      const q = catalogSearch.trim().toLowerCase()
      filtered = filtered.filter(b =>
        b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q)
      )
    }
    if (catalogGenreFilter) {
      filtered = filtered.filter(b => b.genre === catalogGenreFilter)
    }
    setFilteredBooks(filtered)
  }, [catalogSearch, catalogGenreFilter, catalogBooks])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== ADMIN_ID) { navigate('/home'); return }
    await Promise.all([fetchRequests(), fetchCatalog()])
    setLoading(false)
  }

  async function fetchRequests() {
    const { data } = await supabase
      .from('book_requests').select('*').eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (data) setRequests(data)
  }

  async function fetchCatalog() {
    const { data } = await supabase
      .from('global_books').select('*').order('created_at', { ascending: false })
    if (data) {
      setCatalogBooks(data)
      setFilteredBooks(data)
    }
  }

  // ── Cover search engine ───────────────────────────────────────────────────────

  async function searchCoverEngine(title, author) {
    try {
      const queryStr = author ? `${title} ${author}` : title
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(queryStr)}&maxResults=1`
      )
      const data = await res.json()
      const thumbnail = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
      if (thumbnail) return thumbnail.replace('http://', 'https://').replace('zoom=1', 'zoom=2')
    } catch (e) { console.error('Google Books cover error', e) }

    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(`${title} ${author || ''}`)}&limit=1`
      )
      const data = await res.json()
      const coverId = data.docs?.[0]?.cover_i
      if (coverId) return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
    } catch (e) { console.error('OpenLibrary cover error', e) }

    try {
      const res = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=3`)
      const data = await res.json()
      const withCover = data.docs?.find(d => d.cover_i)
      if (withCover) return `https://covers.openlibrary.org/b/id/${withCover.cover_i}-L.jpg`
    } catch (e) { console.error('OpenLibrary title cover error', e) }

    return null
  }

  // Searches Google Books for a synopsis — same matching logic as cover search.
  // Used both for the request editor and the catalog editor "find synopsis" buttons.
  async function searchDescriptionEngine(title, author) {
    try {
      const queryStr = author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(queryStr)}&maxResults=1`
      )
      const data = await res.json()
      const description = data.items?.[0]?.volumeInfo?.description
      if (description) return description
    } catch (e) { console.error('Google Books description error', e) }

    // Fallback: looser query without field restrictions
    try {
      const queryStr = author ? `${title} ${author}` : title
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(queryStr)}&maxResults=1`
      )
      const data = await res.json()
      const description = data.items?.[0]?.volumeInfo?.description
      if (description) return description
    } catch (e) { console.error('Google Books description fallback error', e) }

    return null
  }

  // ── Request handlers ──────────────────────────────────────────────────────────

  function startEditRequest(request) { setEditingRequest({ ...request }) }

  async function saveRequestEdits() {
    const { id, title, author, total_pages, genre, year, cover_url } = editingRequest
    await supabase.from('book_requests')
      .update({ title, author, total_pages, genre, year, cover_url }).eq('id', id)
    setRequests(r => r.map(req => req.id === id ? { ...req, ...editingRequest } : req))
    setEditingRequest(null)
  }

  async function handleSearchRequestCover() {
    if (!editingRequest) return
    const found = await searchCoverEngine(editingRequest.title, editingRequest.author)
    if (found) setEditingRequest(prev => ({ ...prev, cover_url: found }))
    else alert('No se encontró portada. Añade la URL manualmente.')
  }

  async function handleSearchRequestDescription() {
    if (!editingRequest) return
    const found = await searchDescriptionEngine(editingRequest.title, editingRequest.author)
    if (found) setEditingRequest(prev => ({ ...prev, description: found }))
    else alert('No se encontró sinopsis automáticamente. Añádela manualmente.')
  }

  async function handleApprove(request) {
    let finalCoverUrl = request.cover_url
    if (!finalCoverUrl) finalCoverUrl = await searchCoverEngine(request.title, request.author)

    const { data: newBook, error } = await supabase.from('global_books').insert({
      title: request.title, author: request.author,
      total_pages: request.total_pages, genre: request.genre,
      year: request.year || null, cover_url: finalCoverUrl,
      description: request.description || null,
      is_verified: true,
    }).select().single()

    if (error) { alert('Error al aprobar el libro.'); return }

    await supabase.from('user_books').insert({
      user_id: request.user_id, book_id: newBook.id,
      current_page: 0, finished: false, is_active: true,
    })
    await supabase.from('book_requests').update({ status: 'approved' }).eq('id', request.id)

    setRequests(r => r.filter(x => x.id !== request.id))
    setEditingRequest(null)
    fetchCatalog()
  }

  async function handleReject(id) {
    await supabase.from('book_requests').update({ status: 'rejected' }).eq('id', id)
    setRequests(r => r.filter(x => x.id !== id))
    if (editingRequest?.id === id) setEditingRequest(null)
  }

  // ── Catalog handlers ──────────────────────────────────────────────────────────

  async function handleSaveCatalogBook(book) {
    const updates = {
      title: book.title,
      author: book.author,
      cover_url: book.cover_url,
      genre: book.genre,
      year: book.year ? parseInt(book.year) : null,
      total_pages: book.total_pages ? parseInt(book.total_pages) : null,
      description: book.description || null,
    }

    const { error } = await supabase.from('global_books').update(updates).eq('id', book.id)
    if (error) { alert('Error al guardar los cambios.'); return }

    // Update both catalogBooks and filteredBooks to keep UI in sync everywhere
    const updatedBook = { ...book, ...updates }
    setCatalogBooks(prev => prev.map(b => b.id === book.id ? updatedBook : b))
    setEditingBook(null)
  }

  async function handleSearchCatalogCover() {
    if (!editingBook) return
    const found = await searchCoverEngine(editingBook.title, editingBook.author)
    if (found) setEditingBook(prev => ({ ...prev, cover_url: found }))
    else alert('No se encontró portada. Añade la URL manualmente.')
  }

  async function handleSearchCatalogDescription() {
    if (!editingBook) return
    const found = await searchDescriptionEngine(editingBook.title, editingBook.author)
    if (found) setEditingBook(prev => ({ ...prev, description: found }))
    else alert('No se encontró sinopsis automáticamente. Añádela manualmente.')
  }

  async function handleDeleteCatalogBook(bookId) {
    if (!confirm('Esto eliminará el libro del catálogo y de la estantería de TODOS los usuarios. ¿Continuar?')) return
    await supabase.from('user_books').delete().eq('book_id', bookId)
    await supabase.from('global_books').delete().eq('id', bookId)
    setCatalogBooks(prev => prev.filter(b => b.id !== bookId))
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f6f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9c9490', fontSize: '13px' }}>cargando…</p>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f6f2', paddingBottom: '60px',
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
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '52px 20px 20px', position: 'relative', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/home')}
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'white', border: '0.5px solid rgba(26,23,20,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#9c9490',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: 800, color: '#1a1714', letterSpacing: '-0.02em' }}>
              Moderación
            </h1>
            <p style={{ fontSize: '11px', color: '#9c9490', marginTop: '1px' }}>
              {catalogBooks.length} libros en catálogo
            </p>
          </div>
        </div>

        {/* Pending badge — visible from outside too via Feed/Home counter */}
        {requests.length > 0 && (
          <div style={{
            background: '#e8622a', color: 'white',
            borderRadius: '99px', padding: '5px 12px',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.6)',
            }} />
            <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '-0.01em' }}>
              {requests.length} pendiente{requests.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '0 20px', maxWidth: '600px', margin: '0 auto' }}>

        {/* ── Section 1: Pending requests ── */}
        <div style={{ marginBottom: '36px' }}>
          <SectionLabel>Solicitudes pendientes</SectionLabel>

          {requests.length === 0 ? (
            <div style={{
              background: 'white', borderRadius: '18px',
              border: '0.5px solid rgba(26,23,20,0.07)',
              padding: '28px 24px', textAlign: 'center',
            }}>
              <p style={{ fontSize: '13px', color: '#9c9490', fontWeight: 500 }}>
                No hay solicitudes pendientes ✓
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {requests.map(request => (
                <div key={request.id} style={{
                  background: 'white', borderRadius: '20px',
                  border: '0.5px solid rgba(26,23,20,0.07)',
                  padding: '16px', overflow: 'hidden',
                }}>
                  {editingRequest?.id === request.id ? (
                    /* Edit form */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {editingRequest.cover_url && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                          <img src={editingRequest.cover_url} alt=""
                            style={{ width: '72px', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.14)' }} />
                        </div>
                      )}
                      <Field label="Título">
                        <input style={baseInput} value={editingRequest.title || ''}
                          onChange={e => setEditingRequest({ ...editingRequest, title: e.target.value })} />
                      </Field>
                      <Field label="Autor">
                        <input style={baseInput} value={editingRequest.author || ''}
                          onChange={e => setEditingRequest({ ...editingRequest, author: e.target.value })} />
                      </Field>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <Field label="Páginas">
                          <input style={baseInput} type="number" value={editingRequest.total_pages || ''}
                            onChange={e => setEditingRequest({ ...editingRequest, total_pages: parseInt(e.target.value) || null })} />
                        </Field>
                        <Field label="Año">
                          <input style={baseInput} type="number" value={editingRequest.year || ''}
                            onChange={e => setEditingRequest({ ...editingRequest, year: parseInt(e.target.value) || null })} />
                        </Field>
                      </div>
                      <Field label="Sinopsis">
                        <textarea
                          style={{ ...baseInput, resize: 'none', lineHeight: 1.5 }}
                          rows={3}
                          value={editingRequest.description || ''}
                          onChange={e => setEditingRequest({ ...editingRequest, description: e.target.value })}
                          placeholder="Sinopsis del libro…"
                        />
                      </Field>
                      <Field label="Género">
                        <select style={baseInput} value={editingRequest.genre || ''}
                          onChange={e => setEditingRequest({ ...editingRequest, genre: e.target.value })}>
                          <option value="">Seleccionar género</option>
                          {GENRE_OPTIONS.map(g => (
                            <option key={g.value} value={g.value}>{g.label}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="URL portada">
                        <input style={baseInput} value={editingRequest.cover_url || ''}
                          onChange={e => setEditingRequest({ ...editingRequest, cover_url: e.target.value })}
                          placeholder="https://…" />
                      </Field>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button onClick={handleSearchRequestCover} style={{
                          flex: 1, background: '#f8f6f2',
                          border: '0.5px solid rgba(26,23,20,0.10)', borderRadius: '12px',
                          padding: '9px', fontSize: '12px', fontWeight: 700,
                          color: '#1a1714', cursor: 'pointer',
                          fontFamily: "'Inter', -apple-system, sans-serif",
                        }}>
                          🔍 Portada
                        </button>
                        <button onClick={handleSearchRequestDescription} style={{
                          flex: 1, background: '#f8f6f2',
                          border: '0.5px solid rgba(26,23,20,0.10)', borderRadius: '12px',
                          padding: '9px', fontSize: '12px', fontWeight: 700,
                          color: '#1a1714', cursor: 'pointer',
                          fontFamily: "'Inter', -apple-system, sans-serif",
                        }}>
                          🔍 Sinopsis
                        </button>
                      </div>
                      <button onClick={saveRequestEdits} style={{
                        width: '100%', background: '#1a1714', border: 'none', borderRadius: '12px',
                        padding: '10px', fontSize: '12px', fontWeight: 700,
                        color: '#f8f6f2', cursor: 'pointer',
                        fontFamily: "'Inter', -apple-system, sans-serif",
                      }}>
                        Guardar cambios
                      </button>
                    </div>
                  ) : (
                    /* Read view */
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      {request.cover_url ? (
                        <img src={request.cover_url} alt=""
                          style={{ width: '40px', height: '58px', objectFit: 'cover',
                            borderRadius: '6px', flexShrink: 0,
                            boxShadow: '1px 2px 8px rgba(0,0,0,0.12)' }} />
                      ) : (
                        <div style={{
                          width: '40px', height: '58px', borderRadius: '6px',
                          background: '#f0ede8', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: '16px' }}>📖</span>
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: 800, color: '#1a1714',
                          letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                          {request.title}
                        </p>
                        <p style={{ fontSize: '12px', color: '#9c9490', marginTop: '2px' }}>
                          {request.author}
                        </p>
                        <p style={{ fontSize: '10px', color: '#b8b4b0', marginTop: '4px' }}>
                          {request.total_pages} págs.
                          {request.genre && ` · ${request.genre.replace('_', ' ')}`}
                          {request.year && ` · ${request.year}`}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {editingRequest?.id !== request.id && (
                      <button onClick={() => startEditRequest(request)} style={{
                        flex: 1, background: '#f8f6f2',
                        border: '0.5px solid rgba(26,23,20,0.10)', borderRadius: '10px',
                        padding: '8px', fontSize: '12px', fontWeight: 700,
                        color: '#1a1714', cursor: 'pointer',
                        fontFamily: "'Inter', -apple-system, sans-serif",
                      }}>
                        Editar
                      </button>
                    )}
                    <button
                      onClick={() => handleApprove(editingRequest?.id === request.id ? editingRequest : request)}
                      style={{
                        flex: 1, background: '#f0faf4',
                        border: '0.5px solid rgba(22,163,74,0.2)', borderRadius: '10px',
                        padding: '8px', fontSize: '12px', fontWeight: 700,
                        color: '#16a34a', cursor: 'pointer',
                        fontFamily: "'Inter', -apple-system, sans-serif",
                      }}>
                      ✓ Aprobar
                    </button>
                    <button onClick={() => handleReject(request.id)} style={{
                      flex: 1, background: '#fdf2f2',
                      border: '0.5px solid rgba(220,38,38,0.2)', borderRadius: '10px',
                      padding: '8px', fontSize: '12px', fontWeight: 700,
                      color: '#dc2626', cursor: 'pointer',
                      fontFamily: "'Inter', -apple-system, sans-serif",
                    }}>
                      ✗ Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 2: Global catalog ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <SectionLabel>Catálogo global ({filteredBooks.length}{filteredBooks.length !== catalogBooks.length ? ` de ${catalogBooks.length}` : ''})</SectionLabel>
          </div>

          {/* Search + genre filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            <div style={{ position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9c9490"
                strokeWidth="2" strokeLinecap="round"
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Buscar por título o autor…"
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                style={{ ...baseInput, paddingLeft: '38px', background: 'white' }}
              />
              {catalogSearch && (
                <button
                  onClick={() => setCatalogSearch('')}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#9c9490', fontSize: '14px', lineHeight: 1,
                  }}
                >✕</button>
              )}
            </div>

            {/* Genre filter pills */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              <button
                onClick={() => setCatalogGenreFilter('')}
                style={{
                  padding: '5px 12px', borderRadius: '99px', flexShrink: 0,
                  fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  background: !catalogGenreFilter ? '#1a1714' : 'white',
                  color: !catalogGenreFilter ? '#f8f6f2' : '#9c9490',
                  border: !catalogGenreFilter ? 'none' : '0.5px solid rgba(26,23,20,0.10)',
                  transition: 'all 150ms ease',
                }}
              >
                Todos
              </button>
              {GENRE_OPTIONS.map(g => (
                <button
                  key={g.value}
                  onClick={() => setCatalogGenreFilter(catalogGenreFilter === g.value ? '' : g.value)}
                  style={{
                    padding: '5px 12px', borderRadius: '99px', flexShrink: 0,
                    fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                    fontFamily: "'Inter', -apple-system, sans-serif",
                    border: '0.5px solid rgba(26,23,20,0.10)',
                    transition: 'all 150ms ease',
                    background: catalogGenreFilter === g.value ? '#1a1714' : 'white',
                    color: catalogGenreFilter === g.value ? '#f8f6f2' : '#9c9490',
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Empty filter result */}
          {filteredBooks.length === 0 && (
            <div style={{
              background: 'white', borderRadius: '18px',
              border: '0.5px solid rgba(26,23,20,0.07)',
              padding: '28px 24px', textAlign: 'center',
            }}>
              <p style={{ fontSize: '13px', color: '#9c9490' }}>
                Sin resultados para "{catalogSearch}"
              </p>
            </div>
          )}

          {/* Book list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredBooks.map(book => (
              <div key={book.id} style={{
                background: 'white', borderRadius: '18px',
                border: '0.5px solid rgba(26,23,20,0.07)',
                overflow: 'hidden',
              }}>
                {/* Book row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px' }}>
                  {book.cover_url ? (
                    <img src={book.cover_url} alt=""
                      style={{ width: '36px', height: '52px', objectFit: 'cover',
                        borderRadius: '5px', flexShrink: 0,
                        boxShadow: '1px 2px 6px rgba(0,0,0,0.10)' }} />
                  ) : (
                    <div style={{
                      width: '36px', height: '52px', borderRadius: '5px',
                      background: '#f0ede8', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: '14px' }}>📖</span>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 800, color: '#1a1714',
                      letterSpacing: '-0.01em', lineHeight: 1.2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {book.title}
                    </p>
                    <p style={{ fontSize: '11px', color: '#9c9490', marginTop: '2px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {book.author}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      {book.genre && (() => {
                        const g = getGenreStyle(book.genre)
                        const Icon = g.icon
                        return (
                          <span className={g.badge} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '99px',
                          }}>
                            <Icon size={9} strokeWidth={2.5} />
                            {g.label}
                          </span>
                        )
                      })()}
                      {!book.is_verified && (
                        <span style={{ fontSize: '9px', fontWeight: 700, color: '#d97706' }}>
                          Sin verificar
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                    <button
                      onClick={() => setEditingBook(editingBook?.id === book.id ? null : { ...book })}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '11px', fontWeight: 700, color: '#e8622a',
                        fontFamily: "'Inter', -apple-system, sans-serif",
                      }}>
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteCatalogBook(book.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '11px', fontWeight: 700, color: '#dc2626',
                        fontFamily: "'Inter', -apple-system, sans-serif",
                      }}>
                      Eliminar
                    </button>
                  </div>
                </div>

                {/* Inline edit form */}
                {editingBook?.id === book.id && (
                  <div style={{
                    borderTop: '0.5px solid rgba(26,23,20,0.06)',
                    padding: '14px',
                    display: 'flex', flexDirection: 'column', gap: '8px',
                    background: '#fafaf8',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <Field label="Título">
                        <input style={baseInput} value={editingBook.title || ''}
                          onChange={e => setEditingBook({ ...editingBook, title: e.target.value })} />
                      </Field>
                      <Field label="Autor">
                        <input style={baseInput} value={editingBook.author || ''}
                          onChange={e => setEditingBook({ ...editingBook, author: e.target.value })} />
                      </Field>
                    </div>
                    <Field label="URL portada">
                      <input style={baseInput} value={editingBook.cover_url || ''}
                        onChange={e => setEditingBook({ ...editingBook, cover_url: e.target.value })}
                        placeholder="https://…" />
                    </Field>
                    <Field label="Sinopsis">
                      <textarea
                        style={{ ...baseInput, resize: 'none', lineHeight: 1.5 }}
                        rows={3}
                        value={editingBook.description || ''}
                        onChange={e => setEditingBook({ ...editingBook, description: e.target.value })}
                        placeholder="Sinopsis del libro…"
                      />
                    </Field>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <Field label="Páginas">
                        <input style={baseInput} type="number" value={editingBook.total_pages || ''}
                          onChange={e => setEditingBook({ ...editingBook, total_pages: e.target.value })} />
                      </Field>
                      <Field label="Año">
                        <input style={baseInput} type="number" value={editingBook.year || ''}
                          onChange={e => setEditingBook({ ...editingBook, year: e.target.value })} />
                      </Field>
                    </div>
                    <Field label="Género">
                      <select style={baseInput} value={editingBook.genre || ''}
                        onChange={e => setEditingBook({ ...editingBook, genre: e.target.value })}>
                        <option value="">Seleccionar género</option>
                        {GENRE_OPTIONS.map(g => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </select>
                    </Field>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={handleSearchCatalogCover} style={{
                        flex: 1, background: '#f8f6f2',
                        border: '0.5px solid rgba(26,23,20,0.10)', borderRadius: '10px',
                        padding: '9px', fontSize: '12px', fontWeight: 700,
                        color: '#1a1714', cursor: 'pointer',
                        fontFamily: "'Inter', -apple-system, sans-serif",
                      }}>
                        🔍 Portada
                      </button>
                      <button onClick={handleSearchCatalogDescription} style={{
                        flex: 1, background: '#f8f6f2',
                        border: '0.5px solid rgba(26,23,20,0.10)', borderRadius: '10px',
                        padding: '9px', fontSize: '12px', fontWeight: 700,
                        color: '#1a1714', cursor: 'pointer',
                        fontFamily: "'Inter', -apple-system, sans-serif",
                      }}>
                        🔍 Sinopsis
                      </button>
                    </div>
                    <button onClick={() => handleSaveCatalogBook(editingBook)} style={{
                      width: '100%', background: '#1a1714', border: 'none', borderRadius: '10px',
                      padding: '10px', fontSize: '12px', fontWeight: 700,
                      color: '#f8f6f2', cursor: 'pointer',
                      fontFamily: "'Inter', -apple-system, sans-serif",
                    }}>
                      Guardar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}