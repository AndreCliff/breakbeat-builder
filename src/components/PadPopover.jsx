import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useUserPlan } from '../contexts/UserPlanContext.jsx'

// ── Popover dimensions ────────────────────────────────────────────────────────
const POPOVER_W = 144
const POPOVER_H = 520   // conservative estimate for smart positioning (includes Swing section)
const MARGIN    = 8

function formatPan(pan) {
  if (Math.abs(pan) < 0.02) return 'C'
  const side = pan < 0 ? 'L' : 'R'
  const val  = Math.round(Math.abs(pan) * 100)
  return `${side}${val}`
}

function fmtDb(v) {
  return `${v > 0 ? '+' : ''}${Math.round(v)}`
}

/**
 * Per-pad settings popover: Gain + Gate + Pan + EQ (Pro).
 * Rendered via a React portal to escape overflow:hidden containers.
 */
export default function PadPopover({
  anchorRect, gain, pan, gate, padEq,
  trackSwing, onTrackSwingChange,
  onGainChange, onPanChange, onGateChange,
  onPadEqChange, onPadEqToggle, onProRequired,
  onClose,
}) {
  const { isPro } = useUserPlan()
  const ref = useRef(null)

  const eq = padEq ?? { low: 0, mid: 0, high: 0, enabled: false }

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Smart positioning — prefer above when it has more room, clamp both edges
  const spaceAbove = anchorRect.top - MARGIN
  const spaceBelow = window.innerHeight - anchorRect.bottom - MARGIN
  const showAbove  = spaceAbove >= POPOVER_H || spaceAbove >= spaceBelow

  const top = showAbove
    ? Math.max(MARGIN, anchorRect.top - POPOVER_H - MARGIN)
    : anchorRect.bottom + MARGIN

  // Limit height to available space so content scrolls instead of clipping
  const maxHeight = showAbove ? spaceAbove : spaceBelow

  const idealLeft = anchorRect.left + anchorRect.width / 2 - POPOVER_W / 2
  const left = Math.max(MARGIN, Math.min(idealLeft, window.innerWidth - POPOVER_W - MARGIN))

  const eqSlider = {
    writingMode: 'vertical-lr',
    direction:   'rtl',
    height:      52,
    width:       16,
    cursor:      isPro ? 'pointer' : 'not-allowed',
  }

  function handleEqBand(band, value) {
    if (!isPro) { onProRequired?.(); return }
    onPadEqChange?.({
      ...eq,
      [band]: Math.max(-12, Math.min(12, parseFloat(value))),
    })
  }

  function handleEqToggle() {
    if (!isPro) { onProRequired?.(); return }
    onPadEqToggle?.()
  }

  return createPortal(
    <div
      ref={ref}
      className="flex flex-col gap-3 shadow-xl"
      style={{
        position:    'fixed',
        zIndex:      9999,
        width:       POPOVER_W,
        left,
        top,
        maxHeight:   maxHeight,
        overflowY:   'auto',
        background:  '#1a1a1a',
        border:      '1px solid rgba(255,255,255,0.1)',
        borderRadius: 4,
        padding:     12,
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* ── GAIN ── */}
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[9px] text-[#555] uppercase tracking-wider">GAIN</span>
        <input
          type="range" min="0" max="2" step="0.01" value={gain}
          onChange={e => onGainChange(parseFloat(e.target.value))}
          style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 64, width: 16, cursor: 'pointer' }}
        />
        <span className="text-[10px] text-accent font-bold tabular-nums">
          {Math.round(gain * 100)}%
        </span>
      </div>

      <div className="h-px bg-[rgba(255,255,255,0.06)]" />

      {/* ── GATE ── */}
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[9px] text-[#555] uppercase tracking-wider">GATE</span>
        <input
          type="range" min="5" max="100" step="1" value={gate ?? 100}
          onChange={e => onGateChange(parseInt(e.target.value, 10))}
          style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 64, width: 16, cursor: 'pointer' }}
        />
        <span className="text-[10px] text-accent font-bold tabular-nums">
          {gate ?? 100}%
        </span>
      </div>

      <div className="h-px bg-[rgba(255,255,255,0.06)]" />

      {/* ── PAN ── */}
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[9px] text-[#555] uppercase tracking-wider">PAN</span>
        <input
          type="range" min="-1" max="1" step="0.01" value={pan}
          onChange={e => onPanChange(parseFloat(e.target.value))}
          className="w-16"
        />
        <span className="text-[10px] text-accent font-bold tabular-nums">
          {formatPan(pan)}
        </span>
      </div>

      <div className="h-px bg-[rgba(255,255,255,0.06)]" />

      {/* ── EQ (Pro) ── */}
      <div style={{ opacity: isPro ? 1 : 0.4 }}>
        {/* EQ header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>EQ</span>
            {!isPro && (
              <span style={{
                fontSize: 6, fontWeight: 900, letterSpacing: '0.12em',
                color: '#C46E1F', background: 'rgba(196,110,31,0.15)',
                border: '1px solid rgba(196,110,31,0.35)', borderRadius: 2,
                padding: '1px 3px', lineHeight: 1, fontFamily: 'monospace',
              }}>PRO</span>
            )}
          </div>
          {/* ON/OFF toggle */}
          <button
            onClick={handleEqToggle}
            style={{
              background:   eq.enabled && isPro ? '#C46E1F' : 'transparent',
              color:        eq.enabled && isPro ? '#0f0d09' : 'rgba(242,220,180,0.5)',
              border:       `1px solid ${eq.enabled && isPro ? '#C46E1F' : 'rgba(242,220,180,0.2)'}`,
              borderRadius: 2,
              fontSize:     8,
              fontWeight:   700,
              padding:      '1px 5px',
              cursor:       isPro ? 'pointer' : 'not-allowed',
              fontFamily:   'monospace',
              letterSpacing: '0.08em',
              lineHeight:   1.6,
            }}
          >
            {eq.enabled && isPro ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* 3-band sliders */}
        <div
          style={{ display: 'flex', justifyContent: 'space-around', cursor: !isPro ? 'pointer' : 'default' }}
          onClick={!isPro ? () => onProRequired?.() : undefined}
        >
          {[
            { band: 'low',  label: 'LOW',  val: eq.low  ?? 0 },
            { band: 'mid',  label: 'MID',  val: eq.mid  ?? 0 },
            { band: 'high', label: 'HIGH', val: eq.high ?? 0 },
          ].map(({ band, label, val }) => (
            <div key={band} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 8, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
              <input
                type="range" min="-12" max="12" step="0.5" value={val}
                onChange={e => handleEqBand(band, e.target.value)}
                style={eqSlider}
                disabled={!isPro}
              />
              <span style={{ fontSize: 9, color: '#C46E1F', fontFamily: 'monospace', fontWeight: 700, tabularNums: true }}>
                {fmtDb(val)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-[rgba(255,255,255,0.06)]" />

      {/* ── SWING (Pro) ── */}
      <div style={{ opacity: isPro ? 1 : 0.4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Swing</span>
            {!isPro && (
              <span style={{
                fontSize: 6, fontWeight: 900, letterSpacing: '0.12em',
                color: '#C46E1F', background: 'rgba(196,110,31,0.15)',
                border: '1px solid rgba(196,110,31,0.35)', borderRadius: 2,
                padding: '1px 3px', lineHeight: 1, fontFamily: 'monospace',
              }}>PRO</span>
            )}
          </div>
          <span style={{ fontSize: 10, color: '#C46E1F', fontFamily: 'monospace', fontWeight: 700 }}>
            {trackSwing ?? 0}%
          </span>
        </div>
        <div
          style={{ cursor: !isPro ? 'pointer' : 'default' }}
          onClick={!isPro ? () => onProRequired?.() : undefined}
        >
          <input
            type="range" min="0" max="75" step="1" value={trackSwing ?? 0}
            disabled={!isPro}
            onChange={e => {
              if (!isPro) { onProRequired?.(); return }
              onTrackSwingChange?.(parseInt(e.target.value, 10))
            }}
            className="w-full"
            style={{ cursor: isPro ? 'pointer' : 'not-allowed' }}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
