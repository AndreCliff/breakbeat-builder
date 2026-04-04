import Pad from './Pad.jsx'
import { getPadColor } from '../lib/padColors.js'

export default function PadGrid({
  pads,
  muted,
  solos,
  gains,
  pans,
  padGates,
  padEqs,
  trackSwings,
  flashingPads,
  padKeyLabels,
  onPadTrigger,
  onMuteToggle,
  onSoloToggle,
  onGainChange,
  onPanChange,
  onPadGateChange,
  onPadEqChange,
  onPadEqToggle,
  onTrackSwingChange,
  onProRequired,
  onLoadNew,
}) {
  const slots = Array.from({ length: 16 }, (_, i) => ({
    index: i,
    pad: pads[i] ?? null,
  }))

  return (
    <div
      className="rounded-[4px]"
      style={{
        background:    '#161410',
        border:        '1px solid rgba(242,220,180,0.08)',
        boxShadow:     'inset 0 2px 10px rgba(0,0,0,0.5)',
        padding:       '12px',
        display:       'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Header: PADS label + Change Kit button ──────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[9px] font-bold uppercase tracking-widest"
          style={{ color: 'rgba(242,220,180,0.4)' }}
        >
          Pads
        </span>
        <button
          onClick={onLoadNew}
          className="text-[10px] font-bold uppercase tracking-wider
                     transition-colors duration-100 select-none rounded-[2px]"
          style={{
            color:        'rgba(242,220,180,0.45)',
            background:   'transparent',
            border:       '1px solid rgba(242,220,180,0.12)',
            padding:      '2px 7px',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color  = '#C46E1F'
            e.currentTarget.style.border = '1px solid rgba(196,110,31,0.5)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color  = 'rgba(242,220,180,0.45)'
            e.currentTarget.style.border = '1px solid rgba(242,220,180,0.12)'
          }}
        >
          ⟳ CHANGE KIT
        </button>
      </div>

      {/* ── 4×4 pad grid ─────────────────────────────────────────────────────── */}
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: 'repeat(4, 1fr)',
        }}
      >
        {slots.map(({ index, pad }) => (
          <Pad
            key={index}
            index={index}
            name={pad?.name ?? ''}
            loaded={!!pad}
            muted={muted[index] ?? false}
            soloed={solos?.[index] ?? false}
            gain={gains[index] ?? 1.0}
            pan={pans[index] ?? 0}
            padGate={padGates?.[index] ?? 100}
            padEq={padEqs?.[index]}
            trackSwing={trackSwings?.[index]}
            padColor={getPadColor(index)}
            isFlashing={flashingPads.has(index)}
            keyLabel={padKeyLabels?.[index]}
            onTrigger={onPadTrigger}
            onMuteToggle={onMuteToggle}
            onSoloToggle={onSoloToggle}
            onGainChange={onGainChange}
            onPanChange={onPanChange}
            onPadGateChange={onPadGateChange}
            onPadEqChange={onPadEqChange}
            onPadEqToggle={onPadEqToggle}
            onTrackSwingChange={onTrackSwingChange}
            onProRequired={onProRequired}
          />
        ))}
      </div>
    </div>
  )
}
