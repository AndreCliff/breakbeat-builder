/**
 * ProModal — "Unlock Pro" upgrade prompt.
 * Matches the app's dark hardware aesthetic.
 * Calls the create-checkout Supabase Edge Function and redirects to Stripe.
 */
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const FEATURES = [
  { icon: '↓', label: 'MIDI export'              },
  { icon: '◎', label: 'Bit Crusher FX'            },
  { icon: '≡', label: 'Per-pad 3-band EQ'         },
  { icon: '⊞', label: 'Stem export (per pad)'     },
  { icon: '~', label: 'Per-track swing'            },
  { icon: '⟳', label: 'Timing drift / humanize'   },
  { icon: '☁', label: 'Cloud save patterns'        },
  { icon: '⊞', label: '6 & 8 bar loops'           },
]

export default function ProModal({ onClose, user, onBeforeCheckout, onAuthRequired }) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  async function handleUpgrade() {
    if (!supabase) return
    if (!user) { onClose(); onAuthRequired?.(); return }
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ return_url: window.location.href }),
        }
      )
      const json = await res.json()
      if (!res.ok || !json.url) throw new Error(json.error || 'Failed to create checkout')
      // Serialize current session so it can be restored after Stripe redirect
      onBeforeCheckout?.()
      window.location.href = json.url
    } catch (e) {
      console.error('Checkout error:', e)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative rounded-[4px] w-full max-w-sm mx-4"
        style={{
          background: 'radial-gradient(ellipse at 50% 20%, #1e1a12 0%, #0a0806 100%)',
          border:     '1.5px solid rgba(242,220,180,0.18)',
          boxShadow:  '0 32px 80px rgba(0,0,0,0.9), inset 0 1px 0 rgba(242,220,180,0.08)',
          padding:    '28px 28px 24px',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position:  'absolute', top: 14, right: 16,
            background: 'none', border: 'none',
            color:     'rgba(242,220,180,0.35)',
            fontSize:  16, cursor: 'pointer', lineHeight: 1,
            fontFamily: 'monospace',
          }}
        >✕</button>

        {/* Header */}
        <div style={{
          fontSize:      9, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.18em', color: 'rgba(242,220,180,0.35)',
          fontFamily:    'monospace', marginBottom: 8,
        }}>
          Breakbeat Builder
        </div>
        <div style={{
          fontSize:      22, fontWeight: 900, letterSpacing: '0.04em',
          color:         '#C46E1F', fontFamily: 'monospace', marginBottom: 4,
          textTransform: 'uppercase',
        }}>
          Unlock Pro
        </div>
        <div style={{
          fontSize: 12, color: 'rgba(242,220,180,0.55)',
          fontFamily: 'monospace', marginBottom: 24,
        }}>
          One-time payment · Lifetime access
        </div>

        {/* Feature list */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          marginBottom: 24,
        }}>
          {FEATURES.map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(196,110,31,0.15)', border: '1px solid rgba(196,110,31,0.3)',
                borderRadius: 3, fontSize: 10, color: '#C46E1F', flexShrink: 0,
                fontFamily: 'monospace',
              }}>{f.icon}</span>
              <span style={{ fontSize: 11, color: 'rgba(242,220,180,0.75)', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                {f.label}
              </span>
            </div>
          ))}
        </div>

        {/* Price + CTA */}
        {error && (
          <div style={{ fontSize: 11, color: '#e05', marginBottom: 12, fontFamily: 'monospace' }}>
            {error}
          </div>
        )}
        <button
          onClick={handleUpgrade}
          disabled={loading}
          style={{
            width:         '100%',
            background:    loading ? '#5a3a10' : '#C46E1F',
            color:         '#0a0806',
            border:        'none',
            borderRadius:  4,
            padding:       '13px 0',
            fontSize:      13,
            fontWeight:    900,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            cursor:        loading ? 'not-allowed' : 'pointer',
            fontFamily:    'monospace',
            boxShadow:     loading ? 'none' : '0 4px 0 #5a2a00, 0 6px 16px rgba(0,0,0,0.5)',
            transition:    'all 0.06s',
            display:       'flex',
            alignItems:    'center',
            justifyContent:'center',
            gap:           8,
          }}
        >
          {loading ? (
            <>
              <span style={{
                width: 12, height: 12, border: '2px solid #0a0806',
                borderTop: '2px solid transparent', borderRadius: '50%',
                display: 'inline-block', animation: 'spin 0.7s linear infinite',
              }} />
              Redirecting…
            </>
          ) : (
            <>Unlock Pro — $49</>
          )}
        </button>

        <div style={{
          textAlign: 'center', marginTop: 12,
          fontSize: 9, color: 'rgba(242,220,180,0.25)',
          fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          Secure checkout via Stripe
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
