import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import JSZip from 'jszip'
import { UserPlanProvider }  from './contexts/UserPlanContext.jsx'
import { AudioEngine }       from './lib/audioEngine.js'
import { encodeWAV, getExportFilename } from './lib/wavEncoder.js'
import { exportMidi }                   from './lib/midiExporter.js'
import { trackEvent }        from './lib/analytics.js'
import { supabase }          from './lib/supabaseClient.js'
import Header          from './components/Header.jsx'
import KitBrowser      from './components/KitBrowser.jsx'
import PadGrid         from './components/PadGrid.jsx'
import Sequencer       from './components/Sequencer.jsx'
import Transport       from './components/Transport.jsx'
import ExportButton    from './components/ExportButton.jsx'
import AuthModal       from './components/AuthModal.jsx'
import ProModal        from './components/ProModal.jsx'
import PatternLibrary  from './components/PatternLibrary.jsx'
import Footer          from './components/Footer.jsx'
import TipsPanel       from './components/TipsPanel.jsx'
import MobileWarning   from './components/MobileWarning.jsx'
import ShareNudge      from './components/ShareNudge.jsx'

// Steps: number[16][128] — 0 = inactive, 1–127 = velocity
// Columns 0–31 = 2-bar, 0–63 = 4-bar, 0–95 = 6-bar, 0–127 = 8-bar loop
const mkSteps  = () => Array.from({ length: 16 }, () => Array(128).fill(0))
// Gates: (number|null)[16][128] — null = inherit pad gate, 5–100 = explicit step override
const mkGates  = () => Array.from({ length: 16 }, () => Array(128).fill(null))
// Pitches: number[16][128] — semitone offset from root (−12…+11), 0 = original pitch
const mkPitches = () => Array.from({ length: 16 }, () => Array(128).fill(0))

// ── Keyboard & MIDI pad mappings ──────────────────────────────────────────────
const KEY_TO_PAD = {
  a: 0,  s: 1,  d: 2,  f: 3,
  g: 4,  h: 5,  j: 6,  k: 7,
  z: 8,  x: 9,  c: 10, v: 11,
  q: 12, w: 13, e: 14, r: 15,
}
// Label shown on each pad (index 0–15)
export const PAD_KEY_LABELS = ['A','S','D','F','G','H','J','K','Z','X','C','V','Q','W','E','R']

const MIDI_NOTE_TO_PAD = {
  36: 0,  // Kick
  38: 1,  // Snare
  42: 2,  // Hi Hat Closed
  46: 3,  // Hi Hat Open
  49: 4,  // Crash
  51: 5,  // Ride
  37: 6,  // Snare Rim
  39: 7,  // Clap
  41: 8,  // Low Tom
  43: 9,  // Mid Tom
  45: 10, // High Tom
  47: 11, // Low Mid Tom
  48: 12, // High Mid Tom
  50: 13, // High Tom 2
  52: 14, // Chinese Cymbal
  53: 15, // Ride Bell
}

// ── One-time stale cache wipe ─────────────────────────────────────────────────
// Discard any payload that doesn't match our exact v1 shape before anything mounts.
// Checks both sessionStorage (current) and localStorage (legacy) to clean up old entries.
;(function clearStaleCacheIfNeeded() {
  ['sessionStorage', 'localStorage'].forEach(store => {
    try {
      const raw = window[store].getItem('bb_session_cache')
      if (!raw) return
      const p = JSON.parse(raw)
      if (!p || p.version !== 1 || !Array.isArray(p.pads) || !Array.isArray(p.steps)) {
        window[store].removeItem('bb_session_cache')
      }
    } catch {
      try { window[store].removeItem('bb_session_cache') } catch {}
    }
  })
})()

// ── Session serialization (pure, module-level) ────────────────────────────────
// Called before an auth redirect to preserve the user's work in sessionStorage.
// sessionStorage persists across same-tab page reloads (magic link redirect)
// but is automatically cleared when the tab closes — ideal for this use case.
function serializeCurrentSession(s) {
  const padPayload = s.pads.slice(0, s.pads.length).map((p, i) => ({
    index:       i,
    label:       p.name,
    soundFile:   p.name,
    gain:        s.gains[i]    ?? 1.0,
    pan:         s.pans[i]     ?? 0,
    decay:       500,
    basePitch:   0,
    globalGate:  s.padGates[i] ?? 100,
    reverse:     false,
    muted:       s.muted[i]    ?? false,
    soloed:      s.solos[i]    ?? false,
  }))

  const stepsPayload = []
  for (let pi = 0; pi < s.pads.length; pi++) {
    for (let si = 0; si < 128; si++) {
      const vel = s.steps[pi]?.[si]
      if (vel > 0) {
        stepsPayload.push({
          padIndex:      pi,
          stepIndex:     si,
          velocity:      vel,
          gate:          s.gates[pi]?.[si]   ?? null,
          pitchOverride: s.pitches[pi]?.[si] ?? 0,
        })
      }
    }
  }

  const payload = {
    version:       1,
    breakTitle:    '',
    bpm:           s.bpm,
    swing:         s.swing,
    loopBars:      s.loopLength,
    activeKit:     s.activeKitId,
    triggerExport: true,
    pads:          padPayload,
    steps:         stepsPayload,
    texture: {
      tapeHiss:    { active: s.tapeHissEnabled,     level: s.tapeHissLevel },
      vinylCrackle:{ active: s.vinylCrackleEnabled, level: s.vinylCrackleDensity },
    },
  }

  try {
    console.log('[Session] Saving session to cache:', payload)
    sessionStorage.setItem('bb_session_cache', JSON.stringify(payload))
  } catch (e) {
    console.warn('[Session] Failed to cache session before auth redirect:', e)
  }
}

export default function App() {
  // ── Audio / pad state ────────────────────────────────────────────────────
  const engineRef = useRef(null)
  const [pads,  setPads]  = useState([])
  const [steps, setSteps] = useState(mkSteps)
  const [gates, setGates] = useState(mkGates)
  const [muted,     setMuted]     = useState(() => Array(16).fill(false))
  const [solos,     setSolos]     = useState(() => Array(16).fill(false))
  const [gains,     setGains]     = useState(() => Array(16).fill(1.0))
  const [pans,      setPans]      = useState(() => Array(16).fill(0))
  const [padGates,  setPadGates]  = useState(() => Array(16).fill(100))
  const [pitches,   setPitches]  = useState(mkPitches)

  // ── Transport state ──────────────────────────────────────────────────────
  const [bpm,          setBpm]         = useState(90)
  const [swing,        setSwing]       = useState(0)
  const [loopLength,   setLoopLength]  = useState(2)
  const [masterVolume, setMasterVolume]= useState(1.0)
  const [masterEq,     setMasterEq]    = useState({ low: 0, mid: 0, high: 0, enabled: false })
  const [isPlaying,    setIsPlaying]   = useState(false)
  const [currentStep,  setCurrentStep] = useState(-1)
  const [currentBar,   setCurrentBar]  = useState(0)

  // ── Texture state ────────────────────────────────────────────────────────
  const [tapeHissEnabled,     setTapeHissEnabled]     = useState(false)
  const [tapeHissLevel,       setTapeHissLevel]       = useState(0.5)
  const [vinylCrackleEnabled, setVinylCrackleEnabled] = useState(false)
  const [vinylCrackleDensity, setVinylCrackleDensity] = useState(0.3)

  // ── UI state ─────────────────────────────────────────────────────────────
  const [isLoading,         setIsLoading]        = useState(false)
  const [isExporting,       setIsExporting]       = useState(false)
  const [isMidiExporting,   setIsMidiExporting]   = useState(false)
  const [isStemsExporting,  setIsStemsExporting]  = useState(false)
  const [flashingPads,      setFlashingPads]      = useState(() => new Set())
  const [showShareNudge,    setShowShareNudge]    = useState(false)
  const [metronomeEnabled,  setMetronomeEnabled]  = useState(false)
  // null = MIDI not supported/denied (show nothing), false = supported but no device, true = connected
  const [midiConnected,     setMidiConnected]     = useState(null)

  // ── Pro modal & pattern library ──────────────────────────────────────────
  const [showProModal,      setShowProModal]      = useState(false)
  const [showPatternLib,    setShowPatternLib]    = useState(false)

  // ── Per-track swing ───────────────────────────────────────────────────────
  const [trackSwings, setTrackSwings] = useState(() => Array(16).fill(0))
  const trackSwingsRef = useRef(Array(16).fill(0))
  useEffect(() => { trackSwingsRef.current = trackSwings }, [trackSwings])

  // ── Pro FX — Per-pad EQ ──────────────────────────────────────────────────
  const [padEqs, setPadEqs] = useState(() =>
    Array(16).fill(null).map(() => ({ low: 0, mid: 0, high: 0, enabled: false }))
  )

  // ── Pro FX — Bit Crusher ─────────────────────────────────────────────────
  const [bitCrusherEnabled, setBitCrusherEnabled] = useState(false)
  const [bitCrusherDepth,   setBitCrusherDepth]   = useState(8)
  const [bitCrusherRate,    setBitCrusherRate]     = useState(1)

  // ── Pattern save ──────────────────────────────────────────────────────────
  const [savePatternName, setSavePatternName] = useState('')

  // ── Kit tracking — needed for session serialization / rehydration ─────────
  const [activeKitId, setActiveKitId] = useState(null)

  // ── Auth state ────────────────────────────────────────────────────────────
  const [user,           setUser]          = useState(null)
  const [showAuthModal,  setShowAuthModal] = useState(false)
  const pendingExportRef   = useRef(false)
  const pendingRehydrateRef = useRef(null)   // holds cached payload between redirect and auth confirm
  const doRehydrateRef     = useRef(null)    // always-current ref to doRehydrate (defined below)

  // ── Analytics flags ───────────────────────────────────────────────────────
  const hasLoggedPlayRef    = useRef(false)
  const hasLoggedPatternRef = useRef(false)

  // ── Scheduler refs — always current, never stale ─────────────────────────
  const stepsRef        = useRef(steps)
  const gatesRef        = useRef(gates)
  const padGatesRef     = useRef(padGates)
  const pitchesRef      = useRef(pitches)
  const bpmRef          = useRef(bpm)
  const swingRef        = useRef(swing)
  const mutedRef        = useRef(muted)
  const loopLengthRef   = useRef(loopLength)
  const metronomeRef    = useRef(metronomeEnabled)

  useEffect(() => { stepsRef.current      = steps            }, [steps])
  useEffect(() => { gatesRef.current      = gates            }, [gates])
  useEffect(() => { padGatesRef.current   = padGates         }, [padGates])
  useEffect(() => { pitchesRef.current    = pitches          }, [pitches])
  useEffect(() => { bpmRef.current        = bpm              }, [bpm])
  useEffect(() => { swingRef.current      = swing            }, [swing])
  // When any track is soloed, non-soloed tracks are effectively muted
  const effectiveMuted = useMemo(() => {
    const anySoloed = solos.slice(0, pads.length).some(Boolean)
    if (!anySoloed) return muted
    return muted.map((m, i) => m || !solos[i])
  }, [muted, solos, pads.length])

  useEffect(() => { mutedRef.current      = effectiveMuted   }, [effectiveMuted])
  useEffect(() => { loopLengthRef.current = loopLength       }, [loopLength])
  useEffect(() => { metronomeRef.current  = metronomeEnabled }, [metronomeEnabled])

  // ── Create engine once ────────────────────────────────────────────────────
  useEffect(() => {
    const engine = new AudioEngine()
    engine.stepsRef      = stepsRef
    engine.gatesRef      = gatesRef
    engine.padGatesRef   = padGatesRef
    engine.pitchesRef    = pitchesRef
    engine.bpmRef        = bpmRef
    engine.swingRef      = swingRef
    engine.mutedRef      = mutedRef
    engine.loopLengthRef = loopLengthRef
    engine.metronomeRef  = metronomeRef
    engine.trackSwingsRef = trackSwingsRef
    engine.onStep        = ({ step, bar }) => { setCurrentStep(step); setCurrentBar(bar) }
    engineRef.current    = engine
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Engine init (requires user gesture) ──────────────────────────────────
  const initEngine = useCallback(async () => {
    await engineRef.current.init()
  }, [])

  // ── Session rehydration ───────────────────────────────────────────────────
  // Restores a full session from a validated payload (post-OAuth redirect).
  // The ENTIRE body is wrapped in try/catch — any failure clears the cache
  // and falls back to the default empty state without crashing the app.
  const doRehydrate = useCallback(async (cache) => {
    try {
      // Validate payload shape before touching any state
      if (
        !cache ||
        typeof cache !== 'object' ||
        cache.version !== 1 ||
        !Array.isArray(cache.pads) ||
        !Array.isArray(cache.steps)
      ) {
        console.warn('[Rehydration] Invalid payload — skipping.', cache)
        return
      }

      console.log('[Rehydration] Starting — kit:', cache.activeKit, '| steps:', cache.steps.length, '| bpm:', cache.bpm)

      // 1. Reload kit audio
      if (cache.activeKit) {
        const resp = await fetch('/kits/kit-manifest.json')
        const data = await resp.json()
        const kit  = data.kits?.find(k => k.id === cache.activeKit)
        if (kit && Array.isArray(kit.sounds)) {
          await initEngine()
          setIsLoading(true)
          try {
            const soundDefs = kit.sounds.map(filename => ({
              name: filename.replace(/\.WAV\.wav$/i, '').replace(/\.wav$/i, '').replace(kit.namePrefix ?? '', ''),
              url:  `${kit.path}/${encodeURIComponent(filename)}`,
            }))
            const decoded = await engineRef.current.loadFromUrls(soundDefs)
            if (decoded.length) {
              engineRef.current.loadPads(decoded)
              setPads(decoded.map(p => ({ name: p.name })))
              setActiveKitId(kit.id)
            }
          } finally {
            setIsLoading(false)
          }
        }
      }

      // 2. Restore transport
      if (typeof cache.bpm    === 'number') setBpm(Math.min(140, Math.max(60, cache.bpm)))
      if (typeof cache.swing  === 'number') setSwing(Math.min(75, Math.max(0, cache.swing)))
      if ([2, 4, 6, 8].includes(cache.loopBars)) setLoopLength(cache.loopBars)

      // 3. Restore per-pad settings
      if (cache.pads.length) {
        const newGains    = Array(16).fill(1.0)
        const newPans     = Array(16).fill(0)
        const newPadGates = Array(16).fill(100)
        const newMuted    = Array(16).fill(false)
        const newSolos    = Array(16).fill(false)
        for (const p of cache.pads) {
          const i = p?.index
          if (typeof i !== 'number' || i < 0 || i > 15) continue
          newGains[i]    = typeof p.gain       === 'number' ? p.gain       : 1.0
          newPans[i]     = typeof p.pan        === 'number' ? p.pan        : 0
          newPadGates[i] = typeof p.globalGate === 'number' ? p.globalGate : 100
          newMuted[i]    = p.muted  === true
          newSolos[i]    = p.soloed === true
          engineRef.current?.setGain(i, newGains[i])
          engineRef.current?.setPan(i,  newPans[i])
        }
        setGains(newGains)
        setPans(newPans)
        setPadGates(newPadGates)
        setMuted(newMuted)
        setSolos(newSolos)
      }

      // 4. Restore steps / gates / pitches
      const newSteps   = mkSteps()
      const newGates   = mkGates()
      const newPitches = mkPitches()
      for (const s of cache.steps) {
        const pi = s?.padIndex
        const si = s?.stepIndex
        if (typeof pi !== 'number' || pi < 0 || pi > 15) continue
        if (typeof si !== 'number' || si < 0 || si > 127) continue
        const vel = typeof s.velocity === 'number' ? s.velocity : 100
        newSteps[pi][si] = Math.min(127, Math.max(1, vel))
        if (s.gate != null)       newGates[pi][si]   = s.gate
        if (s.pitchOverride != null) newPitches[pi][si] = s.pitchOverride
      }
      setSteps(newSteps)
      setGates(newGates)
      setPitches(newPitches)

      // 5. Restore texture
      const tapeHiss    = cache.texture?.tapeHiss
      const vinylCrackle = cache.texture?.vinylCrackle
      if (tapeHiss && typeof tapeHiss === 'object') {
        const lvl = typeof tapeHiss.level === 'number' ? tapeHiss.level : 0.5
        setTapeHissLevel(lvl)
        setTapeHissEnabled(tapeHiss.active === true)
        if (tapeHiss.active === true) {
          await initEngine()
          engineRef.current?.startTapeHiss(lvl)
        }
      }
      if (vinylCrackle && typeof vinylCrackle === 'object') {
        const lvl = typeof vinylCrackle.level === 'number' ? vinylCrackle.level : 0.3
        setVinylCrackleDensity(lvl)
        setVinylCrackleEnabled(vinylCrackle.active === true)
        if (vinylCrackle.active === true) {
          await initEngine()
          engineRef.current?.startVinylCrackle(lvl)
        }
      }

      // 6. Auto-trigger export if that was the user's original intent
      if (cache.triggerExport === true) {
        console.log('[Rehydration] Complete — auto-triggering export')
        setTimeout(() => doExportRef.current?.(), 150)
      } else {
        console.log('[Rehydration] Complete')
      }
    } catch (err) {
      // Any failure: log, clear cache, leave app in clean default state
      console.error('[Rehydration] Failed — falling back to default state:', err)
      sessionStorage.removeItem('bb_session_cache')
    }
  }, [initEngine]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { doRehydrateRef.current = doRehydrate }, [doRehydrate])

  // Read session cache from sessionStorage on mount.
  // Remove it IMMEDIATELY before parsing — guarantees a clean slate on the next load
  // even if parsing or rehydration fails.
  useEffect(() => {
    let cache = null
    try {
      const raw = sessionStorage.getItem('bb_session_cache')
      sessionStorage.removeItem('bb_session_cache') // remove first — never retry a bad payload
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (
        parsed?.version === 1 &&
        Array.isArray(parsed.pads) &&
        Array.isArray(parsed.steps)
      ) {
        cache = parsed
        console.log('[Session cache] Found — will rehydrate after auth resolves. Steps:', parsed.steps.length, '| Kit:', parsed.activeKit)
      } else {
        console.warn('[Session cache] Ignored — unexpected shape:', parsed)
      }
    } catch (e) {
      console.warn('[Session cache] Could not parse payload:', e)
    }
    if (cache) pendingRehydrateRef.current = cache
  }, [])

  // ── Supabase auth ─────────────────────────────────────────────────────────
  const doExportRef = useRef(null)

  useEffect(() => {
    if (!supabase) return

    // getSession: restore existing session state on page load.
    // For already-signed-in users returning from Stripe redirect, also trigger rehydration.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user && pendingRehydrateRef.current) {
        // Already signed in + session cache present — rehydrate now (no SIGNED_IN fires)
        const cache = pendingRehydrateRef.current
        pendingRehydrateRef.current = null
        console.log('[Auth] Already signed in with cached session — scheduling rehydration')
        setTimeout(() => doRehydrateRef.current?.(cache), 0)
      } else if (session?.user && pendingExportRef.current) {
        pendingExportRef.current = false
        setTimeout(() => doExportRef.current?.(), 0)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)

      // Only act on a fresh sign-in (magic link redirect, OAuth callback)
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('[Auth] SIGNED_IN event fired')
        if (pendingRehydrateRef.current) {
          const cache = pendingRehydrateRef.current
          pendingRehydrateRef.current = null
          console.log('[Auth] Session cache present — scheduling rehydration')
          setTimeout(() => doRehydrateRef.current?.(cache), 0)
        } else if (pendingExportRef.current) {
          pendingExportRef.current = false
          setTimeout(() => doExportRef.current?.(), 0)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pad flash ─────────────────────────────────────────────────────────────
  const flashPad = useCallback(padIndex => {
    setFlashingPads(s => { const n = new Set(s); n.add(padIndex);    return n })
    setTimeout(() => {
      setFlashingPads(s => { const n = new Set(s); n.delete(padIndex); return n })
    }, 100)
  }, [])

  // ── Reset all session state ───────────────────────────────────────────────
  const resetSession = useCallback(() => {
    setSteps(mkSteps())
    setGates(mkGates())
    setPitches(mkPitches())
    setMuted(Array(16).fill(false))
    setSolos(Array(16).fill(false))
    setGains(Array(16).fill(1.0))
    setPans(Array(16).fill(0))
    setPadGates(Array(16).fill(100))
  }, [])

  // ── Sample loading ────────────────────────────────────────────────────────
  const handleFileDrop = useCallback(async files => {
    const wavs = Array.from(files)
      .filter(f => f.name.toLowerCase().endsWith('.wav'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 16)

    if (!wavs.length) return
    await initEngine()
    setIsLoading(true)
    try {
      const decoded = await engineRef.current.decodeFiles(wavs)
      if (!decoded.length) return
      engineRef.current.loadPads(decoded)
      setPads(decoded.map(p => ({ name: p.name })))
      setActiveKitId(null)   // custom drop — no kit id
      resetSession()
      trackEvent('samples_loaded', { count: decoded.length })
    } finally {
      setIsLoading(false)
    }
  }, [initEngine, resetSession])

  const handleLoadKit = useCallback(async (kit) => {
    await initEngine()
    setIsLoading(true)
    try {
      const soundDefs = kit.sounds.map(filename => ({
        name: filename
          .replace(/\.WAV\.wav$/i, '')
          .replace(/\.wav$/i, '')
          .replace(kit.namePrefix, ''),
        url: `${kit.path}/${encodeURIComponent(filename)}`,
      }))
      const decoded = await engineRef.current.loadFromUrls(soundDefs)
      if (!decoded.length) return
      engineRef.current.loadPads(decoded)
      setPads(decoded.map(p => ({ name: p.name })))
      setActiveKitId(kit.id)
      resetSession()
      trackEvent('samples_loaded', { count: decoded.length, kit: kit.id })
    } finally {
      setIsLoading(false)
    }
  }, [initEngine, resetSession])

  const handleLoadNew = useCallback(() => {
    engineRef.current?.stop()
    setIsPlaying(false)
    setCurrentStep(-1)
    setPads([])
    setActiveKitId(null)
    resetSession()
  }, [resetSession])

  // ── Pad trigger ───────────────────────────────────────────────────────────
  // velocity: 0–1 float (default 1.0 for mouse/keyboard; MIDI passes note velocity / 127)
  const handlePadTrigger = useCallback(async (padIndex, velocity = 1.0) => {
    if (effectiveMuted[padIndex]) return
    await initEngine()
    const engine    = engineRef.current
    const gateVal   = padGates[padIndex] ?? 100
    const sampleDur = engine.pads[padIndex]?.buffer?.duration ?? 0
    const gateDuration = gateVal < 100 && sampleDur > 0 ? sampleDur * (gateVal / 100) : null
    engine.triggerPad(padIndex, null, velocity, gateDuration)
    flashPad(padIndex)
  }, [effectiveMuted, padGates, initEngine, flashPad])

  // ── Step toggle (inactive → velocity 100 → inactive) ─────────────────────
  const handleStepToggle = useCallback((padIndex, stepIndex) => {
    setSteps(prev =>
      prev.map((row, i) =>
        i === padIndex
          ? row.map((v, j) => j === stepIndex ? (v === 0 ? 100 : 0) : v)
          : row
      )
    )
    if (!hasLoggedPatternRef.current) {
      hasLoggedPatternRef.current = true
      trackEvent('pattern_created')
    }
  }, [])

  // ── Bulk step set (copy/paste) ────────────────────────────────────────────
  // changes: Array<{ padIdx, stepIdx, velocity }>
  const handleStepsBulkSet = useCallback((changes) => {
    setSteps(prev => {
      const next = prev.map(row => [...row])
      for (const { padIdx, stepIdx, velocity } of changes) {
        if (padIdx >= 0 && padIdx < 16 && stepIdx >= 0 && stepIdx < 128) {
          next[padIdx][stepIdx] = velocity
        }
      }
      return next
    })
  }, [])

  // ── Velocity change (right-click popover) ─────────────────────────────────
  const handleVelocityChange = useCallback((padIndex, stepIndex, velocity) => {
    setSteps(prev =>
      prev.map((row, i) =>
        i === padIndex
          ? row.map((v, j) => j === stepIndex ? velocity : v)
          : row
      )
    )
  }, [])

  // ── Gate change (right-click popover) ─────────────────────────────────────
  const handleGateChange = useCallback((padIndex, stepIndex, gate) => {
    setGates(prev =>
      prev.map((row, i) =>
        i === padIndex
          ? row.map((v, j) => j === stepIndex ? gate : v)
          : row
      )
    )
  }, [])

  // ── Pitch change (right-click popover) ────────────────────────────────────
  const handlePitchChange = useCallback((padIndex, stepIndex, semitones) => {
    setPitches(prev =>
      prev.map((row, i) =>
        i === padIndex
          ? row.map((v, j) => j === stepIndex ? semitones : v)
          : row
      )
    )
  }, [])

  // ── Mute ──────────────────────────────────────────────────────────────────
  const handleMuteToggle = useCallback(padIndex => {
    setMuted(prev => prev.map((v, i) => i === padIndex ? !v : v))
  }, [])

  const handleSoloToggle = useCallback(padIndex => {
    setSolos(prev => {
      const next = [...prev]
      next[padIndex] = !next[padIndex]
      return next
    })
  }, [])

  // ── Pad gate (global default for all steps on a pad) ─────────────────────
  const handlePadGateChange = useCallback((padIndex, gate) => {
    setPadGates(prev => prev.map((v, i) => i === padIndex ? gate : v))
  }, [])

  // ── Gain ──────────────────────────────────────────────────────────────────
  const handleGainChange = useCallback((padIndex, gain) => {
    setGains(prev => prev.map((v, i) => i === padIndex ? gain : v))
    engineRef.current?.setGain(padIndex, gain)
  }, [])

  // ── Pan ───────────────────────────────────────────────────────────────────
  const handlePanChange = useCallback((padIndex, pan) => {
    setPans(prev => prev.map((v, i) => i === padIndex ? pan : v))
    engineRef.current?.setPan(padIndex, pan)
  }, [])

  // ── Per-track swing ───────────────────────────────────────────────────────
  const handleTrackSwingChange = useCallback((padIndex, val) => {
    setTrackSwings(prev => prev.map((v, i) => i === padIndex ? Math.min(75, Math.max(0, val)) : v))
  }, [])

  // ── Save pattern ──────────────────────────────────────────────────────────
  const handleSavePattern = useCallback(() => {
    const defaultName = pads.slice(0, 2).map(p => p.name).filter(Boolean).join(' / ') || ''
    setSavePatternName(defaultName)
    setShowPatternLib(true)
  }, [pads])

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  // ── Master volume ─────────────────────────────────────────────────────────
  const handleMasterVolumeChange = useCallback(vol => {
    setMasterVolume(vol)
    engineRef.current?.setMasterVolume(vol)
  }, [])

  // ── Master EQ ────────────────────────────────────────────────────────────
  const handleMasterEqChange = useCallback(eq => {
    setMasterEq(eq)
    const engine = engineRef.current
    if (!engine) return
    const low  = eq.enabled ? (eq.low  ?? 0) : 0
    const mid  = eq.enabled ? (eq.mid  ?? 0) : 0
    const high = eq.enabled ? (eq.high ?? 0) : 0
    engine.setMasterEQ(low, mid, high)
  }, [])

  const handleMasterEqToggle = useCallback(() => {
    setMasterEq(prev => {
      const next = { ...prev, enabled: !prev.enabled }
      const engine = engineRef.current
      if (engine) {
        const low  = next.enabled ? (next.low  ?? 0) : 0
        const mid  = next.enabled ? (next.mid  ?? 0) : 0
        const high = next.enabled ? (next.high ?? 0) : 0
        engine.setMasterEQ(low, mid, high)
      }
      return next
    })
  }, [])

  // ── Texture ───────────────────────────────────────────────────────────────
  const handleTapeHissToggle = useCallback(async () => {
    await initEngine()
    const engine = engineRef.current
    if (tapeHissEnabled) {
      engine.stopTapeHiss()
      setTapeHissEnabled(false)
    } else {
      engine.startTapeHiss(tapeHissLevel)
      setTapeHissEnabled(true)
    }
  }, [tapeHissEnabled, tapeHissLevel, initEngine])

  const handleTapeHissLevelChange = useCallback(level => {
    setTapeHissLevel(level)
    engineRef.current?.setTapeHissLevel(level)
  }, [])

  const handleCrackleToggle = useCallback(async () => {
    await initEngine()
    const engine = engineRef.current
    if (vinylCrackleEnabled) {
      engine.stopVinylCrackle()
      setVinylCrackleEnabled(false)
    } else {
      engine.startVinylCrackle(vinylCrackleDensity)
      setVinylCrackleEnabled(true)
    }
  }, [vinylCrackleEnabled, vinylCrackleDensity, initEngine])

  const handleCrackleDensityChange = useCallback(density => {
    setVinylCrackleDensity(density)
    engineRef.current?.setVinylCrackleDensity(density)
  }, [])

  // ── Pro FX — Per-pad EQ ───────────────────────────────────────────────────
  const handlePadEqChange = useCallback((padIdx, eq) => {
    setPadEqs(prev => {
      const next = [...prev]
      next[padIdx] = { ...next[padIdx], ...eq }
      return next
    })
  }, [])

  const handlePadEqToggle = useCallback((padIdx) => {
    setPadEqs(prev => {
      const next = [...prev]
      next[padIdx] = { ...next[padIdx], enabled: !next[padIdx].enabled }
      return next
    })
  }, [])

  // Sync padEqs to audio engine whenever they change
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    padEqs.forEach((eq, idx) => {
      const low  = eq.enabled ? (eq.low  ?? 0) : 0
      const mid  = eq.enabled ? (eq.mid  ?? 0) : 0
      const high = eq.enabled ? (eq.high ?? 0) : 0
      engine.setPadEQ(idx, low, mid, high)
    })
  }, [padEqs])

  // ── Pro FX — Bit Crusher ─────────────────────────────────────────────────
  const handleBitCrusherToggle = useCallback(async () => {
    await initEngine()
    const engine = engineRef.current
    if (bitCrusherEnabled) {
      engine.disableBitCrusher()
      setBitCrusherEnabled(false)
    } else {
      await engine.enableBitCrusher(bitCrusherDepth, bitCrusherRate)
      setBitCrusherEnabled(true)
    }
  }, [bitCrusherEnabled, bitCrusherDepth, bitCrusherRate, initEngine])

  const handleBitCrusherDepthChange = useCallback(v => {
    setBitCrusherDepth(v)
    engineRef.current?.setBitCrusherDepth(v)
  }, [])

  const handleBitCrusherRateChange = useCallback(v => {
    setBitCrusherRate(v)
    engineRef.current?.setBitCrusherRate(v)
  }, [])

  // ── Transport ─────────────────────────────────────────────────────────────
  const handlePlay = useCallback(async () => {
    if (isPlaying) return
    await initEngine()
    engineRef.current.play()
    setIsPlaying(true)
    if (!hasLoggedPlayRef.current) {
      hasLoggedPlayRef.current = true
      trackEvent('play_started')
    }
  }, [isPlaying, initEngine])

  const handleStop = useCallback(() => {
    engineRef.current?.stop()
    setIsPlaying(false)
    setCurrentStep(-1)
    setCurrentBar(0)
  }, [])

  // ── Spacebar play/stop ────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Space') return
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
      e.preventDefault()
      if (isPlaying) {
        handleStop()
      } else if (pads.length > 0) {
        handlePlay()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isPlaying, pads.length, handlePlay, handleStop])

  // ── Keyboard pad trigger ──────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.repeat) return
      const padIndex = KEY_TO_PAD[e.key.toLowerCase()]
      if (padIndex === undefined || !pads[padIndex]) return
      handlePadTrigger(padIndex)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pads, handlePadTrigger])

  // ── MIDI input ────────────────────────────────────────────────────────────
  // Use a ref so the MIDI handler always calls the latest trigger without
  // re-registering the MIDI listeners on every render.
  const midiTriggerRef = useRef(null)
  useEffect(() => {
    midiTriggerRef.current = (padIndex, velocity) => {
      if (pads[padIndex]) handlePadTrigger(padIndex, velocity)
    }
  }, [pads, handlePadTrigger])

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return
    let midiAccess = null

    const handleMidiMessage = (e) => {
      const [status, note, velocity] = e.data
      if ((status & 0xF0) === 0x90 && velocity > 0) {
        const padIndex = MIDI_NOTE_TO_PAD[note]
        if (padIndex !== undefined) midiTriggerRef.current?.(padIndex, velocity / 127)
      }
    }

    const refreshInputs = (access) => {
      let count = 0
      access.inputs.forEach(input => { input.onmidimessage = handleMidiMessage; count++ })
      setMidiConnected(count > 0)
    }

    navigator.requestMIDIAccess().then(access => {
      midiAccess = access
      refreshInputs(access)
      access.onstatechange = () => refreshInputs(access)
    }).catch(() => {
      // Permission denied or unavailable — fail silently, midiConnected stays null
    })

    return () => {
      if (midiAccess) midiAccess.inputs.forEach(input => { input.onmidimessage = null })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Export ────────────────────────────────────────────────────────────────
  const doExport = useCallback(async () => {
    const engine = engineRef.current
    if (!engine) return

    if (isPlaying) {
      engine.stop()
      setIsPlaying(false)
      setCurrentStep(-1)
      setCurrentBar(0)
    }

    const padCount = pads.length
    const padMutes = effectiveMuted.slice(0, padCount)
    if (padMutes.every(Boolean)) return

    setIsExporting(true)
    try {
      const audioBuffer = await engine.renderLoop({
        steps:    steps.slice(0, padCount),
        gates:    gates.slice(0, padCount),
        pitches:  pitches.slice(0, padCount),
        padGates: padGates.slice(0, padCount),
        padEqs:   padEqs.slice(0, padCount),
        perTrackSwings: trackSwings.slice(0, padCount),
        bpm,
        swing,
        loopBars: loopLength,
        muted:    padMutes,
        gains:    gains.slice(0, padCount),
        pans:     pans.slice(0, padCount),
        tapeHiss:    { enabled: tapeHissEnabled,     level:   tapeHissLevel },
        vinylCrackle: { enabled: vinylCrackleEnabled, density: vinylCrackleDensity },
      })

      const blob     = encodeWAV(audioBuffer)
      const filename = getExportFilename(pads.map(p => p.name), padMutes)

      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      trackEvent('export_completed', { filename, bpm, swing, loopLength })
      setShowShareNudge(true)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }, [isPlaying, pads, effectiveMuted, steps, gates, pitches, padGates, padEqs, trackSwings, bpm, swing, loopLength, gains, pans, tapeHissEnabled, tapeHissLevel, vinylCrackleEnabled, vinylCrackleDensity])

  useEffect(() => { doExportRef.current = doExport }, [doExport])

  const handleExport = useCallback(async () => {
    trackEvent('export_clicked')
    if (!supabase || user) {
      await doExport()
    } else {
      serializeCurrentSession({
        pads, gains, pans, padGates, muted, solos,
        steps, gates, pitches,
        bpm, swing, loopLength, activeKitId,
        tapeHissEnabled, tapeHissLevel,
        vinylCrackleEnabled, vinylCrackleDensity,
      })
      pendingExportRef.current = true
      setShowAuthModal(true)
    }
  }, [user, doExport, pads, gains, pans, padGates, muted, solos, steps, gates, pitches, bpm, swing, loopLength, activeKitId, tapeHissEnabled, tapeHissLevel, vinylCrackleEnabled, vinylCrackleDensity])

  const doMidiExport = useCallback(() => {
    const padCount = pads.length
    const padMutes = effectiveMuted.slice(0, padCount)
    if (padMutes.every(Boolean)) return

    setIsMidiExporting(true)
    try {
      const filename = exportMidi({
        padNames: pads.map(p => p.name),
        steps:    steps.slice(0, padCount),
        gates:    gates.slice(0, padCount),
        pitches:  pitches.slice(0, padCount),
        padGates: padGates.slice(0, padCount),
        muted:    padMutes,
        bpm,
        swing,
        loopBars: loopLength,
      })
      trackEvent('midi_export_completed', { filename, bpm, swing, loopLength })
    } catch (err) {
      console.error('MIDI export failed:', err)
    } finally {
      setIsMidiExporting(false)
    }
  }, [pads, effectiveMuted, steps, gates, pitches, padGates, bpm, swing, loopLength])

  const handleMidiExport = useCallback(() => {
    trackEvent('midi_export_clicked')
    if (!supabase || user) {
      doMidiExport()
    } else {
      serializeCurrentSession({
        pads, gains, pans, padGates, muted, solos,
        steps, gates, pitches,
        bpm, swing, loopLength, activeKitId,
        tapeHissEnabled, tapeHissLevel,
        vinylCrackleEnabled, vinylCrackleDensity,
      })
      pendingExportRef.current = true
      setShowAuthModal(true)
    }
  }, [user, doMidiExport, pads, gains, pans, padGates, muted, solos, steps, gates, pitches, bpm, swing, loopLength, activeKitId, tapeHissEnabled, tapeHissLevel, vinylCrackleEnabled, vinylCrackleDensity])

  // ── Stems export (Pro) ────────────────────────────────────────────────────
  const handleStemsExport = useCallback(async () => {
    const engine   = engineRef.current
    const padCount = pads.length
    const padMutes = effectiveMuted.slice(0, padCount)
    if (!engine || padMutes.every(Boolean)) return

    if (isPlaying) { engine.stop(); setIsPlaying(false); setCurrentStep(-1); setCurrentBar(0) }

    setIsStemsExporting(true)
    try {
      const zip     = new JSZip()
      const stemOpts = { steps: steps.slice(0, padCount), gates: gates.slice(0, padCount), pitches: pitches.slice(0, padCount), bpm, swing, loopBars: loopLength, padGates: padGates.slice(0, padCount), padEqs }

      for (let i = 0; i < padCount; i++) {
        if (padMutes[i]) continue
        const hasNotes = steps[i]?.slice(0, loopLength * 16).some(v => v > 0)
        if (!hasNotes) continue
        // Use per-track swing override for this pad's stem
        const padSwing = trackSwings[i] ?? 0
        const buf = await engine.renderPadStem(i, { ...stemOpts, swing: padSwing > 0 ? padSwing : swing })
        if (!buf) continue
        const blob = encodeWAV(buf)
        const ab   = await blob.arrayBuffer()
        const name = (pads[i]?.name ?? `Pad ${i + 1}`).replace(/[^a-zA-Z0-9_\- ]/g, '').trim()
        zip.file(`${String(i + 1).padStart(2, '0')} - ${name}.wav`, ab)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `breakbeat-stems-${bpm}bpm.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      trackEvent('stems_export_completed', { padCount, bpm })
    } catch (err) {
      console.error('Stems export failed:', err)
    } finally {
      setIsStemsExporting(false)
    }
  }, [isPlaying, pads, effectiveMuted, steps, gates, pitches, padGates, padEqs, trackSwings, bpm, swing, loopLength])

  // ── Derived ───────────────────────────────────────────────────────────────
  const allMuted = pads.length > 0 && effectiveMuted.slice(0, pads.length).every(Boolean)

  // ── Render ────────────────────────────────────────────────────────────────
  // ── Pattern library payload builder ──────────────────────────────────────
  const buildPatternPayload = useCallback(() => ({
    version:   1, bpm, swing, loopBars: loopLength, activeKit: activeKitId,
    pads:  pads.map((p, i) => ({ index: i, label: p.name, soundFile: p.name, gain: gains[i] ?? 1, pan: pans[i] ?? 0, globalGate: padGates[i] ?? 100, muted: muted[i] ?? false, soloed: solos[i] ?? false })),
    steps: (() => {
      const s = []
      for (let pi = 0; pi < pads.length; pi++) {
        for (let si = 0; si < 128; si++) {
          const vel = steps[pi]?.[si]
          if (vel > 0) s.push({ padIndex: pi, stepIndex: si, velocity: vel, gate: gates[pi]?.[si] ?? null, pitchOverride: pitches[pi]?.[si] ?? 0 })
        }
      }
      return s
    })(),
    texture: { tapeHiss: { active: tapeHissEnabled, level: tapeHissLevel }, vinylCrackle: { active: vinylCrackleEnabled, level: vinylCrackleDensity } },
  }), [bpm, swing, loopLength, activeKitId, pads, gains, pans, padGates, muted, solos, steps, gates, pitches, tapeHissEnabled, tapeHissLevel, vinylCrackleEnabled, vinylCrackleDensity])

  return (
    <UserPlanProvider user={user}>
      <MobileWarning />
      <div className="min-h-screen text-[var(--text)] font-mono flex flex-col" style={{ background: 'var(--bg)' }}>
        <Header
          user={user}
          onSignOut={handleSignOut}
          onProRequired={() => setShowProModal(true)}
        />

        {pads.length === 0 ? (
          <KitBrowser
            onLoadKit={handleLoadKit}
            onFileDrop={handleFileDrop}
            isLoading={isLoading}
          />
        ) : (
          <main style={{ width: '95vw', maxWidth: 1400, margin: '0 auto', marginTop: 0, paddingBottom: 4 }}>
            {/* Hardware layout: two-column row + full-width panels below */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

              {/* ── Two-column row: pad grid (fixed) + sequencer (flex) ── */}
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch' }}>

                {/* Left column — pad grid, fixed 400px, height = content only */}
                <div style={{ flex: '0 0 400px', flexShrink: 0, alignSelf: 'flex-start' }}>
                  <PadGrid
                    pads={pads}
                    muted={muted}
                    gains={gains}
                    pans={pans}
                    padGates={padGates}
                    flashingPads={flashingPads}
                    solos={solos}
                    padKeyLabels={PAD_KEY_LABELS}
                    onPadTrigger={handlePadTrigger}
                    onMuteToggle={handleMuteToggle}
                    onSoloToggle={handleSoloToggle}
                    onGainChange={handleGainChange}
                    onPanChange={handlePanChange}
                    onPadGateChange={handlePadGateChange}
                    padEqs={padEqs}
                    onPadEqChange={handlePadEqChange}
                    onPadEqToggle={handlePadEqToggle}
                    trackSwings={trackSwings}
                    onTrackSwingChange={handleTrackSwingChange}
                    onProRequired={() => setShowProModal(true)}
                    onLoadNew={handleLoadNew}
                  />
                </div>

                {/* Column divider */}
                <div style={{ width: 1, background: 'rgba(242,220,180,0.08)', flexShrink: 0, margin: '0 12px', alignSelf: 'stretch' }} />

                {/* Center column — sequencer */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Sequencer
                    pads={pads}
                    steps={steps}
                    gates={gates}
                    pitches={pitches}
                    padGates={padGates}
                    muted={muted}
                    solos={solos}
                    currentStep={currentStep}
                    currentBar={currentBar}
                    loopLength={loopLength}
                    isPlaying={isPlaying}
                    onStepToggle={handleStepToggle}
                    onStepsBulkSet={handleStepsBulkSet}
                    onVelocityChange={handleVelocityChange}
                    onGateChange={handleGateChange}
                    onPitchChange={handlePitchChange}
                    onMuteToggle={handleMuteToggle}
                    onSoloToggle={handleSoloToggle}
                    tapeHissEnabled={tapeHissEnabled}
                    tapeHissLevel={tapeHissLevel}
                    vinylCrackleEnabled={vinylCrackleEnabled}
                    vinylCrackleDensity={vinylCrackleDensity}
                    onTapeHissToggle={handleTapeHissToggle}
                    onTapeHissLevelChange={handleTapeHissLevelChange}
                    onCrackleToggle={handleCrackleToggle}
                    onCrackleDensityChange={handleCrackleDensityChange}
                    bitCrusherEnabled={bitCrusherEnabled}
                    bitCrusherDepth={bitCrusherDepth}
                    bitCrusherRate={bitCrusherRate}
                    onBitCrusherToggle={handleBitCrusherToggle}
                    onBitCrusherDepthChange={handleBitCrusherDepthChange}
                    onBitCrusherRateChange={handleBitCrusherRateChange}
                    onProRequired={() => setShowProModal(true)}
                  />
                </div>

                {/* Right column — tips panel */}
                <TipsPanel />

              </div>

              {/* ── Transport — full width ── */}
              <Transport
                bpm={bpm}
                swing={swing}
                loopLength={loopLength}
                isPlaying={isPlaying}
                masterVolume={masterVolume}
                masterEq={masterEq}
                metronomeEnabled={metronomeEnabled}
                onPlay={handlePlay}
                onStop={handleStop}
                onBpmChange={setBpm}
                onSwingChange={setSwing}
                onLoopLengthChange={setLoopLength}
                onMasterVolumeChange={handleMasterVolumeChange}
                onMasterEqChange={handleMasterEqChange}
                onMasterEqToggle={handleMasterEqToggle}
                onMetronomeToggle={() => setMetronomeEnabled(v => !v)}
                midiConnected={midiConnected}
                onProRequired={() => setShowProModal(true)}
              />

              {/* ── Export — full width ── */}
              <ExportButton
                disabled={allMuted || pads.length === 0}
                allMuted={allMuted}
                isExporting={isExporting}
                isMidiExporting={isMidiExporting}
                isStemsExporting={isStemsExporting}
                onExport={handleExport}
                onMidiExport={handleMidiExport}
                onStemsExport={handleStemsExport}
                onPatternsClick={() => setShowPatternLib(true)}
                onSavePattern={handleSavePattern}
                onProRequired={() => setShowProModal(true)}
              />

            </div>
          </main>
        )}

        {showAuthModal && (
          <AuthModal
            onClose={() => {
              setShowAuthModal(false)
              pendingExportRef.current = false
            }}
            onSuccess={() => setShowAuthModal(false)}
          />
        )}

        {showProModal && (
          <ProModal
            user={user}
            onClose={() => setShowProModal(false)}
            onAuthRequired={() => setShowAuthModal(true)}
            onBeforeCheckout={() => serializeCurrentSession({
              pads, gains, pans, padGates, muted, solos,
              steps, gates, pitches,
              bpm, swing, loopLength, activeKitId,
              tapeHissEnabled, tapeHissLevel,
              vinylCrackleEnabled, vinylCrackleDensity,
            })}
          />
        )}

        {showPatternLib && (
          <PatternLibrary
            user={user}
            buildPayload={buildPatternPayload}
            onLoad={doRehydrate}
            onProRequired={() => { setShowPatternLib(false); setShowProModal(true) }}
            onClose={() => { setShowPatternLib(false); setSavePatternName('') }}
            defaultSaveName={savePatternName}
          />
        )}

        <Footer />
      </div>
      <ShareNudge visible={showShareNudge} onDismiss={() => setShowShareNudge(false)} />
    </UserPlanProvider>
  )
}
