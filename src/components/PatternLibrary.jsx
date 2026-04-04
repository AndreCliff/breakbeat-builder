/**
 * PatternLibrary — Cloud save / load panel (Pro only).
 * Save the current session, list saved patterns, load or delete them.
 *
 * Error state is intentionally split:
 *   loadError — set by fetchPatterns / handleLoad, shown in the list area only
 *   saveError — set by handleSave, shown near the save button only
 * This prevents a fetch failure from appearing as a save failure (and vice versa).
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useUserPlan } from '../contexts/UserPlanContext.jsx'

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return iso }
}

export default function PatternLibrary({ user, onLoad, onProRequired, onClose, buildPayload, defaultSaveName }) {
  const { isPro } = useUserPlan()
  const [patterns,   setPatterns]  = useState([])
  const [loading,    setLoading]   = useState(false)
  const [saving,     setSaving]    = useState(false)
  const [saveName,   setSaveName]  = useState(defaultSaveName ?? '')
  const [saveMsg,    setSaveMsg]   = useState(null)   // { text, ok } — save feedback only
  const [saveError,  setSaveError] = useState(null)   // save-form errors (name required, etc.)
  const [loadError,  setLoadError] = useState(null)   // list-area errors (fetch / load failed)
  const dialogRef = useRef(null)

  useEffect(() => {
    if (defaultSaveName) setSaveName(defaultSaveName)
  }, [defaultSaveName])

  // ── Stable dismiss: mousedown on backdrop only, never while selecting text ──
  useEffect(() => {
    function handleMouseDown(e) {
      // Ignore if user has an active text selection (mid-drag select)
      if (window.getSelection()?.toString().length > 0) return
      // Only close if the mousedown landed outside the dialog box entirely
      if (dialogRef.current && !dialogRef.current.contains(e.target)) {
        onClose?.()
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown',   handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown',   handleKeyDown)
    }
  }, [onClose])

  // ── Fetch pattern list ───────────────────────────────────────────────────────
  const fetchPatterns = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('patterns')
        .select('id, title, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(50)
      if (error) {
        console.error('[PatternLibrary] fetchPatterns error:', error)
        throw error
      }
      setPatterns(data ?? [])
    } catch (e) {
      setLoadError('Could not load patterns.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (isPro && user) fetchPatterns()
  }, [isPro, user, fetchPatterns])

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!isPro) { onProRequired?.(); return }
    if (!saveName.trim()) { setSaveError('Enter a name first.'); return }
    if (!supabase || !user) { setSaveError('Not signed in.'); return }

    setSaving(true)
    setSaveError(null)
    setSaveMsg(null)

    try {
      const payload = buildPayload?.() ?? {}
      console.log('[PatternLibrary] Saving pattern:', { user_id: user.id, title: saveName.trim(), payloadKeys: Object.keys(payload) })

      const { data, error } = await supabase.from('patterns').insert({
        user_id: user.id,
        title:   saveName.trim(),
        payload,
      }).select('id')

      if (error) {
        console.error('[PatternLibrary] Insert error:', JSON.stringify(error, null, 2))
        const msg = error.code === '42501'
          ? 'Permission denied — check Supabase RLS policy (see console).'
          : `Save failed: ${error.message || error.code || 'unknown error'}`
        setSaveError(msg)
        return
      }

      console.log('[PatternLibrary] Saved successfully, id:', data?.[0]?.id)
      setSaveMsg({ text: 'PATTERN SAVED', ok: true })
      setSaveName('')
      setTimeout(() => setSaveMsg(null), 2000)
      await fetchPatterns()
    } catch (e) {
      console.error('[PatternLibrary] Save exception:', e)
      setSaveError(`Save failed: ${e?.message ?? 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(id) {
    if (!supabase || !user) return
    await supabase.from('patterns').delete().eq('id', id).eq('user_id', user.id)
    setPatterns(p => p.filter(x => x.id !== id))
  }

  // ── Load ────────────────────────────────────────────────────────────────────
  async function handleLoad(id) {
    if (!supabase || !user) return
    setLoadError(null)
    const { data, error } = await supabase
      .from('patterns')
      .select('payload')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (error || !data) {
      console.error('[PatternLibrary] Load error:', error)
      setLoadError('Could not load pattern.')
      return
    }
    onLoad?.(data.payload)
    onClose?.()
  }

  const LABEL = { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(242,220,180,0.4)', fontFamily: 'monospace' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}
    >
      <div
        ref={dialogRef}
        className="relative rounded-[4px] w-full mx-4 flex flex-col"
        style={{
          maxWidth: 440, maxHeight: '80vh',
          background: 'radial-gradient(ellipse at 50% 20%, #1e1a12 0%, #0a0806 100%)',
          border:     '1.5px solid rgba(242,220,180,0.18)',
          boxShadow:  '0 32px 80px rgba(0,0,0,0.9)',
          overflow:   'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid rgba(242,220,180,0.07)' }}>
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', color: 'rgba(242,220,180,0.35)', fontSize: 16, cursor: 'pointer', fontFamily: 'monospace' }}
          >✕</button>
          <div style={{ ...LABEL, fontSize: 7, marginBottom: 4 }}>Breakbeat Builder</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#C46E1F', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            My Patterns
          </div>
        </div>

        {!isPro ? (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(242,220,180,0.5)', fontFamily: 'monospace', marginBottom: 14 }}>
              Cloud save requires Pro.
            </div>
            <button
              onClick={onProRequired}
              style={{ background: '#C46E1F', color: '#0a0806', border: 'none', borderRadius: 4, padding: '10px 24px', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', fontFamily: 'monospace' }}
            >
              Unlock Pro
            </button>
          </div>
        ) : (
          <>
            {/* ── Save row ──────────────────────────────────────────────────── */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(242,220,180,0.07)' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Pattern name…"
                  value={saveName}
                  onChange={e => { setSaveName(e.target.value); setSaveError(null) }}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  maxLength={80}
                  autoFocus={!!defaultSaveName}
                  style={{
                    flex: 1, background: '#0a0806', border: `1px solid ${saveError ? 'rgba(238,0,85,0.5)' : 'rgba(242,220,180,0.15)'}`,
                    borderRadius: 3, padding: '6px 10px', fontSize: 11, color: 'rgba(242,220,180,0.85)',
                    fontFamily: 'monospace', outline: 'none',
                  }}
                />
                <button
                  onClick={handleSave}
                  disabled={saving || !saveName.trim()}
                  style={{
                    background: saving || !saveName.trim() ? '#2a2418' : '#C46E1F',
                    color: '#0a0806', border: 'none', borderRadius: 3,
                    padding: '6px 16px', fontSize: 10, fontWeight: 900,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    cursor: saving || !saveName.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: 'monospace', whiteSpace: 'nowrap',
                    opacity: saving || !saveName.trim() ? 0.5 : 1,
                  }}
                >
                  {saving ? '…' : '+ Save'}
                </button>
                <button
                  onClick={onClose}
                  disabled={saving}
                  style={{
                    background: 'none', border: '1px solid rgba(242,220,180,0.15)', borderRadius: 3,
                    padding: '6px 12px', fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontFamily: 'monospace', whiteSpace: 'nowrap',
                    color: 'rgba(242,220,180,0.4)', opacity: saving ? 0.4 : 1,
                  }}
                >
                  Cancel
                </button>
              </div>

              {/* Save feedback — shown only for save-related messages */}
              {saveMsg && (
                <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.08em', color: saveMsg.ok ? '#C46E1F' : '#e05' }}>
                  {saveMsg.text}
                </div>
              )}
              {saveError && !saveMsg && (
                <div style={{ marginTop: 6, fontSize: 10, color: '#e05', fontFamily: 'monospace' }}>
                  {saveError}
                </div>
              )}
            </div>

            {/* ── Pattern list ──────────────────────────────────────────────── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {loading ? (
                <div style={{ padding: '16px 20px', fontSize: 11, color: 'rgba(242,220,180,0.3)', fontFamily: 'monospace' }}>Loading…</div>
              ) : loadError ? (
                <div style={{ padding: '12px 20px' }}>
                  <div style={{ fontSize: 10, color: '#e05', fontFamily: 'monospace', marginBottom: 8 }}>{loadError}</div>
                  <button
                    onClick={fetchPatterns}
                    style={{ fontSize: 9, fontFamily: 'monospace', color: '#C46E1F', background: 'none', border: '1px solid rgba(196,110,31,0.3)', borderRadius: 3, padding: '3px 8px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                  >
                    Retry
                  </button>
                </div>
              ) : patterns.length === 0 ? (
                <div style={{ padding: '16px 20px', fontSize: 11, color: 'rgba(242,220,180,0.3)', fontFamily: 'monospace' }}>No saved patterns yet.</div>
              ) : patterns.map(p => (
                <div
                  key={p.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderBottom: '1px solid rgba(242,220,180,0.05)' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'rgba(242,220,180,0.85)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(242,220,180,0.35)', fontFamily: 'monospace', marginTop: 2 }}>
                      {formatDate(p.updated_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleLoad(p.id)}
                    style={{ background: 'rgba(196,110,31,0.15)', border: '1px solid rgba(196,110,31,0.3)', borderRadius: 3, padding: '4px 10px', fontSize: 9, fontWeight: 700, color: '#C46E1F', cursor: 'pointer', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}
                  >Load</button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    style={{ background: 'none', border: '1px solid rgba(242,220,180,0.12)', borderRadius: 3, padding: '4px 8px', fontSize: 9, color: 'rgba(242,220,180,0.35)', cursor: 'pointer', fontFamily: 'monospace' }}
                  >✕</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
