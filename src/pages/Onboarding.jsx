// src/pages/Onboarding.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { GENRES } from '../constants/genres'

// ─────────────────────────────────────────────────────────────────────────────
// Folio onboarding — solves cold-start for the future recommender by
// capturing either (a) ratings on recently read books, or (b) favourite
// genres, depending on what the user has available.
//
// Flow:
//   1. Welcome
//   2. Fork: "have you read anything recently?"
//      2a. Yes → search + rate up to 3 books (creates real user_books +
//          rating data — the strongest cold-start signal)
//      2b. No  → pick 3-5 favourite genres (weaker signal, but something)
//   3. Payoff screen — shows what was captured, confirms the shelf begins
//   4. Redirect to /home
// ─────────────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 3

// ── Folio mark — small, used in header ────────────────────────────────────────

function FolioMark() {
  return (
    <svg viewBox="0 0 200 210" width="34" height="36">
      <g transform="translate(105,12)">
        <path fill="#1a1714" d="M0 10 Q0 0 10 0 L84 0 Q90 0 90 6 L90 24 Q90 30 84 30 L38 30 L38 76 Q38 78 40 78 L74 78 Q80 78 80 84 L80 100 Q80 106 74 106 L40 106 Q38 106 38 108 L38 178 Q38 186 30 186 L8 186 Q0 186 0 178 Z"/>
      </g>
      <g transform="translate(10,12)">
        <path fill="#c9a87c" d="M0 14 Q0 8 6 7 L70 0 L70 178 L6 186 Q0 187 0 181 Z"/>
        <path fill="#f8f6f2" d="M8 18 L62 12 L62 170 L8 176 Z"/>
      </g>
    </svg>
  )
}

// ── Progress dots ──────────────────────────────────────────────────────────────

function ProgressDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? '20px' : '6px', height: '6px',
          borderRadius: '99px',
          background: i <= current ? '#c9a87c' : 'rgba(26,23,20,0.12)',
          transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        }} />
      ))}
    </div>
  )
}

// ── Star rating input ────────────────────────────────────────────────────────

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
            fontSize: '24px', lineHeight: 1,
            color: s <= (hover || value) ? '#e8622a' : 'rgba(26,23,20,0.14)',
            transform: s <= (hover || value) ? 'scale(1.1)' : 'scale(1)',
            transition: 'all 150ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

// ── Step card wrapper — handles the slide-in transition ───────────────────────

function StepCard({ children, stepKey }) {
  return (
    <div key={stepKey} style={{ animation: 'slideIn 420ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [path, setPath] = useState(null) // 'rate' | 'genres' | null
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('')
  const navigate = useNavigate()

  // ── Path A: rate recent books ──────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState([])
  const [ratedBooks, setRatedBooks] = useState([]) // { ...book, rating }
  const searchAbortRef = useRef(null)

  // ── Path B: favourite genres ─────────────────────────────────────────────────
  const [selectedGenres, setSelectedGenres] = useState([])

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        supabase.from('profiles').select('username').eq('id', user.id).single()
          .then(({ data }) => { if (data) setUsername(data.username) })
      }
    })
  }, [])

  // ── Search for books to rate ─────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length > 2) executeSearch()
      else setResults([])
    }, 450)
    return () => clearTimeout(timer)
  }, [query])

  async function executeSearch() {
    if (searchAbortRef.current) searchAbortRef.current.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller
    setSearching(true)

    try {
      const { data: localBooks } = await supabase
        .from('global_books').select('*').ilike('title', `%${query.trim()}%`).limit(4)

      let googleResults = []
      try {
        const res = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent('intitle:' + query.trim())}&maxResults=5&langRestrict=es`,
          { signal: controller.signal }
        )
        if (res.ok) {
          const data = await res.json()
          googleResults = (data.items || [])
            .filter(item => item.volumeInfo?.title)
            .map(item => ({
              source: 'google',
              google_books_id: item.id,
              title: item.volumeInfo.title,
              author: item.volumeInfo.authors?.[0] || 'Autor desconocido',
              pages: item.volumeInfo.pageCount || null,
              cover: item.volumeInfo.imageLinks?.thumbnail
                ? item.volumeInfo.imageLinks.thumbnail.replace('http://', 'https://').replace('zoom=1', 'zoom=2')
                : null,
              year: item.volumeInfo.publishedDate ? parseInt(item.volumeInfo.publishedDate.slice(0, 4)) : null,
              genre: null,
              isLocal: false,
            }))
        }
      } catch (e) { if (e.name !== 'AbortError') console.error(e) }

      if (controller.signal.aborted) return

      const dbResults = (localBooks || []).map(b => ({ ...b, cover: b.cover_url, isLocal: true }))
      const norm = s => (s || '').toLowerCase().trim()
      const seen = new Set(dbResults.map(b => `${norm(b.title)}|${norm(b.author)}`))
      const filteredGoogle = googleResults.filter(b => {
        const key = `${norm(b.title)}|${norm(b.author)}`
        if (seen.has(key)) return false
        seen.add(key); return true
      })

      setResults([...dbResults, ...filteredGoogle].slice(0, 6))
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }

  function addBookToRate(book) {
    if (ratedBooks.length >= 3) return
    if (ratedBooks.some(b => b.title === book.title && b.author === book.author)) return
    setRatedBooks(prev => [...prev, { ...book, rating: 0 }])
    setQuery('')
    setResults([])
  }

  function setRatingFor(index, rating) {
    setRatedBooks(prev => prev.map((b, i) => i === index ? { ...b, rating } : b))
  }

  function removeRatedBook(index) {
    setRatedBooks(prev => prev.filter((_, i) => i !== index))
  }

  function toggleGenre(value) {
    setSelectedGenres(prev =>
      prev.includes(value) ? prev.filter(g => g !== value) : [...prev, value]
    )
  }

  // ── Save everything and finish ───────────────────────────────────────────────

  async function finishOnboarding() {
    if (!user) { navigate('/home'); return }
    setSaving(true)

    try {
      if (path === 'rate' && ratedBooks.length > 0) {
        for (const book of ratedBooks) {
          if (book.rating === 0) continue

          let bookId = book.isLocal ? book.id : null

          if (!bookId) {
            // Check if it already exists in global_books by title+author
            const { data: existing } = await supabase
              .from('global_books').select('id')
              .ilike('title', book.title).ilike('author', book.author || '').maybeSingle()

            if (existing) {
              bookId = existing.id
            } else {
              const { data: inserted } = await supabase
                .from('global_books')
                .insert({
                  google_books_id: book.google_books_id || null,
                  title: book.title, author: book.author,
                  cover_url: book.cover || null,
                  total_pages: book.pages || null,
                  year: book.year || null,
                  genre: 'otro', // unknown genre from quick search — admin can refine later
                  is_verified: false,
                })
                .select('id').single()
              bookId = inserted?.id
            }
          }

          if (bookId) {
            await supabase.from('user_books').insert({
              user_id: user.id, book_id: bookId,
              current_page: book.pages || 0,
              finished: true,
              finished_at: new Date().toISOString(),
              rating: book.rating,
              is_active: true,
            })
          }
        }
      }

      if (path === 'genres' && selectedGenres.length > 0) {
        // Store favourite genres on the profile for future content-based filtering
        await supabase.from('profiles')
          .update({ favorite_genres: selectedGenres })
          .eq('id', user.id)
      }

      await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id)
    } catch (e) {
      console.error('Onboarding save error', e)
    }

    navigate('/home')
  }

  function skipOnboarding() {
    if (user) supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id)
    navigate('/home')
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f6f2',
      fontFamily: "'Inter', -apple-system, sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '28px 20px 20px',
      }}>
        <FolioMark />
        <ProgressDots current={step} total={TOTAL_STEPS} />
        <button
          onClick={skipOnboarding}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '12px', fontWeight: 600, color: '#9c9490',
            fontFamily: "'Inter', -apple-system, sans-serif",
          }}
        >
          Omitir
        </button>
      </div>

      <div style={{ flex: 1, padding: '0 20px', maxWidth: '480px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <StepCard stepKey="welcome">
            <div style={{ textAlign: 'center', paddingTop: '40px' }}>
              <div style={{ marginBottom: '24px', animation: 'popIn 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>
                <svg viewBox="0 0 200 210" width="64" height="68" style={{ margin: '0 auto' }}>
                  <g transform="translate(105,12)">
                    <path fill="#1a1714" d="M0 10 Q0 0 10 0 L84 0 Q90 0 90 6 L90 24 Q90 30 84 30 L38 30 L38 76 Q38 78 40 78 L74 78 Q80 78 80 84 L80 100 Q80 106 74 106 L40 106 Q38 106 38 108 L38 178 Q38 186 30 186 L8 186 Q0 186 0 178 Z"/>
                  </g>
                  <g transform="translate(10,12)">
                    <path fill="#c9a87c" d="M0 14 Q0 8 6 7 L70 0 L70 178 L6 186 Q0 187 0 181 Z"/>
                    <path fill="#f8f6f2" d="M8 18 L62 12 L62 170 L8 176 Z"/>
                  </g>
                </svg>
              </div>
              <p style={{
                fontSize: '24px', fontWeight: 800, color: '#1a1714',
                letterSpacing: '-0.025em', lineHeight: 1.2, marginBottom: '10px',
              }}>
                Hola{username ? `, ${username}` : ''} 👋
              </p>
              <p style={{
                fontSize: '14px', color: '#9c9490', lineHeight: 1.6,
                maxWidth: '300px', margin: '0 auto',
              }}>
                Tu biblioteca empieza hoy. Cuéntanos un poco de ti para que Folio se adapte a tu forma de leer.
              </p>
            </div>

            <div style={{ flex: 1 }} />

            <button
              onClick={() => setStep(1)}
              style={{
                width: '100%', background: '#1a1714', color: '#f8f6f2',
                border: 'none', borderRadius: '16px', padding: '16px',
                fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em',
                fontFamily: "'Inter', -apple-system, sans-serif",
                cursor: 'pointer', marginBottom: '40px', marginTop: '32px',
              }}
            >
              Empezar
            </button>
          </StepCard>
        )}

        {/* ── Step 1: Fork — rate books or pick genres ── */}
        {step === 1 && !path && (
          <StepCard stepKey="fork">
            <div style={{ paddingTop: '24px', textAlign: 'center' }}>
              <p style={{
                fontSize: '20px', fontWeight: 800, color: '#1a1714',
                letterSpacing: '-0.02em', marginBottom: '8px',
              }}>
                ¿Has leído algo últimamente?
              </p>
              <p style={{ fontSize: '13px', color: '#9c9490', lineHeight: 1.5, marginBottom: '32px' }}>
                Nos ayuda a entender qué te gusta
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => setPath('rate')}
                style={{
                  background: 'white', border: '0.5px solid rgba(26,23,20,0.08)',
                  borderRadius: '20px', padding: '20px', textAlign: 'left',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{
                  width: '44px', height: '44px', borderRadius: '14px',
                  background: '#fdf1eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: '20px' }}>★</span>
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: '#1a1714', letterSpacing: '-0.01em' }}>
                    Sí, he leído algo
                  </p>
                  <p style={{ fontSize: '12px', color: '#9c9490', marginTop: '2px' }}>
                    Valora hasta 3 libros recientes
                  </p>
                </div>
              </button>

              <button
                onClick={() => setPath('genres')}
                style={{
                  background: 'white', border: '0.5px solid rgba(26,23,20,0.08)',
                  borderRadius: '20px', padding: '20px', textAlign: 'left',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{
                  width: '44px', height: '44px', borderRadius: '14px',
                  background: '#f3efe8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: '20px' }}>✨</span>
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: '#1a1714', letterSpacing: '-0.01em' }}>
                    Prefiero elegir géneros
                  </p>
                  <p style={{ fontSize: '12px', color: '#9c9490', marginTop: '2px' }}>
                    Cuéntanos qué te gusta leer
                  </p>
                </div>
              </button>
            </div>
          </StepCard>
        )}

        {/* ── Step 1a: Rate books ── */}
        {step === 1 && path === 'rate' && (
          <StepCard stepKey="rate">
            <div style={{ paddingTop: '12px' }}>
              <button
                onClick={() => setPath(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9c9490', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}
              >
                ← Volver
              </button>
              <p style={{ fontSize: '18px', fontWeight: 800, color: '#1a1714', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                Valora hasta 3 libros
              </p>
              <p style={{ fontSize: '12px', color: '#9c9490', marginBottom: '16px' }}>
                Busca los últimos libros que has terminado
              </p>

              {ratedBooks.length < 3 && (
                <div style={{ position: 'relative', marginBottom: '12px' }}>
                  <input
                    type="text"
                    placeholder="Buscar un libro…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    style={{
                      width: '100%', background: 'white',
                      border: '0.5px solid rgba(26,23,20,0.10)', borderRadius: '14px',
                      padding: '12px 16px', fontSize: '13px', color: '#1a1714',
                      fontFamily: "'Inter', -apple-system, sans-serif",
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  {searching && (
                    <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }}>
                      <div style={{
                        width: '14px', height: '14px', border: '2px solid #c9a87c',
                        borderTopColor: 'transparent', borderRadius: '50%',
                        animation: 'spin 0.7s linear infinite',
                      }} />
                    </div>
                  )}

                  {results.length > 0 && (
                    <div style={{
                      position: 'absolute', left: 0, right: 0, top: '100%', marginTop: '6px',
                      background: 'white', borderRadius: '14px',
                      border: '0.5px solid rgba(26,23,20,0.08)',
                      boxShadow: '0 8px 28px rgba(0,0,0,0.10)', overflow: 'hidden', zIndex: 10,
                    }}>
                      {results.map((book, i) => (
                        <div
                          key={i}
                          onClick={() => addBookToRate(book)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 12px', cursor: 'pointer',
                            borderBottom: i < results.length - 1 ? '0.5px solid rgba(26,23,20,0.05)' : 'none',
                          }}
                        >
                          {book.cover ? (
                            <img src={book.cover} alt="" style={{ width: '28px', height: '40px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: '28px', height: '40px', borderRadius: '4px', background: '#f0ede8', flexShrink: 0 }} />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '12px', fontWeight: 700, color: '#1a1714', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {book.title}
                            </p>
                            <p style={{ fontSize: '10px', color: '#9c9490' }}>{book.author}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Rated books list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {ratedBooks.map((book, i) => (
                  <div key={i} style={{
                    background: 'white', borderRadius: '18px',
                    border: '0.5px solid rgba(26,23,20,0.07)', padding: '14px',
                    display: 'flex', gap: '12px', alignItems: 'center',
                    animation: 'popIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
                  }}>
                    {book.cover ? (
                      <img src={book.cover} alt="" style={{ width: '38px', height: '54px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '38px', height: '54px', borderRadius: '6px', background: '#f0ede8', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 800, color: '#1a1714', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {book.title}
                      </p>
                      <p style={{ fontSize: '11px', color: '#9c9490', marginBottom: '6px' }}>{book.author}</p>
                      <StarRating value={book.rating} onChange={r => setRatingFor(i, r)} />
                    </div>
                    <button
                      onClick={() => removeRatedBook(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b8b4b0', fontSize: '14px', flexShrink: 0, alignSelf: 'flex-start' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {ratedBooks.length === 0 && (
                <p style={{ textAlign: 'center', fontSize: '12px', color: '#b8b4b0', padding: '24px 0' }}>
                  Busca un libro arriba para empezar
                </p>
              )}
            </div>
          </StepCard>
        )}

        {/* ── Step 1b: Pick genres ── */}
        {step === 1 && path === 'genres' && (
          <StepCard stepKey="genres">
            <div style={{ paddingTop: '12px' }}>
              <button
                onClick={() => setPath(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9c9490', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}
              >
                ← Volver
              </button>
              <p style={{ fontSize: '18px', fontWeight: 800, color: '#1a1714', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                Elige tus géneros favoritos
              </p>
              <p style={{ fontSize: '12px', color: '#9c9490', marginBottom: '18px' }}>
                Selecciona los que más te gusten
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {GENRES.map(g => {
                  const Icon = g.icon
                  const isSelected = selectedGenres.includes(g.value)
                  return (
                    <button
                      key={g.value}
                      onClick={() => toggleGenre(g.value)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl text-xs font-semibold transition-all border ${
                        isSelected
                          ? `${g.badge} border-transparent shadow-sm scale-[1.04]`
                          : 'bg-white text-stone-500 border-stone-200/60'
                      }`}
                      style={{ transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 180ms ease' }}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                      <span style={{ textAlign: 'center', lineHeight: 1.3 }}>{g.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </StepCard>
        )}

        {/* ── Step 2: Payoff ── */}
        {step === 2 && (
          <StepCard stepKey="payoff">
            <div style={{ textAlign: 'center', paddingTop: '40px' }}>
              <div style={{ animation: 'popIn 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both', marginBottom: '20px' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: '#fdf1eb', margin: '0 auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '28px' }}>✓</span>
                </div>
              </div>
              <p style={{ fontSize: '22px', fontWeight: 800, color: '#1a1714', letterSpacing: '-0.025em', marginBottom: '10px' }}>
                Tu estantería empieza aquí
              </p>

              {path === 'rate' && ratedBooks.filter(b => b.rating > 0).length > 0 && (
                <>
                  <p style={{ fontSize: '13px', color: '#9c9490', marginBottom: '24px' }}>
                    Has añadido {ratedBooks.filter(b => b.rating > 0).length} libro{ratedBooks.filter(b => b.rating > 0).length !== 1 ? 's' : ''} a tu biblioteca
                  </p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '8px' }}>
                    {ratedBooks.filter(b => b.rating > 0).slice(0, 3).map((book, i) => (
                      <div key={i} style={{ animation: `popIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 100}ms both` }}>
                        {book.cover ? (
                          <img src={book.cover} alt="" style={{
                            width: '56px', height: '80px', objectFit: 'cover',
                            borderRadius: '6px', boxShadow: '0 6px 18px rgba(0,0,0,0.14)',
                          }} />
                        ) : (
                          <div style={{ width: '56px', height: '80px', borderRadius: '6px', background: '#e8e4df' }} />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {path === 'genres' && selectedGenres.length > 0 && (
                <>
                  <p style={{ fontSize: '13px', color: '#9c9490', marginBottom: '20px' }}>
                    Hemos guardado tus géneros favoritos
                  </p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {selectedGenres.map((gv, i) => {
                      const g = GENRES.find(x => x.value === gv)
                      if (!g) return null
                      return (
                        <span key={gv} className={g.badge} style={{
                          fontSize: '11px', fontWeight: 700, padding: '5px 12px',
                          borderRadius: '99px',
                          animation: `popIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 60}ms both`,
                        }}>
                          {g.label}
                        </span>
                      )
                    })}
                  </div>
                </>
              )}

              {!path && (
                <p style={{ fontSize: '13px', color: '#9c9490' }}>
                  Puedes añadir tus libros en cualquier momento
                </p>
              )}
            </div>

            <div style={{ flex: 1 }} />

            <button
              onClick={finishOnboarding}
              disabled={saving}
              style={{
                width: '100%', background: saving ? '#e8e4df' : '#1a1714',
                color: saving ? '#9c9490' : '#f8f6f2',
                border: 'none', borderRadius: '16px', padding: '16px',
                fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em',
                fontFamily: "'Inter', -apple-system, sans-serif",
                cursor: saving ? 'not-allowed' : 'pointer',
                marginBottom: '40px', marginTop: '32px',
              }}
            >
              {saving ? 'Preparando tu biblioteca…' : 'Ir a mi estantería'}
            </button>
          </StepCard>
        )}
      </div>

      {/* Bottom continue button for step 1 (rate/genres paths) */}
      {step === 1 && path && (
        <div style={{ padding: '16px 20px 32px', maxWidth: '480px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <button
            onClick={() => setStep(2)}
            disabled={
              (path === 'rate' && ratedBooks.filter(b => b.rating > 0).length === 0) ||
              (path === 'genres' && selectedGenres.length === 0)
            }
            style={{
              width: '100%',
              background: (
                (path === 'rate' && ratedBooks.filter(b => b.rating > 0).length === 0) ||
                (path === 'genres' && selectedGenres.length === 0)
              ) ? '#e8e4df' : '#1a1714',
              color: (
                (path === 'rate' && ratedBooks.filter(b => b.rating > 0).length === 0) ||
                (path === 'genres' && selectedGenres.length === 0)
              ) ? '#9c9490' : '#f8f6f2',
              border: 'none', borderRadius: '16px', padding: '16px',
              fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em',
              fontFamily: "'Inter', -apple-system, sans-serif",
              cursor: 'pointer', transition: 'all 200ms ease',
            }}
          >
            Continuar
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}