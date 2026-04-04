import { useEffect, useRef } from 'react'

/**
 * A small floating popover with a vertical gain slider.
 * Positioned relative to a parent — caller handles open/close state.
 */
export default function GainPopover({ gain, onChange, onClose }) {
  const ref = useRef(null)

  // Close on click outside
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
                 bg-[#1a1a1a] border border-[var(--border)] rounded-[4px]
                 p-3 flex flex-col items-center gap-2 shadow-xl"
      onClick={e => e.stopPropagation()}
    >
      <span className="text-[9px] text-[var(--muted)] uppercase tracking-wider">
        GAIN
      </span>

      {/* Vertical slider */}
      <div className="flex flex-col items-center gap-1" style={{ height: 80 }}>
        <input
          type="range"
          min="0"
          max="2"
          step="0.01"
          value={gain}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="w-3"
          style={{
            writingMode: 'vertical-lr',
            direction: 'rtl',
            height: 72,
            width: 16,
            cursor: 'pointer',
          }}
        />
      </div>

      <span className="text-[9px] text-accent font-bold">
        {Math.round(gain * 100)}%
      </span>
    </div>
  )
}
