import { NextRequest, NextResponse } from 'next/server'
import { getOrders, getOrder, fulfillOrder, getLocations } from '@/lib/forge'

export async function GET(req: NextRequest) {
  const id     = req.nextUrl.searchParams.get('id')
  const status = req.nextUrl.searchParams.get('status') ?? 'any'
  const query  = req.nextUrl.searchParams.get('q') ?? undefined

  try {
    if (id) {
      const order = await getOrder(id)
      return NextResponse.json({ order })
    }
    const orders = await getOrders(50, status, query)
    return NextResponse.json({ orders })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { orderId, trackingNumber, trackingCompany } = await req.json()
  try {
    const locations = await getLocations()
    if (!locations.length) return NextResponse.json({ error: 'No locations found' }, { status: 400 })
    const result = await fulfillOrder(orderId, locations[0].id, trackingNumber, trackingCompany)
    return NextResponse.json({ result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
