/**
 * useProGate — returns a guard function that either calls the action
 * immediately (if user is Pro) or opens the ProModal.
 *
 * Usage:
 *   const proGate = useProGate(setShowProModal)
 *   <button onClick={() => proGate(doMidiExport)}>↓ MIDI</button>
 */
import { useUserPlan } from '../contexts/UserPlanContext.jsx'

export function useProGate(openProModal) {
  const { isPro } = useUserPlan()
  return function proGate(action) {
    if (isPro) {
      action?.()
    } else {
      openProModal?.()
    }
  }
}
