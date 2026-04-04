import { useState, useEffect } from 'react'

const STORAGE_KEY = 'bb_mobile_dismissed'

export default function MobileWarning() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const check = () => {
      const dismissed = sessionStorage.getItem(STORAGE_KEY)
      setVisible(window.innerWidth < 900 && !dismissed)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!visible) return null

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      zIndex:         9999,
      background:     'rgba(6,4,2,0.96)',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '32px 24px',
      textAlign:      'center',
      fontFamily:     '"Space Mono", monospace',
    }}>
      <div style={{
        fontSize:      11,
        letterSpacing: '0.22em',
        color:         'rgba(242,220,180,0.4)',
        textTransform: 'uppercase',
        marginBottom:  24,
      }}>
        Breakbeat Builder
      </div>

      <div style={{
        fontSize:      15,
        fontWeight:    700,
        letterSpacing: '0.12em',
        color:         '#f2dcb4',
        textTransform: 'uppercase',
        lineHeight:    1.5,
        marginBottom:  16,
        maxWidth:      320,
      }}>
        Breakbeat Builder is optimized for desktop
      </div>

      <div style={{
        fontSize:    12,
        color:       'rgba(242,220,180,0.55)',
        lineHeight:  1.7,
        maxWidth:    300,
        marginBottom: 32,
      }}>
        For the best experience, open this on a laptop or desktop computer.
      </div>

      <button
        onClick={dismiss}
        style={{
          background:    'transparent',
          border:        '1px solid rgba(242,220,180,0.3)',
          color:         'rgba(242,220,180,0.6)',
          fontFamily:    '"Space Mono", monospace',
          fontSize:      10,
          fontWeight:    700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          padding:       '10px 24px',
          borderRadius:  3,
          cursor:        'pointer',
        }}
      >
        Continue Anyway
      </button>
    </div>
  )
}
