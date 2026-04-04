import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

serve(async (req) => {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  console.log('[webhook] Received event — sig present:', !!signature)

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', String(err))
    return new Response('Bad signature', { status: 400 })
  }

  console.log('[webhook] Event type:', event.type, '| id:', event.id)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    console.log('[webhook] Session id:', session.id)
    console.log('[webhook] Payment status:', session.payment_status)
    console.log('[webhook] metadata:', JSON.stringify(session.metadata))
    console.log('[webhook] client_reference_id:', session.client_reference_id)
    console.log('[webhook] customer_email:', session.customer_email)

    // Accept user_id from metadata OR client_reference_id
    const userId = session.metadata?.user_id ?? session.client_reference_id ?? null
    const custId = typeof session.customer === 'string' ? session.customer : null

    if (!userId) {
      console.error('[webhook] No user_id in metadata or client_reference_id — cannot update plan')
      return new Response('ok') // still 200 so Stripe stops retrying
    }

    if (session.payment_status !== 'paid') {
      console.warn('[webhook] Payment status is not paid:', session.payment_status, '— skipping')
      return new Response('ok')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const payload = {
      plan:        'pro',
      status:      'active',
      external_id: custId,
      metadata:    { checkout_id: session.id },
    }

    // Check if a subscription row already exists for this user
    const { data: existing, error: selectErr } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (selectErr) {
      console.error('[webhook] Select error:', JSON.stringify(selectErr))
      return new Response('Subscription lookup failed', { status: 500 })
    }

    let dbError
    if (existing) {
      console.log('[webhook] Updating existing subscription for user:', userId)
      const { error } = await supabase
        .from('subscriptions')
        .update(payload)
        .eq('user_id', userId)
      dbError = error
    } else {
      console.log('[webhook] Inserting new subscription for user:', userId)
      const { error } = await supabase
        .from('subscriptions')
        .insert({ user_id: userId, ...payload })
      dbError = error
    }

    if (dbError) {
      console.error('[webhook] Supabase write error:', JSON.stringify(dbError))
      return new Response('Subscription update failed', { status: 500 })
    }

    console.log('[webhook] ✅ Pro subscription recorded for user:', userId)
  }

  return new Response('ok')
})
