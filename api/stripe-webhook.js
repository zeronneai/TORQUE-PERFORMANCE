import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { api: { bodyParser: false } };

async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Monthly sessions per price ID (all plans reset to monthly amount each cycle)
const PRICE_INFO = {
  // PACKAGE A (live)
  'price_1TLqDdAPTWbxe0YytEOlF7ZH': { sessions: 4,  name: 'Package A' },
  'price_1TLqDmAPTWbxe0YyqbHEcuFr': { sessions: 4,  name: 'Package A' },
  'price_1TLqDmAPTWbxe0YysigUumPn': { sessions: 4,  name: 'Package A' },
  'price_1TLqDlAPTWbxe0YyljY5WD6Y': { sessions: 4,  name: 'Package A' },
  // PACKAGE AA (live)
  'price_1TLqDgAPTWbxe0Yy7yaP3VX3': { sessions: 8,  name: 'Package AA' },
  'price_1TLqDkAPTWbxe0YyZu4hFrI3': { sessions: 8,  name: 'Package AA' },
  'price_1TLqDjAPTWbxe0YyTsqaUdt5': { sessions: 8,  name: 'Package AA' },
  'price_1TLqDkAPTWbxe0YykcsrB50f': { sessions: 8,  name: 'Package AA' },
  // PACKAGE AAA (live)
  'price_1TLqDhAPTWbxe0YyXXJQZrh7': { sessions: 12, name: 'Package AAA' },
  'price_1TLqDkAPTWbxe0YydXEB3YqT': { sessions: 12, name: 'Package AAA' },
  'price_1TLqDjAPTWbxe0YyuyUujCu4': { sessions: 12, name: 'Package AAA' },
  'price_1TLqDkAPTWbxe0Yy8UHtMvEJ': { sessions: 12, name: 'Package AAA' },
  // PACKAGE MLB (live)
  'price_1TLqDdAPTWbxe0YydO64XMLw': { sessions: 20, name: 'Package MLB' },
  'price_1TLqDlAPTWbxe0YyEIZi7YR5': { sessions: 20, name: 'Package MLB' },
  'price_1TLqDjAPTWbxe0YyVQxRaHFs': { sessions: 20, name: 'Package MLB' },
  'price_1TLqDjAPTWbxe0Yy6fRLwlFM': { sessions: 20, name: 'Package MLB' },
};

function addMonths(unixTs, months) {
  const d = new Date(unixTs * 1000);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

// ── Admin email alert via Resend REST API ────────────────────────────────────
async function sendAlert({ subject, parentId, kidName, priceId, sessionId, errorMsg }) {
  const to     = process.env.ADMIN_ALERT_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  if (!to || !apiKey) {
    console.warn('[webhook] sendAlert skipped — ADMIN_ALERT_EMAIL or RESEND_API_KEY not set');
    return;
  }
  const text = [
    '❌ A Stripe webhook event failed to process a payment.',
    '',
    `Error      : ${errorMsg  || '—'}`,
    `Session ID : ${sessionId || '—'}`,
    `Parent ID  : ${parentId  || '—'}`,
    `Kid name   : ${kidName   || '—'}`,
    `Price ID   : ${priceId   || '—'}`,
    '',
    'Check the Stripe Dashboard and update Supabase manually if needed.',
  ].join('\n');
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Torque Alerts <alerts@torqueperformance.app>',
        to,
        subject,
        text,
      }),
    });
    if (!r.ok) console.error('[webhook] sendAlert HTTP error:', r.status, await r.text());
  } catch (e) {
    console.error('[webhook] sendAlert failed:', e.message);
  }
}

async function upsertMembership({ parentId, kidName, priceId, isAnnual, ts, stripeSessionId, stripePaymentId }) {
  const info = PRICE_INFO[priceId];
  if (!info) {
    const errorMsg = `unrecognized price ID "${priceId}" — add it to PRICE_INFO`;
    console.error(`[webhook] UNRECOGNIZED PRICE ID: "${priceId}" — parent: ${parentId}, kid: ${kidName}, session: ${stripeSessionId}. Add this price ID to PRICE_INFO to process the payment.`);
    sendAlert({
      subject:  `⚠️ Torque webhook failed - ${kidName || stripeSessionId}`,
      parentId, kidName, priceId, sessionId: stripeSessionId,
      errorMsg,
    }).catch(() => {});
    return;
  }

  const purchasedAt = new Date(ts * 1000).toISOString();
  const expiresAt   = addMonths(ts, isAnnual ? 12 : 1);

  const { data: existing } = await supabase
    .from('player_memberships')
    .select('id')
    .eq('parent_id', parentId)
    .ilike('kid_name', kidName)
    .maybeSingle();

  // Always replace sessions_total with the package amount and reset sessions_used to 0,
  // regardless of what the member had remaining before.
  const payload = {
    sessions_total:    info.sessions,
    sessions_used:     0,
    package_name:      info.name,
    stripe_payment_id: stripePaymentId,
    stripe_session_id: stripeSessionId,
    status:            'active',
    purchased_at:      purchasedAt,
    expires_at:        expiresAt,
  };

  if (existing) {
    const { error } = await supabase.from('player_memberships').update(payload).eq('id', existing.id);
    if (error) throw error;
    console.log(`✅ Updated — ${info.sessions} sessions → ${kidName} (${isAnnual ? 'annual' : 'monthly'}, exp ${expiresAt.slice(0,10)})`);
  } else {
    const { error } = await supabase.from('player_memberships').insert({ ...payload, parent_id: parentId, kid_name: kidName });
    if (error) throw error;
    console.log(`✅ Inserted — ${info.sessions} sessions → ${kidName} (${isAnnual ? 'annual' : 'monthly'})`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] Signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Populated as we parse the event so the catch block can include context in the alert.
  let _alertCtx = {};

  try {
    // ── Initial checkout (one-time or first subscription payment) ──
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const ref   = decodeURIComponent(session.client_reference_id || '');
      const parts = ref.split('__');

      if (parts.length < 2 || !parts[0] || !parts[1]) {
        const errorMsg = `missing/invalid client_reference_id: "${ref || '(empty)'}"`;
        console.error('[webhook] checkout.session.completed —', errorMsg, '| session:', session.id);
        sendAlert({
          subject:  `⚠️ Torque webhook failed - ${session.id}`,
          sessionId: session.id,
          errorMsg,
        }).catch(() => {});
        return res.status(200).json({ received: true });
      }

      const [parentId, kidName] = parts;
      let priceId = parts[2];

      // Fallback: if priceId is absent from ref, retrieve it from line items
      if (!priceId) {
        try {
          const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
          priceId = items.data[0]?.price?.id;
          console.log('[webhook] priceId resolved from line items:', priceId, '| session:', session.id);
        } catch (liErr) {
          console.error('[webhook] listLineItems error for session', session.id, liErr.message);
        }
      }

      if (!priceId) {
        const errorMsg = 'could not determine priceId from ref or line items';
        console.error('[webhook] checkout.session.completed —', errorMsg, '| session:', session.id);
        sendAlert({
          subject:  `⚠️ Torque webhook failed - ${kidName || session.id}`,
          parentId, kidName, sessionId: session.id,
          errorMsg,
        }).catch(() => {});
        return res.status(200).json({ received: true });
      }

      _alertCtx = { parentId, kidName, priceId, sessionId: session.id };

      const isAnnual        = session.mode === 'payment'; // 'payment' = one-time, 'subscription' = recurring
      const stripePaymentId = isAnnual ? session.payment_intent : session.subscription;

      await upsertMembership({
        parentId, kidName, priceId, isAnnual,
        ts:               session.created,
        stripeSessionId:  session.id,
        stripePaymentId,
      });
    }

    // ── Recurring subscription renewal ──
    else if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object;
      if (!invoice.subscription) return res.status(200).json({ received: true });

      const subId  = invoice.subscription;
      const priceId = invoice.lines?.data?.[0]?.price?.id;
      const info   = PRICE_INFO[priceId];

      const { data: existing } = await supabase
        .from('player_memberships')
        .select('id, kid_name')
        .eq('stripe_payment_id', subId)
        .maybeSingle();

      let record = existing;

      if (!record) {
        // Fallback for manual members: retrieve checkout session to get client_reference_id
        try {
          const sessions = await stripe.checkout.sessions.list({ subscription: subId, limit: 1 });
          const cs = sessions.data[0];
          if (cs?.client_reference_id) {
            const parts = decodeURIComponent(cs.client_reference_id).split('__');
            if (parts.length === 3) {
              const [parentId, kidName] = parts;
              const { data: byName } = await supabase
                .from('player_memberships')
                .select('id, kid_name')
                .eq('parent_id', parentId)
                .ilike('kid_name', kidName)
                .maybeSingle();
              if (byName) record = byName;
            }
          }
        } catch (fbErr) {
          console.error('[webhook] Fallback lookup error:', fbErr.message);
        }
      }

      if (!record) {
        console.log('[webhook] invoice.payment_succeeded — no record for sub:', subId);
        return res.status(200).json({ received: true });
      }

      _alertCtx = { kidName: record.kid_name, priceId, sessionId: subId };

      if (!info) {
        console.error('[webhook] Unknown price ID from invoice:', priceId);
        return res.status(200).json({ received: true });
      }

      const { error } = await supabase.from('player_memberships').update({
        sessions_total:    info.sessions,
        sessions_used:     0,
        status:            'active',
        stripe_payment_id: subId,
        purchased_at:      new Date(invoice.created * 1000).toISOString(),
        expires_at:        addMonths(invoice.created, 1),
      }).eq('id', record.id);

      if (error) throw error;
      console.log(`✅ Renewal${existing ? '' : ' (fallback)'} — ${info.sessions} sessions reset → ${record.kid_name}`);
    }

  } catch (err) {
    console.error('[webhook] Handler error:', err.message);
    sendAlert({
      subject:  `⚠️ Torque webhook failed - ${_alertCtx.kidName || _alertCtx.sessionId || 'unknown'}`,
      ..._alertCtx,
      errorMsg: err.message,
    }).catch(() => {});
    return res.status(500).json({ error: err.message });
  }

  return res.status(200).json({ received: true });
}
