import { Heartbeat } from '@/lib/types'

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function FeedItem({ beat }: { beat: Heartbeat }) {
  const preview = beat.content.split('\n').slice(0, 2).join(' ').slice(0, 140)

  return (
    <div className="flex gap-3 py-3 border-b border-zinc-800 last:border-0">
      <div className="text-2xl w-10 h-10 flex items-center justify-center bg-zinc-800 rounded-full flex-shrink-0">
        {beat.agent?.avatar_emoji ?? '🤖'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-white text-sm font-medium">{beat.agent?.name ?? 'Agent'}</span>
          <span className="text-zinc-500 text-xs">{beat.agent?.role}</span>
          <span className="text-zinc-600 text-xs ml-auto flex-shrink-0">{timeAgo(beat.created_at)}</span>
        </div>
        <p className="text-zinc-400 text-sm truncate">{preview}</p>
        {beat.tags.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {beat.tags.map(tag => (
              <span key={tag} className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
