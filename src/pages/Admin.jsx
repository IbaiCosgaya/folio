import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { GENRES as GENRE_OPTIONS, getGenreStyle } from '../constants/genres'
import { ADMIN_ID } from '../constants/config'

function Admin() {
  const [requests, setRequests] = useState([])
  const [catalogBooks, setCatalogBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  const [editingRequest, setEditingRequest] = useState(null) // borrador de edición de una solicitud pendiente
  const [editingBook, setEditingBook] = useState(null) // borrador de edición de un libro ya en el catálogo

  useEffect(() => {
    checkAdmin()
  }, [])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== ADMIN_ID) {
      navigate('/home')
      return
    }
    setUser(user)
    await Promise.all([fetchRequests(), fetchCatalog()])
    setLoading(false)
  }

  async function fetchRequests() {
    const { data } = await supabase
      .from('book_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (data) setRequests(data)
  }

  async function fetchCatalog() {
    const { data } = await supabase
      .from('global_books')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setCatalogBooks(data)
  }

  // --- Buscador de portada: Google Books primero, OpenLibrary como respaldo ---
  async function searchCoverEngine(title, author) {
    // 1. Google Books (título + autor)
    try {
      const queryStr = author ? `${title} ${author}` : title
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(queryStr)}&maxResults=1`
      )
      const data = await res.json()
      const thumbnail = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
      if (thumbnail) {
        return thumbnail.replace('http://', 'https://').replace('zoom=1', 'zoom=2')
      }
    } catch (e) {
      console.error('Fallo Google Books', e)
    }

    // 2. OpenLibrary (título + autor)
    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(`${title} ${author || ''}`)}&limit=1`
      )
      const data = await res.json()
      const coverId = data.docs?.[0]?.cover_i
      if (coverId) return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
    } catch (e) {
      console.error('Fallo OpenLibrary estricto', e)
    }

    // 3. OpenLibrary, solo por título (red de seguridad si el autor no coincide bien)
    try {
      const res = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=3`)
      const data = await res.json()
      const withCover = data.docs?.find(d => d.cover_i)
      if (withCover) return `https://covers.openlibrary.org/b/id/${withCover.cover_i}-L.jpg`
    } catch (e) {
      console.error('Fallo OpenLibrary por título', e)
    }

    return null
  }

  // --- Edición de una solicitud ANTES de aprobarla ---
  function startEditRequest(request) {
    setEditingRequest({ ...request })
  }

  async function saveRequestEdits() {
    const { id, title, author, total_pages, genre, year, cover_url } = editingRequest
    await supabase
      .from('book_requests')
      .update({ title, author, total_pages, genre, year, cover_url })
      .eq('id', id)
    setRequests(r => r.map(req => (req.id === id ? { ...req, ...editingRequest } : req)))
    setEditingRequest(null)
  }

  async function handleSearchRequestCover() {
    if (!editingRequest) return
    const found = await searchCoverEngine(editingRequest.title, editingRequest.author)
    if (found) {
      setEditingRequest(prev => ({ ...prev, cover_url: found }))
    } else {
      alert('No se encontró portada automáticamente. Añade la URL manualmente.')
    }
  }

  // --- Aprobar: inserta en global_books, crea user_books del solicitante, marca approved ---
  async function handleApprove(request) {
    let finalCoverUrl = request.cover_url
    if (!finalCoverUrl) {
      finalCoverUrl = await searchCoverEngine(request.title, request.author)
    }

    const { data: newGlobalBook, error: insertError } = await supabase
      .from('global_books')
      .insert({
        title: request.title,
        author: request.author,
        total_pages: request.total_pages,
        genre: request.genre,
        year: request.year || null,
        cover_url: finalCoverUrl,
        is_verified: true, // revisado por el admin
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error al insertar en global_books:', insertError)
      alert('Hubo un error al aprobar el libro.')
      return
    }

    const { error: ubError } = await supabase.from('user_books').insert({
      user_id: request.user_id,
      book_id: newGlobalBook.id,
      current_page: 0,
      finished: false,
      is_active: true,
    })

    if (ubError) {
      console.error('Error al crear user_books:', ubError)
      alert('El libro se aprobó pero no se pudo añadir a la lista del usuario.')
    }

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

  // --- Edición del catálogo global ya existente ---
  async function handleSaveCatalogBook(book) {
    await supabase
      .from('global_books')
      .update({
        title: book.title,
        author: book.author,
        cover_url: book.cover_url,
        genre: book.genre,
        year: book.year ? parseInt(book.year) : null,
        total_pages: book.total_pages ? parseInt(book.total_pages) : null,
      })
      .eq('id', book.id)

    setCatalogBooks(books => books.map(b => (b.id === book.id ? { ...b, ...book } : b)))
    setEditingBook(null)
  }

  async function handleSearchCatalogCover(book) {
    const found = await searchCoverEngine(book.title, book.author)
    if (found) {
      setEditingBook(prev => ({ ...prev, cover_url: found }))
    } else {
      alert('No se encontró portada automáticamente. Añade la URL manualmente.')
    }
  }

  // Borra el libro del catálogo Y de las estanterías de todos los usuarios que lo tengan
  // (reading_sessions y book_notes caen en cascada por la FK a user_books)
  async function handleDeleteCatalogBook(bookId) {
    if (!confirm('Esto eliminará el libro del catálogo y de la estantería de TODOS los usuarios que lo tengan. ¿Continuar?')) return
    await supabase.from('user_books').delete().eq('book_id', bookId)
    await supabase.from('global_books').delete().eq('id', bookId)
    setCatalogBooks(books => books.filter(b => b.id !== bookId))
  }

  if (loading) return <div className="min-h-screen bg-stone-950 flex items-center justify-center text-white">Cargando...</div>

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-stone-800">
        <button onClick={() => navigate('/home')} className="text-stone-400 hover:text-white transition-colors">
          ← Volver
        </button>
        <h1 className="text-lg font-semibold">Moderación de libros</h1>
        <span className="bg-amber-500 text-stone-950 text-xs font-bold px-2 py-1 rounded-full">
          {requests.length} pendientes
        </span>
      </div>

      <div className="px-6 py-8 space-y-10">

        {/* SECCIÓN 1: Solicitudes pendientes */}
        <div>
          <p className="text-stone-400 text-sm mb-3 font-semibold uppercase tracking-wide">Solicitudes pendientes</p>
          {requests.length === 0 ? (
            <div className="bg-stone-900 rounded-2xl p-6 text-center border border-stone-800">
              <p className="text-stone-400">No hay libros pendientes de revisión</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map(request => (
                <div key={request.id} className="bg-stone-900 rounded-2xl p-5 border border-stone-800">
                  {editingRequest?.id === request.id ? (
                    <div className="space-y-2">
                      {editingRequest.cover_url && (
                        <div className="flex justify-center mb-2">
                          <img src={editingRequest.cover_url} alt="" className="w-20 rounded-lg shadow-lg" />
                        </div>
                      )}
                      <input
                        type="text"
                        value={editingRequest.title || ''}
                        onChange={e => setEditingRequest({ ...editingRequest, title: e.target.value })}
                        placeholder="Título"
                        className="w-full bg-stone-800 text-white placeholder-stone-500 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <input
                        type="text"
                        value={editingRequest.author || ''}
                        onChange={e => setEditingRequest({ ...editingRequest, author: e.target.value })}
                        placeholder="Autor"
                        className="w-full bg-stone-800 text-white placeholder-stone-500 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={editingRequest.total_pages || ''}
                          onChange={e => setEditingRequest({ ...editingRequest, total_pages: parseInt(e.target.value) || null })}
                          placeholder="Páginas"
                          className="w-full bg-stone-800 text-white placeholder-stone-500 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <input
                          type="number"
                          value={editingRequest.year || ''}
                          onChange={e => setEditingRequest({ ...editingRequest, year: parseInt(e.target.value) || null })}
                          placeholder="Año"
                          className="w-full bg-stone-800 text-white placeholder-stone-500 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <select
                        value={editingRequest.genre || ''}
                        onChange={e => setEditingRequest({ ...editingRequest, genre: e.target.value })}
                        className="w-full bg-stone-800 text-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">Seleccionar género</option>
                        {GENRE_OPTIONS.map(g => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editingRequest.cover_url || ''}
                        onChange={e => setEditingRequest({ ...editingRequest, cover_url: e.target.value })}
                        placeholder="URL de la portada"
                        className="w-full bg-stone-800 text-white placeholder-stone-500 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleSearchRequestCover}
                          className="flex-1 border border-stone-700 hover:border-amber-500 text-stone-400 hover:text-amber-500 font-semibold rounded-xl py-2 text-xs transition-colors"
                        >
                          🔍 Buscar portada
                        </button>
                        <button
                          onClick={saveRequestEdits}
                          className="flex-1 bg-stone-700 hover:bg-stone-600 text-white font-semibold rounded-xl py-2 text-xs transition-colors"
                        >
                          Guardar cambios
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mb-3">
                      {request.cover_url && (
                        <img src={request.cover_url} alt="" className="w-10 h-14 object-cover rounded" />
                      )}
                      <div>
                        <h3 className="font-semibold text-white">{request.title}</h3>
                        <p className="text-stone-400 text-sm">{request.author}</p>
                        <p className="text-stone-500 text-xs mt-1">
                          {request.total_pages} páginas · {request.genre}{request.year ? ` · ${request.year}` : ''}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    {editingRequest?.id !== request.id && (
                      <button
                        onClick={() => startEditRequest(request)}
                        className="flex-1 border border-stone-700 text-stone-300 font-semibold rounded-xl py-2 text-sm hover:border-amber-500 hover:text-amber-500 transition-colors"
                      >
                        ✎ Editar
                      </button>
                    )}
                    <button
                      onClick={() => handleApprove(editingRequest?.id === request.id ? editingRequest : request)}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl py-2 text-sm transition-colors"
                    >
                      ✓ Aprobar
                    </button>
                    <button
                      onClick={() => handleReject(request.id)}
                      className="flex-1 bg-red-900 hover:bg-red-800 text-white font-semibold rounded-xl py-2 text-sm transition-colors"
                    >
                      ✗ Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECCIÓN 2: Catálogo global (editable en cualquier momento) */}
        <div>
          <p className="text-stone-400 text-sm mb-3 font-semibold uppercase tracking-wide">Catálogo global ({catalogBooks.length})</p>
          <div className="space-y-3">
            {catalogBooks.map(book => (
              <div key={book.id} className="bg-stone-900 rounded-2xl p-4 border border-stone-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {book.cover_url && (
                      <img src={book.cover_url} alt="" className="w-9 h-12 object-cover rounded" />
                    )}
                    <div>
                      <h3 className="font-semibold text-white text-sm">{book.title}</h3>
                      <p className="text-stone-400 text-xs">{book.author}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {book.genre && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${getGenreStyle(book.genre).badge}`}>
                            {(() => { const Icon = getGenreStyle(book.genre).icon; return <Icon size={11} strokeWidth={2} /> })()}
                            {getGenreStyle(book.genre).label}
                          </span>
                        )}
                        {!book.is_verified && (
                          <span className="text-[10px] text-amber-500 font-semibold">Sin verificar</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditingBook(editingBook?.id === book.id ? null : { ...book })}
                      className="text-amber-500 hover:text-amber-400 text-xs font-semibold transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteCatalogBook(book.id)}
                      className="text-red-500 hover:text-red-400 text-xs font-semibold transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {editingBook?.id === book.id && (
                  <div className="space-y-2 border-t border-stone-800 pt-3">
                    <input
                      type="text"
                      value={editingBook.title || ''}
                      onChange={e => setEditingBook({ ...editingBook, title: e.target.value })}
                      placeholder="Título"
                      className="w-full bg-stone-800 text-white placeholder-stone-500 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <input
                      type="text"
                      value={editingBook.author || ''}
                      onChange={e => setEditingBook({ ...editingBook, author: e.target.value })}
                      placeholder="Autor"
                      className="w-full bg-stone-800 text-white placeholder-stone-500 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <input
                      type="text"
                      value={editingBook.cover_url || ''}
                      onChange={e => setEditingBook({ ...editingBook, cover_url: e.target.value })}
                      placeholder="URL de la portada"
                      className="w-full bg-stone-800 text-white placeholder-stone-500 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={editingBook.total_pages || ''}
                        onChange={e => setEditingBook({ ...editingBook, total_pages: e.target.value })}
                        placeholder="Páginas"
                        className="w-full bg-stone-800 text-white placeholder-stone-500 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <input
                        type="number"
                        value={editingBook.year || ''}
                        onChange={e => setEditingBook({ ...editingBook, year: e.target.value })}
                        placeholder="Año"
                        className="w-full bg-stone-800 text-white placeholder-stone-500 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <select
                      value={editingBook.genre || ''}
                      onChange={e => setEditingBook({ ...editingBook, genre: e.target.value })}
                      className="w-full bg-stone-800 text-white rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">Seleccionar género</option>
                      {GENRE_OPTIONS.map(g => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSearchCatalogCover(book)}
                        className="flex-1 border border-stone-700 hover:border-amber-500 text-stone-400 hover:text-amber-500 font-semibold rounded-xl py-2 text-xs transition-colors"
                      >
                        🔍 Buscar portada
                      </button>
                      <button
                        onClick={() => handleSaveCatalogBook(editingBook)}
                        className="flex-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl py-2 text-xs transition-colors"
                      >
                        Guardar
                      </button>
                    </div>
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

export default Admin