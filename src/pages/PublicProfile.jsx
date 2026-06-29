// src/pages/PublicProfile.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { getGenreStyle } from '../constants/genres'

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

export default function PublicProfile() {
  const [profile, setProfile] = useState(null)
  const [books, setBooks] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [followLoading, setFollowLoading] = useState(false)
  const navigate = useNavigate()
  const { id } = useParams()

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    if (user.id === id) { navigate('/profile'); return }

    const [profileRes, booksRes, finishedRes, sessionsRes, followRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('user_books')
        .select('*, global_books(title, author, genre, cover_url, total_pages)')
        .eq('user_id', id).eq('is_active', true).eq('finished', false),
      supabase.from('user_books').select('id').eq('user_id', id).eq('is_active', true).eq('finished', true),
      supabase.from('reading_sessions').select('pages_read, date, created_at').eq('user_id', id),
      supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', id).maybeSingle(),
    ])

    if (profileRes.data) setProfile(profileRes.data)
    if (booksRes.data) setBooks(booksRes.data.map(flattenUserBook))
    if (sessionsRes.data && finishedRes.data) {
      const sessions = sessionsRes.data
      const totalPages = sessions.reduce((sum, s) => sum + s.pages_read, 0)
      const booksFinished = finishedRes.data.length

      // Streak calculation
      const dates = [...new Set(sessions.map(s => s.date))].sort().reverse()
      let streak = 0
      let current = new Date()
      for (const date of dates) {
        const d = new Date(date)
        const diff = Math.floor((current - d) / (1000 * 60 * 60 * 24))
        if (diff <= 1) { streak++; current = d } else break
      }

      // Favourite genre from finished books
      const genreCount = {}
      finishedRes.data.forEach(b => {
        if (b.genre) genreCount[b.genre] = (genreCount[b.genre] || 0) + 1
      })

      setStats({ totalPages, booksFinished, streak })
    }

    setIsFollowing(!!followRes.data)
    setLoading(false)
  }

  async function handleFollow() {
    if (!currentUser || followLoading) return
    setFollowLoading(true)
    if (isFollowing) {
      await supabase.from('follows').delete()
        .eq('follower_id', currentUser.id).eq('following_id', id)
      setIsFollowing(false)
    } else {
      await supabase.from('follows').insert({
        follower_id: currentUser.id, following_id: id,
      })
      setIsFollowing(true)
    }
    setFollowLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f6f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9c9490', fontSize: '13px' }}>cargando…</p>
    </div>
  )

  if (!profile) return (
    <div style={{ minHeight: '100vh', background: '#f8f6f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9c9490', fontSize: '13px' }}>Usuario no encontrado</p>
    </div>
  )

  const initials = profile.username?.[0]?.toUpperCase() || '?'
  const fullName = [profile.username, profile.last_name].filter(Boolean).join(' ')

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f6f2', paddingBottom: '60px',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>

      {/* Top blur */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '80px', zIndex: 30,
        background: 'linear-gradient(to bottom, rgba(248,246,242,1) 0%, rgba(248,246,242,0.7) 60%, transparent 100%)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '52px 20px 20px', position: 'relative', zIndex: 10,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'white', border: '0.5px solid rgba(26,23,20,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#9c9490',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1714', letterSpacing: '-0.01em' }}>
          Perfil
        </p>
        <div style={{ width: '36px' }} />
      </div>

      <div style={{ padding: '0 20px', maxWidth: '480px', margin: '0 auto' }}>

        {/* Avatar + name + follow */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%',
              background: '#fdf1eb', border: '2px solid rgba(232,98,42,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', fontWeight: 800, color: '#e8622a', flexShrink: 0,
            }}>
              {initials}
            </div>
            <div>
              <p style={{ fontSize: '17px', fontWeight: 800, color: '#1a1714', letterSpacing: '-0.02em' }}>
                {fullName || 'Sin nombre'}
              </p>
              {profile.bio && (
                <p style={{ fontSize: '12px', color: '#9c9490', marginTop: '3px', lineHeight: 1.4 }}>
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          {/* Follow button */}
          <button
            onClick={handleFollow}
            disabled={followLoading}
            style={{
              padding: '9px 18px', borderRadius: '99px',
              fontSize: '12px', fontWeight: 700,
              fontFamily: "'Inter', -apple-system, sans-serif",
              cursor: followLoading ? 'not-allowed' : 'pointer',
              transition: 'all 180ms ease', flexShrink: 0,
              border: isFollowing ? '0.5px solid rgba(26,23,20,0.12)' : 'none',
              background: isFollowing ? 'white' : '#1a1714',
              color: isFollowing ? '#9c9490' : '#f8f6f2',
              opacity: followLoading ? 0.6 : 1,
            }}
          >
            {isFollowing ? 'Siguiendo' : 'Seguir'}
          </button>
        </div>

        {/* Stats row */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
            {[
              { label: 'Páginas', value: stats.totalPages.toLocaleString('es-ES') },
              { label: 'Libros', value: stats.booksFinished },
              { label: 'Racha', value: `${stats.streak}d` },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: 'white', borderRadius: '16px',
                border: '0.5px solid rgba(26,23,20,0.07)',
                padding: '14px 12px', textAlign: 'center',
              }}>
                <p style={{
                  fontSize: '20px', fontWeight: 900, color: '#1a1714',
                  letterSpacing: '-0.03em', lineHeight: 1,
                }}>
                  {value}
                </p>
                <p style={{ fontSize: '9px', fontWeight: 700, color: '#9c9490',
                  letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '4px' }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Currently reading */}
        {books.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{
              fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#9c9490', marginBottom: '12px',
            }}>
              Leyendo ahora
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {books.map(book => {
                const g = getGenreStyle(book.genre)
                const Icon = g.icon
                const pct = book.total_pages > 0
                  ? Math.round((book.current_page / book.total_pages) * 100)
                  : 0

                return (
                  <div key={book.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    background: 'white', borderRadius: '18px',
                    border: '0.5px solid rgba(26,23,20,0.07)',
                    padding: '12px 14px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={book.title} style={{
                        width: '40px', height: '58px', objectFit: 'cover',
                        borderRadius: '6px', flexShrink: 0,
                        boxShadow: '1px 2px 8px rgba(0,0,0,0.12)',
                      }} />
                    ) : (
                      <div className={g.badge} style={{
                        width: '40px', height: '58px', borderRadius: '6px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icon size={18} strokeWidth={1.8} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 800, color: '#1a1714',
                        letterSpacing: '-0.01em', lineHeight: 1.2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {book.title}
                      </p>
                      <p style={{ fontSize: '11px', color: '#9c9490', fontWeight: 500,
                        marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {book.author}
                      </p>
                      {/* Progress */}
                      <div style={{ marginTop: '8px' }}>
                        <div style={{
                          height: '3px', background: 'rgba(26,23,20,0.08)',
                          borderRadius: '99px', overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%', borderRadius: '99px',
                            background: '#e8622a',
                            width: `${Math.max(pct, 2)}%`,
                            transition: 'width 500ms ease',
                          }} />
                        </div>
                        <p style={{ fontSize: '10px', color: '#b8b4b0', marginTop: '4px', fontWeight: 500 }}>
                          {pct}% · p. {book.current_page} de {book.total_pages}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state — not reading anything */}
        {books.length === 0 && (
          <div style={{
            background: 'white', borderRadius: '18px',
            border: '0.5px solid rgba(26,23,20,0.07)',
            padding: '32px 24px', textAlign: 'center',
          }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#9c9490' }}>
              No está leyendo nada ahora mismo
            </p>
          </div>
        )}
      </div>
    </div>
  )
}