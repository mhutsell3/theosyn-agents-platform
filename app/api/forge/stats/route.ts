import { NextResponse } from 'next/server'
import { getRevenueStats } from '@/lib/forge'

export async function GET() {
  try {
    const stats = await getRevenueStats()
    return NextResponse.json(stats)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
