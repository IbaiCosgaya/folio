import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'

function ReadingSession() {
  const [book, setBook] = useState(null)
  const [currentPage, setCurrentPage] = useState('')
  const [minutes, setMinutes] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { id } = useParams()

  useEffect(() => {
    fetchBook()
  }, [])

  async function fetchBook() {
    const { data } = await supabase.from('books').select('*').eq('id', id).single()
    if (data) {
      setBook(data)
      setCurrentPage(data.current_page)
    }
  }

  async function handleUpdate() {
    if (!currentPage) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    const pagesRead = parseInt(currentPage) - book.current_page
    const finished = parseInt(currentPage) >= book.total_pages

    await supabase.from('books').update({
      current_page: parseInt(currentPage),
      finished: finished
    }).eq('id', id)

    if (finished) {
      navigate(`/notes/${id}`)
      return
    }   

    if (pagesRead > 0) {
      await supabase.from('reading_sessions').insert({
        user_id: user.id,
        book_id: parseInt(id), // Pasamos id directamente (si tu DB usa enteros, usa parseInt(id))
        pages_read: pagesRead,
        minutes_read: minutes ? parseInt(minutes) : null,
        date: new Date().toISOString().split('T')[0],
        note: note.trim() || null
      })
    }

    navigate('/home')
    setLoading(false)
  }

  if (!book) return null

  const percent = Math.round((currentPage / book.total_pages) * 100)

  return (
    <div className="min-h-screen bg-stone-950 text-white">

      <div className="flex items-center gap-4 px-6 py-4 border-b border-stone-800">
        <button onClick={() => navigate('/home')} className="text-stone-400 hover:text-white transition-colors">
          ← Volver
        </button>
        <h1 className="text-lg font-semibold">Registrar lectura</h1>
      </div>

      <div className="px-6 py-8">
        <h2 className="text-xl font-bold mb-1">{book.title}</h2>
        <p className="text-stone-400 text-sm mb-8">{book.author}</p>

        <div className="bg-stone-900 rounded-2xl p-6 border border-stone-800 mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-stone-400 text-sm">Progreso</span>
            <span className="text-amber-500 font-bold">{percent}%</span>
          </div>
          <div className="w-full bg-stone-800 rounded-full h-2 mb-4">
            <div
              className="bg-amber-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <p className="text-stone-500 text-xs">
            Página {book.current_page} de {book.total_pages}
          </p>
        </div>

        <p className="text-stone-400 text-sm mb-2">¿En qué página estás ahora?</p>
        <input
          type="number"
          value={currentPage}
          onChange={e => setCurrentPage(e.target.value)}
          max={book.total_pages}
          className="w-full bg-stone-900 text-white placeholder-stone-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 mb-4"
        />

        <p className="text-stone-400 text-sm mb-2">¿Cuántos minutos has leído? (opcional)</p>
        <input
          type="number"
          placeholder="ej. 45"
          value={minutes}
          onChange={e => setMinutes(e.target.value)}
          className="w-full bg-stone-900 text-white placeholder-stone-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 mb-4"
        />

        {/* Nuevo campo de nota añadido */}
        <p className="text-stone-400 text-sm mb-2">Nota de hoy (opcional)</p>
        <textarea
          placeholder="¿Qué te ha parecido lo que has leído hoy?"
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          className="w-full bg-stone-900 text-white placeholder-stone-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 mb-6 resize-none text-sm"
        />

        <button
          onClick={handleUpdate}
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl py-3 transition-colors disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar progreso'}
        </button>
      </div>

    </div>
  )
}

export default ReadingSession