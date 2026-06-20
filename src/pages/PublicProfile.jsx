import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'

const GENRE_STYLES = {
  fantasia:       { color: 'bg-purple-500',  icon: '🔮' },
  ciencia_ficcion:{ color: 'bg-blue-500',    icon: '🚀' },
  thriller:       { color: 'bg-red-500',     icon: '🔪' },
  romance:        { color: 'bg-pink-500',    icon: '💕' },
  historica:      { color: 'bg-yellow-600',  icon: '⚔️' },
  terror:         { color: 'bg-orange-600',  icon: '👻' },
  no_ficcion:     { color: 'bg-teal-500',    icon: '📚' },
  autobiografia:  { color: 'bg-green-500',   icon: '✍️' },
  otro:           { color: 'bg-stone-500',   icon: '📖' },
}

function flattenUserBook(ub) {
  return {
    id: ub.id,
    current_page: ub.current_page,
    finished: ub.finished,
    title: ub.global_books?.title,
    author: ub.global_books?.author,
    genre: ub.global_books?.genre,
    cover_url: ub.global_books?.cover_url,
    total_pages: ub.global_books?.total_pages,
  }
}

function PublicProfile() {
  const [profile, setProfile] = useState(null)
  const [books, setBooks] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const navigate = useNavigate()
  const { id } = useParams()

  useEffect(() => {
    fetchAll()
  }, [id])

  async function fetchAll() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    if (user.id === id) {
      navigate('/profile')
      return
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()
    if (profileData) setProfile(profileData)

    const { data: booksData } = await supabase
      .from('user_books')
      .select('*, global_books(title, author, genre, cover_url, total_pages)')
      .eq('user_id', id)
      .eq('is_active', true)
      .eq('finished', false)
    if (booksData) setBooks(booksData.map(flattenUserBook))

    const { data: finishedData } = await supabase
      .from('user_books')
      .select('id')
      .eq('user_id', id)
      .eq('is_active', true)
      .eq('finished', true)

    const { data: sessionsData } = await supabase
      .from('reading_sessions')
      .select('pages_read')
      .eq('user_id', id)

    if (sessionsData && finishedData) {
      const totalPages = sessionsData.reduce((sum, s) => sum + s.pages_read, 0)
      const booksFinished = finishedData.length
      setStats({ totalPages, booksFinished })
    }

    const { data: followData } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', id)
      .single()
    setIsFollowing(!!followData)

    setLoading(false)
  }

  async function handleFollow() {
    if (isFollowing) {
      await supabase.from('follows').delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', id)
      setIsFollowing(false)
    } else {
      await supabase.from('follows').insert({
        follower_id: currentUser.id,
        following_id: id
      })
      setIsFollowing(true)
    }
  }

  if (loading) return <div className="min-h-screen bg-stone-950 flex items-center justify-center text-white">Cargando...</div>
  if (!profile) return <div className="min-h-screen bg-stone-950 flex items-center justify-center text-white">Usuario no encontrado</div>

  return (
    <div className="min-h-screen bg-stone-950 text-white">

      <div className="flex items-center gap-4 px-6 py-4 border-b border-stone-800">
        <button onClick={() => navigate(-1)} className="text-stone-400 hover:text-white transition-colors">
          ← Volver
        </button>
        <h1 className="text-lg font-semibold">Perfil</h1>
      </div>

      <div className="px-6 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center text-2xl font-bold text-stone-950">
              {profile.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="font-bold text-lg">{profile.username} {profile.last_name}</p>
              {profile.bio && <p className="text-stone-400 text-sm">{profile.bio}</p>}
            </div>
          </div>
          <button
            onClick={handleFollow}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              isFollowing
                ? 'border border-stone-700 text-stone-400 hover:border-red-500 hover:text-red-500'
                : 'bg-amber-500 hover:bg-amber-400 text-stone-950'
            }`}
          >
            {isFollowing ? 'Siguiendo' : 'Seguir'}
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-stone-900 rounded-2xl p-4 border border-stone-800">
              <p className="text-stone-400 text-xs mb-1">Páginas leídas</p>
              <p className="text-3xl font-bold text-white">{stats.totalPages}</p>
            </div>
            <div className="bg-stone-900 rounded-2xl p-4 border border-stone-800">
              <p className="text-stone-400 text-xs mb-1">Libros terminados</p>
              <p className="text-3xl font-bold text-white">{stats.booksFinished}</p>
            </div>
          </div>
        )}

        {books.length > 0 && (
          <div>
            <p className="text-stone-400 text-sm mb-3">Leyendo ahora</p>
            <div className="space-y-3">
              {books.map(book => (
                <div key={book.id} className="bg-stone-900 rounded-2xl p-4 border border-stone-800 flex items-center gap-3">
                  {book.cover_url ? (
                    <img src={book.cover_url} alt={book.title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className={`w-10 h-14 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ${GENRE_STYLES[book.genre]?.color || 'bg-stone-700'}`}>
                      {GENRE_STYLES[book.genre]?.icon || '📖'}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{book.title}</p>
                    <p className="text-stone-400 text-xs">{book.author}</p>
                    <div className="w-full bg-stone-800 rounded-full h-1.5 mt-2">
                      <div
                        className={`${GENRE_STYLES[book.genre]?.color || 'bg-amber-500'} h-1.5 rounded-full`}
                        style={{ width: `${Math.max((book.current_page / book.total_pages) * 100, 2)}%` }}
                      />
                    </div>
                    <p className="text-stone-600 text-xs mt-1">
                      {Math.round((book.current_page / book.total_pages) * 100)}% · p. {book.current_page} de {book.total_pages}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default PublicProfile