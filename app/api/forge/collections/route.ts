import { NextResponse } from 'next/server'
import { getCollections } from '@/lib/forge'

export async function GET() {
  try {
    const collections = await getCollections()
    return NextResponse.json({ collections })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
