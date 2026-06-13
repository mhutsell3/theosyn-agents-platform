import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Stripe webhook error:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    const obj = event.data.object as { metadata?: { invoice_id?: string } }
    const invoiceId = obj.metadata?.invoice_id

    if (invoiceId) {
      await db`
        UPDATE invoices SET
          status = 'Paid',
          paid_date = current_date
        WHERE id = ${invoiceId}`

      console.log(`Invoice ${invoiceId} marked as Paid via Stripe webhook`)
    }
  }

  return NextResponse.json({ received: true })
}
