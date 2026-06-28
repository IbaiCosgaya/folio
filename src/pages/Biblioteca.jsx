// src/pages/Biblioteca.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { getGenreStyle } from '../constants/genres'
import Navbar from '../components/layout/Navbar'

// ── Helpers ───────────────────────────────────────────────────────────────────

// PATCH 1: logarithmic scale — perceptible difference across the full range
// 80p → 14px · 250p → 27px · 500p → 37px · 900p → 48px · 1200p → 58px
function getSpineWidth(pages) {
  if (!pages || pages <= 0) return 22
  const MIN_WIDTH = 14
  const MAX_WIDTH = 58
  const LOG_MIN   = Math.log(80)
  const LOG_MAX   = Math.log(1200)
  const logPages  = Math.log(Math.max(80, Math.min(pages, 1200)))
  return Math.round(MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * (logPages - LOG_MIN) / (LOG_MAX - LOG_MIN))
}

function groupByYear(books) {
  const groups = {}
  books.forEach(book => {
    const year = book.finished_year || 'Sin fecha'
    if (!groups[year]) groups[year] = []
    groups[year].push(book)
  })
  return Object.entries(groups).sort((a, b) => {
    if (a[0] === 'Sin fecha') return 1
    if (b[0] === 'Sin fecha') return -1
    return parseInt(b[0]) - parseInt(a[0])
  })
}

function splitIntoShelves(books, perShelf = 10) {
  const shelves = []
  for (let i = 0; i < books.length; i += perShelf) {
    shelves.push(books.slice(i, i + perShelf))
  }
  return shelves.length ? shelves : [[]]
}

// ── BookSpine ─────────────────────────────────────────────────────────────────

function BookSpine({ book, isSelected, onSelect }) {
  const width = getSpineWidth(book.total_pages)
  const genreStyle = getGenreStyle(book.genre)
  const [hovered, setHovered] = useState(false)

  const liftAmount = isSelected ? -20 : hovered ? -5 : 0

  return (
    <div
      onClick={() => onSelect(book)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex-shrink-0 relative cursor-pointer"
      style={{
        width: `${width}px`,
        height: '152px',
        borderRadius: '2px 5px 5px 2px',
        overflow: 'hidden',
        transform: `translateY(${liftAmount}px)`,
        transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms ease',
        boxShadow: isSelected
          ? '5px 18px 32px rgba(0,0,0,0.30), -1px 0 0 rgba(0,0,0,0.08)'
          : hovered
          ? '3px 8px 16px rgba(0,0,0,0.18), -1px 0 0 rgba(0,0,0,0.05)'
          : '1px 3px 7px rgba(0,0,0,0.11), -1px 0 0 rgba(0,0,0,0.04)',
      }}
    >
      {book.cover_url ? (
        <img src={book.cover_url} alt={book.title}
          className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center px-1"
          style={{ background: genreStyle.spine }}>
          <p style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            fontSize: '7.5px',
            fontWeight: '800',
            color: 'rgba(255,255,255,0.88)',
            overflow: 'hidden',
            maxHeight: '136px',
            letterSpacing: '0.07em',
            lineHeight: 1.25,
            textAlign: 'center',
            wordBreak: 'break-word',
          }}>
            {book.title}
          </p>
        </div>
      )}
      {/* Spine left shadow — gives physical volume */}
      <div className="absolute inset-y-0 left-0 w-2 pointer-events-none"
        style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.22), transparent)' }} />
    </div>
  )
}

// ── Shelf ─────────────────────────────────────────────────────────────────────

function Shelf({ books, selectedBookId, onSelect, isEmpty }) {
  const scrollRef = useRef(null)

  return (
    <div className="relative select-none">
      <div className="rounded-t-lg overflow-hidden"
        style={{ background: 'linear-gradient(to bottom, #fdf9f3 0%, #f5eedd 100%)' }}>
        <div
          ref={scrollRef}
          className="flex items-end gap-[3px] px-4 pt-5 pb-0 overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', minHeight: '188px' }}
        >
          {isEmpty ? (
            <div className="flex-1 flex flex-col items-center justify-center pb-6 gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c4b49a"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 016.5 2z"/>
              </svg>
              <p className="text-[#c4b49a] text-xs font-medium text-center leading-tight">
                Tu historia lectora<br />empieza aquí.
              </p>
            </div>
          ) : (
            books.map(book => (
              <BookSpine
                key={book.id}
                book={book}
                isSelected={selectedBookId === book.id}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </div>
      {/* Shelf plank */}
      <div style={{
        height: '13px',
        background: 'linear-gradient(180deg, #c9a87c 0%, #b08a58 55%, #9a7440 100%)',
        borderRadius: '0 0 4px 4px',
        boxShadow: '0 5px 12px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.18)',
      }} />
    </div>
  )
}

// ── BookDetailPanel ───────────────────────────────────────────────────────────

function BookDetailPanel({ book, sessionStats, friends, onClose, isClosing }) {
  if (!book) return null
  const genreStyle = getGenreStyle(book.genre)
  const Icon = genreStyle.icon

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-end ${isClosing ? 'pointer-events-none' : ''}`}
      style={{
        background: isClosing ? 'rgba(0,0,0,0)' : 'rgba(10,10,10,0.55)',
        backdropFilter: isClosing ? 'blur(0px)' : 'blur(18px)',
        WebkitBackdropFilter: isClosing ? 'blur(0px)' : 'blur(18px)',
        transition: 'background 400ms ease, backdrop-filter 400ms ease',
      }}
      onClick={onClose}
    >
      {/* Floating cover */}
      <div className="flex justify-center mb-[-28px] relative z-10 pointer-events-none">
        <div style={{
          width: '110px', height: '165px',
          borderRadius: '6px 10px 10px 6px',
          overflow: 'hidden',
          boxShadow: '0 32px 56px rgba(0,0,0,0.55), 4px 8px 20px rgba(0,0,0,0.3)',
          transform: isClosing ? 'scale(0.7) translateY(20px)' : 'scale(1) translateY(0)',
          transition: 'transform 380ms cubic-bezier(0.16, 1, 0.3, 1), opacity 380ms ease',
          opacity: isClosing ? 0 : 1,
        }}>
          {book.cover_url ? (
            <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"
              style={{ background: genreStyle.spine }}>
              <Icon size={32} strokeWidth={1.6} className="text-white/80" />
            </div>
          )}
          <div className="absolute inset-y-0 left-0 w-3"
            style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.28), transparent)' }} />
        </div>
      </div>

      {/* Bottom panel */}
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md mx-auto bg-white rounded-t-[2.5rem] shadow-2xl overflow-hidden"
        style={{
          transform: isClosing ? 'translateY(100%)' : 'translateY(0)',
          transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          maxHeight: '72vh',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-stone-200 rounded-full" />
        </div>

        <div className="overflow-y-auto px-6 pb-8" style={{ maxHeight: '65vh', scrollbarWidth: 'none' }}>

          {/* Genre badge */}
          <div className="flex justify-center mt-8 mb-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${genreStyle.badge}`}>
              <Icon size={12} strokeWidth={2} />
              {genreStyle.label}
            </span>
          </div>

          {/* Title & author */}
          <div className="text-center mb-5">
            <h2 className="text-xl font-black text-stone-900 tracking-tight leading-tight">
              {book.title}
            </h2>
            <p className="text-stone-400 text-sm mt-1 font-medium">{book.author}</p>
            {book.published_year && (
              <p className="text-stone-300 text-xs mt-0.5">{book.published_year}</p>
            )}
          </div>

          {/* Rating */}
          {book.rating && (
            <div className="flex justify-center gap-1 mb-5">
              {[1,2,3,4,5].map(s => (
                <span key={s} className={`text-xl ${s <= book.rating ? 'text-amber-400' : 'text-stone-200'}`}>★</span>
              ))}
            </div>
          )}

          {/* Reading stats */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-100">
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wide">Páginas</p>
              <p className="text-2xl font-black text-stone-900 mt-0.5">{book.total_pages || '—'}</p>
            </div>
            <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-100">
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wide">Tiempo</p>
              <p className="text-2xl font-black text-stone-900 mt-0.5">
                {sessionStats?.totalMinutes
                  ? sessionStats.totalMinutes >= 60
                    ? `${Math.floor(sessionStats.totalMinutes / 60)}h`
                    : `${sessionStats.totalMinutes}m`
                  : '—'}
              </p>
            </div>
            {book.finished_at && (
              <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-100 col-span-2">
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wide">Terminado</p>
                <p className="text-base font-bold text-stone-900 mt-0.5">
                  {new Date(book.finished_at).toLocaleDateString('es-ES', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Final reflection */}
          {book.final_note && (
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 mb-4">
              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wide mb-1.5">
                Mi reflexión
              </p>
              <p className="text-stone-700 text-sm leading-relaxed italic">"{book.final_note}"</p>
            </div>
          )}

          {/* Friends who also read — FIXED: filtered by follows, not all users */}
          {friends?.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wide mb-2">
                También lo leyeron
              </p>
              <div className="flex gap-2 flex-wrap">
                {friends.map(f => (
                  <div key={f.id}
                    className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1.5 rounded-full border border-stone-100">
                    <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-[9px] font-bold text-orange-600">
                      {f.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-stone-600">{f.username}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 border-t border-stone-100">
          <button
            onClick={onClose}
            className="w-full bg-stone-900 text-white font-bold py-3.5 rounded-2xl text-sm active:scale-[0.99] transition-transform"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Gallery view ──────────────────────────────────────────────────────────────

function GalleryView({ books, onSelect }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-5">
      {books.map(book => {
        const genreStyle = getGenreStyle(book.genre)
        const Icon = genreStyle.icon
        return (
          <div key={book.id} onClick={() => onSelect(book)}
            className="cursor-pointer active:scale-95 transition-transform">
            <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-md border border-stone-100">
              {book.cover_url ? (
                <img src={book.cover_url} alt={book.title}
                  className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"
                  style={{ background: genreStyle.spine }}>
                  <Icon size={24} strokeWidth={1.6} className="text-white/80" />
                </div>
              )}
            </div>
            <p className="text-stone-700 text-[10px] font-bold mt-1.5 truncate leading-tight">{book.title}</p>
            <p className="text-stone-400 text-[9px] truncate">{book.author}</p>
          </div>
        )
      })}
    </div>
  )
}

// ── Timeline view ─────────────────────────────────────────────────────────────

function TimelineView({ booksByYear, onSelect }) {
  return (
    <div className="px-5 space-y-8">
      {booksByYear.map(([year, books]) => (
        <div key={year}>
          <div className="flex items-center gap-3 mb-4">
            <p className="text-stone-900 text-lg font-black">{year}</p>
            <div className="flex-1 h-px bg-stone-200" />
            <p className="text-stone-400 text-xs font-semibold">
              {books.length} libro{books.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="space-y-2.5">
            {books.map(book => {
              const genreStyle = getGenreStyle(book.genre)
              const Icon = genreStyle.icon
              return (
                <div key={book.id} onClick={() => onSelect(book)}
                  className="flex items-center gap-3 bg-white rounded-2xl p-3 border border-stone-100 shadow-sm cursor-pointer active:scale-[0.99] transition-transform">
                  <div className="flex-shrink-0 w-10 h-14 rounded-lg overflow-hidden shadow-sm">
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"
                        style={{ background: genreStyle.spine }}>
                        <Icon size={14} strokeWidth={2} className="text-white/80" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-stone-900 text-sm font-black truncate">{book.title}</p>
                    <p className="text-stone-400 text-xs truncate">{book.author}</p>
                    {book.finished_at && (
                      <p className="text-stone-300 text-[10px] mt-0.5">
                        {new Date(book.finished_at).toLocaleDateString('es-ES', {
                          day: 'numeric', month: 'short',
                        })}
                      </p>
                    )}
                  </div>
                  {book.rating && (
                    <div className="flex-shrink-0 flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <span key={s} className={`text-xs ${s <= book.rating ? 'text-amber-400' : 'text-stone-200'}`}>★</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

function Biblioteca() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('shelf')
  const [selectedBook, setSelectedBook] = useState(null)
  const [sessionStats, setSessionStats] = useState(null)
  const [friends, setFriends] = useState([])
  const [isClosing, setIsClosing] = useState(false)
  // PATCH 2: user in state — avoids calling getUser() repeatedly
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { fetchBooks() }, [])

  async function fetchBooks() {
    // PATCH 3: capture user once and save to state
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    setUser(currentUser)

    const { data } = await supabase
      .from('user_books')
      .select('*, global_books(title, author, genre, cover_url, total_pages, year)')
      .eq('user_id', currentUser.id)
      .eq('is_active', true)
      .eq('finished', true)
      .order('finished_at', { ascending: false })

    if (data) {
      setBooks(data.map(ub => ({
        id: ub.id,
        book_id: ub.book_id,
        rating: ub.rating,
        final_note: ub.final_note,
        finished_at: ub.finished_at,
        finished_year: ub.finished_at
          ? new Date(ub.finished_at).getFullYear().toString()
          : null,
        title: ub.global_books?.title,
        author: ub.global_books?.author,
        genre: ub.global_books?.genre,
        cover_url: ub.global_books?.cover_url,
        total_pages: ub.global_books?.total_pages,
        published_year: ub.global_books?.year,
      })))
    }
    setLoading(false)
  }

  // PATCH 4: handleSelectBook — fixed follows filter, no extra getUser() call
  async function handleSelectBook(book) {
    setSelectedBook(book)
    setIsClosing(false)

    // Session stats
    const { data: sessions } = await supabase
      .from('reading_sessions')
      .select('pages_read, minutes_read')
      .eq('book_id', book.id)    // user_books.id ✓

    if (sessions) {
      setSessionStats({
        totalPages:   sessions.reduce((s, r) => s + r.pages_read, 0),
        totalMinutes: sessions.reduce((s, r) => s + (r.minutes_read || 0), 0),
      })
    }

    // Friends who also finished — FIXED: only people the user follows
    if (user?.id) {
      // Step 1: get following IDs
      const { data: followData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)

      const followingIds = (followData || []).map(f => f.following_id)

      if (followingIds.length > 0) {
        // Step 2: filter by those IDs
        const { data: friendsData } = await supabase
          .from('user_books')
          .select('user_id, profiles(username)')
          .eq('book_id', book.book_id)    // global_books.id ✓
          .eq('finished', true)
          .in('user_id', followingIds)
          .neq('user_id', user.id)

        setFriends(
          (friendsData || [])
            .map(f => ({ id: f.user_id, username: f.profiles?.username }))
            .filter(f => f.username)
        )
      } else {
        setFriends([])
      }
    }
  }

  function handleCloseDetail() {
    setIsClosing(true)
    setTimeout(() => {
      setSelectedBook(null)
      setIsClosing(false)
      setSessionStats(null)
      setFriends([])
    }, 420)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8f6f2' }}>
      <p className="text-stone-400 text-sm tracking-wide">cargando tu biblioteca...</p>
    </div>
  )

  const booksByYear = groupByYear(books)
  const isEmpty = books.length === 0

  return (
    <div className="min-h-screen pb-32 antialiased" style={{ background: '#f8f6f2', fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* Top blur */}
      <div className="fixed top-0 left-0 right-0 z-30 h-20 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(248,246,242,1) 0%, rgba(248,246,242,0.8) 60%, transparent 100%)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        }}
      />

      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-end justify-between relative z-10">
        <div>
          <p className="text-[22px] font-black text-stone-900 tracking-tight">Mi Biblioteca</p>
          <p className="text-stone-400 text-[13px] mt-0.5">
            {isEmpty
              ? 'Tu historia lectora empieza aquí.'
              : `${books.length} libro${books.length !== 1 ? 's' : ''} terminado${books.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* View selector */}
        {!isEmpty && (
          <div className="flex bg-white rounded-xl border border-stone-200/60 overflow-hidden shadow-sm">
            {[
              { key: 'shelf', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="16" x2="21" y2="16"/></svg> },
              { key: 'gallery', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
              { key: 'timeline', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg> },
            ].map(({ key, icon }) => (
              <button key={key} onClick={() => setView(key)}
                className={`px-3 py-2 transition-colors ${view === key ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-600'}`}>
                {icon}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {!isEmpty && (
        <div className="px-5 mb-2 max-w-md mx-auto">
          <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-black text-stone-500 uppercase tracking-wider">Tu progreso</p>
              <p className="text-xs font-semibold text-stone-400">
                {books.length} libro{books.length !== 1 ? 's' : ''} terminado{books.length !== 1 ? 's' : ''}
              </p>
            </div>
            {(() => {
              const milestones = [
                { min: 0,  max: 5,        label: 'Primera balda',        next: 5   },
                { min: 6,  max: 20,       label: 'Balda llena',          next: 20  },
                { min: 21, max: 40,       label: 'Nueva balda',          next: 40  },
                { min: 41, max: 80,       label: 'Biblioteca creciendo', next: 80  },
                { min: 81, max: Infinity, label: 'Biblioteca completa',  next: null },
              ]
              const current = milestones.find(m => books.length >= m.min && books.length <= m.max) || milestones[milestones.length - 1]
              const pct = current.next ? Math.min((books.length / current.next) * 100, 100) : 100
              return (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-bold text-stone-700">{current.label}</p>
                    {current.next && books.length < current.next && (
                      <p className="text-xs text-stone-400">{current.next - books.length} más para la siguiente</p>
                    )}
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-2">
                    <div className="h-2 rounded-full bg-orange-400 transition-all duration-700"
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── Shelf view ── */}
      {(view === 'shelf' || isEmpty) && (
        <div className="px-5 space-y-8 max-w-md mx-auto">
          {isEmpty ? (
            <div className="space-y-3">
              <Shelf books={[]} selectedBookId={null} onSelect={() => {}} isEmpty />
              <p className="text-center text-stone-300 text-xs">
                Termina tu primer libro para comenzar tu colección
              </p>
            </div>
          ) : (
            booksByYear.map(([year, yearBooks]) => {
              const shelves = splitIntoShelves(yearBooks, 10)
              return (
                <div key={year}>
                  <div className="flex items-center gap-3 mb-3 px-1">
                    <p className="text-stone-500 text-xs font-black uppercase tracking-widest">{year}</p>
                    <div className="flex-1 h-px bg-stone-200" />
                    <p className="text-stone-400 text-[10px] font-semibold">
                      {yearBooks.length} libro{yearBooks.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="space-y-5">
                    {shelves.map((shelfBooks, i) => (
                      <Shelf
                        key={i}
                        books={shelfBooks}
                        selectedBookId={selectedBook?.id}
                        onSelect={handleSelectBook}
                        isEmpty={false}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Gallery view ── */}
      {view === 'gallery' && !isEmpty && (
        <div className="space-y-6 max-w-md mx-auto">
          {booksByYear.map(([year, yearBooks]) => (
            <div key={year}>
              <div className="flex items-center gap-3 mb-3 px-5">
                <p className="text-stone-500 text-xs font-black uppercase tracking-widest">{year}</p>
                <div className="flex-1 h-px bg-stone-200" />
              </div>
              <GalleryView books={yearBooks} onSelect={handleSelectBook} />
            </div>
          ))}
        </div>
      )}

      {/* ── Timeline view ── */}
      {view === 'timeline' && !isEmpty && (
        <div className="max-w-md mx-auto">
          <TimelineView booksByYear={booksByYear} onSelect={handleSelectBook} />
        </div>
      )}

      {/* ── Detail panel ── */}
      {(selectedBook || isClosing) && (
        <BookDetailPanel
          book={selectedBook}
          sessionStats={sessionStats}
          friends={friends}
          onClose={handleCloseDetail}
          isClosing={isClosing}
        />
      )}

      <Navbar active="/biblioteca" />
    </div>
  )
}

export default Biblioteca