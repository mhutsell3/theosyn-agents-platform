import { db } from '@/lib/db'
import QuillDashboard from '@/components/QuillDashboard'

export const revalidate = 0

async function getProfile() {
  try {
    const [profile] = await db`SELECT * FROM brand_voice_profile LIMIT 1` as unknown as unknown[]
    const count = await db`SELECT COUNT(*)::int AS count FROM brand_voice_samples` as unknown as [{ count: number }]
    return { profile, sampleCount: count[0].count }
  } catch {
    return { profile: null, sampleCount: 0 }
  }
}

export default async function QuillPage() {
  const { profile, sampleCount } = await getProfile()
  return <QuillDashboard profile={profile as never} sampleCount={sampleCount} />
}
