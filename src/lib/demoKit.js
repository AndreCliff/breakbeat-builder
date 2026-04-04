/**
 * Load the "Andre Ramone Starter Kit" WAV files from /public/demo-kit/.
 * Falls back to programmatic synthesis if any file fails to fetch.
 */

const KIT_DIR = '/demo-kit/Andre Ramone Starter Kit'

// Display name: strip "Andre Ramone SK - " prefix, strip ".WAV.wav" / ".wav" suffix
function toLabel(filename) {
  return filename
    .replace(/^Andre Ramone SK - /i, '')
    .replace(/\.WAV\.wav$/i, '')
    .replace(/\.wav$/i, '')
    .toUpperCase()
}

const KIT_FILES = [
  'Andre Ramone SK - Bass Note 1.WAV.wav',
  'Andre Ramone SK - Bass Note 2.WAV.wav',
  'Andre Ramone SK - Beatbox Kick.WAV.wav',
  'Andre Ramone SK - Beatbox Snare.WAV.wav',
  'Andre Ramone SK - Digi Clap.WAV.wav',
  'Andre Ramone SK - Hat 1.WAV.wav',
  'Andre Ramone SK - Hat 2.WAV.wav',
  'Andre Ramone SK - Kick 1.WAV.wav',
  'Andre Ramone SK - Snare 1.WAV.wav',
  'Andre Ramone SK - Vox - Hey.WAV.wav',
  'Andre Ramone SK - Vox - Ho.WAV.wav',
]

export async function generateDemoKit(ctx) {
  const results = []

  for (const filename of KIT_FILES) {
    const url = `${KIT_DIR}/${encodeURIComponent(filename)}`
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const ab     = await res.arrayBuffer()
      const buffer = await ctx.decodeAudioData(ab)
      results.push({ name: toLabel(filename), buffer })
    } catch (e) {
      console.warn(`Demo kit: could not load "${filename}" — skipping`, e.message)
    }
  }

  if (results.length === 0) {
    console.warn('Demo kit: all fetches failed, falling back to synth sounds')
    return generateSynthKit(ctx)
  }

  return results
}

// ─── Synth fallback (used only if WAV files are missing) ──────────────────────

function generateSynthKit(ctx) {
  const sr = ctx.sampleRate
  const make = data => {
    const buf = ctx.createBuffer(1, data.length, sr)
    buf.getChannelData(0).set(data)
    return buf
  }
  return [
    { name: 'KICK',    buffer: make(genKick(sr)) },
    { name: 'SNARE',   buffer: make(genSnare(sr)) },
    { name: 'HAT-CL',  buffer: make(genHatClosed(sr)) },
    { name: 'HAT-OP',  buffer: make(genHatOpen(sr)) },
    { name: 'CLAP',    buffer: make(genClap(sr)) },
    { name: 'TOM-HI',  buffer: make(genTom(sr, 320)) },
    { name: 'TOM-MID', buffer: make(genTom(sr, 210)) },
    { name: 'TOM-LO',  buffer: make(genTom(sr, 130)) },
  ]
}

function genKick(sr) {
  const data = new Float32Array(Math.floor(sr * 0.55))
  let phase = 0
  for (let i = 0; i < data.length; i++) {
    const t = i / sr
    phase += (2 * Math.PI * (160 * Math.exp(-12 * t) + 40)) / sr
    data[i] = Math.exp(-7 * t) * 0.9 * Math.sin(phase)
  }
  return data
}
function genSnare(sr) {
  const data = new Float32Array(Math.floor(sr * 0.28))
  let phase = 0
  for (let i = 0; i < data.length; i++) {
    const t = i / sr
    phase += (2 * Math.PI * 185) / sr
    data[i] = Math.exp(-22 * t) * (Math.sin(phase) * 0.25 + (Math.random() * 2 - 1) * 0.55)
  }
  return data
}
function genHatClosed(sr) {
  const data = new Float32Array(Math.floor(sr * 0.07))
  for (let i = 0; i < data.length; i++)
    data[i] = Math.exp(-90 * (i / sr)) * (Math.random() * 2 - 1) * 0.55
  return data
}
function genHatOpen(sr) {
  const data = new Float32Array(Math.floor(sr * 0.45))
  for (let i = 0; i < data.length; i++)
    data[i] = Math.exp(-9 * (i / sr)) * (Math.random() * 2 - 1) * 0.45
  return data
}
function genClap(sr) {
  const data = new Float32Array(Math.floor(sr * 0.18))
  for (let i = 0; i < data.length; i++) {
    const t = i / sr
    const env = (Math.exp(-80 * t) + Math.exp(-80 * Math.max(0, t - 0.008)) * 0.4 + Math.exp(-50 * Math.max(0, t - 0.016)) * 0.3) / 1.7
    data[i] = env * (Math.random() * 2 - 1) * 0.75
  }
  return data
}
function genTom(sr, f0) {
  const data = new Float32Array(Math.floor(sr * 0.45))
  let phase = 0
  for (let i = 0; i < data.length; i++) {
    const t = i / sr
    phase += (2 * Math.PI * (f0 * Math.exp(-6 * t) + f0 * 0.25)) / sr
    data[i] = Math.exp(-7 * t) * 0.75 * Math.sin(phase)
  }
  return data
}
