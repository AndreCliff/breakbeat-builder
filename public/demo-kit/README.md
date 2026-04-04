# Demo Kit

Place WAV files here for the "Try Demo Kit" button to load.

The app will also work without files in this folder — clicking "Try Demo Kit"
generates a synthetic 10-piece drum kit programmatically via the Web Audio API.

If you want real samples here instead, add up to 16 WAV files and update
`src/lib/demoKit.js` to fetch them with `fetch('/demo-kit/filename.wav')`
and decode via `AudioContext.decodeAudioData`.
