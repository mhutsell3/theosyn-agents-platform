import { db } from '@/lib/db'
import { CalendarEvent } from '@/lib/types'
import MonthCalendar from '@/components/calendar/MonthCalendar'
import AddEventModal from '@/components/calendar/AddEventModal'

export const revalidate = 0

export default async function CalendarPage() {
  // Pull events from all 4 sources
  const [manualEvents, contentPosts, projects, clients] = await Promise.all([
    db`SELECT id, title, to_char(event_date, 'YYYY-MM-DD') as date, type, color, notes FROM events`,
    db`SELECT id, title, to_char(scheduled_date, 'YYYY-MM-DD') as date, 'content' as type, 'purple' as color FROM content_posts WHERE scheduled_date IS NOT NULL AND status != 'Published'`,
    db`SELECT id, name as title, to_char(due_date, 'YYYY-MM-DD') as date, 'project' as type, 'amber' as color FROM projects WHERE due_date IS NOT NULL AND phase != 'Delivered'`,
    db`SELECT id, name as title, to_char(now(), 'YYYY-MM-DD') as date, 'client' as type, 'sky' as color, stage as notes FROM clients WHERE stage IN ('Discovery', 'Proposal')`,
  ])

  const allEvents: CalendarEvent[] = [
    ...(manualEvents as unknown as CalendarEvent[]),
    ...(contentPosts as unknown as CalendarEvent[]),
    ...(projects as unknown as CalendarEvent[]),
    ...(clients as unknown as CalendarEvent[]).map(c => ({
      ...c,
      title: `Follow up: ${c.title}`,
      notes: `Stage: ${c.notes}`,
    })),
  ].filter(e => e.date)

  const today = new Date()
  const upcoming = allEvents
    .filter(e => new Date(e.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 8)

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <p className="text-zinc-500 text-sm mt-1">Content · Projects · Clients · Events</p>
        </div>
        <AddEventModal />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main calendar */}
        <div className="xl:col-span-3">
          <MonthCalendar events={allEvents} />
        </div>

        {/* Upcoming sidebar */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Upcoming</h2>
          {upcoming.length === 0 ? (
            <p className="text-zinc-600 text-sm">Nothing scheduled.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {upcoming.map(e => {
                const d = new Date(e.date)
                const days = Math.ceil((d.getTime() - today.getTime()) / 86400000)
                return (
                  <div key={`${e.type}-${e.id}`} className="flex gap-3 items-start">
                    <div className="text-center flex-shrink-0 w-10">
                      <p className="text-white text-sm font-bold">{d.getDate()}</p>
                      <p className="text-zinc-500 text-xs">{d.toLocaleDateString('en-US', { month: 'short' })}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-300 text-sm truncate">{e.title}</p>
                      <p className="text-zinc-600 text-xs">
                        {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days}d`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
