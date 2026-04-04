import Knob from './Knob.jsx'
import { useUserPlan } from '../contexts/UserPlanContext.jsx'

const PRO_LOCK = (
  <span style={{
    fontSize: 8, fontWeight: 700, letterSpacing: '0.12em',
    color: 'rgba(196,110,31,0.7)', fontFamily: 'monospace',
    border: '1px solid rgba(196,110,31,0.3)', borderRadius: 2,
    padding: '1px 4px', marginLeft: 5, verticalAlign: 'middle',
  }}>PRO</span>
)

/**
 * Ambient texture generators + Pro FX (Bit Crusher).
 * Always-on section inside the Sequencer panel.
 */
export default function TexturePanel({
  tapeHissEnabled,
  tapeHissLevel,
  vinylCrackleEnabled,
  vinylCrackleDensity,
  onTapeHissToggle,
  onTapeHissLevelChange,
  onCrackleToggle,
  onCrackleDensityChange,
  // Bit Crusher (Pro)
  bitCrusherEnabled,
  bitCrusherDepth,
  bitCrusherRate,
  onBitCrusherToggle,
  onBitCrusherDepthChange,
  onBitCrusherRateChange,
  onProRequired,
}) {
  const { isPro } = useUserPlan()

  const toggleStyle = (active) => ({
    background: active ? '#C46E1F'                  : 'rgba(15,13,9,0.8)',
    color:      active ? '#fff'                     : 'rgba(242,220,180,0.5)',
    border:     active ? '1px solid #C46E1F'        : '1px solid rgba(242,220,180,0.2)',
  })

  function handleBitCrusherToggle() {
    if (!isPro) { onProRequired?.(); return }
    onBitCrusherToggle?.()
  }

  return (
    <div
      style={{ borderTop: '1px solid rgba(242,220,180,0.07)' }}
      className="px-4 pt-3 pb-4"
    >
      {/* Section label */}
      <div
        className="text-[9px] uppercase tracking-widest font-bold mb-3"
        style={{ color: 'rgba(242,220,180,0.4)' }}
      >
        Texture
      </div>

      <div className="flex items-center gap-6 flex-wrap">

        {/* ── Tape Hiss ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            onClick={onTapeHissToggle}
            className="text-[9px] font-bold uppercase tracking-wider
                       transition-colors duration-75 select-none rounded-[2px]"
            style={{ ...toggleStyle(tapeHissEnabled), padding: '4px 8px', whiteSpace: 'nowrap' }}
          >
            Tape Hiss
          </button>
          <Knob
            value={tapeHissLevel}
            min={0}
            max={1}
            onChange={onTapeHissLevelChange}
            label="Level"
            displayValue={`${Math.round(tapeHissLevel * 100)}%`}
            size={36}
          />
        </div>

        {/* Divider */}
        <div className="self-stretch w-px" style={{ background: 'rgba(242,220,180,0.08)' }} />

        {/* ── Vinyl Crackle ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            onClick={onCrackleToggle}
            className="text-[9px] font-bold uppercase tracking-wider
                       transition-colors duration-75 select-none rounded-[2px]"
            style={{ ...toggleStyle(vinylCrackleEnabled), padding: '4px 8px', whiteSpace: 'nowrap' }}
          >
            Vinyl Crackle
          </button>
          <Knob
            value={vinylCrackleDensity}
            min={0}
            max={1}
            onChange={onCrackleDensityChange}
            label="Level"
            displayValue={`${Math.round(vinylCrackleDensity * 100)}%`}
            size={36}
          />
        </div>

        {/* Divider */}
        <div className="self-stretch w-px" style={{ background: 'rgba(242,220,180,0.08)' }} />

        {/* ── Bit Crusher (Pro) ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3" style={{ opacity: isPro ? 1 : 0.4 }}>
          <button
            onClick={handleBitCrusherToggle}
            className="text-[9px] font-bold uppercase tracking-wider
                       transition-colors duration-75 select-none rounded-[2px]"
            style={{ ...toggleStyle(bitCrusherEnabled && isPro), padding: '4px 8px', whiteSpace: 'nowrap' }}
          >
            Bit Crush{!isPro && PRO_LOCK}
          </button>
          <Knob
            value={bitCrusherDepth ?? 8}
            min={1}
            max={16}
            step={1}
            onChange={v => { if (!isPro) { onProRequired?.(); return } onBitCrusherDepthChange?.(v) }}
            label="Depth"
            displayValue={`${Math.round(bitCrusherDepth ?? 8)}bit`}
            size={36}
          />
          <Knob
            value={bitCrusherRate ?? 1}
            min={0.05}
            max={1}
            onChange={v => { if (!isPro) { onProRequired?.(); return } onBitCrusherRateChange?.(v) }}
            label="Rate"
            displayValue={`${Math.round((bitCrusherRate ?? 1) * 100)}%`}
            size={36}
          />
        </div>

      </div>
    </div>
  )
}
