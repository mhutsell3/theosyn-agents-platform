import { NextResponse } from 'next/server'
import { getGHLProducts } from '@/lib/beacon'

export async function GET() {
  const products = await getGHLProducts()
  return NextResponse.json({ products })
}
