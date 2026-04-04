import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// If env vars are not set the app works fine — auth and analytics are skipped.
export const supabase = (url && key) ? createClient(url, key) : null
