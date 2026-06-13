import LumenPanel from '@/components/LumenPanel'

export const metadata = { title: 'Lumen — Finance | TheoSYN' }
export const revalidate = 0

export default async function LumenPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">💡</span>
        <div>
          <h1 className="text-2xl font-bold text-white">Lumen</h1>
          <p className="text-zinc-500 text-sm">Finance & Admin — revenue, invoices, overdue alerts</p>
        </div>
      </div>
      <LumenPanel />
    </div>
  )
}
