export default function KitCard({ number, kit, onLoad, isLoading }) {
  const isEmpty = kit.sounds.length === 0

  return (
    <div
      className="flex flex-col gap-3 rounded-[4px] p-5 border transition-colors duration-150"
      style={{
        background: 'var(--pad-bg)',
        borderColor: 'rgba(255,240,200,0.07)',
      }}
    >
      {/* Number */}
      <div className="text-[10px] font-bold tracking-[0.2em] text-[#7a7060]">
        {String(number).padStart(2, '0')}
      </div>

      {/* Name */}
      <div className="text-sm font-bold uppercase tracking-wider text-[#e8dcc8] leading-tight">
        {kit.name}
      </div>

      {/* Meta */}
      <div className="text-[10px] text-[#7a7060] uppercase tracking-wider">
        {isEmpty ? 'Coming soon' : `${kit.sounds.length} sounds`}
      </div>

      {/* Description */}
      <p className="text-[11px] text-[#9a8e7e] leading-relaxed flex-1">
        {kit.description}
      </p>

      {/* Load button */}
      <button
        className="btn-primary w-full text-[11px] py-2"
        onClick={onLoad}
        disabled={isEmpty || isLoading}
      >
        {isLoading ? 'Loading…' : 'Load Kit'}
      </button>
    </div>
  )
}
