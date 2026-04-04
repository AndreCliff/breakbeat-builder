import { supabase } from './supabaseClient'

/**
 * Fire an analytics event to the `analytics_events` Supabase table.
 * Silently no-ops if Supabase is not configured.
 *
 * Required table schema (run once in Supabase SQL editor):
 *
 *   create table analytics_events (
 *     id         bigserial primary key,
 *     event      text not null,
 *     properties jsonb,
 *     created_at timestamptz default now()
 *   );
 *   alter table analytics_events enable row level security;
 *   create policy "anon insert" on analytics_events for insert with check (true);
 */
export async function trackEvent(event, properties = {}) {
  if (!supabase) return
  try {
    await supabase.from('analytics_events').insert({ event, properties })
  } catch {
    // silent
  }
}
