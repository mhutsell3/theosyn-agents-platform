import { NextRequest, NextResponse } from 'next/server'
import { getContacts } from '@/lib/flow'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('query') ?? undefined
  const limit = parseInt(searchParams.get('limit') ?? '50')
  const startAfter = searchParams.get('startAfter') ?? undefined

  try {
    const result = await getContacts({ query, limit, startAfter })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[Flow] contacts error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
