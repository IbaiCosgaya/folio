import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const ADMIN_ID = '581dd0d6-6240-461a-90b7-224f74d577ab'

function Admin() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

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
  }

  async function handleReject(id) {
    await supabase.from('book_requests').update({ status: 'rejected' }).eq('id', id)
    setRequests(r => r.filter(x => x.id !== id))
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
      </div>
    </div>
  )
}

export default Admin