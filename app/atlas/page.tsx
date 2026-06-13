import { db } from '@/lib/db'
import AtlasPanel from '@/components/AtlasPanel'

export const metadata = { title: 'Atlas — Projects | TheoSYN' }
export const revalidate = 0

export default async function AtlasPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🏗️</span>
        <div>
          <h1 className="text-2xl font-bold text-white">Atlas</h1>
          <p className="text-zinc-500 text-sm">Project Manager — deadlines, deliverables, risk tracking</p>
        </div>
      </div>
      <AtlasPanel />
    </div>
  )
}
