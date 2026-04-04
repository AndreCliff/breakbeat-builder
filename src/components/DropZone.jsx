import { useCallback, useState } from 'react'

export default function DropZone({ onFileDrop, onDemoKit, isLoading }) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback(e => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(e => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(e => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onFileDrop(files)
  }, [onFileDrop])

  const handleFileInput = useCallback(e => {
    const files = Array.from(e.target.files)
    if (files.length) onFileDrop(files)
    e.target.value = ''
  }, [onFileDrop])

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-65px)] px-6 py-12">
      <div className="w-full max-w-2xl">
        {/* Drop zone card */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative flex flex-col items-center justify-center gap-6
            border-2 border-dashed rounded-[4px] p-16 text-center
            transition-all duration-150 cursor-pointer
            ${isDragging
              ? 'border-accent bg-accent/5'
              : 'border-[var(--border)] bg-[var(--surface)] hover:border-accent/40'
            }
          `}
          onClick={() => document.getElementById('file-input').click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".wav"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />

          {isLoading ? (
            <>
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-[var(--muted)] uppercase text-xs tracking-widest">
                Decoding samples…
              </p>
            </>
          ) : (
            <>
              {/* Drop icon */}
              <svg
                width="48" height="48" viewBox="0 0 48 48" fill="none"
                className={isDragging ? 'text-accent' : 'text-[#333]'}
              >
                <rect x="4" y="4" width="40" height="40" rx="3" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
                <path d="M24 14v16M17 23l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
              </svg>

              <div className="space-y-2">
                <p className="text-white font-bold uppercase tracking-widest text-sm">
                  Drop WAV files here
                </p>
                <p className="text-[var(--muted)] text-xs uppercase tracking-wider">
                  Up to 16 files — mapped to pads alphabetically
                </p>
              </div>

              <p className="text-[var(--muted)] text-[10px] uppercase tracking-widest">
                or click to browse
              </p>
            </>
          )}
        </div>

        {/* Demo kit CTA */}
        <div className="mt-6 flex justify-center">
          <button
            className="btn-ghost text-[11px]"
            onClick={e => { e.stopPropagation(); onDemoKit(); }}
            disabled={isLoading}
          >
            Try Demo Kit →
          </button>
        </div>
      </div>
    </div>
  )
}
