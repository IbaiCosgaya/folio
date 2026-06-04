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

  async function handleApprove(request) {
    await supabase.from('books').insert({
      user_id: request.user_id,
      title: request.title,
      author: request.author,
      total_pages: request.total_pages,
      current_page: 0,
      genre: request.genre,
      cover_url: request.cover_url,
      finished: false
    })
    await supabase.from('book_requests').update({ status: 'approved' }).eq('id', request.id)
    setRequests(r => r.filter(x => x.id !== request.id))
    fetchBooks() // Recarga la lista para que aparezca el nuevo libro aprobado
  }

  async function handleReject(id) {
    await supabase.from('book_requests').update({ status: 'rejected' }).eq('id', id)
    setRequests(r => r.filter(x => x.id !== id))
  }

  async function handleDeleteBook(bookId) {
    if (!confirm('¿Seguro que quieres eliminar este libro de la base de datos?')) return
    await supabase.from('reading_sessions').delete().eq('book_id', bookId)
    await supabase.from('books').delete().eq('id', bookId)
    // Corrección: Filtrar del estado para que desaparezca visualmente de inmediato
    setApprovedBooks(books => books.filter(b => b.id !== bookId))
  }

  async function handleSaveBook(book) {
    await supabase.from('books').update({
      cover_url: book.cover_url,
      genre: book.genre,
      year: book.year ? parseInt(book.year) : null
    }).eq('id', book.id)
    setApprovedBooks(books => books.map(b => b.id === book.id ? { ...b, ...book } : b))
    setEditingBook(null)
  }

  async function handleSearchCover(book) {
    const query = `${book.title} ${book.author}`
    const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1`)
    const data = await res.json()
    const result = data.docs?.[0]
    if (result?.cover_i) {
      const coverUrl = `https://covers.openlibrary.org/b/id/${result.cover_i}-M.jpg`
      setEditingBook(prev => ({ ...prev, cover_url: coverUrl }))
    } else {
      alert('No se encontró portada automáticamente. Puedes añadir la URL manualmente.')
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