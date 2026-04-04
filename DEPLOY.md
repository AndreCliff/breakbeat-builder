# Deployment Checklist

## 1. Add full Stripe secret key to .env
Replace `REPLACE_WITH_FULL_SK_LIVE_KEY` in `.env` with your complete `sk_live_...` key.

## 2. Create Supabase tables
Go to: https://app.supabase.com/project/qmgyizphocnyilfmptfg/sql

Paste and run the contents of:
`supabase/migrations/20240001_subscriptions.sql`

## 3. Deploy Edge Functions
Open a terminal in this folder and run:

```
npx supabase login
npx supabase link --project-ref qmgyizphocnyilfmptfg
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_FULL_KEY
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_PLACEHOLDER
npx supabase functions deploy create-checkout
npx supabase functions deploy stripe-webhook
```

## 4. Set up Stripe Webhook
Go to: https://dashboard.stripe.com/webhooks

- Click "Add endpoint"
- URL: `https://qmgyizphocnyilfmptfg.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed`
- Copy the webhook signing secret (starts with `whsec_`)

Then update the secret:
```
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
```

Also add to `.env`:
```
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
```

## 5. Test the flow
1. Load a kit, set a pattern
2. Click `↓ MIDI` or `↓ Stems` — ProModal should appear
3. Click "Unlock Pro — $49" — Stripe Checkout opens
4. Use Stripe test card: 4242 4242 4242 4242
5. After payment, return URL has `?pro=1` → plan refetches → UI unlocks Pro features

## What's live now
- ✅ Supabase subscriptions + patterns tables (after running SQL)
- ✅ Edge Function: create-checkout (Stripe $49 one-time payment)
- ✅ Edge Function: stripe-webhook (marks user as Pro on payment)
- ✅ UserPlanContext — live query from subscriptions table
- ✅ ProModal — $49 unlock screen matching app aesthetic
- ✅ MIDI export — Pro gated in ExportButton
- ✅ Stems export (per-pad WAV ZIP) — Pro gated
- ✅ Bit Crusher FX (AudioWorklet) — Pro gated in TexturePanel
- ✅ Master EQ 3-band — Pro gated in Transport
- ✅ 6-bar and 8-bar loop lengths — Pro gated in Transport
- ✅ ☁ My Patterns (cloud save/load) — Pro gated
- ✅ ProModal shown on any Pro feature touch
