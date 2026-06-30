// src/pages/Register.jsx
import { useState } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

function FolioLogo() {
  return (
    <svg viewBox="0 0 680 400" width="190" height="112" style={{ display: 'block', margin: '0 auto' }}>
      <g transform="translate(340,40)">
        <g transform="translate(-95,0)">
          <path fill="#c9a87c" d="M0 14 Q0 8 6 7 L70 0 L70 178 L6 186 Q0 187 0 181 Z"/>
          <path fill="#f8f6f2" d="M8 18 L62 12 L62 170 L8 176 Z"/>
          <line x1="20" y1="20" x2="20" y2="168" stroke="#c9a87c" strokeWidth="1.6"/>
          <line x1="33" y1="18.5" x2="33" y2="166" stroke="#c9a87c" strokeWidth="1.6"/>
          <line x1="46" y1="17" x2="46" y2="164" stroke="#c9a87c" strokeWidth="1.6"/>
        </g>
        <path fill="#1a1714" d="M0 10 Q0 0 10 0 L84 0 Q90 0 90 6 L90 24 Q90 30 84 30 L38 30 L38 76 Q38 78 40 78 L74 78 Q80 78 80 84 L80 100 Q80 106 74 106 L40 106 Q38 106 38 108 L38 178 Q38 186 30 186 L8 186 Q0 186 0 178 Z"/>
      </g>
      <text x="340" y="305" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="84" fontWeight="400" letterSpacing="13" fill="#1a1714">FOLIO</text>
      <text x="340" y="345" textAnchor="middle" fontFamily="-apple-system, sans-serif"
        fontSize="12" letterSpacing="4" fill="#c9a87c">TU HISTORIA, ENTRE PÁGINAS</text>
    </svg>
  )
}

const inputStyle = {
  width: '100%',
  background: 'white',
  border: '0.5px solid rgba(26,23,20,0.10)',
  borderRadius: '14px',
  padding: '14px 16px',
  fontSize: '14px',
  color: '#1a1714',
  fontFamily: "'Inter', -apple-system, sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
  letterSpacing: '-0.01em',
}

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleRegister() {
    if (!username || !email || !password || !confirmPassword) {
      setError('Rellena todos los campos')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    await supabase.from('profiles').upsert({ id: data.user.id, username })

    // New users go through onboarding first, not straight to the feed
    navigate('/onboarding')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f6f2',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, sans-serif", padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        <div style={{ marginBottom: '8px' }}>
          <FolioLogo />
        </div>
        <p style={{ textAlign: 'center', fontSize: '13px', color: '#9c9490', marginBottom: '32px' }}>
          Crea tu cuenta
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="text" placeholder="Nombre de usuario"
            value={username} onChange={e => setUsername(e.target.value)}
            style={inputStyle}
          />
          <input
            type="email" placeholder="Email"
            value={email} onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password" placeholder="Contraseña"
            value={password} onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password" placeholder="Confirmar contraseña"
            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRegister()}
            style={inputStyle}
          />
          <button
            onClick={handleRegister}
            disabled={loading}
            style={{
              width: '100%', marginTop: '6px',
              background: loading ? '#e8e4df' : '#1a1714',
              color: loading ? '#9c9490' : '#f8f6f2',
              border: 'none', borderRadius: '14px', padding: '15px',
              fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em',
              fontFamily: "'Inter', -apple-system, sans-serif",
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 200ms ease',
            }}
          >
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </div>

        {error && (
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#dc2626', marginTop: '16px', fontWeight: 600 }}>
            {error}
          </p>
        )}

        <p style={{ textAlign: 'center', fontSize: '13px', color: '#9c9490', marginTop: '28px', letterSpacing: '-0.005em' }}>
          ¿Ya tienes cuenta?{' '}
          <span onClick={() => navigate('/')} style={{ color: '#c9a87c', fontWeight: 700, cursor: 'pointer' }}>
            Inicia sesión
          </span>
        </p>

      </div>
    </div>
  )
}