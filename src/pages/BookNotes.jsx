import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'

function BookNotes() {
  const [book, setBook] = useState(null)
  const [sessions, setSessions] = useState([])
  const [finalNote, setFinalNote] = useState('')
  const [savingFinal, setSavingFinal] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { id } = useParams() // id de user_books

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data: bookData } = await supabase
      .from('user_books')
      .select('*, global_books(title)')
      .eq('id', id)
      .single()

    if (bookData) {
      setBook({
        id: bookData.id,
        finished: bookData.finished,
        final_note: bookData.final_note,
        title: bookData.global_books?.title,
      })
      setFinalNote(bookData.final_note || '')
    }

    const { data: sessionData } = await supabase
      .from('reading_sessions')
      .select('*')
      .eq('book_id', id) // id de user_books
      .not('note', 'is', null)
      .order('date', { ascending: true })
    if (sessionData) setSessions(sessionData)
    setLoading(false)
  }

  async function handleSaveFinalNote() {
    setSavingFinal(true)
    await supabase.from('user_books').update({ final_note: finalNote }).eq('id', id)
    setSavingFinal(false)
    navigate('/home')
  }

  if (loading) return <div className="min-h-screen bg-stone-950 flex items-center justify-center text-white">Cargando...</div>
  if (!book) return null

  return (
    <div className="min-h-screen bg-stone-950 text-white">

      <div className="flex items-center gap-4 px-6 py-4 border-b border-stone-800">
        <button onClick={() => navigate(-1)} className="text-stone-400 hover:text-white transition-colors">
          ← Volver
        </button>
        <div>
          <h1 className="text-lg font-semibold">Mi diario</h1>
          <p className="text-stone-500 text-xs">{book.title}</p>
        </div>
        <span className="ml-auto text-xs text-stone-600">🔒 Solo visible para ti</span>
      </div>

      <div className="px-6 py-6 space-y-4">

        {sessions.length === 0 && !book.finished ? (
          <div className="text-center text-stone-500 text-sm py-8">
            Aún no hay notas. Puedes añadirlas al registrar tu lectura.
          </div>
        ) : (
          <>
            {sessions.length > 0 && (
              <div>
                <p className="text-stone-400 text-sm mb-3">Notas de lectura</p>
                <div className="space-y-3">
                  {sessions.map(session => (
                    <div key={session.id} className="bg-stone-900 rounded-2xl p-4 border border-stone-800">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-amber-500 text-stone-950 text-xs font-bold px-2 py-0.5 rounded-full">
                          p. {session.pages_read}
                        </span>
                        <span className="text-stone-600 text-xs">
                          {new Date(session.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-stone-300 text-sm leading-relaxed">{session.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {book.finished && (
              <div>
                <p className="text-stone-400 text-sm mb-3">Reflexión final</p>
                <div className="bg-stone-900 rounded-2xl p-4 border border-stone-800 space-y-3">
                  <textarea
                    value={finalNote}
                    onChange={e => setFinalNote(e.target.value)}
                    placeholder="¿Qué te ha parecido el libro? Reflexión final..."
                    rows={4}
                    className="w-full bg-stone-800 text-white placeholder-stone-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm resize-none"
                  />
                  <button
                    onClick={handleSaveFinalNote}
                    disabled={savingFinal}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl py-2 text-sm transition-colors disabled:opacity-50"
                  >
                    {savingFinal ? 'Guardando...' : 'Guardar reflexión'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default BookNotes