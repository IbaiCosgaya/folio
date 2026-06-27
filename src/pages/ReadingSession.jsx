// src/pages/ReadingSession.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { getGenreStyle } from '../constants/genres'

export default function ReadingSession() {
  const [book, setBook] = useState(null)
  const [currentPage, setCurrentPage] = useState('')
  const [minutes, setMinutes] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { id } = useParams()

  useEffect(() => { fetchBook() }, [])

  async function fetchBook() {
    const { data } = await supabase
      .from('user_books')
      .select('*, global_books(title, author, total_pages, cover_url, genre)')
      .eq('id', id)
      .single()
    if (data) {
      setBook({
        id: data.id,
        current_page: data.current_page,
        title: data.global_books?.title,
        author: data.global_books?.author,
        total_pages: data.global_books?.total_pages,
        cover_url: data.global_books?.cover_url,
        genre: data.global_books?.genre,
      })
      setCurrentPage(data.current_page)
    }
  }

  async function handleUpdate() {
    if (!currentPage) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const pagesRead = parseInt(currentPage) - book.current_page
    const finished = parseInt(currentPage) >= book.total_pages

    await supabase.from('user_books').update({
      current_page: parseInt(currentPage),
      finished,
      ...(finished ? { finished_at: new Date().toISOString() } : {}),
    }).eq('id', id)

    if (finished) {
      navigate(`/notes/${id}`)
      return
    }

    if (pagesRead > 0) {
      await supabase.from('reading_sessions').insert({
        user_id: user.id,
        book_id: parseInt(id),
        pages_read: pagesRead,
        minutes_read: minutes ? parseInt(minutes) : null,
        date: new Date().toISOString().split('T')[0],
        note: note.trim() || null,
      })
    }

    navigate('/home')
    setLoading(false)
  }

  if (!book) return (
    <div style={{ minHeight: '100vh', background: '#f8f6f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9c9490', fontSize: '13px' }}>cargando…</p>
    </div>
  )

  const percent = Math.min(Math.round((parseInt(currentPage) / book.total_pages) * 100) || 0, 100)
  const pagesRead = Math.max((parseInt(currentPage) || 0) - book.current_page, 0)
  const genreStyle = getGenreStyle(book.genre)
  const GenreIcon = genreStyle.icon

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8f6f2',
      fontFamily: "'Inter', -apple-system, sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '52px 20px 16px',
      }}>
        <button
          onClick={() => navigate('/home')}
          style={{
            background: 'white',
            border: '0.5px solid rgba(26,23,20,0.10)',
            borderRadius: '50%',
            width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#9c9490',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1714', letterSpacing: '-0.01em' }}>
          Registrar lectura
        </p>
        <div style={{ width: '36px' }} />
      </div>

      {/* ── Book hero ── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 20px 28px',
      }}>
        {/* Cover */}
        <div style={{
          width: '90px', height: '132px',
          borderRadius: '6px 10px 10px 6px',
          overflow: 'hidden',
          boxShadow: '4px 8px 24px rgba(0,0,0,0.18), -2px 0 6px rgba(0,0,0,0.06)',
          marginBottom: '18px',
          flexShrink: 0,
          position: 'relative',
        }}>
          {book.cover_url ? (
            <img src={book.cover_url} alt={book.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: genreStyle.spine,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GenreIcon size={28} strokeWidth={1.6} color="rgba(255,255,255,0.8)" />
            </div>
          )}
          {/* Spine shadow */}
          <div style={{
            position: 'absolute', inset: 0, left: 0, top: 0, bottom: 0, width: '6px',
            background: 'linear-gradient(to right, rgba(0,0,0,0.2), transparent)',
            pointerEvents: 'none',
          }} />
        </div>

        {/* Title & author */}
        <p style={{
          fontSize: '17px', fontWeight: 800, color: '#1a1714',
          letterSpacing: '-0.02em', lineHeight: 1.2,
          textAlign: 'center', maxWidth: '260px',
        }}>
          {book.title}
        </p>
        <p style={{
          fontSize: '12px', color: '#9c9490', fontWeight: 500,
          marginTop: '4px', letterSpacing: '-0.005em',
        }}>
          {book.author}
        </p>

        {/* Progress bar */}
        <div style={{
          width: '100%', maxWidth: '280px',
          marginTop: '18px',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginBottom: '7px',
          }}>
            <span style={{ fontSize: '11px', color: '#9c9490', fontWeight: 500 }}>
              Progreso
            </span>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#e8622a' }}>
              {percent}%
            </span>
          </div>
          <div style={{
            height: '4px', background: 'rgba(26,23,20,0.08)',
            borderRadius: '99px', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${percent}%`,
              background: '#e8622a',
              borderRadius: '99px',
              transition: 'width 300ms cubic-bezier(0.16, 1, 0.3, 1)',
            }} />
          </div>
          <p style={{ fontSize: '10px', color: '#b8b4b0', marginTop: '5px', fontWeight: 500 }}>
            Página {book.current_page} de {book.total_pages}
          </p>
        </div>
      </div>

      {/* ── Form ── */}
      <div style={{
        flex: 1,
        background: 'white',
        borderRadius: '28px 28px 0 0',
        padding: '28px 20px 120px',
        boxShadow: '0 -1px 0 rgba(26,23,20,0.06)',
        maxWidth: '480px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}>

        {/* Page input — the main interaction */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{
            fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#9c9490', marginBottom: '12px',
          }}>
            ¿En qué página estás ahora?
          </p>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: '#f8f6f2',
            borderRadius: '16px',
            padding: '14px 18px',
            border: '0.5px solid rgba(26,23,20,0.08)',
          }}>
            <input
              type="number"
              value={currentPage}
              onChange={e => setCurrentPage(e.target.value)}
              max={book.total_pages}
              min={book.current_page}
              placeholder={String(book.current_page)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '32px',
                fontWeight: 800,
                color: '#1a1714',
                letterSpacing: '-0.03em',
                fontFamily: "'Inter', -apple-system, sans-serif",
                width: '100%',
                minWidth: 0,
              }}
            />
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: '10px', color: '#9c9490', fontWeight: 500 }}>de</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: '#9c9490', letterSpacing: '-0.02em' }}>
                {book.total_pages}
              </p>
            </div>
          </div>
          {pagesRead > 0 && (
            <p style={{
              fontSize: '11px', color: '#e8622a', fontWeight: 700,
              marginTop: '8px', paddingLeft: '4px',
            }}>
              +{pagesRead} páginas en esta sesión
            </p>
          )}
        </div>

        {/* Minutes */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{
            fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#9c9490', marginBottom: '12px',
          }}>
            Minutos leídos <span style={{ opacity: 0.5, fontWeight: 500 }}>· Opcional</span>
          </p>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: '#f8f6f2', borderRadius: '14px',
            padding: '12px 16px',
            border: '0.5px solid rgba(26,23,20,0.08)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9c9490" strokeWidth="1.75" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <input
              type="number"
              placeholder="45"
              value={minutes}
              onChange={e => setMinutes(e.target.value)}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: '15px', fontWeight: 600, color: '#1a1714',
                letterSpacing: '-0.01em',
                fontFamily: "'Inter', -apple-system, sans-serif",
              }}
            />
            <span style={{ fontSize: '12px', color: '#9c9490', fontWeight: 500 }}>min</span>
          </div>
        </div>

        {/* Note */}
        <div style={{ marginBottom: '28px' }}>
          <p style={{
            fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#9c9490', marginBottom: '12px',
          }}>
            Nota de hoy <span style={{ opacity: 0.5, fontWeight: 500 }}>· Opcional</span>
          </p>
          <textarea
            placeholder="¿Qué te ha parecido lo que has leído hoy?"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            style={{
              width: '100%', background: '#f8f6f2',
              border: '0.5px solid rgba(26,23,20,0.08)',
              borderRadius: '14px', padding: '12px 16px',
              fontSize: '13px', color: '#1a1714', lineHeight: 1.6,
              fontFamily: "'Inter', -apple-system, sans-serif",
              resize: 'none', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* CTA */}
        <button
          onClick={handleUpdate}
          disabled={loading || !currentPage}
          style={{
            width: '100%',
            background: loading || !currentPage ? '#e8e4df' : '#1a1714',
            color: loading || !currentPage ? '#9c9490' : '#f8f6f2',
            border: 'none',
            borderRadius: '16px',
            padding: '16px',
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            fontFamily: "'Inter', -apple-system, sans-serif",
            cursor: loading || !currentPage ? 'not-allowed' : 'pointer',
            transition: 'all 200ms ease',
          }}
        >
          {loading ? 'Guardando…' : parseInt(currentPage) >= book.total_pages ? '🎉 Marcar como terminado' : 'Guardar sesión'}
        </button>

      </div>
    </div>
  )
}