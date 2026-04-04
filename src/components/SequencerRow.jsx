import { useState, useCallback, useRef, useEffect } from 'react'
import VelocityPopover from './VelocityPopover.jsx'

/** Convert a 6-digit hex color to rgba() with the given alpha (0–1). */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`
}

/**
 * One row of the step sequencer — dark hardware panel aesthetic.
 * steps: number[32|64] — 0 = inactive, 1–127 = velocity
 * gates: (number|null)[32|64] — null = inherit pad gate
 * currentStep: absolute step index, or -1 when stopped
 * translatePct: CSS translateX % (mirrors Sequencer scroll)
 * loopLength: 2 | 4
 */
export default function SequencerRow({
  name,
  steps,
  gates,
  pitches,
  padGate,
  muted,
  soloed,
  padColor,
  currentStep,
  loopLength,
  translatePct,
  onStepToggle,
  onVelocityChange,
  onGateChange,
  onPitchChange,
  onMuteToggle,
  onSoloToggle,
}) {
  const [openVelPop, setOpenVelPop] = useState(null)
  const [anchorRect, setAnchorRect] = useState(null)
  const hasSteps = steps.some(v => v > 0)

  // ── Drag-to-fill ─────────────────────────────────────────────────────────────
  const isDraggingRef   = useRef(false)
  const dragActivateRef = useRef(true)
  const draggedStepsRef = useRef(new Set())

  useEffect(() => {
    const handleMouseUp = () => { isDraggingRef.current = false }
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [])

  const handleStepMouseDown = useCallback((e, i) => {
    if (e.button !== 0) return
    e.preventDefault()
    isDraggingRef.current   = true
    dragActivateRef.current = steps[i] === 0
    draggedStepsRef.current = new Set([i])
    onStepToggle(i)
  }, [steps, onStepToggle])

  const handleStepMouseEnter = useCallback((i) => {
    if (!isDraggingRef.current || draggedStepsRef.current.has(i)) return
    const isActive = steps[i] > 0
    if ((dragActivateRef.current && !isActive) || (!dragActivateRef.current && isActive)) {
      draggedStepsRef.current.add(i)
      onStepToggle(i)
    }
  }, [steps, onStepToggle])

  // ── Right-click popover ──────────────────────────────────────────────────────
  const handleContextMenu = useCallback((e, i) => {
    e.preventDefault()
    if (steps[i] > 0) {
      if (openVelPop === i) {
        setOpenVelPop(null)
        setAnchorRect(null)
      } else {
        setAnchorRect(e.currentTarget.getBoundingClientRect())
        setOpenVelPop(i)
      }
    }
  }, [steps, openVelPop])

  const closeVelPop = useCallback(() => {
    setOpenVelPop(null)
    setAnchorRect(null)
  }, [])

  return (
    <div className="flex items-center gap-0">

      {/* ── Track label — silk-screened hardware lettering ─────────────────── */}
      <span
        className="shrink-0 text-[9px] font-bold uppercase tracking-widest pr-2"
        style={{
          width:       110,
          flexShrink:  0,
          color:       hasSteps ? '#C46E1F' : '#f2dcb4',
          opacity:     muted ? 0.4 : hasSteps ? 1.0 : 0.6,
          borderRight: '1px solid rgba(242,220,180,0.12)',
          transition:  'opacity 0.15s, color 0.15s',
          whiteSpace:  'nowrap',
          overflow:    'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {name}
      </span>

      {/* ── Scrollable step grid ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden pl-2">
        <div
          className="flex gap-0"
          style={{
            width:     `${loopLength * 50}%`,
            transform: `translateX(-${translatePct}%)`,
          }}
        >
          {steps.map((stepVel, i) => {
            const active       = stepVel > 0
            const isPlayhead   = i === currentStep
            const isGroupStart = i > 0 && i % 4 === 0
            const isBarBound   = i > 0 && i % 16 === 0

            const stepGate = gates?.[i] ?? null
            const gatePct  = stepGate ?? padGate ?? 100

            // Glow intensity scales slightly with velocity
            const glowAlpha = active
              ? Math.round(40 + (stepVel / 127) * 35).toString(16).padStart(2, '0')
              : '00'

            let boxShadow
            if (active && isPlayhead) {
              boxShadow = `0 0 10px ${padColor}cc, 0 0 4px ${padColor}`
            } else if (active) {
              boxShadow = `0 0 7px ${padColor}${glowAlpha}`
            } else if (isPlayhead) {
              boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.8), 0 0 0 1px rgba(196,110,31,0.5)'
            } else {
              boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.8)'
            }

            const borderColor = active
              ? padColor
              : isPlayhead
                ? 'rgba(196,110,31,0.6)'
                : 'rgba(242,220,180,0.15)'

            const velOpacity = active ? 0.1 + (stepVel / 127) * 0.9 : 1
            const bgColor    = active ? hexToRgba(padColor, velOpacity) : '#0f0d09'

            return (
              <div
                key={i}
                className="relative"
                style={{
                  flex: 1,
                  minWidth: 0,
                  marginLeft: isBarBound ? 9 : isGroupStart ? 3 : 1,
                  borderLeft: isBarBound
                    ? '1px solid rgba(242,220,180,0.18)'
                    : isGroupStart
                      ? '1px solid rgba(242,220,180,0.12)'
                      : 'none',
                }}
              >
                <button
                  onMouseDown={e => handleStepMouseDown(e, i)}
                  onMouseEnter={() => handleStepMouseEnter(i)}
                  onContextMenu={e => handleContextMenu(e, i)}
                  title={active
                    ? `Vel ${stepVel} · Gate ${gatePct}%${stepGate === null ? ' (pad)' : ' (step)'} — right-click to edit`
                    : `Step ${i + 1}`}
                  className="h-7 w-full rounded-[2px] relative overflow-hidden
                             transition-all duration-75 select-none"
                  style={{
                    background: bgColor,
                    border:     `1.5px solid ${borderColor}`,
                    boxShadow,
                  }}
                >
                  {/* Gate bar — top edge, width ∝ gate% (active only) */}
                  {active && (
                    <div
                      className="absolute top-0 left-0 h-[2px] z-10"
                      style={{ width: `${gatePct}%`, background: 'rgba(255,255,255,0.4)' }}
                    />
                  )}

                  {/* Playhead stripe */}
                  {isPlayhead && (
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px] z-20"
                      style={{ background: active ? 'rgba(255,255,255,0.9)' : 'rgba(196,110,31,0.85)' }}
                    />
                  )}
                </button>

                {/* Velocity + Gate + Pitch popover */}
                {openVelPop === i && active && anchorRect && (
                  <VelocityPopover
                    anchorRect={anchorRect}
                    velocity={stepVel}
                    stepGate={stepGate}
                    padGate={padGate ?? 100}
                    pitch={pitches?.[i] ?? 0}
                    onChange={vel => onVelocityChange(i, vel)}
                    onGateChange={gate => onGateChange(i, gate)}
                    onPitchChange={semi => onPitchChange(i, semi)}
                    onClose={closeVelPop}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Solo + Mute ──────────────────────────────────────────────────────── */}
      <div className="flex gap-[4px] shrink-0 pl-2">
        <button
          onClick={onSoloToggle}
          title={soloed ? 'Unsolo track' : 'Solo track'}
          className="w-6 h-6 text-[9px] font-bold rounded-[2px]
                     flex items-center justify-center transition-colors duration-75 select-none"
          style={{
            background: soloed ? '#C46E1F' : 'transparent',
            color:      soloed ? '#fff'    : 'rgba(242,220,180,0.5)',
            border:     soloed ? '1px solid #C46E1F' : '1px solid rgba(242,220,180,0.15)',
          }}
        >
          S
        </button>
        <button
          onClick={onMuteToggle}
          title={muted ? 'Unmute track' : 'Mute track'}
          className="w-6 h-6 text-[9px] font-bold rounded-[2px]
                     flex items-center justify-center transition-colors duration-75 select-none"
          style={{
            background: muted ? padColor : 'transparent',
            color:      muted ? '#000'   : 'rgba(242,220,180,0.5)',
            border:     muted ? `1px solid ${padColor}` : '1px solid rgba(242,220,180,0.15)',
          }}
        >
          M
        </button>
      </div>
    </div>
  )
}
