'use client'

import { useState } from 'react'
import { CalendarEvent } from '@/lib/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const eventColor: Record<string, string> = {
  content: 'bg-purple-800 text-purple-200',
  project: 'bg-amber-800 text-amber-200',
  client:  'bg-sky-800 text-sky-200',
  event:   'bg-indigo-800 text-indigo-200',
  indigo:  'bg-indigo-800 text-indigo-200',
  emerald: 'bg-emerald-800 text-emerald-200',
  amber:   'bg-amber-800 text-amber-200',
  rose:    'bg-rose-800 text-rose-200',
  sky:     'bg-sky-800 text-sky-200',
  purple:  'bg-purple-800 text-purple-200',
}

function getColor(event: CalendarEvent) {
  return eventColor[event.color] ?? eventColor[event.type] ?? 'bg-zinc-700 text-zinc-300'
}

export default function MonthCalendar({ events }: { events: CalendarEvent[] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDay + 1
    return day >= 1 && day <= daysInMonth ? day : null
  })

  const eventsByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    const key = e.date.slice(0, 10)
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})

  function prev() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function next() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prev} className="text-zinc-400 hover:text-white px-2 py-1 rounded transition-colors">←</button>
        <h2 className="text-white font-semibold">{MONTHS[month]} {year}</h2>
        <button onClick={next} className="text-zinc-400 hover:text-white px-2 py-1 rounded transition-colors">→</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map(d => (
          <div key={d} className="text-zinc-500 text-xs text-center py-1">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px bg-zinc-800 rounded-lg overflow-hidden">
        {cells.map((day, i) => {
          const dateStr = day
            ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            : ''
          const dayEvents = dateStr ? (eventsByDate[dateStr] ?? []) : []
          const isToday = dateStr === todayStr

          return (
            <div
              key={i}
              className={`bg-zinc-900 min-h-20 p-1.5 ${!day ? 'opacity-30' : ''}`}
            >
              {day && (
                <>
                  <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                    isToday ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400'
                  }`}>
                    {day}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, 3).map(e => (
                      <div
                        key={e.id}
                        className={`text-xs px-1 py-0.5 rounded truncate ${getColor(e)}`}
                        title={e.title}
                      >
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-zinc-500 text-xs">+{dayEvents.length - 3} more</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 flex-wrap">
        {[
          { label: 'Content', color: 'bg-purple-800' },
          { label: 'Projects', color: 'bg-amber-800' },
          { label: 'Clients', color: 'bg-sky-800' },
          { label: 'Events', color: 'bg-indigo-800' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
            <span className="text-zinc-500 text-xs">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
