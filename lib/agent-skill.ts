import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

/**
 * Reads an agent's skill file from config/agents/<agent>.md
 * Returns empty string if the file doesn't exist.
 * Safe to call at runtime — never throws.
 */
export async function readAgentSkill(agent: string): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), 'config', 'agents', `${agent.toLowerCase()}.md`)
    if (!existsSync(filePath)) return ''
    return await readFile(filePath, 'utf-8')
  } catch {
    return ''
  }
}
