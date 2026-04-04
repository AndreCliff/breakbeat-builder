/**
 * BitCrusherProcessor — AudioWorklet DSP node.
 * Parameters:
 *   bitDepth  (1–16, default 16) — quantization bit depth
 *   normFreq  (0–1,  default 1)  — sample rate reduction (1 = no reduction)
 */
class BitCrusherProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bitDepth', defaultValue: 16, minValue: 1, maxValue: 16, automationRate: 'k-rate' },
      { name: 'normFreq', defaultValue: 1,  minValue: 0.01, maxValue: 1, automationRate: 'k-rate' },
    ]
  }

  constructor() {
    super()
    this._phase  = 0
    this._sample = [0, 0]
  }

  process(inputs, outputs, parameters) {
    const input  = inputs[0]
    const output = outputs[0]
    if (!input || !input[0]) return true

    const bitDepth = parameters.bitDepth[0]
    const normFreq = parameters.normFreq[0]
    const step     = Math.pow(2, bitDepth)

    for (let ch = 0; ch < output.length; ch++) {
      const inBuf  = input[ch]  || input[0]
      const outBuf = output[ch]
      for (let i = 0; i < outBuf.length; i++) {
        this._phase += normFreq
        if (this._phase >= 1) {
          this._phase -= 1
          this._sample[ch] = Math.round(inBuf[i] * step) / step
        }
        outBuf[i] = this._sample[ch] ?? 0
      }
    }
    return true
  }
}

registerProcessor('bit-crusher-processor', BitCrusherProcessor)
