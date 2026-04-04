import { useState, useEffect, useRef } from 'react'
import SequencerRow from './SequencerRow.jsx'
import TexturePanel from './TexturePanel.jsx'
import { getPadColor } from '../lib/padColors.js'

// Inline button style for copy/paste controls
const cpBtn = (active) => ({
  background:    active ? '#C46E1F' : 'rgba(196,110,31,0.08)',
  color:         active ? '#0f0d09' : '#C46E1F',
  border:        `1px solid ${active ? '#C46E1F' : 'rgba(196,110,31,0.4)'}`,
  borderRadius:  3,
  height:        28,
  padding:       '0 12px',
  fontSize:      11,
  fontWeight:    700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  cursor:        'pointer',
  fontFamily:    'monospace',
  whiteSpace:    'nowrap',
  display:       'inline-flex',
  alignItems:    'center',
})


export default function Sequencer({
  pads,
  steps,
  gates,
  pitches,
  muted,
  solos,
  padGates,
  currentStep,
  currentBar,
  loopLength,
  isPlaying,
  onStepToggle,
  onStepsBulkSet,
  onVelocityChange,
  onGateChange,
  onPitchChange,
  onMuteToggle,
  onSoloToggle,
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
  const totalSteps = loopLength * 16
  const viewSteps  = 32   // always show 32 steps at a time (2 bars)
  const maxOffset  = Math.max(0, totalSteps - viewSteps)

  const [scrollOffset, setScrollOffset] = useState(0)
  const userScrolledRef = useRef(false)

  // ── Copy / Paste state ─────────────────────────────────────────────────────
  const [clipboard,  setClipboard] = useState(null)  // { barNum, data: number[16][] }
  const [copyMode,   setCopyMode]  = useState(false)
  const [pasteMode,  setPasteMode] = useState(false)
  const [cpMsg,      setCpMsg]     = useState('')

  const absCurrentStep = currentStep >= 0 ? currentBar * 16 + currentStep : -1

  useEffect(() => {
    if (!isPlaying || loopLength <= 2 || userScrolledRef.current) return
    const targetOffset = Math.floor(currentBar / 2) * 32
    setScrollOffset(Math.min(targetOffset, maxOffset))
  }, [currentBar, isPlaying, loopLength, maxOffset])

  useEffect(() => {
    setScrollOffset(0)
    userScrolledRef.current = false
  }, [loopLength])

  useEffect(() => {
    if (!isPlaying) {
      userScrolledRef.current = false
      setScrollOffset(0)
    }
  }, [isPlaying])

  const translatePct = maxOffset > 0 ? (scrollOffset / totalSteps) * 100 : 0
  const barStart     = Math.floor(scrollOffset / 16) + 1
  const barEnd       = Math.min(barStart + 1, loopLength)
  const barLabel     = `Bars ${barStart}–${barEnd}`

  // ── Copy / Paste handlers ──────────────────────────────────────────────────
  function handleCopyBar(barNum) {
    const fromStep = (barNum - 1) * 16
    const data = pads.map((_, padIdx) =>
      Array.from({ length: 16 }, (_, i) => steps[padIdx]?.[fromStep + i] ?? 0)
    )
    setClipboard({ barNum, data })
    setCopyMode(false)
    setCpMsg(`Bar ${barNum} copied`)
    setTimeout(() => setCpMsg(''), 2500)
  }

  function handlePasteBar(barNum) {
    if (!clipboard || !onStepsBulkSet) return
    const destStart = (barNum - 1) * 16
    const changes = []
    clipboard.data.forEach((padData, padIdx) => {
      padData.forEach((velocity, i) => {
        changes.push({ padIdx, stepIdx: destStart + i, velocity })
      })
    })
    onStepsBulkSet(changes)
    setPasteMode(false)
    setCpMsg(`Bar ${clipboard.barNum} → Bar ${barNum}`)
    setTimeout(() => setCpMsg(''), 2500)
  }

  return (
    <div
      className="rounded-[4px] overflow-hidden"
      style={{
        background: '#1e1b14',
        border:     '1px solid rgba(242,220,180,0.1)',
        boxShadow:  'inset 0 2px 12px rgba(0,0,0,0.6)',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid rgba(242,220,180,0.07)' }}>
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-3">
            <div
              className="text-[9px] uppercase tracking-widest font-bold"
              style={{ color: 'rgba(242,220,180,0.4)' }}
            >
              Sequencer
              {loopLength > 2 && (
                <span className="ml-3 font-bold" style={{ color: 'rgba(242,220,180,0.4)' }}>
                  {barLabel}
                </span>
              )}
            </div>
            {/* Copy/Paste controls */}
            <div className="flex items-center gap-1 flex-wrap">
              {!copyMode && !pasteMode ? (
                <>
                  <button style={cpBtn(false)} onClick={() => setCopyMode(true)}>
                    Copy Bar
                  </button>
                  <button
                    style={{ ...cpBtn(false), opacity: clipboard ? 1 : 0.35, cursor: clipboard ? 'pointer' : 'not-allowed' }}
                    disabled={!clipboard}
                    onClick={() => setPasteMode(true)}
                  >
                    Paste{clipboard ? ` (${clipboard.barNum})` : ''}
                  </button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(242,220,180,0.5)', letterSpacing: '0.08em', paddingRight: 2 }}>
                    {copyMode ? 'COPY BAR:' : 'PASTE TO BAR:'}
                  </span>
                  {Array.from({ length: loopLength }, (_, i) => i + 1).map(barNum => (
                    <button
                      key={barNum}
                      style={{
                        ...cpBtn(false),
                        opacity: pasteMode && barNum === clipboard?.barNum ? 0.4 : 1,
                        minWidth: 22,
                        padding: '2px 5px',
                      }}
                      onClick={() => copyMode ? handleCopyBar(barNum) : handlePasteBar(barNum)}
                    >
                      {barNum}
                    </button>
                  ))}
                  <button
                    style={{ ...cpBtn(false), opacity: 0.5, padding: '2px 5px' }}
                    onClick={() => { setCopyMode(false); setPasteMode(false) }}
                  >
                    ✕
                  </button>
                </>
              )}
              {cpMsg && (
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#C46E1F', letterSpacing: '0.06em' }}>
                  {cpMsg}
                </span>
              )}
            </div>
          </div>
          <div
            className="text-[10px] font-bold uppercase tracking-widest tabular-nums"
            style={{ color: isPlaying ? '#C46E1F' : 'rgba(242,220,180,0.35)' }}
          >
            Bar {isPlaying ? currentBar + 1 : 1} / {loopLength}
          </div>
        </div>

      </div>

      {/* ── Step number header ──────────────────────────────────────────────── */}
      <div className="flex items-center px-4 pt-2 pb-1">
        {/* Matches: 110px label + pl-2 viewport */}
        <span className="shrink-0" style={{ width: 118 }} />

        <div className="flex-1 overflow-hidden">
          <div
            className="flex gap-0"
            style={{
              width:     `${loopLength * 50}%`,
              transform: `translateX(-${translatePct}%)`,
            }}
          >
            {Array.from({ length: totalSteps }, (_, i) => {
              const isPlayhead   = i === absCurrentStep
              const isGroupStart = i > 0 && i % 4 === 0
              const isBarBound   = i > 0 && i % 16 === 0
              return (
                <span
                  key={i}
                  className="flex-1 text-center select-none tabular-nums font-mono"
                  style={{
                    fontSize:   7,
                    marginLeft: isBarBound ? 10 : isGroupStart ? 4 : 1,
                    color:      isPlayhead
                      ? '#C46E1F'
                      : 'rgba(242,220,180,0.35)',
                    fontWeight: isPlayhead ? 700 : 400,
                    lineHeight: 1,
                  }}
                >
                  {i + 1}
                </span>
              )
            })}
          </div>
        </div>

        {/* Matches: pl-2 + gap-[4px] + 2×w-6 */}
        <span className="shrink-0" style={{ width: 64 }} />
      </div>

      {/* ── Track rows ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col px-4 pb-1">
        {pads.map((pad, padIdx) => (
          <div
            key={padIdx}
            style={{
              borderBottom: padIdx < pads.length - 1
                ? '1px solid rgba(242,220,180,0.06)'
                : 'none',
              paddingTop:    4,
              paddingBottom: 4,
            }}
          >
            <SequencerRow
              name={pad.name}
              steps={(steps[padIdx]     ?? Array(64).fill(0)).slice(0, totalSteps)}
              gates={(gates[padIdx]     ?? Array(64).fill(null)).slice(0, totalSteps)}
              pitches={(pitches[padIdx] ?? Array(64).fill(0)).slice(0, totalSteps)}
              padGate={padGates?.[padIdx] ?? 100}
              muted={muted[padIdx] ?? false}
              soloed={solos?.[padIdx] ?? false}
              padColor={getPadColor(padIdx)}
              currentStep={absCurrentStep}
              loopLength={loopLength}
              translatePct={translatePct}
              onStepToggle={stepIdx => onStepToggle(padIdx, stepIdx)}
              onVelocityChange={(stepIdx, vel) => onVelocityChange(padIdx, stepIdx, vel)}
              onGateChange={(stepIdx, gate) => onGateChange(padIdx, stepIdx, gate)}
              onPitchChange={(stepIdx, semi) => onPitchChange(padIdx, stepIdx, semi)}
              onMuteToggle={() => onMuteToggle(padIdx)}
              onSoloToggle={() => onSoloToggle(padIdx)}
            />
          </div>
        ))}
      </div>

      {/* ── Texture panel ───────────────────────────────────────────────────── */}
      <TexturePanel
        tapeHissEnabled={tapeHissEnabled}
        tapeHissLevel={tapeHissLevel}
        vinylCrackleEnabled={vinylCrackleEnabled}
        vinylCrackleDensity={vinylCrackleDensity}
        onTapeHissToggle={onTapeHissToggle}
        onTapeHissLevelChange={onTapeHissLevelChange}
        onCrackleToggle={onCrackleToggle}
        onCrackleDensityChange={onCrackleDensityChange}
        bitCrusherEnabled={bitCrusherEnabled}
        bitCrusherDepth={bitCrusherDepth}
        bitCrusherRate={bitCrusherRate}
        onBitCrusherToggle={onBitCrusherToggle}
        onBitCrusherDepthChange={onBitCrusherDepthChange}
        onBitCrusherRateChange={onBitCrusherRateChange}
        onProRequired={onProRequired}
      />

      {/* ── Horizontal scrollbar (multi-bar) ────────────────────────────────── */}
      <div
        className={`px-4 pb-3 flex items-center gap-3 transition-opacity duration-150
                    ${loopLength > 2 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ borderTop: '1px solid rgba(242,220,180,0.07)' }}
      >
        <span
          className="text-[9px] uppercase tracking-widest shrink-0 pt-3 transition-colors duration-100"
          style={{ color: scrollOffset === 0 ? '#C46E1F' : 'rgba(242,220,180,0.4)', fontWeight: scrollOffset === 0 ? 700 : 400, minWidth: 48 }}
        >
          Bars 1–2
        </span>

        <input
          type="range"
          min="0"
          max={maxOffset}
          step={viewSteps}
          value={scrollOffset}
          disabled={loopLength <= 2}
          onChange={e => {
            userScrolledRef.current = true
            setScrollOffset(parseInt(e.target.value, 10))
          }}
          className="flex-1 mt-3"
          style={{ background: 'rgba(242,220,180,0.12)' }}
          title={`Viewing ${barLabel}`}
        />

        <span
          className="text-[9px] uppercase tracking-widest shrink-0 text-right pt-3 transition-colors duration-100"
          style={{ color: scrollOffset === maxOffset ? '#C46E1F' : 'rgba(242,220,180,0.4)', fontWeight: scrollOffset === maxOffset ? 700 : 400, minWidth: 48 }}
        >
          Bars {loopLength - 1}–{loopLength}
        </span>
      </div>

    </div>
  )
}
