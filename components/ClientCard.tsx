'use client'

import { useState } from 'react'
import { Client, typeColor } from '@/lib/types'
import EditClientModal from './EditClientModal'

function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function ClientCard({ client }: { client: Client }) {
  const [editing, setEditing] = useState(false)
  const days = daysAgo(client.updated_at)

  return (
    <>
      <div
        onClick={() => setEditing(true)}
        className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col gap-2 hover:border-zinc-600 transition-colors cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-white text-sm font-medium leading-tight">{client.name}</p>
          <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${typeColor[client.type]}`}>
            {client.type}
          </span>
        </div>
        {client.contact_name && (
          <p className="text-zinc-500 text-xs">{client.contact_name}</p>
        )}
        {client.notes && (
          <p className="text-zinc-600 text-xs line-clamp-2">{client.notes}</p>
        )}
        <p className="text-zinc-700 text-xs mt-auto">
          {days === 0 ? 'Updated today' : `${days}d in stage`}
        </p>
      </div>

      {editing && (
        <EditClientModal client={client} onClose={() => setEditing(false)} />
      )}
    </>
  )
}
