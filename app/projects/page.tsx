import { db } from '@/lib/db'
import { Project, Client, PROJECT_PHASES } from '@/lib/types'
import ProjectColumn from '@/components/ProjectColumn'
import AddProjectModal from '@/components/AddProjectModal'
import AtlasPanel from '@/components/AtlasPanel'

export const revalidate = 0

export default async function ProjectsPage() {
  const [projects, clients] = await Promise.all([
    db<Project[]>`
      SELECT p.*, c.name as client_name
      FROM projects p
      LEFT JOIN clients c ON c.id = p.client_id
      ORDER BY p.due_date ASC NULLS LAST`,
    db<Client[]>`SELECT id, name FROM clients ORDER BY name`,
  ])

  const byPhase = Object.fromEntries(
    PROJECT_PHASES.map(phase => [phase, projects.filter(p => p.phase === phase)])
  )

  const total = projects.length
  const active = (byPhase['Planning'].length + byPhase['Building'].length + byPhase['Review'].length)
  const overdue = projects.filter(p => p.due_date && new Date(p.due_date) < new Date() && p.phase !== 'Delivered').length

  return (
    <div className="p-6 flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {total} total · {active} active · {overdue > 0 ? <span className="text-rose-400">{overdue} overdue</span> : '0 overdue'}
          </p>
        </div>
        <AddProjectModal clients={clients} />
      </div>

      {/* Atlas panel */}
      <AtlasPanel />

      <div className="flex gap-4 overflow-x-auto pb-4">
        {PROJECT_PHASES.map(phase => (
          <ProjectColumn key={phase} phase={phase} projects={byPhase[phase] ?? []} />
        ))}
      </div>
    </div>
  )
}
