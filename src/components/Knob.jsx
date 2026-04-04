import { useRef, useCallback } from 'react'

/**
 * Rotary knob — drag up to increase, drag down to decrease.
 * Renders an SVG arc track + fill, and a rotating indicator dot.
 */
export default function Knob({
  value,
  min = 0,
  max = 1,
  onChange,
  label,
  displayValue,
  size = 44,
}) {
  const dragRef = useRef(null)

  const norm  = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const angle = norm * 270 - 135  // degrees: -135 (min) → +135 (max)

  // SVG arc geometry
  const half  = size / 2
  const r     = half - 4
  const circ  = 2 * Math.PI * r
  const arcLen = circ * 0.75        // 270° of the circle = track length
  const fillLen = arcLen * norm     // filled portion

  // Rotate SVG so the track gap sits at the bottom (7 o'clock → 5 o'clock sweep)
  // strokeDasharray starts at 3 o'clock; rotating 135° puts start at 7 o'clock
  const svgRotate = 'rotate(135deg)'

  const handlePointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { y: e.clientY, startVal: value }
  }, [value])

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current) return
    const dy     = dragRef.current.y - e.clientY      // up = positive
    const range  = max - min
    const newVal = Math.max(min, Math.min(max,
      dragRef.current.startVal + (dy / 100) * range
    ))
    onChange(parseFloat(newVal.toFixed(2)))
  }, [min, max, onChange])

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div
        className="relative cursor-ns-resize"
        style={{ width: size, height: size }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Arc track + fill */}
        <svg
          width={size}
          height={size}
          className="absolute inset-0"
          style={{ transform: svgRotate }}
        >
          {/* Track (full 270° arc) */}
          <circle
            cx={half} cy={half} r={r}
            fill="none"
            stroke="#252525"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${circ - arcLen}`}
          />
          {/* Fill (value portion) */}
          {norm > 0.005 && (
            <circle
              cx={half} cy={half} r={r}
              fill="none"
              stroke="#C46E1F"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${fillLen} ${circ - fillLen}`}
            />
          )}
        </svg>

        {/* Dark center disc */}
        <div
          className="absolute rounded-full bg-[#1a1a1a]"
          style={{ top: 5, left: 5, right: 5, bottom: 5 }}
        />

        {/* Indicator dot — rotates with value, independent of SVG */}
        <div
          className="absolute inset-0"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div
            className="absolute rounded-full bg-white"
            style={{ width: 4, height: 4, top: 4, left: '50%', transform: 'translateX(-50%)' }}
          />
        </div>
      </div>

      {displayValue !== undefined && (
        <span className="text-[10px] text-white font-bold tabular-nums leading-none">
          {displayValue}
        </span>
      )}

      <span className="text-[9px] text-[#555] uppercase tracking-wider text-center leading-tight">
        {label}
      </span>
    </div>
  )
}
