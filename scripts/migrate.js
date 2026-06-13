const postgres = require('postgres')

async function migrate() {
  const db = process.env.DATABASE_URL
    ? postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 })
    : postgres({
        host: 'localhost', port: 5432, database: 'theosyn',
        username: 'theosyn', password: 'T9$kL2!vQ7#m',
        ssl: false, max: 1,
      })

  try {
    await db`
      CREATE TABLE IF NOT EXISTS organizations (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name       text NOT NULL,
        slug       text UNIQUE NOT NULL,
        created_at timestamptz DEFAULT now()
      )
    `

    await db`
      CREATE TABLE IF NOT EXISTS users (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email           text UNIQUE NOT NULL,
        name            text,
        image           text,
        org_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
        role            varchar(20) NOT NULL DEFAULT 'owner',
        is_system_admin boolean NOT NULL DEFAULT false,
        created_at      timestamptz DEFAULT now()
      )
    `

    await db`
      CREATE TABLE IF NOT EXISTS org_settings (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        key        text NOT NULL,
        value      text NOT NULL,
        updated_at timestamptz DEFAULT now(),
        UNIQUE(org_id, key)
      )
    `

    await db`
      CREATE TABLE IF NOT EXISTS agents (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id         uuid REFERENCES organizations(id) ON DELETE CASCADE,
        name           text NOT NULL,
        persona        text NOT NULL DEFAULT '',
        role           text NOT NULL DEFAULT '',
        avatar_emoji   text NOT NULL DEFAULT '🤖',
        last_heartbeat timestamptz,
        created_at     timestamptz DEFAULT now(),
        enabled        boolean NOT NULL DEFAULT true,
        system_enabled boolean NOT NULL DEFAULT true,
        ollama_model   text,
        gemini_model   text,
        category       varchar(20) NOT NULL DEFAULT 'smb'
      )
    `

    await db`
      CREATE TABLE IF NOT EXISTS heartbeats (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id   uuid REFERENCES agents(id) ON DELETE CASCADE,
        content    text NOT NULL,
        tags       text[] DEFAULT '{}',
        created_at timestamptz DEFAULT now()
      )
    `

    // Upgrade columns first (must exist before indexes are created)
    await db`ALTER TABLE agents ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE`
    await db`ALTER TABLE agents ADD COLUMN IF NOT EXISTS system_enabled boolean NOT NULL DEFAULT true`
    await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system_admin boolean NOT NULL DEFAULT false`

    await db`CREATE INDEX IF NOT EXISTS heartbeats_agent_id_idx ON heartbeats(agent_id)`
    await db`CREATE INDEX IF NOT EXISTS heartbeats_created_at_idx ON heartbeats(created_at DESC)`
    await db`CREATE INDEX IF NOT EXISTS agents_org_id_idx ON agents(org_id)`
    await db`CREATE INDEX IF NOT EXISTS org_settings_org_id_idx ON org_settings(org_id)`

    console.log('Migration complete')
  } finally {
    await db.end()
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
