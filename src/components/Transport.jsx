import { useCallback } from 'react'
import Knob from './Knob.jsx'
import { useUserPlan } from '../contexts/UserPlanContext.jsx'

// ── Style tokens ──────────────────────────────────────────────────────────────

const SILK = {
  fontSize:      9,
  fontWeight:    700,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color:         'rgba(242,220,180,0.4)',
  fontFamily:    'monospace',
  lineHeight:    1,
}

const LED = {
  background:   '#0a0805',
  border:       '1px solid rgba(242,220,180,0.15)',
  boxShadow:    'inset 0 2px 4px rgba(0,0,0,0.8)',
  color:        '#C46E1F',
  fontFamily:   'monospace',
  fontWeight:   700,
  borderRadius: 2,
  textAlign:    'center',
}

function VDivider() {
  return (
    <div style={{
      width: 1, alignSelf: 'stretch',
      background: 'rgba(242,220,180,0.08)', flexShrink: 0,
    }} />
  )
}

// ── Scoped CSS (injected once) ────────────────────────────────────────────────

const CSS = `
  .hw-slider {
    -webkit-appearance: none; appearance: none;
    display: block; height: 4px;
    background: #0a0805;
    border: 1px solid rgba(242,220,180,0.10);
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.8);
    border-radius: 2px; outline: none; cursor: pointer;
  }
  .hw-slider::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; }
  .hw-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px; height: 14px; background: #C46E1F;
    border-radius: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.6);
    cursor: pointer; margin-top: -5px;
  }
  .hw-slider::-moz-range-track {
    height: 4px; background: #0a0805;
    border: 1px solid rgba(242,220,180,0.10); border-radius: 2px;
  }
  .hw-slider::-moz-range-thumb {
    width: 14px; height: 14px; background: #C46E1F;
    border-radius: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.6);
    cursor: pointer; border: none;
  }
  .hw-bpm::-webkit-outer-spin-button,
  .hw-bpm::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .hw-bpm { -moz-appearance: textfield; appearance: textfield; }
  .hw-play {
    background: #C46E1F; color: #0f0d09; font-weight: 700;
    font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;
    border: none; border-radius: 4px; padding: 0 18px; height: 34px;
    box-shadow: 0 4px 0 #5a2a00, 0 5px 8px rgba(0,0,0,0.6);
    cursor: pointer; transition: background 0.06s, transform 0.06s, box-shadow 0.06s;
    font-family: inherit; white-space: nowrap;
  }
  .hw-play:disabled { opacity: 0.38; cursor: not-allowed; box-shadow: none; }
  .hw-play:not(:disabled):hover { background: #d4782a; }
  .hw-play:not(:disabled):active { transform: translateY(2px); box-shadow: 0 2px 0 #5a2a00; }
  .hw-stop {
    background: #2a2418; color: rgba(242,220,180,0.8); font-weight: 700;
    font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;
    border: 1.5px solid rgba(242,220,180,0.2); border-radius: 4px;
    padding: 0 14px; height: 34px;
    box-shadow: 0 4px 0 rgba(0,0,0,0.55), 0 5px 8px rgba(0,0,0,0.4);
    cursor: pointer; transition: background 0.06s, transform 0.06s, box-shadow 0.06s;
    font-family: inherit; white-space: nowrap;
  }
  .hw-stop:disabled { opacity: 0.3; cursor: not-allowed; box-shadow: none; }
  .hw-stop:not(:disabled):hover { background: #332d1f; }
  .hw-stop:not(:disabled):active { transform: translateY(2px); box-shadow: 0 2px 0 rgba(0,0,0,0.55); }
  /* Pro loop button hover tooltip */
  .pro-btn-wrap { position: relative; }
  .pro-btn-wrap:hover .pro-tooltip {
    opacity: 1; pointer-events: auto;
  }
  .pro-tooltip {
    position: absolute; bottom: calc(100% + 6px); left: 50%;
    transform: translateX(-50%);
    background: #1a1710; border: 1px solid rgba(196,110,31,0.4);
    border-radius: 3px; padding: 4px 8px;
    font-size: 9px; font-family: monospace; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.1em;
    color: #C46E1F; white-space: nowrap;
    opacity: 0; pointer-events: none;
    transition: opacity 0.12s;
    z-index: 20;
  }
`

// ── Component ─────────────────────────────────────────────────────────────────

export default function Transport({
  bpm, swing, loopLength, isPlaying,
  masterVolume, masterEq, metronomeEnabled, midiConnected,
  onPlay, onStop, onBpmChange, onSwingChange,
  onLoopLengthChange, onMasterVolumeChange, onMasterEqChange, onMasterEqToggle,
  onMetronomeToggle,
  onProRequired,
}) {
  const { isPro } = useUserPlan()  // used by Loop section Pro-gating

  const handleBpmInput = useCallback(e => {
    const v = parseInt(e.target.value, 10)
    if (!isNaN(v)) onBpmChange(Math.min(140, Math.max(60, v)))
  }, [onBpmChange])

  const handleBpmKey = useCallback(e => {
    if (e.key === 'ArrowUp')   onBpmChange(b => Math.min(140, b + 1))
    if (e.key === 'ArrowDown') onBpmChange(b => Math.max(60,  b - 1))
  }, [onBpmChange])

  return (
    <div
      className="rounded-[4px]"
      style={{
        background: 'radial-gradient(ellipse at 50% 35%, #242018 0%, #0f0d09 100%)',
        border:     '1px solid rgba(242,220,180,0.08)',
        boxShadow:  'inset 0 2px 10px rgba(0,0,0,0.6)',
        padding:    '10px 16px 12px',
      }}
    >
      <style>{CSS}</style>

      {/* Section label */}
      <div style={{ marginBottom: 8 }}>
        <div style={SILK}>Transport</div>
      </div>

      {/* ── Row 1: controls spread full width ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* PLAY / STOP */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="hw-play" onClick={onPlay} disabled={isPlaying}>▶ PLAY</button>
          <button className="hw-stop" onClick={onStop} disabled={!isPlaying}>■ STOP</button>
        </div>

        <VDivider />

        {/* BPM */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '0 14px', flexShrink: 0 }}>
          <span style={SILK}>BPM</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="range" min="60" max="140" value={bpm}
              onChange={e => onBpmChange(parseInt(e.target.value, 10))}
              className="hw-slider" style={{ width: 80 }}
            />
            <input
              type="number" min="60" max="140" value={bpm}
              onChange={handleBpmInput} onKeyDown={handleBpmKey}
              className="hw-bpm"
              style={{ ...LED, fontSize: 17, padding: '3px 5px', width: 52, outline: 'none' }}
            />
            <button
              onClick={onMetronomeToggle}
              title={metronomeEnabled ? 'Metronome on' : 'Metronome off'}
              style={{
                background:     metronomeEnabled ? '#C46E1F' : '#1a1710',
                color:          metronomeEnabled ? '#0f0d09' : 'rgba(242,220,180,0.55)',
                border:         metronomeEnabled ? '1.5px solid #C46E1F' : '1.5px solid rgba(242,220,180,0.18)',
                boxShadow:      metronomeEnabled ? 'inset 0 2px 4px rgba(0,0,0,0.4)' : '0 2px 0 rgba(0,0,0,0.55)',
                borderRadius: 3, width: 26, height: 26, fontSize: 14,
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', transition: 'all 0.06s', flexShrink: 0,
              }}
            >♩</button>
          </div>
        </div>

        <VDivider />

        {/* SWING */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '0 14px', flexShrink: 0 }}>
          <span style={SILK}>Swing</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="range" min="0" max="75" value={swing}
              onChange={e => onSwingChange(parseInt(e.target.value, 10))}
              className="hw-slider" style={{ width: 80 }}
            />
            <span style={{ ...LED, fontSize: 13, padding: '3px 6px', minWidth: 40 }}>
              {swing}%
            </span>
          </div>
        </div>

        <VDivider />

        {/* LOOP — flex:1 takes remaining space */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '0 14px', flex: 1 }}>
          <span style={SILK}>Loop</span>
          <div style={{ display: 'flex', gap: 3 }}>
            {[2, 4, 6, 8].map(n => {
              const active   = loopLength === n
              const isProBtn = n > 4
              const locked   = isProBtn && !isPro
              const btnStyle = {
                background:    active ? '#C46E1F' : locked ? 'rgba(196,110,31,0.08)' : '#0f0d09',
                color:         active ? '#0f0d09' : locked ? 'rgba(196,110,31,0.55)' : 'rgba(242,220,180,0.5)',
                border:        active ? '1px solid #C46E1F' : locked ? '1px solid rgba(196,110,31,0.25)' : '1px solid rgba(242,220,180,0.15)',
                boxShadow:     active ? 'inset 0 2px 4px rgba(0,0,0,0.4)' : '0 2px 0 rgba(0,0,0,0.45)',
                opacity:       locked ? 0.65 : 1,
                borderRadius:  3, padding: '4px 9px', fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
                fontFamily:    'monospace', whiteSpace: 'nowrap', transition: 'all 0.06s',
                display: 'flex', alignItems: 'center', gap: 3,
              }
              return (
                <div key={n} className="pro-btn-wrap">
                  <button
                    onClick={() => { if (locked) { onProRequired?.(); return } onLoopLengthChange(n) }}
                    style={btnStyle}
                  >
                    {n} Bar
                    {locked && (
                      <span style={{
                        fontSize: 6, fontWeight: 900, letterSpacing: '0.1em',
                        color: '#C46E1F', background: 'rgba(196,110,31,0.15)',
                        border: '1px solid rgba(196,110,31,0.35)', borderRadius: 2,
                        padding: '1px 3px', lineHeight: 1,
                      }}>PRO</span>
                    )}
                  </button>
                  {locked && <div className="pro-tooltip">Pro feature — Upgrade to unlock</div>}
                </div>
              )
            })}
          </div>
        </div>

        <VDivider />

        {/* MASTER VOL — far right */}
        <div style={{ paddingLeft: 14, flexShrink: 0 }}>
          <Knob
            value={masterVolume}
            min={0} max={1.5}
            onChange={onMasterVolumeChange}
            label="Master Vol"
            displayValue={`${Math.round(masterVolume * 100)}%`}
            size={50}
          />
        </div>

      </div>

      {/* ── Row 2: EQ knobs + MIDI status ─────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        marginTop: 10, borderTop: '1px solid rgba(242,220,180,0.06)', paddingTop: 8,
      }}>

        {/* EQ section */}
        {(() => {
          const eq = masterEq ?? { low: 0, mid: 0, high: 0, enabled: false }
          const active = eq.enabled && isPro
          function handleBand(band, value) {
            if (!isPro) { onProRequired?.(); return }
            onMasterEqChange?.({ ...eq, [band]: Math.max(-12, Math.min(12, value)) })
          }
          return (
            <div style={{
              display: 'flex', alignItems: 'center',
              opacity: isPro ? 1 : 0.4, cursor: !isPro ? 'pointer' : 'default',
            }}
              onClick={!isPro ? () => onProRequired?.() : undefined}
            >
              {/* EQ label + PRO badge + ON/OFF */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 12, flexShrink: 0 }}>
                <span style={SILK}>EQ</span>
                {!isPro && (
                  <span style={{
                    fontSize: 6, fontWeight: 900, letterSpacing: '0.1em',
                    color: '#C46E1F', background: 'rgba(196,110,31,0.12)',
                    border: '1px solid rgba(196,110,31,0.35)', borderRadius: 2,
                    padding: '1px 3px', lineHeight: 1, fontFamily: 'monospace',
                  }}>PRO</span>
                )}
                <button
                  onClick={e => { e.stopPropagation(); if (!isPro) { onProRequired?.(); return } onMasterEqToggle?.() }}
                  style={{
                    background: active ? '#C46E1F' : 'transparent',
                    color:      active ? '#0f0d09' : 'rgba(242,220,180,0.5)',
                    border:     `1px solid ${active ? '#C46E1F' : 'rgba(242,220,180,0.2)'}`,
                    borderRadius: 2, fontSize: 8, fontWeight: 700,
                    padding: '1px 5px', cursor: isPro ? 'pointer' : 'not-allowed',
                    fontFamily: 'monospace', letterSpacing: '0.08em', lineHeight: 1.6,
                  }}
                >
                  {active ? 'ON' : 'OFF'}
                </button>
              </div>

              <VDivider />

              {/* Three EQ knobs */}
              <div style={{ display: 'flex', gap: 16, padding: '0 14px', alignItems: 'flex-end' }}>
                {[
                  { band: 'low',  label: 'LOW',  val: eq.low  ?? 0 },
                  { band: 'mid',  label: 'MID',  val: eq.mid  ?? 0 },
                  { band: 'high', label: 'HIGH', val: eq.high ?? 0 },
                ].map(({ band, label, val }) => (
                  <div key={band} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <Knob value={val} min={-12} max={12} onChange={v => handleBand(band, v)} size={40} />
                    <span style={{ color: '#C46E1F', fontSize: 9, fontFamily: 'monospace', fontWeight: 700, lineHeight: 1 }}>
                      {val > 0 ? '+' : ''}{Math.round(val)}dB
                    </span>
                    <span style={{ color: 'rgba(242,220,180,0.6)', fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Spacer — pushes MIDI to far right */}
        <div style={{ flex: 1 }} />

        {/* MIDI status — far right of EQ row */}
        {midiConnected !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: midiConnected ? '#C46E1F' : '#7a7060',
              flexShrink: 0, display: 'inline-block',
            }} />
            <span style={{ ...SILK, fontSize: 9, color: midiConnected ? '#C46E1F' : 'rgba(242,220,180,0.35)' }}>
              {midiConnected ? 'MIDI CONNECTED' : 'NO MIDI'}
            </span>
          </div>
        )}

      </div>
    </div>
  )
}
