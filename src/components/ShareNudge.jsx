import { useEffect, useState } from 'react'

export default function ShareNudge({ visible, onDismiss }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (visible) {
      setShow(true)
      const t = setTimeout(() => { setShow(false); onDismiss?.() }, 8000)
      return () => clearTimeout(t)
    }
  }, [visible])

  if (!show) return null

  function copy() {
    navigator.clipboard?.writeText('https://breakbeatbuilder.com').catch(() => {})
    onDismiss?.()
    setShow(false)
  }

  return (
    <div style={{
      position:      'fixed',
      bottom:        24,
      right:         24,
      zIndex:        9000,
      background:    '#1a1710',
      border:        '1px solid rgba(196,110,31,0.4)',
      borderRadius:  4,
      padding:       '14px 16px',
      maxWidth:      300,
      boxShadow:     '0 8px 32px rgba(0,0,0,0.7)',
      fontFamily:    '"Space Mono", monospace',
      animation:     'nudgeIn 0.2s ease',
    }}>
      <style>{`@keyframes nudgeIn { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }`}</style>

      <div style={{ fontSize: 10, fontWeight: 700, color: '#C46E1F', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
        Beat exported ✓
      </div>
      <div style={{ fontSize: 11, color: 'rgba(242,220,180,0.6)', lineHeight: 1.6, marginBottom: 12 }}>
        Made something you like? Share the tool with another producer.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={copy} style={{
          background:    '#C46E1F',
          border:        'none',
          borderRadius:  3,
          padding:       '6px 12px',
          fontSize:      9,
          fontWeight:    700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color:         '#0a0806',
          fontFamily:    '"Space Mono", monospace',
          cursor:        'pointer',
        }}>
          Copy Link
        </button>
        <button onClick={() => { setShow(false); onDismiss?.() }} style={{
          background:    'none',
          border:        '1px solid rgba(242,220,180,0.15)',
          borderRadius:  3,
          padding:       '6px 12px',
          fontSize:      9,
          fontWeight:    700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color:         'rgba(242,220,180,0.4)',
          fontFamily:    '"Space Mono", monospace',
          cursor:        'pointer',
        }}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
