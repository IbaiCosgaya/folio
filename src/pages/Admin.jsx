import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const ADMIN_ID = '581dd0d6-6240-461a-90b7-224f74d577ab'

function Admin() {
  const [requests, setRequests] = useState([])
  const [approvedBooks, setApprovedBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const navigate = useNavigate()
  const [editingBook, setEditingBook] = useState(null)

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
    fetchRequests()
    fetchBooks()
  }

  async function fetchRequests() {
    const { data } = await supabase
      .from('book_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (data) setRequests(data)
    setLoading(false)
  }

  async function fetchBooks() {
    const { data } = await supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setApprovedBooks(data)
  }

  // FUNCIÓN AUXILIAR: Busca portadas en la API de Google Books en alta resolución
  async function fetchGoogleBooksCover(title, author) {
    try {
      const queryStr = author ? `${title} ${author}` : title
      const query = encodeURIComponent(queryStr)
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`)
      const data = await res.json()
      const item = data.items?.[0]
      if (item?.volumeInfo?.imageLinks?.thumbnail) {
        return item.volumeInfo.imageLinks.thumbnail
          .replace('http://', 'https://')
          .replace('&zoom=1', '&zoom=3') // Fuerza máxima calidad de imagen disponible
      }
    } catch (e) { 
      return null 
    }
    return null
  }

  // FUNCIÓN MOTOR DE BÚSQUEDA INTEGRAL (Combina búsquedas estrictas y genéricas)
  async function searchCoverEngine(title, author) {
    // 1. Intentar Open Library (Estricto: Título + Autor)
    try {
      const query = `${title} ${author}`
      const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1`)
      const data = await res.json()
      if (data.docs?.[0]?.cover_i) {
        return `https://covers.openlibrary.org/b/id/${data.docs[0].cover_i}-L.jpg`
      }
    } catch (err) {
      console.error("Fallo Open Library estricto", err)
    }

    // 2. Intentar Google Books (Estricto: Título + Autor)
    const googleCoverStrict = await fetchGoogleBooksCover(title, author)
    if (googleCoverStrict) return googleCoverStrict

    // --- ESCANEO DE EMERGENCIA (Si el autor dificulta la coincidencia) ---
    console.log("Búsqueda estricta fallida. Buscando carátula solo por título...");

    // 3. Open Library (Solo Título)
    try {
      const res = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=3`)
      const data = await res.json()
      const resultWithCover = data.docs?.find(d => d.cover_i)
      if (resultWithCover?.cover_i) {
        return `https://covers.openlibrary.org/b/id/${resultWithCover.cover_i}-L.jpg`
      }
    } catch (err) {
      console.error("Fallo Open Library por título", err)
    }

    // 4. Google Books (Solo Título)
    const googleCoverRelaxed = await fetchGoogleBooksCover(title, "")
    if (googleCoverRelaxed) return googleCoverRelaxed

    return null // No se encontró nada
  }

  async function handleApprove(request) {
    let finalCoverUrl = request.cover_url

    // Si la petición no trae portada, usamos el motor integral para intentar salvarla
    if (!finalCoverUrl) {
      finalCoverUrl = await searchCoverEngine(request.title, request.author)
    }

    // Insertamos el libro en la base de datos
    const { data: newBook, error: insertError } = await supabase
      .from('books')
      .insert({
        user_id: request.user_id, 
        title: request.title,
        author: request.author,
        total_pages: request.total_pages,
        current_page: 0,
        genre: request.genre,
        cover_url: finalCoverUrl, 
        finished: false
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error al insertar en books:", insertError)
      alert("Hubo un error al aprobar el libro.")
      return
    }

    if (newBook) {
      await supabase.from('reading_sessions').insert({
        user_id: request.user_id,
        book_id: newBook.id,
        pages_read: 0,
        minutes_read: 0
      })
    }

    await supabase.from('book_requests').update({ status: 'approved' }).eq('id', request.id)
    
    setRequests(r => r.filter(x => x.id !== request.id))
    fetchRequests()
    fetchBooks() 
  }

  async function handleReject(id) {
    await supabase.from('book_requests').update({ status: 'rejected' }).eq('id', id)
    setRequests(r => r.filter(x => x.id !== id))
  }

  async function handleDeleteBook(bookId) {
    if (!confirm('¿Seguro que quieres eliminar este libro de la base de datos?')) return
    await supabase.from('reading_sessions').delete().eq('book_id', bookId)
    await supabase.from('books').delete().eq('id', bookId)
    setApprovedBooks(books => books.filter(b => b.id !== bookId))
  }

  async function handleSaveBook(book) {
    await supabase.from('books').update({
      cover_url: book.cover_url,
      genre: book.genre,
      year: book.year ? parseInt(book.year) : null
    }).eq('title', book.title).eq('author', book.author)

    setApprovedBooks(books => books.map(b =>
      b.title === book.title && b.author === book.author
        ? { ...b, cover_url: book.cover_url, genre: book.genre, year: book.year }
        : b
    ))
    setEditingBook(null)
  }

  // BUSCADOR EN EL MODAL DE EDICIÓN
  async function handleSearchCover(book) {
    const foundCover = await searchCoverEngine(book.title, book.author)
    
    if (foundCover) {
      setEditingBook(prev => ({ ...prev, cover_url: foundCover }))
    } else {
      alert('No se encontró portada en ninguna plataforma (ni por autor ni por título). Deberás añadir la URL manualmente.')
    }
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

      <div className="px-6 py-8 space-y-4">
        {requests.length === 0 ? (
          <div className="bg-stone-900 rounded-2xl p-6 text-center border border-stone-800">
            <p className="text-stone-400">No hay libros pendientes de revisión</p>
          </div>
        ) : (
          requests.map(request => (
            <div key={request.id} className="bg-stone-900 rounded-2xl p-5 border border-stone-800">
              <div className="mb-3">
                <h3 className="font-semibold text-white">{request.title}</h3>
                <p className="text-stone-400 text-sm">{request.author}</p>
                <p className="text-stone-500 text-xs mt-1">{request.total_pages} páginas · {request.genre}</p>
                <p className="text-stone-600 text-xs mt-1">
                  {new Date(request.created_at).toLocaleDateString('es-ES')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(request)}
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
          ))
        )}

        <div className="mt-10">
          <p className="text-stone-400 text-sm mb-3">Libros en la base de datos</p>
          <div className="space-y-3">
            {approvedBooks.map(book => (
              <div key={book.id} className="bg-stone-900 rounded-2xl p-4 border border-stone-800">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-white text-sm">{book.title}</h3>
                    <p className="text-stone-400 text-xs">{book.author}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditingBook(editingBook?.id === book.id ? null : book)}
                      className="text-amber-500 hover:text-amber-400 text-xs font-semibold transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteBook(book.id)}
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
                      value={editingBook.cover_url || ''}
                      onChange={e => setEditingBook({ ...editingBook, cover_url: e.target.value })}
                      placeholder="URL de la portada"
                      className="w-full bg-stone-800 text-white placeholder-stone-500 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <input
                      type="number"
                      value={editingBook.year || ''}
                      onChange={e => setEditingBook({ ...editingBook, year: e.target.value })}
                      placeholder="Año de publicación"
                      className="w-full bg-stone-800 text-white placeholder-stone-500 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <select
                      value={editingBook.genre || ''}
                      onChange={e => setEditingBook({ ...editingBook, genre: e.target.value })}
                      className="w-full bg-stone-800 text-white rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">Seleccionar género</option>
                      <option value="fantasia">🔮 Fantasía</option>
                      <option value="ciencia_ficcion">🚀 Ciencia ficción</option>
                      <option value="thriller">🔪 Thriller</option>
                      <option value="romance">💕 Romance</option>
                      <option value="historica">⚔️ Histórica</option>
                      <option value="terror">👻 Terror</option>
                      <option value="no_ficcion">📚 No ficción</option>
                      <option value="autobiografia">✍️ Autobiografía</option>
                      <option value="otro">📖 Otro</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSearchCover(book)}
                        className="flex-1 border border-stone-700 hover:border-amber-500 text-stone-400 hover:text-amber-500 font-semibold rounded-xl py-2 text-xs transition-colors"
                      >
                        🔍 Buscar portada
                      </button>
                      <button
                        onClick={() => handleSaveBook(editingBook)}
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