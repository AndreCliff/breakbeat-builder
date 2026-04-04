import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// ── Piano keyboard geometry ───────────────────────────────────────────────────
const WHITE_W  = 11   // px per white key
const WHITE_H  = 36   // px height of white key
const BLACK_W  = 7    // px width of black key
const BLACK_H  = 22   // px height of black key

// Within one octave: which chromatic positions are white keys
const WHITE_IN_OCT = new Set([0, 2, 4, 5, 7, 9, 11])

// Pre-compute 2-octave key data (24 keys).
// Treating root (semitone 0) as C, so keyboard shows one octave below and
// above — semitone −12 (low C) through +11 (high B).
const KEY_DATA = (() => {
  const keys = []
  let wc = 0
  for (let i = 0; i < 24; i++) {
    const noteInOct = i % 12
    const isWhite   = WHITE_IN_OCT.has(noteInOct)
    keys.push({ semitone: i - 12, isWhite, whiteIndex: wc })
    if (isWhite) wc++
  }
  return keys
})()
// 14 white keys × WHITE_W = keyboard total width
const KEYBOARD_W = 14 * WHITE_W  // 154 px

// ── Popover dimensions ────────────────────────────────────────────────────────
const POPOVER_W = KEYBOARD_W + 20  // 174 px  (10 px padding each side)
const POPOVER_H = 260              // conservative height estimate
const MARGIN    = 6

/**
 * Right-click velocity + gate + pitch editor for an individual sequencer step.
 * Rendered via a React portal to escape overflow:hidden scroll containers.
 *
 * anchorRect: DOMRect (viewport coords) of the step button that triggered this
 * stepGate:   null = inheriting pad gate, number = step-level override (5–100)
 * padGate:    number (5–100) — the pad's default gate
 * pitch:      number — semitone offset from root (−12…+11), 0 = original pitch
 */
export default function VelocityPopover({
  anchorRect,
  velocity,
  stepGate,
  padGate,
  pitch,
  onChange,
  onGateChange,
  onPitchChange,
  onClose,
}) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const isInheriting = stepGate === null
  const resolvedGate = stepGate ?? padGate ?? 100
  const modeLabel    = isInheriting ? 'PAD' : 'STEP'

  // ── Smart positioning ─────────────────────────────────────────────────────
  const spaceAbove = anchorRect.top
  const showAbove  = spaceAbove >= POPOVER_H + MARGIN

  const top = showAbove
    ? anchorRect.top - POPOVER_H - MARGIN
    : anchorRect.bottom + MARGIN

  const idealLeft = anchorRect.left + anchorRect.width / 2 - POPOVER_W / 2
  const left = Math.max(MARGIN, Math.min(idealLeft, window.innerWidth - POPOVER_W - MARGIN))

  // ── Pitch label ───────────────────────────────────────────────────────────
  const pitchLabel = pitch === 0 ? 'ROOT' : pitch > 0 ? `+${pitch}` : `${pitch}`

  return createPortal(
    <div
      ref={ref}
      className="bg-[#1e1b14] border border-[rgba(255,240,200,0.1)] rounded-[4px]
                 p-2.5 flex flex-col items-center gap-2 shadow-xl"
      style={{ position: 'fixed', zIndex: 9999, width: POPOVER_W, left, top }}
      onClick={e => e.stopPropagation()}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Velocity */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[8px] text-[#7a7060] uppercase tracking-wider">VEL</span>
        <input
          type="range"
          min="1"
          max="127"
          value={velocity}
          onChange={e => onChange(parseInt(e.target.value, 10))}
          style={{
            writingMode: 'vertical-lr',
            direction:   'rtl',
            height:      52,
            width:       16,
            cursor:      'pointer',
          }}
        />
        <span className="text-[10px] text-accent font-bold tabular-nums leading-none">
          {velocity}
        </span>
      </div>

      <div className="w-full h-px bg-[rgba(255,240,200,0.07)]" />

      {/* Gate */}
      <div className="flex flex-col items-center gap-1 w-full">
        <div className="flex items-center justify-between w-full">
          <span className="text-[8px] text-[#7a7060] uppercase tracking-wider">GATE</span>
          <span
            className="text-[7px] font-bold uppercase tracking-wider px-1 rounded-[2px]"
            style={{
              color:      isInheriting ? '#7a7060' : '#C46E1F',
              background: isInheriting ? 'rgba(255,240,200,0.06)' : 'rgba(196,110,31,0.15)',
            }}
          >
            {modeLabel}
          </span>
        </div>
        <input
          type="range"
          min="5"
          max="100"
          value={resolvedGate}
          onChange={e => onGateChange(parseInt(e.target.value, 10))}
          className="w-full"
        />
        <div className="flex items-center justify-between w-full">
          <span className="text-[10px] text-accent font-bold tabular-nums leading-none">
            {resolvedGate}%
          </span>
          {!isInheriting && (
            <button
              onClick={() => onGateChange(null)}
              title="Reset to pad gate"
              className="text-[8px] text-[#7a7060] hover:text-[#C46E1F] leading-none transition-colors"
            >
              ×PAD
            </button>
          )}
        </div>
      </div>

      <div className="w-full h-px bg-[rgba(255,240,200,0.07)]" />

      {/* Pitch */}
      <div className="flex flex-col gap-1 w-full">
        <div className="flex items-center justify-between w-full">
          <span className="text-[8px] text-[#7a7060] uppercase tracking-wider">PITCH</span>
          <span
            className="text-[8px] font-bold tabular-nums"
            style={{ color: pitch === 0 ? '#7a7060' : '#C46E1F' }}
          >
            {pitchLabel}
          </span>
        </div>

        {/* Piano keys */}
        <div style={{ position: 'relative', width: KEYBOARD_W, height: WHITE_H, alignSelf: 'center' }}>

          {/* White keys */}
          {KEY_DATA.filter(k => k.isWhite).map(k => {
            const isRoot     = k.semitone === 0
            const isSelected = k.semitone === pitch
            return (
              <button
                key={k.semitone}
                title={k.semitone === 0 ? 'ROOT (original pitch)' : `${k.semitone > 0 ? '+' : ''}${k.semitone} semitones`}
                onClick={() => onPitchChange(k.semitone)}
                style={{
                  position:     'absolute',
                  left:         k.whiteIndex * WHITE_W,
                  width:        WHITE_W - 1,
                  height:       WHITE_H,
                  background:   isSelected ? '#C46E1F' : '#e8dcc8',
                  borderRadius: '0 0 2px 2px',
                  border:       '1px solid rgba(0,0,0,0.25)',
                  cursor:       'pointer',
                  zIndex:       1,
                  padding:      0,
                }}
              >
                {isRoot && (
                  <span
                    style={{
                      position:      'absolute',
                      bottom:        2,
                      left:          0,
                      right:         0,
                      textAlign:     'center',
                      fontSize:      5,
                      lineHeight:    1,
                      color:         isSelected ? '#fff' : '#888',
                      pointerEvents: 'none',
                      userSelect:    'none',
                    }}
                  >
                    R
                  </span>
                )}
              </button>
            )
          })}

          {/* Black keys */}
          {KEY_DATA.filter(k => !k.isWhite).map(k => {
            const isSelected = k.semitone === pitch
            return (
              <button
                key={k.semitone}
                title={`${k.semitone > 0 ? '+' : ''}${k.semitone} semitones`}
                onClick={e => { e.stopPropagation(); onPitchChange(k.semitone) }}
                style={{
                  position:     'absolute',
                  left:         k.whiteIndex * WHITE_W - Math.floor(BLACK_W / 2),
                  width:        BLACK_W,
                  height:       BLACK_H,
                  background:   isSelected ? '#C46E1F' : '#1e1b14',
                  borderRadius: '0 0 2px 2px',
                  border:       '1px solid rgba(0,0,0,0.55)',
                  cursor:       'pointer',
                  zIndex:       2,
                  padding:      0,
                }}
              />
            )
          })}
        </div>

        {/* Semitone range labels */}
        <div className="flex justify-between w-full" style={{ width: KEYBOARD_W, alignSelf: 'center' }}>
          <span className="text-[7px] text-[#3a3328] tabular-nums">−12</span>
          <span className="text-[7px] text-[#3a3328] tabular-nums">+11</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
