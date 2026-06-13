'use client'

import { useState } from 'react'
import { Project, projectTypeColor } from '@/lib/types'
import EditProjectModal from './EditProjectModal'

function daysUntil(dateStr: string | Date | null) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

export default function ProjectCard({ project }: { project: Project }) {
  const [editing, setEditing] = useState(false)
  const days = daysUntil(project.due_date)
  const overdue = days !== null && days < 0
  const dueSoon = days !== null && days >= 0 && days <= 3

  return (
    <>
      <div
        onClick={() => setEditing(true)}
        className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col gap-2 hover:border-zinc-600 transition-colors cursor-pointer"
      >
        <p className="text-white text-sm font-medium leading-tight">{project.name}</p>

        {project.client_name && (
          <p className="text-zinc-500 text-xs">{project.client_name}</p>
        )}

        <span className={`text-xs px-1.5 py-0.5 rounded-full self-start ${projectTypeColor[project.type]}`}>
          {project.type}
        </span>

        {project.notes && (
          <p className="text-zinc-600 text-xs line-clamp-2">{project.notes}</p>
        )}

        <div className="flex items-center justify-between mt-auto">
          {days !== null ? (
            <p className={`text-xs ${overdue ? 'text-rose-400' : dueSoon ? 'text-amber-400' : 'text-zinc-600'}`}>
              {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `Due in ${days}d`}
            </p>
          ) : <span />}

          {project.notion_url && (
            <a
              href={project.notion_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-white text-xs flex items-center gap-1 transition-colors"
              onClick={e => e.stopPropagation()}
            >
              📝 Notion
            </a>
          )}
        </div>
      </div>

      {editing && (
        <EditProjectModal project={project} onClose={() => setEditing(false)} />
      )}
    </>
  )
}
