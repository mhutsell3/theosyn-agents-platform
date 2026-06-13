import { db } from '@/lib/db'

interface ScheduleItem {
  label: string
  cadence: string
  description: string
  agent: string
  agentEmoji: string
  color: string
}

const SCHEDULED: ScheduleItem[] = [
  { label: 'Theo Daily Standup',    cadence: 'Daily 6am',    description: 'Cross-branch briefing — pipeline, projects, finance, leads', agent: 'Theo',  agentEmoji: '🧠', color: 'text-indigo-400' },
  { label: 'Publish Due Posts',     cadence: 'Every 15 min', description: 'Auto-post scheduled content to social accounts',            agent: 'Nova',  agentEmoji: '🎬', color: 'text-pink-400' },
  { label: 'Fetch Engagement',      cadence: 'Every hour',   description: 'Pull likes, comments, reach from published posts',        agent: 'Nova',  agentEmoji: '🎬', color: 'text-pink-400' },
  { label: 'Social Heartbeats',     cadence: 'Daily 8am',    description: 'Weekly social performance report per account',            agent: 'Nova',  agentEmoji: '🎬', color: 'text-pink-400' },
  { label: 'Scout Prospecting',     cadence: 'Mon 7am',      description: 'Auto-search 3 business categories, save Grade A leads',   agent: 'Scout', agentEmoji: '🔭', color: 'text-indigo-400' },
  { label: 'Scout Outreach',        cadence: 'Daily 9am',    description: 'Auto-generate outreach emails for new Grade A leads',     agent: 'Scout', agentEmoji: '🔭', color: 'text-indigo-400' },
  { label: 'Scout Follow-Up',       cadence: 'Daily 10am',   description: 'Flag contacted leads with no response after 3 days',      agent: 'Scout', agentEmoji: '🔭', color: 'text-indigo-400' },
  { label: 'Nova Ideas',            cadence: 'Manual',       description: 'Generate content ideas from active projects',             agent: 'Nova',  agentEmoji: '🎬', color: 'text-pink-400' },
  { label: 'Nova Heartbeat',        cadence: 'Manual',       description: 'Weekly content performance digest',                       agent: 'Nova',  agentEmoji: '🎬', color: 'text-pink-400' },
  { label: 'Sage Research',         cadence: 'Manual',       description: 'On-demand research brief + resource curation',           agent: 'Sage',  agentEmoji: '🔍', color: 'text-cyan-400' },
  { label: 'Sage Intel Digest',     cadence: 'Manual',       description: 'Weekly AI trends & strategy digest',                     agent: 'Sage',  agentEmoji: '🔍', color: 'text-cyan-400' },
]

export default async function ScheduledTasks() {
  // Get last scheduled post time
  const [nextPost] = await db`
    SELECT title, scheduled_date, post_time
    FROM content_posts
    WHERE status = 'Scheduled' AND draft_content IS NOT NULL
    ORDER BY scheduled_date ASC, post_time ASC
    LIMIT 1`

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-zinc-400 text-xs font-mono uppercase tracking-widest">AI Scheduled</span>
        <span className="text-indigo-400 text-xs font-mono">{SCHEDULED.length} ACTIVE</span>
      </div>

      {/* Next post alert */}
      {nextPost && (
        <div className="bg-indigo-950/50 border border-indigo-800/50 rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-indigo-400 text-xs">⏰</span>
          <span className="text-indigo-300 text-xs flex-1 truncate">
            Next: <span className="font-medium">{(nextPost as { title: string }).title}</span>
          </span>
          <span className="text-indigo-500 text-xs font-mono">
            {new Date((nextPost as { scheduled_date: string }).scheduled_date).toLocaleDateString()}
          </span>
        </div>
      )}

      {/* Schedule list */}
      <div className="flex flex-col gap-1">
        {SCHEDULED.map((item, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 border-b border-zinc-900 last:border-0">
            <span className="text-sm w-5">{item.agentEmoji}</span>
            <div className="flex-1 min-w-0">
              <span className="text-white text-xs font-medium">{item.label}</span>
            </div>
            <span className={`text-xs font-mono flex-shrink-0 ${
              item.cadence === 'Manual' ? 'text-zinc-600' : 'text-emerald-400'
            }`}>
              {item.cadence}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
