export default function Footer() {
  return (
    <footer
      className="border-t border-[var(--border)]"
      style={{ padding: '0 0 6px', marginTop: 0 }}
    >
      {/* Inner wrapper — same width as app container so edges align */}
      <div
        style={{
          width:          '95vw',
          maxWidth:       1400,
          margin:         '0 auto',
          padding:        '4px 0 0',
          display:        'flex',
          justifyContent: 'center',
        }}
      >
        <a href="https://wemakebeatsoverhere.com/" target="_blank" rel="noopener noreferrer">
          <img
            src="/assets/breakbeat-builder-banner.png"
            alt="Brought to you by WeMakeBeatsOverHere.com"
            style={{ maxWidth: '624px', width: '100%', height: 'auto', display: 'block' }}
          />
        </a>
      </div>
    </footer>
  )
}
