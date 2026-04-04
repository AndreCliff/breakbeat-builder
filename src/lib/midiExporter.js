import { getExportFilename } from './wavEncoder.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const PPQ  = 480          // ticks per quarter note (FL Studio / DAW standard)
const S16  = PPQ / 4      // ticks per 16th note = 120

const DRUM_CH    = 9   // 0-indexed wire channel → MIDI channel 10
const MELODIC_CH = 0   // 0-indexed wire channel → MIDI channel 1
const MELODIC_ROOT = 60 // Middle C — base MIDI note for melodic pads

// Maps pad index 0–15 → GM drum MIDI note number (played on MIDI channel 10)
const PAD_TO_MIDI_NOTE = [
  36, // 0  Kick
  38, // 1  Snare
  42, // 2  Hi-Hat Closed
  46, // 3  Hi-Hat Open
  49, // 4  Crash
  51, // 5  Ride
  37, // 6  Snare Rim
  39, // 7  Clap
  41, // 8  Low Tom
  43, // 9  Mid Tom
  45, // 10 High Tom
  47, // 11 Low-Mid Tom
  48, // 12 High-Mid Tom
  50, // 13 High Tom 2
  52, // 14 Chinese Cymbal
  53, // 15 Ride Bell
]

// ── Raw MIDI binary helpers ───────────────────────────────────────────────────

/** Encode a non-negative integer as a MIDI variable-length quantity. */
function vlq(n) {
  if (n < 0x80) return [n]
  const out = [n & 0x7F]
  n >>>= 7
  while (n > 0) {
    out.unshift((n & 0x7F) | 0x80)
    n >>>= 7
  }
  return out
}

/** Write a 32-bit big-endian unsigned integer as 4 bytes. */
function u32(n) {
  return [(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF]
}

/** Write a 16-bit big-endian unsigned integer as 2 bytes. */
function u16(n) {
  return [(n >>> 8) & 0xFF, n & 0xFF]
}

/**
 * Build one MTrk chunk from an array of raw events.
 * Each event: { tick (absolute), bytes (array of raw MIDI bytes after delta) }
 * Events are sorted by tick, then an end-of-track meta is appended.
 */
function buildMTrk(rawEvents) {
  // Sort by absolute tick; at same tick, note-offs (0x8n) before note-ons (0x9n)
  rawEvents.sort((a, b) =>
    a.tick !== b.tick ? a.tick - b.tick
      : ((a.bytes[0] & 0xF0) === 0x90 ? 1 : 0) - ((b.bytes[0] & 0xF0) === 0x90 ? 1 : 0)
  )

  const data = []
  let cursor = 0
  for (const ev of rawEvents) {
    data.push(...vlq(ev.tick - cursor), ...ev.bytes)
    cursor = ev.tick
  }
  // End of track
  data.push(0x00, 0xFF, 0x2F, 0x00)

  return [
    0x4D, 0x54, 0x72, 0x6B,  // "MTrk"
    ...u32(data.length),
    ...data,
  ]
}

/** MIDI meta: track name (FF 03 ...) at tick 0. */
function metaTrackName(name) {
  const encoded = [...new TextEncoder().encode(name.slice(0, 127))]
  return { tick: 0, bytes: [0xFF, 0x03, ...vlq(encoded.length), ...encoded] }
}

/** MIDI meta: set tempo (FF 51 03 tt tt tt) at tick 0. */
function metaTempo(bpm) {
  const us = Math.round(60_000_000 / bpm)
  return { tick: 0, bytes: [0xFF, 0x51, 0x03, (us >>> 16) & 0xFF, (us >>> 8) & 0xFF, us & 0xFF] }
}

/** MIDI meta: time signature 4/4 (FF 58 04 04 02 18 08) at tick 0. */
function metaTimeSig() {
  return { tick: 0, bytes: [0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08] }
}

// ── Pad classification ────────────────────────────────────────────────────────

/**
 * A pad is treated as MELODIC if any of its active steps carries a non-zero
 * pitch offset. This gives the user explicit control — set a per-step pitch
 * on any step of a pad and it will export on MIDI channel 1 with correct pitches.
 * Pads with all pitch-offsets at 0 are treated as drums on channel 10.
 */
function isMelodicPad(padSteps, padPitches, totalSteps) {
  for (let i = 0; i < totalSteps; i++) {
    if (padSteps[i] > 0 && (padPitches?.[i] ?? 0) !== 0) return true
  }
  return false
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build a Type 1 multi-track MIDI file and trigger a browser download.
 *
 * File structure:
 *   MThd  format=1  nTracks  PPQ=480
 *   MTrk  (tempo + time-sig only — no notes)
 *   MTrk  (pad 0 — drums ch10 OR melodic ch1)
 *   MTrk  (pad 1 …)
 *   …
 *
 * Drum pads   → MIDI channel 10 (wire byte 9), GM drum note number
 * Melodic pads → MIDI channel 1  (wire byte 0), note 60 + per-step semitone offset
 */
export function exportMidi({
  padNames,
  steps,
  gates,
  pitches,
  padGates,
  muted,
  bpm,
  swing,
  loopBars,
}) {
  const totalSteps = loopBars * 16
  const swingTicks = Math.round((swing / 100) * S16 * (2 / 3))

  // ── Collect pad track descriptors ─────────────────────────────────────────
  const padTracks = []

  for (let padIdx = 0; padIdx < padNames.length; padIdx++) {
    if (muted[padIdx]) continue

    const padSteps   = steps[padIdx]
    const padPitches = pitches[padIdx]
    const hasNotes   = padSteps.slice(0, totalSteps).some(v => v > 0)
    if (!hasNotes) continue

    const melodic  = isMelodicPad(padSteps, padPitches, totalSteps)
    const channel  = melodic ? MELODIC_CH : DRUM_CH
    const baseNote = melodic ? MELODIC_ROOT : (PAD_TO_MIDI_NOTE[padIdx] ?? 36)
    const name     = padNames[padIdx] || `Pad ${padIdx + 1}`

    const noteLog = []
    const rawEvents = [metaTrackName(name)]

    for (let i = 0; i < totalSteps; i++) {
      const vel = padSteps[i]
      if (!vel) continue

      const onTick   = i * S16 + (i % 2 === 1 ? swingTicks : 0)
      const velocity = Math.max(1, Math.min(127, Math.round(vel)))

      const rawGate  = gates[padIdx]?.[i] ?? null
      const gatePct  = rawGate !== null ? rawGate : (padGates[padIdx] ?? 100)
      const durTicks = Math.max(1, Math.round(S16 * (gatePct / 100)))
      const offTick  = onTick + durTicks

      const semi     = padPitches?.[i] ?? 0
      const midiNote = Math.max(0, Math.min(127, baseNote + semi))

      const statusOn  = 0x90 | channel   // note-on
      const statusOff = 0x80 | channel   // note-off

      rawEvents.push(
        { tick: onTick,  bytes: [statusOn,  midiNote, velocity] },
        { tick: offTick, bytes: [statusOff, midiNote, 0x00] },
      )

      noteLog.push({
        step:     i + 1,
        onTick,
        offTick,
        midiNote,
        velocity,
        gatePct,
        pitchSemi: semi,
      })
    }

    padTracks.push({ name, melodic, channel, baseNote, rawEvents, noteLog })
  }

  // ── Console audit ─────────────────────────────────────────────────────────
  console.group('🎵 MIDI Export Audit')
  console.log(`Format: Type 1 multi-track | PPQ: ${PPQ} | BPM: ${bpm}`)
  console.log(`Loop: ${loopBars} bars, ${totalSteps} steps | Swing: ${swing}% (${swingTicks} ticks on odd steps)`)
  console.log(`Tracks: 1 tempo track + ${padTracks.length} pad track(s)`)
  console.log('Track 0 (tempo): BPM =', bpm, `→ ${Math.round(60_000_000 / bpm)} µs/beat | Time sig: 4/4 | NO notes`)

  padTracks.forEach((t, i) => {
    const chLabel = t.melodic
      ? `MIDI channel 1 (melodic, wire byte 0x${(0x90 | t.channel).toString(16)})`
      : `MIDI channel 10 (drums,   wire byte 0x${(0x90 | t.channel).toString(16)})`
    console.group(`Track ${i + 1} (pad): "${t.name}" — ${chLabel} — base note ${t.baseNote}`)
    console.table(t.noteLog)
    console.groupEnd()
  })
  console.groupEnd()

  // ── Build binary ──────────────────────────────────────────────────────────

  // Track 0: tempo only
  const tempoTrackBytes = buildMTrk([metaTempo(bpm), metaTimeSig()])

  // Pad tracks
  const padTrackByteArrays = padTracks.map(t => buildMTrk(t.rawEvents))

  const nTracks = 1 + padTrackByteArrays.length

  // MThd header: format 1, nTracks, PPQ
  const header = [
    0x4D, 0x54, 0x68, 0x64,   // "MThd"
    ...u32(6),                  // chunk length always 6
    ...u16(1),                  // format type 1
    ...u16(nTracks),            // number of tracks
    ...u16(PPQ),                // ticks per quarter note
  ]

  // Assemble full file
  const allBytes = [
    ...header,
    ...tempoTrackBytes,
    ...padTrackByteArrays.flat(),
  ]

  console.log(`MIDI file size: ${allBytes.length} bytes | ${nTracks} track(s)`)

  // ── Trigger download ──────────────────────────────────────────────────────
  const blob     = new Blob([new Uint8Array(allBytes)], { type: 'audio/midi' })
  const filename = getExportFilename(padNames, muted).replace(/\.wav$/i, '.mid')

  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return filename
}
