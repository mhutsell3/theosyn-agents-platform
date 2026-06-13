import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const rows = await db`
    SELECT * FROM remi_recommendations
    WHERE status = 'pending'
    ORDER BY
      CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      created_at DESC
    LIMIT 50`

  return NextResponse.json(rows)
}
