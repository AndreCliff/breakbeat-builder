import { useState, useCallback, useRef } from 'react'
import PadPopover from './PadPopover.jsx'
import { isLightPadColor } from '../lib/padColors.js'

export default function Pad({
  index,
  name,
  loaded,
  muted,
  soloed,
  gain,
  pan,
  padGate,
  padEq,
  trackSwing,
  padColor,
  isFlashing,
  keyLabel,
  onTrigger,
  onMuteToggle,
  onSoloToggle,
  onGainChange,
  onPanChange,
  onPadGateChange,
  onPadEqChange,
  onPadEqToggle,
  onTrackSwingChange,
  onProRequired,
}) {
  const [showPopover, setShowPopover] = useState(false)
  const [anchorRect, setAnchorRect]   = useState(null)
  const padRef = useRef(null)

  const handleClick    = useCallback(() => { if (loaded) onTrigger(index) }, [loaded, index, onTrigger])
  const handleMute     = useCallback(e  => { e.stopPropagation(); if (loaded) onMuteToggle(index) }, [loaded, index, onMuteToggle])
  const handleSolo     = useCallback(e  => { e.stopPropagation(); if (loaded) onSoloToggle(index) }, [loaded, index, onSoloToggle])
  const handlePopoverBtn = useCallback(e => {
    e.stopPropagation()
    if (!loaded) return
    if (showPopover) {
      setShowPopover(false)
      setAnchorRect(null)
    } else {
      setAnchorRect(padRef.current?.getBoundingClientRect() ?? null)
      setShowPopover(true)
    }
  }, [loaded, showPopover])

  // ── Visual states ───────────────────────────────────────────────────────────

  // Pad surface background
  const padBg = isFlashing
    ? padColor
    : loaded
      ? 'radial-gradient(ellipse at 50% 40%, #242018 0%, #0f0d09 100%)'
      : 'transparent'

  // Border: pad color at 40% when loaded, accent highlight when flashing, barely-visible dashed when empty
  const padBorder = isFlashing
    ? `2px solid ${padColor}`
    : loaded
      ? `2px solid ${padColor}66`
      : '1px solid rgba(242,220,180,0.15)'

  // Shadow: inset rubber-pad depth when idle, outer LED glow when flashing, none when empty
  const padShadow = isFlashing
    ? `0 0 14px ${padColor}, 0 0 28px ${padColor}55`
    : loaded
      ? 'inset 0 2px 6px rgba(0,0,0,0.7), inset 0 -1px 3px rgba(255,255,255,0.03)'
      : 'none'

  // Label color — dark text on light flash colors, cream otherwise
  const labelColor = isFlashing && isLightPadColor(padColor) ? '#000' : '#f2dcb4'
  const labelOpacity = isFlashing ? 1 : loaded ? 0.85 : 0.2

  return (
    <div ref={padRef} className="relative" style={{ aspectRatio: '1 / 1', opacity: loaded ? 1 : 0.08 }}>

      {/* ── Main pad button ─────────────────────────────────────────────────── */}
      <button
        onClick={handleClick}
        disabled={!loaded}
        className={`
          w-full h-full flex flex-col items-center justify-end
          rounded-[6px] select-none
          transition-all duration-75
          ${loaded ? 'cursor-pointer' : 'cursor-not-allowed'}
          ${loaded && !isFlashing ? 'hover:brightness-[1.18]' : ''}
          ${loaded && muted && !isFlashing ? 'opacity-40' : ''}
        `}
        style={{
          background: padBg,
          border:     padBorder,
          boxShadow:  padShadow,
          transform:  isFlashing ? 'scale(1.03)' : 'scale(1)',
          paddingBottom: 8,
          paddingLeft:   6,
          paddingRight:  6,
        }}
      >
        {/* ── Status indicators (muted / soloed) ── */}
        {loaded && !isFlashing && (muted || soloed) && (
          <div className="flex gap-1 mb-1">
            {soloed && (
              <span className="text-[8px] font-bold uppercase tracking-wider"
                    style={{ color: '#C46E1F' }}>S</span>
            )}
            {muted && (
              <span className="text-[8px] font-bold uppercase tracking-wider"
                    style={{ color: padColor }}>M</span>
            )}
          </div>
        )}

        {/* ── Silk-screened name label — lower third ── */}
        {loaded && (
          <span
            className="text-[11px] font-bold uppercase leading-tight text-center w-full"
            style={{
              color:        labelColor,
              opacity:      labelOpacity,
              fontFamily:   'inherit',
              letterSpacing: '0.04em',
              wordBreak:    'break-word',
              overflowWrap: 'break-word',
              display:      'block',
            }}
          >
            {name || '—'}
          </span>
        )}
      </button>

      {/* ── S / M / G controls — top-right overlay ─────────────────────────── */}
      {loaded && (
        <div className="absolute top-1 right-1 flex gap-[2px]">

          {/* Solo */}
          <button
            onClick={handleSolo}
            title={soloed ? 'Unsolo' : 'Solo'}
            className="font-bold flex items-center justify-center
                       transition-colors duration-75 select-none rounded-[2px]"
            style={{
              width:      18,
              height:     18,
              fontSize:   8,
              background: soloed ? '#C46E1F' : 'rgba(15,13,9,0.8)',
              color:      soloed ? '#fff'    : 'rgba(242,220,180,0.5)',
              border:     soloed ? '1px solid #C46E1F' : '1px solid rgba(242,220,180,0.2)',
            }}
          >
            S
          </button>

          {/* Mute */}
          <button
            onClick={handleMute}
            title={muted ? 'Unmute' : 'Mute'}
            className="font-bold flex items-center justify-center
                       transition-colors duration-75 select-none rounded-[2px]"
            style={{
              width:      18,
              height:     18,
              fontSize:   8,
              background: muted ? padColor : 'rgba(15,13,9,0.8)',
              color:      muted ? (isLightPadColor(padColor) ? '#000' : '#fff') : 'rgba(242,220,180,0.5)',
              border:     muted ? `1px solid ${padColor}` : '1px solid rgba(242,220,180,0.2)',
            }}
          >
            M
          </button>

          {/* Gain / Pan / Gate */}
          <button
            onClick={handlePopoverBtn}
            title="Gain / Pan / Gate"
            className="font-bold flex items-center justify-center
                       transition-colors duration-75 select-none rounded-[2px]"
            style={{
              width:      18,
              height:     18,
              fontSize:   8,
              background: showPopover ? padColor : 'rgba(15,13,9,0.8)',
              color:      showPopover ? (isLightPadColor(padColor) ? '#000' : '#fff') : 'rgba(242,220,180,0.5)',
              border:     showPopover ? `1px solid ${padColor}` : '1px solid rgba(242,220,180,0.2)',
            }}
          >
            G
          </button>
        </div>
      )}

      {/* ── Keyboard shortcut label — bottom left ──────────────────────────── */}
      {keyLabel && (
        <span
          className="absolute bottom-1 left-1 pointer-events-none select-none"
          style={{
            fontSize:   9,
            fontFamily: 'monospace',
            fontWeight: 700,
            color:      'rgba(242,220,180,0.35)',
            lineHeight: 1,
            zIndex:     5,
          }}
        >
          {keyLabel}
        </span>
      )}

      {/* ── Gain / Pan / Gate popover ──────────────────────────────────────── */}
      {showPopover && loaded && anchorRect && (
        <PadPopover
          anchorRect={anchorRect}
          gain={gain}
          pan={pan}
          gate={padGate}
          padEq={padEq}
          trackSwing={trackSwing}
          onGainChange={v => onGainChange(index, v)}
          onPanChange={v => onPanChange(index, v)}
          onGateChange={v => onPadGateChange(index, v)}
          onPadEqChange={eq => onPadEqChange?.(index, eq)}
          onPadEqToggle={() => onPadEqToggle?.(index)}
          onTrackSwingChange={v => onTrackSwingChange?.(index, v)}
          onProRequired={onProRequired}
          onClose={() => { setShowPopover(false); setAnchorRect(null) }}
        />
      )}
    </div>
  )
}
