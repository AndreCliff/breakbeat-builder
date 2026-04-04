import { useUserPlan } from '../contexts/UserPlanContext.jsx'

const SILK = {
  fontSize:      9,
  fontWeight:    700,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color:         'rgba(242,220,180,0.4)',
  fontFamily:    'monospace',
  lineHeight:    1,
}

const PRO_LOCK = (
  <span style={{
    fontSize:      7,
    fontWeight:    700,
    letterSpacing: '0.1em',
    color:         '#C46E1F',
    fontFamily:    'monospace',
    border:        '1px solid rgba(196,110,31,0.45)',
    borderRadius:  2,
    padding:       '1px 3px',
    background:    'rgba(196,110,31,0.12)',
    verticalAlign: 'middle',
    marginLeft:    5,
  }}>PRO</span>
)

const Spinner = () => (
  <span style={{
    width:        13,
    height:       13,
    border:       '2px solid #0a0806',
    borderTop:    '2px solid transparent',
    borderRadius: '50%',
    display:      'inline-block',
    animation:    'expSpin 0.7s linear infinite',
    flexShrink:   0,
  }} />
)

export default function ExportButton({
  onExport,
  onMidiExport,
  onStemsExport,
  onPatternsClick,
  onSavePattern,
  disabled,
  allMuted,
  isExporting,
  isMidiExporting,
  isStemsExporting,
  onProRequired,
}) {
  const { isPro } = useUserPlan()
  const busy = isExporting || isMidiExporting || isStemsExporting

  function btnStyle(proLocked) {
    const isDisabled = disabled || busy
    return {
      height:        42,
      padding:       '0 22px',
      fontSize:      13,
      fontWeight:    700,
      fontFamily:    'monospace',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      borderRadius:  4,
      border:        proLocked ? '1px solid rgba(196,110,31,0.2)' : 'none',
      cursor:        isDisabled ? 'not-allowed' : 'pointer',
      display:       'inline-flex',
      alignItems:    'center',
      gap:           7,
      background:    proLocked ? 'rgba(196,110,31,0.08)' : '#C46E1F',
      color:         proLocked ? 'rgba(242,220,180,0.6)' : '#0a0806',
      boxShadow:     proLocked || isDisabled ? 'none' : '0 4px 0 #5a2a00, 0 5px 10px rgba(0,0,0,0.5)',
      opacity:       isDisabled ? 0.38 : 1,
      transition:    'all 0.06s',
      whiteSpace:    'nowrap',
      flexShrink:    0,
    }
  }

  return (
    <div
      className="rounded-[4px]"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, #1e1a13 0%, #0f0d09 100%)',
        border:     '1.5px solid rgba(242,220,180,0.1)',
        borderTop:  '1.5px solid rgba(196,110,31,0.25)',
        boxShadow:  'inset 0 2px 10px rgba(0,0,0,0.5)',
        padding:    '12px 16px 14px',
      }}
    >
      <style>{`@keyframes expSpin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header: label + helper + My Patterns ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={SILK}>Export</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...SILK, fontSize: 8, opacity: 0.55 }}>
            WAV includes texture fx · MIDI &amp; Stems require Pro
          </span>
          <button
            onClick={onPatternsClick}
            style={{
              background:    'none',
              border:        '1px solid rgba(242,220,180,0.15)',
              borderRadius:  3,
              padding:       '3px 8px',
              fontSize:      9,
              color:         'rgba(242,220,180,0.45)',
              cursor:        'pointer',
              fontFamily:    'monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              whiteSpace:    'nowrap',
              transition:    'all 0.08s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#C46E1F'; e.currentTarget.style.borderColor = 'rgba(196,110,31,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(242,220,180,0.45)'; e.currentTarget.style.borderColor = 'rgba(242,220,180,0.15)' }}
          >
            ☁ My Patterns
          </button>
        </div>
      </div>

      {/* ── Export buttons ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>

        {/* WAV */}
        <button
          onClick={onExport}
          disabled={disabled || busy}
          style={btnStyle(false)}
        >
          {isExporting ? <><Spinner /> Rendering…</> : <>↓ WAV</>}
        </button>

        {/* MIDI */}
        <button
          onClick={() => { if (!isPro) { onProRequired?.(); return } onMidiExport?.() }}
          disabled={disabled || busy}
          style={btnStyle(!isPro)}
        >
          {isMidiExporting ? <><Spinner /> Building…</> : <>↓ MIDI{!isPro && PRO_LOCK}</>}
        </button>

        {/* STEMS */}
        <button
          onClick={() => { if (!isPro) { onProRequired?.(); return } onStemsExport?.() }}
          disabled={disabled || busy}
          style={btnStyle(!isPro)}
        >
          {isStemsExporting ? <><Spinner /> Stems…</> : <>↓ STEMS{!isPro && PRO_LOCK}</>}
        </button>

        {/* SAVE PATTERN */}
        <button
          onClick={() => { if (!isPro) { onProRequired?.(); return } onSavePattern?.() }}
          disabled={disabled || busy}
          style={btnStyle(!isPro)}
        >
          ↑ SAVE{!isPro && PRO_LOCK}
        </button>
      </div>

      {/* All-muted notice */}
      {allMuted && (
        <div style={{
          marginTop:     8,
          fontSize:      9,
          fontFamily:    'monospace',
          color:         'rgba(242,220,180,0.35)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          Unmute at least one track to export
        </div>
      )}
    </div>
  )
}
