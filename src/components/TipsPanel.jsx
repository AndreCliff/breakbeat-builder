import { useState } from 'react'

const TIPS = [
  {
    id: 'velocity-gate',
    title: 'VELOCITY & GATE',
    body: 'Right-click any active step to open the velocity and gate controls. Velocity (1–127) controls how hard the hit lands — lower values give you ghost notes. Gate (5–100%) controls how long the sample plays before cutting off. Use low gate on bass notes to tighten them against the kick.',
  },
  {
    id: 'copy-paste',
    title: 'COPY & PASTE BARS',
    body: 'Use COPY BAR above the sequencer to copy a range of bars. Click PASTE to drop them at a new position. Example: program bars 1–2, copy them, paste at bar 3 to instantly double your pattern. Works across all tracks simultaneously.',
  },
  {
    id: 'bass-pitch',
    title: 'BASS LINE PITCHING',
    body: 'Load a bass sample onto any pad. Open the pad settings and set a base pitch. Then right-click individual steps and use the mini keyboard to set different notes per step. This turns a single bass sample into a full melodic bass line across your break.',
  },
  {
    id: 'keyboard',
    title: 'KEYBOARD SHORTCUTS',
    body: 'Trigger pads with your keyboard in real time. Top row: A S D F. Middle row: G H J K. Bottom row: Z X C V. Extra row: Q W E R. Spacebar toggles play and stop. Works during playback for live performance. Connect a MIDI controller for velocity-sensitive triggering.',
  },
  {
    id: 'mute-variations',
    title: 'MUTE VARIATIONS',
    body: 'Build your full break, then mute individual tracks before exporting. Each export reflects the current mute state — giving you break_no_snare.wav, break_kick_only.wav, etc. Pro users can export all variations as a batch ZIP pack in one click.',
  },
  {
    id: 'swing-feel',
    title: 'SWING & FEEL',
    body: 'Global swing applies a shuffle feel to all tracks at once. Pro users can set swing per track independently — loose hats over tight kicks is the classic boom bap feel. Start with global swing at 15–25% for a subtle push. Go higher for a more pronounced shuffle.',
  },
]

export default function TipsPanel() {
  const [openTip, setOpenTip] = useState(null)

  return (
    <div style={{
      width:         220,
      flexShrink:    0,
      borderLeft:    '1px solid rgba(242,220,180,0.08)',
      display:       'flex',
      flexDirection: 'column',
      overflowY:     'auto',
      scrollbarWidth:'none',
    }}>
      <style>{`#tips-panel::-webkit-scrollbar { display: none; }`}</style>

      {/* Icon + label header */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        padding:       '10px 10px 6px',
        gap:           4,
        borderBottom:  '1px solid rgba(242,220,180,0.06)',
      }}>
        <img
          src="/assets/breakbeat-builder-lightbulb.png"
          alt="Tips"
          width={96}
          height={96}
          style={{ opacity: 0.75, display: 'block' }}
        />
        <span style={{
          fontSize:      9,
          fontFamily:    "'Space Mono', monospace",
          fontWeight:    700,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color:         'rgba(242,220,180,0.4)',
        }}>
          Tips
        </span>
      </div>

      {/* Accordion */}
      {TIPS.map(tip => {
        const expanded = openTip === tip.id
        return (
          <div key={tip.id} style={{ borderTop: '1px solid rgba(242,220,180,0.06)' }}>
            <button
              onClick={() => setOpenTip(expanded ? null : tip.id)}
              style={{
                width:         '100%',
                background:    'none',
                border:        'none',
                padding:       '7px 10px',
                display:       'flex',
                alignItems:    'center',
                justifyContent:'space-between',
                cursor:        'pointer',
                gap:           6,
                textAlign:     'left',
              }}
            >
              <span style={{
                fontSize:      10,
                fontFamily:    "'Space Mono', monospace",
                fontWeight:    700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color:         expanded ? '#C46E1F' : 'rgba(242,220,180,0.8)',
                transition:    'color 100ms',
                lineHeight:    1.2,
              }}>
                {tip.title}
              </span>
              <span style={{
                fontSize:   11,
                color:      expanded ? '#C46E1F' : 'rgba(242,220,180,0.4)',
                flexShrink: 0,
                transition: 'color 100ms',
                lineHeight: 1,
              }}>
                {expanded ? '−' : '+'}
              </span>
            </button>

            <div style={{
              maxHeight:  expanded ? 300 : 0,
              overflow:   'hidden',
              transition: 'max-height 200ms ease',
            }}>
              <p style={{
                margin:        0,
                padding:       '0 10px 10px',
                fontSize:      9,
                fontFamily:    "'Space Mono', monospace",
                color:         '#7a7060',
                lineHeight:    1.65,
                letterSpacing: '0.03em',
              }}>
                {tip.body}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
