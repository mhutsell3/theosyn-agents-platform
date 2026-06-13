'use client'

import { useState } from 'react'
import UsageTab from './UsageTab'
import AgentsTab from './AgentsTab'
import EnvTab from './EnvTab'
import AdAccountsTab from './AdAccountsTab'
import PulseSettingsTab from './settings/PulseSettingsTab'
import AgentSkillsTab from './settings/AgentSkillsTab'

const BASE_TABS = ['General', 'Agents', 'Ad Accounts', 'Social Media', 'Agent Skills', 'Environment', 'Usage'] as const
type BaseTab = typeof BASE_TABS[number]
type Tab = BaseTab | 'Pulse'

export default function SettingsTabs({
  generalContent,
  socialContent,
  pulseEnabled,
}: {
  generalContent: React.ReactNode
  socialContent: React.ReactNode
  pulseEnabled: boolean
}) {
  const [active, setActive] = useState<Tab>('General')

  const tabs: Tab[] = pulseEnabled
    ? [...BASE_TABS.slice(0, 4), 'Pulse', ...BASE_TABS.slice(4)]
    : [...BASE_TABS]

  return (
    <div>
      {/* Tab nav */}
      <div className="flex gap-1 border-b border-zinc-800 mb-6 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              active === tab
                ? 'text-white border-b-2 border-indigo-500 -mb-px'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {active === 'General'      && generalContent}
      {active === 'Agents'       && <AgentsTab />}
      {active === 'Ad Accounts'  && <AdAccountsTab />}
      {active === 'Social Media' && socialContent}
      {active === 'Pulse'        && pulseEnabled && <PulseSettingsTab />}
      {active === 'Agent Skills' && <AgentSkillsTab />}
      {active === 'Environment'  && <EnvTab />}
      {active === 'Usage'        && <UsageTab />}
    </div>
  )
}
