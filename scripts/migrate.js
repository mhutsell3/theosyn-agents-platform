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
      CREATE TABLE IF NOT EXISTS agents (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name           text NOT NULL,
        persona        text NOT NULL DEFAULT '',
        role           text NOT NULL DEFAULT '',
        avatar_emoji   text NOT NULL DEFAULT '🤖',
        last_heartbeat timestamptz,
        created_at     timestamptz DEFAULT now(),
        enabled        boolean NOT NULL DEFAULT true,
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

    await db`CREATE INDEX IF NOT EXISTS heartbeats_agent_id_idx ON heartbeats(agent_id)`
    await db`CREATE INDEX IF NOT EXISTS heartbeats_created_at_idx ON heartbeats(created_at DESC)`

    console.log('Migration complete')
  } finally {
    await db.end()
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
