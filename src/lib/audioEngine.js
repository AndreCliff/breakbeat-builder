/**
 * AudioEngine — all Web Audio API operations.
 *
 * Audio chain per pad:
 *   BufferSource → velocityGain (per-hit) → gateGain → padGainNode
 *     → padEqLow → padEqMid → padEqHigh → panNode → masterGainNode
 *     → masterEqLow → masterEqMid → masterEqHigh → destination
 *
 * Steps are stored as numbers: 0 = inactive, 1–127 = velocity.
 * Gates are stored as numbers: 5–100 (% of 16th-note duration). Default 100.
 * Loop length (2, 4, 6, 8 bars) is time-anchored to prevent drift.
 * Master volume only applies to live playback; export always renders at gain 1.0.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null
    this.masterGainNode = null
    this.pads = []  // { name, buffer, gainNode, eqLow, eqMid, eqHigh, panNode }

    // Scheduling
    this._playing        = false
    this._currentStep    = 0
    this._nextStepTime   = 0
    this._loopPhaseStart = 0
    this._timerID        = null

    // Refs injected from React
    this.stepsRef        = { current: [] }
    this.gatesRef        = { current: [] }
    this.bpmRef          = { current: 90 }
    this.swingRef        = { current: 0 }
    this.mutedRef        = { current: [] }
    this.loopLengthRef   = { current: 2 }
    this.metronomeRef    = { current: false }
    this.padGatesRef     = { current: [] }
    this.pitchesRef      = { current: [] }
    this.trackSwingsRef  = { current: [] }

    // Texture generators
    this._hissBuffer      = null
    this._hissSource      = null
    this._hissGainNode    = null
    this._crackleBuffer   = null
    this._crackleSource   = null
    this._crackleGainNode = null

    // Master EQ
    this._masterEqLow  = null
    this._masterEqMid  = null
    this._masterEqHigh = null

    // Pro FX — Bit Crusher (AudioWorklet)
    this._bitCrusherReady  = false
    this._bitCrusherNode   = null
    this._bitCrusherActive = false

    this.onStep = null
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 44100,
      })
      this.masterGainNode = this.ctx.createGain()
      this.masterGainNode.gain.value = 1.0

      this._masterEqLow = this.ctx.createBiquadFilter()
      this._masterEqLow.type = 'lowshelf'
      this._masterEqLow.frequency.value = 250

      this._masterEqMid = this.ctx.createBiquadFilter()
      this._masterEqMid.type = 'peaking'
      this._masterEqMid.frequency.value = 1000
      this._masterEqMid.Q.value = 1

      this._masterEqHigh = this.ctx.createBiquadFilter()
      this._masterEqHigh.type = 'highshelf'
      this._masterEqHigh.frequency.value = 4000

      this.masterGainNode.connect(this._masterEqLow)
      this._masterEqLow.connect(this._masterEqMid)
      this._masterEqMid.connect(this._masterEqHigh)
      this._masterEqHigh.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    return this.ctx
  }

  // ─── Pro FX — Bit Crusher ──────────────────────────────────────────────────

  async initBitCrusher() {
    if (this._bitCrusherReady) return
    await this.ctx.audioWorklet.addModule('/bit-crusher-processor.js')
    this._bitCrusherReady = true
  }

  async enableBitCrusher(bitDepth = 8, normFreq = 1) {
    if (!this.ctx) return
    await this.initBitCrusher()
    if (this._bitCrusherNode) {
      this._bitCrusherNode.parameters.get('bitDepth').value = bitDepth
      this._bitCrusherNode.parameters.get('normFreq').value = normFreq
      this._bitCrusherActive = true
      return
    }
    this._bitCrusherNode = new AudioWorkletNode(this.ctx, 'bit-crusher-processor')
    this._bitCrusherNode.parameters.get('bitDepth').value = bitDepth
    this._bitCrusherNode.parameters.get('normFreq').value = normFreq

    this._masterEqHigh.disconnect()
    this._masterEqHigh.connect(this._bitCrusherNode)
    this._bitCrusherNode.connect(this.ctx.destination)
    this._bitCrusherActive = true
  }

  disableBitCrusher() {
    if (!this._bitCrusherNode) return
    this._masterEqHigh.disconnect()
    this._masterEqHigh.connect(this.ctx.destination)
    this._bitCrusherActive = false
  }

  setBitCrusherDepth(bitDepth) {
    if (this._bitCrusherNode) {
      this._bitCrusherNode.parameters.get('bitDepth').value = Math.max(1, Math.min(16, bitDepth))
    }
  }

  setBitCrusherRate(normFreq) {
    if (this._bitCrusherNode) {
      this._bitCrusherNode.parameters.get('normFreq').value = Math.max(0.01, Math.min(1, normFreq))
    }
  }

  // ─── Per-pad EQ ────────────────────────────────────────────────────────────

  /**
   * Set the 3-band EQ gain (dB) for a specific pad.
   * Pass null for any band to leave it unchanged.
   */
  setPadEQ(padIdx, low, mid, high) {
    const pad = this.pads[padIdx]
    if (!pad?.eqLow) return
    const t = this.ctx.currentTime
    if (low  != null) pad.eqLow.gain.setTargetAtTime(Math.max(-12, Math.min(12, low)),  t, 0.02)
    if (mid  != null) pad.eqMid.gain.setTargetAtTime(Math.max(-12, Math.min(12, mid)),  t, 0.02)
    if (high != null) pad.eqHigh.gain.setTargetAtTime(Math.max(-12, Math.min(12, high)), t, 0.02)
  }

  // ─── Pro Export — single pad stem ──────────────────────────────────────────

  async renderPadStem(padIdx, { steps, gates, pitches, bpm, swing, loopBars, padGates, padEqs }) {
    const sampleRate = 44100
    const base   = 60 / bpm / 4
    const offset = (swing / 100) * base
    const gaps   = Array.from({ length: 16 }, (_, i) => i % 2 === 0 ? base + offset : base - offset)
    const barDuration   = base * 16
    const totalDuration = barDuration * loopBars

    const offCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * totalDuration), sampleRate)
    const masterOut = offCtx.createGain()
    masterOut.gain.value = 1.0
    masterOut.connect(offCtx.destination)

    const pad = this.pads[padIdx]
    if (!pad?.buffer) return null

    // Per-pad EQ for offline render
    const eq = padEqs?.[padIdx]
    let eqOut = masterOut
    if (eq?.enabled && (eq.low !== 0 || eq.mid !== 0 || eq.high !== 0)) {
      const eqLow  = offCtx.createBiquadFilter()
      eqLow.type = 'lowshelf'; eqLow.frequency.value = 200; eqLow.gain.value = eq.low ?? 0
      const eqMid  = offCtx.createBiquadFilter()
      eqMid.type = 'peaking';  eqMid.frequency.value = 1000; eqMid.Q.value = 1.0; eqMid.gain.value = eq.mid ?? 0
      const eqHigh = offCtx.createBiquadFilter()
      eqHigh.type = 'highshelf'; eqHigh.frequency.value = 8000; eqHigh.gain.value = eq.high ?? 0
      eqLow.connect(eqMid); eqMid.connect(eqHigh); eqHigh.connect(masterOut)
      eqOut = eqLow
    }

    for (let bar = 0; bar < loopBars; bar++) {
      const stepTimes = []
      let t = bar * barDuration
      for (let i = 0; i < 16; i++) { stepTimes.push(t); t += gaps[i] }

      stepTimes.forEach((time, step) => {
        const col = bar * 16 + step
        const vel = steps[padIdx]?.[col] ?? 0
        if (vel > 0) {
          const src = offCtx.createBufferSource()
          src.buffer = pad.buffer
          const semitones = pitches?.[padIdx]?.[col] ?? 0
          if (semitones !== 0) src.detune.value = semitones * 100

          const velGain = offCtx.createGain()
          velGain.gain.value = vel / 127

          const gateGain = offCtx.createGain()
          // 5ms fade-in to eliminate clicks
          gateGain.gain.setValueAtTime(0, time)
          gateGain.gain.linearRampToValueAtTime(1.0, time + 0.005)

          const gateVal = gates?.[padIdx]?.[col] ?? padGates?.[padIdx] ?? 100
          if (gateVal < 100 && pad.buffer.duration > 0) {
            const gateDuration  = pad.buffer.duration * (gateVal / 100)
            const fadeOutStart  = Math.max(time + 0.005, time + gateDuration - 0.005)
            gateGain.gain.setValueAtTime(1.0, fadeOutStart)
            gateGain.gain.linearRampToValueAtTime(0.0001, time + gateDuration)
          }

          src.connect(velGain)
          velGain.connect(gateGain)
          gateGain.connect(eqOut)
          src.start(time)
        }
      })
    }
    return offCtx.startRendering()
  }

  // ─── Sample loading ────────────────────────────────────────────────────────

  async decodeFiles(files) {
    const results = []
    for (const file of files) {
      try {
        const ab     = await file.arrayBuffer()
        const buffer = await this.ctx.decodeAudioData(ab)
        results.push({ name: file.name.replace(/\.[^.]+$/, ''), buffer })
      } catch (e) {
        console.warn(`Skipped ${file.name}:`, e.message)
      }
    }
    return results
  }

  async loadFromUrls(soundDefs) {
    const results = []
    for (const { name, url } of soundDefs) {
      try {
        const resp   = await fetch(url)
        const ab     = await resp.arrayBuffer()
        const buffer = await this.ctx.decodeAudioData(ab)
        results.push({ name, buffer })
      } catch (e) {
        console.warn(`Skipped ${url}:`, e.message)
      }
    }
    return results
  }

  loadPads(padData) {
    this.pads.forEach(p => {
      try { p.panNode.disconnect()  } catch {}
      try { p.eqHigh?.disconnect()  } catch {}
      try { p.eqMid?.disconnect()   } catch {}
      try { p.eqLow?.disconnect()   } catch {}
      try { p.gainNode.disconnect() } catch {}
    })

    this.pads = padData.map(({ name, buffer }) => {
      const gainNode = this.ctx.createGain()
      gainNode.gain.value = 1.0

      // Per-pad 3-band EQ
      const eqLow  = this.ctx.createBiquadFilter()
      eqLow.type = 'lowshelf'; eqLow.frequency.value = 200; eqLow.gain.value = 0

      const eqMid  = this.ctx.createBiquadFilter()
      eqMid.type = 'peaking'; eqMid.frequency.value = 1000; eqMid.Q.value = 1.0; eqMid.gain.value = 0

      const eqHigh = this.ctx.createBiquadFilter()
      eqHigh.type = 'highshelf'; eqHigh.frequency.value = 8000; eqHigh.gain.value = 0

      const panNode = this.ctx.createStereoPanner()
      panNode.pan.value = 0

      gainNode.connect(eqLow)
      eqLow.connect(eqMid)
      eqMid.connect(eqHigh)
      eqHigh.connect(panNode)
      panNode.connect(this.masterGainNode)

      return { name, buffer, gainNode, eqLow, eqMid, eqHigh, panNode }
    })
  }

  // ─── Pad trigger ───────────────────────────────────────────────────────────

  triggerPad(padIndex, time, velocity = 1.0, gateDuration = null, detuneCents = 0) {
    const pad = this.pads[padIndex]
    if (!pad?.buffer) return

    const src = this.ctx.createBufferSource()
    src.buffer = pad.buffer
    if (detuneCents !== 0) src.detune.value = detuneCents

    const startTime = time ?? this.ctx.currentTime

    // Gate gain — 5ms fade-in on every hit to eliminate clicks/pops
    const gateGain = this.ctx.createGain()
    gateGain.gain.setValueAtTime(0, startTime)
    gateGain.gain.linearRampToValueAtTime(1.0, startTime + 0.005)

    if (gateDuration != null) {
      const fadeOutStart = Math.max(startTime + 0.005, startTime + gateDuration - 0.005)
      gateGain.gain.setValueAtTime(1.0, fadeOutStart)
      gateGain.gain.linearRampToValueAtTime(0.0001, startTime + gateDuration)
    }

    if (velocity < 0.999) {
      const velGain = this.ctx.createGain()
      velGain.gain.value = velocity
      src.connect(velGain)
      velGain.connect(gateGain)
    } else {
      src.connect(gateGain)
    }
    gateGain.connect(pad.gainNode)

    src.start(startTime)
  }

  // ─── Metronome click ───────────────────────────────────────────────────────

  _triggerClick(time, isDownbeat) {
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = isDownbeat ? 1200 : 900
    env.gain.setValueAtTime(isDownbeat ? 0.45 : 0.28, time)
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.04)
    osc.connect(env)
    env.connect(this.ctx.destination)
    osc.start(time)
    osc.stop(time + 0.05)
  }

  // ─── Timing helpers ────────────────────────────────────────────────────────

  _stepGap(patternStep) {
    const bpm    = this.bpmRef.current
    const swing  = this.swingRef.current
    const base   = 60 / bpm / 4
    const offset = (swing / 100) * base
    return patternStep % 2 === 0 ? base + offset : base - offset
  }

  _barDuration() {
    return (60 / this.bpmRef.current / 4) * 16
  }

  // ─── Scheduler ─────────────────────────────────────────────────────────────

  _schedule() {
    const LOOKAHEAD  = 0.1
    const loopBars   = this.loopLengthRef.current
    const totalSteps = loopBars * 16

    while (this._nextStepTime < this.ctx.currentTime + LOOKAHEAD) {
      const absStep     = this._currentStep
      const patternStep = absStep
      const colInPage   = absStep % 16
      const steps       = this.stepsRef.current
      const gates       = this.gatesRef.current
      const muted       = this.mutedRef.current
      const schedTime   = this._nextStepTime
      const stepGap     = this._stepGap(patternStep)

      this.pads.forEach((_, padIdx) => {
        const vel = steps[padIdx]?.[patternStep] ?? 0
        if (!muted[padIdx] && vel > 0) {
          const gateVal    = gates?.[padIdx]?.[patternStep] ?? this.padGatesRef.current?.[padIdx] ?? 100
          let gateDuration = null
          if (gateVal < 100) {
            const sampleDur = this.pads[padIdx]?.buffer?.duration ?? 0
            if (sampleDur > 0) gateDuration = sampleDur * (gateVal / 100)
          }
          const semitones   = this.pitchesRef.current?.[padIdx]?.[patternStep] ?? 0
          const detuneCents = semitones * 100

          // Per-pad swing: override global swing timing when trackSwing > 0
          const padSwing = this.trackSwingsRef.current?.[padIdx] ?? 0
          let padSchedTime = schedTime
          if (padSwing > 0) {
            const base = 60 / this.bpmRef.current / 4
            const padOffset    = (padSwing / 100) * base
            const globalOffset = (this.swingRef.current / 100) * base
            const delta = padOffset - globalOffset
            padSchedTime = schedTime + (patternStep % 2 === 0 ? delta : -delta)
          }

          this.triggerPad(padIdx, padSchedTime, vel / 127, gateDuration, detuneCents)
        }
      })

      if (this.metronomeRef.current && patternStep % 4 === 0) {
        this._triggerClick(schedTime, patternStep === 0)
      }

      const delayMs = Math.max(0, (schedTime - this.ctx.currentTime) * 1000)
      const uiStep  = colInPage
      const uiBar   = Math.floor(absStep / 16)
      setTimeout(() => {
        if (this._playing) this.onStep?.({ step: uiStep, bar: uiBar })
      }, delayMs)

      const nextAbs = absStep + 1
      if (nextAbs >= totalSteps) {
        const loopDuration       = this._barDuration() * this.loopLengthRef.current
        this._loopPhaseStart    += loopDuration
        this._nextStepTime       = this._loopPhaseStart
        this._currentStep        = 0
      } else {
        this._nextStepTime += stepGap
        this._currentStep   = nextAbs
      }
    }

    this._timerID = setTimeout(() => this._schedule(), 25)
  }

  // ─── Transport ─────────────────────────────────────────────────────────────

  play() {
    if (this._playing) return
    this._playing        = true
    this._currentStep    = 0
    this._loopPhaseStart = this.ctx.currentTime + 0.05
    this._nextStepTime   = this._loopPhaseStart
    this._schedule()
  }

  stop() {
    this._playing = false
    clearTimeout(this._timerID)
    this._timerID     = null
    this._currentStep = 0
    this.onStep?.(-1)
  }

  get isPlaying() { return this._playing }

  // ─── Per-pad controls ──────────────────────────────────────────────────────

  setGain(padIndex, gain) {
    if (this.pads[padIndex]) this.pads[padIndex].gainNode.gain.value = gain
  }

  setPan(padIndex, pan) {
    if (this.pads[padIndex]) this.pads[padIndex].panNode.pan.value = pan
  }

  setMasterVolume(volume) {
    if (this.masterGainNode) this.masterGainNode.gain.value = volume
  }

  setMasterEQ(low, mid, high) {
    if (this._masterEqLow)  this._masterEqLow.gain.value  = low
    if (this._masterEqMid)  this._masterEqMid.gain.value  = mid
    if (this._masterEqHigh) this._masterEqHigh.gain.value = high
  }

  // ─── Texture generators ────────────────────────────────────────────────────

  async startTapeHiss(level) {
    if (this._hissSource) return
    if (!this._hissBuffer) {
      const resp = await fetch('/assets/tape-hiss.wav')
      const ab   = await resp.arrayBuffer()
      this._hissBuffer = await this.ctx.decodeAudioData(ab)
    }
    const src = this.ctx.createBufferSource()
    src.buffer = this._hissBuffer
    src.loop   = true
    const gain = this.ctx.createGain()
    gain.gain.value = level
    src.connect(gain)
    gain.connect(this.masterGainNode)
    src.start()
    this._hissSource   = src
    this._hissGainNode = gain
  }

  stopTapeHiss() {
    try { this._hissSource?.stop() }         catch {}
    try { this._hissSource?.disconnect() }   catch {}
    try { this._hissGainNode?.disconnect() } catch {}
    this._hissSource   = null
    this._hissGainNode = null
  }

  setTapeHissLevel(level) {
    if (this._hissGainNode) {
      this._hissGainNode.gain.setTargetAtTime(level, this.ctx.currentTime, 0.05)
    }
  }

  async startVinylCrackle(level) {
    if (this._crackleSource) return
    if (!this._crackleBuffer) {
      const resp = await fetch('/assets/vinyl-crackle.wav')
      const ab   = await resp.arrayBuffer()
      this._crackleBuffer = await this.ctx.decodeAudioData(ab)
    }
    const src = this.ctx.createBufferSource()
    src.buffer = this._crackleBuffer
    src.loop   = true
    const gain = this.ctx.createGain()
    gain.gain.value = level
    src.connect(gain)
    gain.connect(this.masterGainNode)
    src.start()
    this._crackleSource   = src
    this._crackleGainNode = gain
  }

  stopVinylCrackle() {
    try { this._crackleSource?.stop() }        catch {}
    try { this._crackleSource?.disconnect() }  catch {}
    try { this._crackleGainNode?.disconnect() } catch {}
    this._crackleSource   = null
    this._crackleGainNode = null
  }

  setVinylCrackleDensity(level) {
    if (this._crackleGainNode) {
      this._crackleGainNode.gain.setTargetAtTime(level, this.ctx.currentTime, 0.05)
    }
  }

  // ─── Offline render / export ───────────────────────────────────────────────

  async renderLoop({ steps, gates, pitches, bpm, swing, loopBars, muted, gains, pans, padGates, padEqs, perTrackSwings, tapeHiss, vinylCrackle }) {
    const sampleRate = 44100
    const base   = 60 / bpm / 4
    const offset = (swing / 100) * base
    const gaps = Array.from({ length: 16 }, (_, i) =>
      i % 2 === 0 ? base + offset : base - offset
    )
    const barDuration   = base * 16
    const totalDuration = barDuration * loopBars

    const offCtx = new OfflineAudioContext(
      2,
      Math.ceil(sampleRate * totalDuration),
      sampleRate
    )

    const masterOut = offCtx.createGain()
    masterOut.gain.value = 1.0
    masterOut.connect(offCtx.destination)

    for (let bar = 0; bar < loopBars; bar++) {
      const stepTimes = []
      let t = bar * barDuration
      for (let i = 0; i < 16; i++) { stepTimes.push(t); t += gaps[i] }

      stepTimes.forEach((globalTime, step) => {
        const col = bar * 16 + step
        this.pads.forEach((pad, padIdx) => {
          const vel = steps[padIdx]?.[col] ?? 0
          if (!muted[padIdx] && vel > 0 && pad.buffer) {
            // Per-pad swing: override global swing when trackSwing > 0
            const padSwing = perTrackSwings?.[padIdx] ?? 0
            let time = globalTime
            if (padSwing > 0) {
              const padOffset   = (padSwing / 100) * base
              const swingDelta  = padOffset - offset
              time = globalTime + (step % 2 === 0 ? swingDelta : -swingDelta)
            }

            const src = offCtx.createBufferSource()
            src.buffer = pad.buffer
            const semitones = pitches?.[padIdx]?.[col] ?? 0
            if (semitones !== 0) src.detune.value = semitones * 100

            const velGain = offCtx.createGain()
            velGain.gain.value = vel / 127

            const padGain = offCtx.createGain()
            padGain.gain.value = gains[padIdx] ?? 1.0

            const panNode = offCtx.createStereoPanner()
            panNode.pan.value = pans?.[padIdx] ?? 0

            const gateGain = offCtx.createGain()
            // 5ms fade-in to eliminate clicks
            gateGain.gain.setValueAtTime(0, time)
            gateGain.gain.linearRampToValueAtTime(1.0, time + 0.005)

            const gateVal = gates?.[padIdx]?.[col] ?? padGates?.[padIdx] ?? 100
            if (gateVal < 100 && pad.buffer.duration > 0) {
              const gateDuration  = pad.buffer.duration * (gateVal / 100)
              const fadeOutStart  = Math.max(time + 0.005, time + gateDuration - 0.005)
              gateGain.gain.setValueAtTime(1.0, fadeOutStart)
              gateGain.gain.linearRampToValueAtTime(0.0001, time + gateDuration)
            }

            // Build chain: gateGain → [eqLow → eqMid → eqHigh →] panNode → masterOut
            const eq = padEqs?.[padIdx]
            if (eq?.enabled && (eq.low !== 0 || eq.mid !== 0 || eq.high !== 0)) {
              const eqLow  = offCtx.createBiquadFilter()
              eqLow.type = 'lowshelf'; eqLow.frequency.value = 200; eqLow.gain.value = eq.low ?? 0
              const eqMid  = offCtx.createBiquadFilter()
              eqMid.type = 'peaking';  eqMid.frequency.value = 1000; eqMid.Q.value = 1.0; eqMid.gain.value = eq.mid ?? 0
              const eqHigh = offCtx.createBiquadFilter()
              eqHigh.type = 'highshelf'; eqHigh.frequency.value = 8000; eqHigh.gain.value = eq.high ?? 0
              gateGain.connect(eqLow)
              eqLow.connect(eqMid); eqMid.connect(eqHigh); eqHigh.connect(panNode)
            } else {
              gateGain.connect(panNode)
            }
            panNode.connect(masterOut)

            src.connect(velGain)
            velGain.connect(padGain)
            padGain.connect(gateGain)
            src.start(time)
          }
        })
      })
    }

    if (tapeHiss?.enabled && this._hissBuffer) {
      const src = offCtx.createBufferSource()
      src.buffer = this._hissBuffer
      src.loop   = true
      const gain = offCtx.createGain()
      gain.gain.value = tapeHiss.level ?? 0.5
      src.connect(gain)
      gain.connect(masterOut)
      src.start(0)
    }

    if (vinylCrackle?.enabled && this._crackleBuffer) {
      const src = offCtx.createBufferSource()
      src.buffer = this._crackleBuffer
      src.loop   = true
      const gain = offCtx.createGain()
      gain.gain.value = vinylCrackle.density ?? 0.5
      src.connect(gain)
      gain.connect(masterOut)
      src.start(0)
    }

    return offCtx.startRendering()
  }
}

export const audioEngine = new AudioEngine()
