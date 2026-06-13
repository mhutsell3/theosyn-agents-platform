import { NextRequest, NextResponse } from 'next/server'
import { getCustomers, getCustomer, updateCustomerTags, getCustomerOrders } from '@/lib/forge'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const query = req.nextUrl.searchParams.get('q') ?? undefined
  const orders = req.nextUrl.searchParams.get('orders')

  try {
    if (id && orders) {
      const customerOrders = await getCustomerOrders(id)
      return NextResponse.json({ orders: customerOrders })
    }
    if (id) {
      const customer = await getCustomer(id)
      return NextResponse.json({ customer })
    }
    const customers = await getCustomers(50, query)
    return NextResponse.json({ customers })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const { id, tags } = await req.json()
  try {
    const customer = await updateCustomerTags(id, tags)
    return NextResponse.json({ customer })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
