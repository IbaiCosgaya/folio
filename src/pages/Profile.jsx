// src/pages/Profile.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import Navbar from '../components/layout/Navbar'

// ── Small primitives ──────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: '9px',
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: '#9c9490',
      marginBottom: '10px',
      paddingLeft: '2px',
    }}>
      {children}
    </p>
  )
}

function FieldGroup({ children }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      border: '0.5px solid rgba(26,23,20,0.08)',
      overflow: 'hidden',
      marginBottom: '24px',
    }}>
      {children}
    </div>
  )
}

function Field({ label, children, divider = true }) {
  return (
    <div style={{
      padding: '14px 18px',
      borderBottom: divider ? '0.5px solid rgba(26,23,20,0.06)' : 'none',
    }}>
      <p style={{
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.03em',
        color: '#9c9490',
        marginBottom: '6px',
        textTransform: 'uppercase',
      }}>
        {label}
      </p>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  fontSize: '14px',
  fontWeight: 500,
  color: '#1a1714',
  fontFamily: "'Inter', -apple-system, sans-serif",
  padding: 0,
  letterSpacing: '-0.01em',
}

const inputStyleReadonly = {
  ...inputStyle,
  color: '#9c9490',
}

function PrimaryButton({ onClick, disabled, loading, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        background: disabled ? '#e8e4df' : '#1a1714',
        color: disabled ? '#9c9490' : '#f8f6f2',
        border: 'none',
        borderRadius: '14px',
        padding: '14px',
        fontSize: '13px',
        fontWeight: 700,
        letterSpacing: '-0.01em',
        fontFamily: "'Inter', -apple-system, sans-serif",
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 180ms ease',
      }}
    >
      {loading ? 'Guardando…' : children}
    </button>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [username, setUsername] = useState('')
  const [lastName, setLastName] = useState('')
  const [bio, setBio] = useState('')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingAuth, setSavingAuth] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'ok'|'err', text }
  const navigate = useNavigate()

  useEffect(() => { fetchProfileData() }, [])

  async function fetchProfileData() {
    const { data: { user } } = await supabase.auth.getUser()
    setEmail(user.email)
    const { data } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setProfile(data)
      setUsername(data.username || '')
      setLastName(data.last_name || '')
      setBio(data.bio || '')
    }
    setLoading(false)
  }

  function showMessage(type, text) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3500)
  }

  async function handleSaveProfile() {
    setSavingProfile(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').upsert({ id: user.id, username, last_name: lastName, bio })
    setProfile(p => ({ ...p, username, last_name: lastName, bio }))
    showMessage('ok', 'Perfil actualizado')
    setSavingProfile(false)
  }

  async function handleSaveAuth() {
    if (newPassword && newPassword !== confirmPassword) {
      showMessage('err', 'Las contraseñas no coinciden')
      return
    }
    setSavingAuth(true)
    if (email) await supabase.auth.updateUser({ email })
    if (newPassword) await supabase.auth.updateUser({ password: newPassword })
    setNewPassword('')
    setConfirmPassword('')
    showMessage('ok', 'Datos de acceso actualizados')
    setSavingAuth(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f6f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9c9490', fontSize: '13px', letterSpacing: '0.02em' }}>cargando…</p>
    </div>
  )

  const initials = username ? username[0].toUpperCase() : '?'
  const fullName = [username, lastName].filter(Boolean).join(' ')

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8f6f2',
      fontFamily: "'Inter', -apple-system, sans-serif",
      paddingBottom: '100px',
    }}>

      {/* ── Top blur ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '80px', zIndex: 30,
        background: 'linear-gradient(to bottom, rgba(248,246,242,1) 0%, rgba(248,246,242,0.8) 60%, transparent 100%)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* ── Header with back button ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '52px 20px 12px',
        position: 'relative', zIndex: 10,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'white', border: '0.5px solid rgba(26,23,20,0.10)',
            borderRadius: '50%', width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#9c9490',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1714', letterSpacing: '-0.01em' }}>
          Mi perfil
        </p>
        <button
          onClick={() => supabase.auth.signOut().then(() => navigate('/'))}
          style={{
            background: 'white', border: '0.5px solid rgba(26,23,20,0.10)',
            borderRadius: '50%', width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#9c9490', fontSize: '11px',
          }}
        >
          ✕
        </button>
      </div>

      {/* ── Avatar hero ── */}
      <div style={{ textAlign: 'center', padding: '16px 20px 32px' }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: '#fdf1eb',
          border: '2px solid rgba(232,98,42,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
          fontSize: '26px', fontWeight: 800, color: '#e8622a',
          letterSpacing: '-0.02em',
        }}>
          {initials}
        </div>
        <p style={{ fontSize: '18px', fontWeight: 800, color: '#1a1714', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          {fullName || 'Sin nombre'}
        </p>
        {bio && (
          <p style={{ fontSize: '12px', color: '#9c9490', marginTop: '5px', letterSpacing: '-0.005em', lineHeight: 1.5, maxWidth: '240px', margin: '6px auto 0' }}>
            {bio}
          </p>
        )}
      </div>

      {/* ── Toast ── */}
      {message && (
        <div style={{
          margin: '0 20px 20px',
          padding: '12px 16px',
          borderRadius: '14px',
          background: message.type === 'ok' ? '#f0faf4' : '#fdf2f2',
          border: `0.5px solid ${message.type === 'ok' ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`,
          fontSize: '12px',
          fontWeight: 600,
          color: message.type === 'ok' ? '#16a34a' : '#dc2626',
          letterSpacing: '-0.005em',
        }}>
          {message.type === 'ok' ? '✓ ' : '✗ '}{message.text}
        </div>
      )}

      {/* ── Form ── */}
      <div style={{ padding: '0 20px', maxWidth: '480px', margin: '0 auto' }}>

        {/* Perfil público */}
        <SectionLabel>Perfil público</SectionLabel>
        <FieldGroup>
          <Field label="Nombre">
            <input
              style={inputStyle}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Tu nombre"
            />
          </Field>
          <Field label="Apellidos">
            <input
              style={inputStyle}
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Tus apellidos"
            />
          </Field>
          <Field label="Bio" divider={false}>
            <textarea
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.55 }}
              rows={3}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Cuéntanos algo sobre ti…"
            />
          </Field>
        </FieldGroup>
        <PrimaryButton onClick={handleSaveProfile} disabled={savingProfile} loading={savingProfile}>
          Guardar perfil
        </PrimaryButton>

        {/* Separador */}
        <div style={{ height: '32px' }} />

        {/* Acceso */}
        <SectionLabel>Acceso</SectionLabel>
        <FieldGroup>
          <Field label="Email">
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Nueva contraseña">
            <input
              style={inputStyle}
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Dejar vacío para no cambiar"
            />
          </Field>
          <Field label="Confirmar contraseña" divider={false}>
            <input
              style={inputStyle}
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repite la nueva contraseña"
            />
          </Field>
        </FieldGroup>
        <PrimaryButton onClick={handleSaveAuth} disabled={savingAuth} loading={savingAuth}>
          Actualizar acceso
        </PrimaryButton>

      </div>

      <Navbar active="/profile" />
    </div>
  )
}