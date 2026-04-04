/**
 * Encode an AudioBuffer as a 16-bit stereo WAV Blob.
 * Works with mono or stereo buffers (mono is duplicated to stereo).
 */
export function encodeWAV(audioBuffer) {
  const numChannels = 2; // always output stereo
  const sampleRate  = audioBuffer.sampleRate;
  const bitDepth    = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign  = numChannels * bytesPerSample;
  const numFrames   = audioBuffer.length;

  // Grab channel data — fall back to ch0 for mono sources
  const ch0 = audioBuffer.getChannelData(0);
  const ch1 = audioBuffer.numberOfChannels > 1
    ? audioBuffer.getChannelData(1)
    : ch0;

  const dataSize   = numFrames * blockAlign;
  const fileBuffer = new ArrayBuffer(44 + dataSize);
  const view       = new DataView(fileBuffer);

  function writeStr(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  function clamp(v) { return Math.max(-1, Math.min(1, v)); }

  // WAV header
  writeStr(0,  'RIFF');
  view.setUint32(4,  36 + dataSize, true);
  writeStr(8,  'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);                         // fmt chunk size
  view.setUint16(20, 1, true);                          // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);    // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleaved PCM samples
  let byteOffset = 44;
  for (let i = 0; i < numFrames; i++) {
    const s0 = clamp(ch0[i]);
    const s1 = clamp(ch1[i]);
    view.setInt16(byteOffset,     s0 < 0 ? s0 * 0x8000 : s0 * 0x7FFF, true);
    view.setInt16(byteOffset + 2, s1 < 0 ? s1 * 0x8000 : s1 * 0x7FFF, true);
    byteOffset += 4;
  }

  return new Blob([fileBuffer], { type: 'audio/wav' });
}

/**
 * Auto-generate a filename based on mute state.
 * padNames: string[]  muteState: boolean[]
 */
export function getExportFilename(padNames, muteState) {
  const slug = n => n.toLowerCase().replace(/\s+/g, '_');

  const activeTracks = padNames.filter((_, i) => !muteState[i]);
  const mutedTracks  = padNames.filter((_, i) =>  muteState[i]);

  if (mutedTracks.length === 0) {
    return 'break_full.wav';
  }
  if (activeTracks.length === 1) {
    return `break_${slug(activeTracks[0])}_only.wav`;
  }
  if (mutedTracks.length === 1) {
    return `break_no_${slug(mutedTracks[0])}.wav`;
  }
  return `break_${mutedTracks.map(n => `no_${slug(n)}`).join('_')}.wav`;
}
