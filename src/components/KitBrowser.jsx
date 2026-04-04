import { useState, useEffect, useCallback } from 'react'
import KitCard from './KitCard.jsx'

export default function KitBrowser({ onLoadKit, onFileDrop, isLoading }) {
  const [kits, setKits]         = useState([])
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    fetch('/kits/kit-manifest.json')
      .then(r => r.json())
      .then(data => setKits(data.kits))
      .catch(e => console.error('Failed to load kit manifest:', e))
  }, [])

  const handleDragOver = useCallback(e => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(e => {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false)
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
    <div className="flex-1 flex flex-col items-center px-6 pt-2 pb-12">
      <div className="w-full max-w-3xl flex flex-col gap-12">

        {/* ── Kit grid ── */}
        <section className="flex flex-col gap-6">
          <div className="text-[10px] text-[#7a7060] uppercase tracking-[0.2em]">
            Select a Kit
          </div>

          {kits.length === 0 ? (
            <div className="text-[#7a7060] text-xs uppercase tracking-widest py-4">
              Loading kits…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {kits.map((kit, i) => (
                <KitCard
                  key={kit.id}
                  number={i + 1}
                  kit={kit}
                  onLoad={() => onLoadKit(kit)}
                  isLoading={isLoading}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Divider ── */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-[10px] text-[#7a7060] uppercase tracking-widest whitespace-nowrap">
            or use your own sounds
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        {/* ── Drop zone ── */}
        <section>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative flex flex-col items-center justify-center gap-4
              border-2 border-dashed rounded-[4px] p-10 text-center
              transition-all duration-150 cursor-pointer
              ${isDragging
                ? 'border-accent bg-accent/5'
                : 'border-[var(--border)] hover:border-accent/40'
              }
            `}
            style={{ background: 'var(--panel)' }}
            onClick={() => document.getElementById('kit-file-input').click()}
          >
            <input
              id="kit-file-input"
              type="file"
              accept=".wav"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />

            {isLoading ? (
              <>
                <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <p className="text-[#7a7060] uppercase text-xs tracking-widest">
                  Decoding samples…
                </p>
              </>
            ) : (
              <>
                <svg
                  width="36" height="36" viewBox="0 0 48 48" fill="none"
                  className={isDragging ? 'text-accent' : 'text-[#3a3328]'}
                >
                  <rect x="4" y="4" width="40" height="40" rx="3"
                    stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
                  <path d="M24 14v16M17 23l7 7 7-7"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                </svg>

                <div>
                  <p className="text-[#e8dcc8] font-bold uppercase tracking-widest text-xs mb-1">
                    Drop WAV files here
                  </p>
                  <p className="text-[#7a7060] text-[10px] uppercase tracking-wider">
                    Up to 16 files · mapped alphabetically · or click to browse
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
