import { Project, ProjectPhase, phaseColor } from '@/lib/types'
import ProjectCard from './ProjectCard'

interface Props {
  phase: ProjectPhase
  projects: Project[]
}

export default function ProjectColumn({ phase, projects }: Props) {
  return (
    <div className="flex flex-col gap-3 min-w-48 flex-1">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${phaseColor[phase]}`}>
          {phase}
        </span>
        <span className="text-zinc-600 text-xs">{projects.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {projects.length === 0 ? (
          <div className="border border-dashed border-zinc-800 rounded-lg p-4 text-zinc-700 text-xs text-center">
            No projects
          </div>
        ) : (
          projects.map(p => <ProjectCard key={p.id} project={p} />)
        )}
      </div>
    </div>
  )
}
