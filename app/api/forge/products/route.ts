import { NextRequest, NextResponse } from 'next/server'
import { getAllProducts, updateProduct, updateVariant } from '@/lib/forge'

export async function GET(req: NextRequest) {
  const collectionId = req.nextUrl.searchParams.get('collection_id') ?? undefined
  try {
    const products = await getAllProducts(collectionId)
    return NextResponse.json({ products })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const { type, id, updates } = await req.json()
  try {
    if (type === 'variant') {
      const variant = await updateVariant(id, updates)
      return NextResponse.json({ variant })
    }
    const product = await updateProduct(id, updates)
    return NextResponse.json({ product })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
