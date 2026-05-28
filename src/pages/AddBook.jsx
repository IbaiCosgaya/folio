import { useState } from 'react'
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
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [totalPages, setTotalPages] = useState('')
  const [genre, setGenre] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleAddBook() {
    if (!title || !author || !totalPages || !genre) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('books').insert({
      user_id: user.id,
      title,
      author,
      total_pages: parseInt(totalPages),
      current_page: 0,
      genre
    })

    if (!error) navigate('/home')
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

        <button
          onClick={handleAddBook}
          disabled={loading || !genre}
          className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl py-3 transition-colors disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar libro'}
        </button>
      </div>

    </div>
  )
}

export default AddBook