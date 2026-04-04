/**
 * UserPlanContext — live plan query from Supabase subscriptions table.
 * Falls back to 'free' if Supabase is unavailable or query fails.
 *
 * Exports:
 *   useUserPlan() → { plan: 'free' | 'pro', isPro: boolean, loading: boolean, refetch: fn }
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient.js'

// ── Module-level: detect and clean ?pro=1 before React ever renders ───────────
// This must happen at module evaluation time so the flag is never missed,
// even when the user is already signed in (no SIGNED_IN event fires on reload).
const _proParam = new URLSearchParams(window.location.search).get('pro')
const hasPendingProUpgrade = _proParam === '1'
if (hasPendingProUpgrade) {
  window.history.replaceState({}, '', window.location.pathname)
}

const UserPlanContext = createContext({
  plan:    'free',
  isPro:   false,
  loading: false,
  refetch: () => {},
})

export function UserPlanProvider({ children, user }) {
  const [plan,    setPlan]    = useState('free')
  const [loading, setLoading] = useState(false)

  const fetchPlan = useCallback(async (uid) => {
    if (!supabase || !uid) { setPlan('free'); return }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', uid)
        .maybeSingle()

      if (error) { console.warn('[UserPlan] Query error:', error); setPlan('free'); return }
      setPlan(data?.plan === 'pro' && data?.status === 'active' ? 'pro' : 'free')
    } catch (e) {
      console.warn('[UserPlan] Fetch failed:', e)
      setPlan('free')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch whenever the authenticated user changes
  useEffect(() => {
    fetchPlan(user?.id ?? null)
  }, [user, fetchPlan])

  // Poll subscriptions table after Stripe redirect (?pro=1)
  // The module-level flag was already captured; webhook may take a few seconds to fire.
  useEffect(() => {
    if (!hasPendingProUpgrade || !user?.id) return

    let stopped = false
    let attempt = 0
    const MAX_ATTEMPTS = 8
    const INTERVAL_MS  = 1500

    async function poll() {
      if (stopped) return
      attempt++
      console.log(`[UserPlan] Polling for Pro status (attempt ${attempt}/${MAX_ATTEMPTS})`)

      try {
        const { data } = await supabase
          .from('subscriptions')
          .select('plan, status')
          .eq('user_id', user.id)
          .maybeSingle()

        if (data?.plan === 'pro' && data?.status === 'active') {
          console.log('[UserPlan] ✅ Pro confirmed after Stripe redirect')
          setPlan('pro')
          return
        }
      } catch (e) {
        console.warn('[UserPlan] Poll error:', e)
      }

      if (attempt < MAX_ATTEMPTS) {
        setTimeout(poll, INTERVAL_MS)
      } else {
        console.warn('[UserPlan] Pro status not confirmed after max attempts — falling back to normal fetch')
        fetchPlan(user.id)
      }
    }

    // Start first poll after a short delay to give webhook time to fire
    const timer = setTimeout(poll, 1000)
    return () => { stopped = true; clearTimeout(timer) }
  }, [user, fetchPlan]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <UserPlanContext.Provider value={{ plan, isPro: plan === 'pro', loading, refetch: () => fetchPlan(user?.id) }}>
      {children}
    </UserPlanContext.Provider>
  )
}

export function useUserPlan() {
  return useContext(UserPlanContext)
}
