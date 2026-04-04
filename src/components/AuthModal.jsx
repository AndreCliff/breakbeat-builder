import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient.js'

export default function AuthModal({ onClose, onSuccess }) {
  const [email, setEmail] = useState('')
  const [step, setStep]   = useState('form') // 'form' | 'sent'
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const handleMagicLink = useCallback(async e => {
    e.preventDefault()
    if (!email.trim() || !supabase) return
    setLoading(true)
    setError('')
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      })
      if (err) throw err
      setStep('sent')
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }, [email])

  const handleGoogle = useCallback(async () => {
    if (!supabase) return
    setError('')
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (err) throw err
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-[var(--surface)] border border-[var(--border)] rounded-[4px] p-8">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--muted)] hover:text-white text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>

        {step === 'sent' ? (
          <div className="text-center space-y-4">
            <div className="text-accent text-3xl">✓</div>
            <h2 className="text-white font-bold uppercase tracking-wider text-sm">
              Check your email
            </h2>
            <p className="text-[var(--muted)] text-xs leading-relaxed">
              We sent a magic link to <strong className="text-white">{email}</strong>.
              Click it to sign in and your export will download automatically.
            </p>
            <button onClick={onClose} className="btn-ghost text-[11px]">
              Dismiss
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-white font-bold uppercase tracking-widest text-sm mb-1">
              Sign in to export
            </h2>
            <p className="text-[var(--muted)] text-[11px] mb-6 leading-relaxed">
              Free forever. No password needed.
              Your export will download automatically after sign-in.
            </p>

            {/* Google OAuth */}
            <button
              onClick={handleGoogle}
              className="w-full btn-secondary mb-4 py-2.5 gap-3 justify-center"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-[10px] text-[var(--muted)] uppercase">or</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            {/* Magic Link */}
            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="
                  w-full bg-[#0a0a0a] border border-[var(--border)]
                  text-white text-xs px-3 py-2.5 rounded-[3px]
                  placeholder:text-[#444] outline-none
                  focus:border-accent transition-colors
                "
              />
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full btn-primary py-2.5"
              >
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
            </form>

            {error && (
              <p className="mt-3 text-[10px] text-red-400 uppercase tracking-wider">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
