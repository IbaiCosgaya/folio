import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

function Home() {
  const navigate = useNavigate()

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

        <div className="bg-stone-900 rounded-2xl p-6 text-center border border-stone-800">
          <p className="text-stone-400 text-sm">No tienes libros en curso</p>
          <button className="mt-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl px-6 py-2 text-sm transition-colors">
            + Añadir libro
          </button>
        </div>
      </div>

    </div>
  )
}

export default Home