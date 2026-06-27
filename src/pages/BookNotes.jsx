// src/pages/BookNotes.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function BookNotes() {
  const [book, setBook] = useState(null)
  const [sessions, setSessions] = useState([])
  const [finalNote, setFinalNote] = useState('')
  const [savingFinal, setSavingFinal] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { id } = useParams()

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: bookData } = await supabase
      .from('user_books')
      .select('*, global_books(title, author, cover_url)')
      .eq('id', id)
      .single()

    if (bookData) {
      setBook({
        id: bookData.id,
        finished: bookData.finished,
        final_note: bookData.final_note,
        title: bookData.global_books?.title,
        author: bookData.global_books?.author,
        cover_url: bookData.global_books?.cover_url,
      })
      setFinalNote(bookData.final_note || '')
    }

    // parseInt fixes silent type mismatch: useParams returns string,
    // reading_sessions.book_id is integer in Supabase
    const { data: sessionData } = await supabase
      .from('reading_sessions')
      .select('*')
      .eq('book_id', parseInt(id))
      .not('note', 'is', null)
      .order('date', { ascending: true })

    if (sessionData) setSessions(sessionData)
    setLoading(false)
  }

  async function handleSaveFinalNote() {
    setSavingFinal(true)
    await supabase.from('user_books').update({ final_note: finalNote }).eq('id', id)
    setSavingFinal(false)
    navigate('/home')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f6f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9c9490', fontSize: '13px' }}>cargando…</p>
    </div>
  )

  if (!book) return null

  // Empty: no session notes AND book not finished yet
  const isEmpty = sessions.length === 0 && !book.finished

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8f6f2',
      fontFamily: "'Inter', -apple-system, sans-serif",
      paddingBottom: '60px',
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
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '52px 20px 24px',
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
          Mi diario
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          background: 'white', border: '0.5px solid rgba(26,23,20,0.08)',
          borderRadius: '99px', padding: '5px 10px',
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9c9490" strokeWidth="2.5" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#9c9490', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Privado
          </span>
        </div>
      </div>

      {/* Book identity */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '0 20px 28px',
        maxWidth: '480px', margin: '0 auto',
      }}>
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            style={{
              width: '48px', height: '70px', objectFit: 'cover',
              borderRadius: '4px 7px 7px 4px',
              boxShadow: '2px 4px 12px rgba(0,0,0,0.14)',
              flexShrink: 0,
            }}
          />
        ) : (
          <div style={{
            width: '48px', height: '70px', background: '#e8e4df',
            borderRadius: '4px 7px 7px 4px', flexShrink: 0,
          }} />
        )}
        <div>
          <p style={{ fontSize: '16px', fontWeight: 800, color: '#1a1714', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {book.title}
          </p>
          <p style={{ fontSize: '12px', color: '#9c9490', fontWeight: 500, marginTop: '3px' }}>
            {book.author}
          </p>
          {book.finished && (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              marginTop: '7px', background: '#f0faf4',
              border: '0.5px solid rgba(22,163,74,0.2)',
              borderRadius: '99px', padding: '3px 8px',
            }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#16a34a', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Terminado
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px', maxWidth: '480px', margin: '0 auto' }}>

        {isEmpty ? (
          /* ── Empty state ── */
          <div style={{
            background: 'white', borderRadius: '20px',
            border: '0.5px solid rgba(26,23,20,0.08)',
            padding: '40px 24px', textAlign: 'center',
          }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1714', marginBottom: '6px' }}>
              Tu diario está vacío
            </p>
            <p style={{ fontSize: '12px', color: '#9c9490', lineHeight: 1.55, marginBottom: '20px' }}>
              Añade notas al registrar tu lectura diaria. Aparecerán aquí.
            </p>
            <button
              onClick={() => navigate('/home')}
              style={{
                background: '#1a1714', color: '#f8f6f2',
                border: 'none', borderRadius: '12px',
                padding: '11px 20px', fontSize: '12px',
                fontWeight: 700, letterSpacing: '-0.01em',
                fontFamily: "'Inter', -apple-system, sans-serif",
                cursor: 'pointer',
              }}
            >
              Volver a mis libros
            </button>
          </div>
        ) : (
          <>
            {/* Session notes */}
            {sessions.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <p style={{
                  fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: '#9c9490', marginBottom: '14px',
                }}>
                  Notas de sesión
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sessions.map(session => (
                    <div key={session.id} style={{
                      background: 'white', borderRadius: '18px',
                      border: '0.5px solid rgba(26,23,20,0.07)',
                      padding: '16px 18px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <div style={{
                          background: '#fdf1eb',
                          border: '0.5px solid rgba(232,98,42,0.15)',
                          borderRadius: '99px', padding: '3px 9px',
                        }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#e8622a' }}>
                            +{session.pages_read} págs.
                          </span>
                        </div>
                        <span style={{ fontSize: '10px', color: '#b8b4b0', fontWeight: 500 }}>
                          {formatDate(session.date)}
                        </span>
                      </div>
                      <p style={{
                        fontSize: '14px', color: '#1a1714',
                        lineHeight: 1.65, letterSpacing: '-0.008em', fontWeight: 400,
                      }}>
                        {session.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Final reflection — shown when book is finished */}
            {book.finished && (
              <div>
                <p style={{
                  fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: '#9c9490', marginBottom: '14px',
                }}>
                  Reflexión final
                </p>
                <div style={{
                  background: 'white', borderRadius: '20px',
                  border: '0.5px solid rgba(26,23,20,0.07)', overflow: 'hidden',
                }}>
                  <div style={{ height: '3px', background: '#e8622a', opacity: 0.6 }} />
                  <div style={{ padding: '18px' }}>
                    <textarea
                      value={finalNote}
                      onChange={e => setFinalNote(e.target.value)}
                      placeholder="¿Qué te ha parecido el libro? Escribe tu reflexión…"
                      rows={5}
                      style={{
                        width: '100%', background: 'transparent',
                        border: 'none', outline: 'none',
                        fontSize: '14px', color: '#1a1714',
                        lineHeight: 1.7, letterSpacing: '-0.008em',
                        fontFamily: "'Inter', -apple-system, sans-serif",
                        resize: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
                <button
                  onClick={handleSaveFinalNote}
                  disabled={savingFinal}
                  style={{
                    width: '100%', marginTop: '14px',
                    background: savingFinal ? '#e8e4df' : '#1a1714',
                    color: savingFinal ? '#9c9490' : '#f8f6f2',
                    border: 'none', borderRadius: '16px',
                    padding: '15px', fontSize: '13px',
                    fontWeight: 700, letterSpacing: '-0.01em',
                    fontFamily: "'Inter', -apple-system, sans-serif",
                    cursor: savingFinal ? 'not-allowed' : 'pointer',
                    transition: 'all 200ms ease',
                  }}
                >
                  {savingFinal ? 'Guardando…' : 'Guardar reflexión'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}