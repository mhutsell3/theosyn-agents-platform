import Stripe from 'stripe'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-05-27.dahlia',
  })
}

export { getStripe }

export async function createPaymentLink(invoice: {
  id: string
  client_name: string | null
  amount: number
  description: string | null
  invoice_number: string | null
}): Promise<string> {
  const stripe = getStripe()
  const product = await stripe.products.create({
    name: invoice.description ?? `Invoice ${invoice.invoice_number ?? invoice.id.slice(0, 8)}`,
    metadata: { invoice_id: invoice.id },
  })

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(invoice.amount * 100), // cents
    currency: 'usd',
  })

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: { invoice_id: invoice.id },
    after_completion: {
      type: 'hosted_confirmation',
      hosted_confirmation: {
        custom_message: `Thank you${invoice.client_name ? `, ${invoice.client_name}` : ''}! Your payment has been received. — TheoSYN Labs`,
      },
    },
  })

  return paymentLink.url
}
