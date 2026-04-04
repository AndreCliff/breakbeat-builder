import { useState, useRef, useEffect } from 'react'
import { useUserPlan } from '../contexts/UserPlanContext.jsx'

const IDENTITY_LABELS = [
  'PRODUCER',
  'BEATMAKER',
  'CRATE DIGGER',
  'SAMPLE CHOPPER',
  'BREAK BUILDER',
]

function getWelcomeLabel() {
  const key = 'bbb_welcome_identity_index'
  const raw = localStorage.getItem(key)
  const idx = raw !== null ? parseInt(raw, 10) : 0
  localStorage.setItem(key, ((idx + 1) % IDENTITY_LABELS.length).toString())
  return IDENTITY_LABELS[idx % IDENTITY_LABELS.length]
}

export default function Header({ user, onSignOut, onProRequired }) {
  const { isPro } = useUserPlan()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const [welcomeLabel] = useState(() => getWelcomeLabel())

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <header
      className="border-b border-[var(--border)]"
      style={{ padding: 0, overflow: 'hidden' }}
    >
      {/* Inner wrapper — same max-width as app container so edges align */}
      <div
        style={{
          width:          '95vw',
          maxWidth:       1400,
          margin:         '0 auto',
          padding:        '0 0',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          position:       'relative',
          lineHeight:     0,
        }}
      >
        <img
          src="/assets/breakbeat-builder-wordmark.png"
          alt="Breakbeat Builder"
          style={{ maxHeight: 440, width: 'auto', height: 'auto', display: 'block', marginTop: '-40px', marginBottom: '-40px' }}
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }}
        />
        <span style={{ display: 'none', color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          BREAKBEAT BUILDER
        </span>

        {/* Account badge + welcome identity — only shown when signed in */}
        {user && (
          <div ref={ref} style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>

            {/* Badge pill */}
            <button
              onClick={() => setOpen(v => !v)}
              style={{
                minHeight:     42,
                padding:       '0 18px',
                fontSize:      18,
                fontWeight:    700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontFamily:    'monospace',
                borderRadius:  3,
                cursor:        'pointer',
                lineHeight:    1,
                transition:    'all 0.1s',
                display:       'inline-flex',
                alignItems:    'center',
                ...(isPro ? {
                  background: '#C46E1F',
                  color:      '#0a0a0a',
                  border:     'none',
                  boxShadow:  '0 4px 0 #5a2a00, 0 5px 10px rgba(0,0,0,0.5)',
                } : {
                  background: 'rgba(122,112,96,0.3)',
                  color:      '#7a7060',
                  border:     '1px solid #7a7060',
                  boxShadow:  'none',
                }),
              }}
            >
              {isPro ? 'PRO' : 'FREE'}
            </button>

            {/* Welcome identity */}
            <div style={{
              fontSize:      10,
              fontWeight:    400,
              fontFamily:    "'Space Mono', monospace",
              textTransform: 'uppercase',
              color:         '#7a7060',
              letterSpacing: '0.08em',
              lineHeight:    1,
              whiteSpace:    'nowrap',
              textAlign:     'right',
            }}>
              WELCOME, {welcomeLabel}
            </div>

            {/* Dropdown */}
            {open && (
              <div
                style={{
                  position:     'absolute',
                  top:          'calc(100% + 8px)',
                  right:        0,
                  background:   '#1a1710',
                  border:       '1px solid rgba(242,220,180,0.15)',
                  borderRadius: 4,
                  padding:      '6px 0 4px',
                  minWidth:     200,
                  zIndex:       200,
                  boxShadow:    '0 10px 28px rgba(0,0,0,0.75)',
                }}
              >
                {/* Email */}
                <div
                  style={{
                    padding:       '3px 12px 8px',
                    fontSize:      14,
                    fontFamily:    'monospace',
                    color:         'rgba(242,220,180,0.45)',
                    borderBottom:  '1px solid rgba(242,220,180,0.08)',
                    letterSpacing: '0.04em',
                    wordBreak:     'break-all',
                    lineHeight:    1.5,
                  }}
                >
                  {user.email?.length > 28 ? user.email.slice(0, 25) + '…' : user.email}
                </div>

                {/* Plan status / upgrade */}
                <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(242,220,180,0.08)' }}>
                  {isPro ? (
                    <div style={{
                      fontSize:      12,
                      fontFamily:    'monospace',
                      fontWeight:    700,
                      color:         '#C46E1F',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}>
                      ✓ Pro Member
                    </div>
                  ) : (
                    <button
                      onClick={() => { setOpen(false); onProRequired?.() }}
                      style={{
                        background:    '#C46E1F',
                        color:         '#0a0805',
                        border:        'none',
                        borderRadius:  3,
                        padding:       '6px 10px',
                        fontSize:      12,
                        fontWeight:    700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        fontFamily:    'monospace',
                        cursor:        'pointer',
                        width:         '100%',
                        textAlign:     'center',
                      }}
                    >
                      Upgrade to Pro →
                    </button>
                  )}
                </div>

                {/* Sign Out */}
                <button
                  onClick={() => { setOpen(false); onSignOut?.() }}
                  style={{
                    display:       'block',
                    width:         '100%',
                    background:    'none',
                    border:        'none',
                    padding:       '8px 12px',
                    fontSize:      12,
                    fontFamily:    'monospace',
                    color:         'rgba(242,220,180,0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    cursor:        'pointer',
                    textAlign:     'left',
                    transition:    'color 0.08s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#f2dcb4'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(242,220,180,0.5)'}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
