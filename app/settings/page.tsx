import { db } from '@/lib/db'
import AddFacebookPageForm from '@/components/settings/AddFacebookPageForm'
import SocialAccountRow from '@/components/settings/SocialAccountRow'
import SettingsTabs from '@/components/SettingsTabs'
import { isAgentEnabled } from '@/lib/agent-settings'
import DeployButton from '@/components/DeployButton'

export const revalidate = 0

export default async function SettingsPage() {
  const pulseEnabled = await isAgentEnabled('Pulse')

  const accounts = await db`
    SELECT sa.*, a.name as agent_name, a.last_heartbeat
    FROM social_accounts sa
    LEFT JOIN agents a ON a.id = sa.agent_id
    ORDER BY sa.created_at DESC`

  const generalContent = (
    <div className="flex flex-col gap-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-1">TheoSYN Command Center</h2>
        <p className="text-zinc-500 text-sm">
          Manage your agents, connected accounts, and platform settings from this panel.
          Use the tabs above to navigate between sections.
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-3">Active Agents</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['Theo', 'Nova', 'Sage', 'Scout', 'Piper', 'Atlas', 'Lumen', 'Remi', 'Beacon', 'Pulse', 'Scribe'].map(name => (
            <div key={name} className="bg-zinc-800 rounded-lg px-4 py-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span className="text-zinc-300 text-sm font-medium">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const socialContent = (
    <div className="flex flex-col gap-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="mb-5">
          <h2 className="text-white font-semibold">Connected Social Pages</h2>
          <p className="text-zinc-500 text-sm mt-1">
            Each connected page gets a dedicated AI agent that posts content,
            monitors engagement, and writes daily heartbeat reports to your dashboard.
          </p>
        </div>

        {accounts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wide mb-3">
              Connected Pages ({accounts.length})
            </h3>
            {(accounts as any[]).map(a => (
              <SocialAccountRow key={a.id} account={a} />
            ))}
          </div>
        )}

        <div>
          <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wide mb-3">
            Connect a New Page
          </h3>
          <AddFacebookPageForm />
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-3">How to Get a Page Access Token</h2>
        <ol className="flex flex-col gap-2 text-zinc-400 text-sm list-decimal list-inside">
          <li>Go to <span className="text-indigo-400">developers.facebook.com</span> and log in</li>
          <li>Open <strong className="text-zinc-300">Graph API Explorer</strong></li>
          <li>Select your app from the dropdown (or create one)</li>
          <li>Click <strong className="text-zinc-300">Generate Access Token</strong></li>
          <li>Select your Facebook Page from the list</li>
          <li>Grant permissions: <code className="text-xs bg-zinc-800 px-1 rounded">pages_manage_posts</code>, <code className="text-xs bg-zinc-800 px-1 rounded">pages_read_engagement</code></li>
          <li>Copy the generated token and paste it above</li>
        </ol>
        <p className="text-zinc-600 text-xs mt-3">
          For long-lived tokens (60 days), exchange your short-lived token via the Token Debugger.
          For permanent tokens, you need to go through Meta App Review.
        </p>
      </div>
    </div>
  )

  return (
    <div className="p-6 flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage connections, agents, and usage</p>
      </div>
      <DeployButton />
      <SettingsTabs generalContent={generalContent} socialContent={socialContent} pulseEnabled={pulseEnabled} />
    </div>
  )
}
