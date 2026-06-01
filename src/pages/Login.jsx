import { useState } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o contraseña incorrectos')
    } else {
      navigate('/home')
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center">
      <div className="w-full max-w-sm px-6">

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white tracking-tight">folio</h1>
          <p className="text-stone-400 mt-2">Tu diario de lectura</p>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-stone-900 text-white placeholder-stone-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-stone-900 text-white placeholder-stone-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl py-3 transition-colors"
          >
            Entrar
          </button>
        </div>

        {error && <p className="text-center text-red-400 text-sm mt-4">{error}</p>}

        <p className="text-center text-stone-500 text-sm mt-6">
          ¿No tienes cuenta?{' '}
          <span
            onClick={() => navigate('/register')}
            className="text-amber-500 cursor-pointer hover:underline"
          >
            Regístrate
          </span>
        </p>

      </div>
    </div>
  )
}

export default Login