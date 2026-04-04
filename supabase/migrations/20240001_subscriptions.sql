-- Subscriptions table — tracks plan status per user
create table if not exists public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  plan          text not null default 'free' check (plan in ('free', 'pro')),
  status        text not null default 'active' check (status in ('active', 'cancelled', 'expired')),
  external_id   text,          -- Stripe customer ID
  checkout_id   text,          -- Stripe checkout session ID
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id)
);

-- RLS
alter table public.subscriptions enable row level security;

create policy "Users can read their own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Service role can insert/update (used by webhook Edge Function)
create policy "Service role can manage subscriptions"
  on public.subscriptions for all
  using (true)
  with check (true);

-- Auto-update updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- Patterns table — cloud-saved beat sessions
create table if not exists public.patterns (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Untitled',
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.patterns enable row level security;

create policy "Users can manage their own patterns"
  on public.patterns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger patterns_updated_at
  before update on public.patterns
  for each row execute function public.touch_updated_at();
