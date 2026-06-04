import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

function Profile() {
  const [profile, setProfile] = useState(null)
  const [username, setUsername] = useState('')
  const [lastName, setLastName] = useState('')
  const [bio, setBio] = useState('')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [editing, setEditing] = useState(false)
  const [editingAuth, setEditingAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    fetchProfileData()
  }, [])

  async function fetchProfileData() {
    const { data: { user } } = await supabase.auth.getUser()
    setEmail(user.email)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileData) {
      setProfile(profileData)
      setUsername(profileData.username || '')
      setLastName(profileData.last_name || '')
      setBio(profileData.bio || '')
    }
    setLoading(false)
  }

  async function handleSaveProfile() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').upsert({
      id: user.id,
      username,
      last_name: lastName,
      bio
    })
    setProfile(p => ({ ...p, username, last_name: lastName, bio }))
    setEditing(false)
    setMessage('Perfil actualizado')
    setTimeout(() => setMessage(''), 3000)
    setSaving(false)
  }

  async function handleSaveAuth() {
    setSaving(true)
    if (email) {
      await supabase.auth.updateUser({ email })
    }
    if (newPassword) {
      if (newPassword !== confirmPassword) {
        setMessage('Las contraseñas no coinciden')
        setSaving(false)
        return
      }
      await supabase.auth.updateUser({ password: newPassword })
    }
    setEditingAuth(false)
    setNewPassword('')
    setConfirmPassword('')
    setMessage('Datos de acceso actualizados')
    setTimeout(() => setMessage(''), 3000)
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen bg-stone-950 flex items-center justify-center text-white">Cargando...</div>

  return (
    <div className="min-h-screen bg-stone-950 text-white">

      {/* Header / Navbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
        <h1 className="text-xl font-bold tracking-tight">folio</h1>
      </div>

      {/* Tabs de Navegación */}
      <div className="flex border-b border-stone-800">
        <button
          onClick={() => navigate('/feed')}
          className="flex-1 py-3 text-sm font-semibold text-stone-400 hover:text-white transition-colors"
        >
          Inicio
        </button>
        <button
          onClick={() => navigate('/home')}
          className="flex-1 py-3 text-sm font-semibold text-stone-400 hover:text-white transition-colors"
        >
          Registro
        </button>
        <button className="flex-1 py-3 text-sm font-semibold text-white border-b-2 border-amber-500">
          Estadísticas
        </button>
        <button
          onClick={() => navigate('/profile')}
          className="flex-1 py-3 text-sm font-semibold text-stone-400 hover:text-white transition-colors"
        >
          Perfil
        </button>
      </div>

      <div className="px-6 py-8 space-y-6">

        {message && (
          <div className="bg-green-900 border border-green-700 text-green-300 rounded-xl px-4 py-3 text-sm">
            ✓ {message}
          </div>
        )}

        {/* Avatar y nombre */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center text-2xl font-bold text-stone-950">
            {username ? username[0].toUpperCase() : '?'}
          </div>
          <div>
            <p className="font-bold text-lg">{username || 'Sin nombre'} {lastName}</p>
            {bio && <p className="text-stone-400 text-sm">{bio}</p>}
          </div>
        </div>

        {/* Editar perfil */}
        <div className="bg-stone-900 rounded-2xl border border-stone-800 overflow-hidden">
          <button
            onClick={() => setEditing(!editing)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-stone-800 transition-colors"
          >
            <span>Editar perfil</span>
            <span className="text-stone-400">{editing ? '↑' : '↓'}</span>
          </button>
          {editing && (
            <div className="px-5 pb-5 space-y-3 border-t border-stone-800">
              <div className="pt-3">
                <p className="text-stone-400 text-xs mb-1">Nombre</p>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full bg-stone-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
              <div>
                <p className="text-stone-400 text-xs mb-1">Apellidos</p>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Tus apellidos"
                  className="w-full bg-stone-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
              <div>
                <p className="text-stone-400 text-xs mb-1">Bio</p>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Cuéntanos algo sobre ti..."
                  rows={3}
                  className="w-full bg-stone-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm resize-none"
                />
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl py-3 text-sm transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          )}
        </div>

        {/* Editar email y contraseña */}
        <div className="bg-stone-900 rounded-2xl border border-stone-800 overflow-hidden">
          <button
            onClick={() => setEditingAuth(!editingAuth)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-stone-800 transition-colors"
          >
            <span>Email y contraseña</span>
            <span className="text-stone-400">{editingAuth ? '↑' : '↓'}</span>
          </button>
          {editingAuth && (
            <div className="px-5 pb-5 space-y-3 border-t border-stone-800">
              <div className="pt-3">
                <p className="text-stone-400 text-xs mb-1">Email</p>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-stone-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
              <div>
                <p className="text-stone-400 text-xs mb-1">Nueva contraseña</p>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Dejar en blanco para no cambiar"
                  className="w-full bg-stone-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
              <div>
                <p className="text-stone-400 text-xs mb-1">Confirmar contraseña</p>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  className="w-full bg-stone-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
              <button
                onClick={handleSaveAuth}
                disabled={saving}
                className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl py-3 text-sm transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Actualizar acceso'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default Profile