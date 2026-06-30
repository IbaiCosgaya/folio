// src/pages/Descubrir.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { getGenreStyle } from '../constants/genres'
import Navbar from '../components/layout/Navbar'

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton shelf — same pattern as Feed.jsx ComingSoonShelf.
// Replace inner content with real recommender data when the engine is built.
// ─────────────────────────────────────────────────────────────────────────────

function ComingSoonShelf({ label, tag, description }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <p style={{
          fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: '#9c9490',
        }}>
          {label}
        </p>
        <span style={{
          fontSize: '8px', fontWeight: 700, letterSpacing: '0.04em',
          background: '#f0f4ff', color: '#4f7fff',
          padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase',
        }}>
          {tag}
        </span>
      </div>
      {description && (
        <p style={{ fontSize: '11px', color: '#b8b4b0', marginBottom: '12px', lineHeight: 1.4 }}>
          {description}
        </p>
      )}
      {/* TODO Fase 6: replace with real book cards from the recommender engine */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ minWidth: '92px', flexShrink: 0 }}>
            <div style={{
              width: '92px', height: '128px', borderRadius: '10px',
              background: 'rgba(26,23,20,0.05)',
              border: '0.5px solid rgba(26,23,20,0.06)', marginBottom: '6px',
            }} />
            <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(26,23,20,0.05)', width: '70%', marginBottom: '5px' }} />
            <div style={{ height: '7px', borderRadius: '4px', background: 'rgba(26,23,20,0.04)', width: '45%' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Trending book card (horizontal shelf item) ────────────────────────────────

function TrendingCard({ book, onClick }) {
  const g = getGenreStyle(book.genre)
  const Icon = g.icon

  return (
    <div onClick={onClick} style={{ minWidth: '92px', flexShrink: 0, cursor: 'pointer' }}>
      <div style={{
        width: '92px', height: '128px', borderRadius: '10px',
        overflow: 'hidden', marginBottom: '7px', position: 'relative',
        boxShadow: '0 4px 14px rgba(0,0,0,0.10)',
      }}>
        {book.cover_url ? (
          <img src={book.cover_url} alt={book.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        ) : (
          <div style={{
            width: '100%', height: '100%', background: g.spine,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={24} strokeWidth={1.6} color="rgba(255,255,255,0.8)" />
          </div>
        )}
        {book.readerCount && (
          <div style={{
            position: 'absolute', top: '6px', right: '6px',
            background: 'rgba(26,23,20,0.78)', backdropFilter: 'blur(6px)',
            borderRadius: '99px', padding: '2px 7px',
            display: 'flex', alignItems: 'center', gap: '3px',
          }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
              <circle cx="9" cy="7" r="4"/>
              <path d="M2 21v-2a7 7 0 0 1 13-3.5" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'white' }}>
              {book.readerCount}
            </span>
          </div>
        )}
      </div>
      <p style={{
        fontSize: '11px', fontWeight: 700, color: '#1a1714',
        letterSpacing: '-0.005em', lineHeight: 1.3,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {book.title}
      </p>
      <p style={{ fontSize: '10px', color: '#9c9490', marginTop: '2px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {book.author}
      </p>
    </div>
  )
}

// ── Top rated book card (with stars) ───────────────────────────────────────────

function TopRatedCard({ book, onClick }) {
  const g = getGenreStyle(book.genre)
  const Icon = g.icon

  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      background: 'white', borderRadius: '16px',
      border: '0.5px solid rgba(26,23,20,0.07)',
      padding: '10px 14px', cursor: 'pointer',
    }}>
      {book.cover_url ? (
        <img src={book.cover_url} alt={book.title} style={{
          width: '38px', height: '54px', objectFit: 'cover',
          borderRadius: '6px', flexShrink: 0,
          boxShadow: '1px 2px 6px rgba(0,0,0,0.10)',
        }} />
      ) : (
        <div style={{
          width: '38px', height: '54px', borderRadius: '6px',
          background: g.spine, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} strokeWidth={1.8} color="rgba(255,255,255,0.8)" />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 800, color: '#1a1714',
          letterSpacing: '-0.01em', lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {book.title}
        </p>
        <p style={{ fontSize: '11px', color: '#9c9490', marginTop: '2px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {book.author}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
        <span style={{ fontSize: '13px', color: '#e8622a' }}>★</span>
        <span style={{ fontSize: '13px', fontWeight: 800, color: '#1a1714', letterSpacing: '-0.01em' }}>
          {book.avgRating.toFixed(1)}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function Descubrir() {
  const [loading, setLoading] = useState(true)
  const [trending, setTrending] = useState([])
  const [topRated, setTopRated] = useState([])
  const [hasFollows, setHasFollows] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { fetchDiscover() }, [])

  async function fetchDiscover() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Who does the user follow?
    const { data: followData } = await supabase
      .from('follows').select('following_id').eq('follower_id', user.id)

    const followingIds = (followData || []).map(f => f.following_id)

    if (followingIds.length === 0) {
      setHasFollows(false)
      setLoading(false)
      return
    }

    await Promise.all([
      fetchTrending(followingIds),
      fetchTopRated(followingIds),
    ])

    setLoading(false)
  }

  // Trending: books with the most reading_sessions in the last 7 days among followed users
  async function fetchTrending(followingIds) {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const cutoff = sevenDaysAgo.toISOString().split('T')[0]

    const { data: sessions } = await supabase
      .from('reading_sessions')
      .select('user_id, book_id, user_books(book_id, global_books(title, author, cover_url, genre))')
      .in('user_id', followingIds)
      .gte('date', cutoff)

    if (!sessions) return

    // Group by global_books.id, count distinct readers
    const bookMap = {}
    sessions.forEach(s => {
      const gb = s.user_books?.global_books
      const globalId = s.user_books?.book_id
      if (!gb || !globalId) return

      if (!bookMap[globalId]) {
        bookMap[globalId] = {
          id: globalId,
          title: gb.title, author: gb.author,
          cover_url: gb.cover_url, genre: gb.genre,
          readers: new Set(),
        }
      }
      bookMap[globalId].readers.add(s.user_id)
    })

    const trendingList = Object.values(bookMap)
      .map(b => ({ ...b, readerCount: b.readers.size }))
      .sort((a, b) => b.readerCount - a.readerCount)
      .slice(0, 8)

    setTrending(trendingList)
  }

  // Top rated: books with highest average rating among finished books by followed users
  async function fetchTopRated(followingIds) {
    const { data: userBooks } = await supabase
      .from('user_books')
      .select('book_id, rating, global_books(title, author, cover_url, genre)')
      .in('user_id', followingIds)
      .eq('finished', true)
      .not('rating', 'is', null)

    if (!userBooks) return

    const bookMap = {}
    userBooks.forEach(ub => {
      const gb = ub.global_books
      if (!gb) return
      if (!bookMap[ub.book_id]) {
        bookMap[ub.book_id] = {
          id: ub.book_id,
          title: gb.title, author: gb.author,
          cover_url: gb.cover_url, genre: gb.genre,
          ratings: [],
        }
      }
      bookMap[ub.book_id].ratings.push(ub.rating)
    })

    const topRatedList = Object.values(bookMap)
      .map(b => ({
        ...b,
        avgRating: b.ratings.reduce((s, r) => s + r, 0) / b.ratings.length,
        ratingCount: b.ratings.length,
      }))
      .filter(b => b.avgRating >= 3.5) // only show genuinely well-rated books
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 6)

    setTopRated(topRatedList)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f6f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9c9490', fontSize: '13px' }}>cargando…</p>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f6f2', paddingBottom: '100px',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>

      {/* Top blur */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '80px', zIndex: 30,
        background: 'linear-gradient(to bottom, rgba(248,246,242,1) 0%, rgba(248,246,242,0.8) 60%, transparent 100%)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ padding: '52px 20px 4px' }}>
        <p style={{
          fontSize: '22px', fontWeight: 800, color: '#1a1714',
          letterSpacing: '-0.025em', lineHeight: 1.15,
        }}>
          Descubrir
        </p>
        <p style={{ fontSize: '13px', color: '#9c9490', marginTop: '3px', letterSpacing: '-0.005em' }}>
          Qué está leyendo tu comunidad
        </p>
      </div>

      <div style={{ padding: '20px 20px 0', maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {!hasFollows ? (
          /* Empty state: not following anyone yet */
          <div style={{
            background: 'white', borderRadius: '20px',
            border: '0.5px solid rgba(26,23,20,0.07)',
            padding: '36px 24px', textAlign: 'center',
          }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1714', marginBottom: '6px' }}>
              Aún no sigues a nadie
            </p>
            <p style={{ fontSize: '12px', color: '#9c9490', lineHeight: 1.55, marginBottom: '18px' }}>
              Sigue a otros lectores en el feed para descubrir qué están leyendo y qué les gusta.
            </p>
            <button
              onClick={() => navigate('/feed')}
              style={{
                background: '#1a1714', color: '#f8f6f2', border: 'none',
                borderRadius: '12px', padding: '11px 22px',
                fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em',
                fontFamily: "'Inter', -apple-system, sans-serif", cursor: 'pointer',
              }}
            >
              Ir al feed
            </button>
          </div>
        ) : (
          <>
            {/* Trending among followed */}
            {trending.length > 0 && (
              <div>
                <p style={{
                  fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: '#9c9490', marginBottom: '4px',
                }}>
                  Tendencia esta semana
                </p>
                <p style={{ fontSize: '11px', color: '#b8b4b0', marginBottom: '12px', lineHeight: 1.4 }}>
                  Lo que más están leyendo tus seguidos
                </p>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {trending.map(book => (
                    <TrendingCard key={book.id} book={book}
                      onClick={() => navigate('/add-book')} />
                  ))}
                </div>
              </div>
            )}

            {/* Top rated among followed */}
            {topRated.length > 0 && (
              <div>
                <p style={{
                  fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: '#9c9490', marginBottom: '4px',
                }}>
                  Mejor valorados
                </p>
                <p style={{ fontSize: '11px', color: '#b8b4b0', marginBottom: '12px', lineHeight: 1.4 }}>
                  Los favoritos de tu comunidad
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {topRated.map(book => (
                    <TopRatedCard key={book.id} book={book}
                      onClick={() => navigate('/add-book')} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state if no activity yet */}
            {trending.length === 0 && topRated.length === 0 && (
              <div style={{
                background: 'white', borderRadius: '20px',
                border: '0.5px solid rgba(26,23,20,0.07)',
                padding: '32px 24px', textAlign: 'center',
              }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#9c9490' }}>
                  Todavía no hay suficiente actividad entre tus seguidos
                </p>
              </div>
            )}

            {/* Content-based recommendations — skeleton ready for Fase 6 */}
            {/* TODO Fase 6: connect to content-based filtering engine
                (genre + author + description embeddings + user reading history) */}
            <ComingSoonShelf
              label="Para ti"
              tag="Próximamente"
              description="Recomendaciones basadas en lo que sueles leer"
            />

            {/* Collaborative filtering — skeleton ready for Fase 6 */}
            {/* TODO Fase 6: connect to collaborative filtering engine
                (similar readers + rating patterns + reading pace compatibility) */}
            <ComingSoonShelf
              label="Lectores como tú"
              tag="Próximamente"
              description="Basado en usuarios con gustos similares a los tuyos"
            />
          </>
        )}
      </div>

      <Navbar active="/descubrir" />
    </div>
  )
}