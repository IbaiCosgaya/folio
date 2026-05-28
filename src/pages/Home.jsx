import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

function Home() {
  const [books, setBooks] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetchBooks()
  }, [])

  async function fetchBooks() {
    const { data } = await supabase.from('books').select('*')
    if (data) setBooks(data)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white">

      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
        <h1 className="text-xl font-bold tracking-tight">folio</h1>
        <button
          onClick={handleLogout}
          className="text-stone-400 hover:text-white text-sm transition-colors"
        >
          Salir
        </button>
      </div>

      <div className="px-6 py-8">
        <h2 className="text-2xl font-semibold mb-1">Hola 👋</h2>
        <p className="text-stone-400 text-sm mb-8">¿Qué estás leyendo hoy?</p>

        {books.length === 0 ? (
          <div className="bg-stone-900 rounded-2xl p-6 text-center border border-stone-800">
            <p className="text-stone-400 text-sm">No tienes libros en curso</p>
            <button
              onClick={() => navigate('/add-book')}
              className="mt-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl px-6 py-2 text-sm transition-colors"
            >
              + Añadir libro
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {books.map(book => (
              <div key={book.id} className="bg-stone-900 rounded-2xl p-5 border border-stone-800">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-white">{book.title}</h3>
                    <p className="text-stone-400 text-sm">{book.author}</p>
                  </div>
                  <span className="text-amber-500 font-bold text-sm">
                    {Math.round((book.current_page / book.total_pages) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-stone-800 rounded-full h-1.5">
                  <div
                    className="bg-amber-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${(book.current_page / book.total_pages) * 100}%` }}
                  />
                </div>
                <p className="text-stone-500 text-xs mt-2">
                  Página {book.current_page} de {book.total_pages}
                </p>
                <button
                  onClick={() => navigate(`/reading/${book.id}`)}
                  className="mt-3 w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl py-2 text-sm transition-colors"
                >
                  Registrar lectura
              </button>
              </div>
            ))}
            <button
              onClick={() => navigate('/add-book')}
              className="w-full border border-stone-800 hover:border-amber-500 text-stone-400 hover:text-amber-500 font-semibold rounded-xl py-3 text-sm transition-colors"
            >
              + Añadir otro libro
            </button>
          </div>
        )}
      </div>

    </div>
  )
}

export default Home