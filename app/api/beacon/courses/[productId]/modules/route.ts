import { NextRequest, NextResponse } from 'next/server'
import { createGHLSubCategory } from '@/lib/beacon'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params
  const { title, description } = await req.json()
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const module = await createGHLSubCategory({
    productId,
    title,
    description,
  })

  if (!module) return NextResponse.json({ error: 'GHL API call failed' }, { status: 502 })
  return NextResponse.json({ module })
}
